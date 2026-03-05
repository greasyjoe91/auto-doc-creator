@echo off
chcp 65001 >nul
echo ========================================
echo   AutoDoc Flow 网页版启动器
echo ========================================
echo.

REM 检查Node.js是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] 检查后端依赖...
cd server
if not exist node_modules (
    echo [安装] 正在安装后端依赖，请稍候...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败
        pause
        exit /b 1
    )
)
cd ..

echo [2/3] 启动后端服务...
start /B cmd /c "cd server && npm start > ../server.log 2>&1"

REM 等待后端启动
echo [等待] 后端服务启动中...
timeout /t 3 /nobreak >nul

echo [3/3] 打开浏览器...
start http://localhost:3002

echo.
echo ========================================
echo   服务已启动！
echo   访问地址: http://localhost:3002
echo   按任意键关闭此窗口（服务将继续运行）
echo ========================================
pause >nul
