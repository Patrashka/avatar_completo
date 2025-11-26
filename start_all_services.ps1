# Script para iniciar todos los servicios del proyecto de forma controlada
# Evita duplicados y gestiona los procesos correctamente

param(
    [switch]$Stop,
    [switch]$Status
)

$ErrorActionPreference = "Continue"

# Colores para output
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Directorios del proyecto
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $projectRoot "frontend"
$servicesRoot = Join-Path $frontendRoot "services"
$backendRoot = Join-Path $projectRoot "backend"
$redisServiceRoot = Join-Path $projectRoot "redis_service"
$cmsBackendRoot = Join-Path $projectRoot "cms_main\cms_back"
$cmsFrontendRoot = Join-Path $projectRoot "cms_main\cms_front"

# Archivo para guardar PIDs
$pidFile = Join-Path $projectRoot ".service_pids.json"

# Función para obtener PIDs guardados
function Get-SavedPIDs {
    if (Test-Path $pidFile) {
        try {
            return Get-Content $pidFile | ConvertFrom-Json
        } catch {
            return @{}
        }
    }
    return @{}
}

# Función para guardar PIDs
function Save-PIDs {
    param($pids)
    $pids | ConvertTo-Json | Set-Content $pidFile
}

# Función para detener servicios
function Stop-AllServices {
    Write-Info "`n=== Deteniendo todos los servicios ==="
    
    $pids = Get-SavedPIDs
    $stopped = 0
    
    if ($pids -and $pids.PSObject.Properties) {
        foreach ($service in $pids.PSObject.Properties) {
            $processId = $service.Value
            $name = $service.Name
            
            try {
                $process = Get-Process -Id $processId -ErrorAction Stop
                Write-Info "Deteniendo $name (PID: $processId)..."
                Stop-Process -Id $processId -Force
                $stopped++
                Write-Success "  ✅ $name detenido"
            } catch {
                Write-Warning "  ⚠️ $name (PID: $processId) ya no existe"
            }
        }
    }
    
    # Limpiar procesos Python huérfanos en puertos conocidos
    Write-Info "`nLimpiando procesos en puertos conocidos..."
    $knownPorts = @(5001, 8010, 8011, 8012, 8013, 8014, 8080, 5173, 5000, 3000)
    foreach ($port in $knownPorts) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
            if ($connections) {
                $processes = $connections | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } | Select-Object -Unique
                foreach ($proc in $processes) {
                    try {
                        Write-Info "  Deteniendo proceso en puerto $port (PID: $($proc.Id))..."
                        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                        $stopped++
                    } catch {}
                }
            }
        } catch {}
    }
    
    # Eliminar archivo de PIDs
    if (Test-Path $pidFile) {
        Remove-Item $pidFile -Force
    }
    
    Write-Success "`n✅ $stopped procesos detenidos"
}

# Función para verificar si un puerto está en uso
function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    return $null -ne $connection
}

# Función para mostrar estado
function Show-Status {
    Write-Info "`n=== Estado de Servicios ==="
    
    $services = @(
        @{name="redis_service"; port=5001; path="/health"; hasHealth=$true},
        @{name="auth_service"; port=8010; path="/health"; hasHealth=$true},
        @{name="doctor_service"; port=8011; path="/health"; hasHealth=$true},
        @{name="patient_service"; port=8012; path="/health"; hasHealth=$true},
        @{name="ai_service"; port=8013; path="/health"; hasHealth=$true},
        @{name="jwt_service"; port=8014; path="/health"; hasHealth=$true},
        @{name="backend"; port=8080; path=""; hasHealth=$false},
        @{name="frontend"; port=5173; path="/"; hasHealth=$false},
        @{name="cms_backend"; port=5000; path="/health"; hasHealth=$true},
        @{name="cms_frontend"; port=3000; path="/"; hasHealth=$false}
    )
    
    $running = 0
    foreach ($svc in $services) {
        $portInUse = Test-Port -Port $svc.port
        if ($portInUse) {
            if ($svc.hasHealth) {
                try {
                    $response = Invoke-WebRequest -Uri "http://localhost:$($svc.port)$($svc.path)" -Method GET -TimeoutSec 5 -ErrorAction Stop
                    Write-Success "  ✅ $($svc.name) - http://localhost:$($svc.port) (health: OK)"
                    $running++
                } catch {
                    # Intentar una segunda vez después de un breve delay
                    Start-Sleep -Milliseconds 500
                    try {
                        $response = Invoke-WebRequest -Uri "http://localhost:$($svc.port)$($svc.path)" -Method GET -TimeoutSec 5 -ErrorAction Stop
                        Write-Success "  ✅ $($svc.name) - http://localhost:$($svc.port) (health: OK)"
                        $running++
                    } catch {
                        Write-Warning "  ⚠️ $($svc.name) - http://localhost:$($svc.port) (puerto en uso pero no responde al health check)"
                    }
                }
            } else {
                Write-Success "  ✅ $($svc.name) - http://localhost:$($svc.port) (puerto en uso)"
                $running++
            }
        } else {
            Write-Warning "  ❌ $($svc.name) - http://localhost:$($svc.port) (no responde)"
        }
    }
    
    Write-Info "`nServicios funcionando: $running/$($services.Count)"
}

# Función para iniciar un servicio
function Start-Service {
    param(
        [string]$Name,
        [string]$WorkingDir,
        [string]$Command,
        [int]$Port
    )
    
    # Verificar que el directorio existe
    if (-not (Test-Path $WorkingDir)) {
        Write-Warning "  ⚠️ Directorio no encontrado: $WorkingDir. Omitiendo $Name"
        return $null
    }
    
    # Verificar si el puerto está en uso
    if (Test-Port -Port $Port) {
        Write-Warning "  ⚠️ Puerto $Port ya está en uso. Omitiendo $Name"
        return $null
    }
    
    Write-Info "Iniciando $Name en puerto $Port..."
    
    # Escapar comillas simples en las rutas para PowerShell
    $escapedWorkingDir = $WorkingDir -replace "'", "''"
    $escapedCommand = $Command -replace "'", "''"
    
    # Construir el comando completo
    $fullCommand = "cd '$escapedWorkingDir'; $escapedCommand"
    
    try {
        $process = Start-Process powershell -ArgumentList "-NoExit", "-Command", $fullCommand -PassThru -WindowStyle Minimized -ErrorAction Stop
        
        Start-Sleep -Seconds 2
        
        # Verificar que el proceso sigue ejecutándose
        $stillRunning = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
        if ($stillRunning) {
            Write-Success "  ✅ $Name iniciado (PID: $($process.Id))"
            return $process.Id
        } else {
            Write-Warning "  ⚠️ $Name se detuvo inmediatamente después de iniciar"
            return $null
        }
    } catch {
        Write-Error "  ❌ Error al iniciar $Name : $_"
        return $null
    }
}

# Si se solicita detener
if ($Stop) {
    Stop-AllServices
    exit 0
}

# Si se solicita estado
if ($Status) {
    Show-Status
    exit 0
}

# Detener servicios anteriores si existen
Write-Info "Verificando servicios anteriores..."
$pids = Get-SavedPIDs
if ($pids -and $pids.PSObject.Properties -and $pids.PSObject.Properties.Count -gt 0) {
    Write-Warning "Se encontraron servicios anteriores. Deteniéndolos..."
    Stop-AllServices
    Start-Sleep -Seconds 2
}

# Verificar Python
try {
    $pythonExe = (Get-Command python -ErrorAction Stop).Source
    Write-Success "Python encontrado: $pythonExe"
} catch {
    Write-Error "Python no encontrado. Por favor instala Python."
    exit 1
}

# Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js encontrado: $nodeVersion"
} catch {
    Write-Warning "Node.js no encontrado. El frontend no se iniciará."
}

# Iniciar servicios
Write-Info "`n=== Iniciando Servicios ==="
$newPIDs = @{}

# 1. Redis Service
if (Test-Path $redisServiceRoot) {
    $redisPid = Start-Service -Name "redis_service" -WorkingDir $redisServiceRoot -Command "python app.py" -Port 5001
    if ($redisPid) { $newPIDs["redis_service"] = $redisPid }
} else {
    Write-Warning "  ⚠️ Directorio redis_service no encontrado"
}

Start-Sleep -Seconds 2

# 2. Microservicios Flask
$microservices = @(
    @{name="auth_service"; port=8010; path="services\auth_service\app.py"},
    @{name="doctor_service"; port=8011; path="services\doctor_service\app.py"},
    @{name="patient_service"; port=8012; path="services\patient_service\app.py"},
    @{name="ai_service"; port=8013; path="services\ai_service\app.py"},
    @{name="jwt_service"; port=8014; path="services\jwt_service\app.py"}
)

foreach ($svc in $microservices) {
    $fullPath = Join-Path $frontendRoot $svc.path
    if (Test-Path $fullPath) {
        # Usar comillas dobles para el path del script y pasar el puerto como argumento
        $command = "python `"$($svc.path)`" $($svc.port)"
        $processId = Start-Service -Name $svc.name -WorkingDir $frontendRoot -Command $command -Port $svc.port
        if ($processId) { $newPIDs[$svc.name] = $processId }
        Start-Sleep -Seconds 1
    } else {
        Write-Warning "  ⚠️ No se encontró $($svc.path)"
    }
}

Start-Sleep -Seconds 2

# 3. Backend
if (Test-Path $backendRoot) {
    $backendPid = Start-Service -Name "backend" -WorkingDir $backendRoot -Command "python server.py" -Port 8080
    if ($backendPid) { $newPIDs["backend"] = $backendPid }
} else {
    Write-Warning "  ⚠️ Directorio backend no encontrado"
}

Start-Sleep -Seconds 2

# 4. Frontend
if (Test-Path $frontendRoot) {
    if (-not (Test-Port -Port 5173)) {
        Write-Info "Iniciando frontend en puerto 5173..."
        if (Test-Path (Join-Path $frontendRoot "node_modules")) {
            $escapedFrontendRoot = $frontendRoot -replace "'", "''"
            $frontendCommand = "cd '$escapedFrontendRoot'; npm run dev"
            try {
                $frontendPid = Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand -PassThru -WindowStyle Minimized -ErrorAction Stop
                if ($frontendPid) { 
                    $newPIDs["frontend"] = $frontendPid.Id
                    Write-Success "  ✅ Frontend iniciado (PID: $($frontendPid.Id))"
                }
            } catch {
                Write-Error "  ❌ Error al iniciar frontend: $_"
            }
        } else {
            Write-Warning "  ⚠️ node_modules no encontrado. Ejecuta 'npm install' primero."
        }
    } else {
        Write-Warning "  ⚠️ Puerto 5173 ya está en uso. Frontend no se iniciará."
    }
} else {
    Write-Warning "  ⚠️ Directorio frontend no encontrado"
}

Start-Sleep -Seconds 2

# 5. CMS Backend
if (Test-Path $cmsBackendRoot) {
    if (-not (Test-Port -Port 5000)) {
        Write-Info "Iniciando CMS Backend en puerto 5000..."
        if (Test-Path (Join-Path $cmsBackendRoot "node_modules")) {
            $escapedCmsBackendRoot = $cmsBackendRoot -replace "'", "''"
            $cmsBackendCommand = "cd '$escapedCmsBackendRoot'; npm start"
            try {
                $cmsBackendPid = Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmsBackendCommand -PassThru -WindowStyle Minimized -ErrorAction Stop
                if ($cmsBackendPid) { 
                    $newPIDs["cms_backend"] = $cmsBackendPid.Id
                    Write-Success "  ✅ CMS Backend iniciado (PID: $($cmsBackendPid.Id))"
                }
            } catch {
                Write-Error "  ❌ Error al iniciar CMS Backend: $_"
            }
        } else {
            Write-Warning "  ⚠️ node_modules no encontrado en CMS Backend. Ejecuta 'npm install' primero."
        }
    } else {
        Write-Warning "  ⚠️ Puerto 5000 ya está en uso. CMS Backend no se iniciará."
    }
} else {
    Write-Warning "  ⚠️ Directorio cms_main\cms_back no encontrado"
}

Start-Sleep -Seconds 2

# 6. CMS Frontend
if (Test-Path $cmsFrontendRoot) {
    if (-not (Test-Port -Port 3000)) {
        Write-Info "Iniciando CMS Frontend en puerto 3000..."
        if (Test-Path (Join-Path $cmsFrontendRoot "node_modules")) {
            $escapedCmsFrontendRoot = $cmsFrontendRoot -replace "'", "''"
            $cmsFrontendCommand = "cd '$escapedCmsFrontendRoot'; npm start"
            try {
                $cmsFrontendPid = Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmsFrontendCommand -PassThru -WindowStyle Minimized -ErrorAction Stop
                if ($cmsFrontendPid) { 
                    $newPIDs["cms_frontend"] = $cmsFrontendPid.Id
                    Write-Success "  ✅ CMS Frontend iniciado (PID: $($cmsFrontendPid.Id))"
                }
            } catch {
                Write-Error "  ❌ Error al iniciar CMS Frontend: $_"
            }
        } else {
            Write-Warning "  ⚠️ node_modules no encontrado en CMS Frontend. Ejecuta 'npm install' primero."
        }
    } else {
        Write-Warning "  ⚠️ Puerto 3000 ya está en uso. CMS Frontend no se iniciará."
    }
} else {
    Write-Warning "  ⚠️ Directorio cms_main\cms_front no encontrado"
}

# Guardar PIDs
if ($newPIDs.Count -gt 0) {
    Save-PIDs $newPIDs
    Write-Success "`n✅ PIDs guardados en $pidFile"
}

Write-Info "`n=== Esperando inicialización (15 segundos) ==="
Start-Sleep -Seconds 15

# Verificar estado
Show-Status

Write-Info "`n=== Comandos útiles ==="
Write-Host "  Para detener todos: .\start_all_services.ps1 -Stop" -ForegroundColor White
Write-Host "  Para ver estado: .\start_all_services.ps1 -Status" -ForegroundColor White
Write-Host "`n✅ Proceso completado!" -ForegroundColor Green
