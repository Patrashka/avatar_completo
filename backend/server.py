import os
import json
import sys
import traceback
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
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

# También intentar cargar desde el directorio raíz del proyecto
project_root = backend_dir.parent
root_env_path = project_root / '.env'

# Intentar cargar desde backend/.env primero, luego desde raíz
env_file_to_use = None
if env_path.exists():
    env_file_to_use = env_path
    print(f"📄 Cargando .env desde: {env_path}")
elif root_env_path.exists():
    env_file_to_use = root_env_path
    print(f"📄 Cargando .env desde: {root_env_path}")

if env_file_to_use:
    with open(env_file_to_use, 'r', encoding='utf-8') as f:
        content = f.read()
        # Procesar línea por línea, pero manejar valores que pueden tener = dentro
        # También manejar continuaciones de línea con \
        lines = []
        current_line = ""
        for raw_line in content.split('\n'):
            # Mantener el contenido original pero limpiar solo \r
            line = raw_line.rstrip('\r')
            if line.endswith('\\'):
                # Línea continúa en la siguiente
                current_line += line[:-1]  # Quitar el \ pero mantener espacios
            else:
                # Línea completa
                current_line += line
                if current_line.strip():
                    lines.append(current_line)
                current_line = ""
        
        # Si quedó algo en current_line, agregarlo
        if current_line.strip():
            lines.append(current_line)
        
        for line in lines:
            original_line = line
            line = line.strip()
            # Ignorar comentarios y líneas vacías
            if not line or line.startswith('#'):
                continue
            # Buscar el primer = que separa key de value
            if '=' in line:
                # Dividir solo en el primer =
                parts = line.split('=', 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = parts[1]
                    # NO hacer strip todavía - puede haber espacios importantes
                    # Eliminar comillas del valor si están presentes
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    # Ahora sí hacer strip final para limpiar espacios
                    value = value.strip()
                    # Preservar la key completa sin truncar
                    os.environ[key] = value

# También intentar con load_dotenv por si acaso
load_dotenv(dotenv_path=env_path, override=True)

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

# ===== Gemini =====
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY")

# Limpiar la API key: eliminar espacios, saltos de línea, etc.
if GEMINI_API_KEY:
    GEMINI_API_KEY = GEMINI_API_KEY.strip()
    # Eliminar comillas si están presentes
    if GEMINI_API_KEY.startswith('"') and GEMINI_API_KEY.endswith('"'):
        GEMINI_API_KEY = GEMINI_API_KEY[1:-1]
    elif GEMINI_API_KEY.startswith("'") and GEMINI_API_KEY.endswith("'"):
        GEMINI_API_KEY = GEMINI_API_KEY[1:-1]
    GEMINI_API_KEY = GEMINI_API_KEY.strip()
    
    # Validar formato básico de API key de Google (debe empezar con AIza)
    if not GEMINI_API_KEY.startswith("AIza"):
        print(f"⚠️ ADVERTENCIA: La API key no parece tener el formato correcto de Google Gemini")
        print(f"   Las API keys de Gemini suelen empezar con 'AIza'")
        print(f"   Primeros caracteres: {GEMINI_API_KEY[:10]}...")
    
    # Validar longitud mínima
    if len(GEMINI_API_KEY) < 20:
        print(f"⚠️ ADVERTENCIA: La API key parece muy corta ({len(GEMINI_API_KEY)} caracteres)")
        print(f"   Las API keys de Gemini suelen tener 39 caracteres")

if not GEMINI_API_KEY:
    print(f"❌ ERROR: No se encontró GEMINI_API_KEY")
    print(f"📋 Variables de entorno disponibles:")
    for key in sorted(os.environ.keys()):
        if 'GEMINI' in key.upper() or 'GOOGLE' in key.upper():
            val = os.environ[key]
            print(f"   {key} = {val[:20]}... (longitud: {len(val)})")
    print(f"\n💡 Verifica que el archivo .env esté en: {backend_dir}/.env")
    print(f"💡 Y que contenga: GEMINI_API_KEY=tu_api_key_aqui")
    raise RuntimeError("Falta GEMINI_API_KEY en .env")

# Configurar Gemini con la API key limpia
try:
    print(f"🔑 Configurando Gemini con API key (longitud: {len(GEMINI_API_KEY)} caracteres)")
    print(f"   Primeros caracteres: {GEMINI_API_KEY[:10]}...")
    genai.configure(api_key=GEMINI_API_KEY)
    # Intentar diferentes modelos disponibles (priorizar modelos free tier más recientes)
    models_to_try = [
        "gemini-2.5-flash",      # Modelo Flash más reciente (free tier)
        "gemini-2.5-flash-lite", # Versión ligera (free tier)
        "gemini-1.5-flash",      # Flash anterior
        "gemini-pro",            # Modelo base (más compatible)
        "gemini-1.5-pro"         # Pro anterior
    ]
    gemini_model = None
    model_name_used = None
    
    for model_name in models_to_try:
        try:
            test_model = genai.GenerativeModel(model_name)
            gemini_model = test_model
            model_name_used = model_name
            print(f"✅ Cliente Gemini inicializado correctamente (modelo: {model_name})")
            break
        except Exception as model_error:
            print(f"⚠️ Modelo {model_name} no disponible: {str(model_error)[:100]}")
            continue
    
    if not gemini_model:
        # Si ninguno funciona, intentar listar modelos disponibles
        try:
            print("📋 Intentando listar modelos disponibles...")
            models = genai.list_models()
            available = [m.name for m in models if 'generateContent' in m.supported_generation_methods]
            if available:
                print(f"   Modelos disponibles: {', '.join(available[:5])}")
                # Intentar con el primero disponible
                if available:
                    model_name_used = available[0].split('/')[-1]  # Extraer solo el nombre
                    gemini_model = genai.GenerativeModel(model_name_used)
                    print(f"✅ Usando modelo: {model_name_used}")
        except Exception as list_error:
            print(f"⚠️ No se pudieron listar modelos: {list_error}")
        
        if not gemini_model:
            # Fallback a gemini-pro que debería estar disponible
            print("⚠️ Usando gemini-pro como fallback...")
            try:
                gemini_model = genai.GenerativeModel("gemini-pro")
                model_name_used = "gemini-pro"
                print(f"✅ Cliente Gemini inicializado con gemini-pro")
            except Exception as final_error:
                print(f"❌ Error crítico: No se pudo inicializar ningún modelo")
                print(f"   Último error: {final_error}")
                raise RuntimeError(f"No se pudo inicializar ningún modelo de Gemini. Verifica tu API key y permisos.")
except Exception as e:
    error_msg = str(e)
    print(f"❌ ERROR al inicializar cliente Gemini: {error_msg}")
    print(f"   API key usada (primeros 10 chars): {GEMINI_API_KEY[:10]}...")
    print(f"   Longitud de API key: {len(GEMINI_API_KEY)} caracteres")
    
    if "API key not valid" in error_msg or "API_KEY_INVALID" in error_msg:
        print(f"\n💡 SOLUCIÓN:")
        print(f"   1. Verifica que la API key sea correcta en: https://makersuite.google.com/app/apikey")
        print(f"   2. Asegúrate de que la API key tenga permisos para Gemini API")
        print(f"   3. Verifica que no haya espacios o caracteres extra en el archivo .env")
        print(f"   4. El formato en .env debe ser: GEMINI_API_KEY=AIzaSy... (sin comillas)")
        print(f"   5. Reinicia el servidor después de cambiar el .env")
    
    raise

# openai_client ya no se usa (reemplazado por Gemini)

# ===== D-ID Configuration =====
DID_API_KEY = os.getenv("DID_API_KEY") or os.getenv("VITE_DID_API_KEY")
DID_API_URL = os.getenv("DID_API_URL", "https://api.d-id.com")

def _prepare_did_auth(api_key: str) -> str:
    """
    Prepara la API key de D-ID para autenticación Basic.
    
    D-ID proporciona la API key en formato Base64 directamente desde su dashboard.
    La API key típicamente tiene ~52 caracteres y ya está codificada.
    
    Si la API key contiene ':' y es corta (< 30 caracteres), entonces es formato email:api_key
    y necesita codificación. De lo contrario, se asume que ya está en Base64.
    """
    if not api_key:
        return ""
    
    import base64
    import re
    
    # Limpiar la API key
    api_key = api_key.strip()
    
    # Patrón para Base64 válido (solo caracteres alfanuméricos, +, /, =)
    base64_pattern = re.compile(r'^[A-Za-z0-9+/=]+$')
    
    # Verificar si parece Base64 válido
    is_valid_base64 = base64_pattern.match(api_key) and len(api_key) >= 20
    
    # D-ID típicamente proporciona la API key ya en Base64 con 52 caracteres
    # Si tiene exactamente 52 caracteres y es Base64 válido, usarla directamente
    if len(api_key) == 52 and is_valid_base64:
        print(f"✅ API key de D-ID en Base64 (52 caracteres, formato estándar), usando directamente")
        return api_key
    
    # Si contiene ':' y es corta, es formato email:api_key sin codificar
    if ':' in api_key:
        # Si es corta (< 30 chars) y contiene ':', probablemente es email:api_key
        if len(api_key) < 30:
            try:
                encoded = base64.b64encode(api_key.encode('utf-8')).decode('utf-8')
                print(f"📝 API key codificada en Base64 (formato email:api_key detectado, longitud: {len(api_key)})")
                return encoded
            except Exception as e:
                print(f"⚠️  Error codificando API key: {e}, usando tal cual")
                return api_key
        elif is_valid_base64:
            # Es larga y válida Base64, usar directamente
            print(f"✅ API key en Base64 (contiene ':' pero es Base64 válido), usando directamente")
            return api_key
        else:
            # Contiene ':' pero no es Base64 válido, intentar codificar
            try:
                encoded = base64.b64encode(api_key.encode('utf-8')).decode('utf-8')
                print(f"📝 API key codificada en Base64 (formato desconocido con ':')")
                return encoded
            except:
                return api_key
    
    # No contiene ':', verificar si es Base64 válido
    if is_valid_base64:
        print(f"✅ API key ya está en formato Base64, usando directamente")
        return api_key
    
    # Formato desconocido, usar tal cual
    print(f"⚠️  API key en formato desconocido, usando tal cual")
    return api_key

# Preparar la API key para uso
if DID_API_KEY:
    # Limpiar la API key (eliminar comillas, espacios, etc.)
    DID_API_KEY = DID_API_KEY.strip()
    if DID_API_KEY.startswith('"') and DID_API_KEY.endswith('"'):
        DID_API_KEY = DID_API_KEY[1:-1].strip()
    elif DID_API_KEY.startswith("'") and DID_API_KEY.endswith("'"):
        DID_API_KEY = DID_API_KEY[1:-1].strip()
    
    print(f"🔑 DID_API_KEY encontrada: {bool(DID_API_KEY)}")
    if len(DID_API_KEY) > 20:
        print(f"   Longitud: {len(DID_API_KEY)} caracteres")
        # Detectar formato antes de procesar
        import re
        base64_pattern = re.compile(r'^[A-Za-z0-9+/=]+$')
        is_base64 = base64_pattern.match(DID_API_KEY) and len(DID_API_KEY) >= 20
        has_colon = ':' in DID_API_KEY
        
        if has_colon and not is_base64:
            print(f"   Formato detectado: email:api_key (se codificará en Base64)")
        elif is_base64:
            print(f"   Formato detectado: Base64 (ya codificada, se usará directamente)")
        else:
            print(f"   Formato detectado: desconocido (se intentará usar tal cual)")
        
        DID_API_KEY_ENCODED = _prepare_did_auth(DID_API_KEY)
    else:
        print(f"⚠️  ADVERTENCIA: API key muy corta ({len(DID_API_KEY)} caracteres), puede ser inválida")
        DID_API_KEY_ENCODED = _prepare_did_auth(DID_API_KEY)
else:
    print(f"⚠️  ADVERTENCIA: No se encontró DID_API_KEY. Los endpoints de D-ID no funcionarán.")
    DID_API_KEY_ENCODED = ""

# ===== D-ID Proxy Functions =====
def _make_did_request(method: str, endpoint: str, data: Optional[Dict] = None, json_data: Optional[Dict] = None, timeout: Optional[int] = None):
    """
    Hace una petición a la API de D-ID a través del backend (proxy).
    Esto evita problemas de CORS y mantiene la API key segura.
    
    Args:
        method: Método HTTP (GET, POST, PUT, DELETE)
        endpoint: Endpoint de D-ID (sin el dominio base)
        data: Datos para enviar como form-data
        json_data: Datos para enviar como JSON
        timeout: Timeout en segundos (None = usar default, más largo para streams)
    """
    if not DID_API_KEY or not DID_API_KEY_ENCODED:
        return None, {"error": "DID_API_KEY no configurada en el backend. Verifica backend/.env"}, 500
    
    url = f"{DID_API_URL}/{endpoint.lstrip('/')}"
    headers = {
        'Authorization': f'Basic {DID_API_KEY_ENCODED}',
        'Content-Type': 'application/json',
    }
    
    # Timeouts más largos para operaciones que pueden tardar (streams, agents)
    if timeout is None:
        if 'streams' in endpoint.lower() or 'agents' in endpoint.lower():
            timeout = 120  # 2 minutos para streams y agents
        else:
            timeout = 60  # 1 minuto para otras operaciones
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=headers, timeout=timeout)
        elif method.upper() == 'POST':
            if json_data:
                response = requests.post(url, headers=headers, json=json_data, timeout=timeout)
            elif data:
                response = requests.post(url, headers=headers, data=data, timeout=timeout)
            else:
                response = requests.post(url, headers=headers, timeout=timeout)
        elif method.upper() == 'PUT':
            if json_data:
                response = requests.put(url, headers=headers, json=json_data, timeout=timeout)
            elif data:
                response = requests.put(url, headers=headers, data=data, timeout=timeout)
            else:
                response = requests.put(url, headers=headers, timeout=timeout)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=timeout)
        else:
            return None, {"error": f"Método HTTP no soportado: {method}"}, 405
        
        # Intentar parsear como JSON, si falla devolver texto
        try:
            return response, response.json(), response.status_code
        except:
            return response, {"text": response.text, "status_code": response.status_code}, response.status_code
    except requests.exceptions.Timeout as e:
        return None, {"error": f"Timeout esperando respuesta de D-ID (más de {timeout}s). El servicio puede estar lento.", "timeout": timeout}, 504
    except requests.exceptions.RequestException as e:
        error_msg = str(e)
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            return None, {"error": f"Timeout esperando respuesta de D-ID. El servicio puede estar lento.", "details": error_msg}, 504
        return None, {"error": f"Error en petición a D-ID: {error_msg}"}, 500

# ===== D-ID Proxy Endpoints =====
@app.route("/api/did/<path:endpoint>", methods=["GET", "POST", "PUT", "DELETE"])
def did_proxy(endpoint: str):
    """
    Proxy genérico para todas las llamadas a la API de D-ID.
    Evita problemas de CORS al hacer las peticiones desde el backend.
    
    Ejemplos de uso:
    - POST /api/did/knowledge -> https://api.d-id.com/knowledge
    - POST /api/did/agents -> https://api.d-id.com/agents
    - POST /api/did/talks/streams -> https://api.d-id.com/talks/streams
    - POST /api/did/agents/{id}/chat -> https://api.d-id.com/agents/{id}/chat
    
    Nota: Los timeouts son automáticamente más largos para streams y agents (120s).
    """
    method = request.method
    json_data = request.get_json(silent=True) if request.is_json else None
    data = request.form.to_dict() if request.form else None
    
    # Determinar timeout basado en el endpoint
    timeout = None  # Se calculará automáticamente en _make_did_request
    if 'streams' in endpoint.lower():
        timeout = 120  # 2 minutos para streams
    elif 'agents' in endpoint.lower():
        timeout = 120  # 2 minutos para agents
    
    response, result, status_code = _make_did_request(method, endpoint, data=data, json_data=json_data, timeout=timeout)
    
    if response is None:
        return jsonify(result), status_code
    
    # Si la respuesta es exitosa, devolver el resultado
    if 200 <= status_code < 300:
        return jsonify(result), status_code
    else:
        return jsonify(result), status_code

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
            timestamp = datetime.now(timezone.utc)
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
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
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
                        "updatedAt": datetime.now(timezone.utc)
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


@app.get("/api/did/conversations/by-date")
def get_conversations_by_date():
    """
    Obtiene las conversaciones agrupadas por día para un paciente.
    Retorna un objeto con fechas como keys y arrays de conversaciones como valores.
    """
    try:
        collection = get_mongo_collection("did_conversations")
    except PyMongoError as exc:
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503

    patient_id = _safe_int(request.args.get("patientId"))
    user_id = _safe_int(request.args.get("userId"))
    
    if not patient_id and not user_id:
        return jsonify({"error": "Se requiere patientId o userId"}), 400

    # Construir query
    query: Dict[str, Any] = {}
    if patient_id:
        query["patientId"] = patient_id
    if user_id:
        if "patientId" in query:
            query = {
                "$or": [
                    {"patientId": patient_id},
                    {"userId": user_id}
                ]
            }
        else:
            query["userId"] = user_id

    try:
        # Obtener todas las conversaciones del paciente
        conversations = list(collection.find(query).sort("updatedAt", -1))
        
        # Agrupar por día (solo fecha, sin hora)
        conversations_by_date: Dict[str, List[Dict]] = {}
        
        for conv in conversations:
            # Obtener fecha del último mensaje o de updatedAt
            updated_at = conv.get("updatedAt") or conv.get("createdAt")
            if not updated_at:
                continue
                
            # Convertir a datetime si es string
            if isinstance(updated_at, str):
                try:
                    updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                except:
                    continue
            
            # Obtener solo la fecha (YYYY-MM-DD)
            date_key = updated_at.strftime("%Y-%m-%d")
            
            # Normalizar el documento
            conv_id = str(conv.pop("_id"))
            conv["id"] = conv_id
            conv["messageCount"] = len(conv.get("messages", []))
            if conv.get("messages"):
                conv["lastMessage"] = conv["messages"][-1]
            
            if date_key not in conversations_by_date:
                conversations_by_date[date_key] = []
            conversations_by_date[date_key].append(conv)
        
        # Ordenar fechas de más reciente a más antigua
        sorted_dates = sorted(conversations_by_date.keys(), reverse=True)
        
        # Formatear respuesta
        result = {
            "dates": sorted_dates,
            "conversations_by_date": conversations_by_date,
            "total_days": len(sorted_dates),
            "total_conversations": len(conversations)
        }
        
        return jsonify(result), 200
        
    except PyMongoError as exc:
        print(f"❌ Error en MongoDB: {exc}")
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


@app.get("/api/did/conversations/daily-summary")
def get_daily_summary():
    """
    Genera un resumen diario de todas las conversaciones de un paciente en una fecha específica.
    Usa Gemini para generar el resumen.
    """
    try:
        collection = get_mongo_collection("did_conversations")
    except PyMongoError as exc:
        return jsonify({"error": f"MongoDB no disponible: {exc}"}), 503

    patient_id = _safe_int(request.args.get("patientId"))
    user_id = _safe_int(request.args.get("userId"))
    date_str = request.args.get("date")  # Formato: YYYY-MM-DD
    
    if not patient_id and not user_id:
        return jsonify({"error": "Se requiere patientId o userId"}), 400
    
    if not date_str:
        return jsonify({"error": "Se requiere el parámetro 'date' (formato: YYYY-MM-DD)"}), 400

    # Validar formato de fecha
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Formato de fecha inválido. Use YYYY-MM-DD"}), 400

    # Construir query
    query: Dict[str, Any] = {}
    if patient_id:
        query["patientId"] = patient_id
    if user_id:
        if "patientId" in query:
            query = {
                "$or": [
                    {"patientId": patient_id},
                    {"userId": user_id}
                ]
            }
        else:
            query["userId"] = user_id

    try:
        # Obtener todas las conversaciones del paciente
        all_conversations = list(collection.find(query))
        
        # Filtrar conversaciones del día específico
        day_conversations = []
        all_messages = []
        
        for conv in all_conversations:
            updated_at = conv.get("updatedAt") or conv.get("createdAt")
            if not updated_at:
                continue
                
            # Convertir a datetime si es string
            if isinstance(updated_at, str):
                try:
                    updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                except:
                    continue
            
            # Verificar si es del día objetivo
            conv_date = updated_at.date()
            if conv_date == target_date:
                day_conversations.append(conv)
                # Agregar todos los mensajes de esta conversación
                messages = conv.get("messages", [])
                for msg in messages:
                    all_messages.append({
                        "conversation_id": str(conv.get("_id")),
                        "role": msg.get("role", "unknown"),
                        "content": msg.get("content", ""),
                        "timestamp": msg.get("timestamp")
                    })
        
        if not day_conversations:
            return jsonify({
                "date": date_str,
                "summary": f"No se encontraron conversaciones para el día {date_str}.",
                "highlights": [],
                "conversation_count": 0,
                "message_count": 0
            }), 200

        # Construir el texto de todas las conversaciones del día
        conversation_text = ""
        for msg in all_messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "").strip()
            if content:
                timestamp = msg.get("timestamp", "")
                if timestamp:
                    try:
                        if isinstance(timestamp, str):
                            ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                            time_str = ts.strftime("%H:%M")
                        else:
                            time_str = timestamp.strftime("%H:%M")
                        conversation_text += f"[{time_str}] {role.upper()}: {content}\n"
                    except:
                        conversation_text += f"{role.upper()}: {content}\n"
                else:
                    conversation_text += f"{role.upper()}: {content}\n"

        if not conversation_text.strip():
            return jsonify({
                "date": date_str,
                "summary": f"Se encontraron {len(day_conversations)} conversaciones pero no contienen mensajes.",
                "highlights": [],
                "conversation_count": len(day_conversations),
                "message_count": 0
            }), 200

        # Generar resumen con Gemini
        prompt = f"""Analiza todas las conversaciones que un paciente tuvo con un asistente médico virtual el día {date_str} y genera:
1. Un resumen general (máximo 200 palabras) que describa:
   - El contexto general de las consultas del día
   - Los síntomas o preocupaciones principales que el paciente mencionó
   - Las recomendaciones o información proporcionada por el asistente
   - Cualquier patrón o evolución que se observe en las conversaciones del día
2. Hasta 7 puntos destacados (bullets) con la información más importante:
   - Síntomas mencionados
   - Recomendaciones clave
   - Preocupaciones principales
   - Cualquier dato clínico relevante
   - Evolución de síntomas si se menciona
   - Señales de alarma si se discuten

Conversaciones del día:
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

        if not gemini_model:
            raise Exception("Gemini client no está inicializado. Verifica GEMINI_API_KEY.")
        
        # Usar Gemini para generar el resumen
        full_prompt = "Eres un asistente médico experto. Analiza conversaciones médicas y genera resúmenes claros y profesionales en español. Responde siempre en formato JSON válido.\n\n" + prompt
        try:
            response = gemini_model.generate_content(full_prompt)
        except Exception as gemini_error:
            error_str = str(gemini_error)
            print(f"❌ [DAILY_SUMMARY] Error llamando a Gemini: {error_str}")
            if "API key not valid" in error_str or "API_KEY_INVALID" in error_str:
                print(f"💡 La API key parece ser inválida. Verifica:")
                print(f"   1. Que la API key sea correcta en Google AI Studio")
                print(f"   2. Que tenga habilitada 'Generative Language API' en Google Cloud Console")
                print(f"   3. Que no esté restringida por IP o dominio")
                print(f"   4. Que tengas créditos/quota disponible")
            raise
        
        text = (response.text or "").strip()
        
        # Limpiar el texto (puede venir con markdown code blocks)
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            # Si falla el parseo, crear un resumen básico
            result = {
                "summary": f"El paciente tuvo {len(day_conversations)} conversaciones el día {date_str}. Se discutieron síntomas y se proporcionó orientación médica.",
                "highlights": [
                    f"Total de conversaciones: {len(day_conversations)}",
                    f"Total de mensajes: {len(all_messages)}",
                    "Consulta médica virtual",
                    "Orientación y recomendaciones proporcionadas"
                ]
            }
        
        return jsonify({
            "date": date_str,
            "summary": result.get("summary", "No se pudo generar resumen."),
            "highlights": result.get("highlights", [])[:7],
            "conversation_count": len(day_conversations),
            "message_count": len(all_messages)
        }), 200

    except json.JSONDecodeError:
        # Si falla el parseo JSON, crear un resumen básico
        return jsonify({
            "date": date_str,
            "summary": f"El paciente tuvo {len(day_conversations) if 'day_conversations' in locals() else 0} conversaciones el día {date_str}. Se discutieron síntomas y se proporcionó orientación médica.",
            "highlights": [
                f"Total de conversaciones: {len(day_conversations) if 'day_conversations' in locals() else 0}",
                "Consulta médica virtual",
                "Orientación proporcionada"
            ],
            "conversation_count": len(day_conversations) if 'day_conversations' in locals() else 0,
            "message_count": len(all_messages) if 'all_messages' in locals() else 0
        }), 200
    except PyMongoError as e:
        print(f"❌ [DAILY_SUMMARY] Error MongoDB: {e}", file=sys.stderr)
        return jsonify({"error": f"MongoDB no disponible: {e}"}), 503
    except Exception as e:
        print(f"❌ [DAILY_SUMMARY] Error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return jsonify({
            "date": date_str,
            "summary": f"Error al generar resumen para el día {date_str}. Por favor, intente nuevamente.",
            "highlights": [],
            "conversation_count": 0,
            "message_count": 0,
            "error": str(e)
        }), 200


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

        if not gemini_model:
            raise Exception("Gemini client no está inicializado. Verifica GEMINI_API_KEY.")
        
        # Usar Gemini en lugar de OpenAI
        full_prompt = "Eres un asistente médico experto. Responde siempre en español y en formato JSON válido.\n\n" + prompt
        try:
            response = gemini_model.generate_content(full_prompt)
        except Exception as gemini_error:
            error_str = str(gemini_error)
            print(f"❌ [SUMMARY] Error llamando a Gemini: {error_str}")
            if "API key not valid" in error_str or "API_KEY_INVALID" in error_str:
                print(f"💡 La API key parece ser inválida. Verifica:")
                print(f"   1. Que la API key sea correcta en Google AI Studio")
                print(f"   2. Que tenga habilitada 'Generative Language API' en Google Cloud Console")
                print(f"   3. Que no esté restringida por IP o dominio")
                print(f"   4. Que tengas créditos/quota disponible")
            raise
        
        text = (response.text or "").strip()
        
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
        # Usar Gemini en lugar de OpenAI
        full_prompt = "Eres un asistente médico experto. Responde siempre en español.\n\n" + prompt
        response = gemini_model.generate_content(full_prompt)
        text = (response.text or "").strip()
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
            PATIENT_API = os.getenv("VITE_PATIENT_API") or os.getenv("PATIENT_API") or "http://localhost:8012"
            
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
        # Usar Gemini en lugar de OpenAI
        full_prompt = "Eres un asistente médico experto. Responde siempre en español.\n\n" + prompt
        try:
            response = gemini_model.generate_content(full_prompt)
            text = (response.text or "").strip()
        except Exception as gemini_error:
            error_str = str(gemini_error)
            print(f"❌ [AI_PATIENT] Error llamando a Gemini: {error_str}")
            if "API key not valid" in error_str or "API_KEY_INVALID" in error_str:
                print(f"💡 La API key parece ser inválida. Verifica permisos en Google Cloud Console")
            text = f"(demo) Error con Gemini: {error_str}"
    except Exception as e:
        text = f"(demo) Error con Gemini: {e}"

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
    
    Se usa un mensaje por defecto personalizado con el nombre del paciente.
    """
    body = request.get_json(silent=True) or {}
    patient_id = _safe_int(body.get("patientId")) or _safe_int(body.get("patient_id"))
    user_id = _safe_int(body.get("userId")) or _safe_int(body.get("user_id")) or _safe_int(body.get("usuarioId"))
    
    patient_name = "paciente"
    
    # Intentar obtener el nombre del paciente
    if patient_id or user_id:
        try:
            PATIENT_API = os.getenv("VITE_PATIENT_API") or os.getenv("PATIENT_API") or "http://localhost:8012"
            
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
    
    # Mensaje de bienvenida personalizado usando Gemini
    welcome_message = f"Hola {patient_name}, ¿en qué puedo ayudarte hoy?"
    
    # Usar Gemini para generar mensaje personalizado
    try:
        prompt = f"""Genera un mensaje de bienvenida cálido y personalizado para un paciente llamado {patient_name}.
El mensaje debe ser: Cálido y empático, En español, Breve (máximo 15 palabras), Mencionar el nombre del paciente, Invitar a hacer una consulta.
Responde SOLO con el mensaje, sin explicaciones adicionales."""
        
        full_prompt = "Eres un asistente médico virtual. Genera mensajes de bienvenida cálidos y profesionales en español.\n\n" + prompt
        response = gemini_model.generate_content(full_prompt)
        generated_message = (response.text or "").strip()
        
        # Limpiar el mensaje (puede venir con comillas o markdown)
        if generated_message:
            generated_message = generated_message.strip('"').strip("'").strip()
            if generated_message and len(generated_message) > 5:  # Validar que no esté vacío
                welcome_message = generated_message
    except Exception as e:
        print(f"⚠️ Error generando mensaje con Gemini: {e}")
        # Usar mensaje por defecto si falla
    
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
        
        # Convertir archivo a base64 para Gemini
        file_base64 = base64.b64encode(file_bytes).decode('utf-8')
        
        # Determinar el tipo de contenido para Gemini
        if content_type.startswith('image/'):
            # Para imágenes, usar Gemini Vision
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
            # Usar Gemini para procesar imágenes
            # Gemini puede procesar imágenes directamente
            response = gemini_model.generate_content([prompt, upload])
            text = (response.text or "").strip()
        else:
            # Para PDFs y otros documentos, usar Gemini
            # Nota: Gemini puede procesar algunos tipos de documentos
            full_prompt = f"Eres un asistente experto en análisis de documentos médicos.\n\n{prompt}\n\nNota: El archivo es de tipo {content_type}."
            response = gemini_model.generate_content(full_prompt)
            text = (response.text or "").strip()
        
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
        import base64
        
        # Convertir archivo a base64 para Gemini
        file_base64 = base64.b64encode(file_bytes).decode('utf-8')
        
        # Determinar el tipo de contenido para Gemini
        if content_type.startswith('image/'):
            # Para imágenes, usar Gemini Vision
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
            # Usar Gemini para procesar imágenes
            # Gemini puede procesar imágenes directamente
            response = gemini_model.generate_content([prompt, upload])
            text = (response.text or "").strip()
        else:
            # Para PDFs y otros documentos, usar Gemini
            # Nota: Gemini puede procesar algunos tipos de documentos
            full_prompt = f"Eres un asistente experto en análisis de documentos médicos.\n\n{prompt}\n\nNota: El archivo es de tipo {content_type}."
            response = gemini_model.generate_content(full_prompt)
            text = (response.text or "").strip()

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


# ===== Endpoint de Registro =====
@app.route("/api/auth/register", methods=["POST"])
def register():
    """Registra un nuevo paciente en el sistema"""
    try:
        # Importar db_connection aquí para evitar problemas de importación circular
        import sys
        from pathlib import Path
        frontend_path = Path(__file__).parent.parent / "frontend"
        if str(frontend_path) not in sys.path:
            sys.path.insert(0, str(frontend_path))
        
        from db_connection import register_patient
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "Datos requeridos"}), 400
        
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        correo = (data.get("correo") or "").strip()
        nombre = (data.get("nombre") or "").strip()
        apellido = (data.get("apellido") or "").strip()
        telefono = (data.get("telefono") or "").strip()
        
        if not username or not password or not correo:
            return jsonify({"error": "Username, contraseña y correo son requeridos"}), 400
        
        # Validar formato de correo básico (simulado, no se verifica realmente)
        if "@" not in correo or "." not in correo.split("@")[1]:
            return jsonify({"error": "Formato de correo inválido"}), 400
        
        # Registrar paciente
        user = register_patient(
            username=username,
            password=password,
            correo=correo,
            nombre=nombre,
            apellido=apellido,
            telefono=telefono
        )
        
        if not user:
            return jsonify({"error": "El usuario o correo ya existe"}), 409
        
        return jsonify({
            "success": True,
            "message": "Usuario registrado exitosamente",
            "user": user
        }), 201
        
    except Exception as e:
        print(f"❌ Error en registro: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error al registrar usuario: {str(e)}"}), 500


if __name__ == "__main__":
    import sys
    port = int(os.getenv("PORT", 8080))
    # En Windows, desactivar use_reloader para evitar errores de socket
    # Mantener debug=True para ver errores detallados
    use_reloader = os.getenv("USE_RELOADER", "false").lower() == "true"
    if sys.platform == "win32":
        use_reloader = False
    
    # Nota: Flask development server tiene limitaciones de timeout
    # Para producción, usa un servidor WSGI como gunicorn con timeout configurado
    app.run(
        host="0.0.0.0", 
        port=port, 
        debug=True,
        use_reloader=use_reloader,
        threaded=True
    )
