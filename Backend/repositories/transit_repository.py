
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import psycopg
from db_config import get_pool

class TransitRepository:
    def __init__(self):
        self.pool = get_pool()

    def get_upcoming_stop_times(self, stop_code: str, route_number: str, start_time: datetime, limit: int = 5) -> List[Dict[str, Any]]:
        """Get scheduled departure times for a specific stop and route after a certain time."""
        with self.pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT scheduled_time, direction_name, is_departure
                    FROM transit_stop_schedules
                    WHERE stop_code = %s AND route_number = %s AND scheduled_time >= %s
                    ORDER BY scheduled_time ASC
                    LIMIT %s
                """, (stop_code, route_number, start_time, limit))
                
                rows = cur.fetchall()
                return [
                    {
                        "scheduled_time": row[0],
                        "direction_name": row[1],
                        "is_departure": row[2]
                    }
                    for row in rows
                ]

    def find_best_trip(
        self,
        origin_stop_code: str,
        dest_stop_code: str,
        target_time: datetime,
        route_number: str,
        timing_mode: str = "leave_at",
        minimum_travel_minutes: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """Find the best scheduled trip on a route based on timing mode."""
        with self.pool.connection() as conn:
            with conn.cursor() as cur:
                minimum_travel_minutes = max(0, int(minimum_travel_minutes or 0))
                if timing_mode == "leave_at":
                    # DEPARTURE: Find the EARLIEST origin after target_time
                    cur.execute("""
                        SELECT scheduled_time, direction_name
                        FROM transit_stop_schedules
                        WHERE stop_code = %s AND route_number = %s AND scheduled_time >= %s
                        ORDER BY scheduled_time ASC
                        LIMIT 1
                    """, (origin_stop_code, route_number, target_time))
                    
                    origin_row = cur.fetchone()
                    if not origin_row:
                        return None
                    
                    origin_time = origin_row[0]
                    direction = origin_row[1]
                    earliest_dest_time = origin_time + timedelta(minutes=minimum_travel_minutes)
                    
                    # Fetch the first destination time after origin_time on the same route/direction
                    cur.execute("""
                        SELECT scheduled_time
                        FROM transit_stop_schedules
                        WHERE stop_code = %s AND route_number = %s AND direction_name = %s AND scheduled_time > %s
                        ORDER BY scheduled_time ASC
                        LIMIT 1
                    """, (dest_stop_code, route_number, direction, earliest_dest_time))
                    
                    dest_row = cur.fetchone()
                    if not dest_row:
                        return None
                    
                    return {
                        "origin_time": origin_time,
                        "dest_time": dest_row[0],
                        "direction": direction
                    }
                else:
                    # ARRIVAL: Find the LATEST destination before target_time
                    cur.execute("""
                        SELECT scheduled_time, direction_name
                        FROM transit_stop_schedules
                        WHERE stop_code = %s AND route_number = %s AND scheduled_time <= %s
                        ORDER BY scheduled_time DESC
                        LIMIT 1
                    """, (dest_stop_code, route_number, target_time))
                    
                    dest_row = cur.fetchone()
                    if not dest_row:
                        return None
                    
                    dest_time = dest_row[0]
                    direction = dest_row[1]
                    latest_origin_time = dest_time - timedelta(minutes=minimum_travel_minutes)
                    
                    # Fetch the LATEST origin time before dest_time on same route/direction
                    cur.execute("""
                        SELECT scheduled_time
                        FROM transit_stop_schedules
                        WHERE stop_code = %s AND route_number = %s AND direction_name = %s AND scheduled_time < %s
                        ORDER BY scheduled_time DESC
                        LIMIT 1
                    """, (origin_stop_code, route_number, direction, latest_origin_time))
                    
                    origin_row = cur.fetchone()
                    if not origin_row:
                        return None
                    
                    return {
                        "origin_time": origin_row[0],
                        "dest_time": dest_time,
                        "direction": direction
                    }

    def get_route_stops(self, route_number: str) -> List[Dict[str, Any]]:
        """Get the list of stops for a route in their typical sequence."""
        with self.pool.connection() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                # We find the trip with the most stops to represent the full route pattern
                # Since we don't have trip_ids, we group by a narrow time window or just take distinct stops
                # for the route_number.
                cur.execute("""
                    SELECT DISTINCT stop_code, stop_name, direction_name
                    FROM transit_stop_schedules
                    WHERE route_number = %s
                    ORDER BY direction_name, stop_name
                """, (route_number,))
                return cur.fetchall()

    def get_route_timetable(self, route_number: str, stop_codes: List[str], start_time: datetime) -> Dict[str, List[Dict[str, Any]]]:
        """Get the upcoming departures for multiple stops on a single route."""
        with self.pool.connection() as conn:
            with conn.cursor() as cur:
                # Optimized way: Get all scheduled times for these stops on this route today/tomorrow after start_time
                cur.execute("""
                    SELECT stop_code, scheduled_time, direction_name
                    FROM transit_stop_schedules
                    WHERE route_number = %s AND stop_code = ANY(%s) AND scheduled_time >= %s
                    ORDER BY stop_code, scheduled_time ASC
                """, (route_number, stop_codes, start_time))
                
                rows = cur.fetchall()
                results = {code: [] for code in stop_codes}
                for row in rows:
                    if len(results[row[0]]) < 5: # Limit to 5 departures per stop
                        results[row[0]].append({
                            "scheduled_time": row[1],
                            "direction_name": row[2]
                        })
                return results

    def get_cached_transit_routes(self) -> List[Dict[str, Any]]:
        """Get the list of all bus routes from the local cache."""
        with self.pool.connection() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute("SELECT route_data FROM transit_route_cache")
                return [row["route_data"] for row in cur.fetchall()]

    def get_cached_pattern(self, route_key: str) -> Optional[Dict[str, Any]]:
        """Get the map pattern (polyline) for a specific route from the local cache."""
        with self.pool.connection() as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute("SELECT pattern_data FROM transit_route_cache WHERE route_key = %s", (route_key,))
                row = cur.fetchone()
                return row["pattern_data"] if row else None

transit_repo = TransitRepository()
