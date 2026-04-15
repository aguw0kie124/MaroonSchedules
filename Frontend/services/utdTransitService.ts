import UTD_GTFS_STATIC from '../data/utd_gtfs_static.json';

const ROUTE_COLORS = ['#98CC67', '#6BCCE7', '#5AA95A', '#2E8B57', '#1E7A4D'];
const VEHICLE_TTL_MS = 5000;
const DART_API_KEY = process.env.EXPO_PUBLIC_DART_API_KEY;

const VEHICLE_ENDPOINT_CANDIDATES = [
  'https://api.dart.org/gtfs-realtime/vehicle-positions?format=json',
  'https://api.dart.org/gtfsrealtime/vehiclepositions?format=json',
  'https://api.dart.org/gtfs/vehiclepositions?format=json',
];

type UtdRouteRecord = {
  Key: string;
  Name: string;
  ShortName: string;
  Color?: string;
  TextColor?: string;
};

type PatternRecord = {
  points: Array<{ latitude: number; longitude: number }>;
  paths?: Array<{
    DirectionName?: string;
    points: Array<{ latitude: number; longitude: number }>;
  }>;
  stops: Array<{
    StopCode: string;
    Name: string;
    Latitude: number;
    Longitude: number;
    DirectionName?: string;
  }>;
};

type UtdDataset = {
  routes: UtdRouteRecord[];
  patternsByRoute: Record<string, PatternRecord>;
  activeRouteIds?: string[];
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface Route {
  id: string;
  key: string;
  name: string;
  shortName: string;
  color: string;
}

export interface Bus {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  routeId?: string;
  routeShortName?: string;
  routeName?: string;
  direction?: string;
  updatedAt?: string;
}

function normalizeRouteColor(route: UtdRouteRecord): string {
  if (route.Color && route.Color.trim().length > 0) {
    return route.Color.startsWith('#') ? route.Color : `#${route.Color}`;
  }

  let hash = 0;
  const key = route.Key || route.ShortName || route.Name || 'utd';
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ROUTE_COLORS[hash % ROUTE_COLORS.length];
}

function parseVehiclesFromPayload(payload: any): any[] {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.vehicles)) {
    return payload.vehicles;
  }

  if (Array.isArray(payload.content)) {
    return payload.content;
  }

  if (Array.isArray(payload.entity)) {
    return payload.entity
      .map((entity: any) => {
        const vehicle = entity?.vehicle || entity;
        const position = vehicle?.position || vehicle;
        const trip = vehicle?.trip || {};
        const latitude = position?.latitude;
        const longitude = position?.longitude;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return null;
        }

        return {
          Id: entity?.id || vehicle?.vehicle?.id || vehicle?.id || `${trip?.trip_id || ''}:${latitude}:${longitude}`,
          Key: entity?.id || vehicle?.vehicle?.id || vehicle?.id || `${trip?.trip_id || ''}:${latitude}:${longitude}`,
          Name: vehicle?.vehicle?.label || vehicle?.label || trip?.trip_id || 'UTD Shuttle',
          Latitude: latitude,
          Longitude: longitude,
          Heading: position?.bearing || position?.heading || 0,
          RouteId: trip?.route_id || vehicle?.routeId,
          RouteShortName: trip?.route_id || vehicle?.routeShortName,
          RouteName: vehicle?.routeName || trip?.trip_headsign,
          DirectionName: vehicle?.current_status || vehicle?.direction || undefined,
          timestamp: vehicle?.timestamp || entity?.timestamp || undefined,
        };
      })
      .filter(Boolean);
  }

  return [];
}

function toMapVehicle(raw: any): any {
  return {
    Id: raw.Id || raw.id || raw.vehicleId || raw.Key || `${raw.Latitude}:${raw.Longitude}`,
    Key: raw.Key || raw.key || raw.Id || raw.id || raw.vehicleId || `${raw.Latitude}:${raw.Longitude}`,
    Name: raw.Name || raw.name || raw.label || 'UTD Shuttle',
    Latitude: typeof raw.Latitude === 'number' ? raw.Latitude : raw.latitude,
    Longitude: typeof raw.Longitude === 'number' ? raw.Longitude : raw.longitude,
    Heading: raw.Heading ?? raw.heading ?? raw.bearing ?? 0,
    RouteId: raw.RouteId || raw.routeId || raw.route_id,
    RouteShortName: raw.RouteShortName || raw.routeShortName || raw.route_id,
    RouteName: raw.RouteName || raw.routeName || raw.trip_headsign,
    DirectionName: raw.DirectionName || raw.direction || raw.current_status,
    timestamp: raw.timestamp || raw.updatedAt,
  };
}

const dataset = UTD_GTFS_STATIC as UtdDataset;
const routes = (dataset.routes || []).map((route) => ({
  ...route,
  Color: normalizeRouteColor(route),
}));
const routesByKey = new Map(routes.map((route) => [route.Key, route]));
const routesByShortName = new Map(routes.map((route) => [route.ShortName, route]));
const activeRouteIds = dataset.activeRouteIds || routes.map((route) => route.ShortName || route.Key);

export const utdTransitService = {
  vehiclesCache: null as CacheEntry<any[]> | null,

  async getTransitRoutes(): Promise<{ routes: any[]; activeIds: string[] }> {
    return { routes, activeIds: activeRouteIds };
  },

  async getActiveRoutes(): Promise<string[]> {
    return activeRouteIds;
  },

  async getRoutesMetadata(): Promise<any[]> {
    return routes;
  },

  async getRoutePattern(routeId: string): Promise<{ points: any[]; stops: any[]; paths?: any[] }> {
    const pattern = dataset.patternsByRoute?.[routeId];
    if (pattern) {
      return {
        points: pattern.points || [],
        stops: pattern.stops || [],
        paths: pattern.paths || [],
      };
    }

    const byShortName = routesByShortName.get(routeId);
    if (byShortName) {
      const fallback = dataset.patternsByRoute?.[byShortName.Key];
      if (fallback) {
        return {
          points: fallback.points || [],
          stops: fallback.stops || [],
          paths: fallback.paths || [],
        };
      }
    }

    return { points: [], stops: [], paths: [] };
  },

  async getVehicles(routeId?: string): Promise<any[]> {
    const now = Date.now();
    if (this.vehiclesCache && now - this.vehiclesCache.timestamp < VEHICLE_TTL_MS) {
      const cached = this.vehiclesCache.data || [];
      if (!routeId) return cached;
      return cached.filter((vehicle) => {
        const rid = vehicle.RouteId || vehicle.routeId || vehicle.RouteShortName || vehicle.routeShortName;
        return rid === routeId;
      });
    }

    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
    };
    if (DART_API_KEY) {
      requestHeaders['Ocp-Apim-Subscription-Key'] = DART_API_KEY;
    }

    let resolvedVehicles: any[] = [];
    for (const endpoint of VEHICLE_ENDPOINT_CANDIDATES) {
      try {
        const response = await fetch(endpoint, { headers: requestHeaders });
        if (!response.ok) continue;
        const payload = await response.json();
        const parsed = parseVehiclesFromPayload(payload).map(toMapVehicle).filter((vehicle) => {
          const lat = vehicle.Latitude;
          const lon = vehicle.Longitude;
          return typeof lat === 'number' && typeof lon === 'number';
        });

        if (parsed.length > 0) {
          resolvedVehicles = parsed;
          break;
        }
      } catch {
        // Try the next candidate endpoint.
      }
    }

    const mappedVehicles = resolvedVehicles.map((vehicle) => {
      const route = routesByKey.get(vehicle.RouteId) || routesByShortName.get(vehicle.RouteShortName);
      return {
        ...vehicle,
        RouteShortName: route?.ShortName || vehicle.RouteShortName || vehicle.RouteId,
        RouteName: route?.Name || vehicle.RouteName || 'UTD Shuttle',
        RouteColor: route?.Color || this.getRouteColor(vehicle.RouteId || vehicle.RouteShortName),
      };
    });

    this.vehiclesCache = {
      data: mappedVehicles,
      timestamp: now,
    };

    if (!routeId) return mappedVehicles;
    return mappedVehicles.filter((vehicle) => {
      const rid = vehicle.RouteId || vehicle.RouteShortName;
      return rid === routeId;
    });
  },

  async getRouteStops(routeId: string): Promise<any[]> {
    const { stops } = await this.getRoutePattern(routeId);
    return stops;
  },

  getRouteColor(routeId?: string): string {
    if (!routeId) return ROUTE_COLORS[0];
    const exact = routesByKey.get(routeId) || routesByShortName.get(routeId);
    if (exact?.Color) return exact.Color;

    let hash = 0;
    const value = routeId.toString();
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return ROUTE_COLORS[hash % ROUTE_COLORS.length];
  },
};

