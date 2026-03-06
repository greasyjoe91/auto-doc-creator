@echo off
title AutoDoc Flow Installer
color 0A

echo.
echo ============================================================
echo          AutoDoc Flow Installer v1.2.0
echo ============================================================
echo.

set INSTALL_DIR=%~dp0

echo [1/3] Checking Node.js...
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Node.js found
    node --version
    echo.
    goto :install_deps
)

echo [ERROR] Node.js not found
echo.
echo Please install Node.js first:
echo 1. Run node-v20.18.1-x64.msi in this folder
echo 2. Or download from https://nodejs.org/
echo 3. Restart this script after installation
echo.
pause
exit /b 1

:install_deps
echo [2/3] Installing dependencies...
echo.

if not exist "%INSTALL_DIR%server" (
    echo [ERROR] server directory not found
    pause
    exit /b 1
)

if not exist "%INSTALL_DIR%dist" (
    echo [ERROR] dist directory not found
    pause
    exit /b 1
)

echo [Installing] Backend dependencies...
cd "%INSTALL_DIR%server"
call npm install --production

if %errorlevel% neq 0 (
    echo [ERROR] Installation failed
    pause
    exit /b 1
)

echo [OK] Dependencies installed
cd "%INSTALL_DIR%"

:start_service
echo.
echo [3/3] Starting service...
echo.

if not exist "%INSTALL_DIR%server\.env" (
    echo [WARNING] .env file not found
    echo Please configure GEMINI_API_KEY in server\.env
    echo.
)

echo [Starting] AutoDoc Flow...
start /B cmd /c "cd /d %INSTALL_DIR%server && npm start > ..\server.log 2>&1"

timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo                    Deployment Complete!
echo ============================================================
echo.
echo [OK] Service started
echo [OK] Access: http://localhost:3005
echo.
echo Tips:
echo   - Configure GEMINI_API_KEY in server\.env
echo   - View logs: server.log
echo   - Stop service: run stop.bat
echo.

start http://localhost:3005

echo Press any key to close (service will continue)...
pause >nul
