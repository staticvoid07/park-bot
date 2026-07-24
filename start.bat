@echo off
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js isn't installed yet. Please run setup.bat first.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo It looks like setup hasn't been run yet. Please run setup.bat first.
    pause
    exit /b 1
)

node src\index.js
echo.
echo The bot stopped. Scroll up to see why.
pause
