# Script para iniciar el frontend de forma visible
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Iniciando Frontend (Vite + React)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Verificar dependencias
if (-not (Test-Path "node_modules")) {
    Write-Host "[WARN] node_modules no encontrado. Instalando dependencias..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Error instalando dependencias" -ForegroundColor Red
        exit 1
    }
}

# Verificar vite
if (-not (Test-Path "node_modules\.bin\vite.cmd")) {
    Write-Host "[WARN] Vite no encontrado. Reinstalando..." -ForegroundColor Yellow
    npm install vite @vitejs/plugin-react --save-dev
}

# Verificar archivo .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "[INFO] Creando .env.local..." -ForegroundColor Yellow
    @"
VITE_AUTH_API=http://127.0.0.1:8010
VITE_DOCTOR_API=http://127.0.0.1:8011
VITE_PATIENT_API=http://127.0.0.1:8012
VITE_AI_API=http://127.0.0.1:8013
VITE_API=http://127.0.0.1:8080
"@ | Out-File -FilePath ".env.local" -Encoding utf8
}

Write-Host "[INFO] Iniciando servidor de desarrollo..." -ForegroundColor Green
Write-Host "URL: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

# Iniciar vite
npm run dev

