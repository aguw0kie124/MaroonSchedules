import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BaseEvent {
  title: string;
  location?: string | null;
  description?: string | null;
  date_ts: number;
  date_iso: string;
  location_lat?: number | null;
  location_lng?: number | null;
  categories?: Record<string, number>;
}

export interface PersonalEvent extends BaseEvent {
  id: number;
  time?: string;
}

export type MajorOption =
  | 'Engineering'
  | 'Business'
  | 'Liberal Arts'
  | 'Agriculture'
  | 'Science'
  | 'Architecture'
  | 'Education'
  | 'Public Health'
  | 'Law'
  | 'Medicine';

export const ALL_MAJOR_OPTIONS: MajorOption[] = [
  'Engineering',
  'Business',
  'Liberal Arts',
  'Agriculture',
  'Science',
  'Architecture',
  'Education',
  'Public Health',
  'Law',
  'Medicine',
];

const VALID_MAJOR_OPTIONS = ALL_MAJOR_OPTIONS;

function isMajorOption(value: unknown): value is MajorOption {
  return typeof value === 'string' && (VALID_MAJOR_OPTIONS as string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
export interface ScheduledEvent extends BaseEvent {
  id: string;
  endDate_ts?: number | null;
  category: string;
}

export interface EventInvite extends BaseEvent {
  id: string;
  eventId: string;
  senderName: string;
  receivedAt: number;
  category: string;
}

interface EventState {
  /* Personal events (Legacy/Manual) */
  legacyPersonalEvents: PersonalEvent[];
  addLegacyPersonalEvent: (event: PersonalEvent) => void;
  removeLegacyPersonalEvent: (id: number) => void;

  /* Scheduled events – shown on Dashboard schedule (Campus Events) */
  scheduledEvents: ScheduledEvent[];
  scheduleEvent: (event: ScheduledEvent) => void;
  removeScheduledEvent: (id: string) => void;

  /* Saved / bookmarked events */
  savedEventIds: string[];
  saveEvent: (id: string) => void;
  unsaveEvent: (id: string) => void;

  /* Disliked events (swiped left) */
  dislikedEventIds: string[];
  dislikeEvent: (id: string) => void;
  removeIdsFromDisliked: (ids: string[]) => void;
  clearDisliked: () => void;

  /* Received invites */
  receivedInvites: EventInvite[];
  addInvite: (invite: EventInvite) => void;
  acceptInvite: (id: string) => void;
  rejectInvite: (id: string) => void;

  /* Global major-specific filter (linked across all event pages) */
  isMajorSpecific: boolean;
  selectedMajor: MajorOption;
  setMajorSpecific: (val: boolean) => void;
  setSelectedMajor: (major: MajorOption) => void;
  /* Persistent category deselections (Manual overrides) */
  deselectedCategories: string[];
  toggleCategoryDeselection: (category: string, isDeselected: boolean) => void;
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      /* Personal events */
      legacyPersonalEvents: [],
      addLegacyPersonalEvent: (event) =>
        set((state) => ({ legacyPersonalEvents: [...state.legacyPersonalEvents, event] })),
      removeLegacyPersonalEvent: (id) =>
        set((state) => ({
          legacyPersonalEvents: state.legacyPersonalEvents.filter((e) => e.id !== id),
        })),

      /* Scheduled events */
      scheduledEvents: [],
      scheduleEvent: (event) =>
        set((state) => {
          if (state.scheduledEvents.some((e) => e.id === event.id)) return state;
          return { scheduledEvents: [...state.scheduledEvents, event] };
        }),
      removeScheduledEvent: (id) =>
        set((state) => ({ scheduledEvents: state.scheduledEvents.filter((e) => e.id !== id) })),

      /* Saved events */
      savedEventIds: [],
      saveEvent: (id) =>
        set((state) => {
          if (state.savedEventIds.includes(id)) return state;
          return { savedEventIds: [...state.savedEventIds, id] };
        }),
      unsaveEvent: (id) =>
        set((state) => ({ savedEventIds: state.savedEventIds.filter((eid) => eid !== id) })),

      /* Disliked events */
      dislikedEventIds: [],
      dislikeEvent: (id) =>
        set((state) => ({
          dislikedEventIds: state.dislikedEventIds.includes(id)
            ? state.dislikedEventIds
            : [...state.dislikedEventIds, id],
        })),
      removeIdsFromDisliked: (ids) =>
        set((state) => ({
          dislikedEventIds: state.dislikedEventIds.filter((id) => !ids.includes(id)),
        })),
      clearDisliked: () => set({ dislikedEventIds: [] }),

      /* Received invites */
      receivedInvites: [],
      addInvite: (invite) =>
        set((state) => ({ receivedInvites: [...state.receivedInvites, invite] })),
      acceptInvite: (id) =>
        set((state) => {
          const invite = state.receivedInvites.find((inv) => inv.id === id);
          if (!invite) return state;
          const scheduled: ScheduledEvent = {
            id: invite.eventId,
            title: invite.title,
            location: invite.location,
            description: invite.description,
            date_ts: invite.date_ts,
            date_iso: invite.date_iso,
            location_lat: invite.location_lat,
            location_lng: invite.location_lng,
            category: invite.category,
            categories: invite.categories,
          };
          const alreadyScheduled = state.scheduledEvents.some((e) => e.id === scheduled.id);
          return {
            receivedInvites: state.receivedInvites.filter((inv) => inv.id !== id),
            scheduledEvents: alreadyScheduled
              ? state.scheduledEvents
              : [...state.scheduledEvents, scheduled],
          };
        }),
      rejectInvite: (id) =>
        set((state) => {
          const invite = state.receivedInvites.find((inv) => inv.id === id);
          const nextDisliked = invite
            ? [...state.dislikedEventIds, invite.eventId]
            : state.dislikedEventIds;
          return {
            receivedInvites: state.receivedInvites.filter((inv) => inv.id !== id),
            dislikedEventIds: nextDisliked,
          };
        }),

      /* Major-specific toggle (linked globally) */
      isMajorSpecific: false,
      selectedMajor: 'Engineering',
      setMajorSpecific: (val) => set({ isMajorSpecific: val }),
      setSelectedMajor: (major) => set({ selectedMajor: major }),
      /* Category deselection tracking */
      deselectedCategories: [],
      toggleCategoryDeselection: (category, isDeselected) =>
        set((state) => {
          const next = new Set(state.deselectedCategories);
          if (isDeselected) next.add(category);
          else next.delete(category);
          return { deselectedCategories: Array.from(next) };
        }),
    }),
    {
      name: 'event-storage',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<EventState>) || {};
        return {
          ...currentState,
          legacyPersonalEvents: Array.isArray(persisted.legacyPersonalEvents)
            ? persisted.legacyPersonalEvents
            : currentState.legacyPersonalEvents,
          scheduledEvents: Array.isArray(persisted.scheduledEvents)
            ? persisted.scheduledEvents
            : currentState.scheduledEvents,
          savedEventIds: isStringArray(persisted.savedEventIds)
            ? persisted.savedEventIds
            : currentState.savedEventIds,
          dislikedEventIds: isStringArray(persisted.dislikedEventIds)
            ? persisted.dislikedEventIds
            : currentState.dislikedEventIds,
          receivedInvites: Array.isArray(persisted.receivedInvites)
            ? persisted.receivedInvites
            : currentState.receivedInvites,
          isMajorSpecific: typeof persisted.isMajorSpecific === 'boolean'
            ? persisted.isMajorSpecific
            : currentState.isMajorSpecific,
          selectedMajor: isMajorOption(persisted.selectedMajor)
            ? persisted.selectedMajor
            : currentState.selectedMajor,
          deselectedCategories: isStringArray(persisted.deselectedCategories)
            ? persisted.deselectedCategories
            : currentState.deselectedCategories,
        };
      },
    },
  ),
);
