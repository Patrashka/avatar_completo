"""
Script para verificar que las bases de datos están funcionando correctamente
"""
import sys
import os

# Configurar encoding para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Agregar el directorio frontend al path para importar db_connection
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'frontend'))

try:
    from db_connection import (
        get_postgres_connection,
        get_mongo_db,
        execute_query,
        get_patient_by_id,
        get_doctors,
        get_catalogos
    )
    print("[OK] Modulo db_connection importado correctamente")
except ImportError as e:
    print(f"[ERROR] Error importando db_connection: {e}")
    sys.exit(1)

def test_postgres():
    """Prueba la conexión a PostgreSQL y algunas consultas básicas"""
    print("\n" + "="*60)
    print("[TEST] PROBANDO POSTGRESQL")
    print("="*60)
    
    try:
        # Probar conexión
        conn = get_postgres_connection()
        print("[OK] Conexion a PostgreSQL establecida")
        
        # Contar usuarios
        query = "SELECT COUNT(*) as total FROM USUARIO"
        result = execute_query(query)
        print(f"[OK] Total de usuarios en la BD: {result[0]['total']}")
        
        # Contar pacientes
        query = "SELECT COUNT(*) as total FROM PACIENTE"
        result = execute_query(query)
        print(f"[OK] Total de pacientes: {result[0]['total']}")
        
        # Contar médicos
        query = "SELECT COUNT(*) as total FROM MEDICO"
        result = execute_query(query)
        print(f"[OK] Total de medicos: {result[0]['total']}")
        
        # Obtener un paciente de ejemplo
        query = "SELECT id, nombre FROM PACIENTE LIMIT 1"
        result = execute_query(query)
        if result:
            print(f"[OK] Paciente de ejemplo: ID={result[0]['id']}, Nombre={result[0]['nombre']}")
        else:
            print("[WARN] No hay pacientes en la base de datos")
        
        # Probar stored procedures
        print("\n[INFO] Probando stored procedures...")
        doctors = get_doctors()
        print(f"[OK] get_doctors(): {len(doctors)} medicos encontrados")
        
        catalogos = get_catalogos()
        print(f"[OK] get_catalogos(): {len(catalogos)} catalogos encontrados")
        for cat_name in catalogos.keys():
            print(f"   - {cat_name}: {len(catalogos[cat_name])} items")
        
        # Probar obtener paciente por ID si existe
        if result:
            patient_id = result[0]['id']
            patient = get_patient_by_id(patient_id)
            if patient:
                print(f"[OK] get_patient_by_id({patient_id}): Paciente encontrado")
            else:
                print(f"[WARN] get_patient_by_id({patient_id}): No se encontro el paciente")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Error en PostgreSQL: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_mongodb():
    """Prueba la conexión a MongoDB y algunas colecciones"""
    print("\n" + "="*60)
    print("[TEST] PROBANDO MONGODB")
    print("="*60)
    
    try:
        db = get_mongo_db()
        print("[OK] Conexion a MongoDB establecida")
        
        # Listar colecciones
        collections = db.list_collection_names()
        print(f"[OK] Colecciones encontradas: {len(collections)}")
        for coll in collections:
            count = db[coll].count_documents({})
            print(f"   - {coll}: {count} documentos")
        
        # Verificar que las colecciones principales existen
        required_collections = [
            'sesion_avatar',
            'turno_conversacion',
            'interaccion_ia',
            'consulta_doc',
            'resumen_conversacion'
        ]
        
        print("\n[INFO] Verificando colecciones requeridas...")
        for coll_name in required_collections:
            if coll_name in collections:
                count = db[coll_name].count_documents({})
                print(f"[OK] {coll_name}: {count} documentos")
            else:
                print(f"[WARN] {coll_name}: No existe (se creara automaticamente al usarse)")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Error en MongoDB: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*60)
    print("[INICIO] VERIFICACION DE BASES DE DATOS")
    print("="*60)
    
    postgres_ok = test_postgres()
    mongo_ok = test_mongodb()
    
    print("\n" + "="*60)
    print("[RESUMEN]")
    print("="*60)
    print(f"PostgreSQL: {'[OK]' if postgres_ok else '[ERROR]'}")
    print(f"MongoDB:    {'[OK]' if mongo_ok else '[ERROR]'}")
    
    if postgres_ok and mongo_ok:
        print("\n[SUCCESS] Todas las bases de datos estan funcionando correctamente!")
        return 0
    else:
        print("\n[WARN] Hay problemas con alguna base de datos. Revisa los errores arriba.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

