from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_ENV_FILE = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Smart Resource Allocation API"
    app_env: str = "development"
    api_prefix: str = "/api"

    database_url: str
    redis_url: str

    google_cloud_project: str
    gcp_region: str = "asia-south1"
    cloud_tasks_queue: str
    cloud_tasks_worker_url: str
    cloud_tasks_service_account: str

    gcs_bucket_voice: str
    gcs_bucket_paper: str

    groq_api_key: str
    groq_whisper_model: str = "whisper-large-v3"

    gemini_api_key: str
    gemini_flash_model: str = "gemini-1.5-flash"
    gemini_pro_model: str = "gemini-1.5-pro"

    firebase_project_id: str
    firebase_credentials_path: str
    fcm_topic_volunteers: str = "volunteer-updates"

    matching_embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    max_ripple_radius_km: int = 10
    ripple_timeout_seconds: int = 60
    data_retention_days: int = 30

    @field_validator("firebase_credentials_path", mode="before")
    @classmethod
    def resolve_firebase_credentials_path(cls, value: str) -> str:
        path = Path(value)
        if not path.is_absolute():
            path = (ROOT_ENV_FILE.parent / path).resolve()
        return str(path)


settings = Settings()
