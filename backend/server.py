import os
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any, Dict, Optional

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

load_dotenv()

import google.generativeai as genai

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
    auth_part = ""
    if MONGO_USER and MONGO_PASSWORD:
        auth_part = f"{MONGO_USER}:{MONGO_PASSWORD}@"
    return f"mongodb://{auth_part}{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}?authSource=admin"


def get_mongo_collection(name: str):
    global _mongo_client, _mongo_db
    if _mongo_client is None:
        uri = _build_mongo_uri()
        _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    if _mongo_db is None:
        _mongo_db = _mongo_client[MONGO_DB_NAME]
    return _mongo_db[name]


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

# ===== GEMINI =====
GEMINI_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
if not GEMINI_KEY:
    raise RuntimeError("Falta GOOGLE_GEMINI_API_KEY en .env")

genai.configure(api_key=GEMINI_KEY)
gemini_model = genai.GenerativeModel("gemini-2.5-flash")

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

# ===== D-ID Conversations =====
@app.post("/api/did/conversations")
def save_did_conversation():
    data: Dict[str, Any] = request.get_json(silent=True) or {}
    role = data.get("role")
    if role not in {"user", "agent"}:
        return jsonify({"error": "El campo 'role' es obligatorio y debe ser 'user' o 'agent'."}), 400

    text = (data.get("text") or "").strip()
    audio_url = data.get("audioUrl")
    if not text and not audio_url:
        return jsonify({"error": "Debe incluir 'text' o 'audioUrl'."}), 400

    doc: Dict[str, Any] = {
        "role": role,
        "text": text,
        "audio_url": audio_url,
        "patient_id": _safe_int(data.get("patientId")),
        "consulta_id": _safe_int(data.get("consultaId")),
        "usuario_id": _safe_int(data.get("usuarioId")),
        "agent_session_id": data.get("agentSessionId"),
        "agent_conversation_id": data.get("agentConversationId"),
        "message_id": data.get("messageId"),
        "session_uuid": data.get("sessionUuid"),
        "agent_url": data.get("agentUrl"),
        "agent_origin": data.get("agentOrigin"),
        "started_at": data.get("startedAt"),
        "finished_at": data.get("finishedAt"),
        "metadata": data.get("metadata") or {},
        "created_at": datetime.utcnow(),
    }

    doc = {k: v for k, v in doc.items() if v not in (None, "")}

    try:
        collection = get_mongo_collection("did_conversations")
        result = collection.insert_one(doc)
    except PyMongoError as exc:
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503

    return jsonify({"id": str(result.inserted_id)}), 201


@app.get("/api/did/conversations")
def list_did_conversations():
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
    consulta_id = _safe_int(request.args.get("consultaId"))
    session_uuid = request.args.get("sessionUuid")

    if patient_id is not None:
        query["patient_id"] = patient_id
    if consulta_id is not None:
        query["consulta_id"] = consulta_id
    if session_uuid:
        query["session_uuid"] = session_uuid

    items = []
    try:
        cursor = collection.find(query).sort("created_at", 1).limit(limit)
        for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            items.append(doc)
    except PyMongoError as exc:
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503

    return jsonify({"items": items, "count": len(items)})


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
        resp = gemini_model.generate_content(prompt)
        text = (resp.text or "").strip()
    except Exception as e:
        text = f"(demo) Error con Gemini: {e}"

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

    prompt = f"""
Eres un asistente que habla con un PACIENTE. Tono empático y claro.
Incluye:
- Explicación sencilla de lo que podría estar pasando (no diagnóstico).
- Señales de alarma si aplican.
- Pasos sugeridos (p.ej. agendar cita).
- A veces el paciente se siente más cómodo hablando en ese momento contigo, es por eso que no debe verse obligado a dejarte de hablar, es decir no solo lo corras a que hable con el médico, pláticale.
- PREGUNTA HASTA QUE LLEGUES A UN DIAGNOSTICO, NO ESPECULES. NO MUESTRES LA INFROMACIÓN DEL PACIENTE A MENOS QUE SE TE PIDA

Paciente: {patient}
Síntomas: {symptoms}
Estudios/URLs: {studies}
"""
    try:
        resp = gemini_model.generate_content(prompt)
        text = (resp.text or "").strip()
    except Exception as e:
        text = f"(demo) Error con Gemini: {e}"

    # Return response based on client type
    if is_mobile:
        return jsonify({ "message": text })
    else:
        return create_xml_response({ "message": text })
    
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
        
        parts = [
            {"mime_type": content_type, "data": file_bytes},
            prompt
        ]
        resp = gemini_model.generate_content(parts)
        text = (resp.text or "").strip()

        
        try:
            payload = json.loads(text)
        except Exception:
            payload = {"raw_model_text": text}

       
        payload.setdefault("filename", upload.filename)
        payload.setdefault("mime_type", content_type)

        return jsonify(payload)

    except Exception as e:
        return jsonify({"error": f"Error procesando archivo con Gemini: {e}"}), 500


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
        parts = [
            {"mime_type": content_type, "data": file_bytes},
            prompt
        ]
        resp = gemini_model.generate_content(parts)
        text = (resp.text or "").strip()

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
        return create_xml_response({"error": f"Error procesando archivo con Gemini: {e}"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
