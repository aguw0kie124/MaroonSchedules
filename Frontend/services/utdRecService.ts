export type UTDRecCenterStatus = {
  occupancy: string;
  status: 'Open' | 'Closed';
  lastUpdated: string;
};

const FALLBACK_STATUS: Omit<UTDRecCenterStatus, 'lastUpdated'> = {
  occupancy: 'Unknown',
  status: 'Open',
};

const JSON_CANDIDATE_ENDPOINTS = [
  'https://utdallas.dserec.com/online/facility-status-data',
  'https://utdallas.dserec.com/online/facility-status',
  'https://utdallas.dserec.com/online/dashboard-data',
];

const HOURS_PAGE_ENDPOINT = 'https://urec.utdallas.edu/';

function withTimestamp(status: Omit<UTDRecCenterStatus, 'lastUpdated'>): UTDRecCenterStatus {
  return {
    ...status,
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonCandidate(url: string): Promise<unknown | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();
    if (!text) return null;
    const trimmed = text.trim();
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
    return JSON.parse(trimmed);
  } catch (_error) {
    return null;
  }
}

function normalizeString(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (['open', 'opened', 'true', 'yes', 'available'].includes(normalized)) return true;
  if (['closed', 'false', 'no', 'unavailable'].includes(normalized)) return false;
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^\d.\-]/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesRecCenterName(value: unknown): boolean {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  return (
    normalized.includes('rec center') ||
    normalized.includes('recreation center') ||
    normalized.includes('rec center west') ||
    normalized.includes('activity center')
  );
}

function buildOccupancyLabel(record: Record<string, unknown>): string | null {
  const direct = record.occupancy;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const percentageKeys = ['percent_full', 'percent', 'occupancy_percent', 'utilization'];
  for (const key of percentageKeys) {
    const n = parseNumber(record[key]);
    if (n != null) return `${Math.round(n * 10) / 10}%`;
  }

  const currentCount = parseNumber(record.current_count ?? record.count ?? record.current);
  const capacity = parseNumber(record.capacity ?? record.max_capacity ?? record.maximum);
  if (currentCount != null && capacity != null && capacity > 0) {
    return `${Math.round(currentCount)}/${Math.round(capacity)}`;
  }
  if (currentCount != null) {
    return `${Math.round(currentCount)}`;
  }

  return null;
}

function buildOpenClosedStatus(record: Record<string, unknown>): 'Open' | 'Closed' | null {
  const fromIsOpen = parseBoolean(record.is_open ?? record.open);
  if (fromIsOpen != null) return fromIsOpen ? 'Open' : 'Closed';

  const fromStatus = parseBoolean(record.status ?? record.state);
  if (fromStatus != null) return fromStatus ? 'Open' : 'Closed';

  const statusText = normalizeString(record.status ?? record.state);
  if (statusText.includes('close')) return 'Closed';
  if (statusText.includes('open')) return 'Open';
  return null;
}

function scanForRecStatus(value: unknown): UTDRecCenterStatus | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = scanForRecStatus(entry);
      if (parsed) return parsed;
    }
    return null;
  }

  if (typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  const nameCandidates = [
    record.name,
    record.location,
    record.title,
    record.facility,
    record.facility_name,
    record.space_name,
  ];
  const isLikelyRecCenter = nameCandidates.some((candidate) => matchesRecCenterName(candidate));

  if (isLikelyRecCenter) {
    const occupancy = buildOccupancyLabel(record) ?? 'Unknown';
    const status = buildOpenClosedStatus(record) ?? FALLBACK_STATUS.status;
    const lastUpdatedRaw =
      record.last_updated ??
      record.updated_at ??
      record.updatedAt ??
      record.timestamp ??
      record.as_of ??
      null;

    return {
      occupancy,
      status,
      lastUpdated: typeof lastUpdatedRaw === 'string' && lastUpdatedRaw.trim()
        ? lastUpdatedRaw
        : new Date().toISOString(),
    };
  }

  for (const nested of Object.values(record)) {
    const parsed = scanForRecStatus(nested);
    if (parsed) return parsed;
  }
  return null;
}

async function deriveStatusFromHoursPage(): Promise<'Open' | 'Closed' | null> {
  try {
    const response = await fetchWithTimeout(HOURS_PAGE_ENDPOINT, 12000);
    if (!response.ok) return null;
    const html = (await response.text()).toLowerCase();
    if (!html) return null;

    const recWestSectionMatch = html.match(/rec center\s*<br[^>]*>\s*west[\s\S]{0,400}/i);
    const recSection = recWestSectionMatch?.[0] || html.match(/rec center west[\s\S]{0,400}/i)?.[0];
    if (!recSection) return null;

    if (/\bclosed\b/i.test(recSection)) return 'Closed';
    return 'Open';
  } catch (_error) {
    return null;
  }
}

export async function fetchUTDRecCenterStatus(): Promise<UTDRecCenterStatus> {
  try {
    for (const endpoint of JSON_CANDIDATE_ENDPOINTS) {
      const payload = await fetchJsonCandidate(endpoint);
      if (!payload) continue;
      const parsed = scanForRecStatus(payload);
      if (parsed) return parsed;
    }

    const derivedStatus = await deriveStatusFromHoursPage();
    return withTimestamp({
      occupancy: FALLBACK_STATUS.occupancy,
      status: derivedStatus ?? FALLBACK_STATUS.status,
    });
  } catch (error) {
    console.warn('Failed to load UTD rec center status', error);
    return withTimestamp(FALLBACK_STATUS);
  }
}

