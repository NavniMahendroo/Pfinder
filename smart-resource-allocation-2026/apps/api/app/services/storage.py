from datetime import datetime, timedelta, timezone
from uuid import uuid4

from google.cloud import storage

from app.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.client = storage.Client(project=settings.google_cloud_project)

    def upload_voice(self, data: bytes, filename: str) -> str:
        bucket = self.client.bucket(settings.gcs_bucket_voice)
        object_name = f"raw/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{uuid4()}-{filename}"
        blob = bucket.blob(object_name)
        blob.upload_from_string(data, content_type="audio/webm")
        return f"gs://{settings.gcs_bucket_voice}/{object_name}"

    def upload_paper(self, data: bytes, filename: str, content_type: str) -> str:
        bucket = self.client.bucket(settings.gcs_bucket_paper)
        object_name = f"paper/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{uuid4()}-{filename}"
        blob = bucket.blob(object_name)
        blob.upload_from_string(data, content_type=content_type)
        return f"gs://{settings.gcs_bucket_paper}/{object_name}"

    def lifecycle_policy(self) -> dict:
        return {
            "rule": [
                {
                    "action": {"type": "Delete"},
                    "condition": {"age": settings.data_retention_days},
                }
            ]
        }

    @staticmethod
    def expiry_time() -> datetime:
        return datetime.now(timezone.utc) + timedelta(days=settings.data_retention_days)
