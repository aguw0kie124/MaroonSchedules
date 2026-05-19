import { NativeModules, Platform } from 'react-native';

/**
 * Centralized API configuration
 * Uses environment variable EXPO_PUBLIC_API_URL for the backend URL
 * Falls back to localhost if not set
 */
const DEFAULT_LOCAL_API_URL = Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://127.0.0.1:8000',
    default: 'http://127.0.0.1:8000',
}) || 'http://127.0.0.1:8000';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '10.0.2.2']);

function isPrivateIpv4(hostname: string) {
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    const match = hostname.match(/^172\.(\d{1,3})\./);
    if (!match) return false;
    const secondOctet = Number(match[1]);
    return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
}

function getMetroHost(): string | null {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (typeof scriptURL !== 'string' || !scriptURL) return null;

    try {
        const parsed = new URL(scriptURL);
        return parsed.hostname || null;
    } catch {
        return null;
    }
}

function resolveApiUrl() {
    const configuredUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();

    if (!__DEV__) {
        return configuredUrl || DEFAULT_LOCAL_API_URL;
    }

    const useRemoteApiInDev = process.env.EXPO_PUBLIC_USE_REMOTE_API_IN_DEV === 'true';
    let fallbackUrl = configuredUrl || DEFAULT_LOCAL_API_URL;

    if (configuredUrl && !useRemoteApiInDev) {
        try {
            const configuredHost = new URL(configuredUrl).hostname;
            if (!LOOPBACK_HOSTS.has(configuredHost) && !isPrivateIpv4(configuredHost)) {
                fallbackUrl = DEFAULT_LOCAL_API_URL;
            }
        } catch {
            fallbackUrl = DEFAULT_LOCAL_API_URL;
        }
    }

    const metroHost = getMetroHost();
    if (!metroHost || LOOPBACK_HOSTS.has(metroHost)) {
        return fallbackUrl;
    }

    try {
        const parsed = new URL(fallbackUrl);
        const configuredHost = parsed.hostname;
        const shouldFollowMetroHost =
            LOOPBACK_HOSTS.has(configuredHost) || isPrivateIpv4(configuredHost);

        if (!shouldFollowMetroHost || configuredHost === metroHost) {
            return fallbackUrl;
        }

        parsed.hostname = metroHost;
        return parsed.toString();
    } catch {
        return fallbackUrl;
    }
}

export const API_URL = resolveApiUrl().replace(/\/+$/, '');

/** Abort API requests after this many ms (prevents hung UI when the backend host is wrong or offline). Override with EXPO_PUBLIC_API_TIMEOUT_MS. */
const parsedTimeout = parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || '', 10);
export const API_REQUEST_TIMEOUT_MS =
    Number.isFinite(parsedTimeout) && parsedTimeout >= 3000 ? parsedTimeout : 8000;
export const API_KEY = (process.env.EXPO_PUBLIC_API_KEY || '').trim();

export const AGGIESPIRIT_TRIP_PLANNER_URL =
  process.env.EXPO_PUBLIC_AGGIESPIRIT_TRIP_PLANNER_URL ||
  'https://aggiespirit.ts.tamu.edu/TripPlanner';

export const TAMU_LIBCAL_SEARCH_URL =
  process.env.EXPO_PUBLIC_TAMU_LIBCAL_SEARCH_URL ||
  'https://tamu.libcal.com/r/search';

export const TAMU_LIBCAL_EQUIPMENT_URL =
  process.env.EXPO_PUBLIC_TAMU_LIBCAL_EQUIPMENT_URL ||
  'https://tamu.libcal.com/equipment';

/** Public support page (App Store Guideline 1.5). */
export const SUPPORT_CONTACT_URL =
  process.env.EXPO_PUBLIC_SUPPORT_URL || 'https://cooked-creature-cbf.notion.site/MaroonLife-Support-33f932bf7d5780daa966f059c750cc8d';

export const config = {
    apiUrl: API_URL,
    supportUrl: SUPPORT_CONTACT_URL,
    apiKey: API_KEY,
    aggieSpiritTripPlannerUrl: AGGIESPIRIT_TRIP_PLANNER_URL,
    tamuLibcalSearchUrl: TAMU_LIBCAL_SEARCH_URL,
    tamuLibcalEquipmentUrl: TAMU_LIBCAL_EQUIPMENT_URL,
};
