-- Stored Procedures simplificados
CREATE OR REPLACE FUNCTION get_patient_by_id_sp(patient_id INTEGER)
RETURNS TABLE (
    id INTEGER, nombre TEXT, fecha_nacimiento DATE, sexo VARCHAR(10),
    altura NUMERIC, peso NUMERIC, estilo_vida TEXT, alergias TEXT,
    telefono VARCHAR(20), correo VARCHAR(100), direccion TEXT,
    usuario_id INTEGER, id_tipo_sangre INTEGER, id_ocupacion INTEGER,
    id_estado_civil INTEGER, id_medico_gen INTEGER,
    tipo_sangre_id INTEGER, tipo_sangre_nombre VARCHAR(10),
    ocupacion_id INTEGER, ocupacion_nombre VARCHAR(100),
    estado_civil_id INTEGER, estado_civil_nombre VARCHAR(50),
    medico_id INTEGER, medico_nombre TEXT
) AS $func$
BEGIN
    RETURN QUERY
    SELECT p.id, p.nombre::TEXT, p.fecha_nacimiento, p.sexo, p.altura, p.peso,
           p.estilo_vida::TEXT, p.alergias::TEXT, p.telefono, p.correo, p.direccion::TEXT,
           p.usuario_id, p.id_tipo_sangre, p.id_ocupacion, p.id_estado_civil,
           p.id_medico_gen, ts.id, ts.tipo, oc.id, oc.nombre, ec.id, ec.nombre,
           m.id, m.nombre::TEXT
    FROM PACIENTE p
    LEFT JOIN TIPO_SANGRE ts ON p.id_tipo_sangre = ts.id
    LEFT JOIN OCUPACION oc ON p.id_ocupacion = oc.id
    LEFT JOIN ESTADO_CIVIL ec ON p.id_estado_civil = ec.id
    LEFT JOIN MEDICO m ON p.id_medico_gen = m.id
    WHERE p.id = patient_id;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_patient_consultations_sp(patient_id INTEGER, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id INTEGER, fecha_hora TIMESTAMP, narrativa TEXT, diagnostico_final TEXT,
    medico_nombre TEXT, estado_consulta VARCHAR(50), mongo_consulta_id VARCHAR(100),
    cita_id INTEGER, id_estado_consulta INTEGER, id_episodio INTEGER
) AS $func$
BEGIN
    RETURN QUERY
    SELECT c.id, c.fecha_hora, c.narrativa::TEXT, c.diagnostico_final::TEXT,
           m.nombre::TEXT, ec.nombre, c.mongo_consulta_id,
           c.cita_id, c.id_estado_consulta, c.id_episodio
    FROM CONSULTA c
    LEFT JOIN MEDICO m ON c.id_medico = m.id
    LEFT JOIN ESTADO_CONSULTA ec ON c.id_estado_consulta = ec.id
    WHERE c.id_paciente = patient_id
    ORDER BY c.fecha_hora DESC LIMIT limit_count;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_patient_files_sp(patient_id INTEGER)
RETURNS TABLE (
    id INTEGER, tipo VARCHAR(50), url TEXT, hash_integridad VARCHAR(255),
    creado_en TIMESTAMP, descripcion TEXT, entidad VARCHAR(50), entidad_id INTEGER
) AS $func$
BEGIN
    RETURN QUERY
    SELECT a.id, a.tipo, a.url, a.hash_integridad, a.creado_en,
           aa.descripcion, aa.entidad, aa.entidad_id
    FROM ARCHIVO a
    INNER JOIN ARCHIVO_ASOCIACION aa ON a.id = aa.archivo_id
    WHERE aa.entidad = 'PACIENTE' AND aa.entidad_id = patient_id
    ORDER BY a.creado_en DESC;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_patient_diagnoses_sp(patient_id INTEGER)
RETURNS TABLE (
    id INTEGER, codigo_icd10 VARCHAR(20), descripcion TEXT, es_principal BOOLEAN,
    id_episodio INTEGER, fecha_diagnostico DATE, motivo TEXT
) AS $func$
BEGIN
    RETURN QUERY
    SELECT d.id, d.codigo_icd10, d.descripcion::TEXT, d.es_principal,
           d.id_episodio, e.fecha_inicio::DATE, e.motivo::TEXT
    FROM DIAGNOSTICO d
    JOIN EPISODIO e ON d.id_episodio = e.id
    WHERE e.id_paciente = patient_id
    ORDER BY d.es_principal DESC, e.fecha_inicio DESC;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_doctor_patient_sp(doctor_id INTEGER)
RETURNS TABLE (
    id INTEGER, nombre TEXT, fecha_nacimiento DATE, sexo VARCHAR(10),
    altura NUMERIC, peso NUMERIC, estilo_vida TEXT, alergias TEXT,
    telefono VARCHAR(20), correo VARCHAR(100), direccion TEXT,
    usuario_id INTEGER, id_tipo_sangre INTEGER, id_ocupacion INTEGER,
    id_estado_civil INTEGER, id_medico_gen INTEGER,
    tipo_sangre_id INTEGER, tipo_sangre_nombre VARCHAR(10),
    ocupacion_id INTEGER, ocupacion_nombre VARCHAR(100),
    estado_civil_id INTEGER, estado_civil_nombre VARCHAR(50)
) AS $func$
BEGIN
    RETURN QUERY
    SELECT p.id, p.nombre::TEXT, p.fecha_nacimiento, p.sexo, p.altura, p.peso,
           p.estilo_vida::TEXT, p.alergias::TEXT, p.telefono, p.correo, p.direccion::TEXT,
           p.usuario_id, p.id_tipo_sangre, p.id_ocupacion, p.id_estado_civil,
           p.id_medico_gen, ts.id, ts.tipo, oc.id, oc.nombre, ec.id, ec.nombre
    FROM PACIENTE p
    LEFT JOIN TIPO_SANGRE ts ON p.id_tipo_sangre = ts.id
    LEFT JOIN OCUPACION oc ON p.id_ocupacion = oc.id
    LEFT JOIN ESTADO_CIVIL ec ON p.id_estado_civil = ec.id
    WHERE p.id_medico_gen = doctor_id
    ORDER BY p.id LIMIT 1;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_doctor_patients_sp(doctor_id INTEGER)
RETURNS TABLE (
    id INTEGER, nombre TEXT, fecha_nacimiento DATE, sexo VARCHAR(10),
    altura NUMERIC, peso NUMERIC, estilo_vida TEXT, alergias TEXT,
    telefono VARCHAR(20), correo VARCHAR(100), direccion TEXT,
    usuario_id INTEGER, id_tipo_sangre INTEGER, id_ocupacion INTEGER,
    id_estado_civil INTEGER, id_medico_gen INTEGER,
    tipo_sangre_id INTEGER, tipo_sangre_nombre VARCHAR(10),
    ocupacion_id INTEGER, ocupacion_nombre VARCHAR(100),
    estado_civil_id INTEGER, estado_civil_nombre VARCHAR(50)
) AS $func$
BEGIN
    RETURN QUERY
    SELECT p.id, p.nombre::TEXT, p.fecha_nacimiento, p.sexo, p.altura, p.peso,
           p.estilo_vida::TEXT, p.alergias::TEXT, p.telefono, p.correo, p.direccion::TEXT,
           p.usuario_id, p.id_tipo_sangre, p.id_ocupacion, p.id_estado_civil,
           p.id_medico_gen, ts.id, ts.tipo, oc.id, oc.nombre, ec.id, ec.nombre
    FROM PACIENTE p
    LEFT JOIN TIPO_SANGRE ts ON p.id_tipo_sangre = ts.id
    LEFT JOIN OCUPACION oc ON p.id_ocupacion = oc.id
    LEFT JOIN ESTADO_CIVIL ec ON p.id_estado_civil = ec.id
    WHERE p.id_medico_gen = doctor_id
    ORDER BY p.id;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_doctor_patients_sp(
    doctor_id INTEGER,
    search_term TEXT,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id INTEGER, nombre TEXT, fecha_nacimiento DATE, sexo VARCHAR(10),
    altura NUMERIC, peso NUMERIC, estilo_vida TEXT, alergias TEXT,
    telefono VARCHAR(20), correo VARCHAR(100), direccion TEXT,
    usuario_id INTEGER, id_tipo_sangre INTEGER, id_ocupacion INTEGER,
    id_estado_civil INTEGER, id_medico_gen INTEGER,
    tipo_sangre_id INTEGER, tipo_sangre_nombre VARCHAR(10),
    ocupacion_id INTEGER, ocupacion_nombre VARCHAR(100),
    estado_civil_id INTEGER, estado_civil_nombre VARCHAR(50)
) AS $func$
DECLARE
    normalized_term TEXT := NULLIF(TRIM(search_term), '');
BEGIN
    RETURN QUERY
    SELECT p.id, p.nombre::TEXT, p.fecha_nacimiento, p.sexo, p.altura, p.peso,
           p.estilo_vida::TEXT, p.alergias::TEXT, p.telefono, p.correo, p.direccion::TEXT,
           p.usuario_id, p.id_tipo_sangre, p.id_ocupacion, p.id_estado_civil,
           p.id_medico_gen, ts.id, ts.tipo, oc.id, oc.nombre, ec.id, ec.nombre
    FROM PACIENTE p
    LEFT JOIN TIPO_SANGRE ts ON p.id_tipo_sangre = ts.id
    LEFT JOIN OCUPACION oc ON p.id_ocupacion = oc.id
    LEFT JOIN ESTADO_CIVIL ec ON p.id_estado_civil = ec.id
    WHERE p.id_medico_gen = doctor_id
      AND normalized_term IS NOT NULL
      AND (
          p.nombre ILIKE '%' || normalized_term || '%'
          OR p.correo ILIKE '%' || normalized_term || '%'
          OR CAST(p.id AS TEXT) = normalized_term
      )
    ORDER BY
        CASE WHEN LOWER(p.nombre) LIKE LOWER(normalized_term || '%') THEN 0 ELSE 1 END,
        p.nombre
    LIMIT COALESCE(NULLIF(limit_count, 0), 10);
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_patient_sp(
    p_id INTEGER, p_nombre TEXT, p_fecha_nacimiento DATE, p_sexo VARCHAR(10),
    p_altura NUMERIC, p_peso NUMERIC, p_estilo_vida TEXT,
    p_id_tipo_sangre INTEGER, p_id_ocupacion INTEGER,
    p_id_estado_civil INTEGER, p_id_medico_gen INTEGER
) RETURNS BOOLEAN AS $func$
BEGIN
    UPDATE PACIENTE SET
        nombre = p_nombre, fecha_nacimiento = p_fecha_nacimiento,
        sexo = p_sexo, altura = p_altura, peso = p_peso,
        estilo_vida = p_estilo_vida, id_tipo_sangre = p_id_tipo_sangre,
        id_ocupacion = p_id_ocupacion, id_estado_civil = p_id_estado_civil,
        id_medico_gen = p_id_medico_gen
    WHERE id = p_id;
    RETURN FOUND;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_consultation_sp(
    c_id INTEGER, c_narrativa TEXT, c_diagnostico_final TEXT
) RETURNS BOOLEAN AS $func$
BEGIN
    UPDATE CONSULTA SET
        narrativa = c_narrativa, diagnostico_final = c_diagnostico_final
    WHERE id = c_id;
    RETURN FOUND;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_doctor_by_id_sp(doctor_id INTEGER)
RETURNS TABLE (
    id INTEGER, nombre TEXT, cedula VARCHAR(50), telefono VARCHAR(20),
    correo VARCHAR(100), ubicacion TEXT, descripcion TEXT,
    usuario_id INTEGER, id_especialidad INTEGER, especialidad_nombre TEXT
) AS $func$
BEGIN
    RETURN QUERY
    SELECT m.id, m.nombre::TEXT, m.cedula, m.telefono, m.correo,
           m.ubicacion::TEXT, m.descripcion::TEXT, m.usuario_id,
           m.id_especialidad, e.nombre::TEXT
    FROM MEDICO m
    LEFT JOIN ESPECIALIDAD e ON m.id_especialidad = e.id
    WHERE m.id = doctor_id;
END;
$func$ LANGUAGE plpgsql;

