import React from "react";
import {
  MapPin,
  Info,
  Utensils,
  Star,
  TrafficCone,
  Library,
  Dumbbell,
  Calendar,
  Layers,
  Bus,
  GraduationCap,
  Flame,
} from "lucide-react-native";
import {
  BUILDINGS,
  AMENITIES,
  CAMPUS_REGISTRY_PLACES,
  type CampusRegistryPlaceRecord,
} from "../../data/campus";
import type { CampusLocation, LocationType } from "./types";

// ── Canonical naming ──────────────────────────────────────────
export const CANONICAL_LOCATION_ALIASES: Record<string, string> = {
  "Student Rec Center": "Student Recreation Center",
  "Main Rec Center": "Student Recreation Center",
  "Rec Center": "Student Recreation Center",
  "The Rec": "Student Recreation Center",
  "Rec": "Student Recreation Center",
  "Southside Rec Center": "Southside Recreation Center",
  "Polo Road Rec Center": "Polo Road Recreation Center",
  "Evans Library": "Sterling C. Evans Library",
  "Sterling C. Evans Library Annex": "Evans Library Annex",
  "Commons Dining Hall": "The Commons Dining Hall",
  "The Commons": "The Commons Dining Hall",
  "Commons": "The Commons Dining Hall",
  "Memorial Student Center (MSC)": "Memorial Student Center",
};

const BUILDING_COORDS = new Map(
  BUILDINGS.map((building) => [
    building.name,
    { lat: building.latitude, lng: building.longitude },
  ]),
);

const AMENITY_COORDS = new Map(
  AMENITIES.map((amenity) => [
    amenity.name,
    { lat: amenity.latitude, lng: amenity.longitude },
  ]),
);

export function normalizeBuildingKey(value?: string | null) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const BUILDING_LOOKUP = new Map(
  BUILDINGS.flatMap((building) => [
    [normalizeBuildingKey(building.name), building],
    [normalizeBuildingKey(building.shortName), building],
    [normalizeBuildingKey(building.id), building],
  ]),
);

export function getCanonicalLocationName(name: string): string {
  return CANONICAL_LOCATION_ALIASES[name] || name;
}

export function getCanonicalCoords(
  name: string
): { lat: number; lng: number } {
  const canonicalName = getCanonicalLocationName(name);
  const coords = BUILDING_COORDS.get(canonicalName) || AMENITY_COORDS.get(canonicalName);
  
  if (!coords) {
    console.warn(`[campusData] No coordinates found for "${name}" (canonical: "${canonicalName}") in Master Registry.`);
    return { lat: 30.6153, lng: -96.3410 }; // Default to campus center if absolutely missing
  }
  return coords;
}

// ── Campus density zones ──────────────────────────────────────
export const CAMPUS_ZONES: Array<{
  name: string;
  lat: number;
  lng: number;
  peak: number;
  off: number;
  radius: number;
  type: "Rec" | "Library" | "Dining";
  hours?: string;
}> = [
  {
    name: "Student Recreation Center",
    ...getCanonicalCoords("Student Recreation Center"),
    peak: 70,
    off: 10,
    radius: 220,
    type: "Rec",
    hours: "6:00 AM – 11:59 PM",
  },
  {
    name: "Southside Recreation Center",
    ...getCanonicalCoords("Southside Recreation Center"),
    peak: 65,
    off: 10,
    radius: 200,
    type: "Rec",
  },
  {
    name: "Polo Road Recreation Center",
    ...getCanonicalCoords("Polo Road Recreation Center"),
    peak: 55,
    off: 8,
    radius: 200,
    type: "Rec",
  },
  {
    name: "Sterling C. Evans Library",
    ...getCanonicalCoords("Sterling C. Evans Library"),
    peak: 82,
    off: 18,
    radius: 160,
    type: "Library",
  },
  {
    name: "Evans Library Annex",
    ...getCanonicalCoords("Evans Library Annex"),
    peak: 70,
    off: 15,
    radius: 120,
    type: "Library",
  },
  {
    name: "West Campus Library",
    ...getCanonicalCoords("West Campus Library"),
    peak: 60,
    off: 14,
    radius: 160,
    type: "Library",
  },
  {
    name: "Memorial Student Center",
    ...getCanonicalCoords("Memorial Student Center"),
    peak: 85,
    off: 15,
    radius: 180,
    type: "Dining",
  },
  {
    name: "Polo Road Garage Dining",
    ...getCanonicalCoords("Polo Road Garage Dining"),
    peak: 80,
    off: 10,
    radius: 180,
    type: "Dining",
  },
  {
    name: "Sbisa Dining Hall",
    ...getCanonicalCoords("Sbisa Dining Hall"),
    peak: 70,
    off: 5,
    radius: 150,
    type: "Dining",
  },
  {
    name: "The Commons Dining Hall",
    ...getCanonicalCoords("The Commons Dining Hall"),
    peak: 75,
    off: 12,
    radius: 170,
    type: "Dining",
  },
];

export function getTimeOfDayFactor(): number {
  const hour = new Date().getHours();
  if (hour >= 8 && hour < 9) return 0.55;
  if (hour >= 9 && hour < 11) return 0.95;
  if (hour >= 11 && hour < 14) return 1.0;
  if (hour >= 14 && hour < 17) return 0.85;
  if (hour >= 17 && hour < 19) return 0.6;
  if (hour >= 19 && hour < 22) return 0.45;
  return 0.12;
}

export function getZoneDensity(zone: (typeof CAMPUS_ZONES)[0]): number {
  const factor = getTimeOfDayFactor();
  return Math.round(zone.off + (zone.peak - zone.off) * factor);
}

// ── Static metadata ───────────────────────────────────────────
export const STATIC_LOCATION_META: Record<string, Partial<CampusLocation>> = {
  "Sterling C. Evans Library": {
    hours: "Open daily · check library schedule",
    description: "Main research library near the Academic Plaza.",
  },
  "Evans Library Annex": {
    hours: "Open daily · check library schedule",
    description: "Annex study and overflow library space.",
  },
  "West Campus Library": {
    hours: "Open daily · check library schedule",
    description: "Business and west campus study hub.",
  },
  "Student Recreation Center": {
    hours: "6:00 AM – 11:45 PM",
    description: "The Student Recreation Center, known as 'The Rec,' is the flagship facility of Rec Sports at Texas A&M University and one of the top recreational sports centers in the nation. It features 540,000 square feet of recreation space, including a 32,000-square-foot strength and conditioning room, an indoor walking and jogging track, five pools, and a 44-foot-tall indoor climbing wall.",
    features: ["Court Space", "Heavy Bag Room", "Indoor Climbing Facilities", "Indoor Walking & Running Track"],
    type: "Rec"
  },
  "Southside Recreation Center": {
    hours: "5:30 AM – 11:59 PM",
    description: "Opened in 2022, the Southside Recreation Center is located across from the Commons and features 63,500 square feet of indoor and outdoor recreation space, including two sand volleyball courts.",
    features: ["Strength & Conditioning", "Cardio Equipment", "Locker Rooms", "Sand Volleyball Courts"],
    type: "Rec"
  },
  "Polo Road Recreation Center": {
    hours: "6:00 AM – 10:00 PM",
    description: "Located on North Campus, the Polo Road Recreation Center offers 28,000 square feet of fitness space, specializing in cardio and strength training for the north campus community.",
    features: ["Strength & Conditioning", "Cardio Equipment", "Indoor Walking Track", "Adjacent to Polo Rd Garage"],
    type: "Rec"
  },
  "Sbisa Dining Hall": {
    hours: "Breakfast, lunch, and dinner service",
    description: "Northside all-you-care-to-eat dining hall.",
  },
  "The Commons Dining Hall": {
    hours: "Breakfast, lunch, and dinner service",
    description: "Southside dining hall near the Commons.",
  },
  "Memorial Student Center": {
    hours: "Open daily",
    description: "Central student hub, dining, lounges, and events.",
  },
  "Polo Road Garage Dining": {
    hours: "Check dining schedule",
    description: "Dining hub inside the Polo Road Garage complex.",
  },
  "Northside Garage (NSG)": {
    hours: "Open 24/7 for permit holders; search-only for visitors.",
    description: "Multi-level parking facility on the north side of campus near the Northpoint area.",
    type: "Parking"
  },
  "Southside Garage (SSG)": {
    hours: "Open 24/7 for permit holders; search-only for visitors.",
    description: "Multi-level parking facility on the south side of campus near the Commons and Southside Rec.",
    type: "Parking"
  },
  "Rudder Tower": {
    hours: "Open daily",
    description: "Event and campus activity landmark adjacent to the MSC.",
  },
};

// ── Type mapping helpers ──────────────────────────────────────
export function normalizeLocationType(type?: string | null): LocationType {
  const normalized = (type || "").trim().toLowerCase();

  if (normalized === "hub") return "Hub";
  if (["dining", "coffee", "cafe", "restaurant", "food"].includes(normalized))
    return "Dining";
  if (normalized === "library") return "Library";
  if (["recreation", "rec", "gym", "fitness"].includes(normalized)) return "Rec";
  if (["academic", "building"].includes(normalized)) return "Academic";
  if (["parking", "garage"].includes(normalized)) return "Parking";
  if (normalized === "landmark") return "Landmark";
  if (normalized === "housing") return "Housing";
  if (normalized === "athletics") return "Athletics";
  if (["study", "restroom", "general", ""].includes(normalized)) return "General";

  if (
    [
      "Rec",
      "Library",
      "Study",
      "Dining",
      "Hub",
      "General",
      "Academic",
      "Parking",
      "Landmark",
      "Housing",
      "Athletics",
    ].includes(type || "")
  ) {
    return type as LocationType;
  }

  return "General";
}

export function mapBuildingType(type: string): LocationType {
  const norm = type.toLowerCase();
  switch (norm) {
    case "library":
      return "Library";
    case "recreation":
    case "rec":
      return "Rec";
    case "dining":
    case "hub":
      return "Dining";
    case "academic":
      return "Academic";
    case "athletics":
      return "Athletics";
    case "housing":
      return "Housing";
    case "landmark":
      return "Landmark";
    default:
      return normalizeLocationType(type);
  }
}

export function mapAmenityType(type: string): LocationType {
  switch (type.toLowerCase()) {
    case "coffee":
    case "dining":
      return "Dining";
    case "study":
      return "General";
    case "restroom":
      return "General";
    case "parking":
      return "Parking";
    default:
      return normalizeLocationType(type);
  }
}

// ── Building schedule resolution ──────────────────────────────
export function resolveScheduleBuilding(
  buildingValue?: string | null,
  locationValue?: string | null,
) {
  const directMatch = BUILDING_LOOKUP.get(normalizeBuildingKey(buildingValue));
  if (directMatch) return directMatch;

  const locationToken = (locationValue || "").trim().split(/\s+/)[0];
  const tokenMatch = BUILDING_LOOKUP.get(normalizeBuildingKey(locationToken));
  if (tokenMatch) return tokenMatch;

  const locationMatch = BUILDING_LOOKUP.get(normalizeBuildingKey(locationValue));
  if (locationMatch) return locationMatch;

  return null;
}

// ── Building categorization ──────────────────────────────────
export function getBuildingCategory(buildingName?: string | null): string {
  const norm = normalizeBuildingKey(buildingName);
  
  // Engineering & Tech
  if (["AERO", "RDMC", "ETB", "CHEN", "CVLB", "ZACH", "WERC", "PETR", "HRBB"].includes(norm)) return "engineering";
  
  // Science & Math
  if (["HELD", "BSBE", "CHEM", "PHYS", "CYCL", "MITC", "BLOC"].includes(norm)) return "science";
  
  // Business & Admin
  if (["WCBA", "GSC", "JBW", "ADMN"].includes(norm)) return "business";
  
  // Social & Humanities
  if (["LAAH", "PSYC", "BUSH", "ALLN", "MSY"].includes(norm)) return "social";

  // Check lookup type
  const building = BUILDING_LOOKUP.get(norm);
  const bType = building?.type?.toLowerCase() || "";
  if (bType === "recreation" || bType === "rec") return "rec";
  if (bType === "library") return "library";
  if (bType === "dining" || bType === "hub") return "dining";
  
  return "academic";
}

// ── Build the full campus directory ───────────────────────────
function parseFeatureList(features?: CampusRegistryPlaceRecord["features"]): string[] | undefined {
  if (Array.isArray(features)) {
    return features.filter((feature): feature is string => typeof feature === "string" && feature.trim().length > 0);
  }

  if (typeof features !== "string" || !features.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed)
      ? parsed.filter((feature): feature is string => typeof feature === "string" && feature.trim().length > 0)
      : undefined;
  } catch {
    return undefined;
  }
}

function toRegistryCampusLocation(place: CampusRegistryPlaceRecord): CampusLocation {
  const staticMeta = STATIC_LOCATION_META[place.name] || {};

  return {
    placeId: place.place_id,
    location: place.name,
    shortName: place.short_name || place.name,
    percent_full: 0,
    type: normalizeLocationType(staticMeta.type || place.type),
    is_live: false,
    available_seats: null,
    coord: { lat: place.lat, lng: place.lng },
    aliases: Array.isArray(place.aliases) ? place.aliases : [],
    hours: staticMeta.hours || place.hours || undefined,
    address: place.address || undefined,
    description: staticMeta.description || place.description || undefined,
    features: staticMeta.features || parseFeatureList(place.features),
    source: (place.source as CampusLocation["source"]) || "snapshot",
    searchOnly: place.search_only === true,
  };
}

export function buildCampusDirectory(): CampusLocation[] {
  return CAMPUS_REGISTRY_PLACES.map(toRegistryCampusLocation);
}

type FoodCourtGroupConfig = {
  id: string;
  canonicalParentPlaceId: string;
  canonicalParentName: string;
  aliasParentPlaceIds: string[];
  aliasParentNames: string[];
  childPlaceIds: string[];
  childNamePatterns: RegExp[];
};

const FOOD_COURT_GROUPS: FoodCourtGroupConfig[] = [
  {
    id: "msc-food-court",
    canonicalParentPlaceId: "msc",
    canonicalParentName: "Memorial Student Center",
    aliasParentPlaceIds: ["msc"],
    aliasParentNames: ["Memorial Student Center", "Memorial Student Center (MSC)"],
    childPlaceIds: [
      "cfa",
      "panda-msc",
      "revs-msc-food",
      "houston-msc",
      "abu-omar-msc",
      "starbucks-msc",
    ],
    childNamePatterns: [/\(msc\)\s*$/i, /\s-\s*msc\s*$/i],
  },
  {
    id: "polo-food-court",
    canonicalParentPlaceId: "polo-garage-food",
    canonicalParentName: "Polo Road Garage Dining",
    aliasParentPlaceIds: ["polo-garage-food", "garage-polo"],
    aliasParentNames: ["Polo Road Garage Dining", "Polo Road Garage"],
    childPlaceIds: ["panda-polo", "salata-polo", "shake-polo"],
    childNamePatterns: [/\(polo\)\s*$/i, /\s-\s*polo(?:\s+garage)?\s*$/i],
  },
];

function matchesFoodCourtParent(
  group: FoodCourtGroupConfig,
  location?: Pick<CampusLocation, "placeId" | "location"> | null,
) {
  if (!location) return false;
  const normalizedLocation = normalizeLocationKey(location.location);
  return (
    (!!location.placeId && group.aliasParentPlaceIds.includes(location.placeId)) ||
    group.aliasParentNames.some(
      (name) => normalizeLocationKey(name) === normalizedLocation,
    )
  );
}

function matchesFoodCourtChild(
  group: FoodCourtGroupConfig,
  location?: Pick<CampusLocation, "placeId" | "location" | "type" | "shortName"> | null,
) {
  if (!location || matchesFoodCourtParent(group, location)) return false;
  if (!!location.placeId && group.childPlaceIds.includes(location.placeId)) return true;
  if (location.type !== "Dining" && location.type !== "Hub") return false;

  const candidates = [location.location, location.shortName || ""];
  return candidates.some((candidate) =>
    group.childNamePatterns.some((pattern) => pattern.test(candidate)),
  );
}

function findFoodCourtGroup(
  location?: Pick<CampusLocation, "placeId" | "location" | "type" | "shortName"> | null,
) {
  if (!location) return null;
  return (
    FOOD_COURT_GROUPS.find(
      (group) =>
        matchesFoodCourtParent(group, location) || matchesFoodCourtChild(group, location),
    ) || null
  );
}

export function getFoodCourtVenueLabel(name: string) {
  return name
    .replace(/\s*\((MSC|Polo)\)\s*$/i, "")
    .replace(/\s*-\s*(MSC|Polo(?:\s+Garage)?)\s*$/i, "")
    .trim();
}

export function findFoodCourtParentLocation(
  location: Pick<CampusLocation, "placeId" | "location" | "type" | "shortName"> | null,
  allLocations: CampusLocation[],
) {
  const group = findFoodCourtGroup(location);
  if (!group) return null;

  return (
    allLocations.find((candidate) => candidate.placeId === group.canonicalParentPlaceId) ||
    allLocations.find(
      (candidate) =>
        normalizeLocationKey(candidate.location) ===
        normalizeLocationKey(group.canonicalParentName),
    ) ||
    allLocations.find((candidate) => matchesFoodCourtParent(group, candidate)) ||
    null
  );
}

export function getFoodCourtVenueLocations(
  location: Pick<CampusLocation, "placeId" | "location" | "type" | "shortName"> | null,
  allLocations: CampusLocation[],
) {
  const group = findFoodCourtGroup(location);
  if (!group) return [];

  const canonicalParent = findFoodCourtParentLocation(location, allLocations);
  const canonicalParentKey = canonicalParent
    ? getLocationSelectionId(canonicalParent)
    : null;

  return allLocations
    .filter((candidate) => matchesFoodCourtChild(group, candidate))
    .filter((candidate) => getLocationSelectionId(candidate) !== canonicalParentKey)
    .sort((first, second) =>
      getFoodCourtVenueLabel(first.location).localeCompare(
        getFoodCourtVenueLabel(second.location),
      ),
    );
}

export function shouldHideFoodCourtLocationInBrowse(
  location: Pick<CampusLocation, "placeId" | "location" | "type" | "shortName" | "coord">,
  allLocations: CampusLocation[],
) {
  const group = findFoodCourtGroup(location);
  if (!group) return false;
  if (matchesFoodCourtChild(group, location)) return true;

  const canonicalParent = findFoodCourtParentLocation(location, allLocations);
  return !!(
    canonicalParent &&
    matchesFoodCourtParent(group, location) &&
    getLocationSelectionId(canonicalParent) !== getLocationSelectionId(location)
  );
}

function normalizeLocationKey(value?: string | null) {
  return getCanonicalLocationName(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function areLocationCoordsClose(first: CampusLocation, second: CampusLocation, maxDelta = 0.0015) {
  return (
    Math.abs((first.coord?.lat || 0) - (second.coord?.lat || 0)) +
      Math.abs((first.coord?.lng || 0) - (second.coord?.lng || 0)) <=
    maxDelta
  );
}

function shouldPreserveExistingType(existing: CampusLocation, incoming: CampusLocation) {
  const strongTypes = new Set(["Dining", "Hub", "Rec", "Library", "Parking"]);
  const weakIncomingTypes = new Set(["Academic", "Landmark", "General"]);

  return strongTypes.has(existing.type) && weakIncomingTypes.has(incoming.type);
}

function shouldMergeByCanonicalName(existing: CampusLocation, incoming: CampusLocation) {
  if (normalizeLocationKey(existing.location) !== normalizeLocationKey(incoming.location)) {
    return false;
  }

  return (
    (existing.source === "directory" && incoming.source === "osm") ||
    (existing.source === "osm" && incoming.source === "directory")
  );
}

function shouldPreserveExistingCoordinate(existing: CampusLocation, incoming: CampusLocation) {
  if (existing.source !== "directory" || incoming.source !== "osm") return false;

  const protectedTypes = new Set<CampusLocation["type"]>([
    "Dining",
    "Hub",
    "Library",
    "Rec",
  ]);

  return protectedTypes.has(existing.type);
}

function mergeDefinedFields<T extends Record<string, any>>(base: T, incoming: Partial<T>) {
  const next = { ...base };
  Object.entries(incoming).forEach(([key, value]) => {
    if (value !== undefined) {
      (next as any)[key] = value;
    }
  });
  return next;
}

export function getLocationSelectionId(location: Pick<CampusLocation, "placeId" | "location" | "coord">) {
  if (location.placeId) return location.placeId;
  const lat = Number.isFinite(location.coord?.lat) ? location.coord.lat.toFixed(6) : "na";
  const lng = Number.isFinite(location.coord?.lng) ? location.coord.lng.toFixed(6) : "na";
  return `${normalizeLocationKey(location.location)}::${lat},${lng}`;
}

export function mergeCampusLocations(...groups: CampusLocation[][]): CampusLocation[] {
  const merged = new Map<string, CampusLocation>();
  const normalizedNameToKeys = new Map<string, string[]>();

  groups.flat().forEach((location) => {
    const explicitKey = getLocationSelectionId(location);
    const normalizedName = normalizeLocationKey(location.location);
    const explicitExisting = merged.get(explicitKey);
    const candidateKeys = normalizedNameToKeys.get(normalizedName) || [];
    const matchingNameKey =
      candidateKeys.find((key) => {
        const existing = merged.get(key);
        return existing
          ? areLocationCoordsClose(existing, location) ||
              shouldMergeByCanonicalName(existing, location)
          : false;
      }) || null;
    const existingKey = explicitExisting ? explicitKey : matchingNameKey || explicitKey;
    const existing = merged.get(existingKey);
    const nextAliases = Array.from(
      new Set([...(existing?.aliases || []), ...(location.aliases || [])].filter(Boolean)),
    );

    const next: CampusLocation = existing
      ? {
          ...mergeDefinedFields(existing, location),
          type: shouldPreserveExistingType(existing, location) ? existing.type : location.type,
          coord: shouldPreserveExistingCoordinate(existing, location)
            ? existing.coord
            : location.coord,
          aliases: nextAliases,
        }
      : {
          ...location,
          aliases: nextAliases,
        };

    merged.set(existingKey, next);
    if (normalizedName) {
      const nextKeys = normalizedNameToKeys.get(normalizedName) || [];
      if (!nextKeys.includes(existingKey)) nextKeys.push(existingKey);
      normalizedNameToKeys.set(normalizedName, nextKeys);
    }
  });

  return Array.from(merged.values());
}

export function buildExpandedPlacesDirectory(): CampusLocation[] {
  return buildCampusDirectory();
}

// ── Category definitions ──────────────────────────────────────
export const CATEGORIES = [
  { id: "Pulse", label: "Pulse", icon: <Flame size={18} /> },
  { id: "Today", label: "Today", icon: <Calendar size={18} /> },
  { id: "Bus", label: "Buses", icon: <Bus size={18} /> },
  { id: "Dining", label: "Dining", icon: <Utensils size={18} /> },
  { id: "Parking", label: "Parking", icon: <TrafficCone size={18} /> },
  { id: "Library", label: "Libraries", icon: <Library size={18} /> },
  { id: "Academic", label: "Academic", icon: <GraduationCap size={18} /> },
  { id: "Rec", label: "Gyms", icon: <Dumbbell size={18} /> },
  { id: "Heatmap", label: "Traffic", icon: <Layers size={18} /> },
];
