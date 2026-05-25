# Production Readiness / Bug Polish V1 Smoke Tests

## 1. Manual SQL

Run only if your local DB does not already have these tables/enum values:

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

## 2. Backend start

```bash
cd backend/backend
mvn spring-boot:run
```

Expected:

- server starts on `8031`
- no schema errors
- no CORS bean conflict
- no WebSocket origin errors

## 3. Frontend start

```bash
cd frontend
npm install
npm run dev
```

Expected:

- Vite starts on `5173`
- app can reach `VITE_API_BASE_URL`
- WebSocket uses `VITE_WS_URL`

## 4. Auth

Login:

```http
POST http://localhost:8031/api/auth/login
```

Expected:

- valid user returns `200`
- invalid password returns clean JSON error

Register:

```http
POST http://localhost:8031/api/auth/register
```

Try sending `role: "ADMIN"`.

Expected:

- account is still created as `CITIZEN`

## 5. RBAC

Citizen token:

```http
GET http://localhost:8031/api/admin/export/issues.xlsx
```

Expected:

- `403`

Admin token:

```http
GET http://localhost:8031/api/admin/export/issues.xlsx
```

Expected:

- file downloads

## 6. Dev-only endpoints

With dev profile and admin token:

```http
GET http://localhost:8031/api/dev/role-test/admin
```

Expected:

- works only in `dev` profile

With prod profile:

- endpoint should not exist

## 7. Media URLs

Open:

- citizen map drawer
- citizen My Reports drawer
- public transparency drawer

Expected:

- uploaded images still load
- image URLs are based on `PUBLIC_BASE_URL`

## 8. AI service URL

Run AI preview / duplicate flow.

Expected:

- backend calls `${AI_SERVICE_BASE_URL}/analyze`
- backend calls `${AI_SERVICE_BASE_URL}/duplicate-check`

## 9. Notifications and WebSocket

Trigger:

- new issue
- assignment
- escalation
- feedback

Expected:

- notification appears
- notification bell updates
- clicking notification opens issue/report drawer

## 10. Final end-to-end

Run one full flow:

1. Citizen creates report
2. Admin verifies
3. Admin assigns worker
4. Worker starts work
5. Worker submits closure
6. Admin approves closure
7. Citizen submits feedback
8. Admin/supervisor exports timeline
