# AutoDoc Flow

基于 **Gemini AI** 的智能软件文档生成工具。上传 SOP（标准操作流程）文件和软件录屏，一键生成规范化的技术文档。

## ✨ 功能特性

### 📄 三类文档一站生成
- **软件参数规格书** — 深度分析 SOP 文件，输出符合国标的技术规格说明
- **软件产品介绍** — 面向市场的产品概述，自动配图
- **软件用户操作手册** — 面向终端用户的分步操作指南，支持截图插入

### 📂 多格式文件输入
- **SOP 文件**：支持 `.docx`、`.xlsx`、`.pdf`、`.txt`、`.md` 等多格式，支持多文件同时上传
- **参考模版**：可为每类文档上传参考模版，AI 将严格遵循模版结构生成
- **软件录屏**：上传 `.mp4` / `.webm` 视频，自动抽帧提取关键截图，AI 智能匹配插入文档

### 📤 多格式导出
- **Word (.docx)** — 可直接编辑的 Word 文档，支持图片嵌入
- **HTML** — 带完整样式的网页文件
- **剪贴板复制** — 一键复制纯文本 / 富文本内容

### 🎨 界面
- 明暗主题自由切换
- 响应式布局，适配不同屏幕尺寸

## 🏗️ 技术架构

```
┌──────────────────────────────────────┐
│           Electron 桌面壳            │
│  ┌────────────────────────────────┐  │
│  │   React + TypeScript 前端      │  │
│  │   Vite 构建 · Tailwind CSS    │  │
│  └──────────┬─────────────────────┘  │
│             │ HTTP (localhost:3001)   │
│  ┌──────────▼─────────────────────┐  │
│  │   Express 后端代理             │  │
│  │   API Key 安全隔离             │  │
│  └──────────┬─────────────────────┘  │
└─────────────┼────────────────────────┘
              │ HTTPS
     ┌────────▼────────┐
     │  Google Gemini   │
     │  API             │
     └─────────────────┘
```

| 层级 | 技术栈 |
|------|--------|
| 前端 | React 19 + TypeScript + Tailwind CSS v4 |
| 构建 | Vite 6 |
| 后端 | Express + esbuild（编译为独立 CJS） |
| AI   | Google Gemini (`gemini-3-flash-preview`) |
| 桌面 | Electron 40 + electron-builder |
| 文档解析 | mammoth (docx)、xlsx (Excel)、marked (Markdown) |
| 文档导出 | docx.js、file-saver、DOMPurify |

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Gemini API Key**（[获取地址](https://aistudio.google.com/apikey)）

### 1. 安装依赖

```bash
npm install
cd server && npm install && cd ..
```

### 2. 配置环境变量

在 `server/` 目录下创建 `.env` 文件：

```bash
# server/.env
GEMINI_API_KEY=your_api_key_here
PORT=3001
```

### 3. 开发模式运行

```bash
# 仅前端（浏览器访问 http://localhost:3000）
npm run dev

# 仅后端
npm run server:dev

# Electron 开发模式（前端 + 后端 + 桌面窗口）
npm run electron:dev
```

### 4. 生产构建

```bash
# 构建前端
npm run build

# 构建后端（编译为独立 CJS 文件）
npm run server:build
```

### 5. 桌面应用打包

```bash
# macOS (arm64)
npm run electron:build:mac

# Windows (x64)
npm run electron:build:win
```

打包产物位于 `dist_electron/` 目录：
- **Mac**: `dist_electron/mac-arm64/AutoDoc Flow.app`
- **Windows**: `dist_electron/win-unpacked/AutoDoc Flow.exe`

## 📁 项目结构

```
auto-doc-creator/
├── App.tsx                 # 主应用组件（文件管理、文档生成、UI）
├── index.html              # HTML 入口
├── index.tsx               # React 入口
├── index.css               # Tailwind CSS 入口
├── types.ts                # TypeScript 类型定义
├── main.cjs                # Electron 主进程
├── vite.config.ts          # Vite 构建配置
├── components/
│   ├── Button.tsx          # 通用按钮组件
│   └── StatusBadge.tsx     # 状态标识组件
├── services/
│   ├── geminiService.ts    # Gemini API 调用与 Prompt 构建
│   ├── fileParser.ts       # 多格式文件解析（docx/xlsx/pdf/txt/video）
│   └── wordExporter.ts     # Word 文档导出
└── server/
    ├── index.ts            # Express 后端（API 代理 + 静态文件伺服）
    ├── .env                # 环境变量（API Key）
    └── package.json        # 后端依赖
```

## 🔒 安全设计

- **API Key 隔离**：Gemini API Key 仅存储在后端 `.env` 中，前端通过 Express 代理调用，永远不会暴露在客户端代码中
- **输入校验**：使用 DOMPurify 对 AI 生成的 HTML 内容进行 XSS 净化
- **CORS 控制**：后端仅允许本地来源的请求

## 📝 使用流程

1. **上传 SOP 文件** — 在左侧面板上传一个或多个 SOP / 软件脚本文件
2. **（可选）上传参考模版** — 为需要的文档类型上传 Word/文本模版
3. **（可选）上传软件录屏** — 上传 MP4/WebM 视频，系统自动截取关键帧
4. **选择文档类型** — 在顶部 Tab 切换到需要生成的文档类型
5. **点击"开始生成"** — AI 分析所有输入材料后生成文档
6. **导出** — 选择 Word / HTML / 复制 等方式导出

## 📜 License

MIT
