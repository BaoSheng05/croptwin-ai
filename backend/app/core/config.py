"""Application configuration loaded from environment variables.

Uses pydantic-settings to load values from a ``.env`` file at the
backend root. Each field has a sensible default for local development.

Usage::

    from app.core.config import get_settings
    settings = get_settings()  # cached singleton
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Global application settings.

    Values are loaded from environment variables (case-insensitive)
    or from a ``.env`` file. The ``lru_cache`` on ``get_settings()``
    ensures this is only parsed once per process.
    """

    # ── Application ──────────────────────────────────────────────
    app_name: str = "CropTwin AI API"
    """Display name shown in API docs and health endpoint."""

    environment: str = "development"
    """Runtime environment: 'development', 'staging', or 'production'."""

    frontend_origin: str = "http://localhost:5173"
    """Allowed CORS origin for the frontend dev server."""

    # ── Database ─────────────────────────────────────────────────
    database_url: str = "sqlite:///./croptwin.db"
    """SQLAlchemy connection string. Defaults to a local SQLite file."""

    # ── AI API keys ──────────────────────────────────────────────
    gemini_api_key: str | None = None
    """Google Gemini API key (optional — used for AI diagnosis)."""

    deepseek_api_key: str | None = None
    """DeepSeek API key (optional — used for AI control decisions)."""

    # ── Farm location (for weather / solar calculations) ─────────
    farm_latitude: float = 1.5598
    """Farm GPS latitude (default: Johor, Malaysia)."""

    farm_longitude: float = 103.6370
    """Farm GPS longitude (default: Johor, Malaysia)."""

    # ── Energy tariff rates (RM per kWh) ─────────────────────────
    tariff_peak_rate_rm: float = 0.68
    """Peak-hour electricity rate in Malaysian Ringgit per kWh."""

    tariff_shoulder_rate_rm: float = 0.48
    """Shoulder-hour electricity rate in RM per kWh."""

    tariff_offpeak_rate_rm: float = 0.28
    """Off-peak electricity rate in RM per kWh."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings singleton.

    The first call parses environment variables and the ``.env`` file;
    subsequent calls return the same instance.
    """
    return Settings()
