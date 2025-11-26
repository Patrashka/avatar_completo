import pathlib
import sys
import requests
import os

from flask import Flask, jsonify, request
from dotenv import load_dotenv

# Ensure project root is on path for db_connection import
ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

DB_ERROR = "Base de datos no disponible"
DB_WARNING = None

try:
    from db_connection import authenticate_user, warmup_postgres_connection  # noqa: E402
    DB_AVAILABLE = True
    try:
        warmup_postgres_connection()
    except Exception as warm_exc:  # pragma: no cover - logging en stdout
        DB_WARNING = str(warm_exc)
except Exception as exc:  # pragma: no cover - logging en stdout
    DB_AVAILABLE = False
    DB_ERROR = str(exc)

from services.common.config import ServiceConfig
from services.common.cors import apply_cors

load_dotenv()

app = Flask(__name__)
apply_cors(app)

# Configuración del servicio JWT
JWT_SERVICE_URL = os.getenv('JWT_SERVICE_URL', 'http://127.0.0.1:8014')
JWT_ENABLED = os.getenv('JWT_ENABLED', 'true').lower() == 'true'


@app.get("/health")
def health_check():
    payload = {"status": "ok", "service": "auth"}
    if not DB_AVAILABLE:
        payload["db"] = "unavailable"
    if DB_WARNING:
        payload["db_warning"] = DB_WARNING
    return jsonify(payload)


@app.post("/login")
@app.post("/api/auth/login")
def login():
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    try:
        payload = request.get_json() or {}
        username = (payload.get("username") or "").strip()
        password = payload.get("password") or ""

        if not username or not password:
            return jsonify({"error": "Usuario y contraseña requeridos"}), 400

        # Autenticar usuario contra la base de datos
        user = authenticate_user(username, password)
        if not user:
            return jsonify({"success": False, "error": "Credenciales inválidas"}), 401

        # Si JWT está habilitado, generar tokens
        if JWT_ENABLED:
            try:
                # Preparar datos para el servicio JWT
                jwt_payload = {
                    "username": username,
                    "password": password,  # El servicio JWT puede validar si es necesario
                    "user_id": str(user.get("usuario_id") or user.get("paciente_id") or user.get("medico_id")),
                    "role": user.get("rol", "user"),
                    "metadata": {
                        "paciente_id": user.get("paciente_id"),
                        "medico_id": user.get("medico_id"),
                        "correo": user.get("correo"),
                        "foto_url": user.get("foto_url")
                    }
                }
                
                # Llamar al servicio JWT
                jwt_response = requests.post(
                    f"{JWT_SERVICE_URL}/api/auth/login",
                    json=jwt_payload,
                    timeout=5
                )
                
                if jwt_response.status_code == 200:
                    jwt_data = jwt_response.json()
                    # Combinar datos del usuario con tokens JWT
                    return jsonify({
                        "success": True,
                        "user": user,
                        "access_token": jwt_data.get("access_token"),
                        "refresh_token": jwt_data.get("refresh_token"),
                        "expires_in": jwt_data.get("expires_in"),
                        "token_type": jwt_data.get("token_type", "Bearer")
                    }), 200
                else:
                    # Si JWT falla, retornar sin tokens (modo compatible)
                    app.logger.warning(f"JWT service error: {jwt_response.status_code}")
                    return jsonify({"success": True, "user": user}), 200
                    
            except requests.exceptions.RequestException as e:
                # Si el servicio JWT no está disponible, continuar sin tokens
                app.logger.warning(f"JWT service no disponible: {e}")
                return jsonify({"success": True, "user": user}), 200
        
        # Si JWT no está habilitado, retornar solo datos del usuario
        return jsonify({"success": True, "user": user}), 200
        
    except Exception as exc:  # pragma: no cover - logging en stdout
        app.logger.exception("Error en login")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    config = ServiceConfig(port=int(sys.argv[1]) if len(sys.argv) > 1 else 8001)
    app.run(**config.as_kwargs())
