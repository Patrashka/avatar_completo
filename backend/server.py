import os
import xml.etree.ElementTree as ET
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

import google.generativeai as genai

app = Flask(__name__)
CORS(app)

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
