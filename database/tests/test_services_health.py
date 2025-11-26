"""
Script para verificar que los microservicios pueden conectarse a las bases de datos
"""
import sys
import os
import requests
import time

# Configurar encoding para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# URLs de los microservicios
SERVICES = {
    'auth': 'http://127.0.0.1:8010',
    'doctor': 'http://127.0.0.1:8011',
    'patient': 'http://127.0.0.1:8012',
    'ai': 'http://127.0.0.1:8013'
}

def test_service_health(service_name, base_url):
    """Prueba el endpoint /health de un servicio"""
    try:
        url = f"{base_url}/health"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            status = data.get('status', 'unknown')
            db_status = data.get('db', 'unknown')
            
            if status == 'ok':
                if db_status == 'unavailable':
                    print(f"[WARN] {service_name}: Servicio OK pero BD no disponible")
                    if 'db_warning' in data:
                        print(f"        Warning: {data['db_warning']}")
                    return False
                else:
                    print(f"[OK] {service_name}: Servicio y BD funcionando")
                    return True
            else:
                print(f"[ERROR] {service_name}: Estado desconocido: {status}")
                return False
        else:
            print(f"[ERROR] {service_name}: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"[WARN] {service_name}: Servicio no esta corriendo en {base_url}")
        return None  # No es un error, solo no está corriendo
    except Exception as e:
        print(f"[ERROR] {service_name}: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("[TEST] VERIFICACION DE MICROSERVICIOS")
    print("="*60)
    print("\n[INFO] Verificando endpoints /health de cada servicio...")
    print("[INFO] Si un servicio no esta corriendo, aparecera como [WARN]\n")
    
    results = {}
    for service_name, base_url in SERVICES.items():
        results[service_name] = test_service_health(service_name, base_url)
        time.sleep(0.5)  # Pequeña pausa entre requests
    
    print("\n" + "="*60)
    print("[RESUMEN]")
    print("="*60)
    
    running = [name for name, result in results.items() if result is not None]
    not_running = [name for name, result in results.items() if result is None]
    working = [name for name, result in results.items() if result is True]
    
    if running:
        print(f"Servicios corriendo: {', '.join(running)}")
    if working:
        print(f"Servicios funcionando correctamente: {', '.join(working)}")
    if not_running:
        print(f"Servicios no iniciados: {', '.join(not_running)}")
        print("\n[INFO] Para iniciar los servicios, ejecuta:")
        print("       cd frontend/services")
        print("       ./start_services.ps1")
    
    if all(r is True for r in results.values() if r is not None):
        print("\n[SUCCESS] Todos los servicios activos estan funcionando correctamente!")
        return 0
    elif any(r is True for r in results.values()):
        print("\n[WARN] Algunos servicios tienen problemas. Revisa los mensajes arriba.")
        return 1
    else:
        print("\n[INFO] Ningun servicio esta corriendo actualmente.")
        return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n[INFO] Verificacion cancelada por el usuario")
        sys.exit(0)

