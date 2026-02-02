@echo off
REM Shellhive ESLint Auto-Fix Script
REM This script automatically fixes code style issues

echo ========================================
echo    Shellhive - Lint Auto-Fix
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules not found
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo [INFO] Running ESLint with auto-fix...
echo.

call npm run lint:fix

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Some issues could not be auto-fixed
    echo Please review and fix them manually
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Auto-fix completed
pause
