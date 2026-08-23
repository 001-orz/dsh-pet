/**
 * ============================================================================
 * dsh-pet 宿主半侧（host half）—— 宠物插件的"后端"部分
 * ============================================================================
 *
 * 【这个文件是什么】
 *   本文件运行在 DSH 的 Node 服务端（不是浏览器）。职责：
 *   1. 在 DSH 的 Web 服务器上注册 `/pet/` 前缀的 HTTP 路由：
 *      - /pet/thumb/<动画名>.webm  → 流式返回插件包内动画（浏览器播放用）
 *      - /pet/full/<动画名>.webm   → 流式返回 $DSH_HOME/pet-assets/ 原始母版（可选）
 *      - /pet/balance              → DeepSeek 余额 + 今日已用（记账模式）
 *      - /pet/last-turn            → 最近一轮对话消耗统计
 *   2. 监听 DSH 会话事件流（ctx.on('session/event')），按 (session, turn)
 *      聚合每轮真实 token 用量，按峰谷定价换算成本，供 /pet/last-turn 返回。
 *   3. 维护"今日已用"账本（$DSH_HOME/.dsh-pet-usage.json）：每次观测到
 *      余额下降就把差值累计到当天用量，跨天自动归零归档（保留 30 天）。
 *
 * 【能力来源】每轮消耗统计、峰谷定价、余额差值记账的设计参照了
 *   MeteorNOX/DeepSeek-Balance-Whale-Widget（MIT License）——只取宿主侧
 *   逻辑，UI 仍是 dsh-pet 自己的宠物气泡。
 *
 * 【安全】
 *   - 密钥优先走 DSH 凭据服务 ctx.credentials.resolve('DEEPSEEK_API_KEY')，
 *     兜底 process.env.DEEPSEEK_API_KEY；任何分支都不回显密钥。
 *   - 资源路径做防穿越校验（resolveAsset）。
 *
 * ============================================================================
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
// 解析 DSH 主目录（$DSH_HOME，默认 ~/.dsh）。
// 官方包 @deepseek-ai/dsh-home-paths 在某些 profile 未安装（被 dsh 重装清除），
// 此处做容错兜底：找不到包时回退到默认主目录，避免整包加载失败导致 dsh 打不开。
let resolveDshHome;
try {
  ({ resolveDshHome } = await import('@deepseek-ai/dsh-home-paths'));
} catch {
  // 兜底：@deepseek-ai/dsh-home-paths 未安装时，按以下顺序确定主目录
  resolveDshHome = () => {
    if (process.env.DSH_HOME) return process.env.DSH_HOME;
    if (process.env.DSH_PET_TEST_HOME) return process.env.DSH_PET_TEST_HOME;
    // 桌面版 DSH Desktop（Windows）默认数据目录（不硬编码用户名，兼容任意机器）
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || join(os.homedir(), 'AppData', 'Roaming');
      return join(appData, 'dsh-desktop', 'harness');
    }
    return (process.env.HOME || '') + '/.dsh';
  };
}

// 插件行 id（与 cordis.patch.yml 一致）
const name = 'pet';
/** 需要注入的服务：webServer（Web 服务器路由注册表）；credentials/session 事件为核心服务无需注入 */
const inject = ['webServer'];

/** 本包目录（src 和安装后都适用——import.meta.url 指向 lib/，上一级即包根） */
const PACKAGE_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** 路由前缀 */
const ROUTE_PREFIX = '/pet';

/** 不同扩展名对应的 Content-Type 映射 */
const MIME = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

// ============================================================================
// 余额查询 —— GET /pet/balance
// ============================================================================
const BALANCE_URL = 'https://api.deepseek.com/user/balance';
const BALANCE_TIMEOUT_MS = 10000;      // 单次请求超时
const BALANCE_TTL_MS = 25000;          // 余额缓存 25s：客户端 60s 轮询 + 点击刷新时避免重复打 API
let balanceCache = null;               // { ok:true, totalBalance, currency, updatedAt, data } 或错误载荷
let balanceCacheAt = 0;

/**
 * 从 DSH 凭据服务读取 DEEPSEEK_API_KEY，环境变量兜底。
 * @returns {Promise<string|null>} 密钥或 null
 */
async function resolveApiKey(ctx) {
  try {
    const cred = await ctx.credentials.resolve('DEEPSEEK_API_KEY');
    if (cred && cred.value) return String(cred.value);
  } catch { /* 凭据服务不可用时走环境变量 */ }
  const env = process.env.DEEPSEEK_API_KEY;
  return env && env.length > 0 ? env : null;
}

/** 从 balance_infos[] 挑一个主展示项：优先 CNY 且余额>0，其次有余额的，再次 CNY，最后第一个 */
function pickBalanceInfo(infos) {
  if (!Array.isArray(infos) || infos.length === 0) return null;
  const num = (x) => (x && x.total_balance !== undefined ? Number(x.total_balance) : NaN);
  return (
    infos.find((x) => x && x.currency === 'CNY' && num(x) > 0) ||
    infos.find((x) => num(x) > 0) ||
    infos.find((x) => x && x.currency === 'CNY') ||
    infos[0]
  );
}

/**
 * 拉取余额（带 2 次重试）。成功时返回主项数字。
 * @param {object} ctx - 插件上下文（读凭据）
 * @returns {Promise<{ok:boolean, code?:string, message?:string, totalBalance?:number, currency?:string, data?:object}>}
 */
async function fetchBalance(ctx) {
  const apiKey = await resolveApiKey(ctx);
  if (!apiKey) {
    return { ok: false, code: 'NO_API_KEY', message: '未配置 DEEPSEEK_API_KEY（DSH 凭据或环境变量）' };
  }
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let resp;
    try {
      resp = await fetch(BALANCE_URL, {
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS),
      });
    } catch (err) {
      lastErr = err;
      if (attempt === 0) { await new Promise((r) => setTimeout(r, 500)); continue; }
      break;
    }
    if (!resp.ok) {
      lastErr = new Error('HTTP ' + resp.status);
      if (resp.status >= 500 && attempt === 0) { await new Promise((r) => setTimeout(r, 500)); continue; }
      // 4xx：读取错误体（不回显密钥）
      try {
        const body = await resp.json();
        const raw = body && (body.error || body.message);
        const apiMsg = (typeof raw === 'string' && raw.length > 0)
          || (raw && typeof raw === 'object' && (raw.message || raw.msg))
          || ('DeepSeek API 返回 HTTP ' + resp.status);
        return { ok: false, code: 'API_ERROR', status: resp.status, message: String(apiMsg) };
      } catch {
        return { ok: false, code: 'API_ERROR', status: resp.status, message: 'DeepSeek API 返回 HTTP ' + resp.status };
      }
    }
    try {
      const data = await resp.json();
      const info = pickBalanceInfo(data && data.balance_infos);
      if (!info || info.total_balance === undefined) {
        return { ok: false, code: 'SHAPE', message: '余额接口返回结构异常' };
      }
      return { ok: true, totalBalance: Number(info.total_balance), currency: String(info.currency || 'CNY'), data };
    } catch {
      return { ok: false, code: 'PARSE', message: '余额接口返回不是合法 JSON' };
    }
  }
  return { ok: false, code: 'FETCH_FAILED', message: '余额查询失败：' + String((lastErr && lastErr.message) || lastErr) };
}

// ============================================================================
// 今日已用 —— 小鲸鱼记账（余额差值本地记账，仿照 dsh-whale-widget）
// ============================================================================
const USAGE_FILE = () => join(resolveDshHome(), '.dsh-pet-usage.json');

function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function readUsageLedger() {
  try {
    const parsed = JSON.parse(readFileSync(USAGE_FILE(), 'utf8'));
    if (parsed && typeof parsed === 'object' && typeof parsed.date === 'string') return parsed;
  } catch { /* 无文件或损坏 */ }
  return { date: todayKey(), lastBalance: null, todayUsage: 0, history: {} };
}

function writeUsageLedger(led) {
  try {
    writeFileSync(USAGE_FILE(), JSON.stringify(led), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** 记账：观测到余额后，把正差值累计到当天用量（跨天自动归零归档，保留 30 天） */
function recordLedgerUsage(currentBalance) {
  const t = todayKey();
  const led = readUsageLedger();
  if (led.date !== t) {
    // 跨天：归档昨天用量
    if (led.date && typeof led.todayUsage === 'number') {
      led.history = led.history || {};
      led.history[led.date] = led.todayUsage;
    }
    led.date = t;
    led.lastBalance = currentBalance;
    led.todayUsage = 0;
  } else {
    const prev = typeof led.lastBalance === 'number' ? led.lastBalance : currentBalance;
    if (typeof prev === 'number' && typeof currentBalance === 'number' && currentBalance < prev) {
      led.todayUsage = (typeof led.todayUsage === 'number' ? led.todayUsage : 0) + (prev - currentBalance);
    }
    led.lastBalance = currentBalance;
  }
  const keys = Object.keys(led.history || {}).sort();
  while (keys.length > 30) delete led.history[keys.shift()];
  writeUsageLedger(led);
  return led;
}

// ============================================================================
// 每轮对话消耗统计 —— 会话事件聚合 + 峰谷定价（仿照 dsh-whale-widget）
// ============================================================================
// 高峰时段：每日 9:00–12:00 和 14:00–18:00（北京时间）。
// 定价：每百万 token 的 CNY 价格 [闲时价, 高峰价]。
const PEAK_HOURS = [[9, 12], [14, 18]];
const BASE_PRICE = { hit: [0.05, 0.1], miss: [1.5, 3.0], out: [4.5, 9.0] };
const PRO_PRICE = { hit: [0.15, 0.3], miss: [4.5, 9.0], out: [13.5, 27.0] };
const PRICING = {
  'deepseek-v4-flash-vision-exp': BASE_PRICE,
  'deepseek-v4-flash': BASE_PRICE,
  'deepseek-v4-pro': PRO_PRICE,
  'deepseek-chat': BASE_PRICE,
  'deepseek-reasoner': BASE_PRICE,
  _default: BASE_PRICE,
};

function priceFor(model) {
  const m = String(model || '').toLowerCase();
  for (const key of Object.keys(PRICING)) {
    if (key === '_default') continue;
    if (m.indexOf(key) !== -1) return PRICING[key];
  }
  return PRICING._default;
}

/** epoch 秒 → 北京时间小时，判断是否高峰 */
function isPeakTime(timeSec) {
  if (!isFinite(Number(timeSec))) return false;
  const hour = new Date(Number(timeSec) * 1000 + 8 * 3600 * 1000).getUTCHours();
  for (const [start, end] of PEAK_HOURS) {
    if (hour >= start && hour < end) return true;
  }
  return false;
}

// ============================================================================
// 今日已用（精确模式）—— 实时·令牌：DeepSeek 平台用量接口
// ============================================================================
// 记账模式（余额差值）在"首次观测之前"的消耗会漏记（如部署前/服务停机期间）。
// 令牌模式直接调 DeepSeek 平台官方用量接口，返回精确的今日消耗。
// 凭据：DEEPSEEK_PLATFORM_TOKEN（平台网页会话令牌，非 sk- 密钥）。
// 获取：platform.deepseek.com 登录后 F12 → Network → 找 usage/by_api_key/amount
//       请求 → 复制其 Authorization 请求头值（Bearer eyJ...）。
const PLATFORM_USAGE_URL = 'https://platform.deepseek.com/api/v0/usage/by_api_key/amount';

/**
 * 用平台令牌查今日用量（精确）。
 * @returns {Promise<{amount:number, tokens:number}|null>} 失败/无令牌返回 null（调用方回落记账模式）
 */
async function fetchTodayUsageToken(ctx) {
  let token = null;
  try {
    const cred = await ctx.credentials.resolve('DEEPSEEK_PLATFORM_TOKEN');
    if (cred && cred.value) token = String(cred.value);
  } catch { /* 凭据服务不可用 */ }
  if (!token) token = process.env.DEEPSEEK_PLATFORM_TOKEN;
  if (!token) return null;
  const clean = token.replace(/^Bearer\s+/i, '');
  try {
    const now = new Date();
    const tz = -now.getTimezoneOffset() * 60;
    const start = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
    const url = PLATFORM_USAGE_URL + '?start=' + start + '&end=' + (start + 86400) + '&tz=' + tz;
    const resp = await fetch(url, {
      headers: { Authorization: 'Bearer ' + clean },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return computeTodayUsage(data);
  } catch {
    return null; // 令牌失效/网络失败 → 回落记账模式
  }
}

/** 平台用量接口响应 → {amount, tokens}（仿 dsh-whale-widget 的 computeTodayUsage） */
function computeTodayUsage(data) {
  let d = data;
  if (d && d.data && d.data.biz_data && Array.isArray(d.data.biz_data.series)) d = d.data.biz_data;
  else if (d && d.data && Array.isArray(d.data.series)) d = d.data;
  const series = Array.isArray(d.series) ? d.series : null;
  if (!series || series.length === 0) return null;
  let cost = 0;
  let tokens = 0;
  let found = false;
  for (const s of series) {
    if (!s || typeof s !== 'object') continue;
    const p = priceFor(s.model);
    const buckets = Array.isArray(s.buckets) ? s.buckets : [];
    for (const b of buckets) {
      const u = b && b.usage;
      if (!u || typeof u !== 'object') continue;
      const hit = Number(u.PROMPT_CACHE_HIT_TOKEN) || 0;
      const miss = Number(u.PROMPT_CACHE_MISS_TOKEN) || 0;
      const out = Number(u.RESPONSE_TOKEN) || 0;
      if (hit + miss + out === 0) continue;
      found = true;
      tokens += hit + miss + out;
      const pi = isPeakTime(b.time) ? 1 : 0;
      cost += (hit / 1e6) * p.hit[pi] + (miss / 1e6) * p.miss[pi] + (out / 1e6) * p.out[pi];
    }
  }
  return found ? { amount: cost, tokens } : null;
}

// 会话事件聚合状态（按 sessionId 分桶，避免主会话与子代理并行时串账）
const turnAggs = new Map(); // sessionId -> { turn, cost, tokens, lastTs }
let lastTurn = null;        // { seq, turn, amount, tokens, ts }
let lastTurnSeq = 0;

function finalizeTurn(sessionId) {
  const agg = turnAggs.get(sessionId);
  if (agg && agg.cost > 0) {
    lastTurn = { seq: ++lastTurnSeq, turn: agg.turn, amount: agg.cost, tokens: agg.tokens, ts: agg.lastTs };
  }
  turnAggs.delete(sessionId);
}

/** 聚合 assistant/message 的 usage；turn/end 时结算该会话本轮 */
function handleSessionEvent(sessionId, event) {
  try {
    const type = event && event.type;
    const d = event && event.data;
    if (!d || typeof d !== 'object') return;
    if (type === 'turn/end') {
      finalizeTurn(sessionId);
      return;
    }
    if (type !== 'assistant/message') return;
    const turn = Number(d.turn);
    const usage = d.usage;
    if (!usage || typeof usage !== 'object' || !isFinite(turn)) return;
    let agg = turnAggs.get(sessionId);
    if (!agg || agg.turn !== turn) {
      if (agg) finalizeTurn(sessionId);
      agg = { turn, cost: 0, tokens: 0, lastTs: Date.now() };
      turnAggs.set(sessionId, agg);
    }
    const input = Number(usage.inputTokens) || 0;
    const cache = Number(usage.cacheReadTokens) || 0;
    const output = Number(usage.outputTokens) || 0;
    const reasoning = Number(usage.reasoningTokens) || 0;
    agg.tokens += input + cache + output + reasoning;
    // 定价换算（缓存命中按输入价，输出+思考按输出价）
    const model = d.message && d.message.source ? d.message.source.model : '';
    const p = priceFor(model);
    const off = isPeakTime(Math.floor(Date.now() / 1000)) ? 1 : 0;
    agg.cost += (cache / 1e6) * p.hit[off] + (input / 1e6) * p.miss[off] + ((output + reasoning) / 1e6) * p.out[off];
    agg.lastTs = Date.now();
  } catch { /* 事件形状异常时静默跳过，不影响 DSH */ }
}

// ============================================================================
// 路由处理器
// ============================================================================
/** GET /pet/balance：余额 + 今日已用 + 峰谷标记（25s 缓存） */
async function handleBalance(ctx, res) {
  const now = Date.now();
  if (balanceCache && balanceCache.ok && now - balanceCacheAt < BALANCE_TTL_MS) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ...balanceCache, cached: true }));
    return;
  }
  const payload = await fetchBalance(ctx);
  if (payload.ok) {
    // 无论哪种模式，先把余额观测记入账本（自动累积「今日已用」记账数据）
    const led = recordLedgerUsage(payload.totalBalance);
    const full = {
      ok: true,
      data: payload.data,
      totalBalance: payload.totalBalance,
      currency: payload.currency,
      todayUsage: 0,
      usageMode: 'ledger',
      isPeak: isPeakTime(Math.floor(now / 1000)),
      updatedAt: new Date().toISOString(),
    };
    // 精确模式优先：配置了平台令牌（DEEPSEEK_PLATFORM_TOKEN）就用官方用量接口，
    // 返回平台一致的今日消耗；无令牌/令牌失败自动回落记账模式（余额差值）。
    const tu = await fetchTodayUsageToken(ctx);
    if (tu && isFinite(tu.amount)) {
      full.todayUsage = Number(tu.amount.toFixed(2));
      full.usageMode = 'token';
    } else {
      full.todayUsage = typeof led.todayUsage === 'number' ? Number(led.todayUsage.toFixed(2)) : 0;
      full.usageMode = 'ledger';
    }
    balanceCache = full;
    balanceCacheAt = now;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(full));
    return;
  }
  // 网络抖动/瞬时失败：沿用最近一次成功余额，不报错
  if (balanceCache && balanceCache.ok) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ...balanceCache, cached: true, stale: true }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, code: payload.code, message: payload.message }));
}

/** GET /pet/last-turn：最近一轮对话消耗 */
function handleLastTurn(res) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ ok: true, lastTurn }));
}

/**
 * 规范化并校验请求路径，确保它在 assets 根目录内（防路径穿越）。
 * @param root - assets 根目录（绝对路径）
 * @param rel  - 解码后的、路由前缀之后的路径片段
 * @returns 规范化后的绝对文件路径；非法（穿越）时返回 undefined
 */
function resolveAsset(root, rel) {
  if (rel.length === 0) return undefined;
  const candidate = normalize(join(root, rel));
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) return undefined;
  return candidate;
}

/**
 * 宿主插件主体：注册 `/pet` 前缀路由 + 会话事件监听。
 * @param ctx    - 插件上下文；ctx.webServer 是 Web 服务器服务
 * @param config - 本行的配置（来自 patch 树）
 */
function apply(ctx, config) {
  const thumbRoot = join(PACKAGE_ROOT, 'assets', 'thumb');
  const fullRoot = config.fullRoot ?? join(resolveDshHome(), 'pet-assets');

  // ---- 会话事件监听：每轮对话消耗统计（插件卸载时自动注销） ----
  ctx.effect(() => ctx.on('session/event', (session, event) => {
    const sid = session && session.id ? session.id : 'default';
    handleSessionEvent(sid, event);
  }), 'dsh-pet: session/event (per-turn cost)');
  ctx.effect(() => ctx.on('session/disposed', (session) => {
    if (session && session.id) turnAggs.delete(session.id);
  }), 'dsh-pet: session/disposed cleanup');

  // ---- /pet 前缀路由 ----
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const rest = decodeURIComponent(url.pathname.slice(ROUTE_PREFIX.length + 1));
      const [scope, ...nameParts] = rest.split('/');
      // JSON 端点
      if (scope === 'balance') { await handleBalance(ctx, res); return; }
      if (scope === 'last-turn') { handleLastTurn(res); return; }
      // 静态资源端点
      if (scope !== 'thumb' && scope !== 'full') {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('dsh-pet: expected /pet/{thumb|full|balance|last-turn}/<file>');
        return;
      }
      const fileName = nameParts.join('/');
      const root = scope === 'thumb' ? thumbRoot : fullRoot;
      const file = resolveAsset(root, fileName);
      if (file === undefined) {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('dsh-pet: invalid path');
        return;
      }
      if (!existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(scope === 'full'
          ? `dsh-pet: original asset not downloaded yet — run the fetch-assets script to populate ${fullRoot}`
          : 'dsh-pet: asset not found');
        return;
      }
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
      const contentType = MIME[ext] ?? 'application/octet-stream';
      const { size } = await stat(file);
      res.writeHead(200, {
        'content-type': contentType,
        'content-length': size,
        'cache-control': 'public, max-age=3600',
      });
      const stream = createReadStream(file);
      stream.on('error', () => { res.destroy(); });
      stream.pipe(res);
    },
  }), 'dsh-pet: /pet asset route');
}

// 导出插件三件套（Cordis Loader 需要）
export { apply, inject, name };
