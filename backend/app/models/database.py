"""
backend/app/models/database.py
SQLAlchemy ORM models and database engine/session setup for PostgreSQL.
"""

import datetime
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    LargeBinary,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

from app.core.config import settings

# ── Engine & Session ─────────────────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(256), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False, default="demo_hash")
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    translation_count = Column(Integer, default=0)

    translations = relationship("Translation", back_populates="author_rel", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, default="Untitled")
    author = Column(String(64), nullable=False, default="anonymous")

    # Language codes, e.g. "en", "fr", "es", "zh", "ar"
    original_language = Column(String(32), nullable=False, default="auto")
    translated_language = Column(String(32), nullable=False, default="en")

    # Visibility and popularity
    is_public = Column(Boolean, default=True, nullable=False)
    view_count = Column(Integer, default=0, nullable=False)

    # Storage
    file_data = Column(LargeBinary, nullable=True)   # Raw binary file data
    file_mime_type = Column(String(128), nullable=True) # Exact MIME type
    file_type = Column(String(32), nullable=True)    # "text" | "image" | "pdf"

    # Content
    source_text = Column(Text, nullable=True)        # Original extracted / pasted text
    result_text = Column(Text, nullable=True)        # Translated output

    # Status: "pending" | "processing" | "done" | "error"
    status = Column(String(32), default="pending", nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
    )

    # Optional FK to users (nullable so anonymous submissions work)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_rel = relationship("User", back_populates="translations")

    def __repr__(self) -> str:
        return f"<Translation id={self.id} title={self.title!r} status={self.status!r}>"


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_db_and_tables() -> None:
    """Create all tables.  Called once at application startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency – yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
