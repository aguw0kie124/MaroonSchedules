import { useState, useEffect, useMemo } from "react";
import { fetchCampusPlacesMap } from "../../api/client";
import type { CampusLocation } from "./types";
import { buildCampusDirectory } from "./campusData";

export function useLocationData() {
  const fullCampusIndex = useMemo(() => buildCampusDirectory(), []);
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
      setLocations(nextLocations.length ? nextLocations : fullCampusIndex);
    } catch (err) {
      console.warn("Failed to fetch places map snapshot", err);
      setLocations(fullCampusIndex);
    } finally {
      setLoading(false);
    }
  };

  return { locations, loading, fullCampusIndex };
}
