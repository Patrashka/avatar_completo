#!/usr/bin/env pwsh
# Script para verificar conversaciones D-ID desde Docker

Write-Host "`n=== VERIFICACIÓN DE CONVERSACIONES DESDE DOCKER ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si el contenedor está corriendo
$containerRunning = docker ps --format "{{.Names}}" | Select-String -Pattern "medico_mongodb"
if (-not $containerRunning) {
    Write-Host "❌ El contenedor 'medico_mongodb' no está corriendo" -ForegroundColor Red
    Write-Host "💡 Inicia el contenedor con:" -ForegroundColor Yellow
    Write-Host "   docker-compose -f database/docker-compose.yml up -d" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Contenedor MongoDB encontrado" -ForegroundColor Green
Write-Host ""

# 1. Contar conversaciones
Write-Host "📊 Total de conversaciones D-ID:" -ForegroundColor Yellow
docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --quiet --eval "db.did_conversations.countDocuments({})"

# 2. Contar interacciones de IA
Write-Host "`n📊 Total de interacciones de IA:" -ForegroundColor Yellow
docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --quiet --eval "db.interaccion_ia.countDocuments({})"

# 3. Ver últimas 3 conversaciones (resumen)
Write-Host "`n📝 Últimas 3 conversaciones D-ID:" -ForegroundColor Yellow
$cmd3 = @'
db.did_conversations.find().sort({updatedAt: -1}).limit(3).forEach(function(doc) { 
    print("---"); 
    print("Usuario ID: " + doc.userId); 
    print("Paciente ID: " + doc.patientId); 
    print("Mensajes: " + doc.messages.length); 
});
'@
docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --quiet --eval $cmd3

# 4. Ver últimas 3 interacciones de IA
Write-Host "`n📝 Últimas 3 interacciones de IA:" -ForegroundColor Yellow
$cmd4 = @'
db.interaccion_ia.find().sort({fecha: -1}).limit(3).forEach(function(doc) { 
    print("---"); 
    print("Tipo: " + doc.tipo); 
    print("Usuario ID: " + doc.usuario_id); 
    print("Paciente ID: " + doc.paciente_id); 
});
'@
docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --quiet --eval $cmd4

Write-Host "`n✅ Verificación completada" -ForegroundColor Green
Write-Host "`n💡 Para ver más detalles, conecta interactivamente:" -ForegroundColor Cyan
Write-Host "   docker exec -it medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin" -ForegroundColor Gray
Write-Host "   use medico_mongo" -ForegroundColor Gray
Write-Host "   db.did_conversations.find().pretty()" -ForegroundColor Gray
