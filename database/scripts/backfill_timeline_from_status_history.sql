-- Optional timeline backfill from legacy issue_status_history rows.
-- Idempotent: only inserts for issues that have status history and zero issue_activities.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO issue_activities (
    id,
    issue_id,
    type,
    message,
    actor_id,
    actor_name,
    actor_role,
    metadata,
    created_at
)
SELECT
    gen_random_uuid(),
    history.issue_id,
    CASE history.new_status::text
        WHEN 'VERIFIED' THEN 'ISSUE_VERIFIED'
        WHEN 'ASSIGNED' THEN 'ISSUE_ASSIGNED'
        WHEN 'IN_PROGRESS' THEN 'WORK_STARTED'
        WHEN 'RESOLVED' THEN 'CLOSURE_APPROVED'
        WHEN 'REJECTED' THEN 'ISSUE_REJECTED'
        ELSE 'STATUS_CHANGED'
    END,
    CASE
        WHEN history.old_status IS NULL THEN
            'Status set to ' || history.new_status::text
        ELSE
            'Status changed from ' || history.old_status::text || ' to ' || history.new_status::text
    END,
    history.changed_by,
    COALESCE(NULLIF(actor.name, ''), NULLIF(actor.email, ''), 'System'),
    COALESCE(actor.role::text, 'SYSTEM'),
    'backfilled_from_issue_status_history',
    history.changed_at
FROM issue_status_history history
LEFT JOIN users actor
    ON actor.id = history.changed_by
WHERE NOT EXISTS (
    SELECT 1
    FROM issue_activities existing
    WHERE existing.issue_id = history.issue_id
)
ORDER BY history.issue_id, history.changed_at;
