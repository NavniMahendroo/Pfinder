# Smart Resource Allocation (SRA)

AI-powered emergency coordination platform for NGOs and volunteers.

## Elevator Pitch
When a crisis hits, help requests are fragmented, response windows are short, and volunteer coordination is mostly manual. SRA converts messy input (voice, paper, notes) into structured, geo-aware tasks and routes them to the right volunteers fast, with traceable completion proof and impact metrics.

## Why This Matters
- Delays in volunteer allocation cost lives and resources.
- NGOs need operational visibility, not spreadsheets.
- Volunteers need clear offers, clear distance, and clear task lifecycle.

## SDG Alignment
- SDG 3: Good Health and Well-being
- SDG 11: Sustainable Cities and Communities
- SDG 16: Peace, Justice, and Strong Institutions
- SDG 17: Partnerships for the Goals

## Current Capabilities

### NGO workflow
- Create and publish tasks with urgency, location, skills, and volunteer date window.
- Monitor active tasks and completion proof.
- View volunteer intelligence in a dedicated page:
  - availability
  - skills and preferences
  - trust/reliability score
  - completion metrics

### Volunteer workflow
- See New Offers with map, distance, and task context.
- Accept a task:
  - removed from New Offers
  - appears in Active Tasks
- Complete a task with proof.
- Earn fixed reward: 20 points per completed task.
- View completed tasks in a separate page.

### AI and dispatch foundation
- Voice transcription + OCR pipeline ready.
- Structured extraction of urgency/category/location.
- Ripple dispatch concept (expand radius 2 -> 5 -> 10 km).
- Matching service scaffold with scoring hooks.

## Tech Stack
- Web: Next.js 14, TypeScript, Tailwind, MapLibre
- API: FastAPI, SQLAlchemy, Pydantic
- Worker: Python service for matching and dispatch
- DB: PostgreSQL 16 + PostGIS + pgvector
- Cache/Queue: Redis, Cloud Tasks hooks
- Auth: Firebase Auth
- Storage: Google Cloud Storage hooks

## High-Level Architecture
1. Intake service receives unstructured need signals.
2. AI pipeline converts them into normalized task records.
3. Dispatch/matching layer selects the best volunteer candidates.
4. NGO dashboard tracks assignment and completion authenticity.
5. Volunteer client drives offer -> active -> completed lifecycle.

## Repository Structure
```
smart-resource-allocation-2026/
  apps/
    api/                  # FastAPI backend
    worker/               # Matching and dispatch worker
    web/                  # Next.js web app
    mobile_flutter/       # Flutter app
  infra/
    db/migrations/        # SQL migrations
    local/                # Docker compose for local infra
    gcp/                  # Cloud build/deploy helpers
```

## Quickstart (Hackathon Demo)

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker Desktop

### 1) Clone and open project root
```bash
cd "c:/Users/Rashi/Desktop/PROJECTS/SOLUTION CHALLENGE"
cd smart-resource-allocation-2026
```

### 2) Configure environment
```bash
cp .env.example .env
```

Fill Firebase variables in `.env`:
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID

Optional:
- NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

### 3) Start local infra (Postgres + Redis)
```bash
cd infra/local
docker compose up -d --build postgres redis
docker compose ps
cd ../..
```

### 4) Install backend dependencies
```bash
cd apps/api
python -m pip install -r requirements.txt
cd ../..
```

### 5) Run API (Terminal A)
```bash
cd "c:/Users/Rashi/Desktop/PROJECTS/SOLUTION CHALLENGE/smart-resource-allocation-2026/apps/api"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

### 6) Run web app (Terminal B)
```bash
cd "c:/Users/Rashi/Desktop/PROJECTS/SOLUTION CHALLENGE/smart-resource-allocation-2026/apps/web"
npm install
npm run dev
```

### 7) Verify health
```bash
curl -s -i http://localhost:8080/health
curl -s -i http://localhost:3000
```

## Demo Routes
- /
- /auth?role=ngo
- /auth?role=volunteer
- /dashboard
- /dashboard/volunteers
- /volunteer
- /volunteer/active
- /volunteer/completed
- /volunteer/settings

## Judge-Friendly Demo Script (5 minutes)
1. Log in as NGO and publish a task with a date window.
2. Switch to volunteer and open New Offers map.
3. Accept the task (it disappears from offers).
4. Open Active Tasks (task appears there).
5. Complete the task with proof.
6. Open Completed Tasks page:
   - task appears
   - points increase by 20
7. Return to NGO dashboard and show proof and volunteer insights.

## API Snapshot
- POST /api/tasks/create-manual
- GET /api/tasks/ngo-dashboard
- GET /api/tasks/ngo-volunteers
- GET /api/tasks/volunteer/active
- POST /api/tasks/volunteer/accept
- POST /api/tasks/volunteer/complete
- GET /api/tasks/volunteer/history
- GET /api/tasks/volunteer/settings
- POST /api/tasks/volunteer/settings

## What Makes This Hackathon-Ready
- Clear social impact story tied to measurable outcomes.
- End-to-end lifecycle implemented (offer -> accept -> active -> complete -> history).
- Multi-role product experience (NGO + volunteer).
- Technical depth across AI, geospatial, dispatch, and full-stack delivery.
- Local demo reproducibility with explicit commands and troubleshooting.

## Troubleshooting

### Frontend shows plain, unstyled page
Cause: Next static CSS asset mismatch in cache.

Fix:
```bash
cd "c:/Users/Rashi/Desktop/PROJECTS/SOLUTION CHALLENGE/smart-resource-allocation-2026/apps/web"
rm -rf .next
npm run dev
```
Then hard refresh browser with Ctrl+F5.

### Port already in use
- Next auto-falls back to 3001 if 3000 is occupied.
- Open the exact Local URL printed in terminal.

### Firebase auth/configuration-not-found
- Ensure Firebase Email/Password is enabled.
- Add localhost and 127.0.0.1 in Firebase authorized domains.
- Verify all NEXT_PUBLIC_FIREBASE_* values in `.env`.

## Deployment Notes (Free Tier Friendly)
- Web: Vercel
- API/Worker: Cloud Run
- Postgres: Neon or Cloud SQL trial
- Redis: Upstash
- Object storage: GCS bucket lifecycle enabled

## Next Improvements
- Real-time volunteer tracking with privacy-preserving TTL rules.
- Offline-first mobile synchronization.
- Multi-language NGO intake assistant.
- Judge dashboard with impact KPIs over time.

## License
MIT (or your preferred hackathon license).
