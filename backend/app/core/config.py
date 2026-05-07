from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CropTwin AI API"
    environment: str = "development"
    frontend_origin: str = "http://localhost:5173"
    database_url: str = "sqlite:///./croptwin.db"
    gemini_api_key: str | None = None
    deepseek_api_key: str | None = None
    farm_latitude: float = 1.5598
    farm_longitude: float = 103.6370
    tariff_peak_rate_rm: float = 0.68
    tariff_shoulder_rate_rm: float = 0.48
    tariff_offpeak_rate_rm: float = 0.28

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
