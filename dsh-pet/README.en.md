# dsh-pet 🐾

<p align="center">
  <a href="https://www.npmjs.com/package/@001-orz/dsh-pet"><img alt="npm version" src="https://img.shields.io/npm/v/@001-orz/dsh-pet?label=npm&color=blue"></a>
  <a href="https://www.npmjs.com/package/@001-orz/dsh-pet"><img alt="npm monthly downloads" src="https://img.shields.io/npm/dm/@001-orz/dsh-pet?label=monthly&color=brightgreen"></a>
  <a href="https://www.npmjs.com/package/@001-orz/dsh-pet"><img alt="total downloads" src="https://img.shields.io/npm/dt/@001-orz/dsh-pet?label=total&color=success"></a>
  <a href="https://github.com/001-orz/dsh-pet"><img alt="stars" src="https://img.shields.io/github/stars/001-orz/dsh-pet?style=social"></a>
  <a href="https://github.com/001-orz/dsh-pet/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/001-orz/dsh-pet?color=orange"></a>
  <a href="https://awesome-dsh-plugin.com"><img alt="awesome dsh plugin" src="https://awesome-dsh-plugin.com/badge.svg"></a>
  <img alt="platform" src="https://img.shields.io/badge/platform-DeepSeek%20Harness%20Web-8A2BE2">
  <img alt="assets" src="https://img.shields.io/badge/assets-51%20animations-ff69b4">
</p>

> A floating desktop pet for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI: idle breathing, random actions (including dozing off), occasional turns, screen wandering, click reactions, and draggable.

---

## 🚀 Quick Start (Install the Plugin)

```sh
dsh plugin --profile web add @001-orz/dsh-pet
```

Restart `dsh web` and the pet appears in the bottom-right corner — 51 transparent animations, ready to use out of the box, no generation pipeline required.

> 💡 Want to craft your own one-of-a-kind pet? Clone [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) and use the bundled asset pipeline (AI prompts → green-screen video → transparent animation, generated with Doubao) to generate one from scratch — fully reproducible.

## ✨ Features

- **A pure pet, nothing else**: no business features — no weather, no monitoring, no agent-state sensing; just a companion. Zero core changes, zero model cost (no LLM/API calls at runtime)
- **51 hand-drawn style transparent animations**: idle breathing, dozing off, playing with a Rubik's cube, humming, hair-raising, blowing bubbles, playing with a water gun, playing violin, the whale emerging, eating rice, looking in the mirror, three dances, writing code, seasonal actions (kite flying, snowman building, ice cream eating, fireworks…) — all seamlessly chained
- **Never-ending animation chain**: when each animation finishes, the next one is picked instantly by probability (30% idle / 10% turn / 40% action / 20% move)
- **Screen wandering**: walks toward its facing direction, checks the space ahead and never walks off screen
- **Click / drag**: click triggers a random reaction animation (happy / shy / tsundere); drag it anywhere
- **Left/right facing**: all animations are CSS-mirrored, the pet can face left or right
- **Ground alignment**: animations share a unified foot line, the pet always stands on the "ground"
- **Smooth transitions**: double-buffered video cross-fade, zero blank frames between switches
- **Accessibility-friendly**: supports `prefers-reduced-motion`

## ⚙️ Configuration

| Key | Description | Current status |
|---|---|---|
| `size` | Stage width (px); pet height ≈ width×9/16×74% | Default 462 (≈260px tall), **not yet delivered to the browser** (DSH client config pipeline limitation; falls back to code default) |
| `position` | Default corner position | Defaults to bottom-right, same as above (not yet delivered) |
| `fullRoot` | Original 2160×1215 master asset directory | Defaults to `$DSH_HOME/pet-assets`; takes effect after manually downloading the master assets |

> Note: the plugin works out of the box; all config above is optional. Browser-side configuration of `size`/`position` is planned.

## 🗑️ Uninstall

```sh
dsh plugin --profile web remove @001-orz/dsh-pet
```

## 🎬 Animation Previews

> The animations have transparent backgrounds; on GitHub they autoplay as videos (51 webm files in `dsh-pet/assets/thumb/`, click to download).

![Idle breathing](assets/thumb/东张西望.webm) ![Looking around](assets/thumb/原地漂浮踏步.webm) ![Napping](assets/thumb/原地小憩沉眠.webm) ![Playing with a Rubik's cube](assets/thumb/原地专心玩魔方.webm) ![Coding](assets/thumb/写代码.webm) ![Elegant maid dance](assets/thumb/优雅女仆舞.webm)

All 51 animations live in the repo under `dsh-pet/assets/thumb/`.

## 📚 A Complete Project (More Than a Plugin)

This is a **complete three-piece project** — anyone can clone the repo and generate their own desktop pet from scratch:

```
① Prompts (recipe)      →  ② Asset pipeline (engine)  →  ③ Plugin (product)
AI animation prompts        source video → transparent       the pet running in DSH
```

- Repository: [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)
- Design & implementation docs: [DESIGN.md](https://github.com/PC2005-cloud/dsh-pet/blob/main/DESIGN.md)

## 🔎 Discover More DSH Plugins

- Community plugin catalog: [awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)
- DSH official repository: [deepseek-ai/DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness)

## 📄 License

- Code: MIT
- Assets (animations/prompts): see the repository notes
