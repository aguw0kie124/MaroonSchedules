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
import { BUILDINGS, AMENITIES } from "../../data/campus";
import LOCAL_OSM_PLACES_PAYLOAD from "../../data/osm_places_tamu_10mi.json";
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
  "Commons Dining Hall": "The Commons Dining Hall",
  "Evans Library": "Sterling C. Evans Library",
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
  "Rudder Tower": {
    hours: "Open daily",
    description: "Event and campus activity landmark adjacent to the MSC.",
  },
};

// ── Type mapping helpers ──────────────────────────────────────
export function mapBuildingType(type: string): LocationType {
  switch (type) {
    case "library":
      return "Library";
    case "recreation":
      return "Rec";
    case "dining":
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
      return "General";
  }
}

export function mapAmenityType(type: string): LocationType {
  switch (type) {
    case "dining":
      return "Dining";
    case "study":
      return "General";
    case "parking":
      return "Parking";
    default:
      return "General";
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
  if (building?.type === "recreation") return "rec";
  if (building?.type === "library") return "library";
  if (building?.type === "dining") return "dining";
  
  return "academic";
}

// ── Build the full campus directory ───────────────────────────
export function buildCampusDirectory(): CampusLocation[] {
  const buildingLocations = BUILDINGS.map((building) => ({
    placeId: building.id,
    location: building.name,
    shortName: building.shortName,
    percent_full: 0,
    type: mapBuildingType(building.type),
    is_live: false,
    available_seats: null,
    coord: { lat: building.latitude, lng: building.longitude },
    source: "directory" as const,
    ...STATIC_LOCATION_META[building.name],
  }));

  const amenityLocations = AMENITIES.map((amenity) => ({
    placeId: amenity.id,
    location: amenity.name,
    shortName: amenity.name,
    percent_full: 0,
    type: mapAmenityType(amenity.type),
    is_live: false,
    available_seats: null,
    coord: { lat: amenity.latitude, lng: amenity.longitude },
    source: "directory" as const,
  }));

  const merged = new Map<string, CampusLocation>();
  [...buildingLocations, ...amenityLocations].forEach((location) => {
    merged.set(location.location, location);
  });
  return Array.from(merged.values());
}

type LocalOSMPlaceRecord = {
  place_id: string;
  name: string;
  short_name?: string | null;
  type: string;
  lat: number;
  lng: number;
  aliases?: string[];
  description?: string | null;
  address?: string | null;
  source?: string | null;
  search_only?: boolean;
};

function normalizeLocationKey(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function areLocationCoordsClose(first: CampusLocation, second: CampusLocation, maxDelta = 0.0015) {
  return (
    Math.abs((first.coord?.lat || 0) - (second.coord?.lat || 0)) +
      Math.abs((first.coord?.lng || 0) - (second.coord?.lng || 0)) <=
    maxDelta
  );
}

function shouldPreserveExistingType(existing: CampusLocation, incoming: CampusLocation) {
  if (incoming.source !== "osm") return false;

  const strongTypes = new Set(["Dining", "Hub", "Rec", "Library", "Parking"]);
  const weakIncomingTypes = new Set(["Academic", "Landmark", "General"]);

  return strongTypes.has(existing.type) && weakIncomingTypes.has(incoming.type);
}

export function getLocationSelectionId(location: Pick<CampusLocation, "placeId" | "location" | "coord">) {
  if (location.placeId) return location.placeId;
  const lat = Number.isFinite(location.coord?.lat) ? location.coord.lat.toFixed(6) : "na";
  const lng = Number.isFinite(location.coord?.lng) ? location.coord.lng.toFixed(6) : "na";
  return `${normalizeLocationKey(location.location)}::${lat},${lng}`;
}

function toLocalOSMLocations(): CampusLocation[] {
  const payload = LOCAL_OSM_PLACES_PAYLOAD as {
    places?: LocalOSMPlaceRecord[];
  };

  const places = Array.isArray(payload?.places) ? payload.places : [];
  return places.map((place) => ({
    placeId: place.place_id,
    location: place.name,
    shortName: place.short_name || place.name,
    percent_full: 0,
    type: (place.type as LocationType) || "General",
    is_live: false,
    available_seats: null,
    coord: { lat: place.lat, lng: place.lng },
    aliases: Array.isArray(place.aliases) ? place.aliases : [],
    description: place.description || undefined,
    address: place.address || undefined,
    source: (place.source as CampusLocation["source"]) || "osm",
    searchOnly: place.search_only !== false,
  }));
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
        return existing ? areLocationCoordsClose(existing, location) : false;
      }) || null;
    const existingKey = explicitExisting ? explicitKey : matchingNameKey || explicitKey;
    const existing = merged.get(existingKey);
    const nextAliases = Array.from(
      new Set([...(existing?.aliases || []), ...(location.aliases || [])].filter(Boolean)),
    );

    const next: CampusLocation = existing
      ? {
          ...existing,
          ...location,
          type: shouldPreserveExistingType(existing, location) ? existing.type : location.type,
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
  return mergeCampusLocations(buildCampusDirectory(), toLocalOSMLocations());
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
