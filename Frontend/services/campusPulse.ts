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

const PULSE_CACHE_TTL_MS = 30_000;

let _cachedHotspots: CampusHotspot[] | null = null;
let _cachedAt = 0;

export function invalidateCampusPulseCache() {
  _cachedHotspots = null;
  _cachedAt = 0;
}

export async function fetchCampusPulseMap(
  limit = 12,
  options: { force?: boolean; clerkId?: string } = {},
): Promise<CampusHotspot[]> {
  const now = Date.now();
  if (!options.force && _cachedHotspots && now - _cachedAt < PULSE_CACHE_TTL_MS) {
    return _cachedHotspots;
  }

  const data = await apiFetchPulseMap(limit, options.clerkId);
  const hotspots = Array.isArray(data) ? data : Array.isArray(data?.hotspots) ? data.hotspots : [];
  if (!Array.isArray(hotspots)) {
    return [];
  }

  const mapped = hotspots.map((hotspot: any) => {
    const placeId = hotspot.placeId ?? hotspot.place_id ?? hotspot.place?.place_id ?? null;
    
    // Debug log for specifically tracking radius and other Pulse metrics
    console.log(`[Pulse] Mapping hotspot: ${hotspot.locationName}, ID: ${hotspot.id}, Radius: ${hotspot.radius}`);

    return {
      id: hotspot.id,
      placeId,
      locationName: hotspot.locationName,
      coord: hotspot.coord,
      score: hotspot.score,
      pulseLabel: hotspot.pulseLabel,
      pulseColor: hotspot.pulseColor,
      radius: typeof hotspot.radius === 'number' ? hotspot.radius : 100, // Default to 100 if missing
      pingCount: hotspot.pingCount,
      eventCount: hotspot.eventCount,
      percentFull: hotspot.percentFull ?? null,
      dominantCategory: hotspot.dominantCategory,
      previewLabel: hotspot.previewLabel,
      summary: hotspot.summary,
      items: Array.isArray(hotspot.items) ? hotspot.items : [],
      place: null,
      userVote: 0,
    };
  });

  _cachedHotspots = mapped;
  _cachedAt = now;

  return mapped;
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
      if (delta > 0 && currentVote === 0) {
        hotspot.pingCount = (hotspot.pingCount || 0) + 1;
      } else if (delta < 0 && newUserVote === 0) {
        hotspot.pingCount = Math.max(0, (hotspot.pingCount || 1) - 1);
      }
      return;
    }
  }
}
