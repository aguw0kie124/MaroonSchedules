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
  "Physical Education Activity Room (PEAP)": "PEAP",
  "Physical Education Activity Program": "PEAP",
  "Physical Education Activities Program Building": "PEAP",
  "Penberthy Rec Sports Complex": "Penberthy Rec Sports Complex-Tennis",
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

export function getLiveHoursForFacility(locationName: string): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const canonicalName = getCanonicalLocationName(locationName);

  if (canonicalName === "PEAP") {
    // Wed Apr 15 is day 3
    if (day === 3 || day === 4 || day === 0 || day === 1 || day === 2) return "6:00 PM – 11:00 PM";
    if (day === 5 || day === 6) return "Closed";
  }

  if (canonicalName === "Aquatics") {
    if (day === 3) return "1:30 PM – 11:00 PM (Lap Pool)";
    if (day === 4) return "6:00 AM – 7:30 PM (Lap Pool)";
    if (day === 5) return "6:00 AM – 10:00 PM (Lap Pool)";
    if (day === 6) return "10:00 AM – 10:00 PM (Lap Pool)";
    if (day === 0) return "12:00 PM – 11:00 PM (Lap Pool)";
    if (day === 1) return "6:00 AM – 11:00 PM (Lap Pool)";
    if (day === 2) return "6:00 AM – 7:30 PM (Lap Pool)";
  }

  if (canonicalName === "Penberthy Rec Sports Complex-Tennis") {
    if (day === 3 || day === 1 || day === 2) return "5:00 PM – 10:00 PM";
    if (day === 4) return "5:00 PM – 10:00 PM";
    if (day === 5) return "5:00 PM – 8:00 PM";
    if (day === 6) return "12:00 PM – 8:00 PM";
    if (day === 0) return "5:00 PM – 10:00 PM";
  }

  return "";
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
  "Aquatics": {
    hours: "Pool schedule varies Â· check aquatics site",
    description: "Rec Sports aquatics programming centered around the pools at the Student Recreation Center, including lap swimming, diving, and instructional water spaces.",
    features: ["50-Meter Pool", "Lap Pool", "Outdoor Pool", "Dive Well"],
    type: "Rec"
  },
  "PEAP": {
    hours: "Evening hours Â· check PEAP schedule",
    description: "The Physical Education Activity Room offers wellness classes, court space, and activity areas in partnership with Texas A&M Kinesiology & Sport Management.",
    features: ["Indoor Courts", "Wellness Classes", "Gymnastics Space", "Activity Studios"],
    type: "Rec"
  },
  "Penberthy Rec Sports Complex-Tennis": {
    hours: "Rec fields and courts schedule varies",
    description: "Penberthy Rec Sports Complex includes tennis and pickleball courts plus outdoor fields for intramurals, club sports, and open recreation.",
    features: ["Tennis Courts", "Pickleball Courts", "Multipurpose Fields", "Softball Fields"],
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

const INJECTED_RESTAURANTS = [
  // MSC Food Court
  { placeId: "msc-abu-omar", location: "Abu Omar Halal - MSC", type: "Dining", coord: { lat: 30.6123, lng: -96.3414 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-cabo", location: "Cabo Grill - MSC", type: "Dining", coord: { lat: 30.6122, lng: -96.3413 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-cfa", location: "Chick-Fil-A - MSC Food Court", type: "Dining", coord: { lat: 30.6124, lng: -96.3415 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-houston", location: "Houston Street Subs - MSC", type: "Dining", coord: { lat: 30.6121, lng: -96.3412 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-panda", location: "Panda Express - MSC", type: "Dining", coord: { lat: 30.6125, lng: -96.3416 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-revs", location: "Rev's American Grill - MSC", type: "Dining", coord: { lat: 30.6122, lng: -96.3411 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-shake-smart", location: "Shake Smart - MSC", type: "Dining", coord: { lat: 30.6124, lng: -96.3417 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-spin", location: "Spin 'N Stone Pizza - MSC", type: "Dining", coord: { lat: 30.6123, lng: -96.3418 }, source: "snapshot", searchOnly: true },
  { placeId: "msc-starbucks", location: "Starbucks Coffee - MSC", type: "Dining", coord: { lat: 30.6126, lng: -96.3413 }, source: "snapshot", searchOnly: true },
  
  // Sbisa Underground
  { placeId: "und-1876", location: "1876 Burgers - Sbisa Complex", type: "Dining", coord: { lat: 30.6171, lng: -96.3429 }, source: "snapshot", searchOnly: true },
  { placeId: "und-cfa", location: "Chick-Fil-A - Sbisa Underground Food Court", type: "Dining", coord: { lat: 30.6172, lng: -96.3430 }, source: "snapshot", searchOnly: true },
  { placeId: "und-copperhead", location: "Copperhead Jack's - Sbisa Complex", type: "Dining", coord: { lat: 30.6170, lng: -96.3428 }, source: "snapshot", searchOnly: true },
  { placeId: "und-einstein", location: "Einstein Bros. Bagels - Sbisa Complex", type: "Dining", coord: { lat: 30.6173, lng: -96.3431 }, source: "snapshot", searchOnly: true },
  { placeId: "und-houston", location: "Houston Street Subs - Underground Food Court", type: "Dining", coord: { lat: 30.6169, lng: -96.3427 }, source: "snapshot", searchOnly: true },
  { placeId: "und-bagel", location: "Bagel Block", type: "Dining", coord: { lat: 30.6171, lng: -96.3426 }, source: "snapshot", searchOnly: true },
  { placeId: "und-pizza", location: "Pizza @ Underground", type: "Dining", coord: { lat: 30.6174, lng: -96.3432 }, source: "snapshot", searchOnly: true },
  { placeId: "und-smoothie", location: "Smoothie King - Sbisa Underground Food Court", type: "Dining", coord: { lat: 30.6172, lng: -96.3433 }, source: "snapshot", searchOnly: true },

  // West Campus Food Hall
  { placeId: "wc-cfa", location: "Chick-fil-A - West Campus Food Hall", type: "Dining", coord: { lat: 30.6133, lng: -96.3534 }, source: "snapshot", searchOnly: true },
  { placeId: "wc-copperhead", location: "Copperhead Jack's - West Campus Food Hall", type: "Dining", coord: { lat: 30.6134, lng: -96.3535 }, source: "snapshot", searchOnly: true },
  { placeId: "wc-houston", location: "Houston Street Subs - West Campus Food Hall", type: "Dining", coord: { lat: 30.6132, lng: -96.3533 }, source: "snapshot", searchOnly: true },

  // Markets & Aggie Express — coordinates from campus registry DB + geocoded addresses
  { placeId: "mkt-aggie-commons", location: "Aggie Express - Commons", type: "Dining", coord: { lat: 30.6158, lng: -96.3363 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-aggie-hullabaloo", location: "Aggie Express - Hullabaloo", type: "Dining", coord: { lat: 30.6165, lng: -96.3463 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-aggie-pavilion", location: "Aggie Express - Pavilion", type: "Dining", coord: { lat: 30.6135, lng: -96.3355 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-creekside", location: "Creekside Market", type: "Dining", coord: { lat: 30.6076, lng: -96.3539 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-polo", location: "Market @ Polo Garage", type: "Dining", coord: { lat: 30.6235, lng: -96.3380 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-lamar", location: "Market @ Lamar St.", type: "Dining", coord: { lat: 30.6120, lng: -96.3442 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-white-creek", location: "White Creek Market", type: "Dining", coord: { lat: 30.6076, lng: -96.3562 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-ag-cafe", location: "Market - Ag Cafe", type: "Dining", coord: { lat: 30.6055, lng: -96.3510 }, source: "snapshot", searchOnly: true },
  { placeId: "mkt-blcc", location: "Market Express - Business Library (BLCC)", type: "Dining", coord: { lat: 30.6115, lng: -96.3502 }, source: "snapshot", searchOnly: true },
].map((location) => ({
  percent_full: 0,
  is_live: false,
  available_seats: null,
  ...location,
})) as CampusLocation[];

const INJECTED_REC_PLACES: CampusLocation[] = [
  {
    placeId: "aquatics",
    location: "Aquatics",
    shortName: "AQUATICS",
    percent_full: 0,
    type: "Rec",
    is_live: false,
    available_seats: null,
    searchOnly: false,
    coord: { lat: 30.60755, lng: -96.34215 },
    hours: STATIC_LOCATION_META["Aquatics"].hours,
    description: STATIC_LOCATION_META["Aquatics"].description,
    features: STATIC_LOCATION_META["Aquatics"].features,
    source: "snapshot",
  },
  {
    placeId: "peap",
    location: "PEAP",
    shortName: "PEAP",
    percent_full: 0,
    type: "Rec",
    is_live: false,
    available_seats: null,
    searchOnly: false,
    coord: { lat: 30.60442587454078, lng: -96.35188398861327 },
    hours: STATIC_LOCATION_META["PEAP"].hours,
    description: STATIC_LOCATION_META["PEAP"].description,
    features: STATIC_LOCATION_META["PEAP"].features,
    source: "snapshot",
  },
  {
    placeId: "penberthy",
    location: "Penberthy Rec Sports Complex-Tennis",
    shortName: "PENBERTHY",
    percent_full: 0,
    type: "Rec",
    is_live: false,
    available_seats: null,
    searchOnly: false,
    coord: { lat: 30.6012303882534, lng: -96.34964369057107 },
    hours: STATIC_LOCATION_META["Penberthy Rec Sports Complex-Tennis"].hours,
    description: STATIC_LOCATION_META["Penberthy Rec Sports Complex-Tennis"].description,
    features: STATIC_LOCATION_META["Penberthy Rec Sports Complex-Tennis"].features,
    source: "snapshot",
  },
];

const INJECTED_LIBRARY_PLACES: CampusLocation[] = [
  {
    placeId: "evans",
    location: "Sterling C. Evans Library",
    shortName: "EVANS LIBRARY",
    percent_full: 0,
    type: "Library",
    is_live: false,
    available_seats: null,
    searchOnly: false,
    coord: { lat: 30.6125, lng: -96.3414 },
    hours: STATIC_LOCATION_META["Sterling C. Evans Library"].hours,
    description: STATIC_LOCATION_META["Sterling C. Evans Library"].description,
    source: "snapshot",
  },
  {
    placeId: "annex",
    location: "Evans Library Annex",
    shortName: "ANNEX",
    percent_full: 0,
    type: "Library",
    is_live: false,
    available_seats: null,
    searchOnly: false,
    coord: { lat: 30.6128, lng: -96.3418 },
    hours: STATIC_LOCATION_META["Evans Library Annex"].hours,
    description: STATIC_LOCATION_META["Evans Library Annex"].description,
    source: "snapshot",
  },
  {
    placeId: "wcl",
    location: "West Campus Library",
    shortName: "WCL",
    percent_full: 0,
    type: "Library",
    is_live: false,
    available_seats: null,
    searchOnly: false,
    coord: { lat: 30.6116, lng: -96.3503 },
    hours: STATIC_LOCATION_META["West Campus Library"].hours,
    description: STATIC_LOCATION_META["West Campus Library"].description,
    source: "snapshot",
  },
];

export function buildCampusDirectory(): CampusLocation[] {
  const directory = CAMPUS_REGISTRY_PLACES.map(toRegistryCampusLocation);
  
  // Inject missing restaurants so they show up in food court lists
  const existingPlaceIds = new Set(directory.map(p => p.placeId));
  const missing = [...INJECTED_RESTAURANTS, ...INJECTED_REC_PLACES, ...INJECTED_LIBRARY_PLACES].filter(
    (p) => !existingPlaceIds.has(p.placeId),
  );
  
  return [...directory, ...missing];
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
    aliasParentPlaceIds: ["msc", "osm:node:368159934"],
    aliasParentNames: ["Memorial Student Center", "Memorial Student Center (MSC)", "MSC"],
    childPlaceIds: [
      "cfa", "panda-msc", "revs-msc-food", "houston-msc", "abu-omar-msc", "starbucks-msc",
      "msc-abu-omar", "msc-cabo", "msc-cfa", "msc-houston", "msc-panda", "msc-revs", 
      "msc-shake-smart", "msc-spin", "msc-starbucks"
    ],
    childNamePatterns: [/\(msc\)\s*$/i, /\s-\s*msc\s*$/i, /^msc\s+/i],
  },
  {
    id: "polo-food-court",
    canonicalParentPlaceId: "polo-garage-food",
    canonicalParentName: "Polo Road Garage Dining",
    aliasParentPlaceIds: ["polo-garage-food", "garage-polo", "polo-road-dining"],
    aliasParentNames: ["Polo Road Garage Dining", "Polo Road Garage", "Polo Dining"],
    childPlaceIds: ["panda-polo", "salata-polo", "shake-polo", "panda-polo-garage", "shake-polo-garage", "houston-polo-garage"],
    childNamePatterns: [/\(polo\)\s*$/i, /\s-\s*polo(?:\s+garage)?\s*$/i],
  },
  {
    id: "underground-food-court",
    canonicalParentPlaceId: "underground-food",
    canonicalParentName: "Underground Food Court",
    aliasParentPlaceIds: ["underground-food"],
    aliasParentNames: ["Underground Food Court"],
    childPlaceIds: [
      "und-1876", "und-cfa", "und-copperhead", "und-einstein", "und-houston", "und-bagel", "und-pizza", "und-smoothie",
      "chick-fil-a-sbisa", "houston-sbisa", "1876-burgers", "copperhead-sbisa"
    ],
    childNamePatterns: [/\s-\s*sbisa(?:\s+complex)?\s*$/i, /underground/i],
  },
  {
    id: "west-campus-food-hall",
    canonicalParentPlaceId: "west-campus-dining",
    canonicalParentName: "West Campus Dining Facility",
    aliasParentPlaceIds: ["west-campus-dining", "wcd"],
    aliasParentNames: ["West Campus Dining Facility", "West Campus Dining Hall"],
    childPlaceIds: ["wc-cfa", "wc-copperhead", "wc-houston"],
    childNamePatterns: [/\s-\s*west\s+campus\s+food\s+hall\s*$/i],
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
          // Never let a searchOnly:true duplicate hide an already-visible location
          searchOnly: existing.searchOnly === false ? false : (location.searchOnly ?? existing.searchOnly),
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
