import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict

import google.generativeai as genai
from google.generativeai.types import GenerateContentResponse
from dotenv import load_dotenv

load_dotenv()


@lru_cache()
def get_gemini_model() -> genai.GenerativeModel:
    api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Falta GOOGLE_GEMINI_API_KEY en .env")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-2.5-flash")


def summarize_text(text: str) -> str:
    try:
        model = get_gemini_model()
        prompt = (
            "Eres un médico que redacta notas clínicas. "
            "Resume lo siguiente en máximo 3 líneas, tono médico conciso.\n\n"
            f"Texto: {text}"
        )
        response = model.generate_content(prompt)
        return (response.text or "").strip()
    except Exception as exc:  # pragma: no cover - resumen es best effort
        return f"(Error al resumir: {exc})"


@dataclass
class GeminiClient:
    """Wrapper ligero para exponer estado del cliente de Gemini."""

    _model: genai.GenerativeModel | None = None
    _error: str | None = None

    def __post_init__(self) -> None:
        if self._model is None:
            try:
                self._model = get_gemini_model()
            except Exception as exc:  # pragma: no cover - inicialización perezosa
                self._error = str(exc)

    @property
    def is_ready(self) -> bool:
        return self._model is not None and self._error is None

    @property
    def error(self) -> str | None:
        return self._error

    def generate(self, prompt: str) -> GenerateContentResponse:
        if not self._model:
            raise RuntimeError(self._error or "Gemini no está inicializado")
        return self._model.generate_content(prompt)


@dataclass
class AvatarClient:
    """Administra cabeceras/URLs para la integración con D-ID."""

    api_base: str = "https://api.d-id.com"
    basic_token: str | None = None

    def __post_init__(self) -> None:
        basic_env = os.getenv("DID_BASIC_TOKEN")
        if basic_env:
            self.basic_token = basic_env

    @property
    def is_configured(self) -> bool:
        return bool(self.basic_token)

    def headers(self) -> Dict[str, str]:
        if not self.basic_token:
            raise RuntimeError("Configura DID_BASIC_TOKEN en .env")
        return {
            "authorization": f"Basic {self.basic_token}",
            "accept": "application/json",
            "content-type": "application/json",
        }

    @staticmethod
    def build_payload(source_url: str, voice_id: str) -> Dict[str, Any]:
        return {
            "source_url": source_url,
            "voice": {
                "provider": {"type": "microsoft"},
                "voice_id": voice_id,
            },
            "config": {"stitch": True, "pad_audio": 0.5},
        }
