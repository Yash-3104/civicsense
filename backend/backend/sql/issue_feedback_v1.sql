-- Citizen Resolution Feedback V1
-- MANUAL SQL ONLY.
-- Run with psql only when setting up a local/demo DB.
-- Do not place this file as src/main/resources/data.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
