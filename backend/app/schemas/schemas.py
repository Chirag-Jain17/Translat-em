"""
backend/app/schemas/schemas.py
Pydantic request/response schemas for the API layer.
"""

import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Translation Schemas ───────────────────────────────────────────────────────

class TextTranslationRequest(BaseModel):
    """Request body for text-only translation (no file upload)."""
    text: str = Field(..., min_length=1, max_length=50_000, description="Source text to translate.")
    source_language: str = Field(default="auto", description="BCP-47 source language code or 'auto'.")
    target_language: str = Field(..., description="BCP-47 target language code, e.g. 'fr'.")
    title: str = Field(default="Untitled", max_length=255)
    author: str = Field(default="anonymous", max_length=64)
    is_public: bool = Field(default=True)


class TranslationResponse(BaseModel):
    """Full translation record returned from the API."""
    id: int
    title: str
    author: str
    original_language: str
    translated_language: str
    is_public: bool
    view_count: int
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    source_text: Optional[str] = None
    result_text: Optional[str] = None
    status: str
    progress: int = 0
    error_message: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


class TranslationListItem(BaseModel):
    """Lightweight record used in list/explore views."""
    id: int
    title: str
    author: str
    original_language: str
    translated_language: str
    is_public: bool
    view_count: int
    status: str
    created_at: datetime.datetime
    # Short snippet of result_text for preview cards
    snippet: Optional[str] = None

    model_config = {"from_attributes": True}


class VisibilityUpdateRequest(BaseModel):
    """Toggle a translation's public/private status."""
    is_public: bool


class TranslationStatusResponse(BaseModel):
    """Lightweight polling response for async jobs."""
    id: int
    status: str
    progress: int = 0
    result_text: Optional[str] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


# ── User Schemas ──────────────────────────────────────────────────────────────

class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: str = Field(..., max_length=256)


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    translation_count: int
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ── Explore / Search ──────────────────────────────────────────────────────────

class ExploreQuery(BaseModel):
    search: Optional[str] = None
    filter_by: Optional[str] = "title"   # "title" | "author" | "language"
    sort_by: Optional[str] = "recent"    # "recent" | "popular"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
