from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, JSON, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import MatchStatus, TaskStatus, UserRole


def _enum_value_type(enum_cls: type, name: str) -> Enum:
    return Enum(enum_cls, name=name, values_callable=lambda enum_items: [item.value for item in enum_items])


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    role: Mapped[UserRole] = mapped_column(_enum_value_type(UserRole, "user_role"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    phone: Mapped[str | None] = mapped_column(String(30), unique=True)
    interests: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    availability: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    location_text: Mapped[str | None] = mapped_column(String(255))
    location_lat: Mapped[float | None] = mapped_column(Float)
    location_lng: Mapped[float | None] = mapped_column(Float)
    profile_embedding: Mapped[list[float] | None] = mapped_column(Vector(384))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    urgency_score: Mapped[int] = mapped_column(Integer, nullable=False)
    location_context: Mapped[str] = mapped_column(String(255), nullable=False)
    location_lat: Mapped[float] = mapped_column(Float, nullable=False)
    location_lng: Mapped[float] = mapped_column(Float, nullable=False)
    raw_transcript: Mapped[str | None] = mapped_column(Text)
    voice_storage_path: Mapped[str | None] = mapped_column(String(512))
    paper_storage_path: Mapped[str | None] = mapped_column(String(512))
    structured_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[TaskStatus] = mapped_column(_enum_value_type(TaskStatus, "task_status"), default=TaskStatus.NEW)
    matched_volunteer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    matches: Mapped[list["Match"]] = relationship(back_populates="task", cascade="all,delete-orphan")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    volunteer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    semantic_similarity: Mapped[float] = mapped_column(Float, default=0)
    skill_match: Mapped[float] = mapped_column(Float, default=0)
    availability_score: Mapped[float] = mapped_column(Float, default=0)
    urgency_multiplier: Mapped[float] = mapped_column(Float, default=1)
    match_score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[MatchStatus] = mapped_column(_enum_value_type(MatchStatus, "match_status"), default=MatchStatus.PENDING)
    ripple_radius_km: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped[Task] = relationship(back_populates="matches")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    volunteer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    consent_granted: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delete_after: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
