@echo off
REM Shellhive Test Coverage Script
REM This script runs tests and generates coverage report

echo ========================================
echo    Shellhive - Test Coverage
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] node_modules not found
    echo Please run setup.bat first
    pause
    exit /b 1
)

echo [INFO] Running tests with coverage...
echo.

call npm run test:coverage

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Some tests failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo [SUCCESS] Coverage report generated
echo.
echo Report location:
echo   coverage/index.html
echo.
echo Open in browser to view detailed report
echo ========================================

REM Ask if user wants to open coverage report
echo.
set /p OPEN_REPORT="Open coverage report in browser? (Y/N): "
if /i "%OPEN_REPORT%"=="Y" (
    start "" "coverage\index.html"
)

pause
