import { create } from 'zustand';
import { buildCampusHubSnapshot, CampusHubSnapshot } from '../services/campusHub';

interface CampusHubState {
  snapshot: CampusHubSnapshot | null;
  loading: boolean;
  error: string | null;
  lastHydratedUserId: string | null;
  hydrate: (userId: string) => Promise<void>;
}

export const useCampusHubStore = create<CampusHubState>((set, get) => ({
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
}));
