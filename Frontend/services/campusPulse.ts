import type { CampusLocation } from "../components/places/types";
import { getCanonicalLocationName } from "../components/places/campusData";

export interface PulsePing {
  id: string;
  title: string;
  body: string;
  category: string;
  locationTag: string;
  startAt: string;
  endAt?: string | null;
  createdAt: string;
  userName: string;
  likeCount: number;
  commentCount: number;
}

export interface PulseEvent {
  id: string;
  title: string;
  summary: string;
  location: string;
  startTime: string;
  endTime?: string | null;
  link?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  categories?: Record<string, number>;
  interestScore?: number;
}

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

const HOT_COLOR = "#FF6B57";
const ACTIVE_COLOR = "#FFB347";
const BUBBLING_COLOR = "#5ACD7C";

function formatTimeLabel(isoValue: string) {
  const target = new Date(isoValue);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const time = target.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffHours <= 1 && diffHours >= -1.5) return "Now";
  if (target.toDateString() === now.toDateString()) return `Today · ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;

  return `${target.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}

function recencyWeight(isoValue: string) {
  const target = new Date(isoValue);
  const now = new Date();
  const diffHours = (target.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours <= 1 && diffHours >= -2) return 1;
  if (diffHours <= 4 && diffHours >= -6) return 0.85;
  if (diffHours <= 14 && diffHours >= -12) return 0.65;
  if (diffHours <= 36 && diffHours >= -18) return 0.42;
  return 0.18;
}

function pingCategoryBoost(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("free food")) return 7;
  if (normalized.includes("show") || normalized.includes("sports")) return 6;
  if (normalized.includes("hangout") || normalized.includes("popup")) return 5;
  return 3;
}

function eventCategory(event: PulseEvent) {
  if (event.categories?.food) return "Free Food";
  if (event.categories?.sports) return "Sports";
  if (event.categories?.entertainment) return "Show";
  if (event.categories?.social) return "Hangout";
  if (event.categories?.academic) return "Study";
  return "Event";
}

function pulseLabelFor(score: number): CampusHotspot["pulseLabel"] {
  if (score >= 60) return "Hot";
  if (score >= 34) return "Active";
  return "Bubbling";
}

function pulseColorFor(score: number) {
  if (score >= 60) return HOT_COLOR;
  if (score >= 34) return ACTIVE_COLOR;
  return BUBBLING_COLOR;
}

function buildSummary(
  locationName: string,
  pingCount: number,
  eventCount: number,
  percentFull: number | null,
) {
  const parts = [];
  if (pingCount > 0) parts.push(`${pingCount} live ping${pingCount === 1 ? "" : "s"}`);
  if (eventCount > 0) parts.push(`${eventCount} featured event${eventCount === 1 ? "" : "s"}`);
  if (percentFull != null && percentFull >= 50) parts.push(`${percentFull}% full nearby`);

  if (!parts.length) return `${locationName} is picking up.`;
  return `${locationName} has ${parts.join(" · ")}.`;
}

export function mapActivityToPulsePing(activity: any): PulsePing {
  const custom = activity.custom || {};
  const actor = activity.actor || {};

  return {
    id: activity.id || `${Date.now()}`,
    title: custom.ping_title || "Campus Ping",
    body: activity.text || "",
    category: custom.ping_category || "Popup",
    locationTag: custom.location_tag || "Campus",
    startAt: custom.start_at || activity.time || new Date().toISOString(),
    endAt: custom.end_at || null,
    createdAt: activity.time || activity.created_at || new Date().toISOString(),
    userName: actor.data?.name || custom.user_name || "Aggie",
    likeCount: activity.reaction_counts?.like || activity.reaction_count || 0,
    commentCount: activity.reaction_counts?.comment || 0,
  };
}

export function buildCampusHotspots(params: {
  pings: PulsePing[];
  events: PulseEvent[];
  places: CampusLocation[];
}): CampusHotspot[] {
  const placeLookup = new Map(
    params.places.map((place) => [getCanonicalLocationName(place.location), place]),
  );
  const grouped = new Map<
    string,
    {
      locationName: string;
      coord: { lat: number; lng: number };
      place: CampusLocation | null;
      score: number;
      pingCount: number;
      eventCount: number;
      categoryWeights: Map<string, number>;
      items: CampusHotspotItem[];
    }
  >();

  const ensureGroup = (
    locationName: string,
    coord: { lat: number; lng: number },
    place: CampusLocation | null,
  ) => {
    const canonical = getCanonicalLocationName(locationName);
    if (!grouped.has(canonical)) {
      grouped.set(canonical, {
        locationName: canonical,
        coord,
        place,
        score: 0,
        pingCount: 0,
        eventCount: 0,
        categoryWeights: new Map<string, number>(),
        items: [],
      });
    }
    return grouped.get(canonical)!;
  };

  params.pings.forEach((ping) => {
    const canonicalLocation = getCanonicalLocationName(ping.locationTag);
    const place = placeLookup.get(canonicalLocation);
    if (!place) return;

    const weight =
      14 * recencyWeight(ping.startAt) +
      Math.min(6, ping.likeCount * 0.8) +
      Math.min(4, ping.commentCount * 0.7) +
      pingCategoryBoost(ping.category);

    const group = ensureGroup(canonicalLocation, place.coord, place);
    group.score += weight;
    group.pingCount += 1;
    group.categoryWeights.set(
      ping.category,
      (group.categoryWeights.get(ping.category) || 0) + weight,
    );
    group.items.push({
      id: ping.id,
      source: "ping",
      title: ping.title,
      subtitle: ping.userName,
      category: ping.category,
      timeLabel: formatTimeLabel(ping.startAt),
      startAt: ping.startAt,
    });
  });

  params.events.forEach((event) => {
    const canonicalLocation = getCanonicalLocationName(event.location);
    const place = placeLookup.get(canonicalLocation);
    const coord =
      place?.coord ||
      (event.locationLat != null && event.locationLng != null
        ? { lat: event.locationLat, lng: event.locationLng }
        : null);
    if (!coord) return;

    const category = eventCategory(event);
    const weight =
      18 * recencyWeight(event.startTime) +
      Math.min(12, (event.interestScore || 40) / 8);

    const group = ensureGroup(canonicalLocation, coord, place || null);
    group.score += weight;
    group.eventCount += 1;
    group.categoryWeights.set(
      category,
      (group.categoryWeights.get(category) || 0) + weight,
    );
    group.items.push({
      id: event.id,
      source: "event",
      title: event.title,
      subtitle: "Featured event",
      category,
      timeLabel: formatTimeLabel(event.startTime),
      startAt: event.startTime,
      link: event.link,
    });
  });

  return Array.from(grouped.values())
    .map((group) => {
      const percentFull = group.place?.percent_full ?? null;
      const occupancyBoost =
        percentFull != null && percentFull > 35
          ? Math.min(14, (percentFull - 35) * 0.22)
          : 0;
      const score = Math.round(group.score + occupancyBoost);
      const pulseLabel = pulseLabelFor(score);
      const dominantCategory =
        [...group.categoryWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "Campus";

      return {
        id: `hotspot-${group.locationName}`,
        locationName: group.locationName,
        coord: group.coord,
        score,
        pulseLabel,
        pulseColor: pulseColorFor(score),
        radius: 110 + Math.min(score, 80) * 3.2,
        pingCount: group.pingCount,
        eventCount: group.eventCount,
        percentFull,
        dominantCategory,
        previewLabel:
          group.pingCount > 0 && group.eventCount > 0
            ? `${group.pingCount} pings · ${group.eventCount} events`
            : group.pingCount > 0
              ? `${group.pingCount} live pings`
              : `${group.eventCount} featured events`,
        summary: buildSummary(
          group.locationName,
          group.pingCount,
          group.eventCount,
          percentFull,
        ),
        items: group.items
          .sort(
            (left, right) =>
              new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
          )
          .slice(0, 6),
        place: group.place,
      } satisfies CampusHotspot;
    })
    .filter((group) => group.score >= 16)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}
