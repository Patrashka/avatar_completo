import pathlib
import sys
import logging
from typing import Any, Dict, List

from dotenv import load_dotenv
from flask import Flask, jsonify, request

# Ensure project root is importable
ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

DB_ERROR = "Base de datos no disponible"
DB_WARNING = None

try:
    from db_connection import (  # noqa: E402
        assign_patient_to_doctor,
        get_doctor_by_id,
        get_doctor_patient,
        get_doctor_patients,
        search_doctor_patients,
        unassign_patient_from_doctor,
        warmup_postgres_connection,
    )
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

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.get("/health")
def health_check():
    payload: Dict[str, Any] = {"status": "ok", "service": "doctor"}
    if not DB_AVAILABLE:
        payload["db"] = "unavailable"
    if DB_WARNING:
        payload["db_warning"] = DB_WARNING
    return jsonify(payload)


def _require_db() -> Dict[str, Any]:
    if DB_AVAILABLE:
        return {}
    message = getattr(sys.modules[__name__], "DB_ERROR", "Base de datos no disponible")
    return {"error": message}


@app.get("/api/db/doctor/<int:doctor_id>")
def doctor_detail(doctor_id: int):
    if not DB_AVAILABLE:
        return jsonify(_require_db()), 503

    try:
        logger.info(f"Obteniendo datos del doctor {doctor_id}")
        doctor = get_doctor_by_id(doctor_id)
        if not doctor:
            logger.warning(f"Doctor {doctor_id} no encontrado")
            return jsonify({"error": "Médico no encontrado"}), 404
        logger.info(f"Doctor {doctor_id} obtenido correctamente")
        return jsonify(doctor), 200
    except Exception as e:
        logger.error(f"Error al obtener doctor {doctor_id}: {e}", exc_info=True)
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


@app.get("/api/db/doctor/<int:doctor_id>/patient")
def doctor_primary_patient(doctor_id: int):
    if not DB_AVAILABLE:
        return jsonify(_require_db()), 503

    try:
        logger.info(f"Obteniendo paciente principal del doctor {doctor_id}")
        patient = get_doctor_patient(doctor_id)
        if not patient:
            return jsonify({"error": "No hay paciente asignado a este médico"}), 404
        return jsonify(patient), 200
    except Exception as e:
        logger.error(f"Error al obtener paciente principal del doctor {doctor_id}: {e}", exc_info=True)
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


@app.get("/api/db/doctor/<int:doctor_id>/patients")
def doctor_patients(doctor_id: int):
    if not DB_AVAILABLE:
        return jsonify(_require_db()), 503

    try:
        logger.info(f"Obteniendo pacientes del doctor {doctor_id}")
        patients: List[Dict[str, Any]] = get_doctor_patients(doctor_id) or []
        logger.info(f"Se encontraron {len(patients)} pacientes para el doctor {doctor_id}")
        return jsonify(patients), 200
    except Exception as e:
        logger.error(f"Error al obtener pacientes del doctor {doctor_id}: {e}", exc_info=True)
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


@app.get("/api/db/doctor/<int:doctor_id>/patients/search")
def doctor_patients_search(doctor_id: int):
    if not DB_AVAILABLE:
        return jsonify(_require_db()), 503

    try:
        raw_query = request.args.get("query") or request.args.get("q") or ""
        search_term = (raw_query or "").strip()
        limit = request.args.get("limit", default=10, type=int) or 10

        if not search_term or len(search_term) < 2:
            return jsonify([]), 200

        matches = search_doctor_patients(doctor_id, search_term, limit)
        return jsonify(matches or []), 200
    except Exception as e:
        logger.error(f"Error al buscar pacientes del doctor {doctor_id}: {e}", exc_info=True)
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


@app.post("/api/db/doctor/<int:doctor_id>/assign-patient")
def doctor_assign_patient(doctor_id: int):
    if not DB_AVAILABLE:
        return jsonify(_require_db()), 503

    try:
        payload = request.get_json() or {}
        username = (payload.get("username") or "").strip()

        if not username:
            return jsonify({"error": "Se requiere el username del paciente"}), 400

        patient = assign_patient_to_doctor(doctor_id, username)
        if not patient:
            return jsonify({"error": "Paciente no encontrado"}), 404

        return jsonify({"success": True, "patient": patient}), 200
    except Exception as e:
        logger.error(f"Error al asignar paciente al doctor {doctor_id}: {e}", exc_info=True)
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


@app.delete("/api/db/doctor/<int:doctor_id>/patients/<int:patient_id>")
def doctor_unassign_patient(doctor_id: int, patient_id: int):
    if not DB_AVAILABLE:
        return jsonify(_require_db()), 503

    try:
        patient = unassign_patient_from_doctor(doctor_id, patient_id)
        if not patient:
            return jsonify({"error": "Paciente no encontrado o no vinculado"}), 404

        return jsonify({"success": True, "patient": patient}), 200
    except Exception as e:
        logger.error(f"Error al desasignar paciente {patient_id} del doctor {doctor_id}: {e}", exc_info=True)
        return jsonify({"error": f"Error interno: {str(e)}"}), 500


if __name__ == "__main__":
    config = ServiceConfig(port=int(sys.argv[1]) if len(sys.argv) > 1 else 8002)
    app.run(**config.as_kwargs())
