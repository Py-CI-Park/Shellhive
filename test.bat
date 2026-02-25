@echo off
REM Shellhive Test Runner Script
REM This script runs all unit tests using Vitest

echo ========================================
echo    Shellhive - Test Runner
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules not found
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo [INFO] Running tests...
echo.

call npm run test

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Some tests failed
    pause
    exit /b 1
)

echo.
echo [SUCCESS] All tests passed
pause
