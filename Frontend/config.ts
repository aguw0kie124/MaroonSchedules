import { Platform } from 'react-native';

/**
 * Centralized API configuration
 * Uses environment variable EXPO_PUBLIC_API_URL for the backend URL
 * Falls back to localhost if not set
 */
const rawApiUrl = Platform.select({
    android: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8005',
    ios: process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8005',
    default: process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8005',
});

export const API_URL = (rawApiUrl || 'http://127.0.0.1:8005').replace(/\/+$/, '');
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

export const config = {
    apiUrl: API_URL,
    apiKey: API_KEY,
    aggieSpiritTripPlannerUrl: AGGIESPIRIT_TRIP_PLANNER_URL,
    tamuLibcalSearchUrl: TAMU_LIBCAL_SEARCH_URL,
    tamuLibcalEquipmentUrl: TAMU_LIBCAL_EQUIPMENT_URL,
};
