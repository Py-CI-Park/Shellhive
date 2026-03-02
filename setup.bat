@echo off
REM Shellhive Initial Setup Script
REM This script installs all dependencies and verifies the environment

echo ========================================
echo    Shellhive - Initial Setup
echo ========================================
echo.

REM Check if Node.js is installed
echo [CHECK] Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo [OK] Node.js %%i

REM Check if npm is installed
echo [CHECK] npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do echo [OK] npm %%i

REM Check if Cargo is installed
echo [CHECK] Cargo (Rust)...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Cargo is not installed or not in PATH
    echo Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('cargo --version') do echo [OK] %%i

echo.
echo [INFO] All prerequisites are available
echo.

REM Install npm dependencies
echo [STEP 1/3] Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm dependencies
    pause
    exit /b 1
)
echo [OK] npm dependencies installed
echo.

REM Check Rust dependencies
echo [STEP 2/3] Checking Rust dependencies...
cd src-tauri
call cargo check
if %errorlevel% neq 0 (
    echo [ERROR] Rust dependency check failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Rust dependencies verified
echo.

REM Run initial lint check
echo [STEP 3/3] Running lint check...
call npm run lint
if %errorlevel% neq 0 (
    echo [WARNING] Lint issues found. Run 'lint-fix.bat' to auto-fix.
) else (
    echo [OK] No lint issues found
)
echo.

echo ========================================
echo [SUCCESS] Setup completed!
echo.
echo Available commands:
echo   run-dev.bat       - Start development mode
echo   build-release.bat - Build release version
echo   run-release.bat   - Run release version
echo   lint.bat          - Check code style
echo   lint-fix.bat      - Fix code style issues
echo   test.bat          - Run tests
echo   test-coverage.bat - Run tests with coverage
echo ========================================

pause
