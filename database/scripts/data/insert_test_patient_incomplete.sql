-- ===========================================
-- CREAR PACIENTE DE PRUEBA CON DATOS FALTANTES
-- Para probar el modal de datos faltantes
-- ===========================================

DO $$
DECLARE
    v_usuario_id INT;
    v_paciente_id INT;
    v_apellido_exists BOOLEAN;
BEGIN
    -- Verificar si la columna apellido existe en PACIENTE
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'paciente' 
        AND column_name = 'apellido'
    ) INTO v_apellido_exists;

    -- Agregar columna apellido si no existe
    IF NOT v_apellido_exists THEN
        ALTER TABLE PACIENTE ADD COLUMN apellido VARCHAR(200);
        RAISE NOTICE 'Columna apellido agregada a la tabla PACIENTE';
    END IF;

    -- Crear usuario con datos mínimos
    INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
    VALUES (
        'paciente_prueba', 
        'paciente.prueba@test.com', 
        '+52 81 5555 9999', 
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5KzqK5K5K5K5K', 
        3  -- Rol: Paciente
    )
    ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO v_usuario_id;
    
    -- Si el usuario ya existe, obtener su ID
    IF v_usuario_id IS NULL THEN
        SELECT id INTO v_usuario_id FROM USUARIO WHERE correo = 'paciente.prueba@test.com';
    END IF;

    -- Crear paciente con datos MÍNIMOS
    -- nombre es NOT NULL, así que usamos un string vacío o espacio
    -- Esto simulará un paciente nuevo sin datos completados
    INSERT INTO PACIENTE (
        usuario_id,
        nombre,
        correo
        -- NO incluir: apellido, fecha_nacimiento, sexo, altura, peso, 
        -- estilo_vida, id_tipo_sangre, id_ocupacion, id_estado_civil, etc.
    ) VALUES (
        v_usuario_id,
        '',  -- nombre vacío (NOT NULL requiere un valor, pero vacío funciona)
        'paciente.prueba@test.com'
    )
    ON CONFLICT (correo) DO UPDATE SET
        usuario_id = EXCLUDED.usuario_id
    RETURNING id INTO v_paciente_id;
    
    -- Si el paciente ya existe, obtener su ID
    IF v_paciente_id IS NULL THEN
        SELECT id INTO v_paciente_id FROM PACIENTE WHERE correo = 'paciente.prueba@test.com';
    END IF;

    -- Limpiar datos existentes para forzar que aparezca el modal
    -- Establecer valores vacíos o NULL según permita la tabla
    UPDATE PACIENTE SET
        nombre = '',
        apellido = NULL,  -- NULL si la columna existe
        fecha_nacimiento = NULL,
        sexo = NULL,
        altura = NULL,
        peso = NULL,
        estilo_vida = NULL,
        id_tipo_sangre = NULL,
        id_ocupacion = NULL,
        id_estado_civil = NULL,
        id_medico_gen = NULL
    WHERE id = v_paciente_id;

    RAISE NOTICE 'Paciente de prueba creado/actualizado con ID: %', v_paciente_id;
    RAISE NOTICE 'Usuario: paciente.prueba@test.com';
    RAISE NOTICE 'Password: (usar el mismo que otros usuarios de prueba)';
    RAISE NOTICE 'Este paciente tiene datos faltantes y debería mostrar el modal de bienvenida';

END $$;

-- Mostrar el paciente creado
SELECT 
    p.id as paciente_id,
    u.id as usuario_id,
    u.username,
    u.correo,
    p.nombre,
    p.apellido,
    p.fecha_nacimiento,
    p.sexo,
    p.altura,
    p.peso,
    p.id_tipo_sangre,
    p.id_ocupacion,
    p.id_estado_civil,
    CASE 
        WHEN p.nombre IS NULL OR p.nombre = '' THEN 'FALTA'
        ELSE 'OK'
    END as nombre_status,
    CASE 
        WHEN p.apellido IS NULL OR p.apellido = '' THEN 'FALTA'
        ELSE 'OK'
    END as apellido_status,
    CASE 
        WHEN p.fecha_nacimiento IS NULL OR p.fecha_nacimiento = '' THEN 'FALTA'
        ELSE 'OK'
    END as fecha_nacimiento_status,
    CASE 
        WHEN p.sexo IS NULL OR p.sexo = '' THEN 'FALTA'
        ELSE 'OK'
    END as sexo_status
FROM PACIENTE p
JOIN USUARIO u ON p.usuario_id = u.id
WHERE p.correo = 'paciente.prueba@test.com';

