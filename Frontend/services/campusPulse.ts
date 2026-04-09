import { API_URL } from "../config";
import type { CampusLocation } from "../components/places/types";
import { fetchCampusPulseMap as apiFetchPulseMap } from "../api/client";

export interface CampusHotspotItem {
  id: string;
  source: "ping" | "event";
  title: string;
  subtitle: string;
  category: string;
  timeLabel: string;
  startAt: string;
  link?: string | null;
  imageUrl?: string | null;
  upvotes?: number;
  downvotes?: number;
  itemScore?: number;
  userVote?: number;
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
  userVote?: number; // -1, 0, or 1
}

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`;
  if ((url.includes('127.0.0.1') || url.includes('localhost')) && url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    return `${API_URL}/uploads/${parts[1]}`;
  }
  return url;
}

function parseCoordinateValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeCoord(hotspot: any): { lat: number; lng: number } | null {
  const directLat = parseCoordinateValue(
    hotspot?.coord?.lat ?? hotspot?.coord?.latitude ?? hotspot?.lat ?? hotspot?.latitude,
  );
  const directLng = parseCoordinateValue(
    hotspot?.coord?.lng ?? hotspot?.coord?.longitude ?? hotspot?.lng ?? hotspot?.longitude,
  );
  if (directLat != null && directLng != null) {
    return { lat: directLat, lng: directLng };
  }

  const placeLat = parseCoordinateValue(
    hotspot?.place?.coord?.lat ??
      hotspot?.place?.coord?.latitude ??
      hotspot?.place?.lat ??
      hotspot?.place?.latitude,
  );
  const placeLng = parseCoordinateValue(
    hotspot?.place?.coord?.lng ??
      hotspot?.place?.coord?.longitude ??
      hotspot?.place?.lng ??
      hotspot?.place?.longitude,
  );
  if (placeLat != null && placeLng != null) {
    return { lat: placeLat, lng: placeLng };
  }

  return null;
}

function normalizePlace(
  hotspot: any,
  placeId: string | null,
  coord: { lat: number; lng: number } | null,
): CampusLocation | null {
  const rawPlace = hotspot?.place;
  const placeCoord = coord
    ? coord
    : normalizeCoord({ coord: rawPlace?.coord, lat: rawPlace?.lat, lng: rawPlace?.lng });

  if (!rawPlace && !placeCoord) return null;

  return {
    placeId: placeId ?? rawPlace?.place_id ?? rawPlace?.placeId ?? undefined,
    location:
      rawPlace?.location ??
      rawPlace?.name ??
      hotspot?.locationName ??
      "Location",
    shortName:
      rawPlace?.shortName ??
      rawPlace?.short_name ??
      rawPlace?.name?.slice?.(0, 10) ??
      hotspot?.locationName?.slice?.(0, 10),
    percent_full: Number(rawPlace?.percent_full ?? rawPlace?.percentFull ?? hotspot?.percentFull ?? 0) || 0,
    type: (rawPlace?.type ?? "General") as CampusLocation["type"],
    is_live: Boolean(rawPlace?.is_live ?? rawPlace?.isLive ?? true),
    available_seats: rawPlace?.available_seats ?? rawPlace?.availableSeats ?? null,
    coord: placeCoord ?? { lat: 0, lng: 0 },
    address: rawPlace?.address ?? undefined,
    source: "pulse",
  };
}

const PULSE_CACHE_TTL_MS = 30_000;
const PULSE_MAX_LIMIT = 25;

let _cachedHotspots: CampusHotspot[] | null = null;
let _cachedAt = 0;

export function invalidateCampusPulseCache() {
  _cachedHotspots = null;
  _cachedAt = 0;
}

export async function fetchCampusPulseMap(
  limit = 12,
  options: { force?: boolean; clerkId?: string } = {},
): Promise<{ hotspots: CampusHotspot[], status: string }> {
  const safeLimit = Math.min(limit, PULSE_MAX_LIMIT);
  const now = Date.now();
  if (!options.force && _cachedHotspots && now - _cachedAt < PULSE_CACHE_TTL_MS) {
    return { hotspots: _cachedHotspots, status: 'live' };
  }

  const data = await apiFetchPulseMap(safeLimit, options.clerkId);
  const hotspots = Array.isArray(data) ? data : Array.isArray(data?.hotspots) ? data.hotspots : [];
  const status = data?.status || data?.source_status || 'live';

  if (!Array.isArray(hotspots)) {
    return { hotspots: [], status };
  }

  const mapped: CampusHotspot[] = hotspots
    .map((hotspot: any): CampusHotspot | null => {
    const placeId = hotspot.placeId ?? hotspot.place_id ?? hotspot.place?.place_id ?? null;
    const coord = normalizeCoord(hotspot);
    if (!coord) return null;
    
    const items = (Array.isArray(hotspot.items) ? hotspot.items : []).map((item: any) => ({
      ...item,
      imageUrl: resolveMediaUrl(item.imageUrl || item.image_url),
    }));

    return {
      id: hotspot.id ?? `pulse-${placeId ?? hotspot.locationName ?? Math.random().toString(36).slice(2)}`,
      placeId,
      locationName: hotspot.locationName ?? hotspot.place?.name ?? hotspot.place?.location ?? "Location",
      coord,
      score: Number(hotspot.score) || 0,
      pulseLabel: (hotspot.pulseLabel ?? "Bubbling") as CampusHotspot["pulseLabel"],
      pulseColor: hotspot.pulseColor ?? "#FFB347",
      radius: typeof hotspot.radius === 'number' ? hotspot.radius : 100,
      pingCount: Number(hotspot.pingCount) || 0,
      eventCount: Number(hotspot.eventCount) || 0,
      percentFull: hotspot.percentFull ?? null,
      dominantCategory: hotspot.dominantCategory ?? "Campus",
      previewLabel: hotspot.previewLabel ?? "Live now",
      summary: hotspot.summary ?? "",
      items,
      place: normalizePlace(hotspot, placeId, coord),
      userVote: 0,
    };
    })
    .filter((hotspot): hotspot is CampusHotspot => hotspot != null);

  _cachedHotspots = mapped;
  _cachedAt = now;

  return { hotspots: mapped, status };
}

/**
 * voteHotspotItem — session-based voting logic for individual pings inside a hotspot.
 * @param itemId The unique ID of the ping
 * @param newUserVote The desired vote state (-1, 0, 1)
 */
export async function voteHotspotItem(itemId: string, newUserVote: number) {
  if (!_cachedHotspots) return;
  
  for (const hotspot of _cachedHotspots) {
    if (!hotspot.items) continue;
    
    const item = hotspot.items.find((i) => i.id === itemId);
    if (item) {
      const currentVote = item.userVote || 0;
      const delta = newUserVote - currentVote;
      
      item.itemScore = (item.itemScore || 0) + delta;
      item.userVote = newUserVote;
      
      // Update the parent hotspot's aggregate visual fields
      hotspot.score = (hotspot.score || 0) + delta;
      
      // The user wants "upvotes to be for each live ping". 
      // We'll treat every upvote as a contribution to the "live" count metric.
      const totalUpvotes = hotspot.items.reduce((acc, i) => acc + (i.itemScore || 0), 0);
      hotspot.pingCount = Math.max(hotspot.items.length, totalUpvotes);
      return;
    }
  }
}
