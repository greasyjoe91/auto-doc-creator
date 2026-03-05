# AutoDoc Flow 网页版部署指南

## 系统要求

- Node.js 18.0 或更高版本
- 支持的操作系统：Windows、macOS、Linux

## 快速启动

### Windows 用户

双击运行 `start.bat` 文件，系统会自动：
1. 检查并安装依赖
2. 启动后端服务
3. 打开浏览器访问应用

### macOS/Linux 用户

在终端中执行：
```bash
chmod +x start.sh
./start.sh
```

## 手动部署步骤

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install
cd ..
```

### 2. 配置环境变量

编辑 `server/.env` 文件，配置以下参数：

```env
# Gemini API Key（必须设置）
GEMINI_API_KEY=your_encrypted_api_key

# 加密密钥
ENCRYPTION_KEY=change-this-to-random-string-for-security

# 服务器配置
PORT=3002
CORS_ORIGIN=http://localhost:3000
```

### 3. 启动服务

```bash
cd server
npm start
```

服务启动后，访问 http://localhost:3002

## 生产环境部署

### 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd server
pm2 start index.ts --name autodoc-flow

# 查看状态
pm2 status

# 查看日志
pm2 logs autodoc-flow

# 停止服务
pm2 stop autodoc-flow

# 重启服务
pm2 restart autodoc-flow
```

### 使用 Docker

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制后端代码
COPY server ./server
COPY dist ./dist

# 安装依赖
WORKDIR /app/server
RUN npm install --production

# 暴露端口
EXPOSE 3002

# 启动服务
CMD ["npm", "start"]
```

构建并运行：

```bash
docker build -t autodoc-flow .
docker run -p 3002:3002 -d autodoc-flow
```

## 配置说明

### 端口配置

默认端口为 3002，可通过修改 `server/.env` 中的 `PORT` 变量更改。

### API Key 配置

1. 获取 Gemini API Key：https://aistudio.google.com/apikey
2. 使用加密工具加密 API Key：
   ```bash
   cd server
   node encrypt-key.ts your_api_key
   ```
3. 将加密后的密钥填入 `.env` 文件

### CORS 配置

如果需要从其他域名访问，修改 `server/.env` 中的 `CORS_ORIGIN`。

## 故障排查

### 端口被占用

如果 3002 端口被占用，修改 `server/.env` 中的 `PORT` 值。

### API Key 错误

检查 `.env` 文件中的 `GEMINI_API_KEY` 是否正确配置。

### 依赖安装失败

尝试清除缓存后重新安装：
```bash
cd server
rm -rf node_modules package-lock.json
npm install
```

## 技术支持

如有问题，请访问项目仓库提交 Issue。

## 版本信息

- 当前版本：v1.1.0
- 最后更新：2026-03-05
