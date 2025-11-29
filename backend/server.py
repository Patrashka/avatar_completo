import os
import json
import sys
import traceback
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any, Dict, Optional
import requests
from bson import ObjectId
from bson.errors import InvalidId

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from pathlib import Path

# Cargar .env desde el directorio del backend
backend_dir = Path(__file__).parent
env_path = backend_dir / '.env'

if env_path.exists():
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# También intentar con load_dotenv por si acaso
load_dotenv(dotenv_path=env_path, override=True)

from openai import OpenAI

app = Flask(__name__)
CORS(app)

# ===== MongoDB setup =====
MONGO_URI = os.getenv("MONGO_URI")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB_NAME = os.getenv("MONGO_DB", "medico_mongo")
MONGO_USER = os.getenv("MONGO_USER")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")

_mongo_client: Optional[MongoClient] = None
_mongo_db = None


def _build_mongo_uri() -> str:
    if MONGO_URI:
        return MONGO_URI
    # Usar admin por defecto si no hay credenciales específicas
    if MONGO_USER and MONGO_PASSWORD:
        auth_part = f"{MONGO_USER}:{MONGO_PASSWORD}@"
    else:
        # Fallback a admin si no hay credenciales configuradas
        auth_part = "admin:admin123@"
    return f"mongodb://{auth_part}{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}?authSource=admin"


def get_mongo_collection(name: str):
    global _mongo_client, _mongo_db
    if _mongo_client is None:
        # Intentar primero con admin (más confiable, tiene todos los permisos)
        admin_uri = f"mongodb://admin:admin123@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}?authSource=admin"
        print(f"🔌 Conectando a MongoDB: {MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}")
        try:
            print(f"   Intentando con usuario admin...")
            _mongo_client = MongoClient(admin_uri, serverSelectionTimeoutMS=5000)
            # Verificar conexión y autenticación
            _mongo_client.admin.command('ping')
            print("✅ Conexión a MongoDB exitosa (con admin)")
        except Exception as e:
            print(f"❌ Error con admin: {e}")
            # Intentar con credenciales personalizadas si existen
            try:
                uri = _build_mongo_uri()
                print(f"⚠️  Intentando con credenciales personalizadas...")
                _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
                _mongo_client.admin.command('ping')
                print("✅ Conexión a MongoDB exitosa (con credenciales personalizadas)")
            except Exception as e2:
                print(f"❌ Error con credenciales personalizadas: {e2}")
                raise PyMongoError(f"No se pudo conectar a MongoDB: {e2}")
    
    # Verificar que la conexión sigue activa y autenticada
    try:
        _mongo_client.admin.command('ping')
    except Exception as e:
        print(f"⚠️  Conexión MongoDB perdida, reconectando...")
        _mongo_client = None
        _mongo_db = None
        # Reintentar conexión
        return get_mongo_collection(name)
    
    if _mongo_db is None:
        _mongo_db = _mongo_client[MONGO_DB_NAME]
    
    # Verificar autenticación intentando acceder a la colección
    try:
        collection = _mongo_db[name]
        # Hacer una operación de prueba para verificar permisos
        collection.find_one({}, limit=1)
        return collection
    except Exception as e:
        error_str = str(e).lower()
        print(f"❌ Error accediendo a colección {name}: {e}")
        # Si falla por autenticación, intentar reconectar con admin
        if "authentication" in error_str or "unauthorized" in error_str or "requires authentication" in error_str:
            print(f"⚠️  Error de autenticación detectado, reconectando con admin...")
            _mongo_client = None
            _mongo_db = None
            return get_mongo_collection(name)  # Reintentar
        raise PyMongoError(f"Error accediendo a colección {name}: {e}")


def _safe_int(value: Any):
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None

# ===== OpenAI =====
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

print(f"🔑 OPENAI_API_KEY encontrada: {bool(OPENAI_API_KEY)}")
if OPENAI_API_KEY:
    print(f"   Longitud: {len(OPENAI_API_KEY)} caracteres")
    print(f"   Empieza con: {OPENAI_API_KEY[:10]}...")

if not OPENAI_API_KEY:
    print(f"❌ ERROR: No se encontró OPENAI_API_KEY")
    print(f"📋 Variables de entorno disponibles:")
    for key in sorted(os.environ.keys()):
        if 'OPENAI' in key or 'API' in key:
            print(f"   {key} = {os.environ[key][:20]}...")
    raise RuntimeError("Falta OPENAI_API_KEY en .env")

openai_client = OpenAI(api_key=OPENAI_API_KEY)

# ===== XML UTILITIES =====
def parse_xml_request():
    """Parse XML request body and return dict"""
    try:
        xml_data = request.data.decode('utf-8')
        root = ET.fromstring(xml_data)
        data = {}
        for child in root:
            if child.tag == 'patient':
                data['patient'] = {}
                for patient_child in child:
                    data['patient'][patient_child.tag] = patient_child.text
            elif child.tag == 'studies':
                data['studies'] = [study.text for study in child.findall('study')]
            else:
                data[child.tag] = child.text
        return data
    except Exception as e:
        return {}

def create_xml_response(data):
    """Create XML response from dict"""
    root = ET.Element('response')
    for key, value in data.items():
        elem = ET.SubElement(root, key)
        elem.text = str(value)
    
    xml_str = ET.tostring(root, encoding='unicode')
    return Response(xml_str, mimetype='application/xml')

def is_mobile_client():
    """Detect if request is from mobile app"""
    user_agent = request.headers.get('User-Agent', '').lower()
    return 'mobile' in user_agent or 'android' in user_agent or 'ios' in user_agent

# ===== Health Check =====
@app.get("/health")
def health():
    """Health check endpoint"""
    try:
        # Verificar MongoDB
        collection = get_mongo_collection("did_conversations")
        collection.find_one({})  # Test query
        return jsonify({"status": "healthy", "mongodb": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "degraded", "mongodb": "disconnected", "error": str(e)}), 200

# ===== D-ID Conversations =====
@app.post("/api/did/conversations")
def save_did_conversation():
    """
    Guarda un mensaje en la conversación D-ID.
    Agrupa mensajes por agentId/chatId (mapeados desde agentSessionId/agentConversationId).
    Compatible con el formato del conversation-service.js
    """
    data: Dict[str, Any] = request.get_json(silent=True) or {}
    role = data.get("role")
    if role not in {"user", "agent"}:
        return jsonify({"error": "El campo 'role' es obligatorio y debe ser 'user' o 'agent'."}), 400

    text = (data.get("text") or "").strip()
    audio_url = data.get("audioUrl")
    if not text and not audio_url:
        return jsonify({"error": "Debe incluir 'text' o 'audioUrl'."}), 400

    # Mapear agentSessionId/agentConversationId a agentId/chatId para compatibilidad
    agent_id = data.get("agentId") or data.get("agentSessionId") or data.get("agent_session_id")
    chat_id = data.get("chatId") or data.get("agentConversationId") or data.get("agent_conversation_id")
    
    if not agent_id or not chat_id:
        return jsonify({"error": "agentId/chatId o agentSessionId/agentConversationId requeridos"}), 400
    
    patient_id = _safe_int(data.get("patientId"))
    # Aceptar tanto "usuarioId" como "userId" para compatibilidad
    usuario_id = _safe_int(data.get("usuarioId")) or _safe_int(data.get("userId"))
    
    # Timestamp del mensaje
    timestamp_str = data.get("startedAt") or data.get("finishedAt") or data.get("timestamp")
    if timestamp_str:
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except:
            timestamp = datetime.utcnow()
    else:
        timestamp = datetime.utcnow()
    
    try:
        # Intentar obtener la colección con mejor manejo de errores
        try:
            collection = get_mongo_collection("did_conversations")
        except Exception as mongo_error:
            print(f"❌ Error obteniendo colección MongoDB: {mongo_error}")
            return jsonify({"error": f"MongoDB no disponible: {str(mongo_error)}"}), 503
        
        # Log para depuración
        print(f"💾 Guardando mensaje D-ID: role={role}, agentId={agent_id}, chatId={chat_id}, userId={usuario_id}, patientId={patient_id}, text={text[:50]}...")
        
        # Buscar o crear la conversación
        try:
            conversation = collection.find_one({
                "agentId": agent_id,
                "chatId": chat_id
            })
        except Exception as find_error:
            print(f"❌ Error buscando conversación en MongoDB: {find_error}")
            return jsonify({"error": f"Error consultando MongoDB: {str(find_error)}"}), 503
        
        # Crear el mensaje
        message = {
            "role": role,
            "content": text,
            "timestamp": timestamp,
        }
        if audio_url:
            message["audio"] = audio_url
        
        if not conversation:
            # Crear nueva conversación
            conversation_doc = {
                "agentId": agent_id,
                "chatId": chat_id,
                "userId": usuario_id,
                "patientId": patient_id,
                "messages": [message],
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
                # Campos adicionales para compatibilidad
                "agent_session_id": data.get("agentSessionId"),
                "agent_conversation_id": data.get("agentConversationId"),
                "session_uuid": data.get("sessionUuid"),
                "agent_url": data.get("agentUrl"),
                "agent_origin": data.get("agentOrigin"),
                "consulta_id": _safe_int(data.get("consultaId")),
                "metadata": data.get("metadata") or {}
            }
            try:
                result = collection.insert_one(conversation_doc)
                return jsonify({"id": str(result.inserted_id), "conversationId": str(result.inserted_id)}), 201
            except Exception as insert_error:
                print(f"❌ Error insertando conversación en MongoDB: {insert_error}")
                import traceback
                traceback.print_exc()
                return jsonify({"error": f"Error guardando en MongoDB: {str(insert_error)}"}), 503
        else:
            # Agregar mensaje a conversación existente
            try:
                # Siempre actualizar patientId y userId si se proporcionan, incluso si ya existen
                update_data = {
                    "$push": {"messages": message},
                    "$set": {
                        "updatedAt": datetime.utcnow()
                    }
                }
                # Actualizar patientId si se proporciona (incluso si ya existe uno)
                if patient_id is not None:
                    update_data["$set"]["patientId"] = patient_id
                # Actualizar userId si se proporciona (incluso si ya existe uno)
                if usuario_id is not None:
                    update_data["$set"]["userId"] = usuario_id
                
                collection.update_one(
                    {"_id": conversation["_id"]},
                    update_data
                )
                return jsonify({"id": str(conversation["_id"]), "conversationId": str(conversation["_id"])}), 200
            except Exception as update_error:
                print(f"❌ Error actualizando conversación en MongoDB: {update_error}")
                import traceback
                traceback.print_exc()
                return jsonify({"error": f"Error actualizando MongoDB: {str(update_error)}"}), 503
            
    except PyMongoError as exc:
        print(f"❌ PyMongoError: {exc}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503
    except Exception as exc:
        print(f"❌ Error inesperado: {exc}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error interno del servidor: {exc}"}), 500


@app.get("/api/did/conversations")
def list_did_conversations():
    """
    Lista conversaciones D-ID.
    Soporta filtrado por patientId, userId, agentId, chatId.
    Compatible con el formato del conversation-service.js
    """
    try:
        collection = get_mongo_collection("did_conversations")
    except PyMongoError as exc:
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503

    try:
        limit = max(1, min(int(request.args.get("limit", 50)), 500))
    except ValueError:
        limit = 50

    query: Dict[str, Any] = {}
    patient_id = _safe_int(request.args.get("patientId"))
    user_id = _safe_int(request.args.get("userId"))
    agent_id = request.args.get("agentId")
    chat_id = request.args.get("chatId")
    consulta_id = _safe_int(request.args.get("consultaId"))
    session_uuid = request.args.get("sessionUuid")

    # Construir query compatible con ambos formatos
    # Si se proporciona patientId, buscar por patientId
    if patient_id is not None:
        query["patientId"] = patient_id
        # También buscar por userId si se proporciona (puede haber conversaciones sin patientId pero con userId)
        if user_id is not None:
            # Usar $or para buscar conversaciones que tengan el patientId O el userId
            query = {
                "$or": [
                    {"patientId": patient_id},
                    {"userId": user_id}
                ]
            }
    elif user_id is not None:
        # Si no hay patientId pero hay userId, buscar por userId
        query["userId"] = user_id
    
    # Agregar otros filtros si se proporcionan
    if agent_id:
        if "$or" in query:
            # Si hay $or, agregar agentId a cada condición
            for condition in query["$or"]:
                condition["agentId"] = agent_id
        else:
            query["agentId"] = agent_id
    if chat_id:
        if "$or" in query:
            for condition in query["$or"]:
                condition["chatId"] = chat_id
        else:
            query["chatId"] = chat_id
    if consulta_id is not None:
        if "$or" in query:
            for condition in query["$or"]:
                condition["consulta_id"] = consulta_id
        else:
            query["consulta_id"] = consulta_id
    if session_uuid:
        if "$or" in query:
            for condition in query["$or"]:
                condition["session_uuid"] = session_uuid
        else:
            query["session_uuid"] = session_uuid
    

    items = []
    try:
        # Ordenar por updatedAt (nuevo formato) o created_at (formato antiguo)
        cursor = collection.find(query).sort("updatedAt", -1).limit(limit)
        count = 0
        for doc in cursor:
            count += 1
            doc["id"] = str(doc.pop("_id"))
            # Normalizar formato de respuesta
            if "messages" in doc:
                doc["messageCount"] = len(doc["messages"])
                if doc["messages"]:
                    doc["lastMessage"] = doc["messages"][-1]
            items.append(doc)
    except PyMongoError as exc:
        print(f"❌ Error en MongoDB: {exc}")
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503

    return jsonify({"items": items, "count": len(items), "conversations": items})


@app.get("/api/did/conversations/<conversation_id>/summary")
def get_conversation_summary(conversation_id: str):
    """
    Obtiene un resumen de una conversación específica usando IA.
    Retorna un párrafo resumen y hasta 5 bullets con lo más importante.
    """
    try:
        # Obtener colección MongoDB
        collection = get_mongo_collection("did_conversations")
        
        # Validar y limpiar el ID
        conversation_id = str(conversation_id).strip()
        
        if len(conversation_id) != 24:
            return jsonify({"error": f"ID de conversación inválido: longitud incorrecta ({len(conversation_id)} caracteres, debe ser 24)"}), 400
        
        try:
            obj_id = ObjectId(conversation_id)
        except InvalidId as e:
            return jsonify({"error": f"ID de conversación inválido: '{conversation_id}'. Debe ser un ObjectId válido de 24 caracteres hexadecimales."}), 400
        
        # Buscar conversación
        conversation = collection.find_one({"_id": obj_id})
        if not conversation:
            return jsonify({"error": "Conversación no encontrada"}), 404

        messages = conversation.get("messages", [])
        if not messages:
            return jsonify({
                "summary": "Esta conversación no contiene mensajes.",
                "highlights": []
            }), 200

        # Construir el texto de la conversación
        conversation_text = ""
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "").strip()
            if content:
                conversation_text += f"{role.upper()}: {content}\n"

        # Generar resumen con IA
        prompt = f"""Analiza la siguiente conversación entre un paciente y un asistente médico virtual y genera:
1. Un párrafo resumen (máximo 150 palabras) que describa el contexto general de la conversación, los síntomas o preocupaciones principales del paciente, y las recomendaciones o información proporcionada.
2. Hasta 5 puntos destacados (bullets) con la información más importante: síntomas mencionados, recomendaciones clave, preocupaciones principales, o cualquier dato clínico relevante.

Conversación:
{conversation_text}

Responde en formato JSON con esta estructura:
{{
  "summary": "párrafo resumen aquí",
  "highlights": [
    "punto destacado 1",
    "punto destacado 2",
    ...
  ]
}}

Responde SOLO con el JSON, sin texto adicional."""

        if not openai_client:
            raise Exception("OpenAI client no está inicializado. Verifica OPENAI_API_KEY.")
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente médico experto. Responde siempre en español y en formato JSON válido."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        text = (response.choices[0].message.content or "").strip()
        
        # Limpiar el texto (puede venir con markdown code blocks)
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        result = json.loads(text)
        
        return jsonify({
            "summary": result.get("summary", "No se pudo generar resumen."),
            "highlights": result.get("highlights", [])[:5]
        }), 200

    except json.JSONDecodeError:
        # Si falla el parseo JSON, crear un resumen básico
        msg_count = len(messages) if 'messages' in locals() and messages else 0
        return jsonify({
            "summary": f"Conversación con {msg_count} mensajes. El paciente consultó sobre sus síntomas y recibió orientación médica.",
            "highlights": [
                f"Total de mensajes: {msg_count}",
                "Consulta médica virtual",
                "Orientación y recomendaciones proporcionadas"
            ]
        }), 200
    except PyMongoError as e:
        print(f"❌ [SUMMARY] Error MongoDB: {e}", file=sys.stderr)
        return jsonify({"error": f"MongoDB no disponible: {e}"}), 503
    except Exception as e:
        print(f"❌ [SUMMARY] Error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        # Retornar resumen básico en lugar de error 500
        return jsonify({
            "summary": "Conversación médica con mensajes intercambiados entre el paciente y el asistente virtual.",
            "highlights": [
                "Consulta médica virtual",
                "Orientación proporcionada"
            ]
        }), 200


# ===== IA: Doctor (XML ONLY) =====
@app.post("/api/ai/doctor")
def ai_doctor():
    # Parse XML request
    body = parse_xml_request()
    patient = body.get("patient", {})
    symptoms = body.get("symptoms", "")
    studies  = body.get("studies", [])

    prompt = f"""
Eres un asistente que APOYA a un MÉDICO TITULADO.
Devuelve:
1) Resumen clínico breve (máx 6 líneas).
2) 3-5 diagnósticos diferenciales con razonamiento corto.
3) Próximos pasos sugeridos.
4) Advertencia: el veredicto es del médico; esto NO sustituye consulta.

Paciente: {patient}
Síntomas: {symptoms}
Estudios/URLs: {studies}
Responde en español en formato claro y con viñetas.
"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente médico experto. Responde siempre en español."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        text = (response.choices[0].message.content or "").strip()
    except Exception as e:
        text = f"(demo) Error con OpenAI: {e}"

    # Return XML response
    return create_xml_response({ "recommendation": text })

# ===== IA: Paciente (XML/JSON según cliente) =====
@app.post("/api/ai/patient")
def ai_patient():
    # Detect client type and parse accordingly
    is_mobile = is_mobile_client()
    
    if is_mobile:
        # Mobile client - use JSON
        body = request.json or {}
    else:
        # Web client - use XML
        body = parse_xml_request()
    
    patient = body.get("patient", {})
    symptoms = body.get("symptoms", "")
    studies  = body.get("studies", [])
    
    # Obtener patientId o userId del request para contexto
    patient_id = _safe_int(body.get("patientId")) or _safe_int(body.get("patient_id"))
    user_id = _safe_int(body.get("userId")) or _safe_int(body.get("user_id")) or _safe_int(body.get("usuarioId"))
    
    # Construir contexto del paciente desde la base de datos
    patient_context = ""
    conversation_history = ""
    
    if patient_id or user_id:
        try:
            # Intentar obtener datos del paciente desde PostgreSQL
            # Nota: Esto requiere que el backend tenga acceso a db_connection o hacer una llamada HTTP al servicio de pacientes
            import requests
            PATIENT_API = os.getenv("VITE_PATIENT_API") or os.getenv("PATIENT_API") or "http://localhost:8003"
            
            if patient_id:
                try:
                    patient_response = requests.get(f"{PATIENT_API}/api/db/patient/{patient_id}", timeout=2)
                    if patient_response.status_code == 200:
                        patient_data = patient_response.json()
                        patient_context = f"""
INFORMACIÓN DEL PACIENTE:
- Nombre: {patient_data.get('nombre', '')} {patient_data.get('apellido', '')}
- Fecha de nacimiento: {patient_data.get('fecha_nacimiento', '')}
- Sexo: {patient_data.get('sexo', '')}
- Altura: {patient_data.get('altura', '')} cm
- Peso: {patient_data.get('peso', '')} kg
- Estilo de vida: {patient_data.get('estilo_vida', '')}
"""
                except Exception as e:
                    print(f"⚠️ No se pudo obtener datos del paciente: {e}")
            
            # Obtener historial de conversaciones desde MongoDB
            try:
                collection = get_mongo_collection("did_conversations")
                query = {}
                if patient_id:
                    query["patientId"] = patient_id
                elif user_id:
                    query["userId"] = user_id
                
                if query:
                    conversations = list(collection.find(query).sort("updatedAt", -1).limit(3))
                    if conversations:
                        conversation_history = "\n\nHISTORIAL DE CONVERSACIONES PREVIAS:\n"
                        for conv in conversations:
                            if conv.get("messages"):
                                # Tomar los últimos 5 mensajes de cada conversación
                                recent_messages = conv["messages"][-5:]
                                for msg in recent_messages:
                                    role = msg.get("role", "")
                                    content = msg.get("content", "")
                                    if content:
                                        conversation_history += f"- {role.upper()}: {content[:200]}\n"
            except Exception as e:
                print(f"⚠️ No se pudo obtener historial de conversaciones: {e}")
        except Exception as e:
            print(f"⚠️ Error obteniendo contexto del paciente: {e}")

    prompt = f"""
Eres un asistente médico virtual que habla con un PACIENTE. Tono empático, claro y profesional.
IMPORTANTE: SIEMPRE responde en ESPAÑOL, nunca en inglés.

{patient_context}

{conversation_history}

INSTRUCCIONES:
- Explicación sencilla de lo que podría estar pasando (no diagnóstico definitivo).
- Señales de alarma si aplican.
- Pasos sugeridos (p.ej. agendar cita).
- A veces el paciente se siente más cómodo hablando en ese momento contigo, es por eso que no debe verse obligado a dejarte de hablar, es decir no solo lo corras a que hable con el médico, pláticale.
- PREGUNTA HASTA QUE LLEGUES A UN DIAGNOSTICO, NO ESPECULES.
- NO MUESTRES LA INFORMACIÓN DEL PACIENTE A MENOS QUE SE TE PIDA EXPLÍCITAMENTE.
- Usa el historial de conversaciones previas para dar seguimiento a consultas anteriores y mantener continuidad en la conversación.
- Si el paciente menciona algo relacionado con consultas previas, haz referencia a ellas de manera natural.

Paciente: {patient}
Síntomas: {symptoms}
Estudios/URLs: {studies}
"""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente médico experto. Responde siempre en español."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        text = (response.choices[0].message.content or "").strip()
    except Exception as e:
        text = f"(demo) Error con OpenAI: {e}"

    # Return response based on client type
    if is_mobile:
        return jsonify({ "message": text })
    else:
        return create_xml_response({ "message": text })


# ===== IA: Mensaje de Bienvenida Personalizado =====
@app.post("/api/ai/patient/welcome")
def ai_patient_welcome():
    """
    Genera un mensaje de bienvenida personalizado para el paciente.
    Acepta JSON con patientId o userId.
    """
    body = request.get_json(silent=True) or {}
    patient_id = _safe_int(body.get("patientId")) or _safe_int(body.get("patient_id"))
    user_id = _safe_int(body.get("userId")) or _safe_int(body.get("user_id")) or _safe_int(body.get("usuarioId"))
    
    patient_name = "paciente"
    
    # Intentar obtener el nombre del paciente
    if patient_id or user_id:
        try:
            PATIENT_API = os.getenv("VITE_PATIENT_API") or os.getenv("PATIENT_API") or "http://localhost:8003"
            
            if patient_id:
                try:
                    patient_response = requests.get(f"{PATIENT_API}/api/db/patient/{patient_id}", timeout=2)
                    if patient_response.status_code == 200:
                        patient_data = patient_response.json()
                        nombre = patient_data.get('nombre', '').strip()
                        if nombre:
                            patient_name = nombre
                except Exception as e:
                    print(f"⚠️ No se pudo obtener nombre del paciente: {e}")
        except Exception as e:
            print(f"⚠️ Error obteniendo datos del paciente: {e}")
    
    # Generar mensaje de bienvenida personalizado
    welcome_message = f"Hola {patient_name}, ¿en qué puedo ayudarte hoy?"
    
    # Opcional: usar IA para generar un mensaje más variado
    try:
        prompt = f"""Genera un mensaje de bienvenida cálido y personalizado para un paciente llamado {patient_name}.
El mensaje debe ser:
- Cálido y empático
- En español
- Breve (máximo 15 palabras)
- Mencionar el nombre del paciente
- Invitar a hacer una consulta

Responde SOLO con el mensaje, sin explicaciones adicionales."""
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente médico virtual. Genera mensajes de bienvenida cálidos y profesionales en español."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=50
        )
        generated_message = (response.choices[0].message.content or "").strip()
        if generated_message:
            welcome_message = generated_message
    except Exception as e:
        print(f"⚠️ Error generando mensaje con IA, usando mensaje por defecto: {e}")
    
    return jsonify({ "message": welcome_message, "patientName": patient_name })


# ===== IA: File Analyzer (JSON) =====
@app.post("/api/ai/file/analyze_json")
def ai_file_analyze_json():
    import json

    upload = request.files.get("file")
    if not upload or upload.filename == "":
        return jsonify({"error": "Debes enviar un archivo en form-data con la clave 'file'."}), 400

    content_type = upload.mimetype or "application/octet-stream"
    instructions = request.form.get("instructions", "").strip()

    # Leemos bytes del archivo (imagen/pdf/docx, etc.)
    file_bytes = upload.read()

    # Prompt: pedimos salida estrictamente en JSON
    prompt = f"""
Analiza el archivo adjunto (puede ser imagen, PDF o DOCX).
Extrae texto (OCR si aplica), estructura, tablas y datos clave.

Responde SOLO con un JSON válido (sin explicaciones) con esta forma:
{{
  "doc_type": "image|pdf|docx|desconocido",
  "language": "es|en|...",
  "title": "string|null",
  "pages": {{ "count": int, "has_tables": bool }},
  "text_excerpt": "primeros ~1500 caracteres de texto limpio",
  "key_points": ["bullet 1", "bullet 2", "..."],
  "entities": {{
    "names": [], "dates": [], "emails": [], "phones": [], "ids": []
  }},
  "tables": [
    {{"caption": "string|null", "rows": [["c11","c12"],["c21","c22"]]}}
  ],
  "warnings": ["si algo está ilegible o hay baja confianza"]
}}

Si el documento es clínico, NO des diagnósticos; resume hallazgos.
{('Instrucciones del usuario: ' + instructions) if instructions else ''}
"""

    try:
        import base64
        
        # Convertir archivo a base64 para OpenAI
        file_base64 = base64.b64encode(file_bytes).decode('utf-8')
        
        # Determinar el tipo de contenido para OpenAI
        if content_type.startswith('image/'):
            # Para imágenes, usar GPT-4 Vision
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{content_type};base64,{file_base64}"
                            }
                        }
                    ]
                }
            ]
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.7
            )
            text = (response.choices[0].message.content or "").strip()
        else:
            # Para PDFs y otros documentos, usar GPT-4 con el texto extraído
            # Nota: OpenAI no procesa PDFs directamente, necesitarías extraer el texto primero
            # Por ahora, usamos un enfoque de texto plano
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Eres un asistente experto en análisis de documentos médicos."},
                    {"role": "user", "content": f"{prompt}\n\nNota: El archivo es de tipo {content_type}. Si es necesario procesar el contenido, indica que se requiere extracción de texto previa."}
                ],
                temperature=0.7
            )
            text = (response.choices[0].message.content or "").strip()
        
        try:
            payload = json.loads(text)
        except Exception:
            payload = {"raw_model_text": text}

       
        payload.setdefault("filename", upload.filename)
        payload.setdefault("mime_type", content_type)

        return jsonify(payload)

    except Exception as e:
        return jsonify({"error": f"Error procesando archivo con OpenAI: {e}"}), 500


# ===== IA: File Analyzer (XML) =====
@app.post("/api/ai/file/analyze_xml")
def ai_file_analyze_xml():
    import json

    upload = request.files.get("file")
    if not upload or upload.filename == "":
        return create_xml_response({"error": "Debes enviar un archivo en form-data con la clave 'file'."})

    content_type = upload.mimetype or "application/octet-stream"
    instructions = request.form.get("instructions", "").strip()
    file_bytes = upload.read()

    prompt = f"""
Analiza el archivo adjunto (imagen, PDF o DOCX).
Extrae texto (OCR), estructura, tablas y datos clave.

Responde SOLO con un JSON válido (sin explicaciones) con esta forma:
{{
  "doc_type": "image|pdf|docx|desconocido",
  "language": "es|en|...",
  "title": "string|null",
  "pages": {{ "count": int, "has_tables": bool }},
  "text_excerpt": "primeros ~1500 caracteres de texto limpio",
  "key_points": ["bullet 1", "bullet 2", "..."],
  "entities": {{
    "names": [], "dates": [], "emails": [], "phones": [], "ids": []
  }},
  "tables": [
    {{"caption": "string|null", "rows": [["c11","c12"],["c21","c22"]]}}
  ],
  "warnings": ["si algo está ilegible o hay baja confianza"]
}}

{('Instrucciones del usuario: ' + instructions) if instructions else ''}
"""

    try:
        import base64
        
        # Convertir archivo a base64 para OpenAI
        file_base64 = base64.b64encode(file_bytes).decode('utf-8')
        
        # Determinar el tipo de contenido para OpenAI
        if content_type.startswith('image/'):
            # Para imágenes, usar GPT-4 Vision
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{content_type};base64,{file_base64}"
                            }
                        }
                    ]
                }
            ]
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.7
            )
            text = (response.choices[0].message.content or "").strip()
        else:
            # Para PDFs y otros documentos, usar GPT-4 con el texto extraído
            # Nota: OpenAI no procesa PDFs directamente, necesitarías extraer el texto primero
            # Por ahora, usamos un enfoque de texto plano
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Eres un asistente experto en análisis de documentos médicos."},
                    {"role": "user", "content": f"{prompt}\n\nNota: El archivo es de tipo {content_type}. Si es necesario procesar el contenido, indica que se requiere extracción de texto previa."}
                ],
                temperature=0.7
            )
            text = (response.choices[0].message.content or "").strip()

        # parsear el JSON del modelo
        try:
            data = json.loads(text)
        except Exception:
            data = {"raw_model_text": text}

     
        data.setdefault("filename", upload.filename)
        data.setdefault("mime_type", content_type)

        # Convertidor simple de dict/list -> XML anidado
        def build_xml(parent, obj, item_tag="item"):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    child = ET.SubElement(parent, str(k))
                    build_xml(child, v, item_tag=item_tag)
            elif isinstance(obj, list):
                for it in obj:
                    child = ET.SubElement(parent, item_tag)
                    build_xml(child, it, item_tag=item_tag)
            else:
                parent.text = "" if obj is None else str(obj)

        root = ET.Element("response")
        build_xml(root, data)
        xml_str = ET.tostring(root, encoding="unicode")
        return Response(xml_str, mimetype="application/xml")

    except Exception as e:
        return create_xml_response({"error": f"Error procesando archivo con OpenAI: {e}"})


if __name__ == "__main__":
    import sys
    port = int(os.getenv("PORT", 8080))
    # En Windows, desactivar use_reloader para evitar errores de socket
    # Mantener debug=True para ver errores detallados
    use_reloader = os.getenv("USE_RELOADER", "false").lower() == "true"
    if sys.platform == "win32":
        use_reloader = False
    
    app.run(
        host="0.0.0.0", 
        port=port, 
        debug=True,
        use_reloader=use_reloader,
        threaded=True
    )
