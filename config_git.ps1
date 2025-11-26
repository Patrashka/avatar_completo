# Script para configurar Git con tu identidad
# Uso: .\config_git.ps1 "Tu Nombre" "tu@email.com"

param(
    [string]$Name = "",
    [string]$Email = ""
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CONFIGURACION DE GIT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if ([string]::IsNullOrEmpty($Name) -or [string]::IsNullOrEmpty($Email)) {
    Write-Host "[INFO] Configuracion interactiva`n" -ForegroundColor Yellow
    
    if ([string]::IsNullOrEmpty($Name)) {
        $Name = Read-Host "Ingresa tu nombre completo (ej: Juan Perez)"
    }
    
    if ([string]::IsNullOrEmpty($Email)) {
        $Email = Read-Host "Ingresa tu email (ej: juan@example.com)"
    }
}

if ([string]::IsNullOrEmpty($Name) -or [string]::IsNullOrEmpty($Email)) {
    Write-Host "[ERROR] Nombre y email son requeridos" -ForegroundColor Red
    Write-Host "`nEjecuta:" -ForegroundColor Yellow
    Write-Host "  .\config_git.ps1 'Tu Nombre' 'tu@email.com'" -ForegroundColor Gray
    Write-Host "`nO ejecuta manualmente:" -ForegroundColor Yellow
    Write-Host "  git config --global user.name 'Tu Nombre'" -ForegroundColor Gray
    Write-Host "  git config --global user.email 'tu@email.com'`n" -ForegroundColor Gray
    exit 1
}

# Configurar Git
Write-Host "[INFO] Configurando Git...`n" -ForegroundColor Yellow

git config --global user.name "$Name"
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Nombre configurado: $Name" -ForegroundColor Green
} else {
    Write-Host "[ERROR] No se pudo configurar el nombre" -ForegroundColor Red
    exit 1
}

git config --global user.email "$Email"
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Email configurado: $Email" -ForegroundColor Green
} else {
    Write-Host "[ERROR] No se pudo configurar el email" -ForegroundColor Red
    exit 1
}

# Verificar configuración
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CONFIGURACION VERIFICADA" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$verifyName = git config --global user.name
$verifyEmail = git config --global user.email

Write-Host "Nombre: $verifyName" -ForegroundColor Cyan
Write-Host "Email:  $verifyEmail" -ForegroundColor Cyan

Write-Host "`n[OK] Git configurado correctamente!" -ForegroundColor Green
Write-Host "     Ahora puedes hacer commits desde Git Desktop`n" -ForegroundColor Gray

