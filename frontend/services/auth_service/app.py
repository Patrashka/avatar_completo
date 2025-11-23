import pathlib
import sys

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

        user = authenticate_user(username, password)
        if user:
            return jsonify({"success": True, "user": user}), 200

        return jsonify({"success": False, "error": "Credenciales inválidas"}), 401
    except Exception as exc:  # pragma: no cover - logging en stdout
        app.logger.exception("Error en login")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    config = ServiceConfig(port=int(sys.argv[1]) if len(sys.argv) > 1 else 8001)
    app.run(**config.as_kwargs())
