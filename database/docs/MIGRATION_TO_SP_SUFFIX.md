# Migración de Stored Procedures - Sufijo `_sp`

## ✅ Cambios Realizados

Todos los stored procedures en `cms_completo-main_final/cms_db/stored_procedures.sql` han sido actualizados para usar el sufijo `_sp`, manteniendo consistencia con `avatar_completo`.

### Funciones Actualizadas

1. ✅ `get_patient_by_id` → `get_patient_by_id_sp`
2. ✅ `get_patient_consultations` → `get_patient_consultations_sp`
3. ✅ `get_patient_files` → `get_patient_files_sp`
4. ✅ `get_patient_diagnoses` → `get_patient_diagnoses_sp`
5. ✅ `get_doctor_patient` → `get_doctor_patient_sp`
6. ✅ `search_doctor_patients` → `search_doctor_patients_sp`
7. ✅ `update_patient` → `update_patient_sp`
8. ✅ `update_consultation` → `update_consultation_sp`
9. ✅ `get_doctor_by_id` → `get_doctor_by_id_sp`
10. ✅ `get_catalogos` → `get_catalogos_sp`

### Funciones Agregadas

- ✅ `get_doctor_patients_sp` - Agregada para consistencia con avatar_completo

## 🔄 Próximos Pasos

### 1. Aplicar los Stored Procedures a la Base de Datos

Ejecuta el archivo SQL actualizado en tu base de datos:

```bash
# Opción 1: Desde psql
psql -U admin -d medico_db -f stored_procedures.sql

# Opción 2: Desde Docker
docker exec -i medico_postgres psql -U admin -d medico_db < stored_procedures.sql
```

### 2. Verificar que los Procedimientos Estén Creados

```sql
-- Verificar que todas las funciones existen
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%_sp'
ORDER BY routine_name;
```

### 3. Actualizar Docker Compose (Opcional)

Si el CMS tiene un `docker-compose.yml` que carga stored procedures automáticamente, asegúrate de que apunte al archivo actualizado.

## ⚠️ Notas Importantes

- **No hay código que actualizar**: El CMS no hace llamadas directas a stored procedures, usa queries SQL directas.
- **Compatibilidad**: Ambos proyectos (avatar_completo y cms_completo) ahora usan la misma convención de nombres.
- **Base de datos compartida**: Ambos proyectos pueden usar la misma base de datos `medico_db` sin conflictos.

## ✅ Verificación

Para verificar que todo está correcto:

1. Ejecuta el script de verificación desde avatar_completo:
   ```powershell
   cd ..\avatar_completo\database
   .\verify_shared_db.ps1
   ```

2. Verifica que no haya errores al conectar desde ambos proyectos.

## 📚 Referencias

- `avatar_completo/database/create_procedures.sql` - Referencia de funciones con `_sp`
- `avatar_completo/database/DATABASE_SHARED_CONFIG.md` - Configuración compartida

