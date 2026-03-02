@echo off
setlocal EnableExtensions
REM Shellhive Release Mode Launcher
REM This script runs the pre-built release executable

REM Always run from repository root (directory of this script)
cd /d "%~dp0"

echo ========================================
echo    Shellhive - Release Mode
echo ========================================
echo.

set "RELEASE_EXE=src-tauri\target\release\shellhive.exe"

REM Check if release executable exists
if not exist "%RELEASE_EXE%" (
    echo [ERROR] Release executable not found at: %RELEASE_EXE%
    echo.
    echo Please build the release version first using:
    echo   build-release.bat
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting Shellhive...
echo.

REM Run the release executable
start "" "%RELEASE_EXE%"

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Shellhive
    pause
    exit /b 1
)

echo [INFO] Shellhive started successfully
timeout /t 2 /nobreak >nul
endlocal
