from fastapi import APIRouter

from app.api.v1.sessions import router as sessions_router
from app.api.v1.tasks import router as tasks_router

api_router = APIRouter()
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
api_router.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
