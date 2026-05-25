# CivicSense

AI-powered urban issue reporting and governance intelligence platform.

## Prerequisites

- Java 21
- PostgreSQL
- Node.js + npm
- Kafka is optional for local demo if you are not testing async AI events
- AI service running on `http://localhost:8000` for image analysis features

## Backend setup

Backend module root:

```txt
backend/backend/
```

Create local environment variables using:

```txt
backend/backend/.env.example
```

Important production variables:

```txt
DB_URL
DB_USER
DB_PASSWORD
JWT_SECRET
PUBLIC_BASE_URL
CORS_ALLOWED_ORIGINS
AI_SERVICE_BASE_URL
SPRING_PROFILES_ACTIVE
```

Run backend:

```bash
cd backend/backend
mvn spring-boot:run
```

## Frontend setup

Create:

```txt
frontend/.env
```

Use:

```env
VITE_API_BASE_URL=http://localhost:8031
VITE_WS_URL=http://localhost:8031/ws
VITE_AI_PREVIEW_URL=http://localhost:8000/analyze-preview
```

Run frontend:

```bash
cd frontend
npm install
npm run dev
```

## Local demo routes

- `/` -> Landing page
- `/login` -> Login
- `/register` -> Citizen registration
- `/dashboard` -> Citizen dashboard
- `/admin` -> Admin dashboard
- `/worker` -> Worker dashboard
- `/supervisor` -> Supervisor dashboard
- `/transparency` -> Public transparency

## Manual SQL setup

Manual SQL files live in:

```txt
backend/backend/sql/
```

Run in this order:

```bash
psql -U civicsense_user -d civicsense_db -f backend/backend/sql/roles_v1.sql
psql -U civicsense_user -d civicsense_db -f backend/backend/sql/issue_timeline_v1.sql
psql -U civicsense_user -d civicsense_db -f backend/backend/sql/issue_feedback_v1.sql
psql -U civicsense_user -d civicsense_db -f backend/backend/sql/notifications_v1.sql
```

Optional local demo data only:

```bash
psql -U civicsense_user -d civicsense_db -f backend/backend/sql/demo_seed_optional.sql
```

Do not run demo seed on production.

## Smoke tests

Use:

```txt
docs/PRODUCTION_READINESS_SMOKE_TESTS.md
```

## Production profile note

When using:

```txt
SPRING_PROFILES_ACTIVE=prod
```

you must provide real values for:

```txt
JWT_SECRET
DB_URL
DB_USER
DB_PASSWORD
PUBLIC_BASE_URL
CORS_ALLOWED_ORIGINS
AI_SERVICE_BASE_URL
```

## Production deploy

Use the production checklist before deploying:

```txt
docs/PRODUCTION_DEPLOY_CHECKLIST.md
```

Production runs Flyway from `database/migrations` using:

```properties
spring.flyway.locations=filesystem:../../database/migrations
```

Run the backend from `backend/backend` so this path resolves correctly. Keep manual SQL files in `backend/backend/sql/` for local psql setup only.

## Do not commit

```txt
.env
frontend/.env
backend/backend/target/
uploads/
```
