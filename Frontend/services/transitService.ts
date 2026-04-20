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
const TRANSIT_TRIP_PLAN_TIMEOUT_MS = 12000;

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

export interface TransitFreshness {
    source: 'live' | 'schedule_fallback' | 'stale_cache' | 'unavailable';
    live?: boolean;
    used_cache?: boolean;
    used_schedule_fallback?: boolean;
    fetched_at?: string;
    age_seconds?: number;
    realtime_stop_count?: number;
    scheduled_stop_count?: number;
}

export interface VehicleSnapshot {
    vehicles: any[];
    freshness: TransitFreshness;
}

export interface TimetableSnapshot {
    route?: any;
    entries: any[];
    freshness: TransitFreshness;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export const transitService = {
    auth: null as any,
    routesCache: null as CacheEntry<{ routes: any[], activeIds: string[] }> | null,
    patternCache: new Map<string, CacheEntry<{ points: any[]; stops: any[] }>>(),
    vehicleCache: new Map<string, CacheEntry<VehicleSnapshot>>(),
    ongoingVehicleRequests: new Map<string, Promise<VehicleSnapshot>>(),
    timetableCache: new Map<string, CacheEntry<TimetableSnapshot>>(),
    prewarmPromise: null as Promise<void> | null,

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
     * Fetches multiple route patterns in a single bulk request.
     */
    async getBulkRoutePatterns(routeIds: string[]): Promise<Record<string, { points: any[], stops: any[], paths?: any[] }>> {
        if (routeIds.length === 0) return {};
        const now = Date.now();
        const resultsFromCache: Record<string, { points: any[], stops: any[], paths?: any[] }> = {};
        const missingRouteIds: string[] = [];

        routeIds.forEach((routeId) => {
            const cached = this.patternCache.get(routeId);
            if (cached && (now - cached.timestamp < PATTERN_TTL)) {
                resultsFromCache[routeId] = cached.data;
                return;
            }
            missingRouteIds.push(routeId);
        });

        if (missingRouteIds.length === 0) {
            return resultsFromCache;
        }
        
        try {
            const query = `ids=${encodeURIComponent(missingRouteIds.join(','))}`;
            const response = await apiFetch(`/traffic/transit/patterns?${query}`, {}, TRANSIT_FETCH_TIMEOUT_MS);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const results = await response.json();
            const normalizedResults: Record<string, { points: any[], stops: any[], paths?: any[] }> = { ...resultsFromCache };
            
            // Cache each result individually so subsequent single-route requests are zero-cost
            Object.entries(results).forEach(([rk, data]: [string, any]) => {
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
                const stops = data.stops || [];
                
                this.patternCache.set(rk, { 
                    data: { points, stops, paths }, 
                    timestamp: now 
                });
                normalizedResults[rk] = { points, stops, paths };
            });
            
            return normalizedResults;
        } catch (error) {
            console.warn('[TransitService] Error fetching bulk patterns:', error);
            return resultsFromCache;
        }
    },

    /**
     * Fetches real-time vehicle locations. Internal buffer prevents slamming the API.
     */
    async getVehiclesSnapshot(routeId?: string): Promise<VehicleSnapshot> {
        const now = Date.now();
        const cacheKey = routeId || '__all__';
        
        // 1. Check for ongoing request
        const ongoing = this.ongoingVehicleRequests.get(cacheKey);
        if (ongoing) return ongoing;

        // 2. Check for fresh cache (1s deduplication)
        const cached = this.vehicleCache.get(cacheKey);
        if (cached && (now - cached.timestamp < 500)) {
            return cached.data;
        }

        const requestPromise = (async () => {
            try {
                const query = routeId ? `?route_id=${encodeURIComponent(routeId)}` : '';
                const response = await apiFetch(`/traffic/transit/vehicles${query}`, {}, TRANSIT_LIVE_TIMEOUT_MS);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                const snapshot: VehicleSnapshot = {
                    vehicles: Array.isArray(payload?.vehicles) ? payload.vehicles : [],
                    freshness: {
                        source: payload?.source || 'unavailable',
                        live: Boolean(payload?.live),
                        used_cache: Boolean(payload?.used_cache),
                        fetched_at: payload?.fetched_at,
                        age_seconds: typeof payload?.age_seconds === 'number' ? payload.age_seconds : undefined,
                    },
                };

                this.vehicleCache.set(cacheKey, { data: snapshot, timestamp: now });
                return snapshot;
            } catch (error) {
                console.warn('[TransitService] Error fetching vehicles:', error);
                return cached?.data || {
                    vehicles: [],
                    freshness: { source: 'unavailable' },
                };
            } finally {
                this.ongoingVehicleRequests.delete(cacheKey);
            }
        })();

        this.ongoingVehicleRequests.set(cacheKey, requestPromise);
        return requestPromise;
    },

    async getVehicles(routeId?: string): Promise<any[]> {
        const snapshot = await this.getVehiclesSnapshot(routeId);
        return snapshot.vehicles;
    },

    async getRouteStops(routeId: string): Promise<any[]> {
        const { stops } = await this.getRoutePattern(routeId);
        return stops;
    },

    async getRouteTimetableSnapshot(routeId: string, maxStops = 12): Promise<TimetableSnapshot> {
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
            const snapshot: TimetableSnapshot = {
                route: payload?.route,
                entries: Array.isArray(payload?.entries) ? payload.entries : [],
                freshness: {
                    source: payload?.freshness?.source || 'unavailable',
                    live: Boolean(payload?.freshness?.live),
                    used_schedule_fallback: Boolean(payload?.freshness?.used_schedule_fallback),
                    fetched_at: payload?.freshness?.fetched_at,
                    age_seconds: typeof payload?.freshness?.age_seconds === 'number'
                        ? payload.freshness.age_seconds
                        : undefined,
                    realtime_stop_count: payload?.freshness?.realtime_stop_count,
                    scheduled_stop_count: payload?.freshness?.scheduled_stop_count,
                },
            };
            const shouldCache =
                snapshot.freshness.source !== 'unavailable' || snapshot.entries.length > 0;
            if (shouldCache) {
                this.timetableCache.set(cacheKey, { data: snapshot, timestamp: now });
            } else {
                this.timetableCache.delete(cacheKey);
            }
            return snapshot;
        } catch (error) {
            console.warn('[TransitService] Error fetching timetable:', error);
            return cached?.data || {
                entries: [],
                freshness: { source: 'unavailable' },
            };
        }
    },

    async getRouteTimetable(routeId: string, maxStops = 12): Promise<any[]> {
        const snapshot = await this.getRouteTimetableSnapshot(routeId, maxStops);
        return snapshot.entries;
    },

    async getTransitTimetableDb(stopCode: string, routeNumber: string = '', startTime?: string): Promise<any[]> {
        try {
            const query = `route_number=${encodeURIComponent(routeNumber)}${startTime ? `&start_time=${encodeURIComponent(startTime)}` : ''}`;
            const response = await apiFetch(
                `/traffic/transit/timetable/db/${encodeURIComponent(stopCode)}?${query}`,
                {},
                TRANSIT_TRIP_PLAN_TIMEOUT_MS,
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            return Array.isArray(payload?.scheduled_times) ? payload.scheduled_times : [];
        } catch (error) {
            console.warn('[TransitService] Error fetching DB timetable:', error);
            return [];
        }
    },

    async getTransitTripPlanDb(
        originStopCode: string,
        dest_stop_code: string,
        routeNumber: string,
        departureTime: string,
        timingMode: string = 'leave_at',
        minimum_travel_minutes: number = 0,
    ): Promise<any> {
        const [plan] = await this.getBulkTransitTripPlanDb([{
            origin_stop_code: originStopCode,
            dest_stop_code,
            route_number: routeNumber,
            departure_time: departureTime,
            timing_mode: timingMode,
            minimum_travel_minutes
        }]);
        return plan;
    },

    async getBulkTransitTripPlanDb(items: any[]): Promise<any[]> {
        if (!items.length) return [];
        try {
            const response = await apiFetch(
                '/traffic/transit/trip-plan/bulk',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items })
                },
                TRANSIT_TRIP_PLAN_TIMEOUT_MS,
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.plans || [];
        } catch (error) {
            console.warn('[TransitService] Error fetching bulk DB trip plan:', error);
            return items.map(() => null);
        }
    },

    async prewarmRoutesAndPatterns(): Promise<void> {
        if (this.prewarmPromise) {
            return this.prewarmPromise;
        }

        this.prewarmPromise = (async () => {
            try {
                const { routes, activeIds } = await this.getTransitRoutes();
                const preferredRoutes = routes.filter((route: any) =>
                    activeIds.includes(route.ShortName) ||
                    activeIds.includes(route.Key) ||
                    activeIds.includes(route.Name),
                );
                const routesToWarm = (preferredRoutes.length > 0 ? preferredRoutes : routes)
                    .slice(0, 24)
                    .map((route: any) => route.Key)
                    .filter(Boolean);

                if (routesToWarm.length > 0) {
                    await this.getBulkRoutePatterns(routesToWarm);
                }
            } catch (error) {
                console.warn('[TransitService] Transit prewarm failed:', error);
            }
        })();

        return this.prewarmPromise;
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
