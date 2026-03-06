@echo off
color 0A

echo.
echo ============================================================
echo          AutoDoc Flow Installer v1.2.0
echo ============================================================
echo.

set NODE_VERSION=20.18.1
set NODE_INSTALLER=node-v%NODE_VERSION%-x64.msi
set NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/%NODE_INSTALLER%
set INSTALL_DIR=%~dp0

echo [1/4] Checking Node.js...
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Node.js found
    node --version
    echo.
    goto :install_deps
)

echo [!] Node.js not found
echo.

if exist "%INSTALL_DIR%%NODE_INSTALLER%" (
    echo [OK] Found installer: %NODE_INSTALLER%
    goto :install_node
)

echo [Download] Downloading Node.js v%NODE_VERSION%...
echo URL: %NODE_URL%
echo.
echo Choose download method:
echo   1. Auto download (recommended)
echo   2. Manual download
echo   3. Skip (if Node.js already installed)
echo.
choice /C 123 /N /M "Select option (1/2/3): "

if errorlevel 3 goto :install_deps
if errorlevel 2 goto :manual_download
if errorlevel 1 goto :auto_download

:auto_download
echo.
echo [Downloading] Using PowerShell...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%INSTALL_DIR%%NODE_INSTALLER%' -UseBasicParsing}"

if %errorlevel% neq 0 (
    echo [Error] Download failed
    goto :manual_download
)

echo [OK] Download complete
goto :install_node

:manual_download
echo.
echo ============================================================
echo   Manual Download Instructions
echo ============================================================
echo.
echo 1. Visit: https://nodejs.org/
echo 2. Download Node.js v%NODE_VERSION% LTS (Windows 64-bit)
