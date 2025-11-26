# Correcciones de Errores Doctor-Paciente

## Problemas Identificados

### 1. Error 500 al cargar datos del doctor
**Síntoma**: Al hacer login con el doctor "roberto", aparece el error:
```
Error al cargar datos del doctor: 500
```

**Causa**: El código en `db_connection.py` llamaba a `get_doctor_patients_sp()` (plural), pero el stored procedure que existía era `get_doctor_patient_sp()` (singular) y solo retornaba 1 paciente.

**Solución**: Se creó el stored procedure `get_doctor_patients_sp()` que retorna TODOS los pacientes asignados a un médico.

### 2. Error al cargar pacientes
**Síntoma**: 
```
Error al cargar pacientes
```

**Causa**: Mismo problema - el stored procedure faltaba.

**Solución**: Mismo stored procedure creado.

### 3. Problema de persistencia de vinculación
**Síntoma**: Cuando se vincula un paciente al doctor, funciona. Pero si se hace logout y luego login, el paciente ya no está vinculado.

**Causa**: La asignación actualiza correctamente el campo `id_medico_gen` en la tabla `PACIENTE`, pero el stored procedure para leer los pacientes no existía, por lo que no se podían recuperar.

**Solución**: Con el stored procedure `get_doctor_patients_sp()` ahora se pueden recuperar correctamente todos los pacientes vinculados.

### 4. Catálogo de médicos faltante
**Síntoma**: El catálogo de médicos no se cargaba correctamente.

**Causa**: El stored procedure `get_catalogos_sp()` no incluía la tabla `MEDICO`.

**Solución**: Se agregó `MEDICO` al stored procedure `get_catalogos_sp()`.

## Cambios Realizados

### 1. Nuevo Stored Procedure: `get_doctor_patients_sp()`

```sql
CREATE OR REPLACE FUNCTION get_doctor_patients_sp(doctor_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    nombre TEXT,
    fecha_nacimiento DATE,
    sexo VARCHAR(10),
    altura NUMERIC,
    peso NUMERIC,
    estilo_vida TEXT,
    alergias TEXT,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion TEXT,
    usuario_id INTEGER,
    id_tipo_sangre INTEGER,
    id_ocupacion INTEGER,
    id_estado_civil INTEGER,
    id_medico_gen INTEGER,
    tipo_sangre_id INTEGER,
    tipo_sangre_nombre VARCHAR(10),
    ocupacion_id INTEGER,
    ocupacion_nombre VARCHAR(100),
    estado_civil_id INTEGER,
    estado_civil_nombre VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, 
        p.nombre, 
        p.fecha_nacimiento, 
        p.sexo, 
        p.altura, 
        p.peso,
        p.estilo_vida::TEXT, 
        p.alergias::TEXT, 
        p.telefono::TEXT, 
        p.correo::TEXT, 
        p.direccion::TEXT,
        p.usuario_id,
        p.id_tipo_sangre,
        p.id_ocupacion,
        p.id_estado_civil,
        p.id_medico_gen,
        ts.id as tipo_sangre_id,
        ts.tipo as tipo_sangre_nombre,
        oc.id as ocupacion_id,
        oc.nombre as ocupacion_nombre,
        ec.id as estado_civil_id,
        ec.nombre as estado_civil_nombre
    FROM PACIENTE p
    LEFT JOIN TIPO_SANGRE ts ON p.id_tipo_sangre = ts.id
    LEFT JOIN OCUPACION oc ON p.id_ocupacion = oc.id
    LEFT JOIN ESTADO_CIVIL ec ON p.id_estado_civil = ec.id
    WHERE p.id_medico_gen = doctor_id
    ORDER BY p.nombre, p.id;
END;
$$ LANGUAGE plpgsql;
```

### 2. Actualización de `get_catalogos_sp()`

Se agregó el catálogo de médicos:

```sql
'MEDICO', (SELECT json_agg(row_to_json(t)) FROM (SELECT id, nombre FROM MEDICO ORDER BY id) t)
```

## Cómo Aplicar los Cambios

### Opción 1: Reiniciar el contenedor de PostgreSQL
Si estás usando Docker, los stored procedures se aplicarán automáticamente al reiniciar el contenedor:

```powershell
cd database
docker-compose down
docker-compose up -d
```

### Opción 2: Aplicar manualmente
Si necesitas aplicar los cambios sin reiniciar:

1. Conectarse a PostgreSQL:
```bash
docker exec -it avatar_completo-postgres-1 psql -U admin -d medico_db
```

2. Ejecutar el archivo de stored procedures:
```sql
\i /docker-entrypoint-initdb.d/stored_procedures.sql
```

O copiar y pegar el contenido del stored procedure directamente.

### Opción 3: Usar Python
Puedes crear un script Python que ejecute los stored procedures:

```python
import psycopg2
from pathlib import Path

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="medico_db",
    user="admin",
    password="admin123"
)

with conn.cursor() as cur:
    sql_file = Path("database/scripts/procedures/stored_procedures.sql")
    cur.execute(sql_file.read_text())
    conn.commit()

conn.close()
```

## Verificación

Después de aplicar los cambios, verifica que:

1. ✅ El login del doctor funciona sin errores 500
2. ✅ Los pacientes se cargan correctamente
3. ✅ La vinculación de pacientes persiste después de logout/login
4. ✅ El catálogo de médicos se muestra en los dropdowns

## Archivos Modificados

- `database/scripts/procedures/stored_procedures.sql`
  - Agregado: `get_doctor_patients_sp()`
  - Actualizado: `get_catalogos_sp()` para incluir `MEDICO`

## Notas

- El stored procedure `get_doctor_patient_sp()` (singular) sigue existiendo para compatibilidad, pero ahora también existe `get_doctor_patients_sp()` (plural) que retorna todos los pacientes.
- La relación doctor-paciente se almacena en el campo `id_medico_gen` de la tabla `PACIENTE`.
- Cuando se asigna un paciente, se actualiza `id_medico_gen` con el ID del médico.
- Cuando se desasigna, se establece `id_medico_gen` a NULL.

