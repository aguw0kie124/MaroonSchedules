import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Campus = 'TAMU' | 'UTD';

interface CampusState {
  campus: Campus | null;
  setCampus: (campus: Campus) => void;
}

export const useCampusStore = create<CampusState>()(
  persist(
    (set) => ({
      campus: null,
      setCampus: (campus) => set({ campus }),
    }),
    {
      name: 'campus-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        campus: state.campus,
      }),
    },
  ),
);

export function getCampus(): Campus | null {
  return useCampusStore.getState().campus;
}
