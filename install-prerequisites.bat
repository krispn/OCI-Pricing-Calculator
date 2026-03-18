@echo off
echo ============================================
echo  OCI Calculator - Install Prerequisites
echo ============================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo This script needs to run as Administrator.
    echo Right-click and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

:: Check if winget is available
where winget >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: winget is not available on this system.
    echo winget comes pre-installed on Windows 10 1709+ and Windows 11.
    echo.
    echo Please install App Installer from the Microsoft Store:
    echo   https://apps.microsoft.com/detail/9nblggh4nns1
    echo.
    pause
    exit /b 1
)

echo Checking Python...
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo   Python is already installed:
    python --version
) else (
    echo   Installing Python...
    winget install --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo   ERROR: Failed to install Python.
        pause
        exit /b 1
    )
    echo   Python installed successfully.
)

echo.
echo Checking curl...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    echo   curl is already installed:
    curl --version 2>&1 | findstr /r "^curl"
) else (
    echo   Installing curl...
    winget install --id cURL.cURL --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo   ERROR: Failed to install curl.
        pause
        exit /b 1
    )
    echo   curl installed successfully.
)

echo.
echo ============================================
echo  All prerequisites installed!
echo.
echo  You may need to close and reopen your
echo  terminal for PATH changes to take effect.
echo.
echo  Next steps:
echo    1. Double-click start.bat
echo    2. Open http://localhost:8080
echo ============================================
echo.
pause
