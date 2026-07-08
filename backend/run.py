#!/usr/bin/env python3
"""
backend/run.py

Convenience entry-point to start the FastAPI server.

USAGE — from the project root (Translator_App\):
  Windows PowerShell:
      .venv\Scripts\python.exe backend\run.py

  Windows (after activating venv):
      .venv\Scripts\Activate.ps1
      python backend\run.py

  Ubuntu / WSL:
      source .venv/bin/activate
      python backend/run.py

The script auto-adds the backend/ directory to sys.path so
the `app` package is importable regardless of working directory.
"""

import os
import sys

# ── Make the backend package importable from any working directory ────────────
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print(f"[AI Translator] Using Python: {sys.executable}")
    print(f"[AI Translator] Backend dir: {backend_dir}")
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True,
        reload_dirs=[backend_dir],
        log_level="info",
    )
