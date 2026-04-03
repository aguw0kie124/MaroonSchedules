import { useState, useEffect, useMemo } from "react";
import { fetchCampusPlacesMap } from "../../api/client";
import type { CampusLocation } from "./types";
import { buildExpandedPlacesDirectory, mergeCampusLocations } from "./campusData";

export function useLocationData() {
  const fullCampusIndex = useMemo(() => buildExpandedPlacesDirectory(), []);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const payload = await fetchCampusPlacesMap();
      const nextLocations = Array.isArray(payload?.locations)
        ? (payload.locations as CampusLocation[])
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
  };

  return { locations, loading, fullCampusIndex };
}
