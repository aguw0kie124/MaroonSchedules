import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchCampusCapacityRealtime,
  fetchCampusParkingRealtime,
  fetchCampusPlacesMap,
} from "../../api/client";
import type { CampusLocation } from "./types";
import {
  buildExpandedPlacesDirectory,
  mergeCampusLocations,
  normalizeLocationType,
} from "./campusData";

function normalizeCampusLocation(location: CampusLocation): CampusLocation {
  return {
    ...location,
    type: normalizeLocationType(location.type),
  };
}

/** Matches Backend/services/campus_places_service.py visitor garage mapping. */
const VISITOR_GARAGE_FULL_NAME_BY_CODE: Record<string, string> = {
  CCG: "Central Campus Garage",
  PRG: "Polo Road Garage",
  SBG: "Stallings Blvd Garage",
  UCG: "University Center Garage",
  WCG: "West Campus Garage",
};

const VISITOR_CODE_BY_PLACE_ID: Record<string, string> = {
  "osm:way:91100311": "CCG",
  "garage-polo": "PRG",
  "osm:way:450686873": "SBG",
  "garage-university-center": "UCG",
  "garage-west-campus": "WCG",
};

type CapacityRealtimeLocation = {
  percent_full?: number | null;
  available_seats?: number | null;
  capacity?: number | null;
  current_count?: number | null;
  occupancy_name?: string | null;
  capacity_last_updated?: string | null;
  capacity_source_url?: string | null;
  capacity_as_of?: string | null;
  is_live?: boolean;
};

type CapacityRealtimeBlock = {
  recreation?: {
    locations?: Record<string, CapacityRealtimeLocation>;
  } | null;
  libraries?: {
    locations?: Record<string, CapacityRealtimeLocation>;
  } | null;
} | null;

function applyParkingRealtimeOverlay(
  locations: CampusLocation[],
  block: { garages?: Record<string, number>; fetched_at?: string; source_url?: string } | null,
): CampusLocation[] {
  const garages = block?.garages;
  if (!garages || !Object.keys(garages).length) return locations;
  return locations.map((loc) => {
    const code = loc.placeId ? VISITOR_CODE_BY_PLACE_ID[loc.placeId] : undefined;
    if (!code) return loc;
    const n = garages[code];
    if (n === undefined) return loc;
    return {
      ...loc,
      visitor_parking_available: n,
      visitor_parking_code: code,
      visitor_parking_garage_name: VISITOR_GARAGE_FULL_NAME_BY_CODE[code] ?? null,
      visitor_parking_as_of: block?.fetched_at ?? null,
      visitor_parking_source_url: block?.source_url ?? null,
    };
  });
}

function applyCapacityRealtimeOverlay(
  locations: CampusLocation[],
  block: CapacityRealtimeBlock,
): CampusLocation[] {
  const liveByPlaceId = {
    ...(block?.recreation?.locations || {}),
    ...(block?.libraries?.locations || {}),
  };

  if (!Object.keys(liveByPlaceId).length) return locations;

  return locations.map((loc) => {
    const live = loc.placeId ? liveByPlaceId[loc.placeId] : undefined;
    if (!live) return loc;
    return {
      ...loc,
      percent_full:
        typeof live.percent_full === "number" ? live.percent_full : loc.percent_full,
      available_seats: live.available_seats ?? loc.available_seats,
      capacity: live.capacity ?? loc.capacity,
      current_count: live.current_count ?? loc.current_count,
      occupancy_name: live.occupancy_name ?? loc.occupancy_name,
      capacity_last_updated: live.capacity_last_updated ?? loc.capacity_last_updated,
      capacity_source_url: live.capacity_source_url ?? loc.capacity_source_url,
      capacity_as_of: live.capacity_as_of ?? loc.capacity_as_of,
      is_live: typeof live.is_live === "boolean" ? live.is_live : loc.is_live,
    };
  });
}

export function useLocationData({ autoFetch = true }: { autoFetch?: boolean } = {}) {
  const fullCampusIndex = useMemo(() => buildExpandedPlacesDirectory(), []);
  const [locations, setLocations] = useState<CampusLocation[]>(fullCampusIndex);
  const [loading, setLoading] = useState(true);

  const refreshLocations = useCallback(async () => {
    setLoading(true);
    try {
      const [payload, parkingBlock, capacityBlock] = await Promise.all([
        fetchCampusPlacesMap(),
        fetchCampusParkingRealtime().catch(() => null),
        fetchCampusCapacityRealtime().catch(() => null),
      ]);
      const nextLocations = Array.isArray(payload?.locations)
        ? (payload.locations as CampusLocation[]).map(normalizeCampusLocation)
        : [];
      let merged =
        nextLocations.length > 0
          ? mergeCampusLocations(fullCampusIndex, nextLocations)
          : fullCampusIndex;
      merged = applyParkingRealtimeOverlay(merged, parkingBlock);
      merged = applyCapacityRealtimeOverlay(merged, capacityBlock);
      setLocations(merged);
    } catch (err) {
      console.warn("Failed to fetch places map snapshot", err);
      setLocations(fullCampusIndex);
    } finally {
      setLoading(false);
    }
  }, [fullCampusIndex]);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }
    refreshLocations();
  }, [autoFetch, refreshLocations]);

  return { locations, loading, fullCampusIndex, refreshLocations };
}
