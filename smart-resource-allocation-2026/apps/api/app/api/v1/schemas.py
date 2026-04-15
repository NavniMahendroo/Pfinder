from typing import Any

from pydantic import BaseModel, Field


class IntakeResponse(BaseModel):
    task_id: str
    summary: str
    category: str
    urgency_score: int = Field(ge=1, le=10)
    location_context: str
    status: str


class RippleDispatchRequest(BaseModel):
    task_id: str
    radius_km: int


class RippleDispatchResponse(BaseModel):
    dispatched: bool
    invited_volunteer_ids: list[str]
    next_radius_km: int | None


class MatchResult(BaseModel):
    volunteer_id: str
    semantic_similarity: float
    skill_match: float
    availability_score: float
    urgency_multiplier: float
    score: float
    details: dict[str, Any] = Field(default_factory=dict)


class ManualTaskCreateRequest(BaseModel):
    ngo_id: str
    ngo_name: str
    summary: str
    category: str
    urgency_score: int = Field(ge=1, le=10)
    location_context: str
    required_hours: float = Field(default=2.0, ge=0.5, le=24)
    required_skills: list[str] = Field(default_factory=list)
    notes: str | None = None


class TaskListItem(BaseModel):
    task_id: str
    summary: str
    category: str
    urgency_score: int
    location_context: str
    task_lat: float | None = None
    task_lng: float | None = None
    status: str
    required_hours: float
    required_skills: list[str]
    created_at: str
    matched_volunteer_id: str | None = None
    matched_volunteer_name: str | None = None
    distance_km: float | None = None


class CompletionProof(BaseModel):
    volunteer_id: str
    volunteer_name: str
    hours_done: float
    proof_text: str
    proof_url: str | None = None
    completion_lat: float | None = None
    completion_lng: float | None = None
    task_lat: float
    task_lng: float
    distance_km: float | None = None
    was_on_site: bool
    points_awarded: int
    completed_at: str


class VolunteerActiveInfo(BaseModel):
    volunteer_id: str
    volunteer_name: str
    is_available: bool
    current_task_id: str | None = None
    current_task_summary: str | None = None


class NgoDashboardResponse(BaseModel):
    active_tasks: list[TaskListItem]
    completed_tasks: list[TaskListItem]
    active_volunteers: list[VolunteerActiveInfo]
    completion_proofs: list[CompletionProof]


class VolunteerAcceptRequest(BaseModel):
    volunteer_id: str
    volunteer_name: str
    task_id: str


class VolunteerCompleteRequest(BaseModel):
    volunteer_id: str
    volunteer_name: str
    task_id: str
    hours_done: float = Field(ge=0.25, le=48)
    proof_text: str
    proof_url: str | None = None
    completion_lat: float | None = None
    completion_lng: float | None = None


class VolunteerTaskListResponse(BaseModel):
    tasks: list[TaskListItem]
    points_total: int


class VolunteerHistoryResponse(BaseModel):
    completed: list[CompletionProof]
    points_total: int
    total_hours: float


class VolunteerSettingsResponse(BaseModel):
    volunteer_id: str
    volunteer_name: str
    email: str | None = None
    preferred_categories: list[str]
    skills: list[str]
    is_available: bool


class VolunteerSettingsUpdateRequest(BaseModel):
    volunteer_id: str
    volunteer_name: str
    email: str | None = None
    preferred_categories: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    is_available: bool = True
    location_text: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
