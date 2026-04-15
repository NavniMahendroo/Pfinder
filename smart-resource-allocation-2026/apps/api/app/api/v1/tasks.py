from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any
from uuid import uuid4
from uuid import NAMESPACE_DNS, uuid5

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.schemas import (
    CompletionProof,
    IntakeResponse,
    ManualTaskCreateRequest,
    NgoDashboardResponse,
    NgoVolunteerDetails,
    NgoVolunteersResponse,
    TaskListItem,
    VolunteerAcceptRequest,
    VolunteerActiveInfo,
    VolunteerCompleteRequest,
    VolunteerHistoryResponse,
    VolunteerSettingsResponse,
    VolunteerSettingsUpdateRequest,
    VolunteerTaskListResponse,
)
from app.db.session import get_db
from app.models.entities import Task, User
from app.models.enums import TaskStatus, UserRole
from app.services.ai_pipeline import AIPipeline
from app.services.auth import verify_firebase_user
from app.services.dispatch import RippleDispatchService
from app.services.embeddings import EmbeddingService
from app.services.geocoding import geocode_location
from app.services.storage import StorageService

router = APIRouter()


def _stable_uuid(value: str | None) -> str:
    if not value:
        return str(uuid4())
    try:
        from uuid import UUID

        return str(UUID(str(value)))
    except Exception:
        return str(uuid5(NAMESPACE_DNS, str(value)))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return radius * c


def _points_for_completion(urgency: int, hours_done: float, was_on_site: bool) -> int:
    return 20


def _ensure_user(db: Session, user_id: str, role: UserRole, name: str, email: str | None = None) -> User:
    normalized_id = _stable_uuid(user_id)
    user = db.get(User, normalized_id)
    if user is None:
        user = User(
            id=normalized_id,
            role=role,
            name=name,
            email=email,
            skills=[],
            interests=[],
            availability={"is_available": True},
        )
        db.add(user)
        db.flush()
    else:
        user.name = name or user.name
        if email:
            user.email = email
        if user.role != role:
            user.role = role
    return user


def _task_required_hours(task: Task) -> float:
    return float((task.structured_payload or {}).get("required_hours", 2.0))


def _task_required_skills(task: Task) -> list[str]:
    return list((task.structured_payload or {}).get("required_skills", []))


def _task_to_list_item(task: Task, matched_volunteer_name: str | None = None, distance_km: float | None = None) -> TaskListItem:
    payload = task.structured_payload or {}
    return TaskListItem(
        task_id=task.id,
        summary=task.summary,
        category=task.category,
        urgency_score=task.urgency_score,
        location_context=task.location_context,
        task_lat=task.location_lat,
        task_lng=task.location_lng,
        status=task.status.value,
        required_hours=_task_required_hours(task),
        required_skills=_task_required_skills(task),
        volunteer_start_date=payload.get("volunteer_start_date"),
        volunteer_end_date=payload.get("volunteer_end_date"),
        created_at=task.created_at.isoformat() if task.created_at else datetime.now(timezone.utc).isoformat(),
        matched_volunteer_id=task.matched_volunteer_id,
        matched_volunteer_name=matched_volunteer_name,
        distance_km=round(distance_km, 2) if distance_km is not None else None,
    )


def _volunteer_history_internal(db: Session, volunteer_id: str) -> VolunteerHistoryResponse:
    normalized_id = _stable_uuid(volunteer_id)
    # Read completion logs from payloads directly to avoid enum filter mismatches.
    completed_rows = db.scalars(select(Task).order_by(Task.created_at.desc())).all()

    proofs: list[CompletionProof] = []
    total_points = 0
    total_hours = 0.0

    for task in completed_rows:
        payload = task.structured_payload or {}
        completions = payload.get("completions", [])
        for entry in completions:
            if entry.get("volunteer_id") != normalized_id:
                continue

            proof = CompletionProof(
                volunteer_id=entry.get("volunteer_id"),
                volunteer_name=entry.get("volunteer_name", "Volunteer"),
                task_id=task.id,
                task_summary=task.summary,
                hours_done=float(entry.get("hours_done", 0)),
                proof_text=entry.get("proof_text", ""),
                proof_url=entry.get("proof_url"),
                completion_lat=entry.get("completion_lat"),
                completion_lng=entry.get("completion_lng"),
                task_lat=task.location_lat,
                task_lng=task.location_lng,
                distance_km=entry.get("distance_km"),
                was_on_site=bool(entry.get("was_on_site", False)),
                points_awarded=int(entry.get("points_awarded", 0)),
                completed_at=entry.get("completed_at", datetime.now(timezone.utc).isoformat()),
            )
            proofs.append(proof)
            total_points += proof.points_awarded
            total_hours += proof.hours_done

    proofs.sort(key=lambda item: item.completed_at, reverse=True)
    return VolunteerHistoryResponse(completed=proofs, points_total=total_points, total_hours=round(total_hours, 2))


@router.post("/intake", response_model=IntakeResponse)
async def create_task_intake(
    voice_file: UploadFile | None = File(default=None),
    paper_file: UploadFile | None = File(default=None),
    notes_text: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: dict = Depends(verify_firebase_user),
):
    if voice_file is None and paper_file is None and not notes_text:
        raise HTTPException(status_code=400, detail="At least one input is required")

    ai = AIPipeline()
    storage = StorageService()
    embedder = EmbeddingService()

    transcript_chunks: list[str] = []
    voice_path = None
    paper_path = None

    if voice_file is not None:
        voice_bytes = await voice_file.read()
        if not voice_bytes:
            raise HTTPException(status_code=400, detail="Voice file is empty")
        voice_path = storage.upload_voice(voice_bytes, voice_file.filename or "voice.webm")
        transcript = await ai.transcribe_voice(voice_bytes, voice_file.filename or "voice.webm")
        if transcript:
            transcript_chunks.append(transcript)

    if paper_file is not None:
        paper_bytes = await paper_file.read()
        if not paper_bytes:
            raise HTTPException(status_code=400, detail="Paper file is empty")
        paper_path = storage.upload_paper(
            paper_bytes,
            paper_file.filename or "paper.jpg",
            paper_file.content_type or "image/jpeg",
        )
        ocr_text = await ai.ocr_paper(paper_bytes, paper_file.content_type or "image/jpeg")
        if ocr_text:
            transcript_chunks.append(ocr_text)

    if notes_text:
        transcript_chunks.append(notes_text.strip())

    combined_text = "\n\n".join([chunk for chunk in transcript_chunks if chunk])
    if not combined_text:
        raise HTTPException(status_code=400, detail="Could not extract text from provided inputs")

    structured = await ai.extract_structured_need(combined_text)
    lat, lng = await geocode_location(structured["location_context"])

    task = Task(
        id=str(uuid4()),
        created_by=user["uid"],
        summary=structured["summary"],
        category=structured["category"],
        urgency_score=structured["urgency_score"],
        location_context=structured["location_context"],
        location_lat=lat,
        location_lng=lng,
        raw_transcript=combined_text,
        voice_storage_path=voice_path,
        paper_storage_path=paper_path,
        structured_payload=structured,
        status=TaskStatus.MATCHING,
        embedding=embedder.encode(structured["summary"]),
        created_at=datetime.now(timezone.utc),
        expires_at=storage.expiry_time(),
    )

    db.add(task)
    db.commit()

    dispatch = RippleDispatchService()
    dispatch.enqueue(task.id, radius_km=2)

    return IntakeResponse(
        task_id=task.id,
        summary=task.summary,
        category=task.category,
        urgency_score=task.urgency_score,
        location_context=task.location_context,
        status=task.status.value,
    )


@router.post("/create-manual", response_model=TaskListItem)
async def create_manual_task(payload: ManualTaskCreateRequest, db: Session = Depends(get_db)):
    ngo = _ensure_user(db, payload.ngo_id, UserRole.NGO, payload.ngo_name)

    try:
        start_date = datetime.fromisoformat(payload.volunteer_start_date)
        end_date = datetime.fromisoformat(payload.volunteer_end_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Dates must be valid ISO format") from exc

    if end_date < start_date:
        raise HTTPException(status_code=422, detail="Volunteer end date must be on or after start date")

    lat, lng = await geocode_location(payload.location_context)
    task = Task(
        id=str(uuid4()),
        created_by=ngo.id,
        summary=payload.summary,
        category=payload.category,
        urgency_score=payload.urgency_score,
        location_context=payload.location_context,
        location_lat=lat,
        location_lng=lng,
        raw_transcript=payload.notes,
        structured_payload={
            "required_hours": payload.required_hours,
            "required_skills": payload.required_skills,
            "volunteer_start_date": payload.volunteer_start_date,
            "volunteer_end_date": payload.volunteer_end_date,
            "notes": payload.notes,
            "completions": [],
        },
        status=TaskStatus.DISPATCHED,
        created_at=datetime.now(timezone.utc),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_to_list_item(task)


@router.get("/ngo-dashboard", response_model=NgoDashboardResponse)
def ngo_dashboard(ngo_id: str = Query(...), db: Session = Depends(get_db)):
    ngo = db.get(User, _stable_uuid(ngo_id))
    if ngo is None:
        raise HTTPException(status_code=404, detail="NGO user not found")

    ngo_tasks = db.scalars(select(Task).where(Task.created_by == ngo.id).order_by(Task.created_at.desc())).all()

    matched_volunteer_ids = {task.matched_volunteer_id for task in ngo_tasks if task.matched_volunteer_id}
    volunteer_map: dict[str, User] = {}
    if matched_volunteer_ids:
        volunteers = db.scalars(select(User).where(User.id.in_(matched_volunteer_ids))).all()
        volunteer_map = {vol.id: vol for vol in volunteers}

    active_tasks: list[TaskListItem] = []
    completed_tasks: list[TaskListItem] = []
    completion_proofs: list[CompletionProof] = []

    for task in ngo_tasks:
        volunteer_name = volunteer_map.get(task.matched_volunteer_id).name if task.matched_volunteer_id in volunteer_map else None
        item = _task_to_list_item(task, matched_volunteer_name=volunteer_name)
        if task.status in {TaskStatus.COMPLETED, TaskStatus.CANCELLED}:
            completed_tasks.append(item)
        else:
            active_tasks.append(item)

        for entry in (task.structured_payload or {}).get("completions", []):
            completion_proofs.append(
                CompletionProof(
                    volunteer_id=entry.get("volunteer_id"),
                    volunteer_name=entry.get("volunteer_name", "Volunteer"),
                    task_id=task.id,
                    task_summary=task.summary,
                    hours_done=float(entry.get("hours_done", 0)),
                    proof_text=entry.get("proof_text", ""),
                    proof_url=entry.get("proof_url"),
                    completion_lat=entry.get("completion_lat"),
                    completion_lng=entry.get("completion_lng"),
                    task_lat=task.location_lat,
                    task_lng=task.location_lng,
                    distance_km=entry.get("distance_km"),
                    was_on_site=bool(entry.get("was_on_site", False)),
                    points_awarded=int(entry.get("points_awarded", 0)),
                    completed_at=entry.get("completed_at", datetime.now(timezone.utc).isoformat()),
                )
            )

    active_volunteers_db = db.scalars(select(User).where(User.role == UserRole.VOLUNTEER)).all()
    active_volunteers: list[VolunteerActiveInfo] = []
    task_by_volunteer = {
        task.matched_volunteer_id: task
        for task in ngo_tasks
        if task.matched_volunteer_id and task.status in {TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS}
    }

    for volunteer in active_volunteers_db:
        is_available = bool((volunteer.availability or {}).get("is_available", True))
        current_task = task_by_volunteer.get(volunteer.id)
        if is_available or current_task is not None:
            active_volunteers.append(
                VolunteerActiveInfo(
                    volunteer_id=volunteer.id,
                    volunteer_name=volunteer.name,
                    is_available=is_available,
                    current_task_id=current_task.id if current_task else None,
                    current_task_summary=current_task.summary if current_task else None,
                )
            )

    completion_proofs.sort(key=lambda item: item.completed_at, reverse=True)
    return NgoDashboardResponse(
        active_tasks=active_tasks,
        completed_tasks=completed_tasks,
        active_volunteers=active_volunteers,
        completion_proofs=completion_proofs,
    )


@router.get("/ngo-volunteers", response_model=NgoVolunteersResponse)
def ngo_volunteers(ngo_id: str = Query(...), db: Session = Depends(get_db)):
    ngo = db.get(User, _stable_uuid(ngo_id))
    if ngo is None:
        raise HTTPException(status_code=404, detail="NGO user not found")

    ngo_tasks = db.scalars(select(Task).where(Task.created_by == ngo.id)).all()
    volunteers = db.scalars(select(User).where(User.role == UserRole.VOLUNTEER)).all()

    current_task_by_volunteer: dict[str, Task] = {}
    for task in ngo_tasks:
        if task.matched_volunteer_id and task.status in {TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS}:
            current_task_by_volunteer[task.matched_volunteer_id] = task

    stats: dict[str, dict[str, float | int]] = {}
    for task in ngo_tasks:
        for completion in (task.structured_payload or {}).get("completions", []):
            volunteer_id = completion.get("volunteer_id")
            if not volunteer_id:
                continue
            bucket = stats.setdefault(
                volunteer_id,
                {"points": 0, "completed": 0, "hours": 0.0, "on_site": 0},
            )
            bucket["points"] += int(completion.get("points_awarded", 0))
            bucket["completed"] += 1
            bucket["hours"] += float(completion.get("hours_done", 0))
            bucket["on_site"] += 1 if completion.get("was_on_site", False) else 0

    results: list[NgoVolunteerDetails] = []
    for volunteer in volunteers:
        bucket = stats.get(volunteer.id, {"points": 0, "completed": 0, "hours": 0.0, "on_site": 0})
        completed = int(bucket["completed"])
        on_site = int(bucket["on_site"])
        on_site_rate = (on_site / completed) if completed else 0.0
        reliability_score = min(100, int((on_site_rate * 65) + min(35, completed * 5)))
        current_task = current_task_by_volunteer.get(volunteer.id)

        results.append(
            NgoVolunteerDetails(
                volunteer_id=volunteer.id,
                volunteer_name=volunteer.name,
                email=volunteer.email,
                location_text=volunteer.location_text,
                location_lat=volunteer.location_lat,
                location_lng=volunteer.location_lng,
                skills=volunteer.skills or [],
                preferred_categories=volunteer.interests or [],
                is_available=bool((volunteer.availability or {}).get("is_available", True)),
                reliability_score=reliability_score,
                points_total=int(bucket["points"]),
                completed_tasks=completed,
                total_hours=round(float(bucket["hours"]), 2),
                on_site_rate=round(on_site_rate * 100, 1),
                current_task_id=current_task.id if current_task else None,
                current_task_summary=current_task.summary if current_task else None,
            )
        )

    results.sort(key=lambda item: (-item.reliability_score, -item.points_total, item.volunteer_name.lower()))
    return NgoVolunteersResponse(volunteers=results)


@router.get("/volunteer/active", response_model=VolunteerTaskListResponse)
def volunteer_active_tasks(
    volunteer_id: str,
    volunteer_name: str = "Volunteer",
    current_lat: float | None = None,
    current_lng: float | None = None,
    db: Session = Depends(get_db),
):
    volunteer = _ensure_user(db, volunteer_id, UserRole.VOLUNTEER, volunteer_name)
    if current_lat is not None and current_lng is not None:
        volunteer.location_lat = current_lat
        volunteer.location_lng = current_lng
        db.commit()

    rows = db.scalars(
        select(Task)
        .where(Task.status.in_([TaskStatus.MATCHING, TaskStatus.DISPATCHED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS]))
        .order_by(Task.urgency_score.desc(), Task.created_at.desc())
    ).all()

    available_tasks: list[TaskListItem] = []
    ref_lat = current_lat if current_lat is not None else volunteer.location_lat
    ref_lng = current_lng if current_lng is not None else volunteer.location_lng

    for task in rows:
        if task.matched_volunteer_id and task.matched_volunteer_id != volunteer.id:
            continue
        distance = None
        if ref_lat is not None and ref_lng is not None:
            distance = _haversine_km(ref_lat, ref_lng, task.location_lat, task.location_lng)
        available_tasks.append(_task_to_list_item(task, distance_km=distance))

    available_tasks.sort(key=lambda item: (item.distance_km is None, item.distance_km if item.distance_km is not None else 99999))
    history = _volunteer_history_internal(db, volunteer.id)
    return VolunteerTaskListResponse(tasks=available_tasks, points_total=history.points_total)


@router.post("/volunteer/accept")
def volunteer_accept_task(payload: VolunteerAcceptRequest, db: Session = Depends(get_db)):
    volunteer = _ensure_user(db, payload.volunteer_id, UserRole.VOLUNTEER, payload.volunteer_name)
    task = db.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.matched_volunteer_id and task.matched_volunteer_id != volunteer.id:
        raise HTTPException(status_code=409, detail="Task already accepted by another volunteer")

    task.matched_volunteer_id = volunteer.id
    task.status = TaskStatus.IN_PROGRESS
    db.commit()
    return {"ok": True, "task_id": task.id, "status": task.status.value}


@router.post("/volunteer/complete", response_model=CompletionProof)
def volunteer_complete_task(payload: VolunteerCompleteRequest, db: Session = Depends(get_db)):
    volunteer = _ensure_user(db, payload.volunteer_id, UserRole.VOLUNTEER, payload.volunteer_name)
    task = db.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    completion_lat = payload.completion_lat
    completion_lng = payload.completion_lng
    distance_km = None
    if completion_lat is not None and completion_lng is not None:
        distance_km = _haversine_km(completion_lat, completion_lng, task.location_lat, task.location_lng)
    was_on_site = distance_km is not None and distance_km <= 1.0
    points_awarded = _points_for_completion(task.urgency_score, payload.hours_done, was_on_site)

    completion_entry: dict[str, Any] = {
        "volunteer_id": volunteer.id,
        "volunteer_name": volunteer.name,
        "task_id": task.id,
        "task_summary": task.summary,
        "hours_done": payload.hours_done,
        "proof_text": payload.proof_text,
        "proof_url": payload.proof_url,
        "completion_lat": completion_lat,
        "completion_lng": completion_lng,
        "distance_km": round(distance_km, 3) if distance_km is not None else None,
        "was_on_site": was_on_site,
        "points_awarded": points_awarded,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    payload_json = dict(task.structured_payload or {})
    completions = list(payload_json.get("completions", []))
    completions.append(completion_entry)
    payload_json["completions"] = completions
    task.structured_payload = payload_json
    task.status = TaskStatus.COMPLETED
    task.matched_volunteer_id = volunteer.id

    db.commit()

    return CompletionProof(
        volunteer_id=completion_entry["volunteer_id"],
        volunteer_name=completion_entry["volunteer_name"],
        task_id=task.id,
        task_summary=task.summary,
        hours_done=float(completion_entry["hours_done"]),
        proof_text=completion_entry["proof_text"],
        proof_url=completion_entry["proof_url"],
        completion_lat=completion_entry["completion_lat"],
        completion_lng=completion_entry["completion_lng"],
        task_lat=task.location_lat,
        task_lng=task.location_lng,
        distance_km=completion_entry["distance_km"],
        was_on_site=completion_entry["was_on_site"],
        points_awarded=completion_entry["points_awarded"],
        completed_at=completion_entry["completed_at"],
    )


@router.get("/volunteer/history", response_model=VolunteerHistoryResponse)
def volunteer_history(volunteer_id: str, db: Session = Depends(get_db)):
    return _volunteer_history_internal(db, volunteer_id)


@router.get("/volunteer/settings", response_model=VolunteerSettingsResponse)
def volunteer_settings(volunteer_id: str, volunteer_name: str = "Volunteer", db: Session = Depends(get_db)):
    volunteer = _ensure_user(db, volunteer_id, UserRole.VOLUNTEER, volunteer_name)
    return VolunteerSettingsResponse(
        volunteer_id=volunteer.id,
        volunteer_name=volunteer.name,
        email=volunteer.email,
        preferred_categories=volunteer.interests or [],
        skills=volunteer.skills or [],
        is_available=bool((volunteer.availability or {}).get("is_available", True)),
    )


@router.post("/volunteer/settings", response_model=VolunteerSettingsResponse)
def update_volunteer_settings(payload: VolunteerSettingsUpdateRequest, db: Session = Depends(get_db)):
    volunteer = _ensure_user(db, payload.volunteer_id, UserRole.VOLUNTEER, payload.volunteer_name, payload.email)
    volunteer.interests = payload.preferred_categories
    volunteer.skills = payload.skills
    volunteer.availability = {"is_available": payload.is_available}
    volunteer.location_text = payload.location_text
    if payload.location_lat is not None and payload.location_lng is not None:
        volunteer.location_lat = payload.location_lat
        volunteer.location_lng = payload.location_lng
    db.commit()

    return VolunteerSettingsResponse(
        volunteer_id=volunteer.id,
        volunteer_name=volunteer.name,
        email=volunteer.email,
        preferred_categories=volunteer.interests or [],
        skills=volunteer.skills or [],
        is_available=bool((volunteer.availability or {}).get("is_available", True)),
    )
