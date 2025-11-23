-- ===========================================
-- SISTEMA MÉDICO - INICIALIZACIÓN POSTGRESQL
-- Esquema consolidado con datos de ejemplo
-- ===========================================

-- ===========================================
-- CREACIÓN DE TABLAS BASE Y CATÁLOGOS
-- ===========================================

CREATE TABLE ROL (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE DIRECCION (
    id SERIAL PRIMARY KEY,
    calle VARCHAR(150),
    numero_ext VARCHAR(20),
    numero_int VARCHAR(20),
    colonia VARCHAR(100),
    ciudad VARCHAR(100),
    estado VARCHAR(100),
    pais VARCHAR(100),
    codigo_postal VARCHAR(10)
);

CREATE TABLE ESPECIALIDAD (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE TIPO_SANGRE (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL
);

CREATE TABLE OCUPACION (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE ESTADO_CIVIL (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE ESTADO_CITA (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE TIPO_CITA (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE ESTADO_CONSULTA (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE ESTADO_CODIGO (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE ASEGURADORA (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    rfc VARCHAR(20),
    telefono VARCHAR(20),
    correo VARCHAR(100)
);

-- ===========================================
-- TABLAS DE USUARIOS Y ROLES
-- ===========================================

CREATE TABLE USUARIO (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    rol_id INT REFERENCES ROL(id) ON DELETE SET NULL
);

CREATE TABLE ADMINISTRADOR (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE REFERENCES USUARIO(id) ON DELETE CASCADE
);

CREATE TABLE MEDICO (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE REFERENCES USUARIO(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    cedula VARCHAR(50) NOT NULL,
    descripcion TEXT,
    id_especialidad INT REFERENCES ESPECIALIDAD(id) ON DELETE SET NULL,
    id_direccion INT REFERENCES DIRECCION(id) ON DELETE SET NULL,
    telefono VARCHAR(20),
    correo VARCHAR(150) UNIQUE,
    ubicacion TEXT
);

CREATE TABLE PACIENTE (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE REFERENCES USUARIO(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    fecha_nacimiento DATE,
    sexo VARCHAR(10),
    altura DECIMAL(5,2),
    peso DECIMAL(5,2),
    estilo_vida VARCHAR(100),
    alergias TEXT,
    id_tipo_sangre INT REFERENCES TIPO_SANGRE(id) ON DELETE SET NULL,
    id_direccion INT REFERENCES DIRECCION(id) ON DELETE SET NULL,
    id_ocupacion INT REFERENCES OCUPACION(id) ON DELETE SET NULL,
    id_estado_civil INT REFERENCES ESTADO_CIVIL(id) ON DELETE SET NULL,
    id_medico_gen INT REFERENCES MEDICO(id) ON DELETE SET NULL,
    telefono VARCHAR(20),
    correo VARCHAR(150) UNIQUE,
    direccion TEXT,
    ocupacion TEXT,
    nss VARCHAR(50)
);

-- ===========================================
-- CITAS Y CONSULTAS
-- ===========================================

CREATE TABLE CITA (
    id SERIAL PRIMARY KEY,
    paciente_id INT REFERENCES PACIENTE(id) ON DELETE CASCADE,
    medico_id INT REFERENCES MEDICO(id) ON DELETE CASCADE,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP,
    id_estado_cita INT REFERENCES ESTADO_CITA(id) ON DELETE SET NULL,
    id_tipo_cita INT REFERENCES TIPO_CITA(id) ON DELETE SET NULL
);

CREATE TABLE EPISODIO (
    id SERIAL PRIMARY KEY,
    id_paciente INT REFERENCES PACIENTE(id) ON DELETE CASCADE,
    fecha_inicio TIMESTAMP DEFAULT NOW(),
    fecha_fin TIMESTAMP,
    motivo TEXT
);

CREATE TABLE CONSULTA (
    id SERIAL PRIMARY KEY,
    cita_id INT REFERENCES CITA(id) ON DELETE CASCADE,
    id_estado_consulta INT REFERENCES ESTADO_CONSULTA(id) ON DELETE SET NULL,
    id_episodio INT REFERENCES EPISODIO(id) ON DELETE CASCADE,
    id_paciente INT REFERENCES PACIENTE(id) ON DELETE RESTRICT,
    id_medico INT REFERENCES MEDICO(id) ON DELETE RESTRICT,
    fecha_hora TIMESTAMP DEFAULT NOW(),
    narrativa TEXT,
    diagnostico_final TEXT,
    mongo_consulta_id VARCHAR(100)
);

-- ===========================================
-- DIAGNÓSTICOS, PLANES Y OBSERVACIONES
-- ===========================================

CREATE TABLE DIAGNOSTICO (
    id SERIAL PRIMARY KEY,
    id_episodio INT REFERENCES EPISODIO(id) ON DELETE CASCADE,
    codigo_icd10 VARCHAR(20),
    descripcion TEXT,
    es_principal BOOLEAN DEFAULT FALSE
);

CREATE TABLE PLAN_TRATAMIENTO (
    id SERIAL PRIMARY KEY,
    id_episodio INT REFERENCES EPISODIO(id) ON DELETE CASCADE,
    descripcion TEXT,
    objetivos TEXT
);

CREATE TABLE OBSERVACION_VITAL (
    id SERIAL PRIMARY KEY,
    id_consulta INT REFERENCES CONSULTA(id) ON DELETE CASCADE,
    tipo VARCHAR(100),
    valor VARCHAR(50),
    unidad VARCHAR(20)
);

-- ===========================================
-- MEDICACIÓN
-- ===========================================

CREATE TABLE MEDICACION_PRESCRIPCION (
    id SERIAL PRIMARY KEY,
    id_consulta INT REFERENCES CONSULTA(id) ON DELETE CASCADE,
    id_medicamento INT,
    dosis VARCHAR(50),
    frecuencia VARCHAR(50),
    duracion VARCHAR(50),
    via VARCHAR(50)
);

-- ===========================================
-- ARCHIVOS E INTERPRETACIONES
-- ===========================================

CREATE TABLE ARCHIVO (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50),
    url TEXT NOT NULL,
    hash_integridad VARCHAR(255),
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ARCHIVO_ASOCIACION (
    id SERIAL PRIMARY KEY,
    archivo_id INT REFERENCES ARCHIVO(id) ON DELETE CASCADE,
    entidad VARCHAR(50), -- 'PACIENTE', 'CONSULTA', 'EPISODIO'
    entidad_id INT,
    descripcion TEXT,
    creado_por_usuario_id INT,
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE INTERPRETACION_ARCHIVO (
    id SERIAL PRIMARY KEY,
    id_archivo INT REFERENCES ARCHIVO(id) ON DELETE CASCADE,
    id_medico INT REFERENCES MEDICO(id) ON DELETE SET NULL,
    id_consulta INT REFERENCES CONSULTA(id) ON DELETE SET NULL,
    fuente VARCHAR(100),
    resultado TEXT,
    fecha TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- PÓLIZAS
-- ===========================================

CREATE TABLE POLIZA (
    id SERIAL PRIMARY KEY,
    id_paciente INT REFERENCES PACIENTE(id) ON DELETE CASCADE,
    id_aseguradora INT REFERENCES ASEGURADORA(id) ON DELETE SET NULL,
    numero_poliza VARCHAR(50),
    vigente_desde DATE,
    vigente_hasta DATE
);

-- ===========================================
-- CÓDIGOS DE ACCESO Y NOTIFICACIONES
-- ===========================================

CREATE TABLE ACCESO_CODIGO (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL UNIQUE,
    id_usuario INT REFERENCES USUARIO(id) ON DELETE CASCADE,
    id_medico INT REFERENCES MEDICO(id) ON DELETE SET NULL,
    id_paciente INT REFERENCES PACIENTE(id) ON DELETE CASCADE,
    expira_en TIMESTAMP,
    usado_en TIMESTAMP,
    id_estado_codigo INT REFERENCES ESTADO_CODIGO(id) ON DELETE SET NULL
);

CREATE TABLE NOTIFICACION (
    id SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES USUARIO(id) ON DELETE CASCADE,
    id_cita INT REFERENCES CITA(id) ON DELETE SET NULL,
    mensaje TEXT,
    canal VARCHAR(50),
    fecha_envio TIMESTAMP DEFAULT NOW(),
    estado VARCHAR(50)
);

-- ===========================================
-- AUDITORÍA
-- ===========================================

CREATE TABLE AUDITORIA (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES USUARIO(id) ON DELETE SET NULL,
    accion VARCHAR(100),
    entidad VARCHAR(100),
    entidad_id INT,
    ip VARCHAR(45),
    origen VARCHAR(100),
    fecha_hora TIMESTAMP DEFAULT NOW(),
    detalle JSONB
);

-- ===========================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ===========================================

CREATE INDEX idx_medico_especialidad ON MEDICO(id_especialidad);
CREATE INDEX idx_cita_medico_fecha ON CITA(medico_id, fecha_inicio);
CREATE INDEX idx_cita_paciente_fecha ON CITA(paciente_id, fecha_inicio);
CREATE INDEX idx_consulta_paciente_fecha ON CONSULTA(id_paciente, fecha_hora DESC);
CREATE INDEX idx_consulta_medico_fecha ON CONSULTA(id_medico, fecha_hora DESC);
CREATE INDEX idx_episodio_paciente ON EPISODIO(id_paciente);
CREATE INDEX idx_archivo_asoc_entidad ON ARCHIVO_ASOCIACION(entidad, entidad_id);
CREATE INDEX idx_interaccion_ia_fecha ON AUDITORIA(fecha_hora DESC);

-- ===========================================
-- DATOS DE EJEMPLO
-- ===========================================

BEGIN;

-- ROLES
INSERT INTO ROL (id, nombre) VALUES
(1, 'Administrador'),
(2, 'Médico'),
(3, 'Paciente');

-- ESPECIALIDADES
INSERT INTO ESPECIALIDAD (id, nombre) VALUES
(1, 'Medicina Interna'),
(2, 'Cardiología'),
(3, 'Pediatría'),
(4, 'Ginecología'),
(5, 'Traumatología'),
(6, 'Dermatología'),
(7, 'Endocrinología'),
(8, 'Neurología'),
(9, 'Otorrinolaringología'),
(10, 'Gastroenterología'),
(11, 'Neumología'),
(12, 'Urología'),
(13, 'Oftalmología'),
(14, 'Psiquiatría'),
(15, 'Rehabilitación');

-- TIPOS DE SANGRE
INSERT INTO TIPO_SANGRE (id, tipo) VALUES
(1, 'A+'), (2, 'A-'), (3, 'B+'), (4, 'B-'),
(5, 'AB+'), (6, 'AB-'), (7, 'O+'), (8, 'O-');

-- OCUPACIONES
INSERT INTO OCUPACION (id, nombre) VALUES
(1, 'Estudiante'),
(2, 'Ingeniero'),
(3, 'Médico'),
(4, 'Abogado'),
(5, 'Contador'),
(6, 'Diseñador'),
(7, 'Docente'),
(8, 'Empresario');

-- ESTADOS CIVILES
INSERT INTO ESTADO_CIVIL (id, nombre) VALUES
(1, 'Soltero'),
(2, 'Casado'),
(3, 'Divorciado'),
(4, 'Viudo');

-- ESTADOS DE CITA
INSERT INTO ESTADO_CITA (id, nombre) VALUES
(1, 'Programada'),
(2, 'Confirmada'),
(3, 'En curso'),
(4, 'Completada'),
(5, 'Cancelada');

-- TIPOS DE CITA
INSERT INTO TIPO_CITA (id, nombre) VALUES
(1, 'General'),
(2, 'Urgencia'),
(3, 'Seguimiento'),
(4, 'Control');

-- ESTADOS DE CONSULTA
INSERT INTO ESTADO_CONSULTA (id, nombre) VALUES
(1, 'En curso'),
(2, 'Cerrada'),
(3, 'Cancelada');

-- ESTADOS DE CÓDIGO
INSERT INTO ESTADO_CODIGO (id, nombre) VALUES
(1, 'Emitido'),
(2, 'Usado'),
(3, 'Expirado'),
(4, 'Anulado');

-- ASEGURADORAS
INSERT INTO ASEGURADORA (id, nombre, telefono, correo) VALUES
(1, 'VidaSalud Seguros', '800 111 0001', 'contacto@vidasalud.mx'),
(2, 'ProtecSalud', '800 111 0002', 'contacto@protecsalud.mx'),
(3, 'SaludPlus', '800 111 0003', 'contacto@saludplus.mx'),
(4, 'MediCare MX', '800 111 0004', 'contacto@medicare.mx'),
(5, 'Seguros Integral', '800 111 0005', 'contacto@segurosintegral.mx');

-- MÉDICOS DE EJEMPLO
INSERT INTO MEDICO (id, nombre, cedula, id_especialidad, telefono, correo, ubicacion, descripcion) VALUES
(1, 'Dr. Cameron Cordara', 'MX12345001', 1, '+52 81 5555 1001', 'cameron.cordara@clinica.mx', 'Monterrey, NL', 'Internista enfocada en crónicos.'),
(2, 'Dra. Sofía Hernández', 'MX12345002', 1, '+52 81 5555 1002', 'sofia.hernandez@clinica.mx', 'Monterrey, NL', 'Internista con experiencia en diabetes.'),
(3, 'Dr. Luis Martínez', 'MX12345003', 2, '+52 55 5000 2211', 'luis.martinez@cardio.mx', 'CDMX', 'Cardiólogo clínico.');

-- PACIENTES DE EJEMPLO
INSERT INTO PACIENTE (id, nombre, fecha_nacimiento, sexo, altura, peso, estilo_vida, alergias, id_tipo_sangre, id_ocupacion, id_estado_civil, id_medico_gen, telefono, correo, direccion) VALUES
(1, 'Ana Betz', '1985-10-04', 'Femenino', 165.0, 58.5, 'Activo', 'Penicilina', 1, 2, 2, 1, '+52 81 5555 1234', 'ana.betz@example.com', 'Calle Salud #221, Monterrey'),
(2, 'Juan Pérez', '1980-05-15', 'Masculino', 175.0, 82.5, 'Activo', 'N/A', 7, 2, 2, 1, '+52 81 7777 3001', 'juan.perez@example.com', 'San Pedro, NL');

-- CONSULTAS DE EJEMPLO
INSERT INTO CONSULTA (id, id_paciente, id_medico, fecha_hora, narrativa, id_estado_consulta, diagnostico_final) VALUES
(1, 1, 1, NOW() - INTERVAL '5 days', 'Paciente refiere fiebre y mialgias de 48h. Signos vitales estables.', 2, 'Dengue clásico'),
(2, 1, 1, NOW() - INTERVAL '2 days', 'Control de seguimiento. Paciente evoluciona favorablemente.', 1, NULL);

COMMIT;

-- Alinear secuencias
SELECT setval(pg_get_serial_sequence('ROL','id'), (SELECT MAX(id) FROM ROL));
SELECT setval(pg_get_serial_sequence('ESPECIALIDAD','id'), (SELECT MAX(id) FROM ESPECIALIDAD));
SELECT setval(pg_get_serial_sequence('MEDICO','id'), (SELECT MAX(id) FROM MEDICO));
SELECT setval(pg_get_serial_sequence('PACIENTE','id'), (SELECT MAX(id) FROM PACIENTE));
SELECT setval(pg_get_serial_sequence('CONSULTA','id'), (SELECT MAX(id) FROM CONSULTA));

-- ===========================================
-- USUARIOS DE PRUEBA PARA LOGIN
-- ===========================================

-- Crear usuarios de prueba (pacientes y doctores) con login
DO $$
DECLARE
    v_usuario1_id INT;
    v_usuario2_id INT;
    v_usuario3_id INT;
    v_usuario4_id INT;
    v_paciente1_id INT;
    v_paciente2_id INT;
    v_doctor1_id INT;
    v_doctor2_id INT;
    v_archivo1_id INT;
    v_archivo2_id INT;
    v_archivo3_id INT;
    v_archivo4_id INT;
BEGIN
    -- ===========================================
    -- PACIENTE 1: Carlos Ramírez
    -- ===========================================
    
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('carlos_ramirez', 'carlos.ramirez@test.com', '+52 81 5555 1001', '$2b$12$cEbehSGO4Z02gpMv5JYHb.UqQIhlif3fWMfRr97bfVzL4C/XOhTqW', 3)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario1_id;
    
    IF v_usuario1_id IS NULL THEN
        SELECT id INTO v_usuario1_id FROM USUARIO WHERE correo = 'carlos.ramirez@test.com';
    END IF;

    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', 'sha256:carlos_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo1_id;
    
    IF v_archivo1_id IS NULL THEN
        SELECT id INTO v_archivo1_id FROM ARCHIVO WHERE hash_integridad = 'sha256:carlos_photo';
    END IF;

    INSERT INTO PACIENTE (
        usuario_id, nombre, fecha_nacimiento, sexo, altura, peso,
        estilo_vida, alergias, id_tipo_sangre, id_ocupacion, id_estado_civil,
        id_medico_gen, telefono, correo, direccion
    ) VALUES (
        v_usuario1_id,
        'Carlos Ramírez Martínez',
        '1988-03-20',
        'Masculino',
        175.0,
        78.5,
        'Activo',
        'Polen',
        7,  -- O+
        2,  -- Ingeniero
        2,  -- Casado
        1,  -- Dr. Cameron Cordara
        '+52 81 5555 1001',
        'carlos.ramirez@test.com',
        'Av. Revolución #456, Col. Centro, Monterrey, NL'
    )
    ON CONFLICT (correo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        fecha_nacimiento = EXCLUDED.fecha_nacimiento,
        sexo = EXCLUDED.sexo,
        altura = EXCLUDED.altura,
        peso = EXCLUDED.peso,
        estilo_vida = EXCLUDED.estilo_vida,
        alergias = EXCLUDED.alergias,
        id_tipo_sangre = EXCLUDED.id_tipo_sangre,
        id_ocupacion = EXCLUDED.id_ocupacion,
        id_estado_civil = EXCLUDED.id_estado_civil,
        id_medico_gen = EXCLUDED.id_medico_gen,
        telefono = EXCLUDED.telefono,
        direccion = EXCLUDED.direccion
    RETURNING id INTO v_paciente1_id;
    
    IF v_paciente1_id IS NULL THEN
        SELECT id INTO v_paciente1_id FROM PACIENTE WHERE correo = 'carlos.ramirez@test.com';
    END IF;

    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo1_id, 'PACIENTE', v_paciente1_id, 'Foto de perfil', v_usuario1_id)
    ON CONFLICT DO NOTHING;

    -- ===========================================
    -- PACIENTE 2: Laura Sánchez
    -- ===========================================
    
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('laura_sanchez', 'laura.sanchez@test.com', '+52 81 5555 1002', '$2b$12$cEbehSGO4Z02gpMv5JYHb.UqQIhlif3fWMfRr97bfVzL4C/XOhTqW', 3)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario2_id;
    
    IF v_usuario2_id IS NULL THEN
        SELECT id INTO v_usuario2_id FROM USUARIO WHERE correo = 'laura.sanchez@test.com';
    END IF;

    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', 'sha256:laura_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo2_id;
    
    IF v_archivo2_id IS NULL THEN
        SELECT id INTO v_archivo2_id FROM ARCHIVO WHERE hash_integridad = 'sha256:laura_photo';
    END IF;

    INSERT INTO PACIENTE (
        usuario_id, nombre, fecha_nacimiento, sexo, altura, peso,
        estilo_vida, alergias, id_tipo_sangre, id_ocupacion, id_estado_civil,
        id_medico_gen, telefono, correo, direccion
    ) VALUES (
        v_usuario2_id,
        'Laura Sánchez Torres',
        '1992-07-12',
        'Femenino',
        162.0,
        58.0,
        'Moderado',
        'Ninguna',
        1,  -- A+
        1,  -- Estudiante
        1,  -- Soltero
        1,  -- Dr. Cameron Cordara
        '+52 81 5555 1002',
        'laura.sanchez@test.com',
        'Calle Hidalgo #789, Col. San Pedro, Monterrey, NL'
    )
    ON CONFLICT (correo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        fecha_nacimiento = EXCLUDED.fecha_nacimiento,
        sexo = EXCLUDED.sexo,
        altura = EXCLUDED.altura,
        peso = EXCLUDED.peso,
        estilo_vida = EXCLUDED.estilo_vida,
        alergias = EXCLUDED.alergias,
        id_tipo_sangre = EXCLUDED.id_tipo_sangre,
        id_ocupacion = EXCLUDED.id_ocupacion,
        id_estado_civil = EXCLUDED.id_estado_civil,
        id_medico_gen = EXCLUDED.id_medico_gen,
        telefono = EXCLUDED.telefono,
        direccion = EXCLUDED.direccion
    RETURNING id INTO v_paciente2_id;
    
    IF v_paciente2_id IS NULL THEN
        SELECT id INTO v_paciente2_id FROM PACIENTE WHERE correo = 'laura.sanchez@test.com';
    END IF;

    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo2_id, 'PACIENTE', v_paciente2_id, 'Foto de perfil', v_usuario2_id)
    ON CONFLICT DO NOTHING;

    -- ===========================================
    -- DOCTOR 1: Dr. Roberto Mendoza
    -- ===========================================
    
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('dr_roberto', 'roberto.mendoza@clinica.mx', '+52 81 5555 2001', '$2b$12$cEbehSGO4Z02gpMv5JYHb.UqQIhlif3fWMfRr97bfVzL4C/XOhTqW', 2)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario3_id;
    
    IF v_usuario3_id IS NULL THEN
        SELECT id INTO v_usuario3_id FROM USUARIO WHERE correo = 'roberto.mendoza@clinica.mx';
    END IF;

    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop', 'sha256:roberto_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo3_id;
    
    IF v_archivo3_id IS NULL THEN
        SELECT id INTO v_archivo3_id FROM ARCHIVO WHERE hash_integridad = 'sha256:roberto_photo';
    END IF;

    INSERT INTO MEDICO (
        usuario_id, nombre, cedula, descripcion, id_especialidad,
        telefono, correo, ubicacion
    ) VALUES (
        v_usuario3_id,
        'Dr. Roberto Mendoza García',
        'MX12345004',
        'Cardiólogo con más de 15 años de experiencia. Especializado en enfermedades cardiovasculares, hipertensión arterial y arritmias. Miembro de la Sociedad Mexicana de Cardiología.',
        2,  -- Cardiología
        '+52 81 5555 2001',
        'roberto.mendoza@clinica.mx',
        'Consultorio 301, Torre Médica, Monterrey, NL'
    )
    ON CONFLICT (correo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        cedula = EXCLUDED.cedula,
        descripcion = EXCLUDED.descripcion,
        id_especialidad = EXCLUDED.id_especialidad,
        telefono = EXCLUDED.telefono,
        ubicacion = EXCLUDED.ubicacion
    RETURNING id INTO v_doctor1_id;
    
    IF v_doctor1_id IS NULL THEN
        SELECT id INTO v_doctor1_id FROM MEDICO WHERE correo = 'roberto.mendoza@clinica.mx';
    END IF;

    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo3_id, 'MEDICO', v_doctor1_id, 'Foto de perfil', v_usuario3_id)
    ON CONFLICT DO NOTHING;

    -- ===========================================
    -- DOCTOR 2: Dra. Patricia López
    -- ===========================================
    
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('dra_patricia', 'patricia.lopez@clinica.mx', '+52 81 5555 2002', '$2b$12$cEbehSGO4Z02gpMv5JYHb.UqQIhlif3fWMfRr97bfVzL4C/XOhTqW', 2)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario4_id;
    
    IF v_usuario4_id IS NULL THEN
        SELECT id INTO v_usuario4_id FROM USUARIO WHERE correo = 'patricia.lopez@clinica.mx';
    END IF;

    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop', 'sha256:patricia_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo4_id;
    
    IF v_archivo4_id IS NULL THEN
        SELECT id INTO v_archivo4_id FROM ARCHIVO WHERE hash_integridad = 'sha256:patricia_photo';
    END IF;

    INSERT INTO MEDICO (
        usuario_id, nombre, cedula, descripcion, id_especialidad,
        telefono, correo, ubicacion
    ) VALUES (
        v_usuario4_id,
        'Dra. Patricia López Hernández',
        'MX12345005',
        'Pediatra especializada en atención integral del niño y adolescente. Más de 12 años de experiencia en diagnóstico y tratamiento de enfermedades pediátricas. Certificada por el Consejo Mexicano de Pediatría.',
        3,  -- Pediatría
        '+52 81 5555 2002',
        'patricia.lopez@clinica.mx',
        'Consultorio 205, Edificio Médico, San Pedro, NL'
    )
    ON CONFLICT (correo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        cedula = EXCLUDED.cedula,
        descripcion = EXCLUDED.descripcion,
        id_especialidad = EXCLUDED.id_especialidad,
        telefono = EXCLUDED.telefono,
        ubicacion = EXCLUDED.ubicacion
    RETURNING id INTO v_doctor2_id;
    
    IF v_doctor2_id IS NULL THEN
        SELECT id INTO v_doctor2_id FROM MEDICO WHERE correo = 'patricia.lopez@clinica.mx';
    END IF;

    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo4_id, 'MEDICO', v_doctor2_id, 'Foto de perfil', v_usuario4_id)
    ON CONFLICT DO NOTHING;

END $$;

