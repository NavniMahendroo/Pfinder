import json
from datetime import datetime, timedelta, timezone

from google.cloud import tasks_v2

from app.core.config import settings


class RippleDispatchService:
    RADII = [2, 5, 10]

    def __init__(self) -> None:
        self.client = tasks_v2.CloudTasksClient()
        self.parent = self.client.queue_path(
            settings.google_cloud_project,
            settings.gcp_region,
            settings.cloud_tasks_queue,
        )

    def next_radius(self, current_radius: int) -> int | None:
        try:
            idx = self.RADII.index(current_radius)
        except ValueError:
            return self.RADII[0]
        if idx + 1 >= len(self.RADII):
            return None
        return self.RADII[idx + 1]

    def enqueue(self, task_id: str, radius_km: int, delay_seconds: int = 0) -> str:
        payload = json.dumps({"task_id": task_id, "radius_km": radius_km}).encode("utf-8")
        schedule = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        request = {
            "parent": self.parent,
            "task": {
                "http_request": {
                    "http_method": tasks_v2.HttpMethod.POST,
                    "url": settings.cloud_tasks_worker_url,
                    "headers": {"Content-Type": "application/json"},
                    "body": payload,
                    "oidc_token": {"service_account_email": settings.cloud_tasks_service_account},
                },
                "schedule_time": schedule,
            },
        }
        created = self.client.create_task(request=request)
        return created.name
