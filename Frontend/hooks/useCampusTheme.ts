import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCampusTheme, type CampusCode } from '../theme';

const STORAGE_KEY = 'selected_campus';

export function useCampusTheme() {
  const [campus, setCampus] = useState<CampusCode>('TAMU');
  const [isLoading, setIsLoading] = useState(true);

  const refreshCampusTheme = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const nextCampus: CampusCode = stored === 'UTD' ? 'UTD' : 'TAMU';
      setCampus(nextCampus);
    } catch (error) {
      console.warn('[CampusTheme] Failed to read selected campus', error);
      setCampus('TAMU');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCampusTheme().catch(() => {});
  }, [refreshCampusTheme]);

  return {
    campus,
    theme: getCampusTheme(campus),
    isLoading,
    refreshCampusTheme,
  };
}
