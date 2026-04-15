from fastapi import Header, HTTPException

from app.core.config import settings


def _init_firebase() -> None:
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return
    cred = credentials.Certificate(settings.firebase_credentials_path)
    firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})


def verify_firebase_user(authorization: str = Header(default="")) -> dict:
    try:
        from firebase_admin import auth
    except ModuleNotFoundError as exc:
        raise HTTPException(status_code=500, detail="firebase-admin is not installed") from exc

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.replace("Bearer ", "", 1).strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid token")

    _init_firebase()
    try:
        return auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {exc}") from exc
