@echo off
setlocal
cd /d "%~dp0"
echo Running: "%~dp0start-all.ps1"
echo Logs: "%~dp0start-all.log"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
set EXIT_CODE=%ERRORLEVEL%
if %EXIT_CODE% NEQ 0 (
  echo start-all failed with exit code %EXIT_CODE%.
  if exist "%~dp0start-all.log" (
    echo -------- start-all.log (last 60 lines) --------
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Tail 60 '%~dp0start-all.log'"
    echo ----------------------------------------------
  )
  pause
) else (
  echo start-all finished successfully. Backend and Frontend should be running in separate windows.
  if exist "%~dp0start-all.log" (
    echo -------- start-all.log (last 20 lines) --------
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Tail 20 '%~dp0start-all.log'"
    echo ----------------------------------------------
  )
  pause
)
endlocal
