"""
Script para probar los stored procedures del doctor
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

def test_doctor_procedures():
    """Prueba los stored procedures del doctor"""
    
    try:
        print("=" * 60)
        print("PRUEBA DE STORED PROCEDURES DEL DOCTOR")
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
        
        # Probar get_doctor_by_id_sp con ID 4
        print(f"\n[TEST] Probando get_doctor_by_id_sp(4)...")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM get_doctor_by_id_sp(%s)", (4,))
            result = cur.fetchone()
            
            if result:
                print(f"[OK] Doctor encontrado:")
                for key, value in result.items():
                    print(f"   {key}: {value} ({type(value).__name__})")
            else:
                print(f"[ERROR] No se encontro el doctor con ID 4")
        
        # Probar get_doctor_patients_sp con ID 4
        print(f"\n[TEST] Probando get_doctor_patients_sp(4)...")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM get_doctor_patients_sp(%s)", (4,))
            results = cur.fetchall()
            
            print(f"[OK] Se encontraron {len(results)} pacientes:")
            for i, patient in enumerate(results, 1):
                print(f"   Paciente {i}:")
                for key, value in list(patient.items())[:5]:  # Mostrar solo los primeros 5 campos
                    print(f"      {key}: {value}")
        
        # Verificar que el doctor 4 existe
        print(f"\n[TEST] Verificando que el doctor 4 existe en la tabla MEDICO...")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, nombre, usuario_id FROM MEDICO WHERE id = %s", (4,))
            result = cur.fetchone()
            
            if result:
                print(f"[OK] Doctor encontrado en tabla MEDICO:")
                for key, value in result.items():
                    print(f"   {key}: {value}")
            else:
                print(f"[ERROR] No se encontro el doctor con ID 4 en la tabla MEDICO")
        
        conn.close()
        print(f"\n[OK] Pruebas completadas")
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
    success = test_doctor_procedures()
    sys.exit(0 if success else 1)

