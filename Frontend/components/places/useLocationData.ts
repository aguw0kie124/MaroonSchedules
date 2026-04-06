import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchCampusPlacesMap } from "../../api/client";
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

export function useLocationData({ autoFetch = true }: { autoFetch?: boolean } = {}) {
  const fullCampusIndex = useMemo(() => buildExpandedPlacesDirectory(), []);
  const [locations, setLocations] = useState<CampusLocation[]>(fullCampusIndex);
  const [loading, setLoading] = useState(true);

  const refreshLocations = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchCampusPlacesMap();
      const nextLocations = Array.isArray(payload?.locations)
        ? (payload.locations as CampusLocation[]).map(normalizeCampusLocation)
        : [];
      setLocations(
        nextLocations.length
          ? mergeCampusLocations(fullCampusIndex, nextLocations)
          : fullCampusIndex,
      );
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
