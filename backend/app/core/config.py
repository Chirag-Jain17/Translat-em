"""
backend/app/core/config.py
Centralised settings loaded from the .env file via pydantic-settings.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Gemini ──────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./website.db"

    # ── Server ───────────────────────────────────────────────────────────────
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # ── Storage ──────────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def upload_path(self) -> Path:
        """Absolute path to the uploads directory, created on first access."""
        p = Path(self.UPLOAD_DIR).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
