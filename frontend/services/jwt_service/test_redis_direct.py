"""
Prueba directa de conexión a Redis
Verifica que Redis esté funcionando correctamente
"""
import os
import sys
import time
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

try:
    import redis
    from redis_service import RedisService
except ImportError as e:
    print(f"[ERROR] Error importando módulos: {e}")
    print("Instala las dependencias: pip install redis")
    sys.exit(1)

def test_redis_connection():
    """Prueba la conexión a Redis"""
    print("\n" + "="*60)
    print("PRUEBA DE CONEXION A REDIS")
    print("="*60 + "\n")
    
    try:
        redis_service = RedisService()
        print("[OK] RedisService inicializado")
        
        # Test 1: Ping
        print("\n[TEST 1] Ping a Redis...")
        if redis_service.check_connection():
            print("[OK] Redis responde al ping")
        else:
            print("[ERROR] Redis no responde")
            return False
        
        # Test 2: Almacenar y recuperar
        print("\n[TEST 2] Almacenar y recuperar datos...")
        test_key = "test:connection"
        test_value = f"test_value_{int(time.time())}"
        
        success = redis_service.store_token(test_key, test_value, 60)
        if success:
            print(f"[OK] Valor almacenado: {test_value}")
        else:
            print("[ERROR] No se pudo almacenar")
            return False
        
        retrieved = redis_service.get_token(test_key)
        if retrieved == test_value:
            print(f"[OK] Valor recuperado: {retrieved}")
        else:
            print(f"[ERROR] Valor no coincide. Esperado: {test_value}, Obtenido: {retrieved}")
            return False
        
        # Test 3: Verificar existencia
        print("\n[TEST 3] Verificar existencia de clave...")
        exists = redis_service.token_exists(test_key)
        if exists:
            print("[OK] Clave existe en Redis")
        else:
            print("[ERROR] Clave no encontrada")
            return False
        
        # Test 4: Eliminar
        print("\n[TEST 4] Eliminar clave...")
        deleted = redis_service.delete_token(test_key)
        if deleted:
            print("[OK] Clave eliminada correctamente")
        else:
            print("[ERROR] No se pudo eliminar la clave")
            return False
        
        # Test 5: Verificar que ya no existe
        exists_after = redis_service.token_exists(test_key)
        if not exists_after:
            print("[OK] Clave confirmada como eliminada")
        else:
            print("[WARN] Clave aún existe después de eliminar")
        
        # Test 6: Múltiples operaciones
        print("\n[TEST 5] Múltiples operaciones (stress test básico)...")
        start_time = time.time()
        operations = 100
        success_count = 0
        
        for i in range(operations):
            key = f"test:stress:{i}"
            value = f"value_{i}"
            if redis_service.store_token(key, value, 10):
                if redis_service.get_token(key) == value:
                    success_count += 1
                redis_service.delete_token(key)
        
        elapsed = time.time() - start_time
        print(f"[OK] {success_count}/{operations} operaciones exitosas en {elapsed:.2f}s")
        print(f"     Promedio: {elapsed/operations*1000:.2f}ms por operación")
        
        print("\n" + "="*60)
        print("[SUCCESS] Todas las pruebas de Redis pasaron correctamente!")
        print("="*60 + "\n")
        return True
        
    except Exception as e:
        print(f"\n[ERROR] Error en las pruebas: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_redis_connection()
    sys.exit(0 if success else 1)

