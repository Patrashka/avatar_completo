# Configuración Compartida de Base de Datos

Este documento describe la configuración compartida de base de datos entre **avatar_completo** y **cms_completo**.

## 📋 Configuración de Docker Compose

Ambos proyectos utilizan la **misma configuración** de base de datos:

### PostgreSQL
- **Contenedor:** `medico_postgres`
- **Puerto:** `5432`
- **Base de datos:** `medico_db`
- **Usuario:** `admin`
- **Contraseña:** `admin123`

### MongoDB
- **Contenedor:** `medico_mongodb`
- **Puerto:** `27017`
- **Base de datos:** `medico_mongo`
- **Usuario root:** `admin`
- **Contraseña root:** `admin123`

## 🔧 Variables de Entorno

### Para Python (avatar_completo)
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

### Para Node.js (cms_completo)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medico_db
DB_USER=admin
DB_PASSWORD=admin123
```

## ⚠️ IMPORTANTE: Inconsistencia en Stored Procedures

**Problema detectado:** Los stored procedures tienen nombres diferentes en cada proyecto:

### avatar_completo
- Usa sufijo `_sp`: `get_patient_by_id_sp`, `get_patient_consultations_sp`, etc.
- Archivo: `database/create_procedures.sql`
- Referencias en: `frontend/db_connection.py`

### cms_completo
- **NO** usa sufijo `_sp`: `get_patient_by_id`, `get_patient_consultations`, etc.
- Archivo: `cms_db/stored_procedures.sql`

### Solución Recomendada

**Opción 1: Unificar usando sufijo `_sp` (Recomendado)**
- Actualizar `cms_db/stored_procedures.sql` para usar `_sp`
- Actualizar referencias en el código del CMS si es necesario

**Opción 2: Unificar sin sufijo `_sp`**
- Actualizar `database/create_procedures.sql` para quitar `_sp`
- Actualizar `frontend/db_connection.py` para quitar `_sp` de las llamadas

## 📝 Stored Procedures Requeridos

Ambos proyectos necesitan estos stored procedures (con el mismo nombre):

1. `get_patient_by_id_sp(patient_id INTEGER)`
2. `get_patient_consultations_sp(patient_id INTEGER, limit_count INTEGER)`
3. `get_patient_files_sp(patient_id INTEGER)`
4. `get_patient_diagnoses_sp(patient_id INTEGER)`
5. `get_doctor_by_id_sp(doctor_id INTEGER)`
6. `get_doctor_patients_sp(doctor_id INTEGER)`
7. `get_doctor_patient_sp(doctor_id INTEGER)`
8. `search_doctor_patients_sp(doctor_id INTEGER, search_term TEXT, limit_count INTEGER)`
9. `update_patient_sp(...)`
10. `update_consultation_sp(...)`

## 🚀 Iniciar Base de Datos

Desde cualquier proyecto:

```bash
cd database  # o cms_db
docker-compose up -d
```

## ✅ Verificación

Para verificar que ambos proyectos pueden conectarse:

### Python (avatar_completo)
```python
from db_connection import get_postgres_connection, get_mongo_client
conn = get_postgres_connection()
client = get_mongo_client()
```

### Node.js (cms_completo)
```javascript
const { pool } = require('./src/config/database');
pool.query('SELECT 1', (err, res) => {
  console.log('Connected:', !err);
});
```

## 📚 Esquema de Base de Datos

El esquema está definido en:
- `avatar_completo/database/init-postgres.sql`
- `cms_completo-main_final/cms_db/init-postgres.sql`

**Nota:** Ambos archivos deben tener el mismo esquema. Si hay diferencias, deben unificarse.

## 🔄 Sincronización

Para mantener ambos proyectos sincronizados:

1. **Esquema de BD:** Usar el mismo `init-postgres.sql`
2. **Stored Procedures:** Usar el mismo `create_procedures.sql` o `stored_procedures.sql`
3. **Docker Compose:** Misma configuración
4. **Variables de entorno:** Valores consistentes

## 🐛 Troubleshooting

### Error: "function does not exist"
- Verificar que los stored procedures estén creados
- Verificar que los nombres coincidan (con o sin `_sp`)

### Error: "connection refused"
- Verificar que Docker esté corriendo: `docker ps`
- Verificar que los contenedores estén activos: `docker-compose ps`

### Error: "authentication failed"
- Verificar credenciales en `.env`
- Verificar que las credenciales coincidan con `docker-compose.yml`

