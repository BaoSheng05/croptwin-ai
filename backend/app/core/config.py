from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CropTwin AI API"
    environment: str = "development"
    frontend_origin: str = "http://localhost:5173"
    database_url: str = "sqlite:///./croptwin.db"
    gemini_api_key: str | None = None
    deepseek_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
