-- ===========================================
-- CREACIÓN DE TABLAS BASE
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
    cedula VARCHAR(50) NOT NULL,
    descripcion TEXT,
    id_especialidad INT REFERENCES ESPECIALIDAD(id) ON DELETE SET NULL,
    id_direccion INT REFERENCES DIRECCION(id) ON DELETE SET NULL
);

CREATE TABLE PACIENTE (
    id SERIAL PRIMARY KEY,
    usuario_id INT UNIQUE REFERENCES USUARIO(id) ON DELETE CASCADE,
    fecha_nacimiento DATE,
    sexo VARCHAR(10),
    altura DECIMAL(5,2),
    peso DECIMAL(5,2),
    estilo_vida VARCHAR(100),
    id_tipo_sangre INT REFERENCES TIPO_SANGRE(id) ON DELETE SET NULL,
    id_direccion INT REFERENCES DIRECCION(id) ON DELETE SET NULL,
    id_ocupacion INT REFERENCES OCUPACION(id) ON DELETE SET NULL,
    id_estado_civil INT REFERENCES ESTADO_CIVIL(id) ON DELETE SET NULL,
    id_medico_gen INT REFERENCES MEDICO(id) ON DELETE SET NULL
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
    fecha_hora TIMESTAMP DEFAULT NOW(),
    narrativa TEXT,
    mongo_consulta_id VARCHAR(100)
);

-- ===========================================
-- DIAGNÓSTICOS, PLANES Y OBSERVACIONES
-- ===========================================

CREATE TABLE DIAGNOSTICO (
    id SERIAL PRIMARY KEY,
    id_episodio INT REFERENCES EPISODIO(id) ON DELETE CASCADE,
    id_icd10 INT,
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

CREATE TABLE MEDICACION_ADMINISTRACION (
    id SERIAL PRIMARY KEY,
    id_prescripcion INT REFERENCES MEDICACION_PRESCRIPCION(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMP DEFAULT NOW(),
    observaciones TEXT
);

-- ===========================================
-- ARCHIVOS E INTERPRETACIONES
-- ===========================================

CREATE TABLE ARCHIVO (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50),
    url TEXT NOT NULL,
    hash_integridad VARCHAR(255)
);

CREATE TABLE ESTUDIO_IMAGEN (
    id SERIAL PRIMARY KEY,
    id_consulta INT REFERENCES CONSULTA(id) ON DELETE CASCADE,
    id_archivo INT REFERENCES ARCHIVO(id) ON DELETE CASCADE
);

CREATE TABLE REPORTE_LABORATORIO (
    id SERIAL PRIMARY KEY,
    id_consulta INT REFERENCES CONSULTA(id) ON DELETE CASCADE,
    id_archivo INT REFERENCES ARCHIVO(id) ON DELETE CASCADE,
    fecha_resultado TIMESTAMP
);

CREATE TABLE INTERPRETACION_ARCHIVO (
    id SERIAL PRIMARY KEY,
    id_archivo INT REFERENCES ARCHIVO(id) ON DELETE CASCADE,
    fuente VARCHAR(100),
    resultado TEXT,
    fecha TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- ASEGURADORAS Y PÓLIZAS
-- ===========================================

CREATE TABLE ASEGURADORA (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    rfc VARCHAR(20),
    telefono VARCHAR(20),
    correo VARCHAR(100)
);

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
    codigo VARCHAR(100) NOT NULL,
    id_usuario INT REFERENCES USUARIO(id) ON DELETE CASCADE,
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
