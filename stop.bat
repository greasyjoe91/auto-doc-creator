@echo off
chcp 65001 >nul
echo ========================================
echo   AutoDoc Flow 服务停止器
echo ========================================
echo.

echo [停止] 正在查找并停止后端服务...

REM 查找并停止占用3002端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo [发现] 进程ID: %%a
    taskkill /F /PID %%a >nul 2>nul
    if %errorlevel% equ 0 (
        echo [成功] 已停止进程 %%a
    )
)

echo.
echo ========================================
echo   服务已停止
echo ========================================
pause
