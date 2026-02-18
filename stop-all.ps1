$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidsFile = Join-Path $root ".start-all.pids"

if (-not (Test-Path $pidsFile)) {
  Write-Host ("No pid file found: " + $pidsFile) -ForegroundColor Yellow
  exit 0
}

$backendPid = $null
$frontendPid = $null

foreach ($line in Get-Content $pidsFile -ErrorAction SilentlyContinue) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line.Split("=", 2)
  if ($parts.Count -ne 2) { continue }
  $key = $parts[0].Trim().ToLower()
  $val = $parts[1].Trim()
  if ($key -eq "backend") { $backendPid = $val }
  if ($key -eq "frontend") { $frontendPid = $val }
}

if ($backendPid) {
  Write-Host ("Stopping backend PID " + $backendPid + " ...") -ForegroundColor Cyan
  try { Stop-Process -Id ([int]$backendPid) -Force -ErrorAction SilentlyContinue } catch { }
}

if ($frontendPid) {
  Write-Host ("Stopping frontend PID " + $frontendPid + " ...") -ForegroundColor Cyan
  try { Stop-Process -Id ([int]$frontendPid) -Force -ErrorAction SilentlyContinue } catch { }
}

try { Remove-Item -Path $pidsFile -Force -ErrorAction SilentlyContinue } catch { }
Write-Host "Done." -ForegroundColor Green

