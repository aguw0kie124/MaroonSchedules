import axios from 'axios';

const BASE_URL = 'https://aggiespirit.ts.tamu.edu';

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
            if (!this.auth) await this.initAuth();
            
            const response = await fetch(`${BASE_URL}/Home/GetActiveRoutes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.auth
                },
                body: null
            });

            if (!response.ok) {
                console.error(`[TransitService] GetActiveRoutes failed: ${response.status}`);
                return [];
            }

            return await response.json() || [];
        } catch (error) {
            console.error('[TransitService] Error fetching active routes:', error);
            return [];
        }
    },

    /**
     * Fetches metadata for all routes (names, keys, shortNames).
     */
    async getRoutesMetadata(): Promise<any[]> {
        try {
            if (!this.auth) await this.initAuth();
            
            // Note: GetBaseData with empty body returns all routes
            const response = await fetch(`${BASE_URL}/RouteMap/GetBaseData/`, {
                method: 'POST',
                headers: {
                    ...this.auth,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: ''
            });

            if (!response.ok) return [];
            const data = await response.json();
            // Normalize metadata to PascalCase to match previous implementation patterns
            return (data.routes || []).map((r: any) => ({
                Key: r.key || r.Key,
                Name: r.name || r.Name,
                ShortName: r.shortName || r.ShortName
            }));
        } catch (error) {
            console.error('[TransitService] Error fetching routes metadata:', error);
            return [];
        }
    },

    /**
     * Fetches route patterns (polylines/traces) and STOPS for the map.
     */
    async getRoutePattern(routeId: string): Promise<{ points: any[], stops: any[] }> {
        try {
            if (!this.auth) await this.initAuth();
            
            const body = `routeKeys%5B%5D=${encodeURIComponent(routeId)}`;
            const response = await fetch(`${BASE_URL}/RouteMap/GetPatternPaths/`, {
                method: 'POST',
                headers: {
                    ...this.auth,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: body
            });

            if (!response.ok) return { points: [], stops: [] };
            const data = await response.json();
            
            const points: any[] = [];
            const stops: any[] = [];
            const seenStops = new Set();

            if (data && data.length > 0) {
                data[0].patternPaths?.forEach((path: any) => {
                    path.patternPoints?.forEach((pt: any) => {
                        points.push({
                            latitude: pt.latitude,
                            longitude: pt.longitude
                        });
                        if (pt.stop && !seenStops.has(pt.stop.stopCode)) {
                            seenStops.add(pt.stop.stopCode);
                            stops.push({
                                Name: pt.stop.name,
                                Latitude: pt.latitude,
                                Longitude: pt.longitude,
                                StopCode: pt.stop.stopCode
                            });
                        }
                    });
                });
            }
            return { points, stops };
        } catch (error) {
            console.error('[TransitService] Error fetching route patterns:', error);
            return { points: [], stops: [] };
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
            if (!this.auth) await this.initAuth();
            
            // Empty body often returns all vehicles for this system
            const response = await fetch(`${BASE_URL}/RouteMap/GetVehicles/`, {
                method: 'POST',
                headers: {
                    ...this.auth,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: '' 
            });

            if (!response.ok) return [];
            const data = await response.json() || [];
            
            const vehicles: any[] = [];
            data.forEach((route: any) => {
                // Determine if this route block matches our target
                // AggieSpirit sometimes returns routeKey as the UUID and other times as the ShortName
                const isMatch = !routeId || 
                               route.routeKey === routeId || 
                               route.routeKey?.toString().toLowerCase() === routeId.toString().toLowerCase();

                if (!isMatch) return;

                route.vehiclesByDirections?.forEach((dir: any) => {
                    dir.vehicles?.forEach((v: any) => {
                        vehicles.push({
                            Key: v.key,
                            Name: v.name,
                            Latitude: v.location.latitude,
                            Longitude: v.location.longitude,
                            Heading: v.location.heading,
                            PassengersOnboard: v.passengersOnboard,
                            Capacity: v.passengerCapacity,
                            RouteKey: route.routeKey
                        });
                    });
                });
            });

            return vehicles;
        } catch (error) {
            console.error('[TransitService] Error fetching vehicles:', error);
            return [];
        }
    },

    /**
     * Fetches the list of stops for a specific route.
     * Note: Integrated into getRoutePattern for efficiency.
     */
    async getRouteStops(routeId: string): Promise<any[]> {
        const { stops } = await this.getRoutePattern(routeId);
        return stops;
    }
};
