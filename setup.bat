@echo off
cd /d "%~dp0"

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
