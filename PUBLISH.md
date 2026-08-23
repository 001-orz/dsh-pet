# 发布指南 / PUBLISH

本仓库已整理完毕，可直接发布到 GitHub 与 npm，供他人通过以下命令安装：

```sh
dsh plugin --profile web add @001-orz/dsh-pet
```

## 一、GitHub 用户名占位符（已完成）

仓库内的 `001-orz` **就是你的真实 GitHub 用户名**，占位符已全部替换完毕，无需再改：

- `dsh-pet/package.json` → `name: @001-orz/dsh-pet`、`repository`/`homepage`/`bugs` → `github.com/001-orz/dsh-pet`、`author: 001-orz`
- `dsh-pet/LICENSE` 与根 `LICENSE` → `Copyright (c) 2026 001-orz & PC2005-cloud`（保留原作者署名）
- 根与子包 `README.md` / `README.en.md` → 所有链接、徽章、安装命令已指向 `001-orz`

## 二、发布到 npm

```sh
cd dsh-pet
npm login            # 首次需登录，或用 npm token
npm publish --access public   # scope 包必须显式 public
```

- `prepack` 钩子会自动跑 `scripts/prepack-check.js` 健康检查（校验 lib 入口、assets/thumb 非空、files 路径存在），通过后才会打包。
- 已用真实名 `@001-orz/dsh-pet` 跑过 `npm pack` 验证：生成 `001-orz-dsh-pet-0.1.4.tgz`（35 MB，60 文件），含 `lib/`、`assets/thumb/`（51 个 webm）、`cordis.patch.yml`、`LICENSE`、`README`，**不含** `src/`、`assets/preview`（这俩只留 GitHub 仓库，不进 npm 包，符合设计）。验证通过。

## 三、推送到 GitHub

```sh
git add -A
git commit -m "feat: dsh-pet desktop pet plugin (fork of PC2005-cloud/dsh-pet)"
git remote add origin https://github.com/001-orz/dsh-pet.git
git branch -M main
git push -u origin main
```

仓库描述里写明安装命令：`dsh plugin --profile web add @001-orz/dsh-pet`。

## 四、安装验证

```sh
dsh plugin --profile web add @001-orz/dsh-pet
dsh web            # 重启后宠物出现在界面右下角
```

确认：宠物出现、无加载报错（重点看控制台是否有 `/pet/thumb/...` 404 或 `resolveDshHome` 报错——本仓库已对后者做容错）。

## 五、已知待补项（不影响安装，仅影响 README 观感）

以下文件因本机网络拉取原版仓库不稳定而**暂未入库**，README 中对应图片链接会 404。你网络通畅时可从原版补齐：

- `assets/screenshots/dsh-pet-running-1.png`、`dsh-pet-running-2.png`（运行截图，README「运行效果」一节引用）
- `dsh-pet/assets/preview/*.gif`（约 100 个 GIF 预览，README「效果预览」一节引用）

补齐命令（在仓库根）：
```sh
# 用 GitHub raw 下载，或 git clone PC2005-cloud/dsh-pet 后拷贝这两处
```

- `video/` 目录：原版源绿幕视频托管在 GitHub Releases（assets-videos），不入库；`.gitignore` 已忽略 `video/*.mp4`。如需本地复现素材链再从 Releases 下载。

## 六、合规与署名

- **代码**：MIT 许可。本仓库基于 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 修改发布，已保留原作者 Copyright 署名（LICENSE 写 `001-orz & PC2005-cloud`）。
- **素材（动画 / 提示词）**：沿用原版「代码 MIT、素材禁商用」约定，README「许可」一节已注明。
- **本地修复**：`dsh-pet/lib/index.js` 对 `@deepseek-ai/dsh-home-paths` 缺失做了 try/catch 容错（防止部分 profile 未装该包时整包加载失败），已在 DESIGN/代码注释中说明。
