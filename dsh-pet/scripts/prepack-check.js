/**
 * dsh-pet prepack 健康检查
 * ------------------------------------------------------------------
 * 作为 package.json 的 `prepack` 钩子运行（npm publish / npm pack 前自动执行）。
 * 目的：在发布前校验关键产物就位，避免发出"空包 / 坏包 / 缺入口"的版本。
 *
 * 检查项：
 *   1. 宿主半侧入口 lib/index.js、浏览器半侧入口 lib/client.js 必须存在
 *   2. assets/thumb/ 下至少有一个 .webm 动画（宠物本体资源）
 *   3. package.json 的 `files` 字段列出的每个路径在磁盘上真实存在
 *      （防止 files 写错导致发布内容缺文件）
 *
 * 任一项失败 → process.exit(1) 阻断发布；全部通过 → 打印 OK。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url)); // .../dsh-pet/scripts
const pkgRoot = join(scriptDir, '..');                    // .../dsh-pet

function fail(msg) {
  console.error('[prepack-check] FAIL: ' + msg);
  process.exit(1);
}

// 1) 关键入口文件
for (const rel of ['lib/index.js', 'lib/client.js']) {
  if (!existsSync(join(pkgRoot, rel))) {
    fail(`missing required entry file: ${rel}`);
  }
}

// 2) assets/thumb 非空（至少 1 个 webm）
const thumbDir = join(pkgRoot, 'assets/thumb');
if (!existsSync(thumbDir)) {
  fail('missing assets/thumb directory');
}
const thumbs = readdirSync(thumbDir).filter((n) => n.toLowerCase().endsWith('.webm'));
if (thumbs.length === 0) {
  fail('assets/thumb contains no .webm animations — pet has no body!');
}

// 3) package.json `files` 字段列出的路径都存在
let pkg;
try {
  pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
} catch (e) {
  fail('cannot read/parse package.json: ' + e.message);
}
for (const entry of pkg.files || []) {
  if (!existsSync(join(pkgRoot, entry))) {
    fail(`package.json "files" entry missing on disk: ${entry}`);
  }
}

console.log(`[prepack-check] OK — ${thumbs.length} animations, entries & files verified.`);
