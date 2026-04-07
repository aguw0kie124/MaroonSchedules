import type { CampusLocation } from "../components/places/types";
import { fetchCampusPulseMap as fetchCampusPulseMapRequest } from "../api/client";

export interface CampusHotspotItem {
  id: string;
  source: "ping" | "event";
  title: string;
  subtitle: string;
  category: string;
  timeLabel: string;
  startAt: string;
  link?: string | null;
}

export interface CampusHotspot {
  id: string;
  placeId?: string | null;
  locationName: string;
  coord: { lat: number; lng: number };
  score: number;
  pulseLabel: "Hot" | "Active" | "Bubbling";
  pulseColor: string;
  radius: number;
  pingCount: number;
  eventCount: number;
  percentFull: number | null;
  dominantCategory: string;
  previewLabel: string;
  summary: string;
  items: CampusHotspotItem[];
  place: CampusLocation | null;
}

const PULSE_CACHE_TTL_MS = 30_000;

let _cachedHotspots: CampusHotspot[] | null = null;
let _cachedAt = 0;
let _inFlightHotspotsPromise: Promise<CampusHotspot[]> | null = null;

export function invalidateCampusPulseCache() {
  _cachedHotspots = null;
  _cachedAt = 0;
  _inFlightHotspotsPromise = null;
}

export async function fetchCampusPulseMap(limit = 12): Promise<CampusHotspot[]> {
  const now = Date.now();
  if (_cachedHotspots && now - _cachedAt < PULSE_CACHE_TTL_MS) {
    return _cachedHotspots;
  }

  if (_inFlightHotspotsPromise) {
    return _inFlightHotspotsPromise;
  }

  _inFlightHotspotsPromise = (async () => {
    const data = await fetchCampusPulseMapRequest(limit);
    const hotspots = Array.isArray(data)
      ? data
      : Array.isArray(data?.hotspots)
        ? data.hotspots
        : [];
    if (!Array.isArray(hotspots)) {
      return [];
    }

    const mapped = hotspots.map((hotspot: any) => ({
      id: hotspot.id,
      placeId: hotspot.placeId ?? hotspot.place_id ?? hotspot.place?.place_id ?? null,
      locationName: hotspot.locationName,
      coord: hotspot.coord,
      score: hotspot.score,
      pulseLabel: hotspot.pulseLabel,
      pulseColor: hotspot.pulseColor,
      radius: hotspot.radius,
      pingCount: hotspot.pingCount,
      eventCount: hotspot.eventCount,
      percentFull: hotspot.percentFull ?? null,
      dominantCategory: hotspot.dominantCategory,
      previewLabel: hotspot.previewLabel,
      summary: hotspot.summary,
      items: Array.isArray(hotspot.items) ? hotspot.items : [],
      place: null,
    }));

    _cachedHotspots = mapped;
    _cachedAt = Date.now();

    return mapped;
  })();

  try {
    return await _inFlightHotspotsPromise;
  } finally {
    _inFlightHotspotsPromise = null;
  }
}
