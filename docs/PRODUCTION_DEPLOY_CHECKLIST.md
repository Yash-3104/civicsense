# CivicSense Production Deploy Checklist

Use this checklist before putting CivicSense behind a public production URL.

## Required Environment Variables

### Backend

Set these for the Spring Boot service:

```env
SPRING_PROFILES_ACTIVE=prod
DB_URL=jdbc:postgresql://host:5432/civicsense
DB_USER=civicsense_user
DB_PASSWORD=replace-with-secret
JWT_SECRET=replace-with-long-random-secret
PUBLIC_BASE_URL=https://api.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
AI_SERVICE_BASE_URL=https://ai.example.com
UPLOADS_PUBLIC=true
KAFKA_BOOTSTRAP_SERVERS=broker:9092
KAFKA_CONSUMER_GROUP_ID=civicsense-ai-group
KAFKA_TOPIC_ISSUE_IMAGE_UPLOADED=issue-image-uploaded
```

`JWT_SECRET`, `PUBLIC_BASE_URL`, and `CORS_ALLOWED_ORIGINS` are validated at startup in the `prod` profile.

### Frontend Build

Use production frontend variables before running `npm run build`:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_WS_URL=https://api.example.com/ws
VITE_AI_PREVIEW_URL=https://ai.example.com/analyze-preview
```

See `frontend/.env.production.example`.

### AI Service

Set allowed browser origins for the FastAPI service:

```env
AI_CORS_ORIGINS=https://app.example.com
```

See `ai-service/.env.example`.

## Database Bootstrap

Production uses Flyway with:

```properties
spring.flyway.enabled=true
spring.flyway.locations=filesystem:../../database/migrations
```

This path is chosen because the backend is run from `backend/backend`, so `../../database/migrations` resolves to the repository-level migration folder.

Local/demo databases can still use the manual SQL files in `backend/backend/sql/`. Keep `spring.flyway.enabled=false` locally unless you are intentionally testing migrations.

Never run `backend/backend/sql/demo_seed_optional.sql` on production.

## Services To Run

- PostgreSQL with the production database.
- Spring Boot backend from `backend/backend` with `SPRING_PROFILES_ACTIVE=prod`.
- Frontend static build from `frontend`.
- FastAPI AI service from `ai-service`.
- Kafka broker if async image processing is enabled.

## Security Checklist

- Use a long random `JWT_SECRET`; never use the dev placeholder.
- Confirm `CORS_ALLOWED_ORIGINS` contains only production frontend origins.
- Keep `.env`, `frontend/.env`, `target/`, `uploads/`, and `ai-service/venv/` out of git.
- Keep `/api/admin/**`, export endpoints, and staff endpoints behind role-based access.
- Keep `UPLOADS_PUBLIC=true` only while local uploads are still used. Cloudinary will replace public local uploads in a later hardening pass.
- If `UPLOADS_PUBLIC=false`, `/uploads/**` is not publicly permitted; API responses may still contain URLs, but static file access is restricted by security rules.

## Post-Deploy Verification

Run the smoke checklist after deploy:

```txt
docs/PRODUCTION_READINESS_SMOKE_TESTS.md
```

Verify:

- Backend starts with `prod` profile and fails fast if required secrets are missing.
- Flyway applies `V1__initial_schema.sql` and `V2__roles_feedback_notifications_timeline.sql`.
- Frontend login, role routing, dashboard map, nearby issue fetch, create issue, delete issue, and protected routes work.
- AI `/analyze`, `/analyze-preview`, and `/duplicate-check` contracts still respond.
- WebSocket live feed connects through `VITE_WS_URL`.
- Admin and supervisor exports still require the correct roles.
