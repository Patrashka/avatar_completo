# Script para verificar que todos los servicios estan funcionando
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "VERIFICACION COMPLETA DEL SISTEMA" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# Verificar bases de datos
Write-Host "[1/3] Verificando bases de datos..." -ForegroundColor Yellow
python database\test_connections.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Problemas con las bases de datos" -ForegroundColor Red
    exit 1
}

# Verificar microservicios
Write-Host "`n[2/3] Verificando microservicios..." -ForegroundColor Yellow
python database\test_services_health.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[WARN] Algunos microservicios pueden tener problemas" -ForegroundColor Yellow
}

# Verificar frontend
Write-Host "`n[3/3] Verificando frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "[OK] Frontend respondiendo en http://localhost:5173 (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Frontend no responde en http://localhost:5173" -ForegroundColor Yellow
    Write-Host "       Verifica que este corriendo con: cd frontend; npm run dev" -ForegroundColor Yellow
}

# Resumen de puertos
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "RESUMEN DE PUERTOS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
$ports = @(
    @{Name="Auth Service"; Port=8010},
    @{Name="Doctor Service"; Port=8011},
    @{Name="Patient Service"; Port=8012},
    @{Name="AI Service"; Port=8013},
    @{Name="Frontend (Vite)"; Port=5173}
)

foreach ($p in $ports) {
    $listening = netstat -ano | Select-String ":$($p.Port)\s" | Select-String "LISTENING"
    if ($listening) {
        Write-Host "[OK] $($p.Name): puerto $($p.Port)" -ForegroundColor Green
    } else {
        Write-Host "[--] $($p.Name): puerto $($p.Port) (no activo)" -ForegroundColor Gray
    }
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "VERIFICACION COMPLETA" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

