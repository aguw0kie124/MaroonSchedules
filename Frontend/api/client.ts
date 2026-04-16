import { API_KEY, API_REQUEST_TIMEOUT_MS, API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Bounded so wrong/offline EXPO_PUBLIC_API_URL fails fast instead of blocking the UI for ~20s. */
const DEFAULT_TIMEOUT_MS = API_REQUEST_TIMEOUT_MS;

let hasLoggedTimeoutDevHint = false;
const API_BASE = API_URL.replace(/\/+$/, '');

type TokenProviderOptions = {
    forceRefresh?: boolean;
};

type AuthTokenProvider = (options?: TokenProviderOptions) => Promise<string | null>;
type ResponseHandler = (response: Response) => void | Promise<void>;
type CampusId = 'TAMU' | 'UTD';

let authTokenProvider: AuthTokenProvider | null = null;
let unauthorizedHandler: ResponseHandler | null = null;
let forbiddenHandler: ResponseHandler | null = null;
let originalFetch: typeof globalThis.fetch | null = null;
let hasWarnedAboutMissingApiKey = false;

export class ApiError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

export function setApiAuthTokenProvider(provider: AuthTokenProvider | null) {
    authTokenProvider = provider;
}

export function setApiResponseHandlers(handlers: {
    onUnauthorized?: ResponseHandler | null;
    onForbidden?: ResponseHandler | null;
}) {
    unauthorizedHandler = handlers.onUnauthorized ?? null;
    forbiddenHandler = handlers.onForbidden ?? null;
}

function headersToObject(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    if (headers instanceof Headers) {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
    }
    return { ...headers };
}

function warnMissingApiKeyOnce() {
    if (!API_KEY && !hasWarnedAboutMissingApiKey) {
        hasWarnedAboutMissingApiKey = true;
        console.warn('[API] EXPO_PUBLIC_API_KEY is not configured. Protected backend routes will reject requests.');
    }
}

async function buildHeaders(init: RequestInit = {}, options: TokenProviderOptions = {}): Promise<Record<string, string>> {
    const headers = headersToObject(init.headers);
    warnMissingApiKeyOnce();

    try {
        const storedCampus = await AsyncStorage.getItem('selected_campus');
        const campusId = storedCampus === 'TAMU' || storedCampus === 'UTD'
            ? (storedCampus as CampusId)
            : null;

        if (campusId && !headers['x-campus-id'] && !headers['X-Campus-Id']) {
            headers['x-campus-id'] = campusId;
        }
    } catch (error) {
        console.warn('[API] Failed to read selected_campus from AsyncStorage', error);
    }

    if (API_KEY && !headers['x-api-key'] && !headers['X-API-Key']) {
        headers['x-api-key'] = API_KEY;
    }

    const token = authTokenProvider ? await authTokenProvider(options) : null;
    if (token && !headers.Authorization && !headers.authorization) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (init.body && !(init.body instanceof FormData) && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

function formatApiErrorMessage(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => formatApiErrorMessage(entry))
            .filter((entry): entry is string => !!entry);
        return parts.length > 0 ? parts.join('\n') : null;
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.msg === 'string') {
            const location = Array.isArray(record.loc)
                ? record.loc
                    .map((entry) => String(entry))
                    .filter((entry) => entry !== 'body')
                    .join(' > ')
                : '';
            return location ? `${location}: ${record.msg}` : record.msg;
        }
        if ('detail' in record) return formatApiErrorMessage(record.detail);
        if ('message' in record) return formatApiErrorMessage(record.message);
        if ('error' in record) return formatApiErrorMessage(record.error);
        try {
            return JSON.stringify(value);
        } catch (_error) {
            return String(value);
        }
    }

    return String(value);
}

function isApiUrl(url: string) {
    return url.replace(/\/+$/, '').startsWith(API_BASE);
}

function resolveUrl(input: string | URL | Request) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
}

function getBaseFetch() {
    return originalFetch ?? globalThis.fetch.bind(globalThis);
}

async function handleSecurityResponse(response: Response) {
    if (response.status === 401 && unauthorizedHandler) {
        await unauthorizedHandler(response.clone());
        return;
    }

    if (response.status === 403) {
        console.warn('[API] Backend rejected the request with 403. Check EXPO_PUBLIC_API_KEY and backend API_KEY.');
        if (forbiddenHandler) {
            await forbiddenHandler(response.clone());
        }
    }
}

async function performFetch(
    url: string,
    init: RequestInit = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    isRetry = false,
) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        console.debug(`[API] ${init.method || 'GET'} ${url}`);
        const headers = await buildHeaders(init, { forceRefresh: isRetry });
        const response = await getBaseFetch()(url, {
            ...init,
            signal: controller.signal,
            headers,
        });

        if (response.status === 401 && authTokenProvider && !isRetry) {
            return performFetch(url, init, timeoutMs, true);
        }

        await handleSecurityResponse(response);
        return response;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            if (__DEV__ && !hasLoggedTimeoutDevHint) {
                hasLoggedTimeoutDevHint = true;
                console.warn(
                    '[API] Request timed out. Buses, dining, occupancy, and feeds all use this host.',
                    'Update EXPO_PUBLIC_API_URL in .env to your Mac/PC LAN IP (same Wi‑Fi as the phone) or your deployed API, then restart Expo.',
                );
            }
            throw new Error(`Request timed out for ${url}`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function installApiFetchInterceptor() {
    if (originalFetch) {
        return () => undefined;
    }

    originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const resolvedUrl = resolveUrl(input);
        if (!isApiUrl(resolvedUrl)) {
            return originalFetch!(input as never, init as never);
        }
        return performFetch(resolvedUrl, init ?? {}, DEFAULT_TIMEOUT_MS);
    }) as typeof globalThis.fetch;

    return () => {
        if (originalFetch) {
            globalThis.fetch = originalFetch;
            originalFetch = null;
        }
    };
}

export async function apiFetch(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const url = isApiUrl(path) ? path : `${API_URL}${path}`;
    return performFetch(url, init, timeoutMs);
}

export async function requestJson(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const response = await apiFetch(path, init, timeoutMs);
    const rawBody = await response.text();
    let data = null;
    try {
        data = rawBody ? JSON.parse(rawBody) : null;
    } catch (err) {
        if (!response.ok) {
            const preview = rawBody.slice(0, 100).replace(/\n/g, ' ');
            throw new ApiError(`${init.method || 'GET'} ${path} failed with status ${response.status}: ${preview}`, response.status, rawBody);
        }
        throw new Error(`Failed to parse response as JSON: ${err}`);
    }

    if (!response.ok) {
        const message =
            formatApiErrorMessage((data as any)?.detail) ||
            formatApiErrorMessage((data as any)?.message) ||
            formatApiErrorMessage(data) ||
            `${init.method || 'GET'} ${path} failed with status ${response.status}`;
        throw new ApiError(message, response.status, data);
    }

    return data;
}

// ============================================================
// User endpoints
// ============================================================

export const syncUser = async (clerkId: string, email?: string, fullName?: string, profileImageUrl?: string) => {
    return requestJson('/users/sync', {
        method: 'POST',
        body: JSON.stringify({
            clerk_id: clerkId,
            email,
            full_name: fullName,
            profile_image_url: profileImageUrl
        }),
    });
};

export const fetchUserProfile = async (clerkId: string) => {
    return requestJson(`/users/${clerkId}`, {}, DEFAULT_TIMEOUT_MS);
};

export const updateUserProfile = async (clerkId: string, fields: Record<string, any>) => {
    return requestJson(`/users/${clerkId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(fields),
    });
};

export const acceptToS = async (clerkId: string) => {
    return requestJson(`/users/${clerkId}/tos/accept/`, {
        method: 'POST',
    });
};

export const completeTour = async (clerkId: string) => {
    return requestJson(`/users/${clerkId}/tour/complete/`, {
        method: 'POST',
    });
};

// ============================================================
// Course endpoints
// ============================================================

export const fetchCourses = async (params: any = {}) => {
    return requestJson('/courses/search', {
        method: 'POST',
        body: JSON.stringify(params),
    });
};

export const fetchCourseById = async (courseId: string) => {
    return requestJson(`/courses/${courseId}`);
};

export const fetchSectionById = async (sectionId: string) => {
    return requestJson(`/sections/${sectionId}`);
};

export const fetchTerms = async () => {
    return requestJson('/terms');
};

export const generateSchedules = async (courseIds: string[]) => {
    const queryParams = courseIds.map(id => `course_ids=${id}`).join('&');
    return requestJson(`/schedules/generate?${queryParams}`);
};

// ============================================================
// Schedule endpoints
// ============================================================

export const fetchSchedules = async (userId: string) => {
    return requestJson(`/user/schedule?user_id=${userId}`);
};

export const createSchedule = async (payload: { user_id: string; name: string; term_code: string }) => {
    return requestJson('/schedules', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const addSectionToSchedule = async (scheduleId: string, sectionId: string, userId: string = "default_user") => {
    return requestJson('/user/schedule/add', {
        method: 'POST',
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId }),
    });
};

export const removeSectionFromSchedule = async (scheduleId: string, sectionId: string, userId: string = "default_user") => {
    return requestJson('/user/schedule/remove', {
        method: 'DELETE',
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId }),
    });
};

export const deleteSchedule = async (scheduleId: string, userId: string) => {
    return requestJson(`/schedules/${scheduleId}?user_id=${userId}`, {
        method: 'DELETE',
    });
};

// ============================================================
// Campus Hub endpoints
// ============================================================

export const fetchCampusOverview = async (clerkId: string) => {
    return requestJson(`/campus/overview?clerk_id=${encodeURIComponent(clerkId)}`);
};

export const fetchCampusEvents = async (clerkId?: string, limit = 8) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (clerkId) params.set('clerk_id', clerkId);
    return requestJson(`/campus/events?${params.toString()}`);
};

export const fetchCampusPlacesRegistry = async () => {
    return requestJson('/campus/places/registry');
};

export const fetchCampusPlacesMap = async () => {
    return requestJson('/campus/places/map');
};

export const fetchCampusParkingRealtime = async () => {
    return requestJson('/campus/places/parking-realtime');
};

export const fetchCampusPlaceDetail = async (placeIdOrIdentifier: string) => {
    return requestJson(`/campus/places/${encodeURIComponent(placeIdOrIdentifier)}/detail`);
};

export const fetchCampusPulseMap = async (
    limit = 12,
    clerkId?: string,
    refresh = false,
    campus?: 'TAMU' | 'UTD',
) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (clerkId) params.set('clerk_id', clerkId);
    if (refresh) params.set('refresh', 'true');
    if (campus) params.set('campus', campus.toLowerCase());
    return requestJson(`/campus/pulse/map?${params.toString()}`);
};

export const saveCampusEventRsvp = async (payload: { clerk_id: string; event_id: string; response: string }) => {
    return requestJson('/campus/events/rsvp', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const trackShare = async (id: string | number, type: string) => {
    if (type === 'event') {
        return requestJson(`/admin/events/${id}/share`, {
            method: 'POST',
        });
    }
    return { status: 'noop' };
};

export const discoverCampusNetwork = async (clerkId: string, query?: string, major?: string, limit = 8) => {
    const params = new URLSearchParams({
        clerk_id: clerkId,
        limit: String(limit),
    });
    if (query) params.set('query', query);
    if (major) params.set('major', major);
    return requestJson(`/campus/network/discover?${params.toString()}`);
};

export const requestCampusConnection = async (payload: { requester_id: string; recipient_id: string }) => {
    return requestJson('/campus/network/request', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const fetchCampusConnectors = async (clerkId: string) => {
    return requestJson(`/campus/connectors?clerk_id=${encodeURIComponent(clerkId)}`);
};

export const captureCampusConnector = async (payload: {
    clerk_id: string;
    system_id: string;
    source_url: string;
    page_title?: string | null;
    page_html?: string | null;
    page_text?: string | null;
    cookie_names?: string[] | null;
}) => {
    return requestJson('/campus/connectors/capture', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const deleteCampusConnector = async (clerkId: string, systemId: string) => {
    return requestJson(`/campus/connectors/${encodeURIComponent(systemId)}?clerk_id=${encodeURIComponent(clerkId)}`, {
        method: 'DELETE',
    });
};

// ============================================================
// Global Maps endpoints
// ============================================================

export const searchGlobalMapPlaces = async (query: string, limit = 8) => {
    const params = new URLSearchParams({
        query,
        limit: String(limit),
    });
    return requestJson(`/maps/search?${params.toString()}`);
};

export const fetchGlobalMapRoute = async (payload: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    mode: 'walk' | 'drive' | 'bike';
    origin_name?: string;
    destination_name?: string;
}) => {
    return requestJson('/maps/route', {
        method: 'POST',
        body: JSON.stringify(payload),
    }, 20000);
};
