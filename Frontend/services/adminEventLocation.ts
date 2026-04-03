import { buildCampusDirectory, getCanonicalLocationName } from '../components/places/campusData';

const directory = buildCampusDirectory();
const FALLBACK_LOCATION = directory.find((item) => item.location === 'Memorial Student Center') || directory[0];

export function getAdminLocationSuggestions(query: string, limit: number = 6) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  return directory
    .filter((item) => {
      const location = item.location.toLowerCase();
      const shortName = item.shortName?.toLowerCase() || '';
      return location.includes(trimmed) || shortName.includes(trimmed);
    })
    .slice(0, limit);
}

export function resolveAdminEventLocation(locationName?: string | null) {
  const trimmed = locationName?.trim();
  if (!trimmed) {
    return {
      location_name: FALLBACK_LOCATION.location,
      lat: FALLBACK_LOCATION.coord.lat,
      lng: FALLBACK_LOCATION.coord.lng,
    };
  }

  const canonical = getCanonicalLocationName(trimmed);
  const match = directory.find(
    (item) => getCanonicalLocationName(item.location) === canonical,
  );

  if (match) {
    return {
      location_name: match.location,
      lat: match.coord.lat,
      lng: match.coord.lng,
    };
  }

  if (trimmed.toLowerCase() === 'virtual') {
    return {
      location_name: FALLBACK_LOCATION.location,
      lat: FALLBACK_LOCATION.coord.lat,
      lng: FALLBACK_LOCATION.coord.lng,
    };
  }

  return {
    location_name: FALLBACK_LOCATION.location,
    lat: FALLBACK_LOCATION.coord.lat,
    lng: FALLBACK_LOCATION.coord.lng,
  };
}
