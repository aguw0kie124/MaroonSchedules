/**
 * Campus Search Service
 * Fuzzy substring search over buildings and amenities
 */

import { BUILDINGS, AMENITIES, CampusBuilding, CampusAmenity } from '../data/campus';
import { computeDistanceMeters, Coordinate } from './campusDirections';

export interface CampusSearchResult {
  id: string;
  label: string;
  subtitle: string;
  kind: 'building' | 'amenity' | 'command';
  building?: CampusBuilding;
  amenity?: CampusAmenity;
  commandType?: string;
  distance?: number;
}

/**
 * Search buildings and amenities by query text
 */
export function searchCampus(
  query: string,
  userCoord?: Coordinate,
  maxResults = 8,
): CampusSearchResult[] {
  const q = query.toLowerCase().trim();
  if (q.length === 0) return [];

  const results: CampusSearchResult[] = [];

  // Search buildings
  for (const b of BUILDINGS) {
    const nameMatch = b.name.toLowerCase().includes(q);
    const shortMatch = b.shortName.toLowerCase().includes(q);
    if (nameMatch || shortMatch) {
      const dist = userCoord
        ? computeDistanceMeters(userCoord, { latitude: b.latitude, longitude: b.longitude })
        : undefined;
      results.push({
        id: `bldg:${b.id}`,
        label: b.name,
        subtitle: `${b.shortName} • ${b.type}`,
        kind: 'building',
        building: b,
        distance: dist,
      });
    }
  }

  // Search amenities
  for (const a of AMENITIES) {
    if (a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)) {
      const dist = userCoord
        ? computeDistanceMeters(userCoord, { latitude: a.latitude, longitude: a.longitude })
        : undefined;
      results.push({
        id: `amenity:${a.id}`,
        label: a.name,
        subtitle: a.type,
        kind: 'amenity',
        amenity: a,
        distance: dist,
      });
    }
  }

  // Sort by distance if available, otherwise alphabetical
  results.sort((a, b) => {
    if (a.distance != null && b.distance != null) return a.distance - b.distance;
    return a.label.localeCompare(b.label);
  });

  return results.slice(0, maxResults);
}

/**
 * Get quick-action pinned items
 */
export function getPinnedItems(): CampusSearchResult[] {
  return [
    {
      id: 'cmd:nearest-restroom',
      label: 'Nearest Restroom',
      subtitle: 'Find the closest restroom',
      kind: 'command',
      commandType: 'nearest-restroom',
    },
    {
      id: 'cmd:nearest-coffee',
      label: 'Nearest Coffee',
      subtitle: 'Find the closest coffee shop',
      kind: 'command',
      commandType: 'nearest-coffee',
    },
    {
      id: 'cmd:nearest-library',
      label: 'Nearest Library',
      subtitle: 'Find the closest library',
      kind: 'command',
      commandType: 'nearest-library',
    },
    {
      id: 'cmd:nearest-dining',
      label: 'Nearest Dining',
      subtitle: 'Find the closest dining hall',
      kind: 'command',
      commandType: 'nearest-dining',
    },
  ];
}

/**
 * Get nearby buildings and amenities ranked by distance
 */
export function getNearbyItems(
  userCoord: Coordinate,
  maxResults = 10,
): CampusSearchResult[] {
  const items: CampusSearchResult[] = [];

  for (const b of BUILDINGS) {
    items.push({
      id: `bldg:${b.id}`,
      label: b.name,
      subtitle: b.shortName,
      kind: 'building',
      building: b,
      distance: computeDistanceMeters(userCoord, { latitude: b.latitude, longitude: b.longitude }),
    });
  }

  for (const a of AMENITIES) {
    items.push({
      id: `amenity:${a.id}`,
      label: a.name,
      subtitle: a.type,
      kind: 'amenity',
      amenity: a,
      distance: computeDistanceMeters(userCoord, { latitude: a.latitude, longitude: a.longitude }),
    });
  }

  items.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return items.slice(0, maxResults);
}
