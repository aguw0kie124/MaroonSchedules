import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { requestJson } from '../api/client';

export interface VersionConfig {
  latestVersion: string;
  minimumSupportedVersion: string;
  storeUrl: string;
}

export interface AppVersionConfigResponse {
  ios?: VersionConfig;
  android?: VersionConfig;
}

/**
 * Compare two semantic versions (e.g. "1.0.0" and "1.1.0").
 * Returns:
 * -1 if v1 < v2
 *  0 if v1 == v2
 *  1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);

  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  for (let i = 0; i < maxLength; i++) {
    const part1 = v1Parts[i] || 0;
    const part2 = v2Parts[i] || 0;
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  return 0;
}

/**
 * Checks for a new OTA update using Expo Updates.
 */
export async function checkForExpoUpdate(): Promise<boolean> {
  if (__DEV__) return false; // Expo updates don't run in DEV
  
  try {
    const update = await Updates.checkForUpdateAsync();
    return update.isAvailable;
  } catch (e) {
    console.warn("Failed to check for Expo update:", e);
    return false;
  }
}

/**
 * Downloads the latest Expo OTA update.
 */
export async function downloadExpoUpdate(): Promise<void> {
  try {
    await Updates.fetchUpdateAsync();
  } catch (e) {
    console.warn("Failed to download Expo update:", e);
  }
}

/**
 * Reloads the app to apply the newly downloaded OTA update.
 */
export async function reloadExpoUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (e) {
    console.warn("Failed to reload for Expo update:", e);
  }
}

/**
 * Fetches the version configuration from the backend.
 */
export async function fetchVersionConfig(): Promise<VersionConfig | null> {
  try {
    const response: AppVersionConfigResponse = await requestJson('/app/version-config');
    if (Platform.OS === 'ios' && response.ios) {
      return response.ios;
    } else if (Platform.OS === 'android' && response.android) {
      return response.android;
    }
    return null;
  } catch (e) {
    console.warn("Failed to fetch version config from backend:", e);
    return null;
  }
}

/**
 * Reads the current native app version (e.g. "1.0.0").
 */
export function checkNativeVersion(): string {
  // In development/Expo Go, this might be null. Default to a high version to bypass.
  return Application.nativeApplicationVersion || '999.999.999';
}

/**
 * Opens the platform-specific store URL.
 */
export function openStore(url: string) {
  if (url) {
    Linking.openURL(url).catch((err) => console.warn("Failed to open store URL:", err));
  }
}
