import { apiFetch } from '../api/client';

const BASE_URL = 'https://aggiespirit.ts.tamu.edu';
const ROUTE_COLORS = ['#500000', '#7E0000', '#B34100', '#0B6E4F', '#165DFF', '#6B3FA0', '#007A78', '#A63D40'];

// TTL Constants
const METADATA_TTL = 1000 * 60 * 5; // 5 minutes
const PATTERN_TTL = 1000 * 60 * 30; // 30 minutes
const VEHICLE_TTL = 1000 * 5; // 5 seconds (internal buffer)

/** Transit polls often; keep tighter than generic API calls so a bad host fails fast. 
 * Patterns and heavy geometry need more headroom than live bus locations.
 */
const TRANSIT_FETCH_TIMEOUT_MS = 30000;
const TRANSIT_LIVE_TIMEOUT_MS = 15000;

export interface BusRoute {
    id: string;
    name: string;
    shortName: string;
    color: string;
}

export interface BusVehicle {
    id: string;
    name: string;
    lat: number;
    lng: number;
    routeId: string;
    heading: number;
    routeShortName?: string;
    routeName?: string;
}

export interface BusStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export const transitService = {
    auth: null as any,
    routesCache: null as CacheEntry<{ routes: any[], activeIds: string[] }> | null,
    patternCache: new Map<string, CacheEntry<{ points: any[]; stops: any[] }>>(),
    vehicleCache: new Map<string, CacheEntry<any[]>>(),
    timetableCache: new Map<string, CacheEntry<any[]>>(),

    /**
     * Initializes authentication for MaroonRides/AggieSpirit
     */
    async initAuth(): Promise<any> {
        if (this.auth) return this.auth;
        try {
            console.log('[TransitService] Initializing MaroonRides dynamic auth...');
            const authResponse = await fetch('https://auth.maroonrides.app');
            const authCodeB64 = await authResponse.text();
            let authCode = atob(authCodeB64);
            const executionScript = `${authCode}\ngetAuthentication()`;
            const headers = await eval(executionScript);
            if (headers) {
                this.auth = headers;
                return this.auth;
            }
        } catch (error) {
            console.warn('[TransitService] Dynamic auth failed, falling back...');
            return this.initManualAuth();
        }
        return null;
    },

    async initManualAuth(): Promise<any> {
        try {
            const response = await fetch(BASE_URL);
            const html = await response.text();
            const setCookie = response.headers.get('set-cookie');
            let formattedCookies = '';
            if (setCookie) {
                setCookie.split(', ').forEach(p => {
                    const cookie = p.split(';')[0];
                    if (cookie) formattedCookies += cookie + '; ';
                });
            }
            const htmlTokenMatch = html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/);
            const cookieTokenMatch = formattedCookies.match(/\.MyRide\.RequestVerificationToken=([^; ]+)/);
            if (htmlTokenMatch && cookieTokenMatch) {
                this.auth = {
                    'Cookie': formattedCookies,
                    'requestverificationtoken': `${htmlTokenMatch[1]}:${cookieTokenMatch[1]}`,
                    'X-Requested-With': 'XMLHttpRequest'
                };
                return this.auth;
            }
        } catch (e) {
            console.warn('[TransitService] Manual fallback failed:', e);
        }
        return null;
    },

    /**
     * Consolidated method to fetch metadata and active status for all routes.
     * Uses TTL caching to reduce redundant API calls.
     */
    async getTransitRoutes(): Promise<{ routes: any[], activeIds: string[] }> {
        const now = Date.now();
        if (this.routesCache && (now - this.routesCache.timestamp < METADATA_TTL)) {
            return this.routesCache.data;
        }

        try {
            const response = await apiFetch('/traffic/transit/routes', {}, TRANSIT_FETCH_TIMEOUT_MS);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            const routes = (data.routes || []).map((r: any) => ({
                Key: r.key || r.Key,
                Name: r.name || r.Name,
                ShortName: r.shortName || r.ShortName,
                Color: r.color || r.Color || this.getRouteColor(r.key || r.Key || r.shortName || r.ShortName || r.name || r.Name),
            }));
            const activeIds = data.activeRouteIds || [];
            
            const result = { routes, activeIds };
            this.routesCache = { data: result, timestamp: now };
            return result;
        } catch (error) {
            console.warn('[TransitService] Error fetching routes:', error);
            return this.routesCache?.data || { routes: [], activeIds: [] };
        }
    },

    /**
     * Legacy shim for getActiveRoutes
     */
    async getActiveRoutes(): Promise<string[]> {
        const { activeIds } = await this.getTransitRoutes();
        return activeIds;
    },

    /**
     * Legacy shim for getRoutesMetadata
     */
    async getRoutesMetadata(): Promise<any[]> {
        const { routes } = await this.getTransitRoutes();
        return routes;
    },

    /**
     * Fetches route patterns (polylines) and stops. Uses TTL caching.
     */
    async getRoutePattern(routeId: string): Promise<{ points: any[], stops: any[], paths?: any[] }> {
        const now = Date.now();
        const cached = this.patternCache.get(routeId);
        if (cached && (now - cached.timestamp < PATTERN_TTL)) {
            return cached.data;
        }

        try {
            const response = await apiFetch(
                `/traffic/transit/route/${encodeURIComponent(routeId)}`,
                {},
                TRANSIT_FETCH_TIMEOUT_MS,
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            const points = (data.points || []).map((pt: any) => ({
                latitude: pt.latitude,
                longitude: pt.longitude
            }));
            
            const paths = (data.paths || []).map((path: any) => ({
                DirectionName: path.DirectionName,
                points: (path.points || []).map((p: any) => ({
                    latitude: p.latitude,
                    longitude: p.longitude
                }))
            }));
            
            const stops: any[] = [];
            const seenStops = new Set();
            (data.stops || []).forEach((stop: any) => {
                if (!seenStops.has(stop.StopCode)) {
                    seenStops.add(stop.StopCode);
                    stops.push(stop);
                }
            });

            const result = { points, stops, paths };
            this.patternCache.set(routeId, { data: result, timestamp: now });
            return result;
        } catch (error) {
            console.warn('[TransitService] Error fetching patterns:', error);
            return cached?.data || { points: [], stops: [], paths: [] };
        }
    },

    /**
     * Fetches real-time vehicle locations. Internal buffer prevents slamming the API.
     */
    async getVehicles(routeId?: string): Promise<any[]> {
        const now = Date.now();
        const cacheKey = routeId || '__all__';
        const cached = this.vehicleCache.get(cacheKey);
        
        if (cached && (now - cached.timestamp < 1000)) { // 1s deduplication
            return cached.data;
        }

        try {
            const query = routeId ? `?route_id=${encodeURIComponent(routeId)}` : '';
            const response = await apiFetch(`/traffic/transit/vehicles${query}`, {}, TRANSIT_LIVE_TIMEOUT_MS);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const vehicles = payload.vehicles || [];

            this.vehicleCache.set(cacheKey, { data: vehicles, timestamp: now });
            return vehicles;
        } catch (error) {
            console.warn('[TransitService] Error fetching vehicles:', error);
            return cached?.data || [];
        }
    },

    async getRouteStops(routeId: string): Promise<any[]> {
        const { stops } = await this.getRoutePattern(routeId);
        return stops;
    },

    async getRouteTimetable(routeId: string, maxStops = 12): Promise<any[]> {
        const now = Date.now();
        const cacheKey = `${routeId}:${maxStops}`;
        const cached = this.timetableCache.get(cacheKey);
        if (cached && (now - cached.timestamp < 30000)) {
            return cached.data;
        }

        try {
            const response = await apiFetch(
                `/traffic/transit/timetable/${encodeURIComponent(routeId)}?max_stops=${encodeURIComponent(String(maxStops))}`,
                {},
                TRANSIT_FETCH_TIMEOUT_MS,
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const entries = Array.isArray(payload?.entries) ? payload.entries : [];
            this.timetableCache.set(cacheKey, { data: entries, timestamp: now });
            return entries;
        } catch (error) {
            console.warn('[TransitService] Error fetching timetable:', error);
            return cached?.data || [];
        }
    },

    getRouteColor(routeId?: string): string {
        const value = (routeId || '').toString();
        if (!value) return ROUTE_COLORS[0];
        let hash = 0;
        for (let index = 0; index < value.length; index += 1) {
            hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
        }
        return ROUTE_COLORS[hash % ROUTE_COLORS.length];
    }
};
