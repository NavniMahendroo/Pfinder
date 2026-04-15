from sqlalchemy import text
from sqlalchemy.orm import Session

from worker.matcher import rank_candidates

RADII = [2, 5, 10]


def next_radius(current: int) -> int | None:
    try:
        idx = RADII.index(current)
    except ValueError:
        return RADII[0]
    if idx + 1 >= len(RADII):
        return None
    return RADII[idx + 1]


def lock_task_for_dispatch(db: Session, task_id: str):
    return db.execute(
        text(
            """
            SELECT id, status, matched_volunteer_id
            FROM tasks
            WHERE id = :task_id
            FOR UPDATE SKIP LOCKED
            """
        ),
        {"task_id": task_id},
    ).mappings().first()


def dispatch_with_conflict_management(db: Session, task_id: str, radius_km: int) -> tuple[list[str], int | None]:
    invited: list[str] = []
    with db.begin():
        task = lock_task_for_dispatch(db, task_id)
        if not task or task["matched_volunteer_id"]:
            return invited, None

        candidates = rank_candidates(db, task_id, radius_km)
        top_candidates = candidates[:10]

        for candidate in top_candidates:
            db.execute(
                text(
                    """
                    INSERT INTO matches (
                        id, task_id, volunteer_id, semantic_similarity, skill_match,
                        availability_score, urgency_multiplier, match_score,
                        status, ripple_radius_km
                    ) VALUES (
                        gen_random_uuid(), :task_id, :volunteer_id, :semantic_similarity,
                        :skill_match, :availability_score, :urgency_multiplier,
                        :match_score, 'invited', :ripple_radius_km
                    )
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"task_id": task_id, **candidate},
            )
            invited.append(candidate["volunteer_id"])

        if invited:
            db.execute(
                text("UPDATE tasks SET status = 'dispatched' WHERE id = :task_id"),
                {"task_id": task_id},
            )

    return invited, next_radius(radius_km)
