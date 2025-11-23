from flask_cors import CORS

from .config import get_allowed_origins


def apply_cors(app):
    origins = get_allowed_origins()
    CORS(
        app,
        resources={r"/*": {"origins": origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )
