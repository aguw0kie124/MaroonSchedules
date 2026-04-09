import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCampusHubSnapshot, CampusHubSnapshot } from '../services/campusHub';

interface CampusHubState {
  snapshot: CampusHubSnapshot | null;
  loading: boolean;
  error: string | null;
  lastHydratedUserId: string | null;
  hydrate: (userId: string) => Promise<void>;
}

export const useCampusHubStore = create<CampusHubState>()(
  persist(
    (set, get) => ({
      snapshot: null,
      loading: false,
      error: null,
      lastHydratedUserId: null,
      hydrate: async (userId: string) => {
        if (!userId) return;

        const { loading, lastHydratedUserId } = get();
        if (loading && lastHydratedUserId === userId) return;

        set({ loading: true, error: null, lastHydratedUserId: userId });
        try {
          const snapshot = await buildCampusHubSnapshot(userId);
          set({ snapshot, loading: false, error: null });
        } catch (error: any) {
          set({
            loading: false,
            error: error?.message || 'Unable to hydrate campus hub',
          });
        }
      },
    }),
    {
      name: 'campus-hub-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
