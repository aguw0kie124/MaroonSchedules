import type { CampusLocation } from "./types";

type SearchableLocation = Pick<
  CampusLocation,
  "location" | "shortName" | "aliases" | "description" | "address" | "coord" | "searchImportance"
>;

interface SearchReferenceCoordinate {
  latitude: number;
  longitude: number;
}

interface SearchRankingOptions {
  referenceCoord?: SearchReferenceCoordinate | null;
}

interface RankedLocation<T> {
  location: T;
  score: number;
  textScore: number;
  distanceMeters: number | null;
}

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
  if (queryToken.length <= 1 || candidateToken.length <= 1) {
    return candidateToken === queryToken ? 0 : null;
  }
  if (candidateToken === queryToken) return 0;
  if (candidateToken.startsWith(queryToken)) return 1;
  if (
    candidateToken.length >= 3 &&
    queryToken.length >= 3 &&
    (candidateToken.includes(queryToken) || queryToken.includes(candidateToken))
  ) {
    return 2;
  }

  const maxDistance = queryToken.length <= 4 ? 1 : 2;
  const distance = boundedLevenshtein(queryToken, candidateToken, maxDistance);
  if (distance <= maxDistance) return 2 + distance;
  return null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function computeDistanceMeters(
  origin: SearchReferenceCoordinate,
  destination: { lat: number; lng: number },
) {
  const earthRadiusMeters = 6371008.8;
  const dLat = toRadians(destination.lat - origin.latitude);
  const dLng = toRadians(destination.lng - origin.longitude);
  const originLat = toRadians(origin.latitude);
  const destinationLat = toRadians(destination.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistancePenalty(distanceMeters: number | null) {
  if (distanceMeters == null) return 0;
  return Math.log1p(Math.max(distanceMeters, 0) / 1000) * 35;
}

function getImportanceBonus(location: SearchableLocation) {
  const importance = Number(location.searchImportance ?? 0);
  if (!Number.isFinite(importance) || importance <= 0) return 0;
  return Math.min(30, importance * 30);
}

export function scoreLocationSearch(location: SearchableLocation, query: string): number | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const rawFields = [
    location.location,
    location.shortName,
    ...(location.aliases || []),
    location.address,
    location.description,
  ]
    .filter(Boolean)
    .map((value) => String(value));

  const normalizedFields = rawFields.map((value) => normalizeSearchText(value));
  const exactFieldIndex = normalizedFields.findIndex((field) => field === normalizedQuery);
  if (exactFieldIndex >= 0) {
    return exactFieldIndex * 5 - 8;
  }

  const wordPrefixFieldIndex = normalizedFields.findIndex(
    (field) => field.startsWith(`${normalizedQuery} `),
  );
  if (wordPrefixFieldIndex >= 0) {
    return wordPrefixFieldIndex * 5 - 5;
  }

  const prefixFieldIndex = normalizedFields.findIndex((field) =>
    field.startsWith(normalizedQuery),
  );
  if (prefixFieldIndex >= 0) {
    return prefixFieldIndex * 5 - 3;
  }

  const includesFieldIndex = normalizedFields.findIndex((field) =>
    field.includes(normalizedQuery),
  );
  if (includesFieldIndex >= 0) {
    return includesFieldIndex * 5;
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

export function rankCampusLocations<T extends SearchableLocation>(
  locations: T[],
  query: string,
  options: SearchRankingOptions = {},
): RankedLocation<T>[] {
  return locations
    .map((location) => {
      const textScore = scoreLocationSearch(location, query);
      if (textScore == null) return null;

      const distanceMeters =
        options.referenceCoord && location.coord
          ? computeDistanceMeters(options.referenceCoord, location.coord)
          : null;
      const score =
        textScore * 10 +
        getDistancePenalty(distanceMeters) -
        getImportanceBonus(location);

      return {
        location,
        score,
        textScore,
        distanceMeters,
      };
    })
    .filter((entry): entry is RankedLocation<T> => entry != null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.textScore !== b.textScore) return a.textScore - b.textScore;
      if (
        a.distanceMeters != null &&
        b.distanceMeters != null &&
        a.distanceMeters !== b.distanceMeters
      ) {
        return a.distanceMeters - b.distanceMeters;
      }
      if ((a.location.address || "") !== (b.location.address || "")) {
        return (a.location.address || "").localeCompare(b.location.address || "");
      }
      return a.location.location.localeCompare(b.location.location);
    });
}

export function searchCampusLocations<T extends SearchableLocation>(
  locations: T[],
  query: string,
  maxResults = 8,
  options: SearchRankingOptions = {},
): T[] {
  return rankCampusLocations(locations, query, options)
    .slice(0, maxResults)
    .map((entry) => entry.location);
}
