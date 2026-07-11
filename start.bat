@echo off
cd /d "%~dp0"
echo Stopping anything on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
echo Starting dev server...
where node >nul 2>&1 && (npm run dev) || (python server.py)
pause
