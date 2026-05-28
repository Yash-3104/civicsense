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

## 4. Auth and routes

- Landing page opens
- `/login` and `/register` fit the viewport on desktop and mobile
- Role redirects work after login
- Register always creates `CITIZEN`, even if a role is sent manually

API check:

```http
POST http://localhost:8031/api/auth/register
```

Try sending `role: "ADMIN"`.

Expected:

- account is still created as `CITIZEN`

## 5. Citizen

- Create issue with image
- AI preview/analysis works
- My Reports shows the original report image for unresolved issues
- Resolved reports show before/after evidence
- Citizen can submit feedback after resolution

## 6. Admin

- Verify issue
- Assign worker
- Delete requires typed `DELETE` confirmation
- Export current view
- XLSX export works
- Timeline export works

API check:

```http
GET http://localhost:8031/api/admin/export/issues.xlsx
```

Expected:

- citizen token returns `403`
- admin token downloads the file

## 7. Worker

- Assigned task appears
- Worker can start assigned task
- Worker can submit closure evidence
- Closure moves to admin review instead of final public closure

## 8. Supervisor

- Mapped department tasks only
- Mapped new issue notification appears
- Supervisor note works
- Exports work
- Supervisor cannot see unmapped department data

## 9. Notifications and WebSocket

Trigger:

- new issue
- assignment
- escalation
- closure submission
- feedback

Expected:

- WebSocket live status works
- notification appears
- notification bell updates
- clicking notification opens the correct drawer
- mark read works
- mark all read works
- clear read works

## 10. Public transparency

- Public page works without login
- Public issue drawer image works
- Private citizen feedback is not exposed
- Private admin or supervisor notes are not exposed
- Public view shows safe progress only

## 11. Image storage

- Local mode works with `STORAGE_PROVIDER=local`
- Cloudinary mode works with `STORAGE_PROVIDER=cloudinary`
- Old local images still resolve
- Cloudinary images load from `secure_url`
- AI/Kafka `filePath` still works while Cloudinary mode keeps local temp files
- Uploaded report and closure evidence reject non-image files

## 12. AI service URL

Run AI preview / duplicate flow.

Expected:

- backend calls `${AI_SERVICE_BASE_URL}/analyze`
- backend calls `${AI_SERVICE_BASE_URL}/duplicate-check`

## 13. Dev-only endpoints

With dev profile and admin token:

```http
GET http://localhost:8031/api/dev/role-test/admin
```

Expected:

- works only in `dev` profile

With prod profile:

- endpoint should not exist

## 14. Security smoke

- Citizen cannot access admin endpoints
- Citizen cannot delete reports through the API
- Supervisor cannot access unmapped department data
- `/api/dev/**` is dev-only/admin-protected
- CORS allowed origins are explicit when credentials are enabled
- No real secrets are committed

## 15. Final end-to-end

Run one full flow:

1. Citizen creates report
2. Admin verifies
3. Admin assigns worker
4. Worker starts work
5. Worker submits closure
6. Admin approves closure
7. Citizen submits feedback
8. Admin/supervisor exports timeline
