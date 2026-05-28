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

    // If no URL configured, fall back to platform default
    if (!configuredUrl) {
        if (!__DEV__) return DEFAULT_LOCAL_API_URL;
        const metroHost = getMetroHost();
        if (metroHost && !LOOPBACK_HOSTS.has(metroHost)) {
            try {
                const parsed = new URL(DEFAULT_LOCAL_API_URL);
                parsed.hostname = metroHost;
                return parsed.toString();
            } catch { /* fall through */ }
        }
        return DEFAULT_LOCAL_API_URL;
    }

    // If the configured URL is a real remote domain (not localhost / LAN IP), always use it.
    // This covers deployed backends like http://maroonlife.app regardless of __DEV__ mode.
    try {
        const configuredHost = new URL(configuredUrl).hostname;
        if (!LOOPBACK_HOSTS.has(configuredHost) && !isPrivateIpv4(configuredHost)) {
            return configuredUrl;
        }
    } catch {
        return DEFAULT_LOCAL_API_URL;
    }

    // The configured URL is a local/LAN address.
    // In production just use it as-is; in dev follow the Metro host so the
    // phone and the dev server share the same LAN IP automatically.
    if (!__DEV__) return configuredUrl;

    const metroHost = getMetroHost();
    if (!metroHost || LOOPBACK_HOSTS.has(metroHost)) {
        return configuredUrl;
    }

    try {
        const parsed = new URL(configuredUrl);
        const configuredHost = parsed.hostname;
        if (LOOPBACK_HOSTS.has(configuredHost) || isPrivateIpv4(configuredHost)) {
            parsed.hostname = metroHost;
            return parsed.toString();
        }
        return configuredUrl;
    } catch {
        return configuredUrl;
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
