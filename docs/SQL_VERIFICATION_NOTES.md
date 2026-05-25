# SQL Verification Notes

The remaining V1 prompt asked to verify SQL alignment.

Expected table/entity alignment:

## issue_feedback

Matches `IssueFeedback`:

- `id`
- `issue_id` unique
- `citizen_id`
- `rating`
- `comment`
- `created_at`
- `updated_at`

## notifications

Matches `AppNotification`:

- `id`
- `recipient_id`
- `issue_id` nullable
- `type`
- `title`
- `message`
- `read_at`
- `created_at`

## issue_activities

Matches `IssueActivity`:

- `id`
- `issue_id`
- `type`
- `message`
- `actor_id`
- `actor_name`
- `actor_role`
- `metadata`
- `created_at`

## roles_v1.sql

Should safely add `WORKER` and `SUPERVISOR` only when PostgreSQL enum `user_role` exists.

All SQL files must remain manual-only and idempotent.
