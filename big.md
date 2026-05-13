# MaroonLife Repo Context

This file is a high-signal context brief for another LLM working inside this repository. The goal is not to document every file. The goal is to give enough architectural and workflow context that the LLM can generate smaller, task-specific markdown instructions for an implementation agent.

## One-Sentence Summary

`MaroonSchedules` is really a campus app monorepo for `MaroonLife`: an Expo React Native frontend, a FastAPI backend, and two event crawlers that feed campus events into the backend, with TAMU as the main campus and UTD as a secondary campus/events source.

## What The Product Does

The repo is centered on a student-facing mobile app with these major feature areas:

- Campus events discovery and ranking
- Campus map / places / transit / occupancy
- Social feed and friend/network features
- Dining tools like menus, swipes, meal tracking, and optimization
- Course search and schedule generation
- Grades lookup / GPA support
- Annex/library-related flows
- Admin tools for creating and moderating events

The current product identity in code is `MaroonLife`, even though the repo name still says `MaroonSchedules`.

## Top-Level Structure

Ignore the repository name and read the repo like this:

- `Frontend/`: Expo + React Native app
- `Backend/`: FastAPI application and most server-side business logic
- `TamuEventsCrawler/`: TAMU event crawler
- `UtdEventsCrawler/`: UTD event crawler
- `Database/`: small DB-related support area
- `docs/`: support notes, app review notes, ANNEX notes, performance triage
- `assets/`: app icons and launch assets
- `build/`: generated build artifacts, not source of truth
- `node_modules/`, `.expo/`, virtualenv folders: generated/dependency state, not useful for planning

## Entry Points

If an LLM needs to orient fast, these are the first files to read:

- Root README: [README.md](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/README.md)
- Frontend entry: [Frontend/App.tsx](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/Frontend/App.tsx)
- Frontend runtime config: [Frontend/config.ts](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/Frontend/config.ts)
- Backend entry: [Backend/main.py](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/Backend/main.py)
- Backend DB config: [Backend/db_config.py](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/Backend/db_config.py)
- TAMU crawler entry: [TamuEventsCrawler/crawler.py](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/TamuEventsCrawler/crawler.py)
- UTD crawler entry: [UtdEventsCrawler/crawler.py](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/UtdEventsCrawler/crawler.py)
- Backend event ingestion adapter: [Backend/services/campus_events_service.py](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/Backend/services/campus_events_service.py)
- Backend campus aggregation layer: [Backend/services/campus_hub_service.py](/C:/Users/darsh/Downloads/TAMU/Github/MaroonSchedules/Backend/services/campus_hub_service.py)

## Runtime Model

Think of the repo as three connected systems:

1. The Expo app renders the student experience and calls the backend over HTTP.
2. The FastAPI backend owns business logic, persistence, auth checks, campus aggregation, and API shape.
3. The crawlers periodically write normalized event snapshots to JSONL files, and the backend loads those snapshots into its campus event APIs.

The crawlers are not a side experiment. They are part of the app's data pipeline.

## Frontend Architecture

The frontend is a single Expo app configured from the repo root `package.json`, where:

- `main` points to `Frontend/App.tsx`
- `npm run start` runs Expo
- `npm run backend` launches the FastAPI server from the root through the backend directory

### Frontend Stack

- Expo
- React Native
- TypeScript
- React Navigation
- Clerk for auth
- TanStack Query for request caching
- Zustand for local app/session/UI state

### Frontend App Shell

`Frontend/App.tsx` is the real shell. It handles:

- Clerk bootstrapping
- API auth token bridging
- Query client setup and persistence
- Navigation container
- Guest vs signed-in flow
- TOS gating
- name/event-preference onboarding
- admin route branching
- main tab layout

### Main Frontend Domains

The app is not split into tiny feature packages. Most user-facing screens live under `Frontend/components/`.

Important areas:

- `components/events/`: event cards, detail modal, settings, review interception
- `components/places/`: map, place details, bus layers, schedule/map helpers
- `components/dining/`: dining dashboard, menus, swipes, tracking, meal optimizer
- `components/admin/`: admin application and portal flows
- `components/social/` and social-related screens: public profile and social hub
- course and schedule screens at the main component level
- onboarding support in `components/onboarding/`

Supporting frontend folders:

- `Frontend/api/`: API client and request wiring
- `Frontend/services/`: domain services and fetch wrappers
- `Frontend/store/`: Zustand stores
- `Frontend/hooks/`: app hooks
- `Frontend/navigation/`: navigation refs
- `Frontend/utils/`: smaller utilities
- `Frontend/styles/`: global styles

### Frontend Configuration Assumptions

`Frontend/config.ts` is important because the app is designed to:

- read `EXPO_PUBLIC_API_URL`
- adjust localhost/private-IP behavior in development based on Metro host
- use `EXPO_PUBLIC_API_TIMEOUT_MS`
- use `EXPO_PUBLIC_API_KEY`
- use public URLs for support, trip planner, and library services

This means networking bugs are often environment/config bugs rather than UI bugs.

## Backend Architecture

The backend is a FastAPI app with disabled public docs endpoints (`docs_url=None`, `redoc_url=None`, `openapi_url=None`). It loads env vars from:

- repo root `.env` first
- optional `Backend/.env` second

### Backend Core Responsibilities

- Auth enforcement and user ownership checks
- PostgreSQL persistence
- Route-level API composition
- Campus overview aggregation
- Event loading and ranking
- Dining, grades, maps, transit, social, admin, upload, and schedule services
- some Redis-backed caching and snapshot refresh behavior

### Backend Structure

Key folders under `Backend/`:

- `routers/`: HTTP route modules
- `services/`: business/domain logic
- `repositories/`: DB access layer
- `models/`: backend data models
- `auth/`: auth helpers and middleware
- `scripts/`: migrations, sync jobs, and one-off operational tasks
- `tests/`: backend tests
- `Data/`: large local datasets, snapshots, scraped content, and support files
- `static/uploads/`: uploaded media

### Backend Main Route Surface

From `Backend/main.py` and `Backend/routers/*`, the major API areas are:

- `/chat`: social/friend/feed-related APIs live here despite the name
- `/admin`: admin status, applications, tags, club settings, event CRUD/review
- `/campus`: overview, academics, dining account, notifications, events, places, transit, recreation, connectors
- `/annex`: libraries and rentals
- `/clubs`: club listings and join requests
- `/dining`: full-menu, optimize/day, optimize/combo, profile, tracker, swipes, foods, weights, hubs, menus
- `/maps`: search and route
- `/grades`: search and subjects
- `/posts`: posts, likes, reels
- `/upload`: image/file/video upload
- `/traffic`: transit, facility counts, retrieval, event creation, and related APIs

Additionally, `main.py` itself exposes:

- `/health`
- user sync/profile/TOS/tour/account endpoints
- course search/detail endpoints
- term listing
- schedule generation and user schedule CRUD

### Backend Important Services

The two most central aggregation services for high-level context are:

- `campus_hub_service.py`
- `campus_events_service.py`

`campus_hub_service.py` acts like a campus super-aggregator. It combines:

- auth/connector status
- academic snapshot
- dining snapshot
- career snapshot
- campus event snapshot
- recreation occupancy/hours
- place detail resolution
- notification summaries
- service launch links

It also creates/maintains some tables opportunistically in code for social/network/review/reporting-related features.

`campus_events_service.py` is the bridge between crawler output and app-consumable campus events. It:

- reads normalized JSONL output from both crawler directories
- filters to campus-local events
- resolves TAMU places into registry place IDs when possible
- adds categories and relevance scoring
- caches event snapshots

The backend therefore treats crawler output as a local snapshot input, not as live third-party API results.

### Persistence And Infra Assumptions

The backend uses:

- PostgreSQL via `psycopg` and `psycopg_pool`
- Redis support in services like `cache_service`
- Clerk auth
- optional OpenAI integration

DB connection config comes from env vars like:

- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `DB_PORT`

The codebase expects a reachable Postgres instance for many features.

## Event Crawlers

There are two crawlers with shared concepts.

### TAMU Crawler

The TAMU crawler is the more mature one. It includes:

- source registry in `sources.yaml`
- multiple parser types
- normalization
- food detection
- deduplication
- stateful incremental crawling
- raw response caching
- JSONL and CSV summary output

Main subfolders:

- `parsers/`
- `classifiers/`
- `mappers/`
- `data/`
- `output/`

Main pipeline:

1. Load sources from YAML.
2. Fetch source pages/APIs with rate limiting and conditional requests.
3. Parse source-specific payloads.
4. Normalize into a common `Event` model.
5. Score food relevance and classify.
6. Deduplicate.
7. Write `data/normalized/events.jsonl`.

### UTD Crawler

The UTD crawler mirrors the TAMU pattern but is smaller and focused on Localist-based sources:

- `localist_api`
- `localist_directory`
- `localist_html`

It also writes normalized JSONL output for backend consumption.

### Why The Crawlers Matter To The App

The backend's campus event features depend on these files:

- `TamuEventsCrawler/data/normalized/events.jsonl`
- `UtdEventsCrawler/data/normalized/events.jsonl`

If those are missing or stale, event-related app features degrade or return preview/missing states.

## Important Product Domains

If another LLM needs to produce narrower markdown execution specs, these are the main domain boundaries in the repo:

- Events: crawler ingestion, ranking, cards, detail views, admin event creation/review
- Places/Maps: place registry, map snapshot, parking, recreation/library occupancy, bus/transit overlays
- Dining: live dining halls, menu fallback data, swipes, optimization, trackers, weights
- Social: posts, reactions, friends, block/report flows, public profiles
- Courses/Schedules: course search, section details, schedule generation, schedule CRUD
- Grades: backend grades lookup plus frontend grade-distribution screens
- Campus Hub: a stitched overview experience composed from multiple backend services
- Annex: library/rental resources surfaced as a separate feature area
- Admin: admin applications, admin access state, club settings, event moderation

## Environment And Secrets

The root `.env.example` shows the frontend-facing variables. In practice, the repo uses the root `.env` as the main shared source of truth.

Common env concerns:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_KEY`
- DB credentials for FastAPI
- Clerk server secrets in backend env
- Redis config if used
- `OPENAI_API_KEY` for AI-specific backend features
- dining/third-party API keys where relevant

The backend also has a lightweight `openai_service.py` that calls the OpenAI SDK directly.

## Generated, Large, Or Low-Signal Areas

Another LLM should usually avoid over-indexing on these unless the task specifically points there:

- `build/`: generated app build output
- `node_modules/`
- `.expo/`
- `.venv`, `.venvwebapp`
- huge data snapshots under `Backend/Data/`
- crawler output CSVs and raw normalized snapshots unless the task is data/crawler-specific
- one-off scratch/debug scripts unless the user points to them

These directories may be useful operationally, but they are not the best source of architecture truth.

## Testing And Operational Reality

This repo mixes app code, backend code, data snapshots, migrations, and one-off verification scripts. Expect:

- a partially app-like monorepo
- some production logic living in services
- some schema/table bootstrapping happening in code
- some operational scripts being essential for setup
- some incomplete or evolving boundaries between modules

That is normal for this repo. A future LLM should optimize for practical execution over over-clean architecture assumptions.

## High-Signal Commands

Useful mental model for common runs:

```bash
# Frontend
npm start

# Backend
cd Backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# TAMU crawler
cd TamuEventsCrawler
python crawler.py crawl --all

# UTD crawler
cd UtdEventsCrawler
python crawler.py crawl
```

There is also a root `npm run backend` helper wired in `package.json`.

## How Another LLM Should Use This Repo Context

When generating another markdown task file for an execution agent, it should:

- name the target surface first: `Frontend`, `Backend`, `TamuEventsCrawler`, `UtdEventsCrawler`, or cross-cutting
- state whether the task is product/UI work, API work, data-pipeline work, or infra/setup work
- mention any expected env/runtime prerequisites
- call out the likely source-of-truth files instead of broad folder scans
- say whether generated/build/data directories should be ignored
- identify whether the change is TAMU-specific, UTD-specific, or campus-agnostic
- note if the task likely touches auth, DB schema, crawler outputs, or cached snapshots

## Suggested Repo Mental Model

If a future LLM needs a compact framing, use this:

`MaroonLife` is a campus-app monorepo where the frontend is an Expo mobile app, the backend is a FastAPI API and aggregation layer, and the crawlers are first-class data producers for the events experience.

## Current Observations

- The root README is minimal and no longer reflects the full product scope.
- The backend route surface is much broader than "schedule generation."
- The frontend has grown into a multi-domain campus super-app.
- TAMU support is the primary experience; UTD is present mainly through the events pipeline.
- Some repo areas are generated or data-heavy, so task instructions should point execution agents toward the live source files rather than the largest directories.
