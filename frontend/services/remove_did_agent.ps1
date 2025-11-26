# Script para eliminar el directorio did_agent
# Ejecuta este script después de cerrar cualquier proceso de Python o IDE que pueda estar usando archivos del directorio

$didAgentPath = Join-Path $PSScriptRoot "did_agent"

if (-not (Test-Path $didAgentPath)) {
    Write-Host "✅ El directorio did_agent ya no existe." -ForegroundColor Green
    exit 0
}

Write-Host "Intentando eliminar did_agent..." -ForegroundColor Yellow

# Intentar eliminar con diferentes métodos
try {
    # Método 1: Eliminación normal
    Remove-Item -Path $didAgentPath -Recurse -Force -ErrorAction Stop
    Write-Host "✅ Directorio did_agent eliminado exitosamente." -ForegroundColor Green
} catch {
    Write-Host "⚠️ No se pudo eliminar automáticamente." -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor Yellow
    Write-Host "1. Cierra cualquier proceso de Python que pueda estar ejecutándose" -ForegroundColor Yellow
    Write-Host "2. Cierra tu IDE (VS Code, PyCharm, etc.) si está abierto" -ForegroundColor Yellow
    Write-Host "3. Elimina manualmente el directorio:" -ForegroundColor Yellow
    Write-Host "   $didAgentPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "O ejecuta este comando en PowerShell como Administrador:" -ForegroundColor Yellow
    Write-Host "Remove-Item -Path '$didAgentPath' -Recurse -Force" -ForegroundColor Cyan
}

