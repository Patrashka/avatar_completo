# 🗄️ Base de Datos - Sistema Médico

Este directorio contiene la configuración de Docker para las bases de datos del sistema médico.

## 🚀 Inicio Rápido

### Requisitos
- Docker y Docker Compose instalados
- Puertos 5432 (PostgreSQL) y 27017 (MongoDB) disponibles

### Iniciar las Bases de Datos

```powershell
cd database
docker-compose up -d
```

Esto iniciará:
- **PostgreSQL** en el puerto 5432
- **MongoDB** en el puerto 27017

### Verificar que Funcionó

```powershell
# Verificar PostgreSQL
docker exec -it medico_postgres psql -U admin -d medico_db -c "SELECT COUNT(*) FROM ROL;"

# Verificar MongoDB
docker exec -it medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.adminCommand('ping')"
```

## 📋 Estructura

```
database/
├── docker-compose.yml          # Configuración de Docker
├── scripts/
│   ├── init/                   # Scripts de inicialización
│   │   ├── init-postgres.sql   # Esquema y datos iniciales de PostgreSQL
│   │   └── init-mongo.js       # Inicialización de MongoDB
│   ├── procedures/             # Stored procedures
│   │   └── stored_procedures.sql
│   └── data/                   # Scripts de datos adicionales
│       ├── insert_test_profiles.sql
│       ├── insert_test_doctors.sql
│       └── insert_patient.sql
├── migrations/                 # Migraciones de base de datos
└── tests/                      # Scripts de prueba
```

## 🔧 Configuración

### Credenciales por Defecto

**PostgreSQL:**
- Usuario: `admin`
- Contraseña: `admin123`
- Base de datos: `medico_db`
- Puerto: `5432`

**MongoDB:**
- Usuario: `admin`
- Contraseña: `admin123`
- Base de datos: `medico_mongo`
- Puerto: `27017`

### Cambiar Credenciales

Edita `docker-compose.yml` y cambia las variables de entorno:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_INITDB_DATABASE`

## 📊 Datos Iniciales

El script `init-postgres.sql` carga automáticamente:

### Catálogos
- ✅ Roles (Administrador, Médico, Paciente)
- ✅ Especialidades médicas (15 especialidades)
- ✅ Tipos de sangre (A+, A-, B+, B-, AB+, AB-, O+, O-)
- ✅ Ocupaciones (8 ocupaciones)
- ✅ Estados civiles (Soltero, Casado, Divorciado, Viudo)
- ✅ Estados de cita (Programada, Confirmada, En curso, Completada, Cancelada)
- ✅ Tipos de cita (General, Urgencia, Seguimiento, Control)
- ✅ Estados de consulta (En curso, Cerrada, Cancelada)
- ✅ Estados de código (Emitido, Usado, Expirado, Anulado)
- ✅ Aseguradoras (5 aseguradoras)

### Usuarios de Prueba
- ✅ 2 Médicos de ejemplo
- ✅ 3 Pacientes de ejemplo con datos completos
- ✅ Usuarios con contraseñas hasheadas (password: `password123`)

### Datos de Ejemplo
- ✅ Consultas médicas
- ✅ Episodios médicos
- ✅ Citas programadas

## 🐛 Solución de Problemas

### Los datos no se cargan automáticamente

**Problema:** La base de datos se crea pero los datos no aparecen.

**Soluciones:**

1. **Verificar que el volumen esté vacío:**
   ```powershell
   docker-compose down -v
   docker-compose up -d
   ```
   ⚠️ **ADVERTENCIA:** Esto eliminará todos los datos existentes.

2. **Verificar los logs de PostgreSQL:**
   ```powershell
   docker logs medico_postgres
   ```
   Busca errores en la ejecución del script.

3. **Verificar que los scripts existan:**
   ```powershell
   # Verificar que el archivo existe
   Test-Path scripts/init/init-postgres.sql
   
   # Verificar permisos (debe ser legible)
   Get-Item scripts/init/init-postgres.sql
   ```

4. **Ejecutar el script manualmente:**
   ```powershell
   docker exec -i medico_postgres psql -U admin -d medico_db < scripts/init/init-postgres.sql
   ```

5. **Verificar que los datos se insertaron:**
   ```powershell
   docker exec -it medico_postgres psql -U admin -d medico_db -c "SELECT COUNT(*) FROM ROL;"
   docker exec -it medico_postgres psql -U admin -d medico_db -c "SELECT COUNT(*) FROM MEDICO;"
   docker exec -it medico_postgres psql -U admin -d medico_db -c "SELECT COUNT(*) FROM PACIENTE;"
   ```

### Error: "port is already allocated"

**Solución:** El puerto ya está en uso. Detén otros servicios que usen los puertos 5432 o 27017, o cambia los puertos en `docker-compose.yml`.

### Error: "permission denied"

**Solución en Linux/Mac:**
```bash
chmod +r scripts/init/*.sql
chmod +r scripts/procedures/*.sql
```

### El script se ejecuta pero hay errores

Los scripts ahora usan `ON CONFLICT DO NOTHING` o `ON CONFLICT DO UPDATE` para permitir re-ejecución sin errores. Si ves errores, revisa los logs:

```powershell
docker logs medico_postgres 2>&1 | Select-String -Pattern "ERROR|FATAL"
```

## 📝 Notas Importantes

1. **Los scripts solo se ejecutan en la primera inicialización** - Si el volumen de datos ya existe, los scripts NO se ejecutarán automáticamente.

2. **Para re-ejecutar los scripts:**
   ```powershell
   docker-compose down -v  # Elimina volúmenes
   docker-compose up -d     # Reinicia con scripts
   ```

3. **Los scripts son idempotentes** - Pueden ejecutarse múltiples veces sin causar errores gracias a `ON CONFLICT`.

4. **Backup de datos:**
   ```powershell
   # Backup PostgreSQL
   docker exec medico_postgres pg_dump -U admin medico_db > backup.sql
   
   # Backup MongoDB
   docker exec medico_mongodb mongodump -u admin -p admin123 --authenticationDatabase admin --out /backup
   ```

## 🔄 Comandos Útiles

```powershell
# Iniciar
docker-compose up -d

# Detener
docker-compose down

# Detener y eliminar volúmenes (⚠️ elimina datos)
docker-compose down -v

# Ver logs
docker-compose logs -f postgres
docker-compose logs -f mongodb

# Conectar a PostgreSQL
docker exec -it medico_postgres psql -U admin -d medico_db

# Conectar a MongoDB
docker exec -it medico_mongodb mongosh -u admin -p admin123 --authenticationDatabase admin
```

---

**Última actualización:** 2025-01-27
