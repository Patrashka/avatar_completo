db.createCollection("sesion_avatar", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["usuario_id", "canal", "idioma", "fecha_inicio"],
      properties: {
        usuario_id: { bsonType: "int" },
        paciente_id: { bsonType: "int" },
        medico_id: { bsonType: "int" },
        canal: { bsonType: "string", description: "medio: voz, texto, video, etc." },
        idioma: { bsonType: "string", description: "idioma principal de la sesión" },
        fecha_inicio: { bsonType: "date" },
        fecha_fin: { bsonType: "date" }
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
        origen: { bsonType: "string", enum: ["usuario", "avatar", "sistema"] },
        texto: { bsonType: "string" },
        fecha: { bsonType: "date" }
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
        entidades: { bsonType: "array", items: { bsonType: "object" } }
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
        tipo: { bsonType: "string", enum: ["parcial", "final", "emocional", "clínico"] }
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
        datos: { bsonType: "object" }
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
        latencia_ms: { bsonType: "int" },
        confianza: { bsonType: "double" },
        hand_off: { bsonType: "bool", description: "si el control pasó a humano" }
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
        transcript: { bsonType: "string" },
        resumen: { bsonType: "string" },
        creado_en: { bsonType: "date" }
      }
    }
  }
});

