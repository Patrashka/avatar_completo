// Inicialización de MongoDB para el sistema médico
// Este script se ejecuta automáticamente al crear el contenedor

db = db.getSiblingDB('medico_mongo');

// Crear usuario para la aplicación
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [
    { role: 'readWrite', db: 'medico_mongo' }
  ]
});

// Crear colecciones con validación de esquema
db.createCollection("sesion_avatar", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["usuario_id", "canal", "idioma", "fecha_inicio"],
      properties: {
        usuario_id: { bsonType: "int" },
        paciente_id: { bsonType: ["int", "null"] },
        medico_id: { bsonType: ["int", "null"] },
        canal: { bsonType: "string", description: "medio: voz, texto, video, etc." },
        idioma: { bsonType: "string", description: "idioma principal de la sesión" },
        fecha_inicio: { bsonType: "date" },
        fecha_fin: { bsonType: ["date", "null"] },
        stream_id: { bsonType: ["string", "null"] },
        session_id: { bsonType: ["string", "null"] }
      }
    }
  }
});

db.createCollection("turno_conversacion", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_sesion", "origen", "texto", "fecha"],
      properties: {
        id_sesion: { bsonType: "objectId" },
        origen: { bsonType: "string", enum: ["usuario", "avatar", "sistema", "ia"] },
        texto: { bsonType: "string" },
        fecha: { bsonType: "date" },
        metadata: { bsonType: ["object", "null"] }
      }
    }
  }
});

db.createCollection("intencion_entidad", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_turno", "intencion"],
      properties: {
        id_turno: { bsonType: "objectId" },
        intencion: { bsonType: "string" },
        entidades: { bsonType: ["array", "null"], items: { bsonType: "object" } }
      }
    }
  }
});

db.createCollection("resumen_conversacion", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_sesion", "texto", "tipo"],
      properties: {
        id_sesion: { bsonType: "objectId" },
        texto: { bsonType: "string" },
        tipo: { bsonType: "string", enum: ["parcial", "final", "emocional", "clínico"] },
        fecha: { bsonType: "date" }
      }
    }
  }
});

db.createCollection("evento_leapmotion", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_sesion", "tipo_evento", "datos"],
      properties: {
        id_sesion: { bsonType: "objectId" },
        tipo_evento: { bsonType: "string", description: "ej: gesto, postura, movimiento" },
        datos: { bsonType: "object" },
        fecha: { bsonType: "date" }
      }
    }
  }
});

db.createCollection("metrica_avatar", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_sesion"],
      properties: {
        id_sesion: { bsonType: "objectId" },
        latencia_ms: { bsonType: ["int", "null"] },
        confianza: { bsonType: ["double", "null"] },
        hand_off: { bsonType: ["bool", "null"], description: "si el control pasó a humano" },
        fecha: { bsonType: "date" }
      }
    }
  }
});

db.createCollection("consulta_doc", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["consulta_id", "narrativa", "creado_en"],
      properties: {
        consulta_id: { bsonType: "int", description: "referencia al id de consulta en Postgres" },
        narrativa: { bsonType: "string" },
        transcript: { bsonType: ["string", "null"] },
        resumen: { bsonType: ["string", "null"] },
        creado_en: { bsonType: "date" }
      }
    }
  }
});

// Colección para interacciones de IA
db.createCollection("interaccion_ia", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["tipo", "fecha"],
      properties: {
        tipo: { bsonType: "string", enum: ["avatar", "paciente", "doctor", "archivo"] },
        usuario_id: { bsonType: ["int", "null"] },
        paciente_id: { bsonType: ["int", "null"] },
        consulta_id: { bsonType: ["int", "null"] },
        mensaje_usuario: { bsonType: ["string", "null"] },
        respuesta_ia: { bsonType: ["string", "null"] },
        modelo_ia: { bsonType: ["string", "null"] },
        metadata: { bsonType: ["object", "null"] },
        fecha: { bsonType: "date" }
      }
    }
  }
});

// Crear índices para mejorar el rendimiento
db.sesion_avatar.createIndex({ "usuario_id": 1, "fecha_inicio": -1 });
db.sesion_avatar.createIndex({ "paciente_id": 1 });
db.turno_conversacion.createIndex({ "id_sesion": 1, "fecha": -1 });
db.interaccion_ia.createIndex({ "tipo": 1, "fecha": -1 });
db.interaccion_ia.createIndex({ "paciente_id": 1, "fecha": -1 });
db.consulta_doc.createIndex({ "consulta_id": 1 });

print("✅ MongoDB inicializado correctamente");

