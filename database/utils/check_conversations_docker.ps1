#!/usr/bin/env pwsh
# Script para verificar conversaciones D-ID desde Docker

Write-Host "`n=== VERIFICACIÓN DE CONVERSACIONES DESDE DOCKER ===" -ForegroundColor Cyan
Write-Host ""

# 1. Contar conversaciones
Write-Host "📊 Total de conversaciones:" -ForegroundColor Yellow
docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --quiet --eval "db.did_conversations.countDocuments({})"

# 2. Contar mensajes totales
Write-Host "`n💬 Total de mensajes:" -ForegroundColor Yellow
docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --quiet --eval "var total = 0; db.did_conversations.find().forEach(function(doc) { total += doc.messages.length; }); print(total);"

# 3. Ver todas las conversaciones (resumen)
Write-Host "`n📝 Resumen de conversaciones:" -ForegroundColor Yellow
docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --quiet --eval "db.did_conversations.find().forEach(function(doc) { print('Agent: ' + doc.agentId.substring(0, 15) + '... | Chat: ' + doc.chatId.substring(0, 15) + '... | Usuario: ' + doc.userId + ' | Paciente: ' + doc.patientId + ' | Mensajes: ' + doc.messages.length); });"

Write-Host "`n✅ Verificación completada" -ForegroundColor Green
Write-Host "`n💡 Para ver más detalles, usa estos comandos:" -ForegroundColor Cyan
Write-Host "`n1. Conectarse interactivamente:" -ForegroundColor Yellow
Write-Host "   docker exec -it medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin" -ForegroundColor Gray
Write-Host "   use medico_mongo" -ForegroundColor Gray
Write-Host "   db.did_conversations.find().pretty()" -ForegroundColor Gray
Write-Host "`n2. Ver última conversación:" -ForegroundColor Yellow
Write-Host '   docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --eval "db.did_conversations.find().sort({updatedAt: -1}).limit(1).pretty()"' -ForegroundColor Gray
Write-Host "`n3. Ver conversaciones de un paciente específico:" -ForegroundColor Yellow
Write-Host '   docker exec medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin medico_mongo --eval "db.did_conversations.find({patientId: 3}).pretty()"' -ForegroundColor Gray
