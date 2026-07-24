@echo off
cd /d "%~dp0"

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Git isn't installed, so this folder can't be auto-updated.
    echo Please install git, or just download the latest copy from GitHub and redo setup.
    pause
    exit /b 1
)

if not exist ".git" (
    echo This folder wasn't set up with git, so it can't be auto-updated.
    echo Please download the latest copy from GitHub and redo setup.
    pause
    exit /b 1
)

rem config.json holds your personal watch settings - keep it safe across the update
rem even if the update itself changed the example/default config.json in the repo.
copy /y config.json config.json.mine >nul

echo Checking for updates...
call git fetch origin
if errorlevel 1 goto :error

call git reset --hard origin/main
if errorlevel 1 goto :error

move /y config.json.mine config.json >nul

echo.
echo Updating dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo Update complete! Your config.json was left untouched.
echo If the README mentions new config options you want to use, add them yourself.
pause
goto :eof

:error
echo.
echo Something went wrong during the update. Scroll up to see the error message.
pause
