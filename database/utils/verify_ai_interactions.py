#!/usr/bin/env python3
"""
Script para verificar que las interacciones de IA se están guardando en MongoDB
"""

import os
import sys
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Configuración de MongoDB
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = int(os.getenv("MONGO_PORT", "27017"))
MONGO_DB_NAME = os.getenv("MONGO_DB", "medico_mongo")
MONGO_USER = os.getenv("MONGO_USER", "app_user")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "app_password")

def build_mongo_uri():
    """Construye la URI de conexión a MongoDB"""
    return f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}?authSource=admin"

def verify_connection():
    """Verifica la conexión a MongoDB"""
    # Intentar primero con app_user
    try:
        uri = build_mongo_uri()
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        return client, True
    except Exception as e:
        print(f"⚠️  Error con app_user, intentando con admin...")
        # Intentar con admin como fallback
        try:
            admin_uri = f"mongodb://admin:admin123@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}?authSource=admin"
            client = MongoClient(admin_uri, serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            return client, True
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"❌ Error de conexión a MongoDB: {e}")
            return None, False
        except Exception as e2:
            print(f"❌ Error inesperado: {e2}")
            return None, False

def check_collections(db):
    """Verifica que las colecciones existan"""
    collections = db.list_collection_names()
    required_collections = ["interaccion_ia", "did_conversations"]
    
    print("\n📋 Colecciones en MongoDB:")
    for coll in collections:
        status = "✅" if coll in required_collections else "  "
        print(f"   {status} {coll}")
    
    missing = [c for c in required_collections if c not in collections]
    if missing:
        print(f"\n⚠️  Colecciones faltantes: {', '.join(missing)}")
        print("   (Esto es normal si aún no se han guardado conversaciones D-ID)")
    return True  # Continuar aunque falten algunas colecciones

def check_interaccion_ia(db):
    """Verifica la colección interaccion_ia"""
    collection = db.interaccion_ia
    
    # Contar documentos
    count = collection.count_documents({})
    print(f"\n📊 Colección 'interaccion_ia':")
    print(f"   Total de documentos: {count}")
    
    if count == 0:
        print("   ⚠️  No hay interacciones guardadas aún")
        return
    
    # Obtener los últimos 5 documentos
    print("\n   Últimas 5 interacciones:")
    recent = collection.find().sort("fecha", -1).limit(5)
    
    for i, doc in enumerate(recent, 1):
        print(f"\n   {i}. Tipo: {doc.get('tipo', 'N/A')}")
        print(f"      Fecha: {doc.get('fecha', 'N/A')}")
        print(f"      Usuario ID: {doc.get('usuario_id', 'N/A')}")
        print(f"      Paciente ID: {doc.get('paciente_id', 'N/A')}")
        print(f"      Mensaje usuario: {doc.get('mensaje_usuario', 'N/A')[:50]}..." if doc.get('mensaje_usuario') else "      Mensaje usuario: N/A")
        print(f"      Respuesta IA: {doc.get('respuesta_ia', 'N/A')[:50]}..." if doc.get('respuesta_ia') else "      Respuesta IA: N/A")
        print(f"      Modelo IA: {doc.get('modelo_ia', 'N/A')}")
    
    # Estadísticas por tipo
    print("\n   Estadísticas por tipo:")
    pipeline = [
        {"$group": {
            "_id": "$tipo",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    stats = list(collection.aggregate(pipeline))
    for stat in stats:
        print(f"      {stat['_id']}: {stat['count']} interacciones")

def check_did_conversations(db):
    """Verifica la colección did_conversations"""
    # Verificar si la colección existe
    collections = db.list_collection_names()
    if "did_conversations" not in collections:
        print(f"\n📊 Colección 'did_conversations':")
        print("   ⚠️  La colección no existe aún")
        print("   💡 Se creará automáticamente cuando se guarden las primeras conversaciones D-ID")
        return
    
    collection = db.did_conversations
    
    # Contar documentos
    count = collection.count_documents({})
    print(f"\n📊 Colección 'did_conversations':")
    print(f"   Total de conversaciones: {count}")
    
    if count == 0:
        print("   ⚠️  No hay conversaciones guardadas aún")
        return
    
    # Obtener las últimas 5 conversaciones
    print("\n   Últimas 5 conversaciones:")
    recent = collection.find().sort("updatedAt", -1).limit(5)
    
    for i, doc in enumerate(recent, 1):
        messages_count = len(doc.get('messages', []))
        print(f"\n   {i}. Agent ID: {doc.get('agentId', 'N/A')}")
        print(f"      Chat ID: {doc.get('chatId', 'N/A')}")
        print(f"      Usuario ID: {doc.get('userId', 'N/A')}")
        print(f"      Paciente ID: {doc.get('patientId', 'N/A')}")
        print(f"      Mensajes: {messages_count}")
        print(f"      Creado: {doc.get('createdAt', 'N/A')}")
        print(f"      Actualizado: {doc.get('updatedAt', 'N/A')}")
        
        # Mostrar último mensaje
        if messages_count > 0:
            last_msg = doc['messages'][-1]
            print(f"      Último mensaje ({last_msg.get('role', 'N/A')}): {last_msg.get('content', 'N/A')[:50]}...")
    
    # Estadísticas
    print("\n   Estadísticas:")
    total_messages = sum(len(doc.get('messages', [])) for doc in collection.find())
    print(f"      Total de mensajes: {total_messages}")
    
    # Por paciente
    pipeline = [
        {"$match": {"patientId": {"$ne": None}}},
        {"$group": {
            "_id": "$patientId",
            "conversations": {"$sum": 1},
            "messages": {"$sum": {"$size": "$messages"}}
        }},
        {"$sort": {"conversations": -1}},
        {"$limit": 5}
    ]
    by_patient = list(collection.aggregate(pipeline))
    if by_patient:
        print("\n   Top 5 pacientes por conversaciones:")
        for stat in by_patient:
            print(f"      Paciente {stat['_id']}: {stat['conversations']} conversaciones, {stat['messages']} mensajes")

def main():
    print("=" * 60)
    print("🔍 Verificación de Interacciones de IA en MongoDB")
    print("=" * 60)
    
    # Verificar conexión
    print("\n1️⃣ Verificando conexión a MongoDB...")
    client, connected = verify_connection()
    
    if not connected:
        print("\n❌ No se pudo conectar a MongoDB")
        print("\n💡 Verifica que:")
        print("   - MongoDB esté corriendo (docker-compose up -d)")
        print("   - Las credenciales sean correctas")
        print("   - El puerto 27017 esté disponible")
        sys.exit(1)
    
    print("✅ Conexión exitosa a MongoDB")
    
    # Obtener base de datos
    db = client[MONGO_DB_NAME]
    
    # Verificar colecciones
    print("\n2️⃣ Verificando colecciones...")
    check_collections(db)  # Continuar aunque falten algunas
    
    # Verificar interaccion_ia
    print("\n3️⃣ Verificando colección 'interaccion_ia'...")
    check_interaccion_ia(db)
    
    # Verificar did_conversations
    print("\n4️⃣ Verificando colección 'did_conversations'...")
    check_did_conversations(db)
    
    # Resumen
    print("\n" + "=" * 60)
    print("✅ Verificación completada")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    main()

