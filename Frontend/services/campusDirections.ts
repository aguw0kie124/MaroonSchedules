/**
 * Campus Walking Directions Service
 * Haversine-based distance + walking time estimation
 * Generates human-readable direction steps
 */

import { CampusBuilding, CampusAmenity, BUILDINGS, AMENITIES } from '../data/campus';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface WalkingRoute {
  start: Coordinate;
  end: Coordinate;
  distanceMeters: number;
  estimatedTimeMinutes: number;
  polyline: Coordinate[];
}

export interface DirectionStep {
  id: number;
  instruction: string;
  icon: string;
}

// ─── Haversine Distance ─────────────────────────────────────
export function computeDistanceMeters(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Walking Time ───────────────────────────────────────────
export function estimateWalkingTime(distanceMeters: number): number {
  // ~1.4 m/s average walking speed
  return Math.max(1, Math.ceil(distanceMeters / 84));
}

// ─── Route Creation ─────────────────────────────────────────
export function createRoute(start: Coordinate, end: Coordinate): WalkingRoute {
  const distanceMeters = computeDistanceMeters(start, end);
  return {
    start,
    end,
    distanceMeters,
    estimatedTimeMinutes: estimateWalkingTime(distanceMeters),
    polyline: [start, end],
  };
}

// ─── Formatting ─────────────────────────────────────────────
export function formatDistance(meters: number): string {
  const feet = meters * 3.28084;
  if (feet < 528) return `${Math.round(feet)} ft`;
  const miles = feet / 5280;
  return `${miles.toFixed(2)} mi`;
}

export function formatTime(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

// ─── Cardinal Direction ─────────────────────────────────────
function getCardinal(from: Coordinate, to: Coordinate): string {
  const dLat = to.latitude - from.latitude;
  const dLon = to.longitude - from.longitude;
  const angle = (Math.atan2(dLon, dLat) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return 'north';
  if (angle >= 22.5 && angle < 67.5) return 'northeast';
  if (angle >= 67.5 && angle < 112.5) return 'east';
  if (angle >= 112.5 && angle < 157.5) return 'southeast';
  if (angle >= 157.5 || angle < -157.5) return 'south';
  if (angle >= -157.5 && angle < -112.5) return 'southwest';
  if (angle >= -112.5 && angle < -67.5) return 'west';
  return 'northwest';
}

// ─── Nearby Landmark ────────────────────────────────────────
function findNearestLandmark(coord: Coordinate, exclude?: string): string | null {
  let closest: CampusBuilding | null = null;
  let minDist = Infinity;
  for (const b of BUILDINGS) {
    if (b.id === exclude) continue;
    const d = computeDistanceMeters(coord, { latitude: b.latitude, longitude: b.longitude });
    if (d < minDist && d < 200) {
      minDist = d;
      closest = b;
    }
  }
  return closest ? closest.name : null;
}

// ─── Step Generation ────────────────────────────────────────
export function buildDirectionSteps(
  startName: string,
  destName: string,
  start: Coordinate,
  end: Coordinate,
  distanceMeters: number,
  etaMinutes: number,
): DirectionStep[] {
  const cardinal = getCardinal(start, end);
  const landmark = findNearestLandmark(
    { latitude: (start.latitude + end.latitude) / 2, longitude: (start.longitude + end.longitude) / 2 },
    undefined,
  );
  const steps: DirectionStep[] = [];
  let id = 1;

  steps.push({
    id: id++,
    instruction: `Starting from ${startName}. Your destination is ${destName}, about ${formatDistance(distanceMeters)} away (${formatTime(etaMinutes)} walk).`,
    icon: '🚶',
  });

  steps.push({
    id: id++,
    instruction: `Head ${cardinal} from ${startName}.`,
    icon: '🧭',
  });

  if (landmark) {
    steps.push({
      id: id++,
      instruction: `Continue past ${landmark}. Stay on the main walkway.`,
      icon: '➡️',
    });
  }

  if (distanceMeters > 300) {
    steps.push({
      id: id++,
      instruction: `Continue walking ${cardinal} for about ${formatDistance(distanceMeters * 0.6)}.`,
      icon: '🚶',
    });
  }

  steps.push({
    id: id++,
    instruction: `You are approaching ${destName}. Look for the building entrance.`,
    icon: '📍',
  });

  steps.push({
    id: id++,
    instruction: `You have arrived at ${destName}. Gig 'em! 👍`,
    icon: '🎯',
  });

  return steps;
}

// ─── Find Nearest Amenity ───────────────────────────────────
export function findNearestAmenity(
  userCoord: Coordinate,
  type: CampusAmenity['type'],
): CampusAmenity | null {
  const filtered = AMENITIES.filter((a) => a.type === type);
  if (filtered.length === 0) return null;
  let nearest = filtered[0];
  let minDist = computeDistanceMeters(userCoord, { latitude: nearest.latitude, longitude: nearest.longitude });
  for (const a of filtered.slice(1)) {
    const d = computeDistanceMeters(userCoord, { latitude: a.latitude, longitude: a.longitude });
    if (d < minDist) {
      minDist = d;
      nearest = a;
    }
  }
  return nearest;
}
