"""
Script para corregir el stored procedure get_doctor_by_id_sp
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Cargar variables de entorno
load_dotenv()

# Configuración de conexión
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "medico_db")
POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "admin123")

def fix_doctor_procedure():
    """Corrige el stored procedure get_doctor_by_id_sp"""
    
    try:
        print("=" * 60)
        print("CORRECCION DE STORED PROCEDURE get_doctor_by_id_sp")
        print("=" * 60)
        
        # Conectar a PostgreSQL
        print(f"\n[INFO] Conectando a PostgreSQL...")
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD
        )
        
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("[OK] Conexion establecida")
        
        # Eliminar el stored procedure existente
        print(f"\n[INFO] Eliminando stored procedure existente...")
        with conn.cursor() as cur:
            cur.execute("DROP FUNCTION IF EXISTS get_doctor_by_id_sp(INTEGER);")
        print("[OK] Stored procedure eliminado")
        
        # Crear el stored procedure corregido
        print(f"\n[INFO] Creando stored procedure corregido...")
        new_procedure = """
CREATE OR REPLACE FUNCTION get_doctor_by_id_sp(doctor_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    nombre VARCHAR(200),
    cedula VARCHAR(50),
    telefono VARCHAR(20),
    correo VARCHAR(100),
    ubicacion TEXT,
    descripcion TEXT,
    usuario_id INTEGER,
    id_especialidad INTEGER,
    especialidad_nombre VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.nombre::VARCHAR(200),
        m.cedula,
        m.telefono,
        m.correo,
        m.ubicacion,
        m.descripcion,
        m.usuario_id,
        m.id_especialidad,
        e.nombre::VARCHAR(100) as especialidad_nombre
    FROM MEDICO m
    LEFT JOIN ESPECIALIDAD e ON m.id_especialidad = e.id
    WHERE m.id = doctor_id;
END;
$$ LANGUAGE plpgsql;
"""
        with conn.cursor() as cur:
            cur.execute(new_procedure)
        print("[OK] Stored procedure creado")
        
        # Probar el stored procedure
        print(f"\n[TEST] Probando stored procedure con doctor_id = 4...")
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM get_doctor_by_id_sp(%s)", (4,))
            result = cur.fetchone()
            
            if result:
                print(f"[OK] Stored procedure funciona correctamente")
                print(f"   Doctor encontrado: {result[1]} (ID: {result[0]})")
            else:
                print(f"[WARNING] No se encontro el doctor con ID 4")
        
        conn.close()
        print(f"\n[OK] Correccion completada exitosamente")
        return True
        
    except psycopg2.Error as e:
        print(f"\n[ERROR] Error de PostgreSQL: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"\n[ERROR] Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = fix_doctor_procedure()
    sys.exit(0 if success else 1)

