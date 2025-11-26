"""
Script para verificar que la vinculación paciente-doctor persiste correctamente
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

# Cargar variables de entorno
load_dotenv()

# Configuración de conexión
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "medico_db")
POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "admin123")

def verify_patient_doctor_link():
    """Verifica que la vinculación paciente-doctor persiste correctamente"""
    
    try:
        print("=" * 60)
        print("VERIFICACION DE VINCULACION PACIENTE-DOCTOR")
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
        
        print("[OK] Conexion establecida")
        
        # Verificar pacientes vinculados al doctor 4
        print(f"\n[TEST] Verificando pacientes vinculados al doctor 4...")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar directamente en la tabla
            cur.execute("""
                SELECT p.id, p.nombre, p.id_medico_gen, m.nombre as medico_nombre
                FROM PACIENTE p
                LEFT JOIN MEDICO m ON p.id_medico_gen = m.id
                WHERE p.id_medico_gen = 4
                ORDER BY p.nombre;
            """)
            direct_results = cur.fetchall()
            
            print(f"[OK] Encontrados {len(direct_results)} pacientes vinculados directamente:")
            for patient in direct_results:
                print(f"   - Paciente ID {patient['id']}: {patient['nombre']} (Medico: {patient['medico_nombre']})")
            
            # Verificar usando el stored procedure
            cur.execute("SELECT * FROM get_doctor_patients_sp(4)")
            sp_results = cur.fetchall()
            
            print(f"\n[OK] Encontrados {len(sp_results)} pacientes usando stored procedure:")
            for patient in sp_results:
                print(f"   - Paciente ID {patient['id']}: {patient['nombre']}")
            
            # Comparar resultados
            if len(direct_results) == len(sp_results):
                print(f"\n[OK] Los resultados coinciden - La persistencia funciona correctamente")
            else:
                print(f"\n[WARNING] Los resultados no coinciden:")
                print(f"   Directo: {len(direct_results)} pacientes")
                print(f"   Stored Procedure: {len(sp_results)} pacientes")
        
        # Verificar que el campo id_medico_gen se guarda correctamente
        print(f"\n[TEST] Verificando estructura de la tabla PACIENTE...")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'paciente' AND column_name = 'id_medico_gen';
            """)
            column_info = cur.fetchone()
            
            if column_info:
                print(f"[OK] Campo id_medico_gen existe:")
                print(f"   Tipo: {column_info['data_type']}")
                print(f"   Max length: {column_info['character_maximum_length']}")
        
        # Mostrar todos los pacientes y sus médicos asignados
        print(f"\n[INFO] Resumen de todas las vinculaciones paciente-doctor:")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    p.id as paciente_id,
                    p.nombre as paciente_nombre,
                    p.id_medico_gen,
                    m.id as medico_id,
                    m.nombre as medico_nombre
                FROM PACIENTE p
                LEFT JOIN MEDICO m ON p.id_medico_gen = m.id
                ORDER BY p.id_medico_gen NULLS LAST, p.nombre;
            """)
            all_links = cur.fetchall()
            
            for link in all_links:
                if link['id_medico_gen']:
                    print(f"   Paciente {link['paciente_id']} ({link['paciente_nombre']}) -> Doctor {link['medico_id']} ({link['medico_nombre']})")
                else:
                    print(f"   Paciente {link['paciente_id']} ({link['paciente_nombre']}) -> Sin doctor asignado")
        
        conn.close()
        print(f"\n[OK] Verificacion completada")
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
    success = verify_patient_doctor_link()
    sys.exit(0 if success else 1)

