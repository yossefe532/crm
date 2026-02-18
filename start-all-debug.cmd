@echo off
setlocal
cd /d "%~dp0"
echo Running (debug): "%~dp0start-all.ps1"
echo Logs: "%~dp0start-all.log"
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start-all.ps1"
echo Done. Press any key to close.
pause
endlocal
