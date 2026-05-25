-- CivicSense pre-production hardening schema additions.
-- Mirrors backend/backend/sql/*_v1.sql for production Flyway bootstrap.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'WORKER';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;

        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPERVISOR';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS issue_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    actor_role VARCHAR(255),
    metadata TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_activities_issue_id_created_at
ON issue_activities(issue_id, created_at);

CREATE TABLE IF NOT EXISTS issue_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
    citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating VARCHAR(40) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_feedback_issue_id
ON issue_feedback(issue_id);

CREATE INDEX IF NOT EXISTS idx_issue_feedback_citizen_id
ON issue_feedback(citizen_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
ON notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
ON notifications(recipient_id, read_at);
