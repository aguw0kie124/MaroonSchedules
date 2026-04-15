import { API_URL } from "../config";
import type { CampusLocation } from "../components/places/types";
import { fetchCampusPulseMap as apiFetchPulseMap } from "../api/client";

export interface CampusHotspotItem {
  id: string;
  source: "ping" | "event";
  title: string;
  subtitle: string;
  body?: string;
  category: string;
  timeLabel: string;
  startAt: string;
  link?: string | null;
  imageUrl?: string | null;
  activityId?: string;
  locationTag?: string;
  commentCount?: number;
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

function toSafeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeVoteValue(value: unknown): -1 | 0 | 1 {
  const numeric = toSafeNumber(value);
  if (numeric > 0) return 1;
  if (numeric < 0) return -1;
  return 0;
}

export function getCampusHotspotItemVoteScore(
  item: Pick<CampusHotspotItem, "upvotes" | "downvotes">,
): number {
  return toSafeNumber(item.upvotes) - toSafeNumber(item.downvotes);
}

export function applyCampusHotspotItemVote(
  item: CampusHotspotItem,
  newUserVote: number,
): CampusHotspotItem {
  const currentVote = normalizeVoteValue(item.userVote);
  const nextVote = normalizeVoteValue(newUserVote);
  let upvotes = toSafeNumber(item.upvotes);
  let downvotes = toSafeNumber(item.downvotes);

  if (currentVote === 1) upvotes = Math.max(0, upvotes - 1);
  if (currentVote === -1) downvotes = Math.max(0, downvotes - 1);
  if (nextVote === 1) upvotes += 1;
  if (nextVote === -1) downvotes += 1;

  return {
    ...item,
    upvotes,
    downvotes,
    itemScore: toSafeNumber(item.itemScore) + (nextVote - currentVote),
    userVote: nextVote,
  };
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

function formatPulseTimeLabel(startAt?: string | null, existingLabel?: string | null): string {
  if (existingLabel && !existingLabel.includes("%#")) {
    return existingLabel;
  }

  if (!startAt) {
    return existingLabel || "Soon";
  }

  const date = new Date(startAt);
  if (!Number.isFinite(date.getTime())) {
    return existingLabel || "Soon";
  }

  const now = new Date();
  const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffHours >= -1.5 && diffHours <= 1) return "Now";

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Today · ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow · ${time}`;
  }

  const monthDay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${monthDay} · ${time}`;
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
const PULSE_MAX_LIMIT = 100;

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

  const data = await apiFetchPulseMap(safeLimit, options.clerkId, Boolean(options.force));
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
      timeLabel: formatPulseTimeLabel(item.startAt ?? item.start_at, item.timeLabel ?? item.time_label),
      activityId: item.activityId ?? item.activity_id ?? item.id,
      locationTag: item.locationTag ?? item.location_tag ?? hotspot.locationName ?? '',
      commentCount: toSafeNumber(item.commentCount ?? item.comment_count),
      upvotes: toSafeNumber(item.upvotes),
      downvotes: toSafeNumber(item.downvotes),
      itemScore: toSafeNumber(item.itemScore),
      userVote: normalizeVoteValue(item.userVote),
      imageUrl: resolveMediaUrl(item.imageUrl || item.image_url),
    }));

    return {
      id: hotspot.id ?? `pulse-${placeId ?? hotspot.locationName ?? Math.random().toString(36).slice(2)}`,
      placeId,
      locationName:
        hotspot.locationName === "Campus Event"
          ? hotspot.place?.name ?? hotspot.place?.location ?? "Campus"
          : hotspot.locationName ?? hotspot.place?.name ?? hotspot.place?.location ?? "Location",
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
      const currentVote = normalizeVoteValue(item.userVote);
      const nextVote = normalizeVoteValue(newUserVote);
      const delta = nextVote - currentVote;
      const updatedItem = applyCampusHotspotItemVote(item, nextVote);
      
      Object.assign(item, updatedItem);

      // Update the parent hotspot's aggregate visual fields
      hotspot.score = toSafeNumber(hotspot.score) + delta;
      return;
    }
  }
}
