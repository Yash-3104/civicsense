# Production Readiness / Bug Polish V1 Notes

## Updated from latest files

These files were updated from the latest uploaded versions:

- `CsvExportService.java`
- `IssueService.java`
- `PublicTransparencyService.java`
- `Dashboard.jsx`
- `AdminDashboard.jsx`
- `Login.jsx`
- `WebSocketConfig.java`
- `TestController.java`

## What changed

### Backend

- `CsvExportService.exportAdminIssues(...)` now validates admin role before exporting all issue data.
- `IssueService` uses `MediaUrlService` instead of hardcoded `http://localhost:8031/uploads/...`.
- `PublicTransparencyService` uses `MediaUrlService`.
- `WebSocketConfig` reads allowed origins from `app.cors.allowed-origins`.
- `TestController` is now dev-only with `@Profile("dev")` and moved under `/api/dev/users/count`.
- `MediaUrlService` centralizes local upload URL building and prepares the project for Cloudinary later.

### Frontend

- `Dashboard.jsx` uses `VITE_AI_PREVIEW_URL`.
- `AdminDashboard.jsx` uses `VITE_WS_URL`.
- `Login.jsx` uses Sonner toasts instead of `alert()` and shows backend error messages.

## Docs

Yes, docs should be updated.

Recommended docs to keep:

- `docs/PRODUCTION_READINESS_SMOKE_TESTS.md`
- `docs/PRODUCTION_READINESS_V1_NOTES.md`

Also update your README with:

- Backend env vars
- Frontend env vars
- Manual SQL commands
- Demo seed SQL location
- Production readiness checklist

# Production Readiness / Bug Polish V1 Notes

## Remaining V1 closed

- `CitizenIssueTrackingService` now uses `MediaUrlService` instead of hardcoded `http://localhost:8031/uploads/`.
- `frontend/src/services/realtime.js` now uses `VITE_WS_URL`.
- `RoleTestController` is dev-only with `@Profile("dev")` and routes are now under `/api/dev/role-test/*`.
- `Register.jsx` now uses Sonner error toasts and still forces `role: "CITIZEN"`.
- `frontend/.env.example` now points `VITE_AI_PREVIEW_URL` to `http://localhost:8000/analyze-preview`.
- `AiServiceClient` now reads `app.ai-service.base-url` from backend configuration.
- README now includes minimal production setup, env references, SQL commands, and smoke test location.

## Role test endpoints

Available only with the `dev` Spring profile:

```http
GET /api/dev/role-test/citizen
GET /api/dev/role-test/officer
GET /api/dev/role-test/admin
```

`SecurityConfig` already protects `/api/dev/**` for admin users.

## V1 gate

Production Readiness / Bug Polish V1 is complete after the smoke pass succeeds.
Cloudinary migration should start only after this smoke pass.

Auth UI + MVP landing page polish completed before Cloudinary.

## Pre-production hardening

- `application-prod.properties` now requires production secrets and enables Flyway with `filesystem:../../database/migrations` when the backend runs from `backend/backend`.
- `ProductionConfigValidator` fails fast in the `prod` profile if `JWT_SECRET`, `PUBLIC_BASE_URL`, or `CORS_ALLOWED_ORIGINS` are missing or if the JWT secret is a known dev placeholder.
- `database/migrations/V2__roles_feedback_notifications_timeline.sql` bootstraps worker/supervisor roles, issue timeline, citizen feedback, and notifications for production.
- The AI service now reads CORS origins from `AI_CORS_ORIGINS`.
- Dashboard and supervisor export errors use Sonner toasts instead of browser alerts.
- `AdminDashboard.jsx` now uses the shared realtime socket helper instead of an inline SockJS client.
- AI processing logs now use SLF4J instead of `System.out.println`.
- `app.uploads.public` / `UPLOADS_PUBLIC` controls whether `/uploads/**` is publicly readable before the later Cloudinary migration.
- See `docs/PRODUCTION_DEPLOY_CHECKLIST.md` for deploy env vars, Flyway guidance, services, security checks, and post-deploy verification.
