#!/usr/bin/env python3
"""
Script para ver las interacciones de IA guardadas en MongoDB
"""
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Configuración MongoDB
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
MONGO_DB = os.getenv("MONGO_DB", "medico_mongo")
MONGO_USER = os.getenv("MONGO_USER", "app_user")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "app_password")

try:
    # Conectar a MongoDB (usar admin si app_user falla)
    try:
        mongo_uri = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin"
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
    except:
        # Intentar con usuario admin
        print("⚠️ Intentando con usuario admin...")
        mongo_uri = f"mongodb://admin:admin123@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin"
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[MONGO_DB]
    
    # Verificar conexión
    client.admin.command('ping')
    print("✅ Conectado a MongoDB\n")
    
    # Obtener interacciones
    collection = db.interaccion_ia
    count = collection.count_documents({})
    print(f"📊 Total de interacciones: {count}\n")
    
    if count > 0:
        print("=" * 80)
        print("ÚLTIMAS INTERACCIONES DE IA")
        print("=" * 80)
        
        interacciones = collection.find().sort("fecha", -1).limit(10)
        
        for i, doc in enumerate(interacciones, 1):
            print(f"\n[{i}] Interacción ID: {doc.get('_id')}")
            print(f"    Tipo: {doc.get('tipo', 'N/A')}")
            print(f"    Fecha: {doc.get('fecha', 'N/A')}")
            if doc.get('paciente_id'):
                print(f"    Paciente ID: {doc.get('paciente_id')}")
            if doc.get('usuario_id'):
                print(f"    Usuario ID: {doc.get('usuario_id')}")
            print(f"    Mensaje Usuario: {doc.get('mensaje_usuario', 'N/A')[:100]}...")
            print(f"    Respuesta IA: {doc.get('respuesta_ia', 'N/A')[:100]}...")
            print(f"    Modelo: {doc.get('modelo_ia', 'N/A')}")
            if doc.get('metadata'):
                print(f"    Metadata: {doc.get('metadata')}")
            print("-" * 80)
    else:
        print("⚠️ No hay interacciones guardadas aún.")
        print("   Las interacciones se guardan automáticamente cuando usas:")
        print("   - El avatar médico")
        print("   - Consultas de paciente (/api/ai/patient)")
        print("   - Consultas de doctor (/api/ai/doctor)")
    
    # También mostrar sesiones de avatar si existen
    sesiones = db.sesion_avatar
    sesiones_count = sesiones.count_documents({})
    if sesiones_count > 0:
        print(f"\n📊 Total de sesiones de avatar: {sesiones_count}")
        print("\nÚltimas sesiones:")
        for sesion in sesiones.find().sort("fecha_inicio", -1).limit(3):
            print(f"  - Sesión {sesion.get('_id')}: {sesion.get('canal')} - {sesion.get('fecha_inicio')}")
    
    # Turnos de conversación
    turnos = db.turno_conversacion
    turnos_count = turnos.count_documents({})
    if turnos_count > 0:
        print(f"\n📊 Total de turnos de conversación: {turnos_count}")
    
    client.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nVerifica que:")
    print("1. MongoDB esté corriendo (docker-compose ps)")
    print("2. Las credenciales en .env sean correctas")
    print("3. El usuario tenga permisos de lectura")

