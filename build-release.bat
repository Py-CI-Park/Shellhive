@echo off
REM Shellhive Release Build Script
REM This script builds an optimized production-ready executable

echo ========================================
echo    Shellhive - Release Build
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

echo [INFO] Building Shellhive release version...
echo [INFO] This may take several minutes...
echo.

REM Build release version
call npm run tauri build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo [SUCCESS] Build completed!
echo.
echo Executable location:
echo   src-tauri\target\release\shellhive.exe
echo.
echo You can now run the app using:
echo   run-release.bat
echo ========================================

pause
