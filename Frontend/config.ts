import { Platform } from 'react-native';

/**
 * Centralized API configuration
 * Uses environment variable EXPO_PUBLIC_API_URL for the backend URL
 * Falls back to localhost if not set
 */
export const API_URL = Platform.select({
    android: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000',
    ios: process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000',
    default: process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000',
});

export const config = {
    apiUrl: API_URL,
};
