-- ===========================================
-- CREAR DOS PERFILES DE PRUEBA CON LOGIN
-- ===========================================

DO $$
DECLARE
    v_usuario1_id INT;
    v_usuario2_id INT;
    v_paciente1_id INT;
    v_paciente2_id INT;
    v_archivo1_id INT;
    v_archivo2_id INT;
BEGIN
    -- ===========================================
    -- PERFIL 1: Carlos Ramírez
    -- ===========================================
    
    -- Crear usuario 1
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('carlos_ramirez', 'carlos.ramirez@test.com', '+52 81 5555 1001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5KzqK5K5K5K5K', 3)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario1_id;
    
    -- Si el usuario ya existe, obtener su ID
    IF v_usuario1_id IS NULL THEN
        SELECT id INTO v_usuario1_id FROM USUARIO WHERE correo = 'carlos.ramirez@test.com';
    END IF;

    -- Crear archivo de foto para paciente 1
    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', 'sha256:carlos_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo1_id;
    
    IF v_archivo1_id IS NULL THEN
        SELECT id INTO v_archivo1_id FROM ARCHIVO WHERE hash_integridad = 'sha256:carlos_photo';
    END IF;

    -- Crear paciente 1
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

    -- Asociar foto al paciente 1
    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo1_id, 'PACIENTE', v_paciente1_id, 'Foto de perfil', v_usuario1_id)
    ON CONFLICT DO NOTHING;

    -- Crear episodio para paciente 1
    INSERT INTO EPISODIO (id_paciente, fecha_inicio, motivo)
    SELECT id, NOW() - INTERVAL '10 days', 'Control de presión arterial'
    FROM PACIENTE
    WHERE id = v_paciente1_id
    AND NOT EXISTS (
        SELECT 1 FROM EPISODIO e 
        WHERE e.id_paciente = v_paciente1_id 
        AND e.motivo = 'Control de presión arterial'
        AND e.fecha_fin IS NULL
    );

    -- Crear cita para paciente 1
    INSERT INTO CITA (paciente_id, medico_id, fecha_inicio, id_estado_cita, id_tipo_cita)
    SELECT 
        v_paciente1_id,
        1,
        NOW() - INTERVAL '5 days',
        2,  -- Completada
        1   -- General
    WHERE NOT EXISTS (
        SELECT 1 FROM CITA c 
        WHERE c.paciente_id = v_paciente1_id 
        AND c.fecha_inicio::date = (NOW() - INTERVAL '5 days')::date
    );

    -- Crear consulta para paciente 1
    INSERT INTO CONSULTA (cita_id, id_paciente, id_medico, id_estado_consulta, id_episodio, fecha_hora, narrativa, diagnostico_final)
    SELECT 
        c.id,
        v_paciente1_id,
        1,
        2,  -- Cerrada
        e.id,
        NOW() - INTERVAL '5 days',
        'Paciente acude para control de presión arterial. Refiere buen cumplimiento del tratamiento. Presión arterial: 125/80 mmHg.',
        'Hipertensión controlada'
    FROM CITA c
    JOIN EPISODIO e ON e.id_paciente = v_paciente1_id
    WHERE c.paciente_id = v_paciente1_id
    AND e.fecha_fin IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM CONSULTA cons 
        WHERE cons.id_paciente = v_paciente1_id 
        AND cons.cita_id = c.id
    )
    ORDER BY c.fecha_inicio DESC
    LIMIT 1;

    -- ===========================================
    -- PERFIL 2: Laura Sánchez
    -- ===========================================
    
    -- Crear usuario 2
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('laura_sanchez', 'laura.sanchez@test.com', '+52 81 5555 1002', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5KzqK5K5K5K5K', 3)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario2_id;
    
    IF v_usuario2_id IS NULL THEN
        SELECT id INTO v_usuario2_id FROM USUARIO WHERE correo = 'laura.sanchez@test.com';
    END IF;

    -- Crear archivo de foto para paciente 2
    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', 'sha256:laura_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo2_id;
    
    IF v_archivo2_id IS NULL THEN
        SELECT id INTO v_archivo2_id FROM ARCHIVO WHERE hash_integridad = 'sha256:laura_photo';
    END IF;

    -- Crear paciente 2
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

    -- Asociar foto al paciente 2
    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo2_id, 'PACIENTE', v_paciente2_id, 'Foto de perfil', v_usuario2_id)
    ON CONFLICT DO NOTHING;

    -- Crear episodio para paciente 2
    INSERT INTO EPISODIO (id_paciente, fecha_inicio, motivo)
    SELECT id, NOW() - INTERVAL '7 days', 'Consulta de rutina'
    FROM PACIENTE
    WHERE id = v_paciente2_id
    AND NOT EXISTS (
        SELECT 1 FROM EPISODIO e 
        WHERE e.id_paciente = v_paciente2_id 
        AND e.motivo = 'Consulta de rutina'
        AND e.fecha_fin IS NULL
    );

    -- Crear cita para paciente 2
    INSERT INTO CITA (paciente_id, medico_id, fecha_inicio, id_estado_cita, id_tipo_cita)
    SELECT 
        v_paciente2_id,
        1,
        NOW() - INTERVAL '3 days',
        2,  -- Completada
        1   -- General
    WHERE NOT EXISTS (
        SELECT 1 FROM CITA c 
        WHERE c.paciente_id = v_paciente2_id 
        AND c.fecha_inicio::date = (NOW() - INTERVAL '3 days')::date
    );

    -- Crear consulta para paciente 2
    INSERT INTO CONSULTA (cita_id, id_paciente, id_medico, id_estado_consulta, id_episodio, fecha_hora, narrativa, diagnostico_final)
    SELECT 
        c.id,
        v_paciente2_id,
        1,
        2,  -- Cerrada
        e.id,
        NOW() - INTERVAL '3 days',
        'Paciente acude para consulta de rutina. Refiere buen estado general. Examen físico sin hallazgos relevantes.',
        'Paciente sana'
    FROM CITA c
    JOIN EPISODIO e ON e.id_paciente = v_paciente2_id
    WHERE c.paciente_id = v_paciente2_id
    AND e.fecha_fin IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM CONSULTA cons 
        WHERE cons.id_paciente = v_paciente2_id 
        AND cons.cita_id = c.id
    )
    ORDER BY c.fecha_inicio DESC
    LIMIT 1;

END $$;

-- Mostrar los pacientes creados
SELECT 
    p.id,
    p.nombre,
    p.correo,
    u.username,
    p.fecha_nacimiento,
    p.sexo,
    (SELECT url FROM ARCHIVO a 
     JOIN ARCHIVO_ASOCIACION aa ON a.id = aa.archivo_id 
     WHERE aa.entidad = 'PACIENTE' AND aa.entidad_id = p.id 
     LIMIT 1) as foto_url
FROM PACIENTE p
JOIN USUARIO u ON p.usuario_id = u.id
WHERE p.correo IN ('carlos.ramirez@test.com', 'laura.sanchez@test.com')
ORDER BY p.id;

