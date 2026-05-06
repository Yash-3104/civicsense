# CivicSense Agent Instructions

## Project Overview

CivicSense is an AI-powered civic issue reporting platform.

The product lets citizens report civic issues on a map, upload images, and track issue status. The backend supports geo queries, media upload, AI analysis, and Kafka-based async processing.

## Repository Structure

Important folders:

- `frontend/` — React + Vite frontend
- `backend/backend/` — Spring Boot backend
- `ai-service/` — FastAPI AI service
- `database/` — SQL migrations and seed data
- `docs/` — project documentation
- `.agents/skills/uncodixify/` — UI design skill for avoiding generic AI-looking UI

## Frontend Stack

Use existing stack:

- React + Vite
- JavaScript
- Tailwind CSS
- shadcn/ui
- React Router
- Zustand
- Axios
- TanStack Query where already introduced
- React Leaflet

Do not add new frontend dependencies unless the user explicitly asks.

## Backend Stack

Use existing stack:

- Spring Boot
- PostgreSQL
- JWT auth
- role-based access
- Kafka producer/consumer
- FastAPI AI service integration

Do not change backend endpoint contracts without explaining the frontend impact.

## Required UI Skill

When editing frontend UI, use `$uncodixify`.

This applies especially to:

- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/components/**`
- Tailwind/shadcn UI changes
- React Leaflet map UI
- dashboard layout
- forms
- filters
- tables
- cards
- dark mode
- image upload UI

If a user asks for:
- senior UI
- SaaS-level UI
- polished UI
- better dashboard
- less AI-generated UI
- less Codex-like UI
- cleaner layout
- design refinement

then invoke `$uncodixify` before editing.

## UI Direction

CivicSense UI should feel:

- practical
- calm
- clean
- human-designed
- internal-tool quality
- map-first
- workflow-focused

Avoid generic AI UI:

- no glassmorphism
- no decorative gradients
- no oversized rounded cards
- no hero sections inside dashboards
- no fake charts
- no random metric-card grids
- no decorative SaaS copy
- no glow/shadow-heavy dark mode
- no pill overload
- no transform animations

Prefer:

- compact header
- clear working surfaces
- map-first layout
- simple panels
- simple filters
- useful tables/lists
- clear forms
- restrained colors
- 8–12px border radius
- subtle borders
- minimal shadows

## Dashboard Behavior Must Stay Intact

When editing `Dashboard.jsx`, preserve:

- logout behavior
- dark mode toggle and localStorage persistence
- nearby issue fetch:
  - `GET /api/issues/nearby?lat={lat}&lng={lng}&radius=5`
- create issue:
  - `POST /api/issues`
- delete issue:
  - `DELETE /api/issues/{id}`
- frontend filters
- map movement behavior
- map click-to-create behavior
- marker rendering
- Leaflet marker icon fix
- zoom control placement
- create issue panel
- issue popup delete action

Do not create issues until the user clicks Submit.

Do not open create issue form when clicking:
- marker icons
- popups
- map controls

## Backend Safety

Never commit or expose:

- `.env`
- credentials
- JWT secrets
- DB passwords
- uploaded files in `uploads/`
- Python virtual environments
- Maven `target/`

If touching auth, JWT, CORS, or security config, explain what changed and how to test it.

## Git Hygiene

Respect `.gitignore`.

Do not commit:

- `ai-service/venv/`
- `__pycache__/`
- `*.pyc`
- `uploads/`
- `target/`
- `.env`
- IDE folders

## Testing Expectations

After frontend changes, suggest:

```bash
cd frontend
npm run dev
