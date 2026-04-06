/**
 * Campus Search Service
 * Fuzzy search over the expanded campus place directory
 */

import { buildExpandedPlacesDirectory, getLocationSelectionId } from '../components/places/campusData';
import type { CampusLocation } from '../components/places/types';
import { computeDistanceMeters, Coordinate } from './campusDirections';
import { searchCampusLocations } from '../components/places/searchUtils';

export interface CampusSearchResult {
  id: string;
  label: string;
  subtitle: string;
  kind: 'location' | 'command';
  location?: CampusLocation;
  commandType?: string;
  query?: string;
  distance?: number;
}

const CAMPUS_LOCATIONS = buildExpandedPlacesDirectory();
const BROWSABLE_CAMPUS_LOCATIONS = CAMPUS_LOCATIONS.filter((location) => !location.searchOnly);

function formatLocationSubtitle(location: CampusLocation) {
  const parts = [location.shortName, location.type, location.address]
    .filter((value) => !!value)
    .map((value) => String(value));
  return parts.join(' • ');
}

/**
 * Search campus locations by query text
 */
export function searchCampus(
  query: string,
  userCoord?: Coordinate,
  maxResults = 8,
): CampusSearchResult[] {
  const q = query.toLowerCase().trim();
  if (q.length === 0) return [];

  const matchedLocations = searchCampusLocations(
    CAMPUS_LOCATIONS,
    query,
    maxResults * 2,
    { referenceCoord: userCoord ?? null },
  );
  const results: CampusSearchResult[] = matchedLocations.map((location) => ({
    id: `loc:${getLocationSelectionId(location)}`,
    label: location.location,
    subtitle: formatLocationSubtitle(location),
    kind: 'location',
    location,
    distance: userCoord
      ? computeDistanceMeters(userCoord, {
          latitude: location.coord.lat,
          longitude: location.coord.lng,
        })
      : undefined,
  }));

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
  const items: CampusSearchResult[] = BROWSABLE_CAMPUS_LOCATIONS.map((location) => ({
    id: `loc:${getLocationSelectionId(location)}`,
    label: location.location,
    subtitle: formatLocationSubtitle(location),
    kind: 'location',
    location,
    distance: computeDistanceMeters(userCoord, {
      latitude: location.coord.lat,
      longitude: location.coord.lng,
    }),
  }));

  items.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return items.slice(0, maxResults);
}
