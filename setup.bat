@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js was not found on this computer. Trying to install it automatically...
    echo.

    where winget >nul 2>nul
    if !errorlevel! neq 0 (
        echo Could not find winget ^(Windows Package Manager^) to install it automatically.
        echo.
        echo Please install Node.js yourself:
        echo   1. Go to https://nodejs.org/
        echo   2. Download and run the "LTS" installer, using all the default options.
        echo   3. Come back and double-click setup.bat again.
        pause
        exit /b 1
    )

    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if !errorlevel! neq 0 (
        echo.
        echo The automatic install did not finish successfully.
        echo Please install Node.js yourself from https://nodejs.org/ ^(the "LTS" button^), then double-click setup.bat again.
        pause
        exit /b 1
    )

    rem Node.js was just installed - make it usable in this window without needing a restart.
    set "PATH=%ProgramFiles%\nodejs;%PATH%"

    where node >nul 2>nul
    if !errorlevel! neq 0 (
        echo.
        echo Node.js was installed, but this window can't see it yet.
        echo Please close this window and double-click setup.bat again to finish.
        pause
        exit /b 0
    )

    echo.
    echo Node.js installed successfully.
    echo.
)

echo Installing park-bot...
call npm install
if errorlevel 1 goto :error

call npx playwright install chromium
if errorlevel 1 goto :error

echo.
echo Setup complete!
echo Next: open config.json in Notepad, set your park name and dates, then double-click start.bat
pause
goto :eof

:error
echo.
echo Something went wrong during setup. Scroll up to see the error message.
pause
