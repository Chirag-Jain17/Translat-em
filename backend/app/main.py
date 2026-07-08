"""
backend/app/main.py

FastAPI application factory.

- Registers CORS middleware with explicit Vite dev-server origin
- Mounts the API router under /api
- Auto-creates SQLite tables on startup
- Creates the uploads/ directory on startup
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import settings
from app.models.database import create_db_and_tables

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ai_translator")


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once at startup before the first request is handled."""
    logger.info("=== AI Translator API starting up ===")

    # Ensure the uploads directory exists
    uploads_dir = settings.upload_path
    logger.info("Upload directory: %s", uploads_dir)

    # Auto-create SQLite tables
    create_db_and_tables()
    logger.info("Database tables verified / created.")

    logger.info("=== Startup complete. Listening on http://%s:%d ===",
                settings.BACKEND_HOST, settings.BACKEND_PORT)
    yield
    logger.info("=== AI Translator API shutting down ===")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Translator API",
    description=(
        "Production-ready REST API for an AI-powered translation website. "
        "Supports text, image (OCR), and PDF translation via Google Gemini."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Explicitly allow the Vite dev-server origin so the browser never blocks requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default dev port
        "http://127.0.0.1:5173",
        "http://localhost:3000",   # CRA / alternative port
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount static uploads directory ───────────────────────────────────────────
# This allows the frontend to reference uploaded images directly via URL.
uploads_path = settings.upload_path
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# ── Register API router ───────────────────────────────────────────────────────
app.include_router(router, prefix="/api")


# ── Root health check ─────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
async def root():
    return {
        "service": "AI Translator API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}