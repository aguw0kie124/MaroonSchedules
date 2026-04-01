# The Annex Integration

The Annex is now an internal library-services hub backed by Texas A&M Libraries' public LibCal surfaces.

## What it does

- `Libraries` lists searchable TAMU library locations inside the app.
- Library detail screens show room groups, booking rules, eligibility messaging, and an embedded live LibCal availability grid.
- `Rentals` lists public equipment categories and location groupings inside the app.
- Rental detail screens show native catalog metadata when LibCal exposes it, then continue the checkout flow inside an embedded vendor page.

## Environment

Backend:

- `TAMU_LIBCAL_SEARCH_URL`
- `TAMU_LIBCAL_EQUIPMENT_URL`
- `TAMU_LIBCAL_ITEM_PAGE_ROOT`
- `TAMU_LIBCAL_CATEGORY_ENDPOINT`

Frontend:

- `EXPO_PUBLIC_TAMU_LIBCAL_SEARCH_URL`
- `EXPO_PUBLIC_TAMU_LIBCAL_EQUIPMENT_URL`
- `EXPO_PUBLIC_AGGIESPIRIT_TRIP_PLANNER_URL`

## Booking model

- Direct room or equipment submission is only used when the official vendor surface supports it.
- When LibCal only exposes public browsing or live booking grids, the app keeps users inside an internal screen and shows an honest embedded handoff instead of pretending the reservation succeeded.

## Verification

- `cd Frontend && npx tsc --noEmit`
- `python3 -m unittest Backend.tests.test_annex_service`
