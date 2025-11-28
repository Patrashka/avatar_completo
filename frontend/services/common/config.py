import os
from pathlib import Path
from dataclasses import dataclass
from typing import List

from dotenv import load_dotenv

# Cargar .env con manejo de errores de codificación
try:
    load_dotenv()
except UnicodeDecodeError:
    # Si hay error de codificación, intentar cargar manualmente
    env_path = Path(__file__).parent.parent.parent / '.env'
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
                    break
                except (UnicodeDecodeError, Exception):
                    continue
        except Exception:
            pass


def get_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass
class ServiceConfig:
    host: str = "0.0.0.0"
    port: int = 8000

    def as_kwargs(self) -> dict:
        return {"host": self.host, "port": self.port}
