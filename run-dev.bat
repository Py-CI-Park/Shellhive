@echo off
REM Shellhive Development Mode Launcher
REM This script runs the application in development mode with hot-reload

echo ========================================
echo    Shellhive - Development Mode
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Cargo is installed
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Cargo is not installed or not in PATH
    echo Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)

echo [INFO] All dependencies are available
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install npm dependencies
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting Shellhive in development mode...
echo [INFO] The app will open automatically with DevTools enabled
echo [INFO] Press Ctrl+C to stop the development server
echo.

REM Run Tauri dev mode
call npm run tauri dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start development mode
    pause
    exit /b 1
)

pause
