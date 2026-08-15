"""
backend/app/core/config.py
Centralised settings loaded from the .env file via pydantic-settings.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── External APIs ─────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/dbname"

    # ── Server ───────────────────────────────────────────────────────────────
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # ── JWT Authentication ────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

settings = Settings()
