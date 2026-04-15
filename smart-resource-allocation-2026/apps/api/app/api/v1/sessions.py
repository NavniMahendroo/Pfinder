from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.services.auth import verify_firebase_user

router = APIRouter()


class SessionStartRequest(BaseModel):
    task_id: str
    consent_granted: bool


class SessionEndRequest(BaseModel):
    session_id: str


@router.post("/start")
def start_session(payload: SessionStartRequest, db: Session = Depends(get_db), user: dict = Depends(verify_firebase_user)):
    if not payload.consent_granted:
        raise HTTPException(status_code=400, detail="Location tracking consent is required")

    session_id = str(uuid4())
    delete_after = datetime.now(timezone.utc) + timedelta(days=settings.data_retention_days)

    db.execute(
        text(
            """
            INSERT INTO sessions (id, task_id, volunteer_id, consent_granted, is_active, delete_after)
            VALUES (:id, :task_id, :volunteer_id, :consent_granted, true, :delete_after)
            """
        ),
        {
            "id": session_id,
            "task_id": payload.task_id,
            "volunteer_id": user["uid"],
            "consent_granted": payload.consent_granted,
            "delete_after": delete_after,
        },
    )
    db.commit()

    return {"session_id": session_id, "delete_after": delete_after.isoformat()}


@router.post("/end")
def end_session(payload: SessionEndRequest, db: Session = Depends(get_db), user: dict = Depends(verify_firebase_user)):
    db.execute(
        text(
            """
            UPDATE sessions
            SET is_active = false, ended_at = now()
            WHERE id = :session_id AND volunteer_id = :volunteer_id
            """
        ),
        {"session_id": payload.session_id, "volunteer_id": user["uid"]},
    )

    db.execute(
        text(
            "DELETE FROM volunteer_locations_live WHERE session_id = :session_id"
        ),
        {"session_id": payload.session_id},
    )

    db.commit()
    return {"ended": True}


@router.post("/privacy/cleanup")
def privacy_cleanup(db: Session = Depends(get_db)):
    db.execute(text("SELECT cleanup_expired_sessions()"))
    db.commit()
    return {"cleanup": "completed"}
