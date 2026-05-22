import { useState, useEffect, useCallback } from 'react';
import {
  checkForExpoUpdate,
  downloadExpoUpdate,
  fetchVersionConfig,
  checkNativeVersion,
  compareVersions,
  VersionConfig,
} from '../services/updateService';

export interface AppUpdateState {
  isCheckingUpdates: boolean;
  otaUpdateAvailable: boolean;
  storeUpdateAvailable: boolean;
  forcedUpdateRequired: boolean;
  storeUrl: string;
}

export function useAppUpdates() {
  const [state, setState] = useState<AppUpdateState>({
    isCheckingUpdates: true,
    otaUpdateAvailable: false,
    storeUpdateAvailable: false,
    forcedUpdateRequired: false,
    storeUrl: '',
  });

  const initializeUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, isCheckingUpdates: true }));

    try {
      // 1. Check for OTA Updates first (so JS bugs get fixed before blocking users)
      const hasOta = await checkForExpoUpdate();
      if (hasOta) {
        await downloadExpoUpdate();
        setState((prev) => ({
          ...prev,
          isCheckingUpdates: false,
          otaUpdateAvailable: true,
        }));
        return; // Don't check native version if OTA is pending reload
      }

      // 2. Fetch Version Config from Backend
      const config: VersionConfig | null = await fetchVersionConfig();
      if (!config) {
        // Backend failure or offline -> don't block app launch
        setState((prev) => ({ ...prev, isCheckingUpdates: false }));
        return;
      }

      // 3. Read Installed Native Version & Compare
      const currentVersion = checkNativeVersion();
      const minSupported = config.minimumSupportedVersion;
      const latest = config.latestVersion;

      const isForced = compareVersions(currentVersion, minSupported) < 0;
      const isSoft = !isForced && compareVersions(currentVersion, latest) < 0;

      setState((prev) => ({
        ...prev,
        isCheckingUpdates: false,
        forcedUpdateRequired: isForced,
        storeUpdateAvailable: isSoft,
        storeUrl: config.storeUrl,
      }));
    } catch (e) {
      console.warn("Failed during update check flow:", e);
      setState((prev) => ({ ...prev, isCheckingUpdates: false }));
    }
  }, []);

  useEffect(() => {
    initializeUpdates();
  }, [initializeUpdates]);

  // Method to dismiss soft update modal
  const dismissStoreUpdate = () => {
    setState((prev) => ({ ...prev, storeUpdateAvailable: false }));
  };

  return { ...state, dismissStoreUpdate };
}
