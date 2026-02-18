@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"
if %ERRORLEVEL% NEQ 0 (
  echo stop-all failed. Press any key to exit.
  pause
)
endlocal
