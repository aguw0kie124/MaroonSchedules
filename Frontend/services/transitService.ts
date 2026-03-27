import axios from 'axios';
import { API_URL } from '../config';

const BASE_URL = 'https://aggiespirit.ts.tamu.edu';
const ROUTE_COLORS = ['#500000', '#7E0000', '#B34100', '#0B6E4F', '#165DFF', '#6B3FA0', '#007A78', '#A63D40'];

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

export const transitService = {
    auth: null as any,
    cookies: null as string | null,
    routesCache: [] as any[],
    activeRoutesCache: [] as string[],
    patternCache: new Map<string, { points: any[]; stops: any[] }>(),
    vehicleCache: new Map<string, any[]>(),
    lastVehiclesSnapshot: [] as any[],

    /**
     * Reconstructs the MaroonRides dynamic authentication flow.
     * Fetches a base64 encoded JS snippet from their auth server and executes it.
     */
    async initAuth(): Promise<any> {
        try {
            console.log('[TransitService] Initializing MaroonRides dynamic auth...');
            
            // 1. Fetch the dynamic auth code from MaroonRides
            const authResponse = await fetch('https://auth.maroonrides.app');
            const authCodeB64 = await authResponse.text();
            let authCode = atob(authCodeB64);
            
            // 2. Prepare the execution context
            // We append the function call to the dynamic script
            const executionScript = `${authCode}\ngetAuthentication()`;
            
            // 3. Execute the script to get current headers
            // Note: Using eval here to perfectly match the MaroonRides implementation
            // for compatibility with their dynamic security updates.
            const headers = await eval(executionScript);
            
            if (headers) {
                this.auth = headers;
                // MaroonRides uses 'Requestverificationtoken' (lowercase v) in their header map
                console.log('[TransitService] Dynamic auth initialized successfully.');
                return this.auth;
            }
        } catch (error) {
            console.error('[TransitService] MaroonRides dynamic auth failed:', error);
            // Fallback to manual extraction if their server is down
            return this.initManualAuth();
        }
        return null;
    },

    /**
     * Fallback manual authentication if the dynamic server is unavailable.
     */
    async initManualAuth(): Promise<any> {
        try {
            console.log('[TransitService] Falling back to manual auth...');
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
            console.error('[TransitService] Manual fallback failed:', e);
        }
        return null;
    },

    /**
     * Fetches current active bus routes from AggieSpirit.
     */
    async getActiveRoutes(): Promise<string[]> {
        try {
            const response = await fetch(`${API_URL}/traffic/transit/routes`);
            if (!response.ok) {
                return this.activeRoutesCache;
            }
            const payload = await response.json();
            const routes = payload.activeRouteIds || [];
            if (Array.isArray(routes) && routes.length > 0) {
                this.activeRoutesCache = routes;
            }
            return Array.isArray(routes) && routes.length > 0 ? routes : this.activeRoutesCache;
        } catch (error) {
            console.error('[TransitService] Error fetching active routes:', error);
            return this.activeRoutesCache;
        }
    },

    /**
     * Fetches metadata for all routes (names, keys, shortNames).
     */
    async getRoutesMetadata(): Promise<any[]> {
        try {
            const response = await fetch(`${API_URL}/traffic/transit/routes`);
            if (!response.ok) return this.routesCache;
            const data = await response.json();
            const routes = (data.routes || []).map((r: any) => ({
                Key: r.key || r.Key,
                Name: r.name || r.Name,
                ShortName: r.shortName || r.ShortName,
                Color: r.color || r.Color || this.getRouteColor(r.key || r.Key || r.shortName || r.ShortName || r.name || r.Name),
            }));
            if (routes.length > 0) {
                this.routesCache = routes;
            }
            return routes.length > 0 ? routes : this.routesCache;
        } catch (error) {
            console.error('[TransitService] Error fetching routes metadata:', error);
            return this.routesCache;
        }
    },

    /**
     * Fetches route patterns (polylines/traces) and STOPS for the map.
     */
    async getRoutePattern(routeId: string): Promise<{ points: any[], stops: any[] }> {
        try {
            const response = await fetch(`${API_URL}/traffic/transit/route/${encodeURIComponent(routeId)}`);
            if (!response.ok) return this.patternCache.get(routeId) || { points: [], stops: [] };
            const data = await response.json();
            
            const points: any[] = [];
            const stops: any[] = [];
            const seenStops = new Set();

            (data.points || []).forEach((pt: any) => {
                points.push({
                    latitude: pt.latitude,
                    longitude: pt.longitude
                });
            });
            (data.stops || []).forEach((stop: any) => {
                if (!seenStops.has(stop.StopCode)) {
                    seenStops.add(stop.StopCode);
                    stops.push(stop);
                }
            });
            const pattern = { points, stops };
            if (points.length > 0 || stops.length > 0) {
                this.patternCache.set(routeId, pattern);
            }
            return points.length > 0 || stops.length > 0 ? pattern : (this.patternCache.get(routeId) || pattern);
        } catch (error) {
            console.error('[TransitService] Error fetching route patterns:', error);
            return this.patternCache.get(routeId) || { points: [], stops: [] };
        }
    },

    /**
     * Fetches base data (stops, pattern/polyline) for a specific route.
     */
    async getRouteBaseData(routeId: string): Promise<any> {
        try {
            if (!this.auth) await this.initAuth();
            
            const body = `routeId=${encodeURIComponent(routeId)}`;
            const response = await fetch(`${BASE_URL}/RouteMap/GetBaseData/`, {
                method: 'POST',
                headers: {
                    ...this.auth,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: body
            });

            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('[TransitService] Error fetching route base data:', error);
            return null;
        }
    },

    /**
     * Fetches real-time vehicle locations.
     * Fetches all vehicles to ensure reliability, then filters by routeId if provided.
     */
    async getVehicles(routeId?: string): Promise<any[]> {
        try {
            const query = routeId ? `?route_id=${encodeURIComponent(routeId)}` : '';
            const response = await fetch(`${API_URL}/traffic/transit/vehicles${query}`);
            if (!response.ok) {
                return this.getCachedVehicles(routeId);
            }
            const payload = await response.json();
            const vehicles = payload.vehicles || [];

            if (vehicles.length > 0) {
                this.lastVehiclesSnapshot = vehicles;
                const cacheKey = routeId || '__all__';
                this.vehicleCache.set(cacheKey, vehicles);
            }

            return vehicles.length > 0 ? vehicles : this.getCachedVehicles(routeId);
        } catch (error) {
            console.error('[TransitService] Error fetching vehicles:', error);
            return this.getCachedVehicles(routeId);
        }
    },

    /**
     * Fetches the list of stops for a specific route.
     * Note: Integrated into getRoutePattern for efficiency.
     */
    async getRouteStops(routeId: string): Promise<any[]> {
        const { stops } = await this.getRoutePattern(routeId);
        return stops;
    },

    getCachedVehicles(routeId?: string): any[] {
        if (routeId) {
            return this.vehicleCache.get(routeId) || [];
        }
        return this.vehicleCache.get('__all__') || this.lastVehiclesSnapshot || [];
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
