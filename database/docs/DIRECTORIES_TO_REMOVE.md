# Directorios que Pueden Eliminarse

## ✅ Directorios Seguros para Eliminar

### 1. `BDv2_Medical/`

**Contenido:**
- `postgresMedical.sql` - Esquema PostgreSQL anterior (31 tablas)
- `mongoMecical.sql` - Esquema MongoDB anterior

**Análisis:**
- ✅ **No hay referencias en el código** - No se usa en ningún lugar
- ✅ **Esquema anterior** - El esquema actual en `database/scripts/init/init-postgres.sql` es más completo y actualizado (29 tablas vs 31, pero con mejor estructura)
- ✅ **Reemplazado** - El esquema actual es la versión mejorada

**Recomendación:** ✅ **SE PUEDE ELIMINAR**

Si necesitas el esquema anterior como referencia histórica, puedes copiarlo a `database/migrations/` antes de eliminarlo.

---

### 2. `medico-db/`

**Contenido:**
- `init.sql` - Esquema PostgreSQL muy antiguo (9 tablas, nombres en minúsculas)
- `docker-compose.yml` - Configuración Docker antigua

**Análisis:**
- ✅ **No hay referencias en el código** - No se usa en ningún lugar
- ✅ **Esquema legacy** - Usa un esquema completamente diferente (nombres en minúsculas: `medicos`, `pacientes` vs `MEDICO`, `PACIENTE`)
- ✅ **Ya guardado como referencia** - El esquema está guardado en `database/migrations/legacy_schema_reference.sql`
- ✅ **Reemplazado** - El esquema actual es el estándar

**Recomendación:** ✅ **SE PUEDE ELIMINAR**

El esquema ya está guardado como referencia histórica en `database/migrations/legacy_schema_reference.sql`.

---

## 📊 Comparación de Esquemas

| Directorio | Tablas | Estado | Uso Actual |
|------------|--------|--------|------------|
| `BDv2_Medical/postgresMedical.sql` | 31 | Antiguo | ❌ No usado |
| `medico-db/init.sql` | 9 | Legacy | ❌ No usado |
| `database/scripts/init/init-postgres.sql` | 29 | **Actual** | ✅ **En uso** |

## 🗑️ Comandos para Eliminar

### Opción 1: Eliminar directamente

```powershell
# Desde avatar_completo/
Remove-Item -Path "BDv2_Medical" -Recurse -Force
Remove-Item -Path "medico-db" -Recurse -Force
```

### Opción 2: Mover a backup primero (Recomendado)

```powershell
# Crear backup
New-Item -ItemType Directory -Path "backup_old_schemas" -Force
Move-Item -Path "BDv2_Medical" -Destination "backup_old_schemas\" -Force
Move-Item -Path "medico-db" -Destination "backup_old_schemas\" -Force
```

## ✅ Verificación Post-Eliminación

Después de eliminar, verifica que todo sigue funcionando:

```bash
cd database
docker-compose up -d
.\utils\verify_shared_db.ps1
```

## 📝 Notas

- El esquema actual (`database/scripts/init/init-postgres.sql`) es el único que se usa
- El esquema de `medico-db` ya está guardado como referencia en `migrations/legacy_schema_reference.sql`
- Si necesitas el esquema de `BDv2_Medical` como referencia, cópialo a `migrations/` antes de eliminar

