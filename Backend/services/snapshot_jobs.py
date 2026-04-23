from __future__ import annotations

import asyncio
import os
from datetime import datetime
from typing import Awaitable, Callable, Iterable

from routers import traffic
from services import cache_service
from services import campus_events_service, campus_hub_service, campus_places_service, dining_service


SNAPSHOT_JOBS_ENABLED = os.environ.get("SNAPSHOT_JOBS_ENABLED", "true").strip().lower() not in {"0", "false", "no"}
PLACES_REFRESH_SECONDS = max(15, int(os.environ.get("PLACES_REFRESH_SECONDS", "45")))
EVENTS_REFRESH_SECONDS = max(60, int(os.environ.get("EVENTS_REFRESH_SECONDS", "300")))
RECREATION_REFRESH_SECONDS = max(30, int(os.environ.get("RECREATION_REFRESH_SECONDS", "120")))
TRANSIT_REFRESH_SECONDS = max(15, int(os.environ.get("TRANSIT_REFRESH_SECONDS", "60")))
TRANSIT_VEHICLES_REFRESH_SECONDS = max(5, int(os.environ.get("TRANSIT_VEHICLES_REFRESH_SECONDS", "15")))
DINING_REFRESH_SECONDS = max(60, int(os.environ.get("DINING_REFRESH_SECONDS", "300")))
PLACE_DETAILS_REFRESH_SECONDS = max(30, int(os.environ.get("PLACE_DETAILS_REFRESH_SECONDS", "90")))
PLACE_DETAILS_WARM_LIMIT = max(6, int(os.environ.get("PLACE_DETAILS_WARM_LIMIT", "18")))

_TaskFactory = Callable[[], Awaitable[None]]


def _log(message: str) -> None:
    print(f"[snapshot_jobs] {message}")


def _rebuild_in_place(
    cache_key: str,
    builder: Callable[[], object],
    ttl_seconds: int = 300,
    *,
    write_cache: bool = True,
) -> object:
    data = builder()
    if write_cache and data:
        cache_service.set_json(cache_key, data, ttl_seconds=ttl_seconds)
    return data


async def _run_sync(name: str, fn: Callable[[], object]) -> None:
    started_at = datetime.utcnow()
    try:
        await asyncio.to_thread(fn)
        elapsed_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
        _log(f"refreshed {name} in {elapsed_ms}ms")
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        _log(f"refresh failed for {name}: {exc}")


def _refresh_places() -> object:
    return _rebuild_in_place(
        f"campus:places:map:{campus_places_service.PLACE_SNAPSHOT_CACHE_VERSION}",
        campus_places_service.get_places_map_snapshot,
        ttl_seconds=campus_places_service.PLACE_SNAPSHOT_TTL_SECONDS,
        write_cache=False,
    )

def _refresh_events() -> object:
    return campus_events_service.load_campus_events(force_refresh=True)


def _refresh_recreation() -> object:
    return _rebuild_in_place(
        "campus:recreation:snapshot:v1",
        campus_hub_service.get_recreation_snapshot,
        ttl_seconds=campus_hub_service.RECREATION_SNAPSHOT_TTL_SECONDS,
        write_cache=False,
    )


def _refresh_transit_routes() -> object:
    cache_key = "traffic:transit:routes:v3"

    def build() -> dict[str, object]:
        return {
            "routes": traffic.transit_proxy.get_routes(),
            "activeRouteIds": traffic.transit_proxy.get_active_routes(),
        }

    return _rebuild_in_place(cache_key, build, ttl_seconds=300)


def _refresh_transit_route_patterns() -> object:
    active_route_ids = traffic.transit_proxy.get_active_routes() or []
    cache_keys = {
        route_id: f"traffic:transit:route:v2:{route_id}"
        for route_id in active_route_ids
    }
    cached_patterns = cache_service.get_json_many(list(cache_keys.values()))
    warmed_count = 0

    for route_id in active_route_ids:
        cache_key = cache_keys[route_id]
        if cached_patterns.get(cache_key) is not None:
            continue
        _rebuild_in_place(cache_key, lambda route_id=route_id: traffic.transit_proxy.get_pattern(route_id), ttl_seconds=3600)
        warmed_count += 1

    return {
        "routeCount": len(active_route_ids),
        "warmedCount": warmed_count,
        "cachedCount": max(0, len(active_route_ids) - warmed_count),
    }


def _refresh_transit_vehicles() -> object:
    return _rebuild_in_place(
        "traffic:transit:vehicles:v2:__all__",
        lambda: traffic.transit_proxy.get_vehicles(""),
        ttl_seconds=60,
        write_cache=False,
    )


def _refresh_dining() -> object:
    today = datetime.now().strftime("%Y-%m-%d")
    locations: Iterable[str] = (
        "Sbisa Dining Hall (North Campus)",
        "The Commons Dining Hall (South Campus)",
        "Duncan Dining Hall (South Campus/Quad)",
    )
    periods = ("breakfast", "lunch", "dinner")

    for location in locations:
        for period in periods:
            cache_key = f"dining:full-menu:v1:{location.lower()}:{period}:{today}"
            _rebuild_in_place(
                cache_key,
                lambda location=location, period=period: dining_service.get_full_menu(
                    location_name=location,
                    meal_period=period,
                    date_str=today,
                ),
                ttl_seconds=dining_service._menu_success_ttl_seconds(today),
                write_cache=False,
            )
    return {"locations": list(locations), "periods": list(periods)}


def _place_ids_to_warm() -> list[str]:
    snapshot = campus_places_service.get_places_map_snapshot()
    locations = snapshot.get("locations", [])
    prioritized = sorted(
        locations,
        key=lambda location: (
            0 if location.get("type") in {"Rec", "Library", "Dining", "Hub"} else 1,
            -(int(location.get("percent_full") or 0)),
            location.get("location") or "",
        ),
    )
    place_ids: list[str] = []
    for location in prioritized:
        place_id = location.get("placeId")
        if place_id and place_id not in place_ids:
            place_ids.append(place_id)
        if len(place_ids) >= PLACE_DETAILS_WARM_LIMIT:
            break
    return place_ids


def _refresh_place_details() -> object:
    warmed = []
    for place_id in _place_ids_to_warm():
        cache_key = f"campus:place-detail:{campus_hub_service.PLACE_DETAIL_CACHE_VERSION}:{place_id}"
        _rebuild_in_place(
            cache_key,
            lambda place_id=place_id: campus_hub_service.get_place_detail_snapshot(place_id),
            ttl_seconds=60,
            write_cache=False,
        )
        warmed.append(place_id)
    return {"placeIds": warmed}


async def _run_periodic(name: str, interval_seconds: int, fn: Callable[[], object]) -> None:
    await _run_sync(name, fn)
    while True:
        await asyncio.sleep(interval_seconds)
        await _run_sync(name, fn)


def _job_specs() -> list[tuple[str, int, Callable[[], object]]]:
    return [
        ("places", PLACES_REFRESH_SECONDS, _refresh_places),
        ("recreation", RECREATION_REFRESH_SECONDS, _refresh_recreation),
        ("transit-routes", TRANSIT_REFRESH_SECONDS, _refresh_transit_routes),
        ("transit-patterns", TRANSIT_REFRESH_SECONDS, _refresh_transit_route_patterns),
        ("transit-vehicles", TRANSIT_VEHICLES_REFRESH_SECONDS, _refresh_transit_vehicles),
        ("dining", DINING_REFRESH_SECONDS, _refresh_dining),
        ("place-details", PLACE_DETAILS_REFRESH_SECONDS, _refresh_place_details),
    ]


async def start_snapshot_jobs() -> list[asyncio.Task]:
    if not SNAPSHOT_JOBS_ENABLED:
        _log("disabled")
        return []

    _log("starting background snapshot refreshers")
    tasks = [
        asyncio.create_task(_run_periodic(name, interval_seconds, fn), name=f"snapshot:{name}")
        for name, interval_seconds, fn in _job_specs()
    ]
    return tasks


async def stop_snapshot_jobs(tasks: list[asyncio.Task] | None) -> None:
    if not tasks:
        return
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    _log("stopped background snapshot refreshers")
