"""
backend/app/core/auth.py

Authentication utilities:
  - Password hashing & verification (bcrypt via passlib)
  - JWT creation & decoding (python-jose)
  - FastAPI dependency: get_current_user  — reads Authorization header,
    decodes the token, and returns the authenticated User ORM object.
  - FastAPI dependency: get_optional_user — same but returns None instead
    of raising 401, used for endpoints that work both authed and anonymous.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import User, get_db

logger = logging.getLogger(__name__)

# ── Bearer scheme (auto_error=False so optional auth never raises) ──────────────────
_bearer = HTTPBearer(auto_error=False)


# ── Password helpers ────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return the bcrypt hash of *plain* as a UTF-8 string."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict) -> str:
    """
    Create a signed JWT containing *data* + an expiry claim.
    The token expires after ACCESS_TOKEN_EXPIRE_MINUTES minutes.
    """
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload["exp"] = expire
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and verify *token*.
    Raises JWTError (from python-jose) if the token is invalid or expired.
    """
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def _extract_user(
    credentials: Optional[HTTPAuthorizationCredentials],
    db: Session,
    require: bool,
) -> Optional[User]:
    """
    Shared logic for get_current_user / get_optional_user.
    If *require* is True, raises HTTP 401 when auth is missing or invalid.
    """
    if credentials is None:
        if require:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated. Please log in.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None

    try:
        payload = decode_access_token(credentials.credentials)
        user_id: Optional[int] = payload.get("sub")
        if user_id is None:
            raise JWTError("Missing sub claim")
    except JWTError as exc:
        if require:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        return None

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None and require:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — REQUIRED auth.
    Returns the authenticated User or raises HTTP 401.
    """
    return _extract_user(credentials, db, require=True)


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    FastAPI dependency — OPTIONAL auth.
    Returns the authenticated User or None (never raises).
    """
    return _extract_user(credentials, db, require=False)
