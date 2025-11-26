"""
Script para corregir el stored procedure get_doctor_patients_sp
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

def fix_doctor_patients_procedure():
    """Corrige el stored procedure get_doctor_patients_sp"""
    
    try:
        print("=" * 60)
        print("CORRECCION DE STORED PROCEDURE get_doctor_patients_sp")
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
            cur.execute("DROP FUNCTION IF EXISTS get_doctor_patients_sp(INTEGER);")
        print("[OK] Stored procedure eliminado")
        
        # Crear el stored procedure corregido
        print(f"\n[INFO] Creando stored procedure corregido...")
        new_procedure = """
CREATE OR REPLACE FUNCTION get_doctor_patients_sp(doctor_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    nombre VARCHAR(200),
    fecha_nacimiento DATE,
    sexo VARCHAR(10),
    altura NUMERIC,
    peso NUMERIC,
    estilo_vida TEXT,
    alergias TEXT,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    direccion TEXT,
    usuario_id INTEGER,
    id_tipo_sangre INTEGER,
    id_ocupacion INTEGER,
    id_estado_civil INTEGER,
    id_medico_gen INTEGER,
    tipo_sangre_id INTEGER,
    tipo_sangre_nombre VARCHAR(10),
    ocupacion_id INTEGER,
    ocupacion_nombre VARCHAR(100),
    estado_civil_id INTEGER,
    estado_civil_nombre VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, 
        p.nombre::VARCHAR(200), 
        p.fecha_nacimiento, 
        p.sexo, 
        p.altura, 
        p.peso,
        p.estilo_vida::TEXT, 
        p.alergias::TEXT, 
        p.telefono, 
        p.correo, 
        p.direccion,
        p.usuario_id,
        p.id_tipo_sangre,
        p.id_ocupacion,
        p.id_estado_civil,
        p.id_medico_gen,
        ts.id as tipo_sangre_id,
        ts.tipo as tipo_sangre_nombre,
        oc.id as ocupacion_id,
        oc.nombre as ocupacion_nombre,
        ec.id as estado_civil_id,
        ec.nombre as estado_civil_nombre
    FROM PACIENTE p
    LEFT JOIN TIPO_SANGRE ts ON p.id_tipo_sangre = ts.id
    LEFT JOIN OCUPACION oc ON p.id_ocupacion = oc.id
    LEFT JOIN ESTADO_CIVIL ec ON p.id_estado_civil = ec.id
    WHERE p.id_medico_gen = doctor_id
    ORDER BY p.nombre, p.id;
END;
$$ LANGUAGE plpgsql;
"""
        with conn.cursor() as cur:
            cur.execute(new_procedure)
        print("[OK] Stored procedure creado")
        
        # Probar el stored procedure
        print(f"\n[TEST] Probando stored procedure con doctor_id = 4...")
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM get_doctor_patients_sp(%s)", (4,))
            results = cur.fetchall()
            
            print(f"[OK] Stored procedure funciona correctamente")
            print(f"   Se encontraron {len(results)} pacientes")
        
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
    success = fix_doctor_patients_procedure()
    sys.exit(0 if success else 1)

