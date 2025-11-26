param(
    [string]$VenvPath = "",
    [switch]$Foreground
)

# Derive important paths
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Split-Path -Parent $scriptRoot
$projectRoot = Split-Path -Parent $frontendRoot

# Resolve python interpreter
$pythonCandidates = @()

if ($VenvPath) {
    $pythonCandidates += @( 
        (Join-Path $VenvPath "Scripts\python.exe"),
        $VenvPath
    )
}

$pythonCandidates += @(
    (Join-Path $frontendRoot ".venv\Scripts\python.exe"),
    (Join-Path $projectRoot ".venv\Scripts\python.exe")
)

$pythonExe = $null
foreach ($candidate in $pythonCandidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
    try {
        $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction Stop
        if (Test-Path $resolved) {
            $pythonExe = $resolved.Path
            break
        }
    } catch {
        continue
    }
}

if (-not $pythonExe) {
    try {
        $pythonExe = (Get-Command python -ErrorAction Stop).Source
    } catch {
        throw "No se encontró python. Usa -VenvPath para señalar el virtualenv." 
    }
}

Write-Host "Usando Python: $pythonExe" -ForegroundColor Green

$services = @(
    @{ Name = "auth";    Path = "services/auth_service/app.py";    Port = 8010 },
    @{ Name = "doctor";  Path = "services/doctor_service/app.py";  Port = 8011 },
    @{ Name = "patient"; Path = "services/patient_service/app.py"; Port = 8012 },
    @{ Name = "ai";      Path = "services/ai_service/app.py";      Port = 8013 },
    @{ Name = "jwt";     Path = "services/jwt_service/app.py";     Port = 8014 }
)

foreach ($svc in $services) {
    $entry = Join-Path $frontendRoot $svc.Path
    if (-not (Test-Path $entry)) {
        Write-Warning "No se encontró $($svc.Path). Se omite $($svc.Name)."
        continue
    }

    if ($Foreground) {
        Write-Host "\n=== Iniciando $($svc.Name) en primer plano (Ctrl+C para detener) ===" -ForegroundColor Cyan
        Push-Location $frontendRoot
        try {
            & $pythonExe $entry $svc.Port
        } finally {
            Pop-Location
        }
    } else {
        $escapedRoot = $frontendRoot -replace "'", "''"
        $escapedPython = $pythonExe -replace "'", "''"
        $escapedEntry = $entry -replace "'", "''"
        $command = "& { Set-Location -LiteralPath '$escapedRoot'; & '$escapedPython' '$escapedEntry' $($svc.Port) }"
        Write-Host "Lanzando $($svc.Name) en http://127.0.0.1:$($svc.Port)" -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WorkingDirectory $frontendRoot
    }
}
