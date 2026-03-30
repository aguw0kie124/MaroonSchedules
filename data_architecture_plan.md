# Data Architecture Plan

For this app, the guiding data principle should be:

**Ingest once, normalize once, present many times.**

That is how products like Robinhood feel fast, clean, and trustworthy. The UI stays simple because the data layer is disciplined.

## What to optimize for

A student should open the app and quickly get:

- the right data
- in a trustworthy state
- with minimal loading friction
- in a clean, derived format that the UI can present directly

The app should avoid making every screen fetch and reshape its own data independently.

## How to streamline it

### 1. Separate data by type

Do not treat all app data the same.

Use these buckets:

- `static reference data`
  - buildings
  - dining halls
  - bus routes
  - class metadata
- `slow-changing user data`
  - schedules
  - preferences
  - saved items
- `live operational data`
  - buses
  - dining menus
  - occupancy
  - alerts
  - events

Each category should have different ingestion, cache, and refresh rules.

### 2. Create a normalized domain layer

Every data source should be converted into stable app entities before the UI sees it.

Core entities should include:

- `Location`
- `Schedule`
- `CourseMeeting`
- `DiningMenu`
- `DiningCategory`
- `TransitRoute`
- `TransitVehicle`
- `TransitStop`
- `Event`
- `Notification`
- `HomeSummary`

The app should not pass raw vendor payloads directly into components.

### 3. Build a clear pipeline

Every important data flow should look like:

- `ingest`
  - fetch from backend or third-party API
- `normalize`
  - convert into internal entity shape
- `cache`
  - store with freshness metadata
- `derive`
  - compute UI-ready insights
- `present`
  - components render prepared view models

This keeps transformation logic out of screens and reduces duplication.

### 4. Use freshness tiers

Not all data needs the same TTL.

Recommended tiers:

- `static`
  - cache for days or weeks
- `semi-live`
  - cache for minutes or hours
- `live`
  - poll every few seconds
- `session`
  - fetch once per app open or screen focus
- `derived`
  - compute locally from canonical state

Suggested mapping for this app:

- buildings and route metadata: `static`
- schedules and preferences: `session`
- events and dining menus: `semi-live`
- buses and occupancy: `live`
- home summary: `derived`

### 5. Build one home summary aggregator

Home should not assemble many unrelated fetches inside the screen component.

Create a single summary model like:

- `nextClass`
- `todaySchedule`
- `nearestDiningHall`
- `menuPreview`
- `liveTransitStatus`
- `spotlightEvents`
- `urgentAlerts`

This should be produced by one selector or one backend/mobile summary endpoint, not by ad hoc UI logic.

### 6. Move transformation out of UI components

UI components should not decide:

- what counts as the next class
- which hall is nearest
- how route results are ranked
- what occupancy label to show
- how menus are grouped
- how schedules are filtered for a day

That belongs in:

- `services/`
- `selectors/`
- `stores/`
- `view models`

Components should mostly render.

### 7. Add source-aware records

Every live data object should carry metadata:

- `source`
- `status`
- `fetchedAt`
- `staleAt`
- `error`

Example:

```ts
type SourceRecord<T> = {
  data: T | null;
  source: string;
  status: 'idle' | 'loading' | 'fresh' | 'stale' | 'error';
  fetchedAt: number | null;
  staleAt: number | null;
  error?: string | null;
};
```

This makes it possible to present trustworthy live data instead of mysterious blank states.

### 8. Present last known good data first

The app should not blank major surfaces while waiting for live data.

Recommended behavior:

- show cached data immediately if available
- refresh in the background
- mark stale states clearly
- only show full empty states when there is truly no usable data

Examples:

- show last dining menu while refreshing
- show last bus positions with timestamps
- show cached home summary while hydrating

### 9. Store entities in indexed form

Canonical app state should be stored as indexes, not duplicated arrays.

Examples:

- `locationsById`
- `routesById`
- `stopsById`
- `vehiclesById`
- `eventsById`
- `schedulesById`

Then derive sorted or filtered arrays with selectors.

This improves consistency and reduces repeated transformation work.

### 10. Add backend aggregation where it helps

Some data should be prepared server-side instead of forcing mobile to compute everything.

Best candidates:

- `home summary`
- `dining preview summary`
- `nearest live transit snapshot`
- `event spotlight payload`
- `occupancy summary`

Mobile should receive compact, purposeful payloads for its most-used surfaces.

### 11. Use source adapters and validation

Third-party and backend payloads will drift over time.

Add:

- schema validation
- source adapters
- fallback defaults

Recommended adapters:

- `DineOnCampusAdapter`
- `TransitAdapter`
- `EventsAdapter`
- `AcademicScheduleAdapter`

Each should output internal models, not provider-specific data.

### 12. Build card-level data contracts

Each major module should receive a narrow presentation-ready object.

Examples:

- `NextClassCardData`
- `TodayScheduleSectionData`
- `DiningPreviewCardData`
- `TransitStatusCardData`
- `SpotlightEventsData`
- `PlaceListItemData`

This keeps the UI clean and reduces screen-level logic.

## A good structure for this app

Frontend:

- `services/`
  - raw fetching
- `models/` or `entities/`
  - canonical types
- `store/`
  - normalized cached state
- `selectors/`
  - derived app logic
- `viewModels/`
  - screen or card contracts

Backend:

- ingestion jobs
- source adapters
- normalized tables or cached payloads
- TTL-aware refresh
- summary endpoints for mobile

## If simplifying the whole data layer

- The backend becomes the source-normalizer where it adds the most value.
- The frontend becomes a consumer of stable app entities, not raw feeds.
- Home reads from one summary model.
- Map reads from normalized locations, transit, and dining entities.
- Dining, schedules, transit, and events all share freshness metadata and predictable cache behavior.

## The end goal

- fewer duplicate fetches
- fewer ad hoc transforms in screens
- faster perceived load times
- cleaner live-data behavior
- clearer stale/error states
- more trustworthy presentation
- easier future scaling

## Recommended next implementation steps

### Phase 1: Normalize and model

- define canonical entity types for:
  - locations
  - schedules
  - dining menus
  - transit
  - events
  - notifications
- add source metadata wrappers for live data

### Phase 2: Centralize derivation

- create selectors for:
  - `nextClass`
  - `todaySchedule`
  - `nearestDiningHall`
  - `menuPreview`
  - `liveTransitStatus`
  - `spotlightEvents`

### Phase 3: Reduce screen logic

- move transformation out of:
  - `Dashboard.tsx`
  - `PlacesMapScreen.tsx`
  - dining screens
  - transit screens

### Phase 4: Improve freshness handling

- add TTL rules by domain
- add last-known-good behavior
- add stale/live/error indicators

### Phase 5: Add backend summary endpoints

- `GET /home/summary`
- `GET /dining/preview`
- `GET /transit/summary`
- `GET /events/spotlight`

These should serve mobile-first payloads, not raw feed dumps.
