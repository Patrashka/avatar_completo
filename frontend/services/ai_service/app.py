import pathlib
import sys

from dotenv import load_dotenv
from flask import Flask, jsonify

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from services.common.ai import AvatarClient, GeminiClient
from services.common.config import ServiceConfig
from services.common.cors import apply_cors

load_dotenv()

gemini = GeminiClient()
avatar = AvatarClient()

app = Flask(__name__)
apply_cors(app)


@app.get("/health")
def health_check():
    return jsonify({
        "status": "ok",
        "service": "ai",
        "gemini_ready": gemini.is_ready,
        "avatar_configured": avatar.is_configured,
    })


if __name__ == "__main__":
    config = ServiceConfig(port=int(sys.argv[1]) if len(sys.argv) > 1 else 8004)
    app.run(**config.as_kwargs())
