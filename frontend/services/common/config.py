import os
from dataclasses import dataclass
from typing import List

from dotenv import load_dotenv

load_dotenv()


def get_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass
class ServiceConfig:
    host: str = "0.0.0.0"
    port: int = 8000

    def as_kwargs(self) -> dict:
        return {"host": self.host, "port": self.port}
