import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AuthMode = 'user' | 'admin' | null;

interface SessionState {
  isGuest: boolean;
  authMode: AuthMode;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  setAuthMode: (mode: AuthMode) => void;
  resetSessionMode: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isGuest: false,
      authMode: null,
      enterGuestMode: () => set({ isGuest: true }),
      exitGuestMode: () => set({ isGuest: false }),
      setAuthMode: (authMode) => set({ authMode, isGuest: false }),
      resetSessionMode: () => set({ isGuest: false, authMode: null }),
    }),
    {
      name: 'session-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        authMode: state.authMode,
      }),
    },
  ),
);
