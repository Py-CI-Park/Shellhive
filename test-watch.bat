@echo off
REM Shellhive Test Watch Mode Script
REM This script runs tests in watch mode for development

echo ========================================
echo    Shellhive - Test Watch Mode
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules not found
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo [INFO] Starting test watch mode...
echo [INFO] Tests will re-run automatically when files change
echo [INFO] Press 'q' to quit
echo.

call npm run test:watch

pause
