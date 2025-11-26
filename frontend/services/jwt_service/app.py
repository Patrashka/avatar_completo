"""
Microservicio de Gestión de JWT Tokens con Redis
Proporciona endpoints para autenticación, validación y gestión de tokens JWT
"""
import os
import sys
import pathlib
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Agregar el directorio actual al path para imports
ROOT_DIR = pathlib.Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from jwt_service import JWTService
from redis_service import RedisService
import logging

# Cargar variables de entorno
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Inicializar servicios
try:
    redis_service = RedisService()
    jwt_service = JWTService(redis_service)
    REDIS_AVAILABLE = True
except Exception as e:
    logger.error(f"Error inicializando servicios: {e}")
    REDIS_AVAILABLE = False
    redis_service = None
    jwt_service = None


@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de salud del microservicio"""
    try:
        if not REDIS_AVAILABLE:
            return jsonify({
                "status": "unhealthy",
                "redis": "disconnected",
                "service": "jwt-redis-service",
                "error": "Redis no disponible"
            }), 503
        
        redis_status = redis_service.check_connection()
        return jsonify({
            "status": "healthy" if redis_status else "degraded",
            "redis": "connected" if redis_status else "disconnected",
            "service": "jwt-redis-service"
        }), 200
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """
    Endpoint de login - Genera JWT token y lo almacena en Redis
    
    Body esperado:
    {
        "username": "string",
        "password": "string",
        "user_id": "string|int",
        "role": "string",
        "metadata": {} (opcional)
    }
    """
    try:
        if not REDIS_AVAILABLE:
            return jsonify({"error": "Servicio JWT no disponible"}), 503
        
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No se proporcionaron datos"}), 400
        
        username = data.get("username")
        password = data.get("password")
        user_id = data.get("user_id")
        role = data.get("role", "user")
        metadata = data.get("metadata", {})
        
        if not username or not password or not user_id:
            return jsonify({
                "error": "username, password y user_id son requeridos"
            }), 400
        
        # Generar tokens
        tokens = jwt_service.generate_tokens(
            user_id=str(user_id),
            username=username,
            role=role,
            metadata=metadata
        )
        
        return jsonify({
            "success": True,
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "expires_in": tokens["expires_in"],
            "token_type": "Bearer"
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/validate', methods=['POST'])
def validate_token():
    """
    Endpoint para validar un JWT token
    
    Body esperado:
    {
        "token": "string"
    }
    
    O header Authorization: Bearer <token>
    """
    try:
        if not REDIS_AVAILABLE:
            return jsonify({"error": "Servicio JWT no disponible"}), 503
        
        # Intentar obtener token del header primero
        auth_header = request.headers.get('Authorization')
        token = None
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            # Si no está en el header, buscar en el body
            data = request.get_json() or {}
            token = data.get("token")
        
        if not token:
            return jsonify({"error": "Token no proporcionado"}), 400
        
        # Validar token
        payload = jwt_service.validate_token(token)
        
        if payload:
            return jsonify({
                "valid": True,
                "payload": payload
            }), 200
        else:
            return jsonify({
                "valid": False,
                "error": "Token inválido o expirado"
            }), 401
            
    except Exception as e:
        logger.error(f"Validate token error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/refresh', methods=['POST'])
def refresh_token():
    """
    Endpoint para refrescar un access token usando un refresh token
    
    Body esperado:
    {
        "refresh_token": "string"
    }
    """
    try:
        if not REDIS_AVAILABLE:
            return jsonify({"error": "Servicio JWT no disponible"}), 503
        
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No se proporcionaron datos"}), 400
        
        refresh_token = data.get("refresh_token")
        
        if not refresh_token:
            return jsonify({"error": "refresh_token es requerido"}), 400
        
        # Refrescar token
        new_tokens = jwt_service.refresh_access_token(refresh_token)
        
        if new_tokens:
            return jsonify({
                "success": True,
                "access_token": new_tokens["access_token"],
                "expires_in": new_tokens["expires_in"],
                "token_type": "Bearer"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Refresh token inválido o expirado"
            }), 401
            
    except Exception as e:
        logger.error(f"Refresh token error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """
    Endpoint para hacer logout - Revoca los tokens
    
    Body esperado:
    {
        "token": "string" (access token)
    }
    
    O header Authorization: Bearer <token>
    """
    try:
        if not REDIS_AVAILABLE:
            return jsonify({"error": "Servicio JWT no disponible"}), 503
        
        # Intentar obtener token del header primero
        auth_header = request.headers.get('Authorization')
        token = None
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            # Si no está en el header, buscar en el body
            data = request.get_json() or {}
            token = data.get("token")
        
        if not token:
            return jsonify({"error": "Token no proporcionado"}), 400
        
        # Revocar token
        success = jwt_service.revoke_token(token)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Token revocado exitosamente"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "No se pudo revocar el token"
            }), 400
            
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/user-info', methods=['GET'])
def get_user_info():
    """
    Endpoint para obtener información del usuario desde el token
    
    Requiere header: Authorization: Bearer <token>
    """
    try:
        if not REDIS_AVAILABLE:
            return jsonify({"error": "Servicio JWT no disponible"}), 503
        
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Token no proporcionado"}), 401
        
        token = auth_header.split(' ')[1]
        
        # Validar y obtener payload
        payload = jwt_service.validate_token(token)
        
        if payload:
            return jsonify({
                "success": True,
                "user": {
                    "user_id": payload.get("user_id"),
                    "username": payload.get("username"),
                    "role": payload.get("role"),
                    "metadata": payload.get("metadata", {})
                }
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Token inválido o expirado"
            }), 401
            
    except Exception as e:
        logger.error(f"Get user info error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Agregar el directorio raíz al path para imports
    ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
    if str(ROOT_DIR) not in sys.path:
        sys.path.append(str(ROOT_DIR))
    
    try:
        from services.common.config import ServiceConfig
        config = ServiceConfig(port=int(sys.argv[1]) if len(sys.argv) > 1 else 8014)
        port = config.port
    except ImportError:
        # Si no está disponible, usar valores por defecto
        port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.getenv('PORT', 8014))
    
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Iniciando microservicio JWT-Redis en puerto {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)

