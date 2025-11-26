# Resumen de Consolidación de Directorios de Base de Datos

## ✅ Consolidación Completada

Los **3 directorios de base de datos** han sido consolidados en un solo directorio organizado: `avatar_completo/database/`

### Directorios Consolidados

1. ✅ `avatar_completo/database` - Directorio principal (mantenido y organizado)
2. ✅ `avatar_completo/medico-db` - Archivos consolidados (puede eliminarse)
3. ✅ `cms_main/cms_db` - Archivos consolidados (ver README_CONSOLIDATION.md)

## 📁 Nueva Estructura Organizada

```
database/
├── docker-compose.yml              # Configuración Docker consolidada
├── README.md                       # Documentación principal
├── CONSOLIDATION_SUMMARY.md        # Este archivo
│
├── scripts/
│   ├── init/                      # Scripts de inicialización
│   │   ├── init-postgres.sql      # Esquema PostgreSQL
│   │   └── init-mongo.js          # Inicialización MongoDB
│   ├── procedures/                # Stored Procedures
│   │   └── stored_procedures.sql  # Todos los SP con sufijo _sp
│   └── data/                      # Datos de prueba
│       ├── insert_patient.sql
│       ├── insert_test_doctors.sql
│       └── insert_test_profiles.sql
│
├── migrations/                     # Scripts de migración
│   ├── migrate-to-correct-schema.sql
│   └── update_database.sql
│
├── tests/                         # Scripts de prueba
│   ├── test_connections.py
│   ├── test_services_health.py
│   └── verificar_bd.py
│
├── docs/                          # Documentación
│   ├── README.md
│   ├── DATABASE_SHARED_CONFIG.md
│   ├── VERIFICATION_REPORT.md
│   ├── MIGRATION_TO_SP_SUFFIX.md
│   └── VERIFICACION_BD.md
│
└── utils/                         # Utilidades
    ├── show_credentials.py
    ├── verify_all_services.ps1
    └── verify_shared_db.ps1
```

## 🔄 Cambios Realizados

### 1. Organización de Archivos
- ✅ Scripts de inicialización → `scripts/init/`
- ✅ Stored procedures → `scripts/procedures/`
- ✅ Datos de prueba → `scripts/data/`
- ✅ Migraciones → `migrations/`
- ✅ Tests → `tests/`
- ✅ Documentación → `docs/`
- ✅ Utilidades → `utils/`

### 2. Actualización de docker-compose.yml
- ✅ Rutas actualizadas para apuntar a la nueva estructura
- ✅ Comentarios agregados sobre la consolidación

### 3. Archivos Consolidados
- ✅ `stored_procedures.sql` - Versión actualizada con sufijo `_sp`
- ✅ `init-postgres.sql` - Esquema principal
- ✅ `init-mongo.js` - Inicialización MongoDB
- ✅ Scripts de migración del CMS
- ✅ Documentación consolidada

### 4. Archivos Eliminados
- ✅ `create_procedures.sql` (duplicado, se mantiene `stored_procedures.sql`)

## 📝 Notas sobre Directorios Antiguos

### `avatar_completo/medico-db/`
- Contiene un esquema diferente (más antiguo)
- **Puede eliminarse** si no se necesita
- Si se necesita, el archivo `init.sql` puede moverse a `migrations/` como referencia histórica

### `cms_main/cms_db/`
- Se creó `README_CONSOLIDATION.md` explicando la consolidación
- El CMS puede usar el directorio consolidado en `avatar_completo/database/`
- O actualizar las rutas en su `docker-compose.yml` para apuntar al directorio consolidado

## 🚀 Uso

### Iniciar Base de Datos

```bash
cd avatar_completo/database
docker-compose up -d
```

### Para el CMS

El CMS puede usar el mismo directorio:

```bash
# Opción 1: Desde el directorio consolidado
cd ../../avatar_completo/database
docker-compose up -d

# Opción 2: Actualizar rutas en cms_db/docker-compose.yml
# para apuntar a: ../../avatar_completo/database/scripts/...
```

## ✅ Verificación

Para verificar que todo está correcto:

```bash
cd database
.\utils\verify_shared_db.ps1
```

## 📚 Documentación

- `README.md` - Guía principal de uso
- `docs/DATABASE_SHARED_CONFIG.md` - Configuración compartida
- `docs/VERIFICATION_REPORT.md` - Reporte de verificación

## 🎯 Beneficios de la Consolidación

1. ✅ **Un solo punto de verdad** - Todos los archivos de BD en un lugar
2. ✅ **Organización clara** - Fácil encontrar lo que necesitas
3. ✅ **Mantenimiento simplificado** - Un solo lugar para actualizar
4. ✅ **Consistencia** - Misma configuración para todos los proyectos
5. ✅ **Documentación centralizada** - Toda la info en un lugar

