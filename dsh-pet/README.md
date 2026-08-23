# dsh-pet 🐾

<p align="center">
  <a href="https://www.npmjs.com/package/@001-orz/dsh-pet"><img alt="npm version" src="https://img.shields.io/npm/v/@001-orz/dsh-pet?label=npm&color=blue"></a>
  <a href="https://www.npmjs.com/package/@001-orz/dsh-pet"><img alt="npm monthly downloads" src="https://img.shields.io/npm/dm/@001-orz/dsh-pet?label=%E6%9C%88%E4%B8%8B%E8%BD%BD&color=brightgreen"></a>
  <a href="https://www.npmjs.com/package/@001-orz/dsh-pet"><img alt="total downloads" src="https://img.shields.io/npm/dt/@001-orz/dsh-pet?label=%E6%80%BB%E4%B8%8B%E8%BD%BD&color=success"></a>
  <a href="https://github.com/001-orz/dsh-pet"><img alt="stars" src="https://img.shields.io/github/stars/001-orz/dsh-pet?style=social"></a>
  <a href="https://github.com/001-orz/dsh-pet/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/001-orz/dsh-pet?color=orange"></a>
  <a href="https://awesome-dsh-plugin.com"><img alt="awesome dsh plugin" src="https://awesome-dsh-plugin.com/badge.svg"></a>
  <img alt="platform" src="https://img.shields.io/badge/platform-DeepSeek%20Harness%20Web-8A2BE2">
  <img alt="assets" src="https://img.shields.io/badge/assets-51%20animations-ff69b4">
</p>

> A floating desktop pet for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI.
> 一只住在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面里的桌面宠物：待机呼吸、随机动作（含打瞌睡）、偶尔转向、屏幕漫游、点击反应、可拖拽。

---

## 🚀 安装（Web 版 / Desktop 版都支持）

本插件同时适用于 **DSH Web 版**（命令行 harness）与 **DSH Desktop 版**（桌面客户端）。
两种环境的数据目录不同，但安装逻辑一致：把 `@001-orz/dsh-pet` 加进对应 profile 的依赖与 bundle 列表即可。

### 前置条件
- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（Web 版）或 DSH Desktop 客户端
- Node.js ≥ 18、Git、pnpm（`npm i -g pnpm`）
- 「余额 / 已消耗」功能需要在 DSH 凭据里配置 `DEEPSEEK_API_KEY`；**宠物本体无密钥也能跑**，只是余额气泡会提示"未配置"

---

### 方式 A：命令行一键安装（推荐，Web 版）
```sh
dsh plugin --profile web add @001-orz/dsh-pet
```
重启 `dsh web`，宠物出现在界面右下角，51 个透明动画开箱即用。

> 若 `dsh` 命令不可用（如 Desktop 版），改用方式 B。

### 方式 B：手动安装（Web 版 & Desktop 版通用）
适合 Desktop 版（无 `dsh` CLI）或想锁定版本的场景。

1. 找到目标 profile 目录：
   - **Web 版**：`$DSH_HOME/profiles/web`（`$DSH_HOME` 默认 `~/.dsh`，可用环境变量覆盖）
   - **Desktop 版（Windows）**：`%APPDATA%\dsh-desktop\harness\profiles\web`
   - **Desktop 版（macOS）**：`~/Library/Application Support/dsh-desktop/harness/profiles/web`
   - **Desktop 版（Linux）**：`~/.config/dsh-desktop/harness/profiles/web`
2. 编辑该目录的 `package.json`：
   - `dependencies` 增加：
     ```json
     "@001-orz/dsh-pet": "github:001-orz/dsh-pet#path:/dsh-pet"
     ```
   - `dsh.profile.bundles` 数组里追加 `"@001-orz/dsh-pet"`（确保 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 等基础项仍在）
3. 在该 profile 目录执行：
   ```sh
   pnpm install
   ```
4. 重启 DSH（Web 版重跑 `dsh web`；Desktop 版退出后重开客户端）。

---

### ✅ 验证
- 界面右下角出现宠物，动画自动循环播放。
- **点宠物头部**弹出气泡：
  - 已配置 `DEEPSEEK_API_KEY` → 显示账户余额、今日已用、最近一轮消耗
  - 未配置 → 提示"未配置 DEEPSEEK_API_KEY"（其余功能正常）
- 右键气泡可关闭。

> 💡 想自己造一只专属宠物？克隆 [001-orz/dsh-pet](https://github.com/001-orz/dsh-pet) 仓库，用内置素材链（AI 提示词 → 绿幕视频 → 透明动画，素材由豆包生成）从零生成，全流程可复现。

## ✨ 功能特性

- **纯粹的桌宠**：不掺业务功能——没有天气查询、系统监控、Agent 状态感知，就一件事：陪你。核心动画零模型成本；可选的「余额 / 已消耗」功能才会调用 DeepSeek 余额 API（密钥取自 DSH 凭据，不入库、不回显）
- **51 个手绘风透明动画**：待机呼吸、打瞌睡、玩魔方、哼歌、炸毛、吐泡泡、玩水枪、小提琴演奏、蓝鲸现世、吃白饭、照镜子、三支舞、写代码、四季动作（放风筝、堆雪人、吃冰淇淋、放烟花……）全部无缝衔接
- **永不停止的动画链**：每段动画播完立即按概率选下一个（30% 待机 / 10% 转向 / 40% 动作 / 20% 移动）
- **屏幕漫游**：朝 facing 方向行走，自动检查空间、不走出屏幕
- **点击 / 拖拽**：点击有随机回应动画（开心 / 害羞 / 傲娇），可拖到任意位置
- **左右朝向**：所有动画 CSS 镜像，人物可朝左 / 朝右
- **落地对齐**：动画统一脚底线，宠物始终站在"地面"上
- **流畅切换**：双缓冲 video 交叉淡入，切换零空白帧
- **无障碍友好**：支持 `prefers-reduced-motion`
- **余额 & 已消耗（可选）**：左键点宠物头部弹出气泡，显示 DeepSeek 账户余额与「今日已用 / 最近一轮消耗」；每轮 token 按峰谷定价换算成本，跨天自动归档（本地账本 `$DSH_HOME/.dsh-pet-usage.json`）。密钥走 `ctx.credentials.resolve('DEEPSEEK_API_KEY')`，兜底环境变量，绝不回显
  - **峰谷时段（北京时间）**：工作日（周一~周五）高峰为 9:00–12:00 与 14:00–18:00，其余为闲时；**周末（周六、周日）全天低谷、无高峰**（DeepSeek 2026 新计费政策）。气泡会显示「高峰（烧钱中）/ 周末低谷（便宜）/ 闲时（便宜）」。

## ⚙️ 配置

| 配置项 | 说明 | 当前状态 |
|---|---|---|
| `size` | 舞台宽度（px），宠物高度 = 宽度×9/16×74% | 默认 462（≈高度 260px），**暂未下发到浏览器**（DSH 客户端配置管线限制，走代码默认值） |
| `position` | 默认角落位置 | 默认右下角，同上暂未下发 |
| `fullRoot` | 原始 2160×1215 母版资源目录 | 默认 `$DSH_HOME/pet-assets`，需手动下载母版后生效 |

> 说明：插件安装即用，上述配置均为可选；`size`/`position` 的浏览器侧配置化正在规划中。

## 🗑️ 卸载

```sh
dsh plugin --profile web remove @001-orz/dsh-pet
```

## 🎬 效果预览

> 动画为透明背景；GitHub 内以下以视频形式自动播放（仓库 `dsh-pet/assets/thumb/` 共 51 个，可点击下载查看）。

![东张西望](assets/thumb/东张西望.webm) ![原地漂浮踏步](assets/thumb/原地漂浮踏步.webm) ![原地小憩沉眠](assets/thumb/原地小憩沉眠.webm) ![原地专心玩魔方](assets/thumb/原地专心玩魔方.webm) ![写代码](assets/thumb/写代码.webm) ![优雅女仆舞](assets/thumb/优雅女仆舞.webm)

全部 51 个动画见仓库：`dsh-pet/assets/thumb/`。

## 📚 完整项目（不止是插件）

这是**完整的三件套项目**，任何人 clone 仓库都可以从零生成自己的桌面宠物：

```
① 提示词（配方）    →  ② 素材生成链（引擎）  →  ③ 插件（成品）
AI 生成动画的配方     源视频 → 透明动画的管线    运行在 DSH 里的宠物
```

- 仓库：[001-orz/dsh-pet](https://github.com/001-orz/dsh-pet)
- 设计与实现文档：[DESIGN.md](https://github.com/001-orz/dsh-pet/blob/main/DESIGN.md)

## 🔎 发现更多 DSH 插件

- 社区插件目录：[awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)
- DSH 官方仓库：[deepseek-ai/DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness)

## 📄 许可

- 代码：MIT
- 素材（动画/提示词）：见仓库说明
