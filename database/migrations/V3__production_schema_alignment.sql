-- CivicSense production schema alignment for current backend expectations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'WORKER';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPERVISOR';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
        ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'PENDING_CLOSURE';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'MULTIPART_FORM_DATA_VALUE';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS worker_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(80) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_department VARCHAR(80);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalation_reason VARCHAR(80);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalation_notes TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalated_by UUID;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalation_level VARCHAR(255);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS ai_description TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS ai_confidence_score DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS fake_report_likelihood DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS severity_confidence DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS duplicate_likelihood DOUBLE PRECISION;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS possible_duplicate_issue_id UUID;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS ai_raw_caption TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS ai_clip_label VARCHAR(255);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolution_image_url VARCHAR(255);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(80);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

ALTER TABLE issue_media ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE issue_activities ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);
ALTER TABLE issue_activities ADD COLUMN IF NOT EXISTS actor_role VARCHAR(255);
ALTER TABLE issue_activities ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE issue_activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE issue_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'issues'
          AND column_name = 'ai_confidence'
    ) THEN
        UPDATE issues
        SET ai_confidence_score = COALESCE(ai_confidence_score, ai_confidence::DOUBLE PRECISION)
        WHERE ai_confidence IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_issues_escalated_by'
    ) THEN
        ALTER TABLE issues
        ADD CONSTRAINT fk_issues_escalated_by
        FOREIGN KEY (escalated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_worker_department'
    ) THEN
        ALTER TABLE worker_departments
        ADD CONSTRAINT uq_worker_department UNIQUE (worker_id, department);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_issue_feedback_issue_id'
    ) THEN
        ALTER TABLE issue_feedback
        ADD CONSTRAINT uk_issue_feedback_issue_id UNIQUE (issue_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_worker_departments_worker_id
ON worker_departments(worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_departments_department
ON worker_departments(department);

CREATE INDEX IF NOT EXISTS idx_issues_status_updated_at
ON issues(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_reported_by_created_at
ON issues(reported_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_assigned_department
ON issues(assigned_department);

CREATE INDEX IF NOT EXISTS idx_issues_assigned_to_status
ON issues(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_issues_sla_deadline
ON issues(sla_deadline);

CREATE INDEX IF NOT EXISTS idx_issues_sla_breached
ON issues(sla_breached);

CREATE INDEX IF NOT EXISTS idx_issues_escalated_at
ON issues(escalated_at);

CREATE INDEX IF NOT EXISTS idx_issues_escalation_reason
ON issues(escalation_reason);

CREATE INDEX IF NOT EXISTS idx_issues_resolved_at
ON issues(resolved_at);

CREATE INDEX IF NOT EXISTS idx_issues_rejected_at
ON issues(rejected_at);

CREATE INDEX IF NOT EXISTS idx_issues_public_dashboard
ON issues(status, category, assigned_department, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_operational_queue
ON issues(assigned_department, status, sla_deadline, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_possible_duplicate_issue_id
ON issues(possible_duplicate_issue_id);

CREATE INDEX IF NOT EXISTS idx_issue_activities_actor_id
ON issue_activities(actor_id);

CREATE INDEX IF NOT EXISTS idx_issue_activities_type_created_at
ON issue_activities(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issue_feedback_citizen_created_at
ON issue_feedback(citizen_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread_created
ON notifications(recipient_id, created_at DESC)
WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_issue_id
ON notifications(issue_id);
