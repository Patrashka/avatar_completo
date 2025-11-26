"""
Script para mostrar las credenciales de los usuarios de prueba
"""
import sys
import os

# Configurar encoding para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Agregar el directorio frontend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'frontend'))

try:
    from db_connection import execute_query
except ImportError as e:
    print(f"[ERROR] Error importando db_connection: {e}")
    sys.exit(1)

def main():
    print("\n" + "="*60)
    print("CREDENCIALES DE USUARIOS DE PRUEBA")
    print("="*60 + "\n")
    
    # Obtener usuarios con sus roles
    query = """
        SELECT 
            u.username,
            u.correo,
            u.rol_id,
            CASE 
                WHEN u.rol_id = 2 THEN m.nombre 
                WHEN u.rol_id = 3 THEN p.nombre 
            END as nombre,
            CASE 
                WHEN u.rol_id = 2 THEN 'Medico' 
                WHEN u.rol_id = 3 THEN 'Paciente' 
            END as rol_nombre
        FROM USUARIO u
        LEFT JOIN MEDICO m ON m.usuario_id = u.id
        LEFT JOIN PACIENTE p ON p.usuario_id = u.id
        WHERE u.rol_id IN (2, 3)
        ORDER BY u.rol_id, u.username
    """
    
    try:
        users = execute_query(query)
        
        if not users:
            print("[WARN] No se encontraron usuarios en la base de datos")
            return
        
        print("PACIENTES:\n")
        pacientes = [u for u in users if u['rol_id'] == 3]
        for user in pacientes:
            print(f"  Usuario: {user['username']}")
            print(f"  Email:   {user['correo']}")
            print(f"  Nombre:  {user['nombre']}")
            print(f"  Contraseña: password123")
            print()
        
        print("\nMEDICOS:\n")
        medicos = [u for u in users if u['rol_id'] == 2]
        for user in medicos:
            print(f"  Usuario: {user['username']}")
            print(f"  Email:   {user['correo']}")
            print(f"  Nombre:  {user['nombre']}")
            print(f"  Contraseña: password123")
            print()
        
        print("="*60)
        print("\nNOTA: Todos los usuarios de prueba usan la contraseña: password123")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"[ERROR] Error consultando usuarios: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

