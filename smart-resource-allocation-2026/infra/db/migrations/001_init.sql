CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ngo', 'volunteer');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('new', 'matching', 'dispatched', 'accepted', 'in_progress', 'completed', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
        CREATE TYPE match_status AS ENUM ('pending', 'invited', 'accepted', 'declined', 'expired');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(30) UNIQUE,
    interests TEXT[] NOT NULL DEFAULT '{}',
    skills TEXT[] NOT NULL DEFAULT '{}',
    availability JSONB NOT NULL DEFAULT '{}',
    location GEOGRAPHY(Point, 4326),
    location_text VARCHAR(255),
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    profile_embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(id),
    summary TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    urgency_score SMALLINT NOT NULL CHECK (urgency_score BETWEEN 1 AND 10),
    location GEOGRAPHY(Point, 4326),
    location_context VARCHAR(255) NOT NULL,
    location_lat DOUBLE PRECISION NOT NULL,
    location_lng DOUBLE PRECISION NOT NULL,
    raw_transcript TEXT,
    voice_storage_path VARCHAR(512),
    paper_storage_path VARCHAR(512),
    structured_payload JSONB NOT NULL DEFAULT '{}',
    status task_status NOT NULL DEFAULT 'new',
    matched_volunteer_id UUID REFERENCES users(id),
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semantic_similarity DOUBLE PRECISION NOT NULL DEFAULT 0,
    skill_match DOUBLE PRECISION NOT NULL DEFAULT 0,
    availability_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    urgency_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
    match_score DOUBLE PRECISION NOT NULL,
    status match_status NOT NULL DEFAULT 'pending',
    ripple_radius_km INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(task_id, volunteer_id, ripple_radius_km)
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    delete_after TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS volunteer_locations_live (
    volunteer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_tasks_location ON tasks USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_tasks_embedding ON tasks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_users_embedding ON users USING hnsw (profile_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_sessions_delete_after ON sessions(delete_after);
CREATE INDEX IF NOT EXISTS idx_matches_task_status ON matches(task_id, status);

CREATE OR REPLACE FUNCTION sync_user_location_geography()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_location_sync ON users;
CREATE TRIGGER trg_users_location_sync
BEFORE INSERT OR UPDATE OF location_lat, location_lng
ON users
FOR EACH ROW
EXECUTE FUNCTION sync_user_location_geography();

CREATE OR REPLACE FUNCTION sync_task_location_geography()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_location_sync ON tasks;
CREATE TRIGGER trg_tasks_location_sync
BEFORE INSERT OR UPDATE OF location_lat, location_lng
ON tasks
FOR EACH ROW
EXECUTE FUNCTION sync_task_location_geography();

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM volunteer_locations_live
    WHERE session_id IN (SELECT id FROM sessions WHERE delete_after <= now());

    DELETE FROM sessions
    WHERE delete_after <= now();
END;
$$ LANGUAGE plpgsql;
