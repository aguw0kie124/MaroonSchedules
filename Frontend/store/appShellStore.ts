import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NavItemId =
  | 'Dashboard'
  | 'Places'
  | 'Dining'
  | 'Social'
  | 'Timer'
  | 'BusRoutes'
  | 'Events'
  | 'Menus';
export type HomeSectionId = 'schedule' | 'transit' | 'dining' | 'alerts' | 'events';
export type PlacesPillId =
  | 'Today'
  | 'Bus'
  | 'Library'
  | 'Rec'
  | 'Dining'
  | 'Parking'
  | 'Academic'
  | 'Study'
  | 'Heatmap';
export type SocialTabId = 'home' | 'events' | 'reels' | 'messages';
export type DiningActionId =
  | 'rings'
  | 'macros'
  | 'tracker'
  | 'menus'
  | 'streak'
  | 'swipes'
  | 'database';
export type TimerModuleId = 'pomodoro' | 'habits' | 'focus_tools';
export type AppMode = 'academic' | 'social' | 'navigation' | 'dining' | 'all_in_one';
export type UIDensity = 'minimal' | 'standard' | 'full';
export type ShellPresetId = 'freshman' | 'commuter' | 'resident' | 'power';
export type ParkingPermit = 'visitor' | 'garage' | 'any_valid' | 'west_campus' | 'resident';
export type PlacesViewMode = 'map' | 'list';
export type SettingsTabId = 'personal' | 'layout' | 'resources';

export interface ToggleLayoutItem<T extends string> {
  id: T;
  label: string;
  visible: boolean;
  order: number;
}

export const APP_MODE_OPTIONS: Array<{ id: AppMode; label: string; description: string }> = [
  { id: 'academic', label: 'Academic', description: 'Classes, schedule, readiness, and focused planning.' },
  { id: 'social', label: 'Social', description: 'Events, org activity, and community-first discovery.' },
  { id: 'navigation', label: 'Navigation', description: 'Places, buses, parking, and getting around fast.' },
  { id: 'dining', label: 'Dining', description: 'Menus, nearby food, dollars, and meal tracking first.' },
  { id: 'all_in_one', label: 'All-in-One', description: 'A balanced dashboard across the whole campus experience.' },
];

export const UI_DENSITY_OPTIONS: Array<{ id: UIDensity; label: string; description: string }> = [
  { id: 'minimal', label: 'Minimal', description: 'Fewer cards, shorter summaries, faster scanning.' },
  { id: 'standard', label: 'Standard', description: 'Balanced detail for daily use.' },
  { id: 'full', label: 'Full', description: 'More information visible before you drill in.' },
];

export const SHELL_PRESET_OPTIONS: Array<{ id: ShellPresetId; label: string; description: string }> = [
  { id: 'freshman', label: 'The Fish', description: 'Wayfinding, dining, and academics tuned for getting oriented.' },
  { id: 'commuter', label: 'The Commuter', description: 'Parking, buses, schedule timing, and lower-noise layout.' },
  { id: 'resident', label: 'The Hungry', description: 'Dining, events, and social surfaces stay more prominent.' },
  { id: 'power', label: 'The Intellectual', description: 'Higher density layout with more modules visible at once.' },
];

export const PARKING_PERMIT_OPTIONS: Array<{ id: ParkingPermit; label: string; description: string }> = [
  { id: 'visitor', label: 'Visitor', description: 'Highlights garages and visitor-friendly options.' },
  { id: 'garage', label: 'Garage', description: 'Prioritizes campus garages first.' },
  { id: 'any_valid', label: 'Any Valid Permit', description: 'Broad parking recommendations across lots and garages.' },
  { id: 'west_campus', label: 'West Campus', description: 'Prefers west campus garages and nearby lots.' },
  { id: 'resident', label: 'Resident', description: 'Keeps housing-adjacent parking easy to reach.' },
];

export const PLACES_VIEW_MODE_OPTIONS: Array<{ id: PlacesViewMode; label: string; description: string }> = [
  { id: 'map', label: 'Map First', description: 'Open Places in map mode with floating controls.' },
  { id: 'list', label: 'List First', description: 'Open Places in list mode for faster browsing.' },
];

export const DEFAULT_NAV_ITEMS: ToggleLayoutItem<NavItemId>[] = [
  { id: 'Events', label: 'Events', visible: true, order: 0 },
  { id: 'Places', label: 'Places', visible: true, order: 1 },
  { id: 'Social', label: 'Social', visible: true, order: 2 },
  { id: 'Dining', label: 'Dining', visible: true, order: 3 },
  { id: 'Dashboard', label: 'Home', visible: false, order: 4 },
  { id: 'Timer', label: 'Timer', visible: false, order: 5 },
  { id: 'BusRoutes', label: 'Bus Routes', visible: false, order: 6 },
  { id: 'Menus', label: 'Menus', visible: false, order: 7 },
];

export const DEFAULT_HOME_SECTIONS: ToggleLayoutItem<HomeSectionId>[] = [
  { id: 'schedule', label: "What's Next", visible: true, order: 0 },
  { id: 'transit', label: 'Transit Window', visible: true, order: 1 },
  { id: 'dining', label: 'Dining Now', visible: true, order: 2 },
  { id: 'alerts', label: 'Priority Alerts', visible: true, order: 3 },
  { id: 'events', label: 'Events Near You', visible: true, order: 4 },
];

export const DEFAULT_PLACES_PILLS: ToggleLayoutItem<PlacesPillId>[] = [
  { id: 'Today', label: 'Today', visible: true, order: 0 },
  { id: 'Bus', label: 'Buses', visible: true, order: 1 },
  { id: 'Dining', label: 'Dining', visible: true, order: 2 },
  { id: 'Heatmap', label: 'Traffic', visible: false, order: 3 },
  { id: 'Parking', label: 'Parking', visible: false, order: 4 },
  { id: 'Library', label: 'Libraries', visible: false, order: 5 },
  { id: 'Academic', label: 'Academic', visible: false, order: 6 },
  { id: 'Rec', label: 'Gyms', visible: false, order: 7 },
  { id: 'Study', label: 'Study', visible: false, order: 8 },
];

export const DEFAULT_SOCIAL_TABS: ToggleLayoutItem<SocialTabId>[] = [
  { id: 'home', label: 'Home', visible: true, order: 0 },
  { id: 'events', label: 'Events', visible: true, order: 1 },
  { id: 'reels', label: 'Reels', visible: true, order: 2 },
  { id: 'messages', label: 'Messages', visible: true, order: 3 },
];

export const DEFAULT_DINING_ACTIONS: ToggleLayoutItem<DiningActionId>[] = [
  { id: 'rings', label: 'Calorie Rings', visible: false, order: 0 },
  { id: 'macros', label: 'Macro Summary', visible: false, order: 1 },
  { id: 'tracker', label: 'Tracker', visible: false, order: 2 },
  { id: 'menus', label: 'Menus', visible: true, order: 3 },
  { id: 'streak', label: 'Streak', visible: false, order: 4 },
  { id: 'swipes', label: 'Swipes', visible: false, order: 5 },
  { id: 'database', label: 'Database', visible: false, order: 6 },
];

export const DEFAULT_TIMER_MODULES: ToggleLayoutItem<TimerModuleId>[] = [
  { id: 'pomodoro', label: 'Pomodoro', visible: true, order: 0 },
  { id: 'habits', label: 'Study Habits', visible: true, order: 1 },
  { id: 'focus_tools', label: 'Focus Tools', visible: true, order: 2 },
];

function sortItems<T extends string>(items: ToggleLayoutItem<T>[]) {
  return [...items].sort((left, right) => left.order - right.order);
}

function moveItem<T extends string>(
  items: ToggleLayoutItem<T>[],
  id: T,
  direction: -1 | 1,
) {
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
  return items.map((item) =>
    item.id === id ? { ...item, visible: !item.visible } : item,
  );
}

function applyVisibleOrder<T extends string>(
  defaults: ToggleLayoutItem<T>[],
  visibleIds: T[],
) {
  const lookup = new Map(defaults.map((item) => [item.id, item]));
  const orderedIds = [
    ...visibleIds,
    ...defaults.map((item) => item.id).filter((id) => !visibleIds.includes(id)),
  ];

  return orderedIds.map((id, index) => ({
    ...lookup.get(id)!,
    visible: visibleIds.includes(id),
    order: index,
  }));
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

function isAppMode(value: unknown): value is AppMode {
  return APP_MODE_OPTIONS.some((option) => option.id === value);
}

function isDensity(value: unknown): value is UIDensity {
  return UI_DENSITY_OPTIONS.some((option) => option.id === value);
}

function isPreset(value: unknown): value is ShellPresetId {
  return SHELL_PRESET_OPTIONS.some((option) => option.id === value);
}

function isPermit(value: unknown): value is ParkingPermit {
  return PARKING_PERMIT_OPTIONS.some((option) => option.id === value);
}

function isPlacesViewMode(value: unknown): value is PlacesViewMode {
  return PLACES_VIEW_MODE_OPTIONS.some((option) => option.id === value);
}

function isNavItemId(value: unknown): value is NavItemId {
  return DEFAULT_NAV_ITEMS.some((item) => item.id === value);
}

function buildPresetState(preset: ShellPresetId) {
  switch (preset) {
    case 'freshman':
      return {
        appMode: 'academic' as AppMode,
        density: 'standard' as UIDensity,
        defaultLandingTab: 'Places' as NavItemId,
        parkingPermit: 'visitor' as ParkingPermit,
        placesViewMode: 'map' as PlacesViewMode,
        navItems: applyVisibleOrder(DEFAULT_NAV_ITEMS, ['Events', 'Places', 'Social', 'Dining']),
        homeSections: applyVisibleOrder(DEFAULT_HOME_SECTIONS, ['schedule', 'transit', 'dining', 'events', 'alerts']),
        placesPills: applyVisibleOrder(DEFAULT_PLACES_PILLS, ['Today', 'Bus', 'Dining', 'Heatmap']),
      };
    case 'commuter':
      return {
        appMode: 'navigation' as AppMode,
        density: 'minimal' as UIDensity,
        defaultLandingTab: 'Places' as NavItemId,
        parkingPermit: 'garage' as ParkingPermit,
        placesViewMode: 'list' as PlacesViewMode,
        navItems: applyVisibleOrder(DEFAULT_NAV_ITEMS, ['Events', 'Places', 'Social', 'Dining', 'BusRoutes']),
        homeSections: applyVisibleOrder(DEFAULT_HOME_SECTIONS, ['transit', 'schedule', 'alerts', 'dining']),
        placesPills: applyVisibleOrder(DEFAULT_PLACES_PILLS, ['Today', 'Bus', 'Heatmap', 'Parking', 'Dining']),
      };
    case 'resident':
      return {
        appMode: 'social' as AppMode,
        density: 'standard' as UIDensity,
        defaultLandingTab: 'Places' as NavItemId,
        parkingPermit: 'resident' as ParkingPermit,
        placesViewMode: 'map' as PlacesViewMode,
        navItems: applyVisibleOrder(DEFAULT_NAV_ITEMS, ['Events', 'Places', 'Social', 'Dining']),
        homeSections: applyVisibleOrder(DEFAULT_HOME_SECTIONS, ['dining', 'events', 'schedule', 'alerts', 'transit']),
        placesPills: applyVisibleOrder(DEFAULT_PLACES_PILLS, ['Today', 'Dining', 'Bus', 'Heatmap', 'Parking']),
      };
    case 'power':
      return {
        appMode: 'all_in_one' as AppMode,
        density: 'full' as UIDensity,
        defaultLandingTab: 'Places' as NavItemId,
        parkingPermit: 'any_valid' as ParkingPermit,
        placesViewMode: 'map' as PlacesViewMode,
        navItems: applyVisibleOrder(DEFAULT_NAV_ITEMS, ['Events', 'Places', 'Social', 'Dining', 'BusRoutes', 'Menus', 'Timer']),
        homeSections: applyVisibleOrder(DEFAULT_HOME_SECTIONS, ['schedule', 'transit', 'dining', 'alerts', 'events']),
        placesPills: applyVisibleOrder(DEFAULT_PLACES_PILLS, ['Today', 'Bus', 'Dining', 'Heatmap', 'Parking', 'Library', 'Academic', 'Rec', 'Study']),
      };
  }
}

export function getShellPresetState(preset: ShellPresetId) {
  return buildPresetState(preset);
}

interface AppShellState {
  navItems: ToggleLayoutItem<NavItemId>[];
  homeSections: ToggleLayoutItem<HomeSectionId>[];
  placesPills: ToggleLayoutItem<PlacesPillId>[];
  socialTabs: ToggleLayoutItem<SocialTabId>[];
  diningActions: ToggleLayoutItem<DiningActionId>[];
  timerModules: ToggleLayoutItem<TimerModuleId>[];
  appMode: AppMode;
  density: UIDensity;
  shellPreset: ShellPresetId;
  defaultLandingTab: NavItemId;
  parkingPermit: ParkingPermit;
  placesViewMode: PlacesViewMode;
  settingsTab: SettingsTabId;
  isBottomBarHidden: boolean;
  tabBarMode: 'floating' | 'solid';
  selectedScheduleId: string | null;
  schedules: any[];
  toggleNavItem: (id: NavItemId) => void;
  moveNavItem: (id: NavItemId, direction: -1 | 1) => void;
  toggleHomeSection: (id: HomeSectionId) => void;
  moveHomeSection: (id: HomeSectionId, direction: -1 | 1) => void;
  togglePlacesPill: (id: PlacesPillId) => void;
  movePlacesPill: (id: PlacesPillId, direction: -1 | 1) => void;
  toggleSocialTab: (id: SocialTabId) => void;
  moveSocialTab: (id: SocialTabId, direction: -1 | 1) => void;
  toggleDiningAction: (id: DiningActionId) => void;
  moveDiningAction: (id: DiningActionId, direction: -1 | 1) => void;
  toggleTimerModule: (id: TimerModuleId) => void;
  moveTimerModule: (id: TimerModuleId, direction: -1 | 1) => void;
  setAppMode: (mode: AppMode) => void;
  setDensity: (density: UIDensity) => void;
  setDefaultLandingTab: (tab: NavItemId) => void;
  setParkingPermit: (permit: ParkingPermit) => void;
  setPlacesViewMode: (mode: PlacesViewMode) => void;
  setSettingsTab: (tab: SettingsTabId) => void;
  setBottomBarHidden: (hidden: boolean) => void;
  setTabBarMode: (mode: 'floating' | 'solid') => void;
  setSelectedScheduleId: (id: string | null) => void;
  setSchedules: (schedules: any[]) => void;
  applyPreset: (preset: ShellPresetId) => void;
}

const defaultPresetState = {
  appMode: 'navigation' as AppMode,
  density: 'standard' as UIDensity,
  defaultLandingTab: 'Events' as NavItemId,
  parkingPermit: 'visitor' as ParkingPermit,
  placesViewMode: 'map' as PlacesViewMode,
  navItems: applyVisibleOrder(DEFAULT_NAV_ITEMS, ['Events', 'Places', 'Social', 'Dining']),
  homeSections: applyVisibleOrder(DEFAULT_HOME_SECTIONS, ['schedule', 'alerts']),
  placesPills: applyVisibleOrder(DEFAULT_PLACES_PILLS, ['Today', 'Bus', 'Dining']),
};

export const useAppShellStore = create<AppShellState>()(
  persist(
    (set) => ({
      navItems: defaultPresetState.navItems,
      homeSections: defaultPresetState.homeSections,
      placesPills: defaultPresetState.placesPills,
      socialTabs: DEFAULT_SOCIAL_TABS,
      diningActions: DEFAULT_DINING_ACTIONS,
      timerModules: DEFAULT_TIMER_MODULES,
      appMode: defaultPresetState.appMode,
      density: defaultPresetState.density,
      shellPreset: 'freshman',
      defaultLandingTab: defaultPresetState.defaultLandingTab,
      parkingPermit: defaultPresetState.parkingPermit,
      placesViewMode: defaultPresetState.placesViewMode,
      settingsTab: 'layout',
      isBottomBarHidden: false,
      tabBarMode: 'floating',
      selectedScheduleId: null,
      schedules: [],
      toggleNavItem: (id) =>
        set((state) => ({
          navItems: toggleItem(state.navItems, id),
        })),
      moveNavItem: (id, direction) =>
        set((state) => ({
          navItems: moveItem(state.navItems, id, direction),
        })),
      toggleHomeSection: (id) =>
        set((state) => ({
          homeSections: toggleItem(state.homeSections, id),
        })),
      moveHomeSection: (id, direction) =>
        set((state) => ({
          homeSections: moveItem(state.homeSections, id, direction),
        })),
      togglePlacesPill: (id) =>
        set((state) => ({
          placesPills: toggleItem(state.placesPills, id),
        })),
      movePlacesPill: (id, direction) =>
        set((state) => ({
          placesPills: moveItem(state.placesPills, id, direction),
        })),
      toggleSocialTab: (id) =>
        set((state) => ({
          socialTabs: toggleItem(state.socialTabs, id),
        })),
      moveSocialTab: (id, direction) =>
        set((state) => ({
          socialTabs: moveItem(state.socialTabs, id, direction),
        })),
      toggleDiningAction: (id) =>
        set((state) => ({
          diningActions: toggleItem(state.diningActions, id),
        })),
      moveDiningAction: (id, direction) =>
        set((state) => ({
          diningActions: moveItem(state.diningActions, id, direction),
        })),
      toggleTimerModule: (id) =>
        set((state) => ({
          timerModules: toggleItem(state.timerModules, id),
        })),
      moveTimerModule: (id, direction) =>
        set((state) => ({
          timerModules: moveItem(state.timerModules, id, direction),
        })),
      setAppMode: (appMode) => set({ appMode }),
      setDensity: (density) => set({ density }),
      setDefaultLandingTab: (defaultLandingTab) => set({ defaultLandingTab }),
      setParkingPermit: (parkingPermit) => set({ parkingPermit }),
      setPlacesViewMode: (placesViewMode) => set({ placesViewMode }),
      setSettingsTab: (settingsTab) => set({ settingsTab }),
      setBottomBarHidden: (isBottomBarHidden) => set({ isBottomBarHidden }),
      setTabBarMode: (tabBarMode) => set({ tabBarMode }),
      setSelectedScheduleId: (selectedScheduleId) => set({ selectedScheduleId }),
      setSchedules: (schedules) => set({ schedules }),
      applyPreset: (shellPreset) => {
        const nextPreset = buildPresetState(shellPreset);
        set({
          shellPreset,
          appMode: nextPreset.appMode,
          density: nextPreset.density,
          defaultLandingTab: nextPreset.defaultLandingTab,
          parkingPermit: nextPreset.parkingPermit,
          placesViewMode: nextPreset.placesViewMode,
          navItems: nextPreset.navItems,
          homeSections: nextPreset.homeSections,
          placesPills: nextPreset.placesPills,
        });
      },
    }),
    {
      name: 'app-shell-store',
      version: 14,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any, version: number) => {
        if (!persistedState) return persistedState;
        
        let newState = { ...persistedState };
        if (version < 14) {
          if (newState.tabBarMode === 'parin') {
            newState.tabBarMode = 'solid';
          }
        }

        if (version < 11) {
          // Force "Today" to be the very first pill in the Map layer scroller
          if (Array.isArray(newState.placesPills)) {
            const items = [...newState.placesPills];
            const index = items.findIndex((p: any) => p.id === "Today");
            if (index !== -1) {
              const [today] = items.splice(index, 1);
              items.unshift(today);
              newState.placesPills = items.map((p, i) => ({ ...p, order: i }));
            } else {
              // If somehow Today is missing, ensure it's added at the front
              newState.placesPills = applyVisibleOrder(DEFAULT_PLACES_PILLS, ['Today', 'Bus', 'Dining']);
            }
          }
        }

        if (version < 10) {
          // Force new order: Events, Places, Dining, Social
          newState.navItems = applyVisibleOrder(DEFAULT_NAV_ITEMS, ['Events', 'Places', 'Dining', 'Social']);
          newState.defaultLandingTab = 'Events';
        }

        if (version < 9) {
          // Promote 'Events' as the default landing tab for all users transitioning to the refined layout
          // We only do this if they were on one of the historical defaults
          if (newState.defaultLandingTab === 'Places' || newState.defaultLandingTab === 'Dashboard') {
            newState.defaultLandingTab = 'Events';
          }
          
          // Also ensure the nav bar order reflects the new priority
          newState.navItems = applyVisibleOrder(DEFAULT_NAV_ITEMS, ['Events', 'Places', 'Social', 'Dining']);
          
          // Handle old name for Today pill if transitioning from very old versions
          if (Array.isArray(newState.placesPills)) {
            newState.placesPills = newState.placesPills.map((pill: any) => 
              pill.id === ('Classes' as any) ? { ...pill, id: 'Today', label: 'Today' } : pill
            );
          }
        }

        return newState;
      },
      partialize: (state) => ({
        navItems: state.navItems,
        homeSections: state.homeSections,
        placesPills: state.placesPills,
        socialTabs: state.socialTabs,
        diningActions: state.diningActions,
        timerModules: state.timerModules,
        appMode: state.appMode,
        density: state.density,
        shellPreset: state.shellPreset,
        defaultLandingTab: state.defaultLandingTab,
        parkingPermit: state.parkingPermit,
        placesViewMode: state.placesViewMode,
        settingsTab: state.settingsTab,
        tabBarMode: state.tabBarMode,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState || {}) as Partial<AppShellState>;
        return {
          ...currentState,
          ...persisted,
          navItems: normalizeItems(persisted.navItems, currentState.navItems),
          homeSections: normalizeItems(persisted.homeSections, currentState.homeSections),
          placesPills: normalizeItems(persisted.placesPills, currentState.placesPills),
          socialTabs: normalizeItems(persisted.socialTabs, currentState.socialTabs),
          diningActions: normalizeItems(persisted.diningActions, currentState.diningActions),
          timerModules: normalizeItems(persisted.timerModules, currentState.timerModules),
          appMode: isAppMode(persisted.appMode) ? persisted.appMode : currentState.appMode,
          density: isDensity(persisted.density) ? persisted.density : currentState.density,
          shellPreset: isPreset(persisted.shellPreset) ? persisted.shellPreset : currentState.shellPreset,
          defaultLandingTab: isNavItemId(persisted.defaultLandingTab)
            ? persisted.defaultLandingTab
            : currentState.defaultLandingTab,
          parkingPermit: isPermit(persisted.parkingPermit)
            ? persisted.parkingPermit
            : currentState.parkingPermit,
          placesViewMode: isPlacesViewMode(persisted.placesViewMode)
            ? persisted.placesViewMode
            : currentState.placesViewMode,
          tabBarMode:
            persisted.tabBarMode === 'floating' || persisted.tabBarMode === 'solid'
              ? persisted.tabBarMode
              : currentState.tabBarMode,
          settingsTab:
            persisted.settingsTab === 'personal' ||
            persisted.settingsTab === 'layout' ||
            persisted.settingsTab === 'resources'
              ? persisted.settingsTab
              : currentState.settingsTab,
        };
      },
    },
  ),
);

export function getOrderedVisibleItems<T extends string>(
  items: ToggleLayoutItem<T>[],
) {
  return sortItems(items).filter((item) => item.visible);
}

export function getOrderedItems<T extends string>(items: ToggleLayoutItem<T>[]) {
  return sortItems(items);
}

export function isNavItemVisible(
  navItems: ToggleLayoutItem<NavItemId>[],
  navItemId: NavItemId,
) {
  return navItems.some((item) => item.id === navItemId && item.visible);
}
