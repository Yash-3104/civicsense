# CivicSense Database Schema

## Project

CivicSense is an AI-powered civic issue intelligence platform where citizens report urban issues such as potholes, garbage overflow, water leaks, and streetlight failures.

The platform supports:
- Issue reporting
- AI verification
- Duplicate detection
- SLA tracking
- Officer assignment
- Public transparency
- Audit logging

## Primary Database

PostgreSQL

## Why PostgreSQL?

- Strong relational integrity
- Good support for UUIDs
- Reliable transactional consistency
- Suitable for users, reports, SLA records, status history, and audit logs

## Core Tables

1. users
2. issues
3. issue_media
4. issue_status_history
5. sla_records
6. comments
7. votes
8. duplicate_issues
9. audit_logs

## Relationships

- One user can report many issues
- One issue can have many media files
- One issue can have many status history records
- One issue can have one SLA record
- One issue can have many comments
- One issue can have many votes
- One issue can be linked to duplicate issues
- Audit logs store important system actions