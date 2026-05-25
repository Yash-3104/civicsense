-- Simple In-App Notification Center V1
-- MANUAL SQL ONLY.
-- Run with psql only when setting up a local/demo DB.
-- Do not place this file as src/main/resources/data.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
