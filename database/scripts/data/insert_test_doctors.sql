-- ===========================================
-- CREAR DOS PERFILES DE DOCTOR CON LOGIN
-- ===========================================

DO $$
DECLARE
    v_usuario1_id INT;
    v_usuario2_id INT;
    v_doctor1_id INT;
    v_doctor2_id INT;
    v_archivo1_id INT;
    v_archivo2_id INT;
BEGIN
    -- ===========================================
    -- DOCTOR 1: Dr. Roberto Mendoza
    -- ===========================================
    
    -- Crear usuario 1 para doctor
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('dr_roberto', 'roberto.mendoza@clinica.mx', '+52 81 5555 2001', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5KzqK5K5K5K5K', 2)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario1_id;
    
    IF v_usuario1_id IS NULL THEN
        SELECT id INTO v_usuario1_id FROM USUARIO WHERE correo = 'roberto.mendoza@clinica.mx';
    END IF;

    -- Crear archivo de foto para doctor 1
    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop', 'sha256:roberto_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo1_id;
    
    IF v_archivo1_id IS NULL THEN
        SELECT id INTO v_archivo1_id FROM ARCHIVO WHERE hash_integridad = 'sha256:roberto_photo';
    END IF;

    -- Crear doctor 1
    INSERT INTO MEDICO (
        usuario_id, nombre, cedula, descripcion, id_especialidad,
        telefono, correo, ubicacion
    ) VALUES (
        v_usuario1_id,
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

    -- Asociar foto al doctor 1
    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo1_id, 'MEDICO', v_doctor1_id, 'Foto de perfil', v_usuario1_id)
    ON CONFLICT DO NOTHING;

    -- ===========================================
    -- DOCTOR 2: Dra. Patricia López
    -- ===========================================
    
    -- Crear usuario 2 para doctor
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES ('dra_patricia', 'patricia.lopez@clinica.mx', '+52 81 5555 2002', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5KzqK5K5K5K5K', 2)
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario2_id;
    
    IF v_usuario2_id IS NULL THEN
        SELECT id INTO v_usuario2_id FROM USUARIO WHERE correo = 'patricia.lopez@clinica.mx';
    END IF;

    -- Crear archivo de foto para doctor 2
    INSERT INTO ARCHIVO (tipo, url, hash_integridad)
    VALUES ('image/jpeg', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop', 'sha256:patricia_photo')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_archivo2_id;
    
    IF v_archivo2_id IS NULL THEN
        SELECT id INTO v_archivo2_id FROM ARCHIVO WHERE hash_integridad = 'sha256:patricia_photo';
    END IF;

    -- Crear doctor 2
    INSERT INTO MEDICO (
        usuario_id, nombre, cedula, descripcion, id_especialidad,
        telefono, correo, ubicacion
    ) VALUES (
        v_usuario2_id,
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

    -- Asociar foto al doctor 2
    INSERT INTO ARCHIVO_ASOCIACION (archivo_id, entidad, entidad_id, descripcion, creado_por_usuario_id)
    VALUES (v_archivo2_id, 'MEDICO', v_doctor2_id, 'Foto de perfil', v_usuario2_id)
    ON CONFLICT DO NOTHING;

END $$;

-- Mostrar los doctores creados
SELECT 
    m.id,
    m.nombre,
    m.correo,
    u.username,
    m.cedula,
    e.nombre as especialidad,
    (SELECT url FROM ARCHIVO a 
     JOIN ARCHIVO_ASOCIACION aa ON a.id = aa.archivo_id 
     WHERE aa.entidad = 'MEDICO' AND aa.entidad_id = m.id 
     AND aa.descripcion = 'Foto de perfil'
     LIMIT 1) as foto_url
FROM MEDICO m
JOIN USUARIO u ON m.usuario_id = u.id
LEFT JOIN ESPECIALIDAD e ON m.id_especialidad = e.id
WHERE m.correo IN ('roberto.mendoza@clinica.mx', 'patricia.lopez@clinica.mx')
ORDER BY m.id;

