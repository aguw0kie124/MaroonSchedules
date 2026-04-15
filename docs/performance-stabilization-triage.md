# Performance Stabilization Triage

## Goal

This document captures the highest-signal stability and performance risks currently visible in the app, with emphasis on:

- map crashes and instability
- stale or inconsistent ping/feed loading
- overall slowness caused by overlapping caching, polling, and expensive screen orchestration

It is meant to be a stabilization guide, not a full architecture rewrite.

## Executive Summary

The current issues do not look random. The app has several structural patterns that naturally produce the reported symptoms:

- very large stateful screens with too many responsibilities
- overlapping refresh layers on both frontend and backend
- multiple caches with different freshness rules
- expensive client-side remapping/sorting on frequently refreshed screens
- map camera and marker work mixed with polling-heavy data sources

The biggest risk area is `PlacesMapScreen`, followed by feed freshness and ping loading.

## Severity Ranking

### 1. Map screen overload

Severity: Critical

The map screen is acting as a giant orchestrator for:

- pulse map data
- bus state
- schedules
- search
- reviews
- dining previews
- user location watching
- camera control
- hotspot selection

Relevant file:

- [Frontend/components/PlacesMapScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/PlacesMapScreen.tsx:1)

Why this matters:

- `react-native-maps` screens become fragile when they own too much state and too many rerender triggers.
- This screen is especially vulnerable because map camera mutations, marker changes, polling, and location updates all converge in one component.

Likely symptom contribution:

- random map crashes
- dropped frames
- hitching when switching layers
- unstable selection state

### 2. Pulse map over-fetching and cache bypass

Severity: Critical

The pulse layer is fetched through React Query with a `15s` refetch interval:

- [Frontend/components/PlacesMapScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/PlacesMapScreen.tsx:330)

But the query function also forces the pulse cache to be bypassed:

- [Frontend/components/PlacesMapScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/PlacesMapScreen.tsx:333)
- [Frontend/services/campusPulse.ts](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/services/campusPulse.ts:180)

There is then additional forced invalidation/refetch on focus/layer changes:

- [Frontend/components/PlacesMapScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/PlacesMapScreen.tsx:1253)

Why this matters:

- The app pays for refresh, transformation, and rerender costs repeatedly even though a client cache already exists.
- This is especially expensive on a map where hotspot arrays and markers are UI-critical.

Likely symptom contribution:

- map instability
- unnecessary network traffic
- hot battery use
- sluggish transitions into Pulse

### 3. Ping screen refresh overlap

Severity: High

The ping feed is polled every `15s`:

- [Frontend/components/CampusPingsScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/CampusPingsScreen.tsx:456)

It is also manually refetched on mount and refresh:

- [Frontend/components/CampusPingsScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/CampusPingsScreen.tsx:542)

The featured section on that screen also fetches separately:

- [Frontend/components/CampusPingsScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/CampusPingsScreen.tsx:400)

Why this matters:

- Polling plus manual refetch plus downstream sorting/mapping multiplies work.
- On slower devices this makes the screen feel jittery and inconsistent.

Likely symptom contribution:

- overall slowness on the social tab
- intermittent loading weirdness
- more frequent visible list reshuffles

### 4. Feed freshness is spread across too many caching layers

Severity: High

The backend chat feed endpoint maintains a 60-second backbone cache of raw feed rows:

- [Backend/chat.py](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Backend/chat.py:149)

The frontend also has:

- React Query stale times
- polling
- local pulse cache
- ad hoc refreshes

Why this matters:

- When freshness rules are split across several layers, the app can feel stale even if each individual layer is technically working as designed.
- Debugging becomes difficult because users are seeing a composed result, not one source of truth.

Likely symptom contribution:

- posts appearing older than expected
- one screen showing fresher data than another
- “I posted but don’t see it immediately” complaints

### 5. Pings feed includes mixed content types by design

Severity: High

The `campus_pings` feed backend currently requests both `ping` and `post` types:

- [Backend/chat.py](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Backend/chat.py:162)

Specifically:

- `campus_pings` uses `['ping', 'post']`

Why this matters:

- If the product expectation is “show current pings,” mixing in older generic posts can make the feed appear stale or off-topic.
- Even if ordered correctly by `created_at`, older posts can still crowd the result set and visually dilute freshness.

Likely symptom contribution:

- “defaulting to some from days ago”
- feed content not matching user expectation for live pings

### 6. Response-shape inconsistency risk on featured events fetch

Severity: Medium

The pings screen featured-events fetch assumes the response is directly an array:

- [Frontend/components/CampusPingsScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/CampusPingsScreen.tsx:406)

It does:

- `return (data || []).map(...)`

Elsewhere, campus event endpoints in the app often behave as object payloads with nested arrays.

Why this matters:

- Even if this works against one backend shape today, the code is brittle.
- Small backend changes can silently break or empty the featured section.

Likely symptom contribution:

- inconsistent featured content
- broken or partially loaded social screen sections

### 7. Expensive client-side remapping and sorting on hot screens

Severity: Medium

The pings screen remaps and sorts feed content on every refresh:

- [Frontend/components/CampusPingsScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/CampusPingsScreen.tsx:518)

The map screen also rebuilds merged location lists and hotspot place mappings frequently:

- [Frontend/components/PlacesMapScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/PlacesMapScreen.tsx:347)

Why this matters:

- This may be okay at small scale, but it becomes noticeable when stacked with polling and map rendering.

Likely symptom contribution:

- scroll hitching
- slow screen readiness after fetch

### 8. Location watch and camera control increase map churn

Severity: Medium

The map screen keeps a foreground location watcher alive:

- [Frontend/components/PlacesMapScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/PlacesMapScreen.tsx:1672)

It also stores and updates camera state on region change complete:

- [Frontend/components/PlacesMapScreen.tsx](/Users/siddharth.exe/Documents/untitled folder/MaroonSchedules/Frontend/components/PlacesMapScreen.tsx:1996)

Why this matters:

- These are reasonable features independently.
- Combined with dynamic markers, hotspot polling, and camera animations, they add map churn and increase the chance of edge-case instability.

Likely symptom contribution:

- random-feeling map behavior
- extra work during interaction-heavy sessions

## Root Cause Themes

The issues above cluster into four broader causes:

### 1. Screen orchestration is too centralized

The map screen has become an application shell inside a single component.

### 2. Freshness strategy is fragmented

The app currently uses:

- backend cache
- frontend in-memory cache
- React Query stale time
- polling
- focus refresh
- manual refresh

Without one clear freshness contract, users see inconsistencies.

### 3. Polling is being used where event-driven invalidation should do more work

Polling exists, but invalidation is also present. The app is often doing both.

### 4. Product semantics are blurred in the feed layer

“Ping” does not appear to cleanly mean “live ping only” at the backend query level.

## Recommended Repair Order

### Phase 1: Stabilize

Time horizon: immediate

1. Reduce Pulse polling pressure.
   Keep one refresh strategy. Prefer React Query with a less aggressive interval and remove redundant forced invalidation paths where possible.

2. Stop bypassing the local pulse cache on every query.
   Reserve `force: true` for intentional refreshes, not the steady-state path.

3. Decide whether `campus_pings` should include only `ping` content.
   If not, rename the product surface so the behavior matches the name.

4. Make the featured-events fetch resilient to backend response shape.
   Parse both object and array forms explicitly.

5. Add crash logging and timing instrumentation around map refresh cycles.
   Without this, stabilization will stay guess-driven.

### Phase 2: Simplify hot paths

Time horizon: short-term

1. Extract Pulse map state from `PlacesMapScreen` into a dedicated container with a narrow interface.

2. Separate camera logic from data-fetch logic.

3. Move heavy derived transforms closer to the backend or memoize them behind clearer boundaries.

4. Audit all polling intervals across social/map screens and normalize them.

### Phase 3: Redesign freshness model

Time horizon: medium-term

1. Define one source of truth for feed freshness.

2. Decide where caching belongs:
   backend-only for shared feeds, or frontend-only for session responsiveness, but not several overlapping systems without a clear reason.

3. Prefer mutation-triggered invalidation after post/create/delete/vote actions over constant polling.

## Suggested First Week Fixes

If the goal is visible improvement fast, I would do these first:

1. Change `campus_pings` backend query to return only pings if that matches product intent.
2. Remove forced pulse cache bypass in the steady-state Places query path.
3. Relax Pulse polling from `15s` to something less aggressive while measuring impact.
4. Fix the featured-events parser on `CampusPingsScreen`.
5. Add lightweight performance logging around:
   - pulse fetch duration
   - hotspot transform duration
   - map render count
   - ping feed fetch duration

## Suggested Metrics To Capture

Before large refactors, add logging for:

- map screen mount time
- time to first pulse hotspot render
- number of pulse hotspots returned
- number of rerenders during pulse refresh
- ping feed fetch time
- age distribution of items in `campus_pings`
- crash frequency by active map layer

## Open Questions

These should be answered before deeper changes:

1. Is `campus_pings` intended to show only live pings, or also generic social posts?
2. Is the map crash reproducible on one layer more than others: Pulse, Bus, Today, Dining?
3. Are stale feed complaints coming from one user cohort only, which would suggest access filtering or user-specific cache behavior?
4. Is the current backend cache required for cost reasons, or is it mostly a convenience layer?

## Bottom Line

The app does appear to have real performance and stability debt. The strongest conclusion is not “there are lots of small random bugs.” It is:

- the map experience is over-centralized and over-refreshed
- feed freshness rules are too fragmented
- social/pulse semantics are not clean enough

That is fixable, but it needs a stabilization pass before more feature growth.
