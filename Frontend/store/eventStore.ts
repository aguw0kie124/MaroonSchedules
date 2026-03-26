import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersonalEvent {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  date_iso: string;
  date_ts: number;
  time?: string;
}

interface EventState {
  events: PersonalEvent[];
  addEvent: (event: PersonalEvent) => void;
  removeEvent: (id: number) => void;
}

export const useEventStore = create<EventState>()(
  persist(
    (set) => ({
      events: [],
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
    }),
    {
      name: 'event-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
