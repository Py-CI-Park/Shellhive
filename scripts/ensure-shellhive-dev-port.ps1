param(
  [Parameter(Mandatory = $false)]
  [int]$Port = 1420,
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

function Get-ListeningProcessIds {
  param([int]$TargetPort)

  $connections = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue
  if (-not $connections) {
    return @()
  }

  return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}

$normalizedRoot = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
$ownerPids = Get-ListeningProcessIds -TargetPort $Port

if (-not $ownerPids -or $ownerPids.Count -eq 0) {
  Write-Host "[INFO] Dev port $Port is available."
  exit 0
}

$blockedOwners = @()
$staleShellhiveVitePids = @()

foreach ($ownerPid in $ownerPids) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerPid" -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }

  $commandLine = $process.CommandLine
  $isViteNode = $process.Name -ieq 'node.exe' -and $commandLine -match 'vite[\\/]+bin[\\/]+vite\.js'
  $isFromCurrentProject = $commandLine -like "*$normalizedRoot*"

  if ($isViteNode -and $isFromCurrentProject) {
    $staleShellhiveVitePids += [int]$ownerPid
  } else {
    $blockedOwners += [PSCustomObject]@{
      ProcessId = [int]$ownerPid
      Name = $process.Name
      CommandLine = $commandLine
    }
  }
}

if ($blockedOwners.Count -gt 0) {
  Write-Host "[ERROR] Dev port $Port is already used by another process."
  foreach ($owner in $blockedOwners) {
    Write-Host "[ERROR] PID=$($owner.ProcessId), Name=$($owner.Name)"
    if ($owner.CommandLine) {
      Write-Host "[ERROR] CommandLine: $($owner.CommandLine)"
    }
  }
  Write-Host "[ERROR] Please stop that process, then run run-dev.bat again."
  exit 2
}

if ($staleShellhiveVitePids.Count -gt 0) {
  foreach ($stalePid in ($staleShellhiveVitePids | Select-Object -Unique)) {
    Stop-Process -Id $stalePid -Force -ErrorAction Stop
    Write-Host "[INFO] Stopped stale Shellhive Vite process (PID=$stalePid)."
  }
}

Write-Host "[INFO] Dev port $Port is ready."
exit 0
