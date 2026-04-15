from pathlib import Path

import firebase_admin
from firebase_admin import credentials, messaging

from worker.config import settings


class FCMService:
    def __init__(self) -> None:
        self.enabled = False
        creds_path = Path(settings.firebase_credentials_path)
        if not creds_path.exists():
            return
        if not firebase_admin._apps:
            cred = credentials.Certificate(str(creds_path))
            firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
        self.enabled = True

    def send_invites(self, task_id: str, volunteer_ids: list[str]) -> None:
        if not self.enabled or not volunteer_ids:
            return
        for volunteer_id in volunteer_ids:
            messaging.send(
                messaging.Message(
                    topic=settings.fcm_topic_volunteers,
                    notification=messaging.Notification(
                        title="Urgent Help Needed",
                        body="A nearby task matches your profile. Swipe to accept.",
                    ),
                    data={"task_id": task_id, "volunteer_id": volunteer_id},
                )
            )
