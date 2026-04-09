import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NavItemId = 'Dashboard' | 'Places' | 'Social' | 'Dining';
export type PlacesPillId =
  | 'Pulse'
  | 'Today'
  | 'Bus'
  | 'Library'
  | 'Rec'
  | 'Dining'
  | 'Parking'
  | 'Academic'
  | 'Academic'
  | 'Heatmap';
export type ParkingPermit = 'visitor' | 'garage' | 'any_valid' | 'west_campus' | 'resident';
export type SettingsTabId = 'personal' | 'layout' | 'resources';
export type TabBarMode = 'floating' | 'solid';
export type EventTimePreference = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';
export type EventSocialPreference = 'casual' | 'professional';

export interface ToggleLayoutItem<T extends string> {
  id: T;
  label: string;
  visible: boolean;
  order: number;
}

export const PARKING_PERMIT_OPTIONS: Array<{ id: ParkingPermit; label: string; description: string }> = [
  { id: 'visitor', label: 'Visitor', description: 'Highlights garages and visitor-friendly options.' },
  { id: 'garage', label: 'Garage', description: 'Prioritizes campus garages first.' },
  { id: 'any_valid', label: 'Any Valid Permit', description: 'Broad parking recommendations across lots and garages.' },
  { id: 'west_campus', label: 'West Campus', description: 'Prefers west campus garages and nearby lots.' },
  { id: 'resident', label: 'Resident', description: 'Keeps housing-adjacent parking easy to reach.' },
];

export const DEFAULT_NAV_ITEMS: ToggleLayoutItem<NavItemId>[] = [
  { id: 'Dashboard', label: 'Events', visible: true, order: 0 },
  { id: 'Places', label: 'Places', visible: true, order: 1 },
  { id: 'Social', label: 'Pings', visible: true, order: 2 },
  { id: 'Dining', label: 'Dining', visible: false, order: 3 },
];

export const DEFAULT_PLACES_PILLS: ToggleLayoutItem<PlacesPillId>[] = [
  { id: 'Pulse', label: 'Pulse', visible: true, order: 0 },
  { id: 'Today', label: 'Today', visible: true, order: 1 },
  { id: 'Bus', label: 'Buses', visible: true, order: 2 },
  { id: 'Dining', label: 'Dining', visible: true, order: 3 },
  { id: 'Heatmap', label: 'Traffic', visible: false, order: 4 },
  { id: 'Parking', label: 'Parking', visible: false, order: 5 },
  { id: 'Library', label: 'Libraries', visible: true, order: 6 },
  { id: 'Academic', label: 'Academic', visible: false, order: 7 },
  { id: 'Rec', label: 'Gyms', visible: false, order: 8 },
];

function sortItems<T extends string>(items: ToggleLayoutItem<T>[]) {
  return [...items].sort((left, right) => left.order - right.order);
}

function moveItem<T extends string>(items: ToggleLayoutItem<T>[], id: T, direction: -1 | 1) {
  const ordered = sortItems(items);
  const currentIndex = ordered.findIndex((item) => item.id === id);
  const targetIndex = currentIndex + direction;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
    return items;
  }

  const next = [...ordered];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, moved);

  return next.map((item, index) => ({
    ...item,
    order: index,
  }));
}

function toggleItem<T extends string>(items: ToggleLayoutItem<T>[], id: T) {
  return items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item));
}

function normalizeItems<T extends string>(
  storedItems: Array<Partial<ToggleLayoutItem<T>>> | undefined,
  defaults: ToggleLayoutItem<T>[],
) {
  if (!Array.isArray(storedItems) || storedItems.length === 0) {
    return defaults;
  }

  const lookup = new Map(storedItems.map((item) => [item.id, item]));
  const orderedStoredIds = [...storedItems]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((item) => item.id)
    .filter((id): id is T => !!id && defaults.some((entry) => entry.id === id));
  const orderedIds = [
    ...orderedStoredIds,
    ...defaults.map((item) => item.id).filter((id) => !orderedStoredIds.includes(id)),
  ];

  return orderedIds.map((id, index) => {
    const fallback = defaults.find((item) => item.id === id)!;
    const stored = lookup.get(id);
    return {
      ...fallback,
      ...stored,
      id: fallback.id,
      label: fallback.label,
      order: index,
    };
  });
}

function isPermit(value: unknown): value is ParkingPermit {
  return PARKING_PERMIT_OPTIONS.some((option) => option.id === value);
}

function isSettingsTabId(value: unknown): value is SettingsTabId {
  return value === 'personal' || value === 'layout' || value === 'resources';
}

function isTabBarMode(value: unknown): value is TabBarMode {
  return value === 'floating' || value === 'solid';
}

type AppShellState = {
  parkingPermit: ParkingPermit;
  placesPills: ToggleLayoutItem<PlacesPillId>[];
  navItems: ToggleLayoutItem<NavItemId>[];
  settingsTab: SettingsTabId;
  tabBarMode: TabBarMode;
  isBottomBarHidden: boolean;
  selectedScheduleId: string | null;
  isTOSAccepted: boolean;
  isTourCompleted: boolean;
  isNotificationPrompted: boolean;
  isEventPreferencesCompleted: boolean;
  showEventPreferencesOnboarding: boolean;
  preferredEventCategories: string[];
  preferredTime: EventTimePreference | null;
  preferredSocialMode: EventSocialPreference | null;
  adminAccessStatus: boolean | null;
  notificationsEnabled: boolean;
  eventNotifications: boolean;
  placeNotifications: boolean;
  pingNotifications: boolean;
  notificationLeadTime: number;
  setParkingPermit: (permit: ParkingPermit) => void;
  togglePlacesPill: (id: PlacesPillId) => void;
  movePlacesPill: (id: PlacesPillId, direction: -1 | 1) => void;
  toggleNavItem: (id: NavItemId) => void;
  moveNavItem: (id: NavItemId, direction: -1 | 1) => void;
  setSettingsTab: (tab: SettingsTabId) => void;
  setTabBarMode: (mode: TabBarMode) => void;
  setBottomBarHidden: (hidden: boolean) => void;
  setSelectedScheduleId: (id: string | null) => void;
  setTOSAccepted: (accepted: boolean) => void;
  setTourCompleted: (completed: boolean) => void;
  setNotificationPrompted: (prompted: boolean) => void;
  setEventPreferencesCompleted: (completed: boolean) => void;
  setShowEventPreferencesOnboarding: (visible: boolean) => void;
  setPreferredEventCategories: (categories: string[]) => void;
  setPreferredTime: (time: EventTimePreference | null) => void;
  setPreferredSocialMode: (mode: EventSocialPreference | null) => void;
  setAdminAccessStatus: (status: boolean | null) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setNotificationPreference: (key: 'event' | 'place' | 'ping', value: boolean) => void;
  setNotificationLeadTime: (time: number) => void;
};

export const useAppShellStore = create<AppShellState>()(
  persist(
    (set) => ({
      parkingPermit: 'any_valid',
      placesPills: DEFAULT_PLACES_PILLS,
      navItems: DEFAULT_NAV_ITEMS,
      settingsTab: 'personal',
      tabBarMode: 'solid',
      isBottomBarHidden: false,
      selectedScheduleId: null,
      isTOSAccepted: false,
      isTourCompleted: false,
      isNotificationPrompted: false,
      isEventPreferencesCompleted: false,
      showEventPreferencesOnboarding: false,
      preferredEventCategories: [],
      preferredTime: null,
      preferredSocialMode: null,
      adminAccessStatus: null,
      notificationsEnabled: false,
      eventNotifications: true,
      placeNotifications: true,
      pingNotifications: true,
      notificationLeadTime: 5,
      setParkingPermit: (parkingPermit) => set({ parkingPermit }),
      togglePlacesPill: (id) =>
        set((state) => ({
          placesPills: toggleItem(state.placesPills, id),
        })),
      movePlacesPill: (id, direction) =>
        set((state) => ({
          placesPills: moveItem(state.placesPills, id, direction),
        })),
      toggleNavItem: (id) =>
        set((state) => ({
          navItems: toggleItem(state.navItems, id),
        })),
      moveNavItem: (id, direction) =>
        set((state) => ({
          navItems: moveItem(state.navItems, id, direction),
        })),
      setSettingsTab: (settingsTab) => set({ settingsTab }),
      setTabBarMode: (tabBarMode) => set({ tabBarMode }),
      setBottomBarHidden: (isBottomBarHidden) => set({ isBottomBarHidden }),
      setSelectedScheduleId: (selectedScheduleId) => set({ selectedScheduleId }),
      setTOSAccepted: (isTOSAccepted) => set({ isTOSAccepted }),
      setTourCompleted: (isTourCompleted) => set({ isTourCompleted }),
      setNotificationPrompted: (isNotificationPrompted) => set({ isNotificationPrompted }),
      setEventPreferencesCompleted: (isEventPreferencesCompleted) => set({ isEventPreferencesCompleted }),
      setShowEventPreferencesOnboarding: (showEventPreferencesOnboarding) => set({ showEventPreferencesOnboarding }),
      setPreferredEventCategories: (preferredEventCategories) => set({ preferredEventCategories }),
      setPreferredTime: (preferredTime) => set({ preferredTime }),
      setPreferredSocialMode: (preferredSocialMode) => set({ preferredSocialMode }),
      setAdminAccessStatus: (adminAccessStatus) => set({ adminAccessStatus }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotificationPreference: (key, value) => set((state) => ({
        [`${key}Notifications`]: value,
      })),
      setNotificationLeadTime: (notificationLeadTime) => set({ notificationLeadTime }),
    }),
    {
      name: 'app-shell-store',
      version: 6,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        parkingPermit: state.parkingPermit,
        placesPills: state.placesPills,
        navItems: state.navItems,
        settingsTab: state.settingsTab,
        tabBarMode: state.tabBarMode,
        selectedScheduleId: state.selectedScheduleId,
        isTOSAccepted: state.isTOSAccepted,
        isTourCompleted: state.isTourCompleted,
        isNotificationPrompted: state.isNotificationPrompted,
        isEventPreferencesCompleted: state.isEventPreferencesCompleted,
        preferredEventCategories: state.preferredEventCategories,
        preferredTime: state.preferredTime,
        preferredSocialMode: state.preferredSocialMode,
        notificationsEnabled: state.notificationsEnabled,
        eventNotifications: state.eventNotifications,
        placeNotifications: state.placeNotifications,
        pingNotifications: state.pingNotifications,
        notificationLeadTime: state.notificationLeadTime,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<AppShellState>) || {};
        return {
          ...currentState,
          parkingPermit: isPermit(persisted.parkingPermit)
            ? persisted.parkingPermit
            : currentState.parkingPermit,
          placesPills: normalizeItems(persisted.placesPills, currentState.placesPills),
          navItems: normalizeItems(persisted.navItems, currentState.navItems),
          settingsTab: isSettingsTabId(persisted.settingsTab)
            ? persisted.settingsTab
            : currentState.settingsTab,
          tabBarMode: isTabBarMode(persisted.tabBarMode)
            ? persisted.tabBarMode
            : currentState.tabBarMode,
          selectedScheduleId:
            typeof persisted.selectedScheduleId === 'string' || persisted.selectedScheduleId === null
              ? persisted.selectedScheduleId
              : currentState.selectedScheduleId,
          isTOSAccepted: typeof persisted.isTOSAccepted === 'boolean'
            ? persisted.isTOSAccepted
            : currentState.isTOSAccepted,
          isTourCompleted: typeof persisted.isTourCompleted === 'boolean'
            ? persisted.isTourCompleted
            : currentState.isTourCompleted,
          isNotificationPrompted: typeof persisted.isNotificationPrompted === 'boolean'
            ? persisted.isNotificationPrompted
            : currentState.isNotificationPrompted,
          isEventPreferencesCompleted: typeof persisted.isEventPreferencesCompleted === 'boolean'
            ? persisted.isEventPreferencesCompleted
            : currentState.isEventPreferencesCompleted,
          preferredEventCategories: Array.isArray(persisted.preferredEventCategories)
            ? persisted.preferredEventCategories.filter((item): item is string => typeof item === 'string')
            : currentState.preferredEventCategories,
          preferredTime: typeof persisted.preferredTime === 'string'
            ? persisted.preferredTime as EventTimePreference
            : currentState.preferredTime,
          preferredSocialMode: persisted.preferredSocialMode === 'casual' || persisted.preferredSocialMode === 'professional'
            ? persisted.preferredSocialMode
            : currentState.preferredSocialMode,
          notificationsEnabled: typeof persisted.notificationsEnabled === 'boolean'
            ? persisted.notificationsEnabled
            : currentState.notificationsEnabled,
          eventNotifications: typeof persisted.eventNotifications === 'boolean'
            ? persisted.eventNotifications
            : currentState.eventNotifications,
          placeNotifications: typeof persisted.placeNotifications === 'boolean'
            ? persisted.placeNotifications
            : currentState.placeNotifications,
          pingNotifications: typeof persisted.pingNotifications === 'boolean'
            ? persisted.pingNotifications
            : currentState.pingNotifications,
          notificationLeadTime: typeof persisted.notificationLeadTime === 'number'
            ? persisted.notificationLeadTime
            : currentState.notificationLeadTime,
        };
      },
      migrate: (persistedState: any, version: number) => {
        if (version < 5) {
          const state = persistedState as Partial<AppShellState>;
          const newState = { ...state };
          
          newState.navItems = DEFAULT_NAV_ITEMS;
          newState.tabBarMode = 'solid';

          if (state.placesPills && Array.isArray(state.placesPills)) {
            newState.placesPills = state.placesPills.map(p => 
              p.id === 'Rec' ? { ...p, visible: false } : p
            );
          }
          newState.isEventPreferencesCompleted = typeof state.isEventPreferencesCompleted === 'boolean'
            ? state.isEventPreferencesCompleted
            : false;
          
          newState.preferredEventCategories = Array.isArray(state.preferredEventCategories)
            ? state.preferredEventCategories.filter((item): item is string => typeof item === 'string')
            : [];
          newState.preferredTime = typeof state.preferredTime === 'string'
            ? state.preferredTime as EventTimePreference
            : null;
          newState.preferredSocialMode = state.preferredSocialMode === 'casual' || state.preferredSocialMode === 'professional'
            ? state.preferredSocialMode
            : null;
          
          return newState;
        }

        if (version < 6) {
          const state = persistedState as Partial<AppShellState>;
          const newState = { ...state };
          
          newState.settingsTab = 'personal';
          newState.tabBarMode = 'solid';

          return newState;
        }
        return persistedState;
      },
    },
  ),
);

export function getOrderedItems<T extends string>(items: ToggleLayoutItem<T>[]) {
  return sortItems(items);
}

export function getOrderedVisibleItems<T extends string>(items: ToggleLayoutItem<T>[]) {
  return sortItems(items).filter((item) => item.visible);
}
