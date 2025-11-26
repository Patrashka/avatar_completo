# Script de verificación de base de datos compartida
# Verifica que la configuración sea consistente entre avatar_completo y cms_main

Write-Host "=== Verificación de Base de Datos Compartida ===" -ForegroundColor Cyan
Write-Host ""

$avatarDbPath = Join-Path $PSScriptRoot "."
$cmsDbPath = Join-Path $PSScriptRoot "..\..\cms_main\cms_db"

$errors = @()
$warnings = @()

# 1. Verificar Docker Compose
Write-Host "1. Verificando Docker Compose..." -ForegroundColor Yellow
if (Test-Path "$avatarDbPath\docker-compose.yml") {
    $avatarCompose = Get-Content "$avatarDbPath\docker-compose.yml" -Raw
    if ($avatarCompose -match "medico_db" -and $avatarCompose -match "admin" -and $avatarCompose -match "admin123") {
        Write-Host "   ✅ avatar_completo: Configuración correcta" -ForegroundColor Green
    } else {
        $errors += "avatar_completo docker-compose.yml tiene configuración incorrecta"
    }
} else {
    $errors += "No se encontró docker-compose.yml en avatar_completo"
}

if (Test-Path "$cmsDbPath\docker-compose.yml") {
    $cmsCompose = Get-Content "$cmsDbPath\docker-compose.yml" -Raw
    if ($cmsCompose -match "medico_db" -and $cmsCompose -match "admin" -and $cmsCompose -match "admin123") {
        Write-Host "   ✅ cms_main: Configuración correcta" -ForegroundColor Green
    } else {
        $errors += "cms_main docker-compose.yml tiene configuración incorrecta"
    }
} else {
    $warnings += "No se encontró docker-compose.yml en cms_main (puede estar en otra ubicación)"
}

# 2. Verificar Stored Procedures
Write-Host "`n2. Verificando Stored Procedures..." -ForegroundColor Yellow
if (Test-Path "$avatarDbPath\create_procedures.sql") {
    $avatarProcs = Get-Content "$avatarDbPath\create_procedures.sql" -Raw
    if ($avatarProcs -match "_sp") {
        Write-Host "   ⚠️  avatar_completo: Usa sufijo '_sp' en stored procedures" -ForegroundColor Yellow
    }
} else {
    $warnings += "No se encontró create_procedures.sql en avatar_completo"
}

if (Test-Path "$cmsDbPath\stored_procedures.sql") {
    $cmsProcs = Get-Content "$cmsDbPath\stored_procedures.sql" -Raw
    if ($cmsProcs -notmatch "_sp") {
        Write-Host "   ⚠️  cms_main: NO usa sufijo '_sp' en stored procedures" -ForegroundColor Yellow
        $warnings += "INCONSISTENCIA: Los stored procedures tienen nombres diferentes entre proyectos"
    }
} else {
    $warnings += "No se encontró stored_procedures.sql en cms_main"
}

# 3. Verificar esquema
Write-Host "`n3. Verificando esquema de base de datos..." -ForegroundColor Yellow
if (Test-Path "$avatarDbPath\init-postgres.sql") {
    Write-Host "   ✅ avatar_completo: init-postgres.sql encontrado" -ForegroundColor Green
} else {
    $errors += "No se encontró init-postgres.sql en avatar_completo"
}

if (Test-Path "$cmsDbPath\init-postgres.sql") {
    Write-Host "   ✅ cms_main: init-postgres.sql encontrado" -ForegroundColor Green
} else {
    $warnings += "No se encontró init-postgres.sql en cms_main"
}

# 4. Verificar contenedores Docker
Write-Host "`n4. Verificando contenedores Docker..." -ForegroundColor Yellow
try {
    $containers = docker ps -a --format "{{.Names}}" 2>$null
    if ($containers -match "medico_postgres") {
        Write-Host "   ✅ Contenedor medico_postgres encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Contenedor medico_postgres no está corriendo" -ForegroundColor Yellow
        $warnings += "Ejecuta 'docker-compose up -d' en el directorio database"
    }
    
    if ($containers -match "medico_mongodb") {
        Write-Host "   ✅ Contenedor medico_mongodb encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Contenedor medico_mongodb no está corriendo" -ForegroundColor Yellow
        $warnings += "Ejecuta 'docker-compose up -d' en el directorio database"
    }
} catch {
    $warnings += "No se pudo verificar contenedores Docker (¿Docker está instalado?)"
}

# Resumen
Write-Host "`n=== Resumen ===" -ForegroundColor Cyan
if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✅ Todo está correctamente configurado!" -ForegroundColor Green
} else {
    if ($errors.Count -gt 0) {
        Write-Host "`n❌ Errores encontrados:" -ForegroundColor Red
        foreach ($error in $errors) {
            Write-Host "   - $error" -ForegroundColor Red
        }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "`n⚠️  Advertencias:" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "   - $warning" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nVer DATABASE_SHARED_CONFIG.md para mas detalles" -ForegroundColor Cyan

