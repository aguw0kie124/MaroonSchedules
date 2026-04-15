import type { DiningMealPeriod } from './diningMenuCache';
import { getLocalDateString } from './dateUtils';

const UTD_DINING_URL = 'https://dineoncampus.com/utdallas';
const DINE_API_BASE = 'https://apiv4.dineoncampus.com';
const LOCATION_ID_REGEX = /^[a-f0-9]{24}$/i;
const VALID_PERIODS: DiningMealPeriod[] = ['breakfast', 'lunch', 'dinner'];

const API_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://dineoncampus.com',
  Referer: `${UTD_DINING_URL}/`,
};

export interface DiningLocation {
  id: string;
  name: string;
}

export interface MenuItem {
  id: string;
  name: string;
  location: string;
  category: string;
  mealPeriod: DiningMealPeriod;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
}

export interface UTDDiningData {
  locations: DiningLocation[];
  menuItems: MenuItem[];
  mealPeriod: DiningMealPeriod;
  resolvedLocation?: string;
}

function normalizeText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function parseNumeric(value: unknown) {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/[^\d.\-]/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function canonicalPeriod(value?: string | null): DiningMealPeriod {
  const normalized = normalizeText(value).replace(/[^a-z]/g, '');
  if (normalized.includes('break')) return 'breakfast';
  if (normalized.includes('din')) return 'dinner';
  return 'lunch';
}

async function fetchTextWithTimeout(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: API_HEADERS,
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonScripts(html: string) {
  const scripts: string[] = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = scriptRegex.exec(html)) != null) {
    const body = (match[1] || '').trim();
    if (!body) continue;
    if (body.startsWith('{') || body.startsWith('[')) {
      scripts.push(body);
    }
    if (body.includes('__NEXT_DATA__')) {
      const nextDataMatch = body.match(/__NEXT_DATA__\s*=\s*({[\s\S]*});?/);
      if (nextDataMatch?.[1]) scripts.push(nextDataMatch[1]);
    }
    if (body.includes('__PRELOADED_STATE__')) {
      const preloadedMatch = body.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*});?/);
      if (preloadedMatch?.[1]) scripts.push(preloadedMatch[1]);
    }
  }

  const nextDataTag = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextDataTag?.[1]) scripts.push(nextDataTag[1].trim());
  return scripts;
}

function collectLocationCandidates(value: unknown, output: DiningLocation[]) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectLocationCandidates(entry, output));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const rawId =
    record.locationId ||
    record.location_id ||
    record._id ||
    record.id ||
    record.value;
  const rawName =
    record.locationName ||
    record.location_name ||
    record.displayName ||
    record.name ||
    record.title ||
    record.label;

  const id = String(rawId || '').trim();
  const name = String(rawName || '').trim();
  if (LOCATION_ID_REGEX.test(id) && name.length > 0) {
    output.push({ id, name });
  }

  Object.values(record).forEach((nested) => collectLocationCandidates(nested, output));
}

function dedupeLocations(locations: DiningLocation[]) {
  const byId = new Map<string, DiningLocation>();
  locations.forEach((location) => {
    if (!LOCATION_ID_REGEX.test(location.id)) return;
    if (!location.name.trim()) return;
    if (!byId.has(location.id)) {
      byId.set(location.id, {
        id: location.id,
        name: location.name.trim(),
      });
    }
  });
  return Array.from(byId.values());
}

function chooseRequestedLocation(
  locations: DiningLocation[],
  requestedName?: string | null,
) {
  if (!locations.length) return null;
  const requested = normalizeText(requestedName);
  if (!requested) return locations[0];

  const exact = locations.find((location) => normalizeText(location.name) === requested);
  if (exact) return exact;

  const partial = locations.find(
    (location) =>
      normalizeText(location.name).includes(requested) ||
      requested.includes(normalizeText(location.name)),
  );
  if (partial) return partial;
  return locations[0];
}

type LocationPeriodsResponse = {
  periods?: Array<{
    id?: string;
    name?: string;
    slug?: string;
  }>;
};

function choosePeriod(
  periods: NonNullable<LocationPeriodsResponse['periods']>,
  requestedPeriod?: string | null,
) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const requested = canonicalPeriod(requestedPeriod);

  const exact = periods.find((period) => canonicalPeriod(period.slug || period.name) === requested);
  if (exact) return { ...exact, canonical: requested };

  const fallback = periods.find((period) => {
    const slug = normalizeText(period.slug || period.name);
    return slug === 'everyday' || slug === 'every-day' || slug === 'all-day';
  });
  if (fallback) return { ...fallback, canonical: requested };

  return { ...periods[0], canonical: canonicalPeriod(periods[0]?.slug || periods[0]?.name) };
}

type MenuNutrient = {
  name?: string;
  valueNumeric?: number | string;
  value?: number | string;
};

type MenuItemApi = {
  id?: string;
  _id?: string;
  name?: string;
  nutrients?: MenuNutrient[];
  calories?: number | string;
};

type MenuCategoryApi = {
  name?: string;
  items?: MenuItemApi[];
};

type LocationMenuResponse = {
  period?: {
    categories?: MenuCategoryApi[];
  };
};

function extractNutrient(
  nutrients: MenuNutrient[],
  key: string,
) {
  const candidate = nutrients.find(
    (nutrient) =>
      normalizeText(nutrient.name) === normalizeText(key) ||
      normalizeText(nutrient.name).includes(normalizeText(key)),
  );
  return parseNumeric(candidate?.valueNumeric ?? candidate?.value);
}

function parseMenuItemsFromResponse(
  response: LocationMenuResponse,
  locationName: string,
  mealPeriod: DiningMealPeriod,
) {
  const categories = Array.isArray(response?.period?.categories)
    ? response.period.categories
    : [];
  const parsed: MenuItem[] = [];

  categories.forEach((category) => {
    const categoryName = String(category?.name || 'Featured').trim();
    const items = Array.isArray(category?.items) ? category.items : [];
    items.forEach((item, index) => {
      const nutrients = Array.isArray(item?.nutrients) ? item.nutrients : [];
      const name = String(item?.name || '').trim();
      if (!name) return;

      const calories =
        extractNutrient(nutrients, 'calories') || parseNumeric(item?.calories);
      const protein = extractNutrient(nutrients, 'protein');
      const carbs =
        extractNutrient(nutrients, 'total carbohydrates') ||
        extractNutrient(nutrients, 'carbohydrates');
      const fat =
        extractNutrient(nutrients, 'total fat') || extractNutrient(nutrients, 'fat');
      const fiber = extractNutrient(nutrients, 'fiber');
      const sodium = extractNutrient(nutrients, 'sodium');

      parsed.push({
        id: String(item?.id || item?._id || `${locationName}-${categoryName}-${index}`),
        name,
        location: locationName,
        category: categoryName,
        mealPeriod,
        calories,
        protein,
        carbs,
        fat,
        fiber,
        sodium,
      });
    });
  });

  return parsed;
}

async function discoverDiningLocations(dateKey: string) {
  const html = await fetchTextWithTimeout(UTD_DINING_URL);
  const scriptBlobs = extractJsonScripts(html);
  const candidates: DiningLocation[] = [];

  scriptBlobs.forEach((blob) => {
    try {
      const parsed = JSON.parse(blob);
      collectLocationCandidates(parsed, candidates);
    } catch (_error) {
      // Ignore non-JSON scripts.
    }
  });

  const locationCandidates = dedupeLocations(candidates).slice(0, 80);
  const verified: DiningLocation[] = [];

  for (const location of locationCandidates) {
    try {
      const periodsUrl = `${DINE_API_BASE}/locations/${encodeURIComponent(location.id)}/periods/?date=${encodeURIComponent(dateKey)}`;
      const periodPayload = await fetchJsonWithTimeout<LocationPeriodsResponse>(periodsUrl, 10000);
      const periods = Array.isArray(periodPayload?.periods) ? periodPayload.periods : [];
      if (periods.length > 0) {
        verified.push(location);
      }
    } catch (_error) {
      // Skip invalid location candidates.
    }
  }

  return verified;
}

export async function fetchUTDDiningData({
  locationName,
  mealPeriod = 'lunch',
  date = getLocalDateString(),
}: {
  locationName?: string | null;
  mealPeriod?: DiningMealPeriod;
  date?: string;
} = {}): Promise<UTDDiningData> {
  const discoveredLocations = await discoverDiningLocations(date);
  if (!discoveredLocations.length) {
    throw new Error('Could not discover UTD dining locations.');
  }

  const targetLocation = chooseRequestedLocation(discoveredLocations, locationName);
  if (!targetLocation) {
    throw new Error('No UTD dining location matched the current selection.');
  }

  const periodsUrl = `${DINE_API_BASE}/locations/${encodeURIComponent(targetLocation.id)}/periods/?date=${encodeURIComponent(date)}`;
  const periodsPayload = await fetchJsonWithTimeout<LocationPeriodsResponse>(periodsUrl, 10000);
  const chosenPeriod = choosePeriod(periodsPayload?.periods || [], mealPeriod);
  if (!chosenPeriod?.id) {
    throw new Error(`No menu periods were found for ${targetLocation.name}.`);
  }

  const selectedMealPeriod = canonicalPeriod(chosenPeriod.canonical || chosenPeriod.slug || chosenPeriod.name);
  const menuUrl =
    `${DINE_API_BASE}/locations/${encodeURIComponent(targetLocation.id)}/menu` +
    `?date=${encodeURIComponent(date)}&period=${encodeURIComponent(chosenPeriod.id)}`;
  const menuPayload = await fetchJsonWithTimeout<LocationMenuResponse>(menuUrl, 12000);
  const menuItems = parseMenuItemsFromResponse(
    menuPayload,
    targetLocation.name,
    selectedMealPeriod,
  );

  return {
    locations: discoveredLocations,
    menuItems,
    mealPeriod: selectedMealPeriod,
    resolvedLocation: targetLocation.name,
  };
}

export async function fetchUTDFullMenu({
  location,
  mealPeriod = 'lunch',
  date = getLocalDateString(),
}: {
  location?: string | null;
  mealPeriod?: DiningMealPeriod;
  date?: string;
}) {
  const data = await fetchUTDDiningData({
    locationName: location,
    mealPeriod,
    date,
  });

  const byCategory = new Map<string, MenuItem[]>();
  data.menuItems.forEach((item) => {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, []);
    }
    byCategory.get(item.category)!.push(item);
  });

  const categories = Array.from(byCategory.entries())
    .map(([name, items]) => ({
      name,
      items: items.map((item) => ({
        name: item.name,
        location: item.location,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        sodium: item.sodium,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    success: categories.length > 0,
    location: location || data.resolvedLocation || 'UT Dallas Dining',
    resolvedLocation: data.resolvedLocation || location || 'UT Dallas Dining',
    locations: data.locations.map((entry) => entry.name),
    mealPeriod: data.mealPeriod,
    source: 'utd-dineoncampus',
    count: data.menuItems.length,
    categories,
    message: categories.length > 0 ? undefined : 'No menu items were returned for this selection.',
  };
}

export function getUTDMealOptions() {
  return VALID_PERIODS;
}
