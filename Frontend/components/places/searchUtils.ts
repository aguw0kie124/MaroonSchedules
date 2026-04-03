import type { CampusLocation } from "./types";

type SearchableLocation = Pick<
  CampusLocation,
  "location" | "shortName" | "aliases" | "description"
>;

function normalizeSearchText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
      current.push(value);
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }

  return previous[b.length];
}

function scoreTokenMatch(queryToken: string, candidateToken: string): number | null {
  if (!queryToken || !candidateToken) return null;
  if (candidateToken === queryToken) return 0;
  if (candidateToken.startsWith(queryToken)) return 1;
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return 2;

  const maxDistance = queryToken.length <= 4 ? 1 : 2;
  const distance = boundedLevenshtein(queryToken, candidateToken, maxDistance);
  if (distance <= maxDistance) return 2 + distance;
  return null;
}

export function scoreLocationSearch(location: SearchableLocation, query: string): number | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const rawFields = [
    location.location,
    location.shortName,
    ...(location.aliases || []),
    location.description,
  ]
    .filter(Boolean)
    .map((value) => String(value));

  const normalizedFields = rawFields.map((value) => normalizeSearchText(value));
  const exactFieldIndex = normalizedFields.findIndex((field) => field.includes(normalizedQuery));
  if (exactFieldIndex >= 0) {
    const field = normalizedFields[exactFieldIndex];
    const startsWithBonus = field.startsWith(normalizedQuery) ? -2 : 0;
    return exactFieldIndex * 5 + startsWithBonus;
  }

  const candidateTokens = Array.from(
    new Set(normalizedFields.flatMap((field) => field.split(" ").filter(Boolean))),
  );
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (!queryTokens.length || !candidateTokens.length) return null;

  let totalScore = 0;
  for (const queryToken of queryTokens) {
    let bestScore: number | null = null;
    for (const candidateToken of candidateTokens) {
      const score = scoreTokenMatch(queryToken, candidateToken);
      if (score == null) continue;
      if (bestScore == null || score < bestScore) {
        bestScore = score;
      }
      if (bestScore === 0) break;
    }
    if (bestScore == null) return null;
    totalScore += bestScore;
  }

  return 100 + totalScore + Math.max(0, candidateTokens.length - queryTokens.length);
}

export function searchCampusLocations<T extends SearchableLocation>(
  locations: T[],
  query: string,
  maxResults = 8,
): T[] {
  const scored = locations
    .map((location) => ({ location, score: scoreLocationSearch(location, query) }))
    .filter((entry): entry is { location: T; score: number } => entry.score != null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.location.location.localeCompare(b.location.location);
    });

  return scored.slice(0, maxResults).map((entry) => entry.location);
}
