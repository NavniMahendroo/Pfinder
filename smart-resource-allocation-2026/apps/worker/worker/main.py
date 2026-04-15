from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session

from worker.db import get_db
from worker.dispatch_service import dispatch_with_conflict_management
from worker.notifications import FCMService
from worker.queue import QueueService
from worker.schemas import DispatchRequest, DispatchResult

app = FastAPI(title="Smart Resource Allocation Worker")
fcm = FCMService()
queue = QueueService()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/internal/dispatch/execute", response_model=DispatchResult)
def execute_dispatch(payload: DispatchRequest, db: Session = Depends(get_db)):
    invited, next_radius = dispatch_with_conflict_management(db, payload.task_id, payload.radius_km)
    fcm.send_invites(payload.task_id, invited)
    if not invited and next_radius is not None:
        queue.enqueue_next_ripple(payload.task_id, next_radius)
    return DispatchResult(
        dispatched=len(invited) > 0,
        invited_volunteer_ids=invited,
        next_radius_km=next_radius,
    )
