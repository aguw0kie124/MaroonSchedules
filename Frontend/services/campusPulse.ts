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
    
    const items = (Array.isArray(hotspot.items) ? hotspot.items : []).map((item: any) => ({
      ...item,
      imageUrl: resolveMediaUrl(item.imageUrl || item.image_url),
    }));

    return {
      id: hotspot.id,
      placeId,
      locationName: hotspot.locationName,
      coord: hotspot.coord,
      score: hotspot.score,
      pulseLabel: hotspot.pulseLabel,
      pulseColor: hotspot.pulseColor,
      radius: typeof hotspot.radius === 'number' ? hotspot.radius : 100,
      pingCount: hotspot.pingCount,
      eventCount: hotspot.eventCount,
      percentFull: hotspot.percentFull ?? null,
      dominantCategory: hotspot.dominantCategory,
      previewLabel: hotspot.previewLabel,
      summary: hotspot.summary,
      items,
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
      
      // The user wants "upvotes to be for each live ping". 
      // We'll treat every upvote as a contribution to the "live" count metric.
      const totalUpvotes = hotspot.items.reduce((acc, i) => acc + (i.itemScore || 0), 0);
      hotspot.pingCount = Math.max(hotspot.items.length, totalUpvotes);
      return;
    }
  }
}
