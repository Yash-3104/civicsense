# CivicSense

CivicSense is an AI-powered public infrastructure reporting and governance platform. Citizens can report civic issues on a map with image evidence, while AI-assisted analysis helps with category, verification, duplicate, and severity signals. Admins triage and assign work, workers submit closure evidence, and supervisors monitor department-scoped queues. Public transparency views show safe progress without private notes, with support for local or Cloudinary image storage, WebSocket notifications, and CSV/XLSX audit exports.

## Project overview

- Citizen reporting with map location, image upload, and report tracking
- AI-assisted verification, duplicate signals, category hints, and severity support
- Admin triage, worker assignment, worker closure evidence, and supervisor department queues
- Public transparency dashboard with private feedback/admin notes excluded
- Local or Cloudinary image storage, live WebSocket notifications, and XLSX/audit exports

## Demo flow

Citizen reports issue with image -> AI assists category/verification -> Admin verifies and assigns -> Worker resolves with closure evidence -> Admin reviews closure -> Citizen submits feedback -> Public transparency dashboard shows safe progress.

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
SPRING_PROFILES_ACTIVE
FLYWAY_ENABLED
DB_URL
DB_USER
DB_PASSWORD
JWT_SECRET
PUBLIC_BASE_URL
CORS_ALLOWED_ORIGINS
AI_SERVICE_BASE_URL
STORAGE_PROVIDER
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_FOLDER
UPLOADS_PUBLIC
KAFKA_BOOTSTRAP_SERVERS
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
- `/admin/staff` -> Staff Management
- `/worker` -> Worker dashboard
- `/supervisor` -> Supervisor dashboard
- `/transparency` -> Public transparency

## Demo credentials

Demo credentials depend on your local seed data. The optional local demo seed includes these intentionally demo-only accounts:

- Admin: `demo.admin@civicsense.local`
- Supervisor: `demo.supervisor@civicsense.local`
- Worker: `demo.worker@civicsense.local`
- Citizen: `demo.citizen@civicsense.local`
- Demo password for the optional seed accounts: `password`

Do not reuse demo credentials in production or commit private passwords.

## Image storage modes

Local upload storage remains the default:

```env
STORAGE_PROVIDER=local
UPLOADS_PUBLIC=true
```

Cloudinary storage is opt-in for newly uploaded issue and resolution images:

```env
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=replace-with-cloud-name
CLOUDINARY_API_KEY=replace-with-api-key
CLOUDINARY_API_SECRET=replace-with-api-secret
CLOUDINARY_FOLDER=civicsense
```

Cloudinary mode stores new display URLs from Cloudinary `secure_url` values. Older local image records still resolve through `PUBLIC_BASE_URL/uploads/...`, and the current AI/Kafka path still uses a local file path. Never commit real Cloudinary credentials.

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

## Before Docker Compose V1

Docker Compose V1 is the next phase. The repository currently supports manual local startup for the backend, frontend, AI service, database, and optional Kafka testing.

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

For Cloudinary migration details, use:

```txt
docs/CLOUDINARY_MIGRATION_V1.md
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
backend/backend/.env
ai-service/.env
backend/backend/target/
uploads/
```
