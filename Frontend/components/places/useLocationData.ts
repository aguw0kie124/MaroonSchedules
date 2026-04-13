import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchCampusPlacesMap, fetchCampusParkingRealtime } from "../../api/client";
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

export function useLocationData({ autoFetch = true }: { autoFetch?: boolean } = {}) {
  const fullCampusIndex = useMemo(() => buildExpandedPlacesDirectory(), []);
  const [locations, setLocations] = useState<CampusLocation[]>(fullCampusIndex);
  const [loading, setLoading] = useState(true);

  const refreshLocations = useCallback(async () => {
    setLoading(true);
    try {
      const [payload, parkingBlock] = await Promise.all([
        fetchCampusPlacesMap(),
        fetchCampusParkingRealtime().catch(() => null),
      ]);
      const nextLocations = Array.isArray(payload?.locations)
        ? (payload.locations as CampusLocation[]).map(normalizeCampusLocation)
        : [];
      let merged =
        nextLocations.length > 0
          ? mergeCampusLocations(fullCampusIndex, nextLocations)
          : fullCampusIndex;
      merged = applyParkingRealtimeOverlay(merged, parkingBlock);
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
