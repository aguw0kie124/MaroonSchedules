# UI/UX Redesign Plan

For this app, the guiding mental model should be:

**Morning briefing first, map second, details on demand.**

That fits the product better than a generic campus dashboard.

## What to optimize for

A student should open the app and immediately see:

- their next class
- the nearest dining hall and live menu
- transit and map access

Everything else should be secondary, discoverable, and easy to collapse.

## How to streamline it

### 1. Make the home page a summary surface

- Keep `Howdy, [name]` at the top.
- Under it, show one strong hero card:
  - `Next class`
  - `Nearest dining hall`
  - `Live dining preview`
- Keep the daily schedule visible on the home page as a compact, scan-friendly block.
- Then add 2 or 3 compact supporting cards:
  - `Alerts`
  - `Transit`
  - `Notes`
- Avoid a long feed of many equal-weight cards.

### 2. Use one primary action per screen

- Home: `Open map` or `View menu`
- Map: `Directions`, `Menu`, `Reviews`
- Dining sheet: `Full menu`
- Bus sheet: `All routes`
- If a card has 3 buttons, it is probably too busy.

### 3. Prefer bottom sheets over new pages

This is where Uber and Google Maps feel so good.

Use sheets for:

- place details
- dining menus
- bus routes
- reviews

Keep the map visible underneath whenever possible.

Avoid forcing users into full-screen detail pages unless they need a deeper interaction.

### 4. Make the map the detail workspace

The map should be the place where users act, not just browse.

On the map, show:

- one top search bar
- one row of category pills
- one compact sheet

Do not stack too many controls on the map.

No duplicate search bars, no giant dropdowns, no oversized route widgets.

### 5. Normalize the card language across the app

Use the same visual grammar everywhere:

- title
- subtitle
- small metadata line
- one or two actions

Keep styles consistent:

- similar corner radius
- similar padding
- similar elevation
- similar spacing between sections

That makes the app feel robust instead of assembled.

### 6. Flatten the visuals a bit

The current UI uses too many rounded containers.

Move toward:

- smaller radius, around `12-18`
- fewer nested panels
- cleaner dividers
- more typography hierarchy

Save strong rounding for sheets, chips, and the most important hero surfaces.

### 7. Show density only when needed

Use a compact default state.

Expand on swipe, tap, or drill-down.

Examples:

- dining preview starts as 2-3 items
- reviews start as 2-3 recent comments
- bus starts with current route only

This keeps the UI calm and fast.

### 8. Make search global and universal

One search bar should do most of the work.

It should search:

- places
- buildings
- dining halls
- buses

Special-purpose search bars inside sub-tabs usually create friction.

### 9. Turn the app into a now tool

On home, prioritize what matters in the next 30 minutes:

- next class
- menu at closest hall
- live bus status

On map, prioritize what is nearby.

On detail sheets, prioritize action over information.

### 10. Design for trust and speed

Show loading states that feel intentional.

Cache aggressively where it helps, but refresh in the background when appropriate.

If data is stale, tell the user clearly.

Keep the app usable even when one data source is slow.

## A good structure for this app

- `Home` = Today summary
- `Map` = Explore plus actions
- `Profile/Settings` = preferences, schedule, saved items

## If simplifying the entire UI

- Home becomes a polished briefing page.
- Places becomes the main exploration surface.
- Reviews, dining, buses, and schedules all live as layered sheets on top of the map.
- Full pages are reserved for deeper tasks like full dining menus or timetable detail.

## The end goal

- fewer screens
- fewer duplicate controls
- more visible next steps
- less visual noise
- more confidence that the app will tell a student exactly what they need, fast
