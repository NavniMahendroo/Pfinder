# Smart Resource Allocation - Google Solution Challenge 2026

Data-driven volunteer coordination platform for emergency social impact.

## 1) Directory Structure (Feature-First)

```
smart-resource-allocation-2026/
  apps/
    api/                      # FastAPI intake + orchestration
      app/
        api/v1/               # feature APIs: tasks, sessions
        services/             # ai, dispatch, scoring, auth, storage
        models/               # SQLAlchemy entities and enums
        db/                   # db session
    worker/                   # Async matching + ripple execution worker
      worker/
        matcher.py
        dispatch_service.py
        notifications.py
        queue.py
    web/                      # Next.js 14 NGO dashboard
      app/
      components/dashboard/
      components/ui/
      lib/
    mobile_flutter/           # Flutter volunteer app
      lib/features/tasks/
      lib/core/router/
  infra/
    db/migrations/            # PostgreSQL + PostGIS + pgvector schema
    gcp/cloudbuild.yaml       # Cloud Run pipeline
    local/docker-compose.yml  # local stack
```

## 2) Tech Stack Mapping

- Mobile: Flutter 3.x, Riverpod, GoRouter, MapLibre + MapTiler tiles
- Web: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives, MapLibre GL heatmap
- Backend API: FastAPI (Python 3.12)
- Async Worker: FastAPI worker + Google Cloud Tasks
- Auth: Firebase Auth token verification
- Realtime Tracking: Firebase Realtime DB ready (mobile dependencies included)
- Storage: Google Cloud Storage for voice and paper uploads
- DB: PostgreSQL 16 + PostGIS + pgvector
- Cache: Redis 7 (config wired)
- AI: Groq Whisper, Gemini 1.5 Pro/Flash, sentence-transformers embeddings

## 3) Core Features Implemented

### Feature 1: NGO Intake (Gatherer)
- Endpoint: `POST /api/tasks/intake`
- Accepts `voice_file`, `paper_file`, `notes_text`
- Groq Whisper transcription (Hindi/Hinglish/English)
- Gemini Pro OCR for handwritten/printed image extraction
- Gemini Flash structured extraction:
  - `urgency_score`
  - `category`
  - `location_context`
  - `summary`
- Geocoding via OpenStreetMap Nominatim
- Stores into `tasks` with embeddings and retention expiry

### Feature 2: Ripple Dispatch + Matching
- Initial Cloud Task dispatch at 2km
- Worker executes matching with conflict-safe transaction:
  - `SELECT ... FOR UPDATE SKIP LOCKED`
- Recursive ripple progression: 2km -> 5km -> 10km with 60s delay
- Weighted score formula:

$$
\text{final} = ((0.4\cdot semantic) + (0.3\cdot skill) + (0.3\cdot availability))\cdot urgency\_multiplier
$$

- Cross-encoder reranking blended in worker ranking
- FCM push invite hooks to volunteers

### Feature 3: Dual Portal UI
- Volunteer mobile:
  - Glassmorphic swipe card
  - Urgency badge color: red/orange/green
  - Offline queue cache using Hive
- NGO web:
  - Bento-style dashboard layout
  - Live map (MapLibre) with heatmap layer
  - Live status alert panel

## 4) Privacy by Design

- Session APIs:
  - `POST /api/sessions/start` (requires consent)
  - `POST /api/sessions/end` (clears live location rows)
  - `POST /api/sessions/privacy/cleanup` (removes expired data)
- `sessions.delete_after` TTL default 30 days
- Cloud Storage lifecycle policy helper in code for 30-day auto-delete
- Aggregated dashboard metrics (no per-user history exposed in web UI)

## 5) Setup Instructions

### Prerequisites
- Python 3.12
- Node.js 20+
- Flutter 3.x
- Docker Desktop

If Docker is missing on Windows, install with:
```bash
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
```

### Local infra
```bash
cp .env.example .env
cd infra/local
docker compose up -d --build postgres redis
```

First-time Docker pull can take several minutes (PostGIS image is large).

Confirm infra status:
```bash
docker compose ps
```

### Create Python venv (once)
```bash
cd ../..
python -m venv .venv
.venv/Scripts/pip install -r apps/api/requirements.txt -r apps/worker/requirements.txt
```

### Run API (terminal 1)
```bash
cd apps/api
../../.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

### Run Worker (terminal 2)
```bash
cd apps/worker
../../.venv/Scripts/python -m uvicorn worker.main:app --host 0.0.0.0 --port 8090
```

### Run Web (terminal 3)
```bash
cd apps/web
npm install
npm run dev
```

### Health checks
```bash
curl http://localhost:8080/health
curl http://localhost:8090/health
curl http://localhost:3000
```

### Firebase Auth Setup (required for sign in/sign up)
1. Open Firebase Console -> Build -> Authentication -> Sign-in method.
2. Enable Email/Password provider.
3. Open Authentication -> Settings -> Authorized domains.
4. Add `localhost` and `127.0.0.1`.
5. Verify root `.env` has valid `NEXT_PUBLIC_FIREBASE_*` keys for the same Firebase project.

If you see `Firebase: Error (auth/configuration-not-found)`, one of the steps above is missing.

Web routes:
- `/` animated landing page
- `/auth?role=ngo` NGO auth
- `/auth?role=volunteer` volunteer auth
- `/dashboard` NGO dashboard
- `/volunteer` volunteer area
- `/volunteer/active` volunteer active tasks + completion proof
- `/volunteer/settings` volunteer settings/preferences

If `/auth` shows a Firebase config warning, add these to root `.env`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- Optional: `NEXT_PUBLIC_API_BASE_URL` (default is `http://localhost:8080`)

### Mobile
```bash
cd apps/mobile_flutter
flutter pub get
flutter run
```

## 6) Free-Tier Deployment Notes

- Web: Vercel (use `apps/web/vercel.json` rewrite)
- API/Worker: Cloud Run from `infra/gcp/cloudbuild.yaml`
- Postgres: Neon free tier, run `infra/db/migrations/001_init.sql`
- Redis: Upstash free tier (`REDIS_URL` in API env)
- Map: MapTiler free key in web/mobile env

## 7) Environment Variable Checklist

- Single source of truth: `/.env` (root)
- Template: `/.env.example`
