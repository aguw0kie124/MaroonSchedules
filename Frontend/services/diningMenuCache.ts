import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestJson } from '../api/client';
import { getLocalDateString } from './dateUtils';

const CACHE_PREFIX = 'dining-menu-cache-v2';
const LAST_PRUNE_KEY = `${CACHE_PREFIX}:last-pruned`;

const DINING_LOCATION_ALIASES: Record<string, string> = {
  sbisa: 'Sbisa Dining Hall (North Campus)',
  'sbisa dining hall': 'Sbisa Dining Hall (North Campus)',
  duncan: 'Duncan Dining Hall (South Campus/Quad)',
  'duncan dining hall': 'Duncan Dining Hall (South Campus/Quad)',
  commons: 'The Commons Dining Hall (South Campus)',
  'the commons': 'The Commons Dining Hall (South Campus)',
  'the commons dining hall': 'The Commons Dining Hall (South Campus)',
  'chick-fil-a (msc)': 'Chick-fil-A',
  'chick-fil-a - msc': 'Chick-fil-A',
  'panda express (msc)': 'Panda Express',
  'rev\'s american grill (msc)': 'Rev\'s American Grill',
  'houston street subs (msc)': 'Houston Street Subs',
  'shake smart (msc)': 'Shake Smart',
  'polo road garage dining': 'Panda Express',
  'panda express (polo)': 'Panda Express',
  'salata (polo)': 'Salata',
  'shake smart (polo)': 'Shake Smart',
  'hullabaloo food court': 'Houston Street Subs',
  'underground food court': 'Chick-fil-A',
};

export const DINING_PREFETCH_LOCATIONS = [
  'Sbisa',
  'Commons',
  'Duncan',
  'Chick-fil-A',
  'Panda Express',
  'Houston Street Subs',
  'Shake Smart',
  'Salata',
];

type CachedMenuPayload = {
  dateKey: string;
  fetchedAt: string;
  location: string;
  resolvedLocation: string;
  mealPeriod: string;
  data: any;
};

export type DiningMealPeriod = 'breakfast' | 'lunch' | 'dinner';
export const ALL_DINING_MEAL_PERIODS: DiningMealPeriod[] = ['breakfast', 'lunch', 'dinner'];

type MealWindow = {
  mealPeriod: DiningMealPeriod;
  startMinutes: number;
  endMinutes: number;
};

function toMinutes(hour: number, minute = 0) {
  return hour * 60 + minute;
}

function getMinutesFromDate(date: Date) {
  return toMinutes(date.getHours(), date.getMinutes());
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isFriday(date: Date) {
  return date.getDay() === 5;
}

function buildMealWindows(locationName?: string | null, date = new Date()): MealWindow[] {
  const resolved = resolveDiningLocationForMenu(locationName || '')?.toLowerCase() || '';
  const weekend = isWeekend(date);
  const friday = isFriday(date);

  if (resolved.includes('sbisa')) {
    if (weekend) {
      return [
        { mealPeriod: 'lunch', startMinutes: toMinutes(10, 0), endMinutes: toMinutes(14, 0) },
        { mealPeriod: 'dinner', startMinutes: toMinutes(17, 0), endMinutes: toMinutes(20, 0) },
      ];
    }

    return [
      { mealPeriod: 'breakfast', startMinutes: toMinutes(7, 0), endMinutes: toMinutes(10, 30) },
      { mealPeriod: 'lunch', startMinutes: toMinutes(10, 30), endMinutes: toMinutes(14, 30) },
      { mealPeriod: 'dinner', startMinutes: toMinutes(17, 0), endMinutes: friday ? toMinutes(20, 0) : toMinutes(20, 0) },
    ];
  }

  if (resolved.includes('commons')) {
    if (weekend) {
      return [
        { mealPeriod: 'lunch', startMinutes: toMinutes(9, 0), endMinutes: toMinutes(14, 0) },
        { mealPeriod: 'dinner', startMinutes: toMinutes(17, 0), endMinutes: toMinutes(20, 0) },
      ];
    }

    return [
      { mealPeriod: 'breakfast', startMinutes: toMinutes(7, 0), endMinutes: toMinutes(10, 0) },
      { mealPeriod: 'lunch', startMinutes: toMinutes(10, 0), endMinutes: toMinutes(14, 0) },
      { mealPeriod: 'dinner', startMinutes: toMinutes(17, 0), endMinutes: friday ? toMinutes(20, 0) : toMinutes(21, 30) },
    ];
  }

  if (resolved.includes('duncan')) {
    if (weekend) {
      return [
        { mealPeriod: 'lunch', startMinutes: toMinutes(9, 0), endMinutes: toMinutes(14, 0) },
        { mealPeriod: 'dinner', startMinutes: toMinutes(17, 0), endMinutes: toMinutes(20, 0) },
      ];
    }

    return [
      { mealPeriod: 'breakfast', startMinutes: toMinutes(7, 0), endMinutes: toMinutes(10, 0) },
      { mealPeriod: 'lunch', startMinutes: toMinutes(10, 30), endMinutes: toMinutes(14, 0) },
      { mealPeriod: 'dinner', startMinutes: toMinutes(17, 0), endMinutes: toMinutes(20, 0) },
    ];
  }

  return [
    { mealPeriod: 'breakfast', startMinutes: toMinutes(7, 0), endMinutes: toMinutes(10, 0) },
    { mealPeriod: 'lunch', startMinutes: toMinutes(10, 30), endMinutes: toMinutes(14, 30) },
    { mealPeriod: 'dinner', startMinutes: toMinutes(17, 0), endMinutes: toMinutes(20, 0) },
  ];
}

export function isDiningHallMenuLocation(locationName?: string | null) {
  const resolved = resolveDiningLocationForMenu(locationName || '')?.toLowerCase() || '';
  return resolved.includes('dining hall');
}

export function getCurrentMealPeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 16) return 'lunch';
  return 'dinner';
}

export function getDiningMealOptionsForLocation(locationName?: string | null, date = new Date()): DiningMealPeriod[] {
  if (isDiningHallMenuLocation(locationName)) {
    return ALL_DINING_MEAL_PERIODS;
  }
  const ordered = buildMealWindows(locationName, date).map((window) => window.mealPeriod);
  return Array.from(new Set(ordered));
}

export function getDiningMealPeriodForLocation(locationName?: string | null, date = new Date()): DiningMealPeriod {
  const windows = buildMealWindows(locationName, date);
  const minutes = getMinutesFromDate(date);

  const currentWindow = windows.find(
    (window) => minutes >= window.startMinutes && minutes <= window.endMinutes,
  );
  if (currentWindow) {
    return currentWindow.mealPeriod;
  }

  const nextWindow = windows.find((window) => minutes < window.startMinutes);
  if (nextWindow) {
    return nextWindow.mealPeriod;
  }

  return windows[0]?.mealPeriod || 'lunch';
}

export function resolveDiningLocationForMenu(locationName?: string | null) {
  if (!locationName) return null;
  const normalized = locationName.trim().toLowerCase();
  if (DINING_LOCATION_ALIASES[normalized]) {
    return DINING_LOCATION_ALIASES[normalized];
  }
  if (normalized.includes('chick-fil-a')) return 'Chick-fil-A';
  if (normalized.includes('panda express')) return 'Panda Express';
  if (normalized.includes('houston street subs')) return 'Houston Street Subs';
  if (normalized.includes('shake smart')) return 'Shake Smart';
  if (normalized.includes('salata')) return 'Salata';
  if (normalized.includes('rev')) return 'Rev\'s American Grill';
  if (normalized.includes('bagel')) return 'Einstein Bros. Bagels';
  if (normalized.includes('sbisa') && normalized.includes('dining hall')) return 'Sbisa Dining Hall (North Campus)';
  if (normalized.includes('duncan') && normalized.includes('dining hall')) return 'Duncan Dining Hall (South Campus/Quad)';
  if (normalized.includes('commons') && normalized.includes('dining hall')) return 'The Commons Dining Hall (South Campus)';
  return locationName;
}

function getCacheKey(location: string, mealPeriod: string, dateKey: string) {
  return `${CACHE_PREFIX}:${location.toLowerCase()}:${mealPeriod.toLowerCase()}:${dateKey}`;
}

function getMenuItemCount(data: any) {
  if (!Array.isArray(data?.categories)) return 0;
  return data.categories.reduce(
    (sum: number, category: any) => sum + (Array.isArray(category?.items) ? category.items.length : 0),
    0,
  );
}

async function pruneStaleMenus(dateKey: string) {
  const lastPruned = await AsyncStorage.getItem(LAST_PRUNE_KEY);
  if (lastPruned === dateKey) {
    return;
  }

  const keys = await AsyncStorage.getAllKeys();
  const staleKeys = keys.filter(
    (key) =>
      key.startsWith(`${CACHE_PREFIX}:`) &&
      key !== LAST_PRUNE_KEY &&
      !key.endsWith(`:${dateKey}`),
  );

  if (staleKeys.length > 0) {
    await AsyncStorage.multiRemove(staleKeys);
  }

  await AsyncStorage.setItem(LAST_PRUNE_KEY, dateKey);
}

const MENU_STALE_TIME = 1000 * 60 * 60; // 60 minutes

export async function fetchDiningFullMenuCached({
  location,
  mealPeriod = getCurrentMealPeriod(),
  forceRefresh = false,
}: {
  location: string;
  mealPeriod?: string;
  forceRefresh?: boolean;
}) {
  const resolvedLocation = resolveDiningLocationForMenu(location);
  if (!resolvedLocation) {
    return null;
  }

  const dateKey = getLocalDateString();
  const cacheKey = getCacheKey(resolvedLocation, mealPeriod, dateKey);
  await pruneStaleMenus(dateKey);

  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    const parsed: CachedMenuPayload = JSON.parse(cached);
    const fetchedAt = new Date(parsed.fetchedAt).getTime();
    const now = Date.now();
    const isStale = now - fetchedAt > MENU_STALE_TIME;

    if (!forceRefresh && !isStale) {
      const cachedItemCount = getMenuItemCount(parsed?.data);
      const staleDiningHallPayload =
        isDiningHallMenuLocation(resolvedLocation) && cachedItemCount > 0 && cachedItemCount <= 2;

      if (
        parsed?.data?.success &&
        Array.isArray(parsed?.data?.categories) &&
        parsed.data.categories.length > 0 &&
        !staleDiningHallPayload
      ) {
        return {
          ...parsed.data,
          fromCache: true,
          resolvedLocation,
        };
      }
    }
  }

  const params = new URLSearchParams({
    location: resolvedLocation,
    meal_period: mealPeriod,
    date: dateKey,
  });
  const data = await requestJson(`/dining/full-menu?${params.toString()}`);

  const isDiningHall = isDiningHallMenuLocation(resolvedLocation);
  if (!isDiningHall && data?.success && Array.isArray(data?.categories) && data.categories.length > 0) {
    const payload: CachedMenuPayload = {
      dateKey,
      fetchedAt: new Date().toISOString(),
      location,
      resolvedLocation,
      mealPeriod,
      data,
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
  }

  return {
    ...data,
    fromCache: false,
    resolvedLocation,
  };
}

export async function prefetchDiningMenus(
  locations: string[],
  mealPeriods: string[] = ALL_DINING_MEAL_PERIODS,
) {
  const uniquePairs = new Map<string, { location: string; mealPeriod: string }>();

  locations.forEach((location) => {
    const resolvedLocation = resolveDiningLocationForMenu(location);
    if (!resolvedLocation) return;

    mealPeriods.forEach((mealPeriod) => {
      uniquePairs.set(`${resolvedLocation}:${mealPeriod}`, {
        location: resolvedLocation,
        mealPeriod,
      });
    });
  });

  await Promise.all(
    Array.from(uniquePairs.values()).map(({ location, mealPeriod }) =>
      fetchDiningFullMenuCached({ location, mealPeriod }).catch(() => null),
    ),
  );
}

export function getDiningMenuCandidates(locationName: string, restaurants: string[] = []) {
  const candidates = new Set<string>();
  const resolvedLocation = resolveDiningLocationForMenu(locationName);
  if (resolvedLocation) {
    candidates.add(resolvedLocation);
  }

  restaurants.forEach((restaurant) => {
    const resolvedRestaurant = resolveDiningLocationForMenu(restaurant);
    if (resolvedRestaurant) {
      candidates.add(resolvedRestaurant);
    }
  });

  return Array.from(candidates);
}
