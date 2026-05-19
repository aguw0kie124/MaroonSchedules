import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, requestJson } from '../api/client';
import {
  formatLocalMonthDay,
  getLocalDateString,
  parseLocalDateString,
  shiftLocalDateString,
} from './dateUtils';

const CACHE_PREFIX = 'dining-menu-cache-v5';
const LAST_PRUNE_KEY = `${CACHE_PREFIX}:last-pruned`;
const MAX_PAST_CACHE_DAYS = 14;
const MAX_FUTURE_CACHE_DAYS = 120;
const SEARCH_LOOKAHEAD_DAYS = 45;
const BACKGROUND_FETCH_INTERVAL_MS = 2200;
const BACKGROUND_FETCH_BACKOFF_MS = 60000;
const SEARCH_LIVE_FETCH_BUDGET = 4;

const DINING_LOCATION_ALIASES: Record<string, string> = {
  sbisa: 'Sbisa Dining Hall (North Campus)',
  'sbisa dining hall': 'Sbisa Dining Hall (North Campus)',
  duncan: 'Duncan Dining Hall (South Campus/Quad)',
  'duncan dining hall': 'Duncan Dining Hall (South Campus/Quad)',
  'duncan hall': 'Duncan Dining Hall (South Campus/Quad)',
  'duncan lounge': 'Duncan Dining Hall (South Campus/Quad)',
  commons: 'The Commons Dining Hall (South Campus)',
  'the commons': 'The Commons Dining Hall (South Campus)',
  'the commons dining hall': 'The Commons Dining Hall (South Campus)',
  'commons hall': 'The Commons Dining Hall (South Campus)',
  'chick-fil-a (msc)': 'Chick-fil-A',
  'chick-fil-a - msc': 'Chick-fil-A',
  'panda express (msc)': 'Panda Express',
  "rev's american grill (msc)": "Rev's American Grill",
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

export type DiningMenuSearchResult = {
  id: string;
  location: string;
  resolvedLocation: string;
  dateKey: string;
  mealPeriod: DiningMealPeriod;
  categoryName: string;
  item: any;
  mealWindowLabel: string | null;
};

type MealWindow = {
  mealPeriod: DiningMealPeriod;
  startMinutes: number;
  endMinutes: number;
};

type PrefetchRequest = {
  location: string;
  mealPeriod: string;
  dateKey: string;
};

const inFlightMenuRequests = new Map<string, Promise<any>>();
const backgroundWarmKeys = new Set<string>();
const backgroundQueuedRequestKeys = new Set<string>();
const backgroundPrefetchQueue: PrefetchRequest[] = [];
const MEAL_PERIOD_ORDER: Record<DiningMealPeriod, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
};
let isProcessingBackgroundQueue = false;
let backgroundQueueBlockedUntil = 0;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toMinutes(hour: number, minute = 0) {
  return hour * 60 + minute;
}

function getMinutesFromDate(date: Date) {
  return toMinutes(date.getHours(), date.getMinutes());
}

export function getDiningContextDate(dateKey?: string) {
  if (!dateKey || dateKey === getLocalDateString()) {
    return new Date();
  }
  return parseLocalDateString(dateKey);
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isFriday(date: Date) {
  return date.getDay() === 5;
}

function diffCalendarDays(left: string, right: string) {
  const leftDate = parseLocalDateString(left);
  const rightDate = parseLocalDateString(right);
  leftDate.setHours(0, 0, 0, 0);
  rightDate.setHours(0, 0, 0, 0);
  return Math.round((rightDate.getTime() - leftDate.getTime()) / 86400000);
}

function chunkRequests<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
  const normalized = (locationName || '').toLowerCase();
  if (normalized.includes('sbisa') || normalized.includes('commons') || normalized.includes('duncan')) {
    return true;
  }
  const resolved = resolveDiningLocationForMenu(locationName || '')?.toLowerCase() || '';
  return resolved.includes('dining hall');
}

export function getCurrentMealPeriod(date = new Date()): DiningMealPeriod {
  const hour = date.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 16) return 'lunch';
  return 'dinner';
}

export function getDiningMealOptionsForLocation(locationName?: string | null, date = new Date()): DiningMealPeriod[] {
  if (isDiningHallMenuLocation(locationName)) {
    return ALL_DINING_MEAL_PERIODS;
  }
  const resolved = resolveDiningLocationForMenu(locationName || '');
  if (isDiningHallMenuLocation(resolved)) {
    return ALL_DINING_MEAL_PERIODS;
  }
  const ordered = buildMealWindows(resolved || locationName, date).map((window) => window.mealPeriod);
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

  return windows[windows.length - 1]?.mealPeriod || 'lunch';
}

export function getDiningMealWindow(
  locationName?: string | null,
  mealPeriod?: string | null,
  date: Date = new Date(),
) {
  const normalizedMeal = (mealPeriod || '').toLowerCase();
  return (
    buildMealWindows(locationName, date).find((window) => window.mealPeriod === normalizedMeal) ||
    null
  );
}

export function getDiningMealWindowLabel(
  locationName?: string | null,
  mealPeriod?: string | null,
  date: Date = new Date(),
) {
  const window = getDiningMealWindow(locationName, mealPeriod, date);
  if (!window) return null;

  const start = new Date(date);
  start.setHours(Math.floor(window.startMinutes / 60), window.startMinutes % 60, 0, 0);
  const end = new Date(date);
  end.setHours(Math.floor(window.endMinutes / 60), window.endMinutes % 60, 0, 0);

  return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
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
  if (normalized.includes('rev')) return "Rev's American Grill";
  if (normalized.includes('bagel')) return 'Einstein Bros. Bagels';
  if (normalized.includes('1876')) return '1876 Burgers';
  if (normalized.includes('copperhead')) return "Copperhead Jack's";
  if (normalized.includes('abu omar')) return 'Abu Omar Halal';
  if (normalized.includes('cabo')) return 'Cabo Grill';

  if (normalized.includes('sbisa')) return 'Sbisa Dining Hall';
  if (normalized.includes('commons')) return 'Commons Dining Hall';
  if (normalized.includes('duncan')) return 'Duncan Dining Hall';

  return locationName;
}

export function shiftDiningMenuDate(dateKey: string, offsetDays: number) {
  return shiftLocalDateString(dateKey, offsetDays);
}

export function formatDiningMenuDateLabel(dateKey: string) {
  return `${formatLocalMonthDay(dateKey)} Menu`;
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

function buildDateRange(startDateKey: string, dayCount: number) {
  return Array.from({ length: Math.max(dayCount, 0) }, (_, index) =>
    shiftLocalDateString(startDateKey, index),
  );
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

function getMenuStaleTimeMs(dateKey: string) {
  const todayKey = getLocalDateString();
  const diffFromToday = diffCalendarDays(todayKey, dateKey);
  if (diffFromToday === 0) return 1000 * 60 * 60;
  if (diffFromToday > 0) return 1000 * 60 * 60 * 12;
  return 1000 * 60 * 60 * 24 * 7;
}

async function hasFreshMenuCache(location: string, mealPeriod: string, dateKey: string) {
  const cacheKey = getCacheKey(location, mealPeriod, dateKey);
  const cached = await AsyncStorage.getItem(cacheKey);
  if (!cached) return false;

  try {
    const parsed = JSON.parse(cached) as CachedMenuPayload;
    const fetchedAt = new Date(parsed.fetchedAt).getTime();
    const isStale = Date.now() - fetchedAt > getMenuStaleTimeMs(dateKey);
    return !isStale;
  } catch (_error) {
    return false;
  }
}

async function pruneStaleMenus() {
  const todayKey = getLocalDateString();
  const lastPruned = await AsyncStorage.getItem(LAST_PRUNE_KEY);
  if (lastPruned === todayKey) {
    return;
  }

  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(
    (key) => key.startsWith(`${CACHE_PREFIX}:`) && key !== LAST_PRUNE_KEY,
  );

  if (cacheKeys.length === 0) {
    await AsyncStorage.setItem(LAST_PRUNE_KEY, todayKey);
    return;
  }

  const records = await AsyncStorage.multiGet(cacheKeys);
  const staleKeys = records
    .map(([key, rawValue]) => {
      if (!rawValue) return key;
      try {
        const parsed = JSON.parse(rawValue) as CachedMenuPayload;
        const diffFromToday = diffCalendarDays(todayKey, parsed.dateKey);
        if (diffFromToday < -MAX_PAST_CACHE_DAYS || diffFromToday > MAX_FUTURE_CACHE_DAYS) {
          return key;
        }
        return null;
      } catch (_error) {
        return key;
      }
    })
    .filter((key): key is string => !!key);

  if (staleKeys.length > 0) {
    await AsyncStorage.multiRemove(staleKeys);
  }

  await AsyncStorage.setItem(LAST_PRUNE_KEY, todayKey);
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function buildSearchResultId(
  resolvedLocation: string,
  dateKey: string,
  mealPeriod: string,
  categoryName: string,
  itemName: string,
) {
  return [
    resolvedLocation,
    dateKey,
    mealPeriod,
    categoryName,
    itemName,
  ]
    .join('::')
    .toLowerCase();
}

function collectMatchesFromMenu(
  menu: any,
  resolvedLocation: string,
  query: string,
) {
  const normalizedQuery = normalizeSearchText(query);
  const categories = Array.isArray(menu?.categories) ? menu.categories : [];
  const dateKey = menu?.date || getLocalDateString();
  const mealPeriod = (menu?.resolvedPeriod || menu?.period || menu?.mealPeriod || 'lunch').toLowerCase() as DiningMealPeriod;
  const mealWindowLabel = getDiningMealWindowLabel(
    resolvedLocation,
    mealPeriod,
    parseLocalDateString(dateKey),
  );

  return categories.flatMap((category: any) => {
    const categoryName = category?.name || 'Station';
    const items = Array.isArray(category?.items) ? category.items : [];

    return items
      .filter((item: any) => {
        const blob = [
          item?.name,
          categoryName,
          resolvedLocation,
          mealPeriod,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(normalizedQuery);
      })
      .map((item: any) => ({
        id: buildSearchResultId(resolvedLocation, dateKey, mealPeriod, categoryName, item?.name || 'item'),
        location: menu?.location || resolvedLocation,
        resolvedLocation,
        dateKey,
        mealPeriod,
        categoryName,
        item,
        mealWindowLabel,
      }));
  });
}

export async function fetchDiningFullMenuCached({
  location,
  mealPeriod = getCurrentMealPeriod(),
  date = getLocalDateString(),
  forceRefresh = false,
}: {
  location: string;
  mealPeriod?: string;
  date?: string;
  forceRefresh?: boolean;
}) {
  const resolvedLocation = resolveDiningLocationForMenu(location);
  if (!resolvedLocation) {
    return null;
  }

  const dateKey = date;
  const normalizedMealPeriod = (mealPeriod || 'lunch').toLowerCase();
  const cacheKey = getCacheKey(resolvedLocation, normalizedMealPeriod, dateKey);

  await pruneStaleMenus();

  const runRequest = async () => {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed: CachedMenuPayload = JSON.parse(cached);
      const fetchedAt = new Date(parsed.fetchedAt).getTime();
      const isStale = Date.now() - fetchedAt > getMenuStaleTimeMs(dateKey);

      if (!forceRefresh && !isStale) {
        const cachedItemCount = getMenuItemCount(parsed?.data);
        const staleDiningHallPayload =
          isDiningHallMenuLocation(resolvedLocation) &&
          (cachedItemCount === 0 ||
            (cachedItemCount <= 2 &&
              diffCalendarDays(getLocalDateString(), dateKey) === 0));

        if (parsed?.data && !staleDiningHallPayload) {
          return {
            ...parsed.data,
            fromCache: true,
            resolvedLocation,
            date: parsed.data?.date || dateKey,
          };
        }
      }
    }

    const params = new URLSearchParams({
      location: resolvedLocation,
      meal_period: normalizedMealPeriod,
      date: dateKey,
    });
    if (forceRefresh) {
      params.set('force_refresh', 'true');
    }
    const data = await requestJson(`/dining/full-menu?${params.toString()}`);

    const itemCount = getMenuItemCount(data);
    const shouldPersist =
      typeof data?.success === 'boolean' &&
      (!isDiningHallMenuLocation(resolvedLocation) || itemCount > 0);

    if (shouldPersist) {
      const payload: CachedMenuPayload = {
        dateKey,
        fetchedAt: new Date().toISOString(),
        location,
        resolvedLocation,
        mealPeriod: normalizedMealPeriod,
        data,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
    }

    return {
      ...data,
      fromCache: false,
      resolvedLocation,
      date: data?.date || dateKey,
    };
  };

  if (!forceRefresh && inFlightMenuRequests.has(cacheKey)) {
    return inFlightMenuRequests.get(cacheKey);
  }

  const request = runRequest().finally(() => {
    inFlightMenuRequests.delete(cacheKey);
  });
  inFlightMenuRequests.set(cacheKey, request);
  return request;
}

export async function prefetchDiningMenus(
  locations: string[],
  mealPeriods: string[] = ALL_DINING_MEAL_PERIODS,
  options?: {
    dateKeys?: string[];
    concurrency?: number;
  },
) {
  const dateKeys = options?.dateKeys?.length ? options.dateKeys : [getLocalDateString()];
  const concurrency = Math.max(1, options?.concurrency || 4);
  const uniqueRequests = new Map<string, PrefetchRequest>();

  locations.forEach((location) => {
    const resolvedLocation = resolveDiningLocationForMenu(location);
    if (!resolvedLocation) return;

    mealPeriods.forEach((mealPeriod) => {
      dateKeys.forEach((dateKey) => {
        const requestKey = `${resolvedLocation}:${mealPeriod}:${dateKey}`;
        uniqueRequests.set(requestKey, {
          location: resolvedLocation,
          mealPeriod,
          dateKey,
        });
      });
    });
  });

  const batches = chunkRequests(Array.from(uniqueRequests.values()), concurrency);
  for (const batch of batches) {
    await Promise.all(
      batch.map(({ location, mealPeriod, dateKey }) =>
        fetchDiningFullMenuCached({ location, mealPeriod, date: dateKey }).catch(() => null),
      ),
    );
  }
}

async function processBackgroundPrefetchQueue() {
  if (isProcessingBackgroundQueue) return;
  isProcessingBackgroundQueue = true;

  try {
    while (backgroundPrefetchQueue.length > 0) {
      const now = Date.now();
      if (backgroundQueueBlockedUntil > now) {
        await wait(backgroundQueueBlockedUntil - now);
      }

      const nextRequest = backgroundPrefetchQueue.shift();
      if (!nextRequest) continue;

      const requestKey = `${nextRequest.location}:${nextRequest.mealPeriod}:${nextRequest.dateKey}`;
      backgroundQueuedRequestKeys.delete(requestKey);

      const alreadyFresh = await hasFreshMenuCache(
        nextRequest.location,
        nextRequest.mealPeriod,
        nextRequest.dateKey,
      );
      if (alreadyFresh) {
        continue;
      }

      try {
        await fetchDiningFullMenuCached({
          location: nextRequest.location,
          mealPeriod: nextRequest.mealPeriod,
          date: nextRequest.dateKey,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          backgroundQueueBlockedUntil = Date.now() + BACKGROUND_FETCH_BACKOFF_MS;
          backgroundPrefetchQueue.unshift(nextRequest);
          backgroundQueuedRequestKeys.add(requestKey);
          await wait(BACKGROUND_FETCH_BACKOFF_MS);
        }
      }

      await wait(BACKGROUND_FETCH_INTERVAL_MS);
    }
  } finally {
    isProcessingBackgroundQueue = false;
  }
}

function enqueueBackgroundPrefetchRequests(requests: PrefetchRequest[]) {
  requests.forEach((request) => {
    const requestKey = `${request.location}:${request.mealPeriod}:${request.dateKey}`;
    if (backgroundQueuedRequestKeys.has(requestKey)) return;
    backgroundQueuedRequestKeys.add(requestKey);
    backgroundPrefetchQueue.push(request);
  });

  processBackgroundPrefetchQueue().catch(() => null);
}

export function warmDiningMenusInBackground({
  location,
  centerDate = getLocalDateString(),
  pastDays = 2,
  futureDays = 10,
  mealPeriods,
}: {
  location: string;
  centerDate?: string;
  pastDays?: number;
  futureDays?: number;
  mealPeriods?: string[];
}) {
  const resolvedLocation = resolveDiningLocationForMenu(location);
  if (!resolvedLocation) return;

  const effectiveMealPeriods =
    mealPeriods && mealPeriods.length > 0
      ? mealPeriods
      : [getDiningMealPeriodForLocation(resolvedLocation, getDiningContextDate(centerDate))];
  const dateKeys = Array.from({ length: pastDays + futureDays + 1 }, (_, index) =>
    shiftLocalDateString(centerDate, index - pastDays),
  );
  const warmKey = `${resolvedLocation}:${dateKeys[0]}:${dateKeys[dateKeys.length - 1]}:${effectiveMealPeriods.join(',')}`;
  if (backgroundWarmKeys.has(warmKey)) return;

  backgroundWarmKeys.add(warmKey);
  setTimeout(() => {
    const requests = dateKeys.flatMap((dateKey) =>
      effectiveMealPeriods.map((mealPeriod) => ({
        location: resolvedLocation,
        mealPeriod,
        dateKey,
      })),
    );
    enqueueBackgroundPrefetchRequests(requests);
    backgroundWarmKeys.delete(warmKey);
  }, 50);
}

export async function searchDiningMenusForLocation({
  location,
  query,
  startDate = getLocalDateString(),
  dayCount = SEARCH_LOOKAHEAD_DAYS,
  mealPeriods = ALL_DINING_MEAL_PERIODS,
  limit = 24,
}: {
  location: string;
  query: string;
  startDate?: string;
  dayCount?: number;
  mealPeriods?: DiningMealPeriod[];
  limit?: number;
}): Promise<DiningMenuSearchResult[]> {
  const resolvedLocation = resolveDiningLocationForMenu(location);
  const normalizedQuery = normalizeSearchText(query);
  if (!resolvedLocation || !normalizedQuery) {
    return [];
  }

  const dateKeys = buildDateRange(startDate, dayCount);
  const requests: PrefetchRequest[] = dateKeys.flatMap((dateKey) =>
    mealPeriods.map((mealPeriod) => ({
      location: resolvedLocation,
      mealPeriod,
      dateKey,
    })),
  );

  const cachedKeys = requests.map(({ location: requestLocation, mealPeriod, dateKey }) =>
    getCacheKey(requestLocation, mealPeriod, dateKey),
  );
  const cachedRecords = await AsyncStorage.multiGet(cachedKeys);
  const cachedLookup = new Map(cachedRecords);

  const results = new Map<string, DiningMenuSearchResult>();
  const missingRequests: PrefetchRequest[] = [];

  requests.forEach((request) => {
    const cacheKey = getCacheKey(request.location, request.mealPeriod, request.dateKey);
    const rawValue = cachedLookup.get(cacheKey);
    if (!rawValue) {
      missingRequests.push(request);
      return;
    }

    try {
      const parsed = JSON.parse(rawValue) as CachedMenuPayload;
      collectMatchesFromMenu(parsed.data, parsed.resolvedLocation, normalizedQuery).forEach((result) => {
        results.set(result.id, result);
      });
    } catch (_error) {
      missingRequests.push(request);
    }
  });

  if (results.size < limit && missingRequests.length > 0) {
    const immediateRequests = missingRequests.slice(0, SEARCH_LIVE_FETCH_BUDGET);
    const deferredRequests = missingRequests.slice(SEARCH_LIVE_FETCH_BUDGET);
    if (deferredRequests.length > 0) {
      enqueueBackgroundPrefetchRequests(deferredRequests);
    }

    const batches = chunkRequests(immediateRequests, 2);
    for (const batch of batches) {
      const fetchedMenus = await Promise.all(
        batch.map(({ location: requestLocation, mealPeriod, dateKey }) =>
          fetchDiningFullMenuCached({
            location: requestLocation,
            mealPeriod,
            date: dateKey,
          }).catch(() => null),
        ),
      );

      fetchedMenus.forEach((menu) => {
        if (!menu?.success) return;
        collectMatchesFromMenu(menu, menu?.resolvedLocation || resolvedLocation, normalizedQuery).forEach((result) => {
          results.set(result.id, result);
        });
      });

      if (results.size >= limit) {
        break;
      }
    }
  }

  return Array.from(results.values())
    .sort((left, right) => {
      const leftExact = normalizeSearchText(left.item?.name || '') === normalizedQuery ? 1 : 0;
      const rightExact = normalizeSearchText(right.item?.name || '') === normalizedQuery ? 1 : 0;
      if (leftExact !== rightExact) return rightExact - leftExact;
      if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
      if (left.mealPeriod !== right.mealPeriod) {
        return MEAL_PERIOD_ORDER[left.mealPeriod] - MEAL_PERIOD_ORDER[right.mealPeriod];
      }
      return (left.item?.name || '').localeCompare(right.item?.name || '');
    })
    .slice(0, limit);
}
