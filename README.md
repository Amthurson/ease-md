# Ease MD

中文 | English

Ease MD 是一个基于 Tauri 的桌面 Markdown 编辑器，目标是提供接近 Typora 的本地写作体验：轻量、直接、可控。  
Ease MD is a Tauri-based desktop Markdown editor focused on a Typora-like local writing workflow: lightweight, direct, and controllable.

## 下载 | Download

- Releases: `https://github.com/Amthurson/ease-md/releases`
- Latest release: `https://github.com/Amthurson/ease-md/releases/latest`
- Windows installers: open **Assets** on the latest release page and download `.msi` or `.exe`.

## 项目介绍（中文）

Ease MD 面向本地知识管理和技术写作场景，强调：

- 单窗口高效编辑（可视编辑 + 源码模式）
- 文件树/大纲联动
- 本地文件读写与最近文件管理
- 代码块语言切换与高亮
- 图片插入、截图粘贴、PicGo 上传工作流
- 可扩展的偏好设置（通用、编辑器、图像、Markdown、导出）

当前项目优先保障 Windows 体验，并保留跨平台（macOS/Linux）构建能力。

## Introduction (English)

Ease MD is designed for local note-taking and technical writing with a focus on:

- Single-window productivity (WYSIWYG editing + source mode)
- File tree and outline navigation
- Local file I/O with recent files support
- Code block language selection and syntax highlighting
- Image insertion, screenshot paste, and PicGo upload workflow
- Expandable preferences (General, Editor, Image, Markdown, Export)

The current focus is Windows quality, while keeping cross-platform build support (macOS/Linux).

## 技术栈 | Tech Stack

- `Tauri 2` (desktop shell + Rust backend commands)
- `Vite + TypeScript` (frontend)
- `TipTap` (editor core)
- `markdown-it` / `turndown`
- `highlight.js` / `lowlight`

## 本地开发 | Local Development

### Prerequisites

- Rust (stable)
- Node.js 20+
- Tauri CLI: `cargo install tauri-cli`

### Run

```bash
pnpm install
cargo tauri dev
```

如果你使用 npm：

```bash
npm install
cargo tauri dev
```

## 构建与发布 | Build & Release

```bash
pnpm build
cargo tauri build
```

GitHub Release 首发流程请参考：

- `docs/release-first-version.md`
- `docs/update-deployment.md`

## 文档 | Docs

- 产品计划：`docs/plan.md`
- 更新部署：`docs/update-deployment.md`
