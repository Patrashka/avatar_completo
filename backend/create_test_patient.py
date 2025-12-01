#!/usr/bin/env python3
"""
Script para crear un paciente de prueba con datos faltantes
para probar el modal de datos faltantes en el frontend.
"""

import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Cargar variables de entorno
backend_dir = Path(__file__).parent
env_path = backend_dir / '.env'
project_root = backend_dir.parent
root_env_path = project_root / '.env'

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
elif root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)

# Configuración de la base de datos
# Valores por defecto basados en docker-compose.yml
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "medico_db")
DB_USER = os.getenv("DB_USER", "admin")  # Usuario por defecto de Docker
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin123")  # Contraseña por defecto de Docker

def create_test_patient():
    """Crea un paciente de prueba con datos faltantes."""
    conn = None
    try:
        # Conectar a la base de datos
        print(f"🔌 Intentando conectar a PostgreSQL...")
        print(f"   Host: {DB_HOST}")
        print(f"   Port: {DB_PORT}")
        print(f"   Database: {DB_NAME}")
        print(f"   User: {DB_USER}")
        
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("🔌 Conectado a la base de datos")
        
        # Verificar si la columna apellido existe
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'paciente' 
                AND column_name = 'apellido'
            )
        """)
        apellido_exists = cur.fetchone()['exists']
        
        if not apellido_exists:
            print("➕ Agregando columna 'apellido' a la tabla PACIENTE...")
            cur.execute("ALTER TABLE PACIENTE ADD COLUMN apellido VARCHAR(200)")
            print("✅ Columna 'apellido' agregada")
        
        # Crear usuario
        print("\n👤 Creando usuario de prueba...")
        cur.execute("""
            INSERT INTO USUARIO (username, correo, telefono, password_hash, rol_id)
            VALUES (
                'paciente_prueba', 
                'paciente.prueba@test.com', 
                '+52 81 5555 9999', 
                '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5KzqK5K5K5K5K', 
                3
            )
            ON CONFLICT (correo) DO UPDATE SET username = EXCLUDED.username
            RETURNING id
        """)
        result = cur.fetchone()
        if result:
            usuario_id = result['id']
            print(f"✅ Usuario creado/actualizado con ID: {usuario_id}")
        else:
            # Si no se creó, obtener el ID existente
            cur.execute("SELECT id FROM USUARIO WHERE correo = 'paciente.prueba@test.com'")
            usuario_id = cur.fetchone()['id']
            print(f"✅ Usuario existente con ID: {usuario_id}")
        
        # Crear paciente con datos mínimos
        print("\n🏥 Creando paciente con datos faltantes...")
        cur.execute("""
            INSERT INTO PACIENTE (usuario_id, nombre, correo)
            VALUES (%s, '', 'paciente.prueba@test.com')
            ON CONFLICT (correo) DO UPDATE SET usuario_id = EXCLUDED.usuario_id
            RETURNING id
        """, (usuario_id,))
        
        result = cur.fetchone()
        if result:
            paciente_id = result['id']
            print(f"✅ Paciente creado/actualizado con ID: {paciente_id}")
        else:
            # Si no se creó, obtener el ID existente
            cur.execute("SELECT id FROM PACIENTE WHERE correo = 'paciente.prueba@test.com'")
            paciente_id = cur.fetchone()['id']
            print(f"✅ Paciente existente con ID: {paciente_id}")
        
        # Limpiar datos para forzar que aparezca el modal
        print("\n🧹 Limpiando datos del paciente para forzar el modal...")
        cur.execute("""
            UPDATE PACIENTE SET
                nombre = '',
                apellido = NULL,
                fecha_nacimiento = NULL,
                sexo = NULL,
                altura = NULL,
                peso = NULL,
                estilo_vida = NULL,
                id_tipo_sangre = NULL,
                id_ocupacion = NULL,
                id_estado_civil = NULL,
                id_medico_gen = NULL
            WHERE id = %s
        """, (paciente_id,))
        
        print("✅ Datos limpiados")
        
        # Verificar el estado del paciente
        cur.execute("""
            SELECT 
                id, nombre, apellido, fecha_nacimiento, sexo,
                altura, peso, id_tipo_sangre, id_ocupacion, id_estado_civil
            FROM PACIENTE
            WHERE id = %s
        """, (paciente_id,))
        
        paciente = cur.fetchone()
        
        conn.commit()
        cur.close()
        conn.close()
        
        print("\n" + "="*60)
        print("✅ PACIENTE DE PRUEBA CREADO EXITOSAMENTE")
        print("="*60)
        print(f"📧 Correo: paciente.prueba@test.com")
        print(f"👤 Username: paciente_prueba")
        print(f"🔑 Password: (usar el mismo que otros usuarios de prueba)")
        print(f"🆔 ID Paciente: {paciente_id}")
        print(f"🆔 ID Usuario: {usuario_id}")
        print("\n📋 Estado de los datos:")
        print(f"   - Nombre: '{paciente['nombre']}' {'❌ FALTA' if not paciente['nombre'] else '✅'}")
        print(f"   - Apellido: {paciente['apellido']} {'❌ FALTA' if not paciente['apellido'] else '✅'}")
        print(f"   - Fecha nacimiento: {paciente['fecha_nacimiento']} {'❌ FALTA' if not paciente['fecha_nacimiento'] else '✅'}")
        print(f"   - Sexo: {paciente['sexo']} {'❌ FALTA' if not paciente['sexo'] else '✅'}")
        print(f"   - Altura: {paciente['altura']} {'❌ FALTA' if not paciente['altura'] else '✅'}")
        print(f"   - Peso: {paciente['peso']} {'❌ FALTA' if not paciente['peso'] else '✅'}")
        print("\n💡 Este paciente debería mostrar el modal de datos faltantes")
        print("   al iniciar sesión en el frontend.")
        print("="*60)
        
    except psycopg2.Error as e:
        print(f"❌ Error de base de datos: {e}")
        print("\n💡 Asegúrate de que:")
        print("   1. PostgreSQL esté corriendo")
        print("   2. Las credenciales en .env sean correctas (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)")
        print("   3. La base de datos exista")
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)

if __name__ == "__main__":
    create_test_patient()

