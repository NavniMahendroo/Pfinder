from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    database_url: str
    firebase_project_id: str
    firebase_credentials_path: str
    fcm_topic_volunteers: str = "volunteer-updates"
    matching_embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    cross_encoder_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    ripple_timeout_seconds: int = 60
    google_cloud_project: str
    gcp_region: str = "asia-south1"
    cloud_tasks_queue: str
    cloud_tasks_worker_url: str
    cloud_tasks_service_account: str

    @field_validator("firebase_credentials_path", mode="before")
    @classmethod
    def resolve_firebase_credentials_path(cls, value: str) -> str:
        path = Path(value)
        if not path.is_absolute():
            path = (ROOT_ENV_FILE.parent / path).resolve()
        return str(path)


settings = Settings()
