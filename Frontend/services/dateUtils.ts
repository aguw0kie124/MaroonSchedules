/**
 * Returns the current date in YYYY-MM-DD format based on the user's local timezone.
 * This avoids issues with UTC-based date strings (like toISOString()) 
 * which may represent "tomorrow" or "yesterday" depending on the user's offset.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date string into a human readable format
 * without any UTC timezone shifting.
 */
export function formatLocalDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatExactLocalTime(
  value: Date | string | number | null | undefined,
): string {
  if (value == null) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
    .replace(/\s/g, '')
    .toLowerCase();
}
