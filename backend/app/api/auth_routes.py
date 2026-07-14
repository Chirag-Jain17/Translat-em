"""
backend/app/api/auth_routes.py

Authentication endpoints:
  POST /api/auth/register  — Create account (username, email, password)
  POST /api/auth/login     — Login by username OR email + password
  GET  /api/auth/me        — Return current user info from token
"""

import logging
import re
from typing import Optional
import email_validator

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings
from app.core.auth import create_access_token, get_current_user, hash_password, verify_password
from app.models.database import User, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Request / Response schemas ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if len(v) > 32:
            raise ValueError("Username must be at most 32 characters.")
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError("Username may only contain letters, numbers, underscores, dots, and hyphens.")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        
        # Block common typos that actually have valid MX records
        typo_domains = {"gmial.com", "gamil.com", "yaho.com", "hotmial.com", "outlok.com"}
        domain_part = v.split("@")[-1] if "@" in v else ""
        if domain_part in typo_domains:
            raise ValueError(f"Did you mean {domain_part.replace('gmial', 'gmail').replace('gamil', 'gmail').replace('yaho', 'yahoo').replace('hotmial', 'hotmail').replace('outlok', 'outlook')}? This domain is not allowed.")
            
        try:
            valid = email_validator.validate_email(v, check_deliverability=True)
            return valid.normalized
        except email_validator.EmailNotValidError as e:
            raise ValueError(str(e))

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class LoginRequest(BaseModel):
    identifier: str   # username OR email
    password: str


class AuthUserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class GoogleRegisterRequest(BaseModel):
    google_token: str
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if len(v) > 32:
            raise ValueError("Username must be at most 32 characters.")
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError("Username may only contain letters, numbers, underscores, dots, and hyphens.")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class GoogleLoginRequest(BaseModel):
    google_token: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Create a new account.  Returns a JWT access token on success.
    Validates that username and email are not already taken.
    """
    # Check username uniqueness
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken. Please choose a different one.",
        )

    # Check email uniqueness
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try logging in.",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    logger.info("New user registered: %s (%s)", user.username, user.email)

    return TokenResponse(
        access_token=token,
        user=AuthUserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with username or email + password",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Authenticate with *identifier* (username or email) and *password*.
    Returns a JWT access token on success.
    """
    identifier = payload.identifier.strip().lower()

    # Look up by email first, then by username (case-insensitive)
    user: Optional[User] = (
        db.query(User).filter(User.email == identifier).first()
        or db.query(User).filter(User.username.ilike(identifier)).first()
    )

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
        )

    token = create_access_token({"sub": str(user.id)})
    logger.info("User logged in: %s", user.username)

    return TokenResponse(
        access_token=token,
        user=AuthUserResponse.model_validate(user),
    )


@router.post(
    "/register/google",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account with a Google verified email",
)
def register_google(payload: GoogleRegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Verify the Google token, extract the email, and create a new account
    with the provided username and password.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.google_token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID
        )
        email = idinfo["email"].lower()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token.",
        )

    # Check username uniqueness
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken. Please choose a different one.",
        )

    # Check email uniqueness
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this Google email already exists. Try logging in.",
        )

    user = User(
        username=payload.username,
        email=email,
        hashed_password=hash_password(payload.password),
        avatar_url=idinfo.get("picture")
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    logger.info("New Google user registered: %s (%s)", user.username, user.email)

    return TokenResponse(
        access_token=token,
        user=AuthUserResponse.model_validate(user),
    )


@router.post(
    "/login/google",
    response_model=TokenResponse,
    summary="Login with Google",
)
def login_google(payload: GoogleLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Verify the Google token and log the user in if an account exists.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.google_token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID
        )
        email = idinfo["email"].lower()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token.",
        )

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this Google email. Please register first.",
        )

    token = create_access_token({"sub": str(user.id)})
    logger.info("User logged in via Google: %s", user.username)

    return TokenResponse(
        access_token=token,
        user=AuthUserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=AuthUserResponse,
    summary="Get the currently authenticated user",
)
def me(current_user: User = Depends(get_current_user)) -> AuthUserResponse:
    """Return the user object for the bearer token in the Authorization header."""
    return AuthUserResponse.model_validate(current_user)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete the currently authenticated user account",
)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the current user account and all cascade-deleted associated records."""
    logger.info("User deleted account: %s", current_user.username)
    db.delete(current_user)
    db.commit()
    return None
