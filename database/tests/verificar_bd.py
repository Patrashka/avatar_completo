#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de verificación de base de datos
Verifica que la configuración sea compatible entre CMS y Avatar App
"""

import os
import sys
from pathlib import Path

# Configurar encoding para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Agregar el directorio frontend al path
frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
sys.path.insert(0, str(frontend_dir))

try:
    from db_connection import (
        get_postgres_connection,
        get_mongo_client,
        execute_query,
        warmup_postgres_connection
    )
except ImportError as e:
    print(f"❌ Error importando db_connection: {e}")
    print("Asegúrate de estar en el directorio correcto")
    sys.exit(1)

def verificar_postgres():
    """Verifica la conexión y configuración de PostgreSQL"""
    print("\n" + "="*60)
    print("🔍 VERIFICANDO POSTGRESQL")
    print("="*60)
    
    try:
        conn = get_postgres_connection()
        print("✅ Conexión a PostgreSQL establecida")
        
        # Verificar base de datos
        with conn.cursor() as cursor:
            cursor.execute("SELECT current_database(), current_user")
            db_name, db_user = cursor.fetchone()
            print(f"   Base de datos: {db_name}")
            print(f"   Usuario: {db_user}")
            
            # Verificar que las tablas principales existan
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            tables = [row[0] for row in cursor.fetchall()]
            
            tablas_requeridas = [
                'USUARIO', 'PACIENTE', 'MEDICO', 'CONSULTA', 
                'ARCHIVO', 'ARCHIVO_ASOCIACION', 'TIPO_SANGRE',
                'OCUPACION', 'ESTADO_CIVIL', 'ESPECIALIDAD'
            ]
            
            print(f"\n📊 Tablas encontradas: {len(tables)}")
            faltantes = []
            for tabla in tablas_requeridas:
                if tabla in tables:
                    print(f"   ✅ {tabla}")
                else:
                    print(f"   ❌ {tabla} - FALTANTE")
                    faltantes.append(tabla)
            
            if faltantes:
                print(f"\n⚠️  Advertencia: Faltan {len(faltantes)} tablas requeridas")
                return False
            
            # Verificar stored procedures
            print("\n🔧 Verificando Stored Procedures...")
            cursor.execute("""
                SELECT routine_name 
                FROM information_schema.routines 
                WHERE routine_schema = 'public' 
                AND routine_type = 'FUNCTION'
                AND routine_name LIKE '%_sp'
                ORDER BY routine_name
            """)
            procedures = [row[0] for row in cursor.fetchall()]
            
            procedures_requeridas = [
                'get_patient_by_id_sp',
                'get_patient_consultations_sp',
                'get_patient_files_sp',
                'get_patient_diagnoses_sp',
                'get_doctor_by_id_sp',
                'get_doctor_patients_sp',
                'search_doctor_patients_sp',
                'update_patient_sp',
                'update_consultation_sp'
            ]
            
            print(f"   Procedimientos encontrados: {len(procedures)}")
            faltantes_proc = []
            for proc in procedures_requeridas:
                if proc in procedures:
                    print(f"   ✅ {proc}")
                else:
                    print(f"   ❌ {proc} - FALTANTE")
                    faltantes_proc.append(proc)
            
            if faltantes_proc:
                print(f"\n⚠️  Advertencia: Faltan {len(faltantes_proc)} stored procedures")
                print("   Ejecuta: database/create_procedures.sql")
                return False
            
            # Verificar datos de ejemplo
            cursor.execute("SELECT COUNT(*) FROM USUARIO")
            user_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM PACIENTE")
            patient_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM MEDICO")
            doctor_count = cursor.fetchone()[0]
            
            print(f"\n📈 Datos de ejemplo:")
            print(f"   Usuarios: {user_count}")
            print(f"   Pacientes: {patient_count}")
            print(f"   Médicos: {doctor_count}")
            
            if user_count == 0:
                print("   ⚠️  No hay usuarios de ejemplo")
            
        return True
        
    except Exception as e:
        print(f"❌ Error verificando PostgreSQL: {e}")
        return False

def verificar_mongo():
    """Verifica la conexión y configuración de MongoDB"""
    print("\n" + "="*60)
    print("🔍 VERIFICANDO MONGODB")
    print("="*60)
    
    try:
        client = get_mongo_client()
        client.admin.command('ping')
        print("✅ Conexión a MongoDB establecida")
        
        db = client.get_database()
        print(f"   Base de datos: {db.name}")
        
        # Verificar colecciones
        collections = db.list_collection_names()
        print(f"\n📊 Colecciones encontradas: {len(collections)}")
        
        colecciones_requeridas = [
            'interaccion_ia',
            'sesion_avatar',
            'turno_conversacion',
            'did_conversations'
        ]
        
        for coleccion in colecciones_requeridas:
            if coleccion in collections:
                count = db[coleccion].count_documents({})
                print(f"   ✅ {coleccion} ({count} documentos)")
            else:
                print(f"   ⚠️  {coleccion} - No existe (se creará automáticamente)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error verificando MongoDB: {e}")
        return False

def verificar_compatibilidad_cms():
    """Verifica que la configuración sea compatible con CMS"""
    print("\n" + "="*60)
    print("🔍 VERIFICANDO COMPATIBILIDAD CON CMS")
    print("="*60)
    
    # Verificar variables de entorno esperadas por CMS
    env_vars_cms = {
        'DB_NAME': 'medico_db',
        'DB_USER': 'admin',
        'DB_PASSWORD': 'admin123',
        'DB_HOST': 'localhost',
        'DB_PORT': '5432'
    }
    
    print("📋 Variables de entorno esperadas por CMS:")
    for var, expected in env_vars_cms.items():
        actual = os.getenv(var, 'NO CONFIGURADA')
        if actual == expected or actual == 'NO CONFIGURADA':
            status = "✅" if actual == expected else "⚠️ "
            print(f"   {status} {var}={actual} (esperado: {expected})")
        else:
            print(f"   ❌ {var}={actual} (esperado: {expected})")
    
    # Verificar que la BD sea accesible con estas credenciales
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=env_vars_cms['DB_HOST'],
            port=env_vars_cms['DB_PORT'],
            database=env_vars_cms['DB_NAME'],
            user=env_vars_cms['DB_USER'],
            password=env_vars_cms['DB_PASSWORD']
        )
        conn.close()
        print("\n✅ CMS puede conectarse con las credenciales configuradas")
        return True
    except Exception as e:
        print(f"\n❌ CMS NO puede conectarse: {e}")
        return False

def main():
    """Función principal"""
    print("\n" + "="*60)
    print("🔍 VERIFICACIÓN DE BASE DE DATOS")
    print("   CMS y Avatar App - Compatibilidad")
    print("="*60)
    
    resultados = {
        'postgres': verificar_postgres(),
        'mongo': verificar_mongo(),
        'cms': verificar_compatibilidad_cms()
    }
    
    print("\n" + "="*60)
    print("📊 RESUMEN")
    print("="*60)
    
    todos_ok = all(resultados.values())
    
    for servicio, ok in resultados.items():
        status = "✅ OK" if ok else "❌ ERROR"
        print(f"   {servicio.upper()}: {status}")
    
    if todos_ok:
        print("\n✅ ¡Todas las verificaciones pasaron!")
        print("   La base de datos está correctamente configurada para ambos proyectos.")
        return 0
    else:
        print("\n⚠️  Algunas verificaciones fallaron.")
        print("   Revisa los errores arriba y corrige la configuración.")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Verificación cancelada por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

