-- CivicSense Initial Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- ENUM TYPES
-- =========================

CREATE TYPE user_role AS ENUM (
    'CITIZEN',
    'OFFICER',
    'ADMIN'
);

CREATE TYPE issue_category AS ENUM (
    'POTHOLE',
    'GARBAGE',
    'STREETLIGHT',
    'WATER_LEAK'
);

CREATE TYPE issue_status AS ENUM (
    'REPORTED',
    'VERIFIED',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED',
    'REJECTED'
);

CREATE TYPE severity_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE media_type AS ENUM (
    'IMAGE',
    'VIDEO'
);

CREATE TYPE audit_action AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'STATUS_CHANGE'
);

-- =========================
-- USERS
-- =========================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'CITIZEN',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- ISSUES
-- =========================

CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    category issue_category NOT NULL,
    status issue_status NOT NULL DEFAULT 'REPORTED',
    severity severity_level DEFAULT 'LOW',
    priority_score NUMERIC(5,2) DEFAULT 0,

    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address TEXT,

    reported_by UUID NOT NULL REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),

    ai_confidence NUMERIC(5,2),
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- ISSUE MEDIA
-- =========================

CREATE TABLE issue_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type media_type NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- ISSUE STATUS HISTORY
-- =========================

CREATE TABLE issue_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    old_status issue_status,
    new_status issue_status NOT NULL,
    changed_by UUID REFERENCES users(id),
    remarks TEXT,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- SLA RECORDS
-- =========================

CREATE TABLE sla_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID UNIQUE NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP,
    deadline_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    is_breached BOOLEAN NOT NULL DEFAULT FALSE,
    breach_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- COMMENTS
-- =========================

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- VOTES
-- =========================

CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_issue_vote UNIQUE(issue_id, user_id)
);

-- =========================
-- DUPLICATE ISSUES
-- =========================

CREATE TABLE duplicate_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    duplicate_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5,2) NOT NULL,
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_duplicate_pair UNIQUE(primary_issue_id, duplicate_issue_id),
    CONSTRAINT no_self_duplicate CHECK (primary_issue_id <> duplicate_issue_id)
);

-- =========================
-- AUDIT LOGS
-- =========================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action audit_action NOT NULL,
    hash_value TEXT,
    previous_hash TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- INDEXES
-- =========================

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_category ON issues(category);
CREATE INDEX idx_issues_severity ON issues(severity);
CREATE INDEX idx_issues_reported_by ON issues(reported_by);
CREATE INDEX idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX idx_issues_location ON issues(latitude, longitude);
CREATE INDEX idx_issues_created_at ON issues(created_at);

CREATE INDEX idx_issue_media_issue_id ON issue_media(issue_id);

CREATE INDEX idx_status_history_issue_id ON issue_status_history(issue_id);
CREATE INDEX idx_status_history_changed_at ON issue_status_history(changed_at);

CREATE INDEX idx_sla_deadline ON sla_records(deadline_at);
CREATE INDEX idx_sla_breached ON sla_records(is_breached);

CREATE INDEX idx_comments_issue_id ON comments(issue_id);
CREATE INDEX idx_votes_issue_id ON votes(issue_id);

CREATE INDEX idx_duplicate_primary_issue ON duplicate_issues(primary_issue_id);
CREATE INDEX idx_duplicate_duplicate_issue ON duplicate_issues(duplicate_issue_id);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);