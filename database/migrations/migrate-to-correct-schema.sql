-- ============================================
-- MIGRATION: Update Docker DB to match cms_back/sql/schema.sql
-- ============================================

-- 1. Add missing columns to USUARIO table
ALTER TABLE USUARIO ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE USUARIO ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);
ALTER TABLE USUARIO ADD COLUMN IF NOT EXISTS apellido VARCHAR(100);

-- 2. Populate nombre and apellido from existing data
-- For MEDICO users, get name from MEDICO table
UPDATE USUARIO u
SET nombre = SPLIT_PART(m.nombre, ' ', 1),
    apellido = COALESCE(NULLIF(SPLIT_PART(m.nombre, ' ', 2), ''), 'N/A')
FROM MEDICO m
WHERE u.id = m.usuario_id AND u.nombre IS NULL;

-- For PACIENTE users, get name from PACIENTE table if it exists
UPDATE USUARIO u
SET nombre = SPLIT_PART(p.nombre, ' ', 1),
    apellido = COALESCE(NULLIF(SPLIT_PART(p.nombre, ' ', 2), ''), 'N/A')
FROM PACIENTE p
WHERE u.id = p.usuario_id AND u.nombre IS NULL AND p.nombre IS NOT NULL;

-- For remaining users, use username
UPDATE USUARIO 
SET nombre = SPLIT_PART(username, ' ', 1),
    apellido = COALESCE(NULLIF(SPLIT_PART(username, ' ', 2), ''), 'N/A')
WHERE nombre IS NULL;

-- 3. Update ROL table to add UNIQUE constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rol_nombre_key'
    ) THEN
        ALTER TABLE ROL ADD CONSTRAINT rol_nombre_key UNIQUE (nombre);
    END IF;
END $$;

-- 4. Update USUARIO constraints
ALTER TABLE USUARIO ALTER COLUMN rol_id SET NOT NULL;
ALTER TABLE USUARIO ALTER COLUMN rol_id DROP DEFAULT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'usuario_rol_id_fkey' 
        AND conrelid = 'usuario'::regclass
    ) THEN
        ALTER TABLE USUARIO DROP CONSTRAINT IF EXISTS usuario_rol_id_fkey;
        ALTER TABLE USUARIO ADD CONSTRAINT usuario_rol_id_fkey 
            FOREIGN KEY (rol_id) REFERENCES ROL(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- 5. Create missing geography tables if they don't exist
CREATE TABLE IF NOT EXISTS PAIS (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ESTADO (
    id SERIAL PRIMARY KEY,
    pais_id INT NOT NULL REFERENCES PAIS(id),
    nombre VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS CIUDAD (
    id SERIAL PRIMARY KEY,
    estado_id INT NOT NULL REFERENCES ESTADO(id),
    nombre VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS COLONIA (
    id SERIAL PRIMARY KEY,
    ciudad_id INT NOT NULL REFERENCES CIUDAD(id),
    nombre VARCHAR(120) NOT NULL,
    codigo_postal VARCHAR(12)
);

-- 6. Create new address tables if they don't exist
CREATE TABLE IF NOT EXISTS DIRECCION_PACIENTE (
    id SERIAL PRIMARY KEY,
    paciente_id INT NOT NULL REFERENCES PACIENTE(id) ON DELETE CASCADE,
    calle VARCHAR(200),
    numero_ext VARCHAR(30),
    numero_int VARCHAR(30),
    id_colonia INT NOT NULL REFERENCES COLONIA(id)
);

CREATE TABLE IF NOT EXISTS CLINICA (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    telefono VARCHAR(30),
    correo VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS DIRECCION_CLINICA (
    id SERIAL PRIMARY KEY,
    clinica_id INT NOT NULL REFERENCES CLINICA(id) ON DELETE CASCADE,
    calle VARCHAR(200),
    numero_ext VARCHAR(30),
    numero_int VARCHAR(30),
    id_colonia INT NOT NULL REFERENCES COLONIA(id)
);

CREATE TABLE IF NOT EXISTS CONSULTORIO (
    id SERIAL PRIMARY KEY,
    clinica_id INT NOT NULL REFERENCES CLINICA(id) ON DELETE CASCADE,
    nombre_numero VARCHAR(120),
    piso_zona VARCHAR(60)
);

-- 7. Add missing columns to MEDICO if they don't exist
ALTER TABLE MEDICO ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE MEDICO ADD COLUMN IF NOT EXISTS foto_archivo_id INT;

-- 8. Add missing columns to PACIENTE if they don't exist
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS sexo VARCHAR(20);
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS altura NUMERIC(5,2);
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS peso NUMERIC(6,2);
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS estilo_vida VARCHAR(120);
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS id_tipo_sangre INT REFERENCES TIPO_SANGRE(id) ON DELETE SET NULL;
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS id_ocupacion INT REFERENCES OCUPACION(id) ON DELETE SET NULL;
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS id_estado_civil INT REFERENCES ESTADO_CIVIL(id) ON DELETE SET NULL;
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS id_medico_gen INT REFERENCES MEDICO(id) ON DELETE SET NULL;
ALTER TABLE PACIENTE ADD COLUMN IF NOT EXISTS foto_archivo_id INT;

-- 9. Create SESION_AVATAR table if it doesn't exist
CREATE TABLE IF NOT EXISTS SESION_AVATAR (
    id SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES USUARIO(id),
    id_paciente INT REFERENCES PACIENTE(id),
    id_medico INT REFERENCES MEDICO(id),
    fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ
);

-- 10. Add missing columns to CITA if needed
ALTER TABLE CITA ADD COLUMN IF NOT EXISTS id_consultorio INT REFERENCES CONSULTORIO(id);

-- 11. Add missing columns to ARCHIVO if needed
ALTER TABLE ARCHIVO ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();

-- 12. Insert default geography data if tables are empty
INSERT INTO PAIS (nombre) VALUES ('México') ON CONFLICT DO NOTHING;
INSERT INTO ESTADO (pais_id, nombre) 
SELECT 1, 'Nuevo León' WHERE NOT EXISTS (SELECT 1 FROM ESTADO WHERE nombre = 'Nuevo León');
INSERT INTO CIUDAD (estado_id, nombre) 
SELECT 1, 'Monterrey' WHERE NOT EXISTS (SELECT 1 FROM CIUDAD WHERE nombre = 'Monterrey');
INSERT INTO COLONIA (ciudad_id, nombre, codigo_postal) 
SELECT 1, 'Centro', '64000' WHERE NOT EXISTS (SELECT 1 FROM COLONIA WHERE nombre = 'Centro');

-- 13. Insert default clinic if CLINICA table is empty
INSERT INTO CLINICA (nombre, telefono, correo) 
SELECT 'Clínica Principal', '8112345678', 'contacto@clinica.com'
WHERE NOT EXISTS (SELECT 1 FROM CLINICA);

-- 14. Insert default consultorio if CONSULTORIO table is empty
INSERT INTO CONSULTORIO (clinica_id, nombre_numero, piso_zona) 
SELECT 1, 'Consultorio 1', 'Planta Baja'
WHERE NOT EXISTS (SELECT 1 FROM CONSULTORIO);

-- 15. Add comments for documentation
COMMENT ON COLUMN USUARIO.nombre IS 'First name of the user';
COMMENT ON COLUMN USUARIO.apellido IS 'Last name of the user';
COMMENT ON COLUMN USUARIO.creado_en IS 'Timestamp when user was created';

-- Done!
SELECT 'Migration completed successfully!' as status;





