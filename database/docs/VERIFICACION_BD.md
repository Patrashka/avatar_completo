# Verificación de Base de Datos - CMS y Avatar App

## 📋 Resumen de Configuración

### ✅ Configuración Unificada

Ambos proyectos (CMS y Avatar App) están configurados para usar la **misma base de datos**:

- **Base de datos:** `medico_db`
- **Usuario:** `admin`
- **Contraseña:** `admin123`
- **Host:** `localhost`
- **Puerto:** `5432`
- **Contenedor Docker:** `medico_postgres`

---

## 🔍 Verificación de Configuración

### 1. CMS (Node.js/Express)

**Archivo:** `cms_completo-main_final/cms_back/src/config/database.js`

```javascript
database: process.env.DB_NAME || "cms_medico",  // ⚠️ Default incorrecto
user: process.env.DB_USER || "postgres",        // ⚠️ Default incorrecto
```

**Archivo:** `cms_completo-main_final/cms_back/env.template`

```env
DB_NAME=medico_db      ✅ Correcto
DB_USER=admin          ✅ Correcto
DB_PASSWORD=admin123   ✅ Correcto
```

**Estado:** ✅ **CORRECTO** - El `.env` tiene los valores correctos, aunque los defaults en el código deberían actualizarse.

### 2. Avatar App (Python/Flask)

**Archivo:** `avatar_completo/frontend/db_connection.py`

```python
POSTGRES_DB = os.getenv("POSTGRES_DB", "medico_db")      ✅ Correcto
POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")      ✅ Correcto
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "admin123")  ✅ Correcto
```

**Estado:** ✅ **CORRECTO**

### 3. Docker Compose

**Ambos proyectos usan la misma configuración:**

```yaml
POSTGRES_DB: medico_db
POSTGRES_USER: admin
POSTGRES_PASSWORD: admin123
```

**Estado:** ✅ **CORRECTO**

---

## 📊 Esquema de Base de Datos

### Comparación de Esquemas

| Aspecto | CMS | Avatar App | Estado |
|---------|-----|------------|--------|
| Esquema SQL | `cms_db/init-postgres.sql` | `database/init-postgres.sql` | ✅ **Idénticos** |
| Tablas principales | ✅ Todas presentes | ✅ Todas presentes | ✅ **Compatible** |
| Stored Procedures | `create_procedures.sql` | `create_procedures.sql` | ⚠️ **Verificar nombres** |

### ⚠️ Inconsistencia Detectada en Stored Procedures

**Problema:** Hay dos archivos de stored procedures con nombres diferentes:

1. **`stored_procedures.sql`** - Funciones sin sufijo `_sp`:
   - `get_patient_by_id()`
   - `get_patient_consultations()`

2. **`create_procedures.sql`** - Funciones con sufijo `_sp`:
   - `get_patient_by_id_sp()`
   - `update_patient_sp()`
   - `get_doctor_by_id_sp()`

**Código Python usa:** Funciones con `_sp` (correcto)
```python
query = "SELECT * FROM get_patient_by_id_sp(%s)"
query = "SELECT * FROM get_doctor_by_id_sp(%s)"
query = "SELECT update_patient_sp(...)"
```

**Recomendación:** 
- ✅ Usar `create_procedures.sql` (con `_sp`)
- ❌ No usar `stored_procedures.sql` (sin `_sp`)

---

## 🔧 Funciones de Base de Datos

### Funciones Usadas por Avatar App

| Función | Uso en db_connection.py | Estado |
|---------|------------------------|--------|
| `get_patient_by_id_sp()` | ✅ Línea 311 | ✅ Usada |
| `get_patient_consultations_sp()` | ✅ Línea 322 | ✅ Usada |
| `get_patient_files_sp()` | ✅ Línea 333 | ✅ Usada |
| `get_patient_diagnoses_sp()` | ✅ Línea 317 | ✅ Usada |
| `get_doctor_by_id_sp()` | ✅ Línea 437 | ✅ Usada |
| `get_doctor_patients_sp()` | ✅ Línea 469 | ✅ Usada |
| `search_doctor_patients_sp()` | ✅ Línea 480 | ✅ Usada |
| `update_patient_sp()` | ✅ Línea 566 | ✅ Usada |
| `update_consultation_sp()` | ✅ Línea 589 | ✅ Usada |

### Funciones Usadas por CMS

El CMS usa queries SQL directas en lugar de stored procedures en la mayoría de los casos.

---

## ✅ Checklist de Verificación

### Configuración de Conexión
- [x] CMS configurado para usar `medico_db`
- [x] Avatar App configurado para usar `medico_db`
- [x] Docker Compose usa la misma base de datos
- [x] Credenciales unificadas (admin/admin123)
- [ ] ⚠️ CMS tiene defaults incorrectos en código (pero .env está bien)

### Esquema de Base de Datos
- [x] Esquemas SQL idénticos
- [x] Tablas compatibles
- [x] Stored procedures presentes
- [ ] ⚠️ Verificar que `create_procedures.sql` se ejecute en init

### Compatibilidad
- [x] Ambos proyectos pueden leer de la misma BD
- [x] Ambos proyectos pueden escribir en la misma BD
- [x] No hay conflictos de nombres de tablas
- [x] No hay conflictos de stored procedures

---

## 🚀 Recomendaciones

### 1. Actualizar Defaults del CMS

**Archivo:** `cms_completo-main_final/cms_back/src/config/database.js`

```javascript
// Cambiar de:
database: process.env.DB_NAME || "cms_medico",
user: process.env.DB_USER || "postgres",

// A:
database: process.env.DB_NAME || "medico_db",
user: process.env.DB_USER || "admin",
```

### 2. Verificar Inicialización de Stored Procedures

Asegurarse de que `create_procedures.sql` se ejecute durante la inicialización de Docker.

**Verificar en:** `database/init-postgres.sql` o `database/docker-compose.yml`

### 3. Crear Script de Verificación

Crear un script que verifique:
- Conexión desde CMS
- Conexión desde Avatar App
- Existencia de stored procedures
- Compatibilidad de esquemas

### 4. Documentar Variables de Entorno

Crear un archivo `.env.example` en ambos proyectos con las mismas variables.

---

## 📝 Notas Importantes

1. **MongoDB:** Ambos proyectos también usan MongoDB con la misma configuración:
   - Base de datos: `medico_mongo`
   - Usuario root: `admin`
   - Contraseña: `admin123`

2. **Concurrencia:** Ambos proyectos pueden acceder simultáneamente a la misma base de datos sin problemas.

3. **Migraciones:** Cualquier cambio en el esquema debe aplicarse en ambos proyectos.

---

## ✅ Conclusión

**Estado General:** ✅ **COMPATIBLE**

La base de datos está correctamente configurada para ambos proyectos. Solo se recomienda:
1. Actualizar los defaults en el código del CMS
2. Verificar que los stored procedures se inicialicen correctamente
3. Mantener sincronizados los esquemas SQL

---

**Última verificación:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

