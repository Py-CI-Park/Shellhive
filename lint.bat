@echo off
REM Shellhive ESLint Check Script
REM This script checks code style using ESLint

echo ========================================
echo    Shellhive - Lint Check
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules not found
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo [INFO] Running ESLint...
echo.

call npm run lint

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Lint issues found
    echo Run 'lint-fix.bat' to auto-fix issues
    pause
    exit /b 1
)

echo.
echo [SUCCESS] No lint issues found
pause
