"""
backend/app/api/routes.py

Complete FastAPI router.

Endpoints
─────────
POST   /api/translate/text          — Translate raw pasted text (sync)
POST   /api/translate/file          — Upload image/PDF, trigger async processing
GET    /api/translate/{id}/status   — Poll async job status
GET    /api/translate/{id}          — Fetch full translation record + inc view_count
GET    /api/explore                 — Public feed with search/filter/sort/pagination
PATCH  /api/translate/{id}/visibility — Toggle public/private flag
DELETE /api/translate/{id}          — Delete translation + uploaded file
GET    /api/profile/{username}      — User profile + their translations
POST   /api/users                   — Create / upsert a user (demo auth)
GET    /api/users/{username}        — Fetch user record
GET    /uploads/{filename}          — Serve uploaded files statically
"""

import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import Translation, User, get_db
from app.schemas.schemas import (
    ExploreQuery,
    TextTranslationRequest,
    TranslationListItem,
    TranslationResponse,
    TranslationStatusResponse,
    UserCreateRequest,
    UserResponse,
    VisibilityUpdateRequest,
)
from app.services import llm_engine, pdf_engine, vision_engine
from app.core.auth import get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Allowed file extensions ────────────────────────────────────────────────────
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}
ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_PDF_EXTENSIONS

MAX_FILE_SIZE_MB = 20  # Reject files larger than this


# ── Internal helpers ──────────────────────────────────────────────────────────

def _save_upload(upload: UploadFile) -> tuple[Path, str]:
    """
    Save an UploadFile to the uploads directory with a UUID prefix.
    Returns (absolute_path, file_type) where file_type is 'image' or 'pdf'.
    """
    suffix = Path(upload.filename or "file").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{suffix}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    unique_name = f"{uuid.uuid4().hex}{suffix}"
    dest: Path = settings.upload_path / unique_name

    try:
        with dest.open("wb") as out_file:
            shutil.copyfileobj(upload.file, out_file)
    except Exception as exc:
        logger.error("Failed to save upload: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File storage error. Please try again.",
        ) from exc

    file_type = "pdf" if suffix in ALLOWED_PDF_EXTENSIONS else "image"
    logger.info("Saved upload %s as %s (%s)", upload.filename, dest.name, file_type)
    return dest, file_type


def _build_snippet(text: Optional[str], length: int = 200) -> Optional[str]:
    if not text:
        return None
    return text[:length].rstrip() + ("…" if len(text) > length else "")


def _process_file_translation(translation_id: int, file_path: str, file_type: str,
                               target_language: str, source_language: str) -> None:
    """
    Background task: extract text from file, translate it, update DB record.
    This runs in a thread pool so it does NOT block the HTTP event loop.
    """
    from app.models.database import SessionLocal

    db: Session = SessionLocal()
    try:
        record = db.query(Translation).filter(Translation.id == translation_id).first()
        if not record:
            logger.error("Background task: translation %d not found.", translation_id)
            return

        record.status = "processing"
        db.commit()

        # ── Step 1: Extract text ──────────────────────────────────────────────
        logger.info("Extracting text from %s (%s)…", file_path, file_type)
        if file_type == "pdf":
            source_text = pdf_engine.extract_text_from_pdf(file_path)
        else:
            source_text = vision_engine.extract_text_from_image(file_path, source_language=source_language)

        record.source_text = source_text

        if not source_text.strip() or source_text.startswith("[ERROR]"):
            record.status = "error"
            record.error_message = source_text or "Text extraction produced no output."
            db.commit()
            return

        # ── Step 2: Translate ─────────────────────────────────────────────────
        logger.info("Translating %d chars to '%s'…", len(source_text), target_language)
        translated = llm_engine.translate_text(
            text=source_text,
            target_language=target_language,
            source_language=source_language,
        )

        record.result_text = translated
        record.status = "done"
        logger.info("Translation %d complete.", translation_id)

    except RuntimeError as exc:
        logger.error("Translation %d failed (RuntimeError): %s", translation_id, exc)
        db.query(Translation).filter(Translation.id == translation_id).update(
            {"status": "error", "error_message": str(exc)}
        )
    except Exception as exc:
        logger.exception("Translation %d failed (unexpected): %s", translation_id, exc)
        db.query(Translation).filter(Translation.id == translation_id).update(
            {"status": "error", "error_message": f"Unexpected error: {exc}"}
        )
    finally:
        db.commit()
        db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

# ── 1. Translate pasted text (synchronous) ────────────────────────────────────

@router.post(
    "/translate/text",
    response_model=TranslationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Translate raw text",
    tags=["translation"],
)
def translate_text_endpoint(
    payload: TextTranslationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> TranslationResponse:
    """Translate a block of user-supplied text and persist the result."""
    try:
        result_text = llm_engine.translate_text(
            text=payload.text,
            target_language=payload.target_language,
            source_language=payload.source_language,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    record = Translation(
        title=payload.title,
        author=payload.author if not current_user else current_user.username,
        original_language=payload.source_language,
        translated_language=payload.target_language,
        is_public=payload.is_public,
        file_type="text",
        source_text=payload.text,
        result_text=result_text,
        status="done",
        user_id=current_user.id if current_user else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return TranslationResponse.model_validate(record)


# ── 2. Upload file for async translation ──────────────────────────────────────

@router.post(
    "/translate/file",
    response_model=TranslationResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload image or PDF for translation",
    tags=["translation"],
)
def translate_file_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_language: str = Form(default="auto"),
    target_language: str = Form(...),
    title: str = Form(default="Untitled"),
    author: str = Form(default="anonymous"),
    is_public: bool = Form(default=True),
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_user),
) -> TranslationResponse:
    """
    Accept an image or PDF upload.  Returns 202 immediately with a 'pending'
    record.  The actual OCR + translation runs in a BackgroundTask.
    Poll GET /api/translate/{id}/status to check completion.
    """
    # Save the file to disk
    dest_path, file_type = _save_upload(file)

    # Create a DB record in 'pending' state
    record = Translation(
        title=title,
        author=author if not current_user else current_user.username,
        original_language=source_language,
        translated_language=target_language,
        is_public=is_public,
        file_path=str(dest_path),
        file_type=file_type,
        status="pending",
        user_id=current_user.id if current_user else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Kick off background processing
    background_tasks.add_task(
        _process_file_translation,
        translation_id=record.id,
        file_path=str(dest_path),
        file_type=file_type,
        target_language=target_language,
        source_language=source_language,
    )

    logger.info("Accepted file translation job %d (%s)", record.id, file_type)
    return TranslationResponse.model_validate(record)


# ── 3. Poll async job status ──────────────────────────────────────────────────

@router.get(
    "/translate/{translation_id}/status",
    response_model=TranslationStatusResponse,
    summary="Poll translation job status",
    tags=["translation"],
)
def get_translation_status(
    translation_id: int,
    db: Session = Depends(get_db),
) -> TranslationStatusResponse:
    record = db.query(Translation).filter(Translation.id == translation_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Translation not found.")
    return TranslationStatusResponse.model_validate(record)


# ── 4. Fetch full translation record (increments view_count) ──────────────────

@router.get(
    "/translate/{translation_id}",
    response_model=TranslationResponse,
    summary="Get a translation by ID",
    tags=["translation"],
)
def get_translation(
    translation_id: int,
    db: Session = Depends(get_db),
) -> TranslationResponse:
    record = (
        db.query(Translation)
        .filter(Translation.id == translation_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Translation not found.")
    if not record.is_public:
        # In a real app you'd check auth; here we just return 403 for private items
        pass  # allow for demo – no auth system yet

    record.view_count = (record.view_count or 0) + 1
    db.commit()
    db.refresh(record)
    return TranslationResponse.model_validate(record)


# ── 5. Public explore feed ────────────────────────────────────────────────────

@router.get(
    "/explore",
    response_model=List[TranslationListItem],
    summary="Explore public translations",
    tags=["explore"],
)
def explore_translations(
    search: Optional[str] = Query(default=None),
    filter_by: str = Query(default="title"),   # title | author | language
    sort_by: str = Query(default="recent"),    # recent | popular
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[TranslationListItem]:
    """Return paginated list of public translations with optional search/filter."""
    query = db.query(Translation).filter(
        Translation.is_public == True,
        Translation.status == "done",
    )

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        if filter_by == "author":
            query = query.filter(Translation.author.ilike(search_pattern))
        elif filter_by == "language":
            query = query.filter(
                (Translation.original_language.ilike(search_pattern))
                | (Translation.translated_language.ilike(search_pattern))
            )
        else:  # default: title
            query = query.filter(Translation.title.ilike(search_pattern))

    # Apply sort
    if sort_by == "popular":
        query = query.order_by(Translation.view_count.desc())
    else:
        query = query.order_by(Translation.created_at.desc())

    # Pagination
    offset = (page - 1) * page_size
    records = query.offset(offset).limit(page_size).all()

    result = []
    for r in records:
        item = TranslationListItem(
            id=r.id,
            title=r.title,
            author=r.author,
            original_language=r.original_language,
            translated_language=r.translated_language,
            is_public=r.is_public,
            view_count=r.view_count,
            status=r.status,
            created_at=r.created_at,
            snippet=_build_snippet(r.result_text),
        )
        result.append(item)
    return result


# ── 6. Toggle visibility (public / private) ───────────────────────────────────

@router.patch(
    "/translate/{translation_id}/visibility",
    response_model=TranslationResponse,
    summary="Toggle public/private visibility",
    tags=["translation"],
)
def update_visibility(
    translation_id: int,
    payload: VisibilityUpdateRequest,
    db: Session = Depends(get_db),
) -> TranslationResponse:
    record = db.query(Translation).filter(Translation.id == translation_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Translation not found.")
    record.is_public = payload.is_public
    db.commit()
    db.refresh(record)
    return TranslationResponse.model_validate(record)


# ── 7. Delete translation ─────────────────────────────────────────────────────

@router.delete(
    "/translate/{translation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a translation",
    tags=["translation"],
)
def delete_translation(
    translation_id: int,
    db: Session = Depends(get_db),
) -> None:
    record = db.query(Translation).filter(Translation.id == translation_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Translation not found.")

    # Delete the associated file if it exists
    if record.file_path:
        fp = Path(record.file_path)
        if fp.exists():
            try:
                fp.unlink()
                logger.info("Deleted file %s", fp)
            except Exception as exc:
                logger.warning("Could not delete file %s: %s", fp, exc)

    db.delete(record)
    db.commit()


# ── 8. User profile + translations ───────────────────────────────────────────

@router.get(
    "/profile/{username}",
    summary="Get user profile with their translations",
    tags=["users"],
)
def get_profile(
    username: str,
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.username == username).first()

    translations = (
        db.query(Translation)
        .filter(Translation.author == username)
        .order_by(Translation.created_at.desc())
        .all()
    )

    translation_list = [
        {
            "id": t.id,
            "title": t.title,
            "original_language": t.original_language,
            "translated_language": t.translated_language,
            "is_public": t.is_public,
            "view_count": t.view_count,
            "status": t.status,
            "file_type": t.file_type,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "snippet": _build_snippet(t.result_text, 120),
        }
        for t in translations
    ]

    if user:
        profile_data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "translation_count": len(translations),
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    else:
        # Return a "guest" profile for demo users
        profile_data = {
            "id": None,
            "username": username,
            "email": f"{username}@translator.demo",
            "avatar_url": None,
            "translation_count": len(translations),
            "created_at": None,
        }

    return {"user": profile_data, "translations": translation_list}


# ── 9. Create / upsert user ───────────────────────────────────────────────────

@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or update a user",
    tags=["users"],
)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        return UserResponse.model_validate(existing)

    user = User(username=payload.username, email=payload.email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.get(
    "/users/{username}",
    response_model=UserResponse,
    summary="Fetch a user by username",
    tags=["users"],
)
def get_user(username: str, db: Session = Depends(get_db)) -> UserResponse:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserResponse.model_validate(user)


# ── 10. Serve uploaded files ──────────────────────────────────────────────────

@router.get(
    "/uploads/{filename}",
    summary="Serve a previously uploaded file",
    tags=["files"],
)
def serve_upload(filename: str) -> FileResponse:
    file_path = settings.upload_path / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(str(file_path))
