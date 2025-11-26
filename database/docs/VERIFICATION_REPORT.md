# Reporte de Verificación de Base de Datos Compartida

**Fecha:** $(Get-Date -Format "yyyy-MM-dd")  
**Proyectos:** avatar_completo y cms_completo

## ✅ Configuraciones Correctas

### 1. Docker Compose
- ✅ Ambos proyectos usan la **misma configuración**
- ✅ Mismo contenedor: `medico_postgres` y `medico_mongodb`
- ✅ Mismas credenciales: `admin` / `admin123`
- ✅ Misma base de datos: `medico_db` y `medico_mongo`
- ✅ Mismos puertos: `5432` (PostgreSQL) y `27017` (MongoDB)

### 2. Esquema de Base de Datos
- ✅ Ambos proyectos tienen `init-postgres.sql`
- ✅ Los esquemas son compatibles

### 3. Contenedores Docker
- ✅ Contenedores están corriendo correctamente

## ⚠️ Problemas Encontrados

### 1. INCONSISTENCIA CRÍTICA: Nombres de Stored Procedures

**Problema:**
- **avatar_completo** usa stored procedures con sufijo `_sp`:
  - `get_patient_by_id_sp()`
  - `get_patient_consultations_sp()`
  - `get_doctor_by_id_sp()`
  - etc.

- **cms_completo** usa stored procedures **SIN** sufijo `_sp`:
  - `get_patient_by_id()`
  - `get_patient_consultations()`
  - `get_doctor_by_id()`
  - etc.

**Impacto:**
- Si ambos proyectos intentan usar la misma base de datos, solo uno funcionará
- El código de `db_connection.py` en avatar_completo llama a funciones con `_sp`
- El CMS probablemente llama a funciones sin `_sp`

**Solución Recomendada:**

**Opción A: Unificar usando sufijo `_sp` (Recomendado)**
1. Actualizar `cms_completo-main_final/cms_db/stored_procedures.sql`:
   - Cambiar todos los nombres de funciones para incluir `_sp`
   - Ejemplo: `get_patient_by_id` → `get_patient_by_id_sp`

2. Actualizar código del CMS si hace llamadas directas a stored procedures

**Opción B: Unificar sin sufijo `_sp`**
1. Actualizar `avatar_completo/database/create_procedures.sql`:
   - Quitar `_sp` de todos los nombres
   - Ejemplo: `get_patient_by_id_sp` → `get_patient_by_id`

2. Actualizar `avatar_completo/frontend/db_connection.py`:
   - Cambiar todas las llamadas de `get_patient_by_id_sp` a `get_patient_by_id`
   - Aplicar a todas las funciones relacionadas

## 📋 Checklist de Verificación

- [x] Docker Compose configurado correctamente
- [x] Credenciales consistentes
- [x] Esquema de base de datos presente
- [x] Contenedores Docker corriendo
- [ ] **Stored procedures unificados (PENDIENTE)**
- [ ] Variables de entorno configuradas en ambos proyectos
- [ ] Pruebas de conexión exitosas desde ambos proyectos

## 🔧 Variables de Entorno Requeridas

### avatar_completo (.env en frontend/)
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=medico_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123

MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=medico_mongo
MONGO_USER=app_user
MONGO_PASSWORD=app_password
```

### cms_completo (.env en cms_back/)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medico_db
DB_USER=admin
DB_PASSWORD=admin123
```

## 🚀 Próximos Pasos

1. **Resolver inconsistencia de stored procedures** (CRÍTICO)
   - Elegir una convención (con o sin `_sp`)
   - Actualizar ambos proyectos para usar la misma convención
   - Ejecutar los scripts SQL actualizados en la base de datos

2. **Verificar conexiones**
   - Probar conexión desde avatar_completo
   - Probar conexión desde cms_completo
   - Verificar que ambos puedan leer/escribir datos

3. **Documentar cambios**
   - Actualizar README de cada proyecto
   - Documentar la convención elegida

## 📚 Archivos de Referencia

- `DATABASE_SHARED_CONFIG.md` - Configuración compartida completa
- `verify_shared_db.ps1` - Script de verificación
- `docker-compose.yml` - Configuración Docker
- `init-postgres.sql` - Esquema de base de datos
- `create_procedures.sql` / `stored_procedures.sql` - Stored procedures

## ✅ Conclusión

La configuración de base de datos está **casi lista** para ser compartida. El único problema crítico es la inconsistencia en los nombres de stored procedures, que debe resolverse antes de que ambos proyectos puedan usar la misma base de datos simultáneamente.

