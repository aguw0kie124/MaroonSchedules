import { create } from 'zustand';

interface SessionState {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isGuest: false,
  enterGuestMode: () => set({ isGuest: true }),
  exitGuestMode: () => set({ isGuest: false }),
}));
