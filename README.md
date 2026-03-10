# AutoDoc Flow

SOP文档自动化生成工具 - 基于AI的智能文档生成系统

## 项目简介

AutoDoc Flow 是一款基于 Gemini AI 的智能文档生成工具，可以自动将 SOP 文档、视频、参数说明书等多种格式的输入材料，智能生成标准化的技术文档。

## 功能特性

- 📄 **多格式输入支持**：PDF、Word、Excel、TXT、视频（.mp4）
- 🤖 **AI智能生成**：基于 Gemini API 自动生成专业文档
- 📝 **三种文档类型**：
  - 软件参数规格书
  - 软件产品介绍
  - 软件用户操作手册
- 🎨 **格式化输出**：自动生成符合规范的 Word 文档
- 🖼️ **图片处理**：自动提取和插入相关图片
- 🌐 **双模式部署**：支持桌面应用和Web服务

## 技术栈

- **前端**：React 18 + TypeScript + Vite + TailwindCSS
- **后端**：Express + Node.js
- **AI服务**：Google Gemini API
- **文档处理**：mammoth、docx、marked
- **桌面应用**：Electron

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/greasyjoe91/auto-doc-creator.git
cd auto-doc-creator

# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
```

### 配置

1. 复制环境变量配置文件：
```bash
cd server
cp .env.example .env
```

2. 编辑 `.env` 文件，配置 Gemini API Key：
```env
GEMINI_API_KEY=your_api_key_here
PORT=3005
```

### 运行

#### 开发模式

```bash
# 启动后端服务
cd server
npm run dev

# 启动前端（新终端）
cd ..
npm run dev
```

#### 桌面应用

```bash
npm run electron:dev
```

## 部署

### Web版部署

使用 `deploy-with-env` 部署包（包含完整环境）：

1. 将 `deploy-with-env` 文件夹复制到目标服务器
2. 配置 `server/.env` 文件
3. 运行 `deploy.bat`（Windows）启动服务
4. 访问 `http://localhost:3005`

详细说明见 deploy-with-env/使用说明.md

### 桌面应用打包

```bash
npm run electron:build
```

## 使用说明

1. **上传SOP文档**：支持多个文件同时上传
2. **上传参数说明书**（可选）：提供更详细的技术参数
3. **上传参考模板**（可选）：自定义文档格式
4. **上传视频**（可选）：自动提取关键帧作为配图
5. **选择文档类型**：规格书、产品介绍或操作手册
6. **生成文档**：AI自动生成并格式化
7. **下载Word文档**：获取标准化的.docx文件

## 项目结构

```
auto-doc-creator/
├── src/                    # 前端源码
│   ├── components/         # React组件
│   ├── services/          # API服务
│   └── types.ts           # 类型定义
├── server/                # 后端服务
│   ├── index.ts          # 服务入口
│   ├── crypto.ts         # 加密工具
│   └── .env              # 环境配置
├── services/             # 共享服务
│   ├── geminiService.ts  # Gemini API
│   ├── wordExporter.ts   # Word导出
│   └── fileParser.ts     # 文件解析
├── deploy-with-env/      # 完整部署包
├── deploy-package/       # 简化部署包
└── electron/             # Electron配置
```

## 配置说明

### Gemini API Key

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建 API Key
3. 配置到 `server/.env` 文件

### 端口配置

默认端口：3005，可在 `server/.env` 中修改：
```env
PORT=3005
```

## 常见问题

### 1. 端口被占用

修改 `server/.env` 中的 `PORT` 配置

### 2. API调用失败

检查 `GEMINI_API_KEY` 是否正确配置

### 3. 局域网访问失败

确保使用最新版本（已修复API地址硬编码问题）

## 更新日志

### v1.2.0 (2024-03-10)
- 修复前端API地址硬编码问题，支持局域网访问
- 修复部署包端口配置
- 修复批处理文件编码问题
- 优化依赖配置

### v1.0.0
- 初始版本发布
- 支持三种文档类型生成
- Electron桌面应用

## 许可证

MIT License

## 联系方式

- GitHub: [greasyjoe91/auto-doc-creator](https://github.com/greasyjoe91/auto-doc-creator)
