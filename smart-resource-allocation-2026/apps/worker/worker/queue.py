import json
from datetime import datetime, timedelta, timezone

from google.cloud import tasks_v2

from worker.config import settings


class QueueService:
    def __init__(self) -> None:
        self.client = None
        self.parent = ""
        self.enabled = False
        try:
            client = tasks_v2.CloudTasksClient()
            parent = client.queue_path(
                settings.google_cloud_project,
                settings.gcp_region,
                settings.cloud_tasks_queue,
            )
            self.client = client
            self.parent = parent
            self.enabled = True
        except Exception:
            # Local development can run without cloud task credentials.
            self.enabled = False

    def enqueue_next_ripple(self, task_id: str, radius_km: int) -> None:
        if not self.enabled or self.client is None:
            return

        body = json.dumps({"task_id": task_id, "radius_km": radius_km}).encode("utf-8")
        schedule = datetime.now(timezone.utc) + timedelta(seconds=settings.ripple_timeout_seconds)

        self.client.create_task(
            request={
                "parent": self.parent,
                "task": {
                    "http_request": {
                        "http_method": tasks_v2.HttpMethod.POST,
                        "url": settings.cloud_tasks_worker_url,
                        "headers": {"Content-Type": "application/json"},
                        "body": body,
                        "oidc_token": {"service_account_email": settings.cloud_tasks_service_account},
                    },
                    "schedule_time": schedule,
                },
            }
        )
