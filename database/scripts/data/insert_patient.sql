-- ===========================================
-- INSERTAR PACIENTE COMPLETO PARA FRONTEND
-- ===========================================

-- Primero, crear un usuario para el paciente (si no existe)
DO $$
DECLARE
    v_usuario_id INT;
BEGIN
    -- Intentar obtener usuario existente o crear uno nuevo
    SELECT id INTO v_usuario_id FROM USUARIO WHERE correo = 'maria.gonzalez@example.com';
    
    IF v_usuario_id IS NULL THEN
        -- Crear nuevo usuario
        INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
        VALUES ('maria_gonzalez', 'maria.gonzalez@example.com', '+52 81 5555 9999', '$2b$12$placeholder', 3)
        RETURNING id INTO v_usuario_id;
    END IF;

    -- Insertar o actualizar paciente completo
    INSERT INTO PACIENTE (
        usuario_id,
        nombre,
        fecha_nacimiento,
        sexo,
        altura,
        peso,
        estilo_vida,
        alergias,
        id_tipo_sangre,
        id_ocupacion,
        id_estado_civil,
        id_medico_gen,
        telefono,
        correo,
        direccion
    ) VALUES (
        v_usuario_id,
        'María González López',  -- nombre completo (se separará en frontend)
        '1990-05-15',
        'Femenino',
        168.5,
        65.0,
        'Activo',
        'Ninguna conocida',
        2,  -- Tipo sangre O+ (ajustar según catálogo)
        1,  -- Ocupación: Estudiante
        1,  -- Estado civil: Soltero
        1,  -- Médico general (Dr. Cameron Cordara)
        '+52 81 5555 9999',
        'maria.gonzalez@example.com',
        'Av. Constitución #123, Col. Centro, Monterrey, NL'
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
        direccion = EXCLUDED.direccion;

    -- Crear un episodio para el paciente
    INSERT INTO EPISODIO (id_paciente, fecha_inicio, motivo)
    SELECT id, NOW(), 'Consulta general de rutina'
    FROM PACIENTE
    WHERE correo = 'maria.gonzalez@example.com'
    AND NOT EXISTS (
        SELECT 1 FROM EPISODIO e 
        WHERE e.id_paciente = PACIENTE.id 
        AND e.motivo = 'Consulta general de rutina'
        AND e.fecha_fin IS NULL
    );

    -- Crear una cita
    INSERT INTO CITA (paciente_id, medico_id, fecha_inicio, id_estado_cita, id_tipo_cita)
    SELECT 
        p.id,
        1,  -- Dr. Cameron Cordara
        NOW(),
        1,  -- Estado: Programada
        1   -- Tipo: General
    FROM PACIENTE p
    WHERE p.correo = 'maria.gonzalez@example.com'
    AND NOT EXISTS (
        SELECT 1 FROM CITA c 
        WHERE c.paciente_id = p.id 
        AND c.fecha_inicio::date = CURRENT_DATE
    );

    -- Crear una consulta
    INSERT INTO CONSULTA (cita_id, id_paciente, id_medico, id_estado_consulta, id_episodio, fecha_hora, narrativa)
    SELECT 
        c.id,
        p.id,
        1,  -- Dr. Cameron Cordara
        1,  -- Estado: En curso
        e.id,
        NOW(),
        'Paciente acude para consulta de rutina. Refiere buen estado general de salud. Signos vitales dentro de parámetros normales.'
    FROM PACIENTE p
    JOIN EPISODIO e ON e.id_paciente = p.id
    JOIN CITA c ON c.paciente_id = p.id
    WHERE p.correo = 'maria.gonzalez@example.com'
    AND e.fecha_fin IS NULL
    AND c.fecha_inicio::date = CURRENT_DATE
    AND NOT EXISTS (
        SELECT 1 FROM CONSULTA cons 
        WHERE cons.id_paciente = p.id 
        AND cons.cita_id = c.id
    )
    ORDER BY e.fecha_inicio DESC, c.fecha_inicio DESC
    LIMIT 1;

END $$;

-- Mostrar el ID del paciente creado
SELECT id, nombre, correo, fecha_nacimiento, sexo FROM PACIENTE WHERE correo = 'maria.gonzalez@example.com';
