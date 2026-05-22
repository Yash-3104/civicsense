-- OPTIONAL DEMO SEED ONLY
-- Run this only on local/demo databases.
-- Do NOT run on production.
--
-- This file is NOT auto-run by Spring Boot unless you explicitly configure it
-- as data.sql/import.sql or pass it to psql manually.
--
-- Demo login password for all seeded users below:
-- password
--
-- BCrypt hash used:
-- $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

BEGIN;

WITH demo_users AS (
    INSERT INTO users (
        id,
        name,
        email,
        phone,
        password_hash,
        role,
        is_verified,
        created_at,
        updated_at
    )
    VALUES
        (
            '11111111-1111-1111-1111-111111111111',
            'Demo Admin',
            'demo.admin@civicsense.local',
            '9000000001',
            '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
            'ADMIN',
            true,
            NOW(),
            NOW()
        ),
        (
            '22222222-2222-2222-2222-222222222222',
            'Demo Supervisor',
            'demo.supervisor@civicsense.local',
            '9000000002',
            '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
            'SUPERVISOR',
            true,
            NOW(),
            NOW()
        ),
        (
            '33333333-3333-3333-3333-333333333333',
            'Demo Worker',
            'demo.worker@civicsense.local',
            '9000000003',
            '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
            'WORKER',
            true,
            NOW(),
            NOW()
        ),
        (
            '44444444-4444-4444-4444-444444444444',
            'Demo Citizen',
            'demo.citizen@civicsense.local',
            '9000000004',
            '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
            'CITIZEN',
            true,
            NOW(),
            NOW()
        )
    ON CONFLICT (email) DO UPDATE
    SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        is_verified = true,
        updated_at = NOW()
    RETURNING id
)
INSERT INTO worker_departments (
    id,
    worker_id,
    department,
    created_at
)
VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '22222222-2222-2222-2222-222222222222',
        'ROAD_MAINTENANCE',
        NOW()
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        '33333333-3333-3333-3333-333333333333',
        'ROAD_MAINTENANCE',
        NOW()
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        '22222222-2222-2222-2222-222222222222',
        'STREETLIGHT_MAINTENANCE',
        NOW()
    )
ON CONFLICT (worker_id, department) DO NOTHING;

INSERT INTO issues (
    id,
    title,
    description,
    category,
    status,
    severity,
    priority_score,
    latitude,
    longitude,
    address,
    reported_by,
    assigned_to,
    assigned_department,
    assigned_at,
    sla_deadline,
    sla_breached,
    escalation_reason,
    escalation_notes,
    escalated_at,
    escalated_by,
    escalation_level,
    created_at,
    updated_at,
    ai_description,
    ai_confidence_score,
    fake_report_likelihood,
    severity_confidence,
    duplicate_likelihood,
    ai_reasoning,
    resolution_notes,
    resolution_image_url,
    resolved_at,
    rejection_reason,
    rejection_notes,
    rejected_at
)
VALUES
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        'Demo pothole near main road',
        'Large pothole affecting two-wheeler traffic near the main road.',
        'POTHOLE',
        'REPORTED',
        'MEDIUM',
        0.62,
        18.5204,
        73.8567,
        'Shivajinagar, Pune',
        '44444444-4444-4444-4444-444444444444',
        NULL,
        NULL,
        NULL,
        NULL,
        false,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days',
        'Road surface damage visible in submitted image.',
        0.82,
        0.08,
        0.70,
        0.12,
        'Image appears authentic; severity looks medium.',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
        'Demo assigned road repair task',
        'Road damage verified and assigned to the road maintenance worker.',
        'POTHOLE',
        'ASSIGNED',
        'HIGH',
        0.85,
        18.5246,
        73.8579,
        'Jangali Maharaj Road, Pune',
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333',
        'ROAD_MAINTENANCE',
        NOW() - INTERVAL '3 days',
        NOW() + INTERVAL '1 day',
        false,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW() - INTERVAL '4 days',
        NOW() - INTERVAL '3 days',
        'Pothole verified for worker assignment.',
        0.90,
        0.05,
        0.86,
        0.10,
        'High confidence report; road department task.',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
        'Demo escalated streetlight outage',
        'Streetlight outage remains unresolved past SLA deadline.',
        'STREETLIGHT',
        'IN_PROGRESS',
        'HIGH',
        0.88,
        18.5310,
        73.8440,
        'Model Colony, Pune',
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333',
        'STREETLIGHT_MAINTENANCE',
        NOW() - INTERVAL '6 days',
        NOW() - INTERVAL '1 day',
        true,
        'SLA_BREACHED',
        'Demo escalation because SLA was breached.',
        NOW() - INTERVAL '12 hours',
        '22222222-2222-2222-2222-222222222222',
        'LEVEL_2',
        NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '12 hours',
        'Streetlight issue detected and escalated.',
        0.87,
        0.04,
        0.84,
        0.09,
        'Night-time safety risk; escalation required.',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
        'Demo resolved garbage overflow',
        'Garbage overflow was cleaned and closed with proof.',
        'GARBAGE',
        'RESOLVED',
        'MEDIUM',
        0.72,
        18.5167,
        73.8416,
        'Deccan Gymkhana, Pune',
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333',
        'WASTE_MANAGEMENT',
        NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '5 days',
        false,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW() - INTERVAL '9 days',
        NOW() - INTERVAL '2 days',
        'Garbage pile verified and routed to cleanup.',
        0.91,
        0.03,
        0.77,
        0.06,
        'Resolved issue useful for feedback demo.',
        'Area cleaned and waste removed by operations team.',
        'https://placehold.co/900x600?text=Demo+After+Image',
        NOW() - INTERVAL '2 days',
        NULL,
        NULL,
        NULL
    )
ON CONFLICT (id) DO UPDATE
SET
    status = EXCLUDED.status,
    assigned_to = EXCLUDED.assigned_to,
    assigned_department = EXCLUDED.assigned_department,
    sla_deadline = EXCLUDED.sla_deadline,
    sla_breached = EXCLUDED.sla_breached,
    escalation_reason = EXCLUDED.escalation_reason,
    escalation_notes = EXCLUDED.escalation_notes,
    escalated_at = EXCLUDED.escalated_at,
    escalation_level = EXCLUDED.escalation_level,
    updated_at = NOW(),
    resolution_notes = EXCLUDED.resolution_notes,
    resolution_image_url = EXCLUDED.resolution_image_url,
    resolved_at = EXCLUDED.resolved_at;

INSERT INTO issue_feedback (
    id,
    issue_id,
    citizen_id,
    rating,
    comment,
    created_at,
    updated_at
)
VALUES (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    '44444444-4444-4444-4444-444444444444',
    'SATISFIED',
    'Demo feedback: the area was cleaned properly.',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (issue_id) DO UPDATE
SET
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    updated_at = NOW();

INSERT INTO notifications (
    id,
    recipient_id,
    issue_id,
    type,
    title,
    message,
    read_at,
    created_at
)
VALUES
    (
        'dddddddd-dddd-dddd-dddd-ddddddddddd1',
        '11111111-1111-1111-1111-111111111111',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        'ISSUE_REPORTED',
        'Demo new issue reported',
        'Demo pothole near main road was submitted by a citizen.',
        NULL,
        NOW() - INTERVAL '2 hours'
    ),
    (
        'dddddddd-dddd-dddd-dddd-ddddddddddd2',
        '22222222-2222-2222-2222-222222222222',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
        'ISSUE_ESCALATED',
        'Demo department issue escalated',
        'Demo escalated streetlight outage needs supervisor attention.',
        NULL,
        NOW() - INTERVAL '1 hour'
    ),
    (
        'dddddddd-dddd-dddd-dddd-ddddddddddd3',
        '33333333-3333-3333-3333-333333333333',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
        'ISSUE_ASSIGNED',
        'Demo issue assigned to you',
        'Demo assigned road repair task was assigned to you.',
        NULL,
        NOW() - INTERVAL '45 minutes'
    ),
    (
        'dddddddd-dddd-dddd-dddd-ddddddddddd4',
        '44444444-4444-4444-4444-444444444444',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
        'ISSUE_RESOLVED',
        'Demo report resolved',
        'Demo resolved garbage overflow was resolved. You can submit feedback.',
        NOW() - INTERVAL '30 minutes',
        NOW() - INTERVAL '30 minutes'
    )
ON CONFLICT (id) DO UPDATE
SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    read_at = EXCLUDED.read_at,
    created_at = EXCLUDED.created_at;

COMMIT;
