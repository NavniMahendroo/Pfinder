from datetime import datetime

from app.api.v1.schemas import MatchResult
from app.models.entities import Task, User
from app.services.embeddings import EmbeddingService


def compute_skill_match(task: Task, volunteer: User) -> float:
    category_keywords = set(task.category.lower().split())
    volunteer_skills = {s.lower() for s in volunteer.skills}
    if not category_keywords:
        return 0.0
    overlap = len(category_keywords.intersection(volunteer_skills))
    return min(1.0, overlap / max(1, len(category_keywords)))


def compute_availability_score(volunteer: User) -> float:
    availability = volunteer.availability or {}
    if not availability.get("is_available", False):
        return 0.0
    now_hour = datetime.utcnow().hour
    windows = availability.get("time_slots", [])
    if not windows:
        return 0.6
    for window in windows:
        start = int(window.get("start", 0))
        end = int(window.get("end", 24))
        if start <= now_hour <= end:
            return 1.0
    return 0.3


def urgency_multiplier(urgency_score: int) -> float:
    return 1.0 + (urgency_score / 10.0)


def score_volunteer(task: Task, volunteer: User, embedder: EmbeddingService) -> MatchResult:
    semantic = 0.0
    if task.embedding and volunteer.profile_embedding:
        semantic = embedder.cosine_similarity(task.embedding, volunteer.profile_embedding)

    skill = compute_skill_match(task, volunteer)
    availability = compute_availability_score(volunteer)
    urgency = urgency_multiplier(task.urgency_score)

    base_score = (semantic * 0.4) + (skill * 0.3) + (availability * 0.3)
    final = base_score * urgency

    return MatchResult(
        volunteer_id=str(volunteer.id),
        semantic_similarity=semantic,
        skill_match=skill,
        availability_score=availability,
        urgency_multiplier=urgency,
        score=round(final, 4),
        details={"base_score": round(base_score, 4)},
    )
