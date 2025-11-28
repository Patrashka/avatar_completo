#!/usr/bin/env python3
"""
Script para probar que las interacciones de IA se guardan correctamente en MongoDB
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

def connect_mongo():
    """Conecta a MongoDB con fallback a admin"""
    try:
        uri = build_mongo_uri()
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        return client
    except Exception:
        # Intentar con admin
        admin_uri = f"mongodb://admin:admin123@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}?authSource=admin"
        client = MongoClient(admin_uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        return client

def test_save_interaction():
    """Prueba guardar una interacción de IA"""
    print("=" * 60)
    print("🧪 Prueba de Guardado de Interacción de IA")
    print("=" * 60)
    
    try:
        # Conectar
        print("\n1️⃣ Conectando a MongoDB...")
        client = connect_mongo()
        db = client[MONGO_DB_NAME]
        print("✅ Conectado exitosamente")
        
        # Obtener colección
        collection = db.interaccion_ia
        
        # Crear documento de prueba
        test_doc = {
            "tipo": "avatar",
            "fecha": datetime.utcnow(),
            "usuario_id": 1,
            "paciente_id": 1,
            "mensaje_usuario": "Hola, tengo dolor de cabeza",
            "respuesta_ia": "Entiendo que tienes dolor de cabeza. ¿Desde cuándo lo sientes?",
            "modelo_ia": "gpt-4o-mini",
            "metadata": {
                "test": True,
                "source": "test_script"
            }
        }
        
        # Guardar
        print("\n2️⃣ Guardando interacción de prueba...")
        result = collection.insert_one(test_doc)
        print(f"✅ Interacción guardada con ID: {result.inserted_id}")
        
        # Verificar que se guardó
        print("\n3️⃣ Verificando que se guardó correctamente...")
        saved_doc = collection.find_one({"_id": result.inserted_id})
        
        if saved_doc:
            print("✅ Interacción encontrada en MongoDB:")
            print(f"   ID: {saved_doc['_id']}")
            print(f"   Tipo: {saved_doc.get('tipo')}")
            print(f"   Fecha: {saved_doc.get('fecha')}")
            print(f"   Mensaje usuario: {saved_doc.get('mensaje_usuario')}")
            print(f"   Respuesta IA: {saved_doc.get('respuesta_ia')}")
            print(f"   Modelo: {saved_doc.get('modelo_ia')}")
        else:
            print("❌ Error: No se encontró la interacción guardada")
            return False
        
        # Limpiar (opcional)
        print("\n4️⃣ ¿Deseas eliminar la interacción de prueba? (s/n): ", end="")
        # En modo automático, no preguntamos
        # response = input().strip().lower()
        # if response == 's':
        #     collection.delete_one({"_id": result.inserted_id})
        #     print("✅ Interacción de prueba eliminada")
        
        print("\n" + "=" * 60)
        print("✅ Prueba completada exitosamente")
        print("=" * 60)
        print("\n💡 Para ver todas las interacciones, ejecuta:")
        print("   python verify_ai_interactions.py")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_save_interaction()
    sys.exit(0 if success else 1)

