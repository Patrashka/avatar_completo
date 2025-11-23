import pathlib
import sys
from typing import Any, Dict

from dotenv import load_dotenv
from flask import Flask, jsonify, request

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

DB_ERROR = "Base de datos no disponible"
DB_WARNING = None

try:
    from db_connection import (  # noqa: E402
        get_catalogos,
        get_doctors,
        get_patient_by_id,
        get_patient_consultations,
        get_patient_diagnoses,
        get_patient_files,
        get_patient_photo,
        update_consultation,
        update_patient,
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


@app.get("/health")
def health_check():
    payload = {"status": "ok", "service": "patient"}
    if not DB_AVAILABLE:
        payload["db"] = "unavailable"
    if DB_WARNING:
        payload["db_warning"] = DB_WARNING
    return jsonify(payload)


@app.get("/api/db/catalogos")
def catalogos():
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    catalogos_data = get_catalogos()
    try:
        medicos = get_doctors()
        catalogos_data["MEDICO"] = [
            {"id": doctor.get("id"), "nombre": doctor.get("nombre")}
            for doctor in medicos or []
        ]
    except Exception:
        catalogos_data.setdefault("MEDICO", [])
    return jsonify(catalogos_data), 200


@app.get("/api/db/patient/<int:patient_id>")
def patient_detail(patient_id: int):
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    patient = get_patient_by_id(patient_id)
    if not patient:
        return jsonify({"error": "Paciente no encontrado"}), 404
    return jsonify(patient), 200


@app.get("/api/db/patient/<int:patient_id>/consultations")
def patient_consultations(patient_id: int):
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    consultations = get_patient_consultations(patient_id) or []
    return jsonify(consultations), 200


@app.get("/api/db/patient/<int:patient_id>/files")
def patient_files(patient_id: int):
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    files = get_patient_files(patient_id) or []
    return jsonify(files), 200


@app.get("/api/db/patient/<int:patient_id>/diagnoses")
def patient_diagnoses(patient_id: int):
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    diagnoses = get_patient_diagnoses(patient_id) or []
    return jsonify(diagnoses), 200


@app.get("/api/db/patient/<int:patient_id>/photo")
def patient_photo(patient_id: int):
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    photo_url = get_patient_photo(patient_id)
    return jsonify({"photo_url": photo_url}), 200


@app.put("/api/db/patient/<int:patient_id>")
def patient_update(patient_id: int):
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    data: Dict[str, Any] = request.get_json() or {}
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400

    update_patient(patient_id, data)
    return jsonify({"success": True, "message": "Paciente actualizado correctamente"}), 200


@app.put("/api/db/consultation/<int:consultation_id>")
def consultation_update(consultation_id: int):
    if not DB_AVAILABLE:
        return jsonify({"error": DB_ERROR}), 503

    data: Dict[str, Any] = request.get_json() or {}
    if not data:
        return jsonify({"error": "No se proporcionaron datos"}), 400

    update_consultation(consultation_id, data)
    return jsonify({"success": True, "message": "Consulta actualizada correctamente"}), 200


if __name__ == "__main__":
    config = ServiceConfig(port=int(sys.argv[1]) if len(sys.argv) > 1 else 8003)
    app.run(**config.as_kwargs())
