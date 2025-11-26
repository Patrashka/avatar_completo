# Script para ejecutar pruebas de carga con Locust
# Uso: .\run_load_test.ps1 [modo] [usuarios] [tiempo]

param(
    [string]$Modo = "web",  # web, basic, load, stress
    [int]$Users = 10,
    [string]$Time = "2m"
)

$ServiceHost = "http://127.0.0.1:8014"
$LocustFile = "locustfile.py"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PRUEBAS DE CARGA - JWT SERVICE" -ForegroundColor Cyan
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
    Write-Host "        Inicia el servicio primero con: .\start_services.ps1" -ForegroundColor Yellow
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
Write-Host "INICIANDO PRUEBAS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

switch ($Modo.ToLower()) {
    "web" {
        Write-Host "[MODO] Interfaz Web" -ForegroundColor Green
        Write-Host "      Abre: http://localhost:8089" -ForegroundColor Cyan
        Write-Host "      Servicio: $ServiceHost`n" -ForegroundColor Gray
        python -m locust -f $LocustFile --host=$ServiceHost
    }
    
    "basic" {
        Write-Host "[MODO] Prueba Básica (1 usuario, 30s)" -ForegroundColor Green
        python -m locust -f $LocustFile --host=$ServiceHost --users 1 --spawn-rate 1 --headless --run-time 30s
    }
    
    "load" {
        Write-Host "[MODO] Prueba de Carga ($Users usuarios, $Time)" -ForegroundColor Green
        python -m locust -f $LocustFile --host=$ServiceHost --users $Users --spawn-rate 2 --headless --run-time $Time
    }
    
    "stress" {
        Write-Host "[MODO] Prueba de Estrés (50 usuarios, 5m)" -ForegroundColor Green
        python -m locust -f $LocustFile --host=$ServiceHost --users 50 --spawn-rate 5 --headless --run-time 5m
    }
    
    default {
        Write-Host "[ERROR] Modo no válido: $Modo" -ForegroundColor Red
        Write-Host "`nModos disponibles:" -ForegroundColor Yellow
        Write-Host "  web    - Interfaz web interactiva" -ForegroundColor Gray
        Write-Host "  basic  - Prueba básica (1 usuario)" -ForegroundColor Gray
        Write-Host "  load   - Prueba de carga (10 usuarios)" -ForegroundColor Gray
        Write-Host "  stress - Prueba de estrés (50 usuarios)" -ForegroundColor Gray
        Write-Host "`nEjemplo: .\run_load_test.ps1 load 20 3m" -ForegroundColor Cyan
        exit 1
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PRUEBAS COMPLETADAS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

