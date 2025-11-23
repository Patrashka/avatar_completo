#!/usr/bin/env python3
"""
Script para probar el guardado de interacciones en MongoDB
"""
from db_connection import save_ia_interaction
from datetime import datetime

print("🧪 Probando guardado de interacciones...\n")

try:
    # Probar guardar una interacción
    interaction_id = save_ia_interaction(
        tipo="test",
        mensaje_usuario="Hola, tengo dolor de cabeza",
        respuesta_ia="Entiendo tu preocupación. El dolor de cabeza puede tener varias causas. ¿Desde cuándo lo tienes?",
        paciente_id=1,
        usuario_id=1,
        modelo_ia="gemini-2.5-flash",
        metadata={"test": True, "fecha_prueba": datetime.now().isoformat()}
    )
    
    print(f"✅ Interacción guardada con ID: {interaction_id}\n")
    
    # Verificar que se guardó
    from db_connection import get_mongo_db
    db = get_mongo_db()
    collection = db.interaccion_ia
    
    count = collection.count_documents({})
    print(f"📊 Total de interacciones en BD: {count}\n")
    
    if count > 0:
        print("Última interacción guardada:")
        last = collection.find_one(sort=[("fecha", -1)])
        print(f"  - Tipo: {last.get('tipo')}")
        print(f"  - Fecha: {last.get('fecha')}")
        print(f"  - Mensaje: {last.get('mensaje_usuario', 'N/A')[:50]}...")
        print(f"  - Respuesta: {last.get('respuesta_ia', 'N/A')[:50]}...")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

