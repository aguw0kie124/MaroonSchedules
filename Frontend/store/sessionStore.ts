import { create } from 'zustand';

type AuthMode = 'user' | 'admin' | null;

interface SessionState {
  isGuest: boolean;
  authMode: AuthMode;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  setAuthMode: (mode: AuthMode) => void;
  resetSessionMode: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isGuest: false,
  authMode: null,
  enterGuestMode: () => set({ isGuest: true }),
  exitGuestMode: () => set({ isGuest: false }),
  setAuthMode: (authMode) => set({ authMode, isGuest: false }),
  resetSessionMode: () => set({ isGuest: false, authMode: null }),
}));
