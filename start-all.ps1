$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$webDir = Join-Path $root "web"
$logFile = Join-Path $root "start-all.log"
$pidsFile = Join-Path $root ".start-all.pids"

function Log {
  param([string]$Message)
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  try {
    Add-Content -Path $logFile -Value ($ts + " " + $Message) -Encoding UTF8
  } catch {
  }
}

Log "---- start-all ----"
Log ("ScriptPath=" + $MyInvocation.MyCommand.Path)
Log ("Root=" + $root)
Log ("WebDir=" + $webDir)

function Ensure-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "Missing required command: $Name" -ForegroundColor Red
    Log ("MissingCommand=" + $Name)
    exit 1
  }
}

function Resolve-Command {
  param([string]$Primary, [string]$Fallback)
  $cmd = Get-Command $Primary -ErrorAction SilentlyContinue
  if ($cmd) { return $Primary }
  return $Fallback
}

function Load-DotEnv {
  param([string]$FilePath)
  if (-not (Test-Path $FilePath)) { return }
  foreach ($line in Get-Content $FilePath -ErrorAction SilentlyContinue) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $trimmed = $line.Trim()
    if ($trimmed.StartsWith("#")) { continue }
    if ($trimmed -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      $key = $matches[1]
      $val = $matches[2].Trim()
      if ($val.StartsWith('"') -and $val.EndsWith('"') -and $val.Length -ge 2) {
        $val = $val.Substring(1, $val.Length - 2)
      }
      if (-not (Test-Path "Env:$key")) {
        Set-Item -Path "Env:$key" -Value $val
      }
    }
  }
}

function New-RandomSecret {
  param([int]$Bytes = 48)
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  [Convert]::ToBase64String($buffer)
}

function Encode-PowerShellCommand {
  param([string]$Script)
  $bytes = [System.Text.Encoding]::Unicode.GetBytes($Script)
  [Convert]::ToBase64String($bytes)
}

function Test-PortInUse {
  param([int]$Port)
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return ($conn | Measure-Object).Count -gt 0
  } catch {
    try {
      return (Test-NetConnection -ComputerName "localhost" -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
    } catch {
      return $false
    }
  }
}

function Find-FreePort {
  param([int]$StartPort, [int]$MaxTries = 50)
  $port = $StartPort
  for ($i = 0; $i -lt $MaxTries; $i++) {
    if (-not (Test-PortInUse -Port $port)) { return $port }
    $port++
  }
  return $null
}

function Get-ListeningPid {
  param([int]$Port)
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($conn -and $conn.OwningProcess) { return [int]$conn.OwningProcess }
    return $null
  } catch {
    return $null
  }
}

function Test-BackendHealthy {
  param([int]$Port)
  try {
    $res = Invoke-RestMethod -Uri ("http://localhost:" + $Port + "/api/health") -Method Get -TimeoutSec 2
    return ($res -and $res.ok -eq $true)
  } catch {
    return $false
  }
}

try {
  Ensure-Command "node"
  $npm = Resolve-Command -Primary "npm.cmd" -Fallback "npm"
  $npx = Resolve-Command -Primary "npx.cmd" -Fallback "npx"
  Ensure-Command $npm
  Ensure-Command $npx

  Load-DotEnv (Join-Path $root ".env")

  $requestedBackendPort = 4000
  $requestedFrontendPort = 3000

  $backendMode = "spawn"
  $backendPort = $requestedBackendPort
  if (Test-PortInUse -Port $requestedBackendPort) {
    if (Test-BackendHealthy -Port $requestedBackendPort) {
      $backendMode = "reuse"
      $backendPort = $requestedBackendPort
      Log ("BackendReusePort=" + $backendPort)
    } else {
      $freeBackendPort = Find-FreePort -StartPort $requestedBackendPort
      if (-not $freeBackendPort) {
        Write-Host "No free backend port found starting from $requestedBackendPort." -ForegroundColor Red
        Log "NoFreeBackendPort=true"
        exit 3
      }
      $backendPort = $freeBackendPort
      Log ("BackendPortChangedFrom=" + $requestedBackendPort + " To=" + $backendPort)
    }
  }

  $frontendPort = $requestedFrontendPort
  if (Test-PortInUse -Port $requestedFrontendPort) {
    $freeFrontendPort = Find-FreePort -StartPort $requestedFrontendPort
    if (-not $freeFrontendPort) {
      Write-Host "No free frontend port found starting from $requestedFrontendPort." -ForegroundColor Red
      Log "NoFreeFrontendPort=true"
      exit 2
    }
    $frontendPort = $freeFrontendPort
    Log ("FrontendPortChangedFrom=" + $requestedFrontendPort + " To=" + $frontendPort)
  }

  $env:PORT = "$backendPort"
  if (-not $env:DATABASE_URL) {
    Write-Host "DATABASE_URL is missing in .env (system folder)." -ForegroundColor Red
    Write-Host "Add DATABASE_URL then re-run start-all." -ForegroundColor Yellow
    Log "MissingEnv=DATABASE_URL"
    exit 1
  }
  if (-not $env:JWT_SECRET -or $env:JWT_SECRET.Trim().Length -lt 16) {
    $env:JWT_SECRET = New-RandomSecret
    Write-Host "Generated a temporary JWT_SECRET for this session." -ForegroundColor Yellow
    Log "GeneratedTempJwtSecret=true"
  }

  Log ("BackendMode=" + $backendMode)
  Log ("BackendPort=" + $backendPort)
  Log ("FrontendPort=" + $frontendPort)

  $dbOk = $false
  try {
    $dbOk = (Test-NetConnection -ComputerName "localhost" -Port 5432 -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded)
  } catch {
    $dbOk = $false
  }
  if (-not $dbOk) {
    Write-Host "Warning: Cannot reach PostgreSQL at localhost:5432. Auth may fail." -ForegroundColor Yellow
    Log "PostgresReachable=false"
  } else {
    Log "PostgresReachable=true"
  }

  if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    Log "BackendNpmInstall=true"
    Push-Location $root
    & $npm install
    Pop-Location
  }

  if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Log "FrontendNpmInstall=true"
    Push-Location $webDir
    & $npm install
    Pop-Location
  }

  if ($dbOk -and $backendMode -eq "spawn") {
    Write-Host "Preparing Prisma (generate + db push)..." -ForegroundColor Cyan
    Log "PrismaPrepare=true"
    Push-Location $root
    try {
      & $npx prisma generate
      & $npx prisma db push
    } catch {
      Log ("PrismaPrepareFailed=" + $_.ToString())
      Write-Host "Warning: Prisma prepare failed (often due to file lock). Continuing..." -ForegroundColor Yellow
    } finally {
      Pop-Location
    }
  } else {
    Log "PrismaPrepare=skipped"
  }

  $safeDatabaseUrl = $env:DATABASE_URL.Replace("'", "''")
  $safeJwt = $env:JWT_SECRET.Replace("'", "''")
  $apiBase = "/api"
  Log ("ApiBase=" + $apiBase)
  $backendOrigin = ("http://localhost:" + $backendPort)
  Log ("BackendOrigin=" + $backendOrigin)
  $webEnvLocalPath = Join-Path $webDir ".env.local"
  if (-not (Test-Path $webEnvLocalPath)) {
    try {
      Set-Content -Path $webEnvLocalPath -Value ("NEXT_PUBLIC_API_BASE_URL=" + $apiBase) -Encoding ASCII
      Log "WroteWebEnvLocal=true"
    } catch {
      Log "WroteWebEnvLocal=false"
    }
  } else {
    Log "WroteWebEnvLocal=skipped_existing"
  }

  $backendScript = @(
    "`$ErrorActionPreference = 'Stop'"
    "`$env:PORT = '$backendPort'"
    "`$env:DATABASE_URL = '$safeDatabaseUrl'"
    "`$env:JWT_SECRET = '$safeJwt'"
    "$npm run dev"
  ) -join "`n"

  $frontendScript = @(
    "`$ErrorActionPreference = 'Stop'"
    "`$env:NEXT_PUBLIC_API_BASE_URL = '$apiBase'"
    "`$env:BACKEND_ORIGIN = '$backendOrigin'"
    "`$env:PORT = '$frontendPort'"
    "$npm run dev"
  ) -join "`n"

  $backendEncoded = Encode-PowerShellCommand -Script $backendScript
  $frontendEncoded = Encode-PowerShellCommand -Script $frontendScript

  $backendProc = $null
  if ($backendMode -eq "spawn") {
    $backendProc = Start-Process powershell -WorkingDirectory $root -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-EncodedCommand", $backendEncoded -PassThru
  }
  $frontendProc = Start-Process powershell -WorkingDirectory $webDir -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-EncodedCommand", $frontendEncoded -PassThru

  Set-Content -Path $pidsFile -Value @(
    ("backend=" + ($(if ($backendProc) { $backendProc.Id } else { (Get-ListeningPid -Port $backendPort) })))
    ("frontend=" + $frontendProc.Id)
    ("backendPort=" + $backendPort)
    ("frontendPort=" + $frontendPort)
  ) -Encoding ASCII

  if ($backendProc) {
    Log ("BackendPid=" + $backendProc.Id)
  } else {
    Log ("BackendPid=" + (Get-ListeningPid -Port $backendPort))
  }
  Log ("FrontendPid=" + $frontendProc.Id)
  Log ("PidsFile=" + $pidsFile)

  Write-Host ("Backend:  http://localhost:" + $backendPort + " (" + $backendMode + ")") -ForegroundColor Green
  Write-Host ("Frontend: http://localhost:" + $frontendPort) -ForegroundColor Green

  Start-Sleep -Seconds 2
  Start-Process ("http://localhost:" + $frontendPort + "/login") | Out-Null
  Log "OpenedBrowser=true"
} catch {
  Log ("Exception=" + $_.ToString())
  Write-Host "start-all failed. Check start-all.log" -ForegroundColor Red
  exit 1
}
