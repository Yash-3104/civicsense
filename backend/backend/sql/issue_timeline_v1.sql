-- Issue Timeline / Audit Trail V1
-- MANUAL SQL ONLY.
-- Run with psql only when setting up a local/demo DB.
-- Do not place this file as src/main/resources/data.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS issue_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    actor_role VARCHAR(80),
    metadata TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_activities_issue_id_created_at
ON issue_activities(issue_id, created_at);
