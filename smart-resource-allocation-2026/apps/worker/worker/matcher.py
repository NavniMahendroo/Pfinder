from __future__ import annotations

import os

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from worker.config import settings

embedder = None
reranker = None


def _get_models():
    global embedder, reranker
    if embedder is None or reranker is None:
        # Prevent transformers from importing TensorFlow on startup.
        os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
        from sentence_transformers import CrossEncoder, SentenceTransformer

        embedder = SentenceTransformer(settings.matching_embedding_model)
        reranker = CrossEncoder(settings.cross_encoder_model)
    return embedder, reranker


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    a = np.array(v1)
    b = np.array(v2)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def skill_match(task_category: str, volunteer_skills: list[str]) -> float:
    words = set(task_category.lower().split())
    normalized = {s.lower() for s in volunteer_skills}
    if not words:
        return 0.0
    return len(words.intersection(normalized)) / len(words)


def availability_score(payload: dict) -> float:
    if not payload:
        return 0.0
    return 1.0 if payload.get("is_available", False) else 0.0


def _to_float_list(value: object) -> list[float]:
    if isinstance(value, str):
        stripped = value.strip("[]")
        if not stripped:
            return []
        return [float(item) for item in stripped.split(",")]
    if isinstance(value, list):
        return [float(item) for item in value]
    return []


def rank_candidates(db: Session, task_id: str, radius_km: int) -> list[dict]:
    current_embedder, current_reranker = _get_models()

    task = db.execute(
        text(
            """
            SELECT id, summary, category, urgency_score, location_lat, location_lng, embedding
            FROM tasks WHERE id = :task_id
            """
        ),
        {"task_id": task_id},
    ).mappings().first()
    if not task:
        return []

    rows = db.execute(
        text(
            """
            SELECT id, skills, availability, profile_embedding,
            (
              6371 * acos(
                cos(radians(:lat)) * cos(radians(location_lat)) *
                cos(radians(location_lng) - radians(:lng)) +
                sin(radians(:lat)) * sin(radians(location_lat))
              )
            ) as distance_km
            FROM users
            WHERE role = 'volunteer' AND location_lat IS NOT NULL AND location_lng IS NOT NULL
            HAVING (
              6371 * acos(
                cos(radians(:lat)) * cos(radians(location_lat)) *
                cos(radians(location_lng) - radians(:lng)) +
                sin(radians(:lat)) * sin(radians(location_lat))
              )
            ) <= :radius
            """
        ),
        {"lat": task["location_lat"], "lng": task["location_lng"], "radius": radius_km},
    ).mappings().all()

    task_vec = _to_float_list(task["embedding"]) or current_embedder.encode(task["summary"], normalize_embeddings=True).tolist()
    ranked: list[dict] = []

    for row in rows:
        volunteer_vec = _to_float_list(row["profile_embedding"]) if row["profile_embedding"] else []
        semantic = cosine_similarity(task_vec, volunteer_vec) if volunteer_vec else 0.0
        skill = skill_match(task["category"], row["skills"] or [])
        availability = availability_score(row["availability"] or {})
        urgency_multiplier = 1.0 + (float(task["urgency_score"]) / 10.0)

        base_score = (semantic * 0.4) + (skill * 0.3) + (availability * 0.3)
        weighted_score = base_score * urgency_multiplier
        rerank_score = float(current_reranker.predict([(task["summary"], " ".join(row["skills"] or []))])[0])
        final_score = (weighted_score * 0.8) + (rerank_score * 0.2)

        ranked.append(
            {
                "volunteer_id": str(row["id"]),
                "semantic_similarity": semantic,
                "skill_match": skill,
                "availability_score": availability,
                "urgency_multiplier": urgency_multiplier,
                "match_score": round(final_score, 4),
                "ripple_radius_km": radius_km,
            }
        )

    ranked.sort(key=lambda item: item["match_score"], reverse=True)
    return ranked
