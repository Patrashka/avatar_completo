# Base de Datos - Sistema Médico

Esta carpeta contiene la configuración completa de las bases de datos para el sistema médico.

## Estructura

- `docker-compose.yml` - Configuración de Docker para PostgreSQL y MongoDB
- `init-postgres.sql` - Script de inicialización de PostgreSQL con esquema y datos de ejemplo
- `init-mongo.js` - Script de inicialización de MongoDB con colecciones y validaciones

## Inicio Rápido

### 1. Iniciar las bases de datos

```bash
cd final/database
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

## Configuración

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
- **Usuario app:** app_user
- **Contraseña app:** app_password

## Variables de Entorno

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

## Estructura de Datos

### PostgreSQL

Contiene:
- Usuarios, médicos, pacientes
- Citas y consultas
- Archivos e interpretaciones
- Catálogos (tipos de sangre, ocupaciones, etc.)

### MongoDB

Contiene:
- `sesion_avatar` - Sesiones de avatar médico
- `turno_conversacion` - Turnos de conversación
- `interaccion_ia` - Interacciones con la IA
- `consulta_doc` - Documentos de consulta
- `resumen_conversacion` - Resúmenes de conversaciones

## Conexión desde Python

El módulo `db_connection.py` en `frontend/` maneja todas las conexiones:

```python
from db_connection import (
    get_patient_by_id,
    save_ia_interaction,
    get_patient_interactions
)

# Obtener paciente
patient = get_patient_by_id(1)

# Guardar interacción
save_ia_interaction(
    tipo="avatar",
    mensaje_usuario="Hola",
    respuesta_ia="Hola, ¿cómo puedo ayudarte?",
    paciente_id=1
)
```

## Resolución de Problemas

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

## Notas

- Los datos de ejemplo se cargan automáticamente al iniciar los contenedores por primera vez
- Los volúmenes de Docker persisten los datos entre reinicios
- Para desarrollo, puedes usar `docker-compose down -v` para limpiar todo

