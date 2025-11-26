"""
Script para aplicar los stored procedures a la base de datos PostgreSQL
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

def apply_stored_procedures():
    """Aplica los stored procedures desde el archivo SQL"""
    
    # Obtener la ruta del archivo de stored procedures
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    sql_file = project_root / "database" / "scripts" / "procedures" / "stored_procedures.sql"
    
    if not sql_file.exists():
        print(f"[ERROR] No se encontro el archivo: {sql_file}")
        return False
    
    print(f"[INFO] Leyendo archivo: {sql_file}")
    
    try:
        # Leer el contenido del archivo SQL
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print(f"[OK] Archivo leido correctamente ({len(sql_content)} caracteres)")
        
        # Conectar a PostgreSQL
        print(f"\n[INFO] Conectando a PostgreSQL...")
        print(f"   Host: {POSTGRES_HOST}:{POSTGRES_PORT}")
        print(f"   Database: {POSTGRES_DB}")
        print(f"   User: {POSTGRES_USER}")
        
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD
        )
        
        # Establecer autocommit para ejecutar múltiples comandos
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        print("[OK] Conexion establecida")
        
        # Ejecutar el SQL
        print(f"\n[INFO] Aplicando stored procedures...")
        with conn.cursor() as cur:
            cur.execute(sql_content)
        
        print("[OK] Stored procedures aplicados correctamente")
        
        # Verificar que los stored procedures se crearon
        print(f"\n[INFO] Verificando stored procedures...")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT routine_name 
                FROM information_schema.routines 
                WHERE routine_schema = 'public' 
                AND routine_name LIKE '%_sp'
                ORDER BY routine_name;
            """)
            procedures = cur.fetchall()
            
            print(f"   Encontrados {len(procedures)} stored procedures:")
            for proc in procedures:
                print(f"   - {proc[0]}")
        
        # Verificar específicamente los que agregamos
        required_procedures = [
            'get_doctor_patients_sp',
            'get_doctor_by_id_sp',
            'get_catalogos_sp'
        ]
        
        print(f"\n[INFO] Verificando stored procedures requeridos...")
        with conn.cursor() as cur:
            for proc_name in required_procedures:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 
                        FROM information_schema.routines 
                        WHERE routine_schema = 'public' 
                        AND routine_name = %s
                    );
                """, (proc_name,))
                exists = cur.fetchone()[0]
                status = "[OK]" if exists else "[ERROR]"
                print(f"   {status} {proc_name}")
        
        conn.close()
        print(f"\n[OK] Proceso completado exitosamente")
        return True
        
    except psycopg2.Error as e:
        print(f"\n[ERROR] Error de PostgreSQL: {e}")
        return False
    except FileNotFoundError as e:
        print(f"\n[ERROR] Archivo no encontrado: {e}")
        return False
    except Exception as e:
        print(f"\n[ERROR] Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("APLICACIÓN DE STORED PROCEDURES")
    print("=" * 60)
    
    success = apply_stored_procedures()
    
    if success:
        print("\n[OK] Todos los stored procedures se aplicaron correctamente")
        sys.exit(0)
    else:
        print("\n[ERROR] Hubo errores al aplicar los stored procedures")
        sys.exit(1)

