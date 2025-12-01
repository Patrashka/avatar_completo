# Crear Paciente de Prueba con Datos Faltantes

Este script crea un paciente de prueba con datos faltantes para probar el modal de datos faltantes en el frontend.

## Opción 1: Usar el script Python (Recomendado)

### Requisitos
- Python 3.x
- psycopg2 instalado: `pip install psycopg2-binary`
- Variables de entorno configuradas en `backend/.env`:
  - `DB_HOST` (default: localhost)
  - `DB_PORT` (default: 5432)
  - `DB_NAME` (default: medico_db)
  - `DB_USER` (default: postgres)
  - `DB_PASSWORD` (tu contraseña de PostgreSQL)

### Ejecutar
```bash
cd backend
python create_test_patient.py
```

## Opción 2: Usar el script SQL directamente

### Ejecutar en PostgreSQL
```bash
psql -h localhost -U postgres -d medico_db -f database/scripts/data/insert_test_patient_incomplete.sql
```

O desde psql:
```sql
\i database/scripts/data/insert_test_patient_incomplete.sql
```

## Credenciales del paciente de prueba

- **Correo**: `paciente.prueba@test.com`
- **Username**: `paciente_prueba`
- **Password**: (usar el mismo hash que otros usuarios de prueba)
- **Rol**: Paciente (3)

## Qué hace el script

1. Verifica si existe la columna `apellido` en la tabla `PACIENTE` y la agrega si no existe
2. Crea un usuario con datos mínimos
3. Crea un paciente con solo `usuario_id`, `nombre` (vacío), y `correo`
4. Limpia todos los demás campos (apellido, fecha_nacimiento, sexo, altura, peso, etc.)
5. Esto fuerza que el modal de datos faltantes aparezca al iniciar sesión

## Verificar que funcionó

Después de ejecutar el script, puedes verificar en PostgreSQL:

```sql
SELECT 
    id, nombre, apellido, fecha_nacimiento, sexo,
    altura, peso, id_tipo_sangre, id_ocupacion, id_estado_civil
FROM PACIENTE
WHERE correo = 'paciente.prueba@test.com';
```

Todos los campos deberían estar NULL o vacíos excepto `id` y `correo`.

## Probar en el frontend

1. Inicia sesión con el correo `paciente.prueba@test.com`
2. El modal de datos faltantes debería aparecer automáticamente
3. Completa los campos que desees
4. Guarda los datos
5. El modal no debería aparecer de nuevo si todos los campos están completos

