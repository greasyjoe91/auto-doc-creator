#!/bin/bash

echo "========================================"
echo "  AutoDoc Flow 网页版启动器"
echo "========================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[1/3] 检查后端依赖..."
cd server
if [ ! -d "node_modules" ]; then
    echo "[安装] 正在安装后端依赖，请稍候..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 后端依赖安装失败"
        exit 1
    fi
fi
cd ..

echo "[2/3] 启动后端服务..."
cd server && npm start > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

# 等待后端启动
echo "[等待] 后端服务启动中..."
sleep 3

echo "[3/3] 打开浏览器..."
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3002
elif command -v open &> /dev/null; then
    open http://localhost:3002
fi

echo ""
echo "========================================"
echo "  服务已启动！"
echo "  访问地址: http://localhost:3002"
echo "  后端进程ID: $SERVER_PID"
echo "  按 Ctrl+C 停止服务"
echo "========================================"

# 等待用户中断
wait $SERVER_PID
