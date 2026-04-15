import firebase_admin
from firebase_admin import credentials, messaging

from app.core.config import settings


class NotificationService:
    def __init__(self) -> None:
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.firebase_credentials_path)
            firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})

    def notify_volunteers(self, volunteer_ids: list[str], task_id: str, message: str) -> None:
        if not volunteer_ids:
            return
        notification = messaging.Notification(
            title="New Volunteer Task",
            body=message,
        )
        for volunteer_id in volunteer_ids:
            messaging.send(
                messaging.Message(
                    notification=notification,
                    data={"task_id": task_id, "volunteer_id": volunteer_id},
                    topic=settings.fcm_topic_volunteers,
                )
            )
