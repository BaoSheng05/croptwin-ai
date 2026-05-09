"""SQLAlchemy database setup — SQLite for persistent storage.

Provides the engine, session factory, declarative base, and FastAPI
dependency for per-request database sessions.

All ORM models inherit from ``Base`` (defined here) and are declared
in ``app.models``.
"""

import logging
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# SQLite requires check_same_thread=False for FastAPI's threaded workers
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base class for all ORM models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a DB session per request.

    The session is automatically closed when the request completes,
    regardless of whether an exception occurred.

    Yields:
        A SQLAlchemy Session bound to the application engine.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables if they don't already exist.

    Called once at application startup. Swallows errors gracefully
    so the app can still serve in-memory data even if the database
    file is locked or corrupted.
    """
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialised successfully.")
    except SQLAlchemyError as exc:
        logger.warning("Database initialisation skipped: %s", str(exc)[:200])
