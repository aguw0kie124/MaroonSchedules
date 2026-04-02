import { useMemo } from "react";
import type { CampusLocation, ParkingPermit } from "./types";
import { haversineDistanceMeters, getParkingRecommendation } from "./utils";

export function useMapLocations(
  locations: CampusLocation[],
  scheduleLocations: CampusLocation[],
  activeLayer: string,
  userCoord: { latitude: number; longitude: number } | null,
  parkingPermit: ParkingPermit | null,
  selectedId: string | null
) {
  const allMapLocations = useMemo(() => {
    const merged = new Map<string, CampusLocation>();
    locations.forEach((l) => merged.set(l.location, l));
    scheduleLocations.forEach((l: any) =>
      merged.set(l.location, { ...(merged.get(l.location) || {}), ...l }),
    );
    return Array.from(merged.values());
  }, [locations, scheduleLocations]);

  const filteredLocations = useMemo(() => {
    if (activeLayer === "Pulse") return [];
    if (activeLayer === "Heatmap") return [];
    if (activeLayer === "Today") return scheduleLocations;
    if (activeLayer === "Dining")
      return allMapLocations.filter((l) => l.type === "Dining" || l.type === "Hub");
    if (activeLayer === "Academic")
      return allMapLocations.filter((l) => l.type === "Academic" || l.type === "Landmark");
    if (activeLayer === "Study")
      return allMapLocations.filter((l) => l.type === "Study" || l.type === "Library");
    if (activeLayer === "Rec")
      return allMapLocations.filter(
        (l) => l.type === "Rec" || (l.type === "Hub" && l.location.includes("Rec")),
      );
    return allMapLocations.filter((l) => l.type === activeLayer);
  }, [activeLayer, allMapLocations, scheduleLocations]);

  const sortedFilteredLocations = useMemo(() => {
    return [...filteredLocations].sort((a, b) => {
      const aD = userCoord
        ? haversineDistanceMeters(userCoord.latitude, userCoord.longitude, a.coord.lat, a.coord.lng)
        : null;
      const bD = userCoord
        ? haversineDistanceMeters(userCoord.latitude, userCoord.longitude, b.coord.lat, b.coord.lng)
        : null;
      if (activeLayer === "Parking") {
        const aP = getParkingRecommendation(a.location, parkingPermit);
        const bP = getParkingRecommendation(b.location, parkingPermit);
        if (aP.score !== bP.score) return aP.score - bP.score;
      }
      if (aD != null && bD != null && aD !== bD) return aD - bD;
      return a.location.localeCompare(b.location);
    });
  }, [activeLayer, filteredLocations, parkingPermit, userCoord]);

  const selectedLoc = useMemo(
    () => allMapLocations.find((l) => l.location === selectedId),
    [allMapLocations, selectedId],
  );

  const markerLocations = useMemo(() => {
    if (activeLayer === "Heatmap" || activeLayer === "Bus")
      return selectedLoc ? [selectedLoc] : [];
    const merged = new Map<string, CampusLocation>();
    filteredLocations.forEach((l) => merged.set(l.location, l));
    if (selectedLoc) merged.set(selectedLoc.location, selectedLoc);
    return Array.from(merged.values());
  }, [activeLayer, filteredLocations, selectedLoc]);

  return {
    allMapLocations,
    filteredLocations,
    sortedFilteredLocations,
    selectedLoc,
    markerLocations,
  };
}
