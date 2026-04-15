from pydantic import BaseModel


class DispatchRequest(BaseModel):
    task_id: str
    radius_km: int


class DispatchResult(BaseModel):
    dispatched: bool
    invited_volunteer_ids: list[str]
    next_radius_km: int | None
