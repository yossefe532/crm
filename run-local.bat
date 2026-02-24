@echo off
echo Starting CRM Doctor V2 in Local Network Mode...
echo.

REM Get Local IP Address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do set IP=%%a
set IP=%IP:~1%
echo Your Local IP is: %IP%
echo.
echo Access the system from other devices at: http://%IP%:3000
echo.

REM Start Backend
start "CRM Backend" cmd /k "npm run dev"

REM Start Frontend
cd web
start "CRM Frontend" cmd /k "npm run dev"

echo Servers are starting...
echo Do not close this window or the opened terminal windows.
pause
