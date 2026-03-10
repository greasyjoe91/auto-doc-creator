AutoDoc Flow 网页版部署包
==========================

部署包内容：
1. dist/          - 前端构建产物
2. server/        - 后端服务代码
3. start.bat      - Windows一键启动脚本
4. start.sh       - macOS/Linux一键启动脚本
5. stop.bat       - Windows停止服务脚本
6. DEPLOY.md      - 详细部署文档

部署步骤：
1. 将整个 deploy-package 文件夹拷贝到目标电脑
2. 确保目标电脑已安装 Node.js 18+ 
3. Windows用户：双击 start.bat
   macOS/Linux用户：执行 chmod +x start.sh && ./start.sh
4. 浏览器自动打开 http://localhost:3002

注意事项：
- 首次启动会自动安装依赖，需要网络连接
- 需要配置 server/.env 文件中的 GEMINI_API_KEY
- 默认端口 3002，如需修改请编辑 server/.env

技术支持：
查看 DEPLOY.md 获取详细部署指南
