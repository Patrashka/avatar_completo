# Script para iniciar Locust en modo web y abrir el navegador automáticamente

$ServiceHost = "http://127.0.0.1:8014"
$LocustFile = "locustfile.py"
$LocustWebPort = 8089
$LocustWebUrl = "http://localhost:$LocustWebPort"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "INICIANDO LOCUST - INTERFAZ WEB" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Verificar que el servicio esté corriendo
Write-Host "[INFO] Verificando servicio JWT..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ServiceHost/health" -TimeoutSec 3 -UseBasicParsing
    $health = $response.Content | ConvertFrom-Json
    Write-Host "[OK] Servicio JWT activo" -ForegroundColor Green
    Write-Host "     Redis: $($health.redis)" -ForegroundColor $(if ($health.redis -eq 'connected') { 'Green' } else { 'Yellow' })
} catch {
    Write-Host "[ERROR] El servicio JWT no está corriendo en $ServiceHost" -ForegroundColor Red
    Write-Host "        Inicia el servicio primero con: ..\start_services.ps1" -ForegroundColor Yellow
    exit 1
}

# Verificar que Locust esté instalado
Write-Host "`n[INFO] Verificando Locust..." -ForegroundColor Yellow
try {
    $locustVersion = python -c "import locust; print(locust.__version__)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Locust instalado: $locustVersion" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Locust no está instalado" -ForegroundColor Red
        Write-Host "        Instala con: pip install locust" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[ERROR] No se pudo verificar Locust" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "INICIANDO SERVIDOR LOCUST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "[INFO] Servicio JWT: $ServiceHost" -ForegroundColor Yellow
Write-Host "[INFO] Interfaz Web: $LocustWebUrl" -ForegroundColor Yellow
Write-Host "`n[INFO] Abriendo navegador en 3 segundos..." -ForegroundColor Cyan
Write-Host "[INFO] Presiona Ctrl+C para detener el servidor`n" -ForegroundColor Gray

# Esperar 3 segundos y abrir el navegador
Start-Sleep -Seconds 3
Start-Process $LocustWebUrl

Write-Host "========================================`n" -ForegroundColor Cyan

# Iniciar Locust en modo web
python -m locust -f $LocustFile --host=$ServiceHost --web-port=$LocustWebPort

