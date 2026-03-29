import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import type { CampusLocation } from "./types";
import {
  buildCampusDirectory,
  getCanonicalLocationName,
  getCanonicalCoords,
  CAMPUS_ZONES,
} from "./campusData";

export function useLocationData() {
  const fullCampusIndex = useMemo(() => buildCampusDirectory(), []);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/traffic/retrieve`);
      let fetched = res.data.filter((d: any) => d.coord);

      // Ensure Hubs are present even if traffic data misses them
      const hubs = [
        {
          location: "Memorial Student Center",
          type: "Hub",
          coord: getCanonicalCoords("Memorial Student Center", {
            lat: 30.6123,
            lng: -96.3415,
          }),
          percent_full: 45,
          is_live: false,
          hours: "7:00 AM – 10:00 PM",
        },
        {
          location: "Polo Road Garage Dining",
          type: "Hub",
          coord: getCanonicalCoords("Polo Road Garage Dining", {
            lat: 30.6235,
            lng: -96.3388,
          }),
          percent_full: 30,
          is_live: false,
          hours: "7:00 AM – 9:00 PM",
        },
        {
          location: "Sbisa Dining Hall",
          type: "Dining",
          coord: getCanonicalCoords("Sbisa Dining Hall", {
            lat: 30.617135,
            lng: -96.343777,
          }),
          percent_full: 60,
          is_live: false,
          hours: "10:00 AM – 8:00 PM",
        },
      ];

      const combined = [...fetched];
      hubs.forEach((h) => {
        if (
          !combined.find(
            (c: any) =>
              c.location.includes(h.location) ||
              h.location.includes(c.location),
          )
        ) {
          combined.push(h);
        }
      });

      // Merge high-fidelity hours/data from CAMPUS_ZONES
      const trafficLocations = combined.map((loc: any) => {
        const canonicalName = getCanonicalLocationName(loc.location);
        const zone = CAMPUS_ZONES.find((z) => z.name === canonicalName);
        const resolvedCoord = getCanonicalCoords(canonicalName, loc.coord);
        if (zone && zone.hours) {
          return {
            ...loc,
            location: canonicalName,
            coord: resolvedCoord,
            hours: zone.hours,
            source: "traffic" as const,
          };
        }
        return {
          ...loc,
          location: canonicalName,
          coord: resolvedCoord,
          source: "traffic" as const,
        };
      });
      const mergedMap = new Map<string, CampusLocation>();
      fullCampusIndex.forEach((location) =>
        mergedMap.set(location.location, location),
      );
      trafficLocations.forEach((location: CampusLocation) => {
        const canonicalName = getCanonicalLocationName(location.location);
        const existing =
          mergedMap.get(canonicalName) || mergedMap.get(location.location);

        if (
          location.location !== canonicalName &&
          mergedMap.has(location.location)
        ) {
          mergedMap.delete(location.location);
        }

        mergedMap.set(canonicalName, {
          ...existing,
          ...location,
          location: canonicalName,
          coord: getCanonicalCoords(canonicalName, location.coord),
          type: existing?.type || location.type || "General",
          shortName: existing?.shortName || location.shortName,
          description: existing?.description || location.description,
        });
      });
      setLocations(Array.from(mergedMap.values()));
    } catch (err) {
      console.warn("Failed to fetch traffic data", err);
      setLocations(fullCampusIndex);
    } finally {
      setLoading(false);
    }
  };

  return { locations, loading, fullCampusIndex };
}
