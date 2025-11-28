"""
Módulo de conexión a bases de datos
Maneja conexiones a PostgreSQL y MongoDB
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from datetime import datetime
from typing import Optional, Dict, List, Any
import logging
import bcrypt

# Cargar .env con manejo de errores de codificación
try:
    load_dotenv()
except UnicodeDecodeError as e:
    # Si hay error de codificación, intentar cargar manualmente
    import sys
    import io
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        try:
            # Intentar leer con diferentes codificaciones
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    with open(env_path, 'r', encoding=encoding) as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith('#') and '=' in line:
                                key, value = line.split('=', 1)
                                os.environ[key.strip()] = value.strip()
                    logger.info(f"✅ .env cargado con codificación {encoding}")
                    break
                except (UnicodeDecodeError, Exception):
                    continue
        except Exception as e2:
            logger.warning(f"⚠️ No se pudo cargar .env: {e2}")
    else:
        logger.warning("⚠️ Archivo .env no encontrado")
except Exception as e:
    logger.warning(f"⚠️ Error cargando .env: {e}")

logger = logging.getLogger(__name__)

# ===========================================
# CONFIGURACIÓN DE CONEXIONES
# ===========================================

# PostgreSQL
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "medico_db")
POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "admin123")

# MongoDB
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB = os.getenv("MONGO_DB", "medico_mongo")
MONGO_USER = os.getenv("MONGO_USER", "app_user")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "app_password")

# ===========================================
# CONEXIÓN POSTGRESQL
# ===========================================

_postgres_conn = None

def get_postgres_connection():
    """Obtiene o crea una conexión a PostgreSQL"""
    global _postgres_conn
    try:
        if _postgres_conn is None or _postgres_conn.closed:
            _postgres_conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                database=POSTGRES_DB,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD
            )
            logger.info("✅ Conexión a PostgreSQL establecida")
        return _postgres_conn
    except Exception as e:
        logger.error(f"❌ Error conectando a PostgreSQL: {e}")
        raise


def warmup_postgres_connection():
    """Establece la conexión y ejecuta un SELECT rápido para evitar la latencia del primer request."""
    conn = get_postgres_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
    finally:
        try:
            conn.rollback()
        except Exception:
            pass

def execute_query(query: str, params: tuple = None, fetch: bool = True) -> List[Dict]:
    """Ejecuta una consulta SQL y retorna los resultados como lista de diccionarios"""
    conn = get_postgres_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            if fetch:
                results = cursor.fetchall()
                conn.commit()
                return results
            conn.commit()
            return []
    except Exception as e:
        conn.rollback()
        logger.error(f"Error ejecutando query: {e}")
        raise

def execute_one(query: str, params: tuple = None) -> Optional[Dict]:
    """Ejecuta una consulta y retorna un solo resultado"""
    results = execute_query(query, params, fetch=True)
    return results[0] if results else None

# ===========================================
# CONEXIÓN MONGODB
# ===========================================

_mongo_client = None
_mongo_db = None

def get_mongo_client():
    """Obtiene o crea un cliente de MongoDB"""
    global _mongo_client
    try:
        if _mongo_client is None:
            # Intentar primero con app_user, si falla usar admin
            try:
                mongo_uri = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin"
                _mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
                _mongo_client.admin.command('ping')
                logger.info("✅ Conexión a MongoDB establecida con app_user")
            except Exception:
                # Si falla, usar admin
                logger.warning("⚠️ Falló conexión con app_user, usando admin")
                mongo_uri = f"mongodb://admin:admin123@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}?authSource=admin"
                _mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
                _mongo_client.admin.command('ping')
                logger.info("✅ Conexión a MongoDB establecida con admin")
        return _mongo_client
    except ConnectionFailure as e:
        logger.error(f"❌ Error conectando a MongoDB: {e}")
        raise

def get_mongo_db():
    """Obtiene la base de datos de MongoDB"""
    global _mongo_db
    if _mongo_db is None:
        client = get_mongo_client()
        _mongo_db = client[MONGO_DB]
    return _mongo_db

# ===========================================
# FUNCIONES PARA INTERACCIONES DE IA
# ===========================================

def save_ia_interaction(
    tipo: str,
    mensaje_usuario: str = None,
    respuesta_ia: str = None,
    usuario_id: int = None,
    paciente_id: int = None,
    consulta_id: int = None,
    modelo_ia: str = "gemini-2.5-flash",
    metadata: Dict = None
) -> str:
    """
    Guarda una interacción de IA en MongoDB
    
    Args:
        tipo: 'avatar', 'paciente', 'doctor', 'archivo'
        mensaje_usuario: Mensaje del usuario
        respuesta_ia: Respuesta de la IA
        usuario_id: ID del usuario
        paciente_id: ID del paciente
        consulta_id: ID de la consulta
        modelo_ia: Modelo de IA usado
        metadata: Metadatos adicionales
    
    Returns:
        ID del documento insertado
    """
    db = get_mongo_db()
    collection = db.interaccion_ia
    
    doc = {
        "tipo": tipo,
        "fecha": datetime.utcnow(),
        "modelo_ia": modelo_ia
    }
    
    if mensaje_usuario:
        doc["mensaje_usuario"] = mensaje_usuario
    if respuesta_ia:
        doc["respuesta_ia"] = respuesta_ia
    if usuario_id:
        doc["usuario_id"] = usuario_id
    if paciente_id:
        doc["paciente_id"] = paciente_id
    if consulta_id:
        doc["consulta_id"] = consulta_id
    if metadata:
        doc["metadata"] = metadata
    
    result = collection.insert_one(doc)
    logger.info(f"💾 Interacción de IA guardada: {result.inserted_id}")
    return str(result.inserted_id)

def save_avatar_session(
    usuario_id: int = None,
    canal: str = "video",
    idioma: str = "es",
    paciente_id: int = None,
    medico_id: int = None,
    stream_id: str = None,
    session_id: str = None
) -> str:
    """
    Crea una nueva sesión de avatar en MongoDB
    
    Returns:
        ID de la sesión creada
    """
    db = get_mongo_db()
    collection = db.sesion_avatar
    
    doc = {
        "canal": canal,
        "idioma": idioma,
        "fecha_inicio": datetime.utcnow(),
        "fecha_fin": None
    }
    
    if usuario_id:
        doc["usuario_id"] = usuario_id
    
    if paciente_id:
        doc["paciente_id"] = paciente_id
    if medico_id:
        doc["medico_id"] = medico_id
    if stream_id:
        doc["stream_id"] = stream_id
    if session_id:
        doc["session_id"] = session_id
    
    result = collection.insert_one(doc)
    logger.info(f"🎭 Sesión de avatar creada: {result.inserted_id}")
    return str(result.inserted_id)

def save_conversation_turn(
    sesion_id: str,
    origen: str,
    texto: str,
    metadata: Dict = None
) -> str:
    """
    Guarda un turno de conversación en MongoDB
    
    Args:
        sesion_id: ID de la sesión (ObjectId como string)
        origen: 'usuario', 'avatar', 'sistema', 'ia'
        texto: Texto del mensaje
        metadata: Metadatos adicionales
    
    Returns:
        ID del turno creado
    """
    from bson import ObjectId
    
    db = get_mongo_db()
    collection = db.turno_conversacion
    
    doc = {
        "id_sesion": ObjectId(sesion_id),
        "origen": origen,
        "texto": texto,
        "fecha": datetime.utcnow()
    }
    
    if metadata:
        doc["metadata"] = metadata
    
    result = collection.insert_one(doc)
    logger.info(f"💬 Turno de conversación guardado: {result.inserted_id}")
    return str(result.inserted_id)

def get_patient_interactions(paciente_id: int, limit: int = 50) -> List[Dict]:
    """Obtiene las interacciones de IA de un paciente"""
    db = get_mongo_db()
    collection = db.interaccion_ia
    
    interactions = list(collection.find(
        {"paciente_id": paciente_id}
    ).sort("fecha", -1).limit(limit))
    
    # Convertir ObjectId a string
    for item in interactions:
        item["_id"] = str(item["_id"])
        if "fecha" in item:
            item["fecha"] = item["fecha"].isoformat()
    
    return interactions

# ===========================================
# FUNCIONES PARA DATOS DE POSTGRESQL
# ===========================================

def _normalize_patient_record(record: Optional[Dict]) -> Optional[Dict]:
    """Normaliza la información de un paciente para el frontend."""
    if not record:
        return record

    data = dict(record)
    nombre_completo = data.get("nombre", "") or ""
    partes_nombre = nombre_completo.split(" ", 1)
    data["nombre"] = partes_nombre[0] if partes_nombre else ""
    data["apellido"] = partes_nombre[1] if len(partes_nombre) > 1 else ""

    data["id_tipo_sangre"] = data.get("tipo_sangre_id")
    data["id_ocupacion"] = data.get("ocupacion_id")
    data["id_estado_civil"] = data.get("estado_civil_id")
    data.setdefault("foto_archivo_id", None)

    return data


def get_patient_by_id(patient_id: int) -> Optional[Dict]:
    """Obtiene un paciente por ID con información relacionada usando stored procedure"""
    query = "SELECT * FROM get_patient_by_id_sp(%s)"
    result = execute_one(query, (patient_id,))
    return _normalize_patient_record(result)

def get_patient_diagnoses(patient_id: int) -> List[Dict]:
    """Obtiene los diagnósticos (condiciones) de un paciente usando stored procedure"""
    query = "SELECT * FROM get_patient_diagnoses_sp(%s)"
    return execute_query(query, (patient_id,))

def get_patient_consultations(patient_id: int, limit: int = 10) -> List[Dict]:
    """Obtiene las consultas de un paciente usando stored procedure"""
    query = "SELECT * FROM get_patient_consultations_sp(%s, %s)"
    results = execute_query(query, (patient_id, limit))
    # Mapear campos para compatibilidad
    for result in results:
        result['cita_id'] = result.get('cita_id', 0)
        result['id_estado_consulta'] = result.get('id_estado_consulta', 0)
        result['id_episodio'] = result.get('id_episodio', 0)
    return results

def get_patient_files(patient_id: int) -> List[Dict]:
    """Obtiene los archivos asociados a un paciente usando stored procedure"""
    query = "SELECT * FROM get_patient_files_sp(%s)"
    return execute_query(query, (patient_id,))

# ===========================================
# FUNCIONES DE AUTENTICACIÓN
# ===========================================

def authenticate_user(username: str, password: str) -> Optional[Dict]:
    """
    Autentica un usuario y retorna información del paciente o médico asociado
    
    Args:
        username: Username o correo del usuario
        password: Contraseña (por ahora se valida cualquier contraseña para pruebas)
    
    Returns:
        Diccionario con información del usuario y paciente/médico, o None si falla
    """
    query = """
        SELECT 
            u.id as usuario_id,
            u.username,
            u.correo,
            u.rol_id,
            u.password_hash,
            p.id as paciente_id,
            p.nombre as paciente_nombre,
            p.correo as paciente_correo,
            m.id as medico_id,
            m.nombre as medico_nombre,
            m.cedula as medico_cedula,
            m.correo as medico_correo,
            e.nombre as especialidad,
            (SELECT url FROM ARCHIVO a 
             JOIN ARCHIVO_ASOCIACION aa ON a.id = aa.archivo_id 
             WHERE ((aa.entidad = 'PACIENTE' AND aa.entidad_id = p.id) 
                    OR (aa.entidad = 'MEDICO' AND aa.entidad_id = m.id))
             AND aa.descripcion = 'Foto de perfil'
             LIMIT 1) as foto_url
        FROM USUARIO u
        LEFT JOIN PACIENTE p ON p.usuario_id = u.id
        LEFT JOIN MEDICO m ON m.usuario_id = u.id
        LEFT JOIN ESPECIALIDAD e ON m.id_especialidad = e.id
        WHERE (u.username = %s OR u.correo = %s)
        AND (u.rol_id = 2 OR u.rol_id = 3)  -- Médicos o pacientes
    """
    result = execute_one(query, (username, username))
    
    # Validar contraseña con bcrypt
    if result:
        stored_hash = result.get("password_hash")
        if stored_hash:
            try:
                # Verificar contraseña
                if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
                    return None  # Contraseña incorrecta
            except Exception as e:
                logger.error(f"Error al verificar contraseña: {e}")
                return None
        else:
            # Si no hay hash, rechazar (modo seguro)
            return None
        rol_id = result.get("rol_id")
        if rol_id == 3:  # Paciente
            return {
                "usuario_id": result.get("usuario_id"),
                "username": result.get("username"),
                "correo": result.get("correo"),
                "rol": "paciente",
                "paciente_id": result.get("paciente_id"),
                "paciente_nombre": result.get("paciente_nombre"),
                "foto_url": result.get("foto_url")
            }
        elif rol_id == 2:  # Médico
            return {
                "usuario_id": result.get("usuario_id"),
                "username": result.get("username"),
                "correo": result.get("correo"),
                "rol": "doctor",
                "medico_id": result.get("medico_id"),
                "medico_nombre": result.get("medico_nombre"),
                "medico_cedula": result.get("medico_cedula"),
                "especialidad": result.get("especialidad"),
                "foto_url": result.get("foto_url")
            }
    return None

def get_patient_photo(patient_id: int) -> Optional[str]:
    """Obtiene la URL de la foto de perfil de un paciente"""
    query = """
        SELECT a.url
        FROM ARCHIVO a
        JOIN ARCHIVO_ASOCIACION aa ON a.id = aa.archivo_id
        WHERE aa.entidad = 'PACIENTE' 
        AND aa.entidad_id = %s
        AND aa.descripcion = 'Foto de perfil'
        LIMIT 1
    """
    result = execute_one(query, (patient_id,))
    return result.get("url") if result else None


def get_doctor_by_id(doctor_id: int) -> Optional[Dict]:
    """Obtiene un médico por ID usando stored procedure"""
    query = "SELECT * FROM get_doctor_by_id_sp(%s)"
    result = execute_one(query, (doctor_id,))
    
    if result:
        # Separar nombre completo en nombre y apellido
        nombre_completo = result.get('nombre', '')
        partes_nombre = nombre_completo.split(' ', 1)
        result['nombre'] = partes_nombre[0] if len(partes_nombre) > 0 else ''
        result['apellido'] = partes_nombre[1] if len(partes_nombre) > 1 else ''
        
        # Obtener foto de perfil
        foto_url = get_doctor_photo(doctor_id)
        result['foto_url'] = foto_url
        
    return result

def get_doctor_photo(doctor_id: int) -> Optional[str]:
    """Obtiene la URL de la foto de perfil de un médico"""
    query = """
        SELECT a.url
        FROM ARCHIVO a
        JOIN ARCHIVO_ASOCIACION aa ON a.id = aa.archivo_id
        WHERE aa.entidad = 'MEDICO' 
        AND aa.entidad_id = %s
        AND aa.descripcion = 'Foto de perfil'
        LIMIT 1
    """
    result = execute_one(query, (doctor_id,))
    return result.get("url") if result else None

def get_doctor_patients(doctor_id: int) -> List[Dict]:
    """Obtiene todos los pacientes asignados a un médico usando stored procedure"""
    query = "SELECT * FROM get_doctor_patients_sp(%s)"
    results = execute_query(query, (doctor_id,))
    return [_normalize_patient_record(row) for row in results]


def search_doctor_patients(doctor_id: int, search_term: str, limit: int = 10) -> List[Dict]:
    """Busca pacientes del médico por nombre u otros campos legibles."""
    if not search_term:
        return []

    sanitized_limit = max(1, min(limit, 25))
    query = "SELECT * FROM search_doctor_patients_sp(%s, %s, %s)"
    results = execute_query(query, (doctor_id, search_term, sanitized_limit))
    return [_normalize_patient_record(row) for row in results]


def get_doctor_patient(doctor_id: int) -> Optional[Dict]:
    """Obtiene el primer paciente asignado a un médico para compatibilidad retro"""
    patients = get_doctor_patients(doctor_id)
    return patients[0] if patients else None


def assign_patient_to_doctor(doctor_id: int, patient_username: str) -> Optional[Dict]:
    """Vincula un paciente (por username) con un médico y retorna sus datos normalizados."""
    if not patient_username:
        return None

    username = patient_username.strip()
    if not username:
        return None

    query = """
        WITH target AS (
            SELECT p.id
            FROM paciente p
            JOIN usuario u ON u.id = p.usuario_id
            WHERE LOWER(u.username) = LOWER(%s)
            LIMIT 1
        )
        UPDATE paciente p
        SET id_medico_gen = %s
        WHERE p.id = (SELECT id FROM target)
        RETURNING p.id
    """

    conn = get_postgres_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (username, doctor_id))
            result = cursor.fetchone()
            conn.commit()

        if not result or not result.get("id"):
            return None

        patient_id = result["id"]
        return get_patient_by_id(patient_id)
    except Exception as e:
        conn.rollback()
        logger.error(f"Error vinculando paciente '{patient_username}' con médico {doctor_id}: {e}")
        raise


def unassign_patient_from_doctor(doctor_id: int, patient_id: int) -> Optional[Dict]:
    """Desvincula un paciente del médico si coincide con el médico actual."""
    if not patient_id:
        return None

    query = """
        UPDATE paciente
        SET id_medico_gen = NULL
        WHERE id = %s AND (id_medico_gen = %s OR id_medico_gen IS NULL)
        RETURNING id
    """

    conn = get_postgres_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (patient_id, doctor_id))
            result = cursor.fetchone()
            conn.commit()

        if not result or not result.get("id"):
            return None

        return get_patient_by_id(patient_id)
    except Exception as e:
        conn.rollback()
        logger.error(f"Error desvinculando paciente {patient_id} del médico {doctor_id}: {e}")
        raise

def update_patient(patient_id: int, patient_data: Dict) -> bool:
    """Actualiza los datos de un paciente usando stored procedure"""
    try:
        # Construir nombre completo
        nombre_completo = f"{patient_data.get('nombre', '')} {patient_data.get('apellido', '')}".strip()
        
        query = "SELECT update_patient_sp(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) as success"
        params = (
            patient_id,
            nombre_completo,
            patient_data.get('fecha_nacimiento') or None,
            patient_data.get('sexo') or None,
            float(patient_data.get('altura', 0)) if patient_data.get('altura') else None,
            float(patient_data.get('peso', 0)) if patient_data.get('peso') else None,
            patient_data.get('estilo_vida') or None,
            patient_data.get('id_tipo_sangre') or None,
            patient_data.get('id_ocupacion') or None,
            patient_data.get('id_estado_civil') or None,
            patient_data.get('id_medico_gen') or None,
        )
        result = execute_one(query, params)
        return result.get('success', False) if result else False
    except Exception as e:
        logger.error(f"Error actualizando paciente: {e}")
        raise

def update_consultation(consultation_id: int, consultation_data: Dict) -> bool:
    """Actualiza los datos de una consulta usando stored procedure"""
    try:
        query = "SELECT update_consultation_sp(%s, %s, %s) as success"
        params = (
            consultation_id,
            consultation_data.get('narrativa') or None,
            consultation_data.get('diagnostico_final') or None,
        )
        result = execute_one(query, params)
        return result.get('success', False) if result else False
    except Exception as e:
        logger.error(f"Error actualizando consulta: {e}")
        raise

def get_doctors() -> List[Dict]:
    """Obtiene la lista de todos los médicos"""
    query = "SELECT id, nombre FROM MEDICO ORDER BY id"
    return execute_query(query)

def get_catalogos() -> Dict[str, List[Dict]]:
    """Obtiene todos los catálogos del sistema usando queries directas"""
    # Usar queries directas para mayor confiabilidad
    return {
        "TIPO_SANGRE": execute_query("SELECT id, tipo as nombre FROM TIPO_SANGRE ORDER BY id"),
        "OCUPACION": execute_query("SELECT id, nombre FROM OCUPACION ORDER BY id"),
        "ESTADO_CIVIL": execute_query("SELECT id, nombre FROM ESTADO_CIVIL ORDER BY id"),
        "ESPECIALIDAD": execute_query("SELECT id, nombre FROM ESPECIALIDAD ORDER BY id"),
        "ESTADO_CITA": execute_query("SELECT id, nombre FROM ESTADO_CITA ORDER BY id"),
        "TIPO_CITA": execute_query("SELECT id, nombre FROM TIPO_CITA ORDER BY id"),
        "ESTADO_CONSULTA": execute_query("SELECT id, nombre FROM ESTADO_CONSULTA ORDER BY id"),
    }

