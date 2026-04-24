import { searchGlobalMapPlaces, fetchGlobalMapRoute } from '../api/client';
import type { CampusLocation, LocationType } from '../components/places/types';
import type { Coordinate, DirectionStep, WalkingRoute } from './campusDirections';
import { TAMU_CENTER } from '../components/places/types';
import { computeDistanceMeters } from './campusDirections';

export type GlobalRouteMode = 'walk' | 'bike';

export interface GlobalPlaceResult {
  id: string;
  name: string;
  display_name: string;
  short_name?: string;
  lat: number;
  lng: number;
  location_type: LocationType;
  category?: string;
  subcategory?: string;
  address?: string | null;
  country_code?: string | null;
  importance?: number;
  source?: string;
}

interface GlobalSearchResponse {
  provider?: string;
  results?: GlobalPlaceResult[];
}

interface GlobalRouteApiStep {
  id: number;
  instruction: string;
  icon: string;
  distance_meters?: number;
  duration_seconds?: number;
}

interface GlobalRouteResponse {
  provider?: string;
  mode: GlobalRouteMode;
  distance_meters: number;
  duration_seconds: number;
  estimated_time_minutes: number;
  polyline: Array<{ latitude: number; longitude: number }>;
  steps: GlobalRouteApiStep[];
}

export interface GlobalRouteResult {
  route: WalkingRoute;
  steps: DirectionStep[];
  mode: GlobalRouteMode;
  provider?: string;
}

const NOMINATIM_FALLBACK_URL = 'https://nominatim.openstreetmap.org/search';
const VALHALLA_FALLBACK_URL = 'https://valhalla1.openstreetmap.de/route';
const DIRECT_MAP_TIMEOUT_MS = 15000;

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function buildInitialism(value: string) {
  const stopWords = new Set(['and', 'at', 'for', 'in', 'of', 'the']);
  return value
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !stopWords.has(part.toLowerCase()))
    .map((part) => part[0].toUpperCase())
    .join('');
}

function buildGlobalAliases(result: GlobalPlaceResult) {
  const aliases = new Set<string>();
  const name = normalizeText(result.name);
  const shortName = normalizeText(result.short_name);
  const displayName = normalizeText(result.display_name);

  if (shortName && shortName.toLowerCase() !== name.toLowerCase()) {
    aliases.add(shortName);
  }

  if (name.toLowerCase().startsWith('the ')) {
    aliases.add(name.slice(4));
  }

  if (displayName) {
    const firstDisplaySegment = displayName.split(',')[0]?.trim();
    if (
      firstDisplaySegment &&
      firstDisplaySegment.toLowerCase() !== name.toLowerCase()
    ) {
      aliases.add(firstDisplaySegment);
    }
  }

  const universityMatch = name.match(/^the\s+university\s+of\s+(.+?)\s+at\s+(.+)$/i)
    || name.match(/^university\s+of\s+(.+?)\s+at\s+(.+)$/i);
  if (universityMatch) {
    const subject = universityMatch[1].trim();
    const campus = universityMatch[2].trim();
    const subjectInitialism = buildInitialism(subject);
    if (subjectInitialism) {
      aliases.add(`U${subjectInitialism}`);
      aliases.add(`U${subjectInitialism} ${toTitleCase(campus)}`);
    }
  }

  const generalInitialism = buildInitialism(name);
  if (generalInitialism.length >= 2 && generalInitialism.length <= 6) {
    aliases.add(generalInitialism);
  }

  return Array.from(aliases).filter(Boolean);
}

function requestTimeout<T>(promise: Promise<T>, timeoutMs = DIRECT_MAP_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Request timed out.')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function decodeValhallaShape(shape: string, precision = 6) {
  const coordinates: Array<{ latitude: number; longitude: number }> = [];
  const factor = 10 ** precision;
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < shape.length) {
    let result = 0;
    let shift = 0;
    let value = 0;
    do {
      value = shape.charCodeAt(index) - 63;
      index += 1;
      result |= (value & 0x1f) << shift;
      shift += 5;
    } while (value >= 0x20);
    latitude += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      value = shape.charCodeAt(index) - 63;
      index += 1;
      result |= (value & 0x1f) << shift;
      shift += 5;
    } while (value >= 0x20);
    longitude += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      latitude: latitude / factor,
      longitude: longitude / factor,
    });
  }

  return coordinates;
}

async function searchGlobalPlacesDirect(
  query: string,
  limit = 8,
): Promise<CampusLocation[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(Math.max(1, Math.min(limit, 8))),
    dedupe: '1',
  });
  const response = await requestTimeout(fetch(`${NOMINATIM_FALLBACK_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  }));

  if (!response.ok) {
    throw new Error(`Worldwide search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Array<Record<string, any>>;
  return (payload || []).map((item) => toGlobalCampusLocation({
    id: `nominatim:${item.osm_type || 'place'}:${item.osm_id || item.place_id || item.display_name}`,
    name: item.name || String(item.display_name || '').split(',')[0] || 'Unknown place',
    display_name: item.display_name || '',
    short_name: item.name || String(item.display_name || '').split(',')[0] || 'Unknown place',
    lat: Number(item.lat),
    lng: Number(item.lon),
    location_type: classifyLocationType(item.category, item.type),
    category: item.category || undefined,
    subcategory: item.type || undefined,
    address: typeof item.address === 'object'
      ? [
          item.address.road,
          item.address.city || item.address.town || item.address.village,
          item.address.state,
          item.address.country,
        ].filter(Boolean).join(', ')
      : item.display_name || undefined,
    country_code: item.address?.country_code || undefined,
    importance: Number(item.importance || 0),
    source: 'nominatim',
  }));
}

async function buildGlobalRouteDirect(params: {
  origin: Coordinate;
  destination: Coordinate;
  mode: GlobalRouteMode;
  originName?: string;
  destinationName?: string;
}): Promise<GlobalRouteResult> {
  const costingByMode: Record<GlobalRouteMode, 'pedestrian' | 'bicycle'> = {
    walk: 'pedestrian',
    bike: 'bicycle',
  };
  const response = await requestTimeout(fetch(VALHALLA_FALLBACK_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locations: [
        { lat: params.origin.latitude, lon: params.origin.longitude },
        { lat: params.destination.latitude, lon: params.destination.longitude },
      ],
      costing: costingByMode[params.mode],
      directions_options: {
        units: 'miles',
      },
    }),
  }), 20000);

  if (!response.ok) {
    throw new Error(`Worldwide routing failed with status ${response.status}.`);
  }

  const payload = await response.json() as any;
  const trip = payload?.trip || {};
  const legs = Array.isArray(trip.legs) ? trip.legs : [];
  const summary = trip.summary || {};
  const polyline = legs.flatMap((leg: any, index: number) => {
    const decoded = leg?.shape ? decodeValhallaShape(String(leg.shape), 6) : [];
    return index === 0 ? decoded : decoded.slice(1);
  });
  const steps: DirectionStep[] = legs.flatMap((leg: any) =>
    (Array.isArray(leg?.maneuvers) ? leg.maneuvers : []).map((maneuver: any, index: number) => {
      const instruction = String(maneuver?.instruction || '').trim() || 'Continue';
      const lower = instruction.toLowerCase();
      return {
        id: Number(maneuver?.begin_shape_index ?? index + 1),
        instruction,
        icon: lower.includes('arrive')
          ? '📍'
          : lower.includes('roundabout')
            ? '↺'
            : lower.includes('ramp') || lower.includes('merge') || lower.includes('exit')
              ? '🛣️'
              : '🧭',
      };
    }),
  );

  const distanceMeters = Number(summary.length || 0) * 1609.344;
  const durationSeconds = Number(summary.time || 0);
  return {
    provider: 'valhalla-direct',
    mode: params.mode,
    route: {
      start: params.origin,
      end: params.destination,
      distanceMeters,
      estimatedTimeMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
      polyline: polyline.length > 0 ? polyline : [params.origin, params.destination],
    },
    steps,
  };
}

export function classifyLocationType(category?: string | null, subcategory?: string | null): LocationType {
  const normalized = `${normalizeText(category).toLowerCase()} ${normalizeText(subcategory).toLowerCase()}`;

  if (/(restaurant|fast_food|cafe|bar|pub|food_court)/.test(normalized)) return 'Dining';
  if (/library/.test(normalized)) return 'Library';
  if (/(fitness|sports|stadium|park|pitch)/.test(normalized)) return 'Rec';
  if (/(parking|garage)/.test(normalized)) return 'Parking';
  if (/(school|college|university)/.test(normalized)) return 'Academic';
  if (/(museum|memorial|monument|attraction|viewpoint)/.test(normalized)) return 'Landmark';
  if (/(residential|house|apartments|housing)/.test(normalized)) return 'Housing';
  return 'General';
}

export function toGlobalCampusLocation(result: GlobalPlaceResult): CampusLocation {
  const resolvedType = result.location_type || classifyLocationType(result.category, result.subcategory);
  return {
    placeId: result.id,
    location: result.name,
    shortName: result.short_name || result.name,
    percent_full: 0,
    type: resolvedType,
    is_live: false,
    available_seats: null,
    coord: {
      lat: result.lat,
      lng: result.lng,
    },
    aliases: buildGlobalAliases(result),
    address: result.address || undefined,
    description: result.display_name || result.address || undefined,
    searchImportance: Number.isFinite(result.importance) ? result.importance : undefined,
    source: 'global',
  };
}

export function formatGlobalSearchSubtitle(location: CampusLocation) {
  const parts = [location.address, location.type].filter(Boolean).map((value) => String(value));
  return parts.join(' • ');
}

export async function searchGlobalPlaces(
  query: string,
  options: { limit?: number } = {},
): Promise<CampusLocation[]> {
  try {
    const payload = (await searchGlobalMapPlaces(query, options.limit ?? 8)) as GlobalSearchResponse;
    const results = Array.isArray(payload?.results) ? payload.results : [];
    return results.map(toGlobalCampusLocation);
  } catch (_error) {
    return searchGlobalPlacesDirect(query, options.limit ?? 8);
  }
}

export async function buildGlobalRoute(params: {
  origin: Coordinate;
  destination: Coordinate;
  mode: GlobalRouteMode;
  originName?: string;
  destinationName?: string;
}): Promise<GlobalRouteResult> {
  try {
    const payload = (await fetchGlobalMapRoute({
      origin: params.origin,
      destination: params.destination,
      mode: params.mode,
      origin_name: params.originName,
      destination_name: params.destinationName,
    })) as GlobalRouteResponse;

    return {
      provider: payload.provider,
      mode: payload.mode,
      route: {
        start: params.origin,
        end: params.destination,
        distanceMeters: payload.distance_meters,
        estimatedTimeMinutes: payload.estimated_time_minutes,
        polyline: Array.isArray(payload.polyline) ? payload.polyline : [params.origin, params.destination],
      },
      steps: Array.isArray(payload.steps)
        ? payload.steps.map((step) => ({
            id: step.id,
            instruction: step.instruction,
            icon: step.icon,
          }))
        : [],
    };
  } catch (_error) {
    return buildGlobalRouteDirect(params);
  }
}

export function isCoordinateNearTexasAM(
  coordinate: Coordinate,
  radiusMeters = 20000,
) {
  return computeDistanceMeters(coordinate, {
    latitude: TAMU_CENTER.latitude,
    longitude: TAMU_CENTER.longitude,
  }) <= radiusMeters;
}
