# Base de Datos - Sistema Médico

Este directorio contiene toda la configuración consolidada de las bases de datos para el sistema médico. Los archivos están organizados en subdirectorios para facilitar el mantenimiento.

## 📁 Estructura de Directorios

```
database/
├── docker-compose.yml          # Configuración Docker (PostgreSQL + MongoDB)
├── scripts/
│   ├── init/                  # Scripts de inicialización
│   │   ├── init-postgres.sql  # Esquema y datos iniciales de PostgreSQL
│   │   └── init-mongo.js      # Inicialización de MongoDB
│   ├── procedures/            # Stored Procedures
│   │   └── stored_procedures.sql  # Todos los stored procedures con sufijo _sp
│   └── data/                  # Scripts de inserción de datos de prueba
│       ├── insert_patient.sql
│       ├── insert_test_doctors.sql
│       └── insert_test_profiles.sql
├── migrations/                # Scripts de migración
│   ├── migrate-to-correct-schema.sql
│   └── update_database.sql
├── tests/                     # Scripts de prueba
│   ├── test_connections.py
│   ├── test_services_health.py
│   └── verificar_bd.py
├── docs/                      # Documentación
│   ├── README.md
│   └── FIXES_DOCTOR_PATIENT.md
└── utils/                     # Utilidades
    ├── show_credentials.py
    ├── verify_all_services.ps1
    └── verify_shared_db.ps1
```

## 🚀 Inicio Rápido

### 1. Iniciar las bases de datos

```bash
cd database
docker-compose up -d
```

Esto iniciará:
- **PostgreSQL** en el puerto `5432`
- **MongoDB** en el puerto `27017`

### 2. Verificar que están corriendo

```bash
docker-compose ps
```

### 3. Detener las bases de datos

```bash
docker-compose down
```

### 4. Ver logs

```bash
docker-compose logs -f
```

## ⚙️ Configuración

### PostgreSQL

- **Host:** localhost
- **Puerto:** 5432
- **Base de datos:** medico_db
- **Usuario:** admin
- **Contraseña:** admin123

### MongoDB

- **Host:** localhost
- **Puerto:** 27017
- **Base de datos:** medico_mongo
- **Usuario root:** admin
- **Contraseña root:** admin123

## 🔧 Variables de Entorno

### Para Python (avatar_completo)

Agrega estas variables a tu archivo `.env` en `frontend/`:

```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=medico_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123

# MongoDB
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=medico_mongo
MONGO_USER=app_user
MONGO_PASSWORD=app_password
```

### Para Node.js (cms_main)

Agrega estas variables a tu archivo `.env` en `cms_back/`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medico_db
DB_USER=admin
DB_PASSWORD=admin123
```

## 📊 Estructura de Datos

### PostgreSQL

Contiene:
- Usuarios, médicos, pacientes
- Citas y consultas
- Archivos e interpretaciones
- Catálogos (tipos de sangre, ocupaciones, etc.)

### MongoDB

Contiene:
- `did_conversations` - Conversaciones con el avatar
- `sesion_avatar` - Sesiones de avatar
- `interaccion_ia` - Interacciones con la IA
- `consulta_doc` - Documentos de consulta

## 🔄 Stored Procedures

Todos los stored procedures usan el sufijo `_sp` para mantener consistencia:

- `get_patient_by_id_sp()`
- `get_patient_consultations_sp()`
- `get_patient_files_sp()`
- `get_patient_diagnoses_sp()`
- `get_doctor_by_id_sp()`
- `get_doctor_patients_sp()`
- `get_doctor_patient_sp()`
- `search_doctor_patients_sp()`
- `update_patient_sp()`
- `update_consultation_sp()`

Ver `scripts/procedures/stored_procedures.sql` para la lista completa.

## 🧪 Pruebas

### Probar conexiones

```bash
# Python
python tests/test_connections.py

# PowerShell
.\utils\verify_all_services.ps1
```

### Verificar configuración compartida

```bash
.\utils\verify_shared_db.ps1
```

## 📚 Documentación Adicional

- `docs/FIXES_DOCTOR_PATIENT.md` - Correcciones aplicadas a stored procedures

## 🔄 Migraciones

Si necesitas aplicar cambios al esquema existente, usa los scripts en `migrations/`:

```bash
docker exec -i medico_postgres psql -U admin -d medico_db < migrations/migrate-to-correct-schema.sql
```

## 🐛 Resolución de Problemas

### Error de conexión a PostgreSQL

```bash
# Verificar que el contenedor está corriendo
docker ps | grep postgres

# Ver logs
docker-compose logs postgres
```

### Error de conexión a MongoDB

```bash
# Verificar que el contenedor está corriendo
docker ps | grep mongodb

# Ver logs
docker-compose logs mongodb
```

### Reiniciar desde cero

```bash
# Detener y eliminar volúmenes
docker-compose down -v

# Iniciar de nuevo
docker-compose up -d
```

## 📝 Notas

- Los datos de ejemplo se cargan automáticamente al iniciar los contenedores por primera vez
- Los volúmenes de Docker persisten los datos entre reinicios
- Para desarrollo, puedes usar `docker-compose down -v` para limpiar todo
- Este directorio es compartido entre `avatar_completo` y `cms_main`

## 🔗 Referencias

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

