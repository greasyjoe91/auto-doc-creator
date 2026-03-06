@echo off
echo ========================================
echo   AutoDoc Flow - Stop Service
echo ========================================
echo.

echo [Stopping] Finding and stopping backend service...

REM Find and stop process on port 3005
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3005 ^| findstr LISTENING') do (
    echo [Found] Process ID: %%a
    taskkill /F /PID %%a >nul 2>nul
    if %errorlevel% equ 0 (
        echo [Success] Stopped process %%a
    )
)

echo.
echo ========================================
echo   Service Stopped
echo ========================================
pause
