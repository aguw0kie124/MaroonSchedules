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
} from "lucide-react-native";
import { BUILDINGS, AMENITIES } from "../../data/campus";
import type { CampusLocation, LocationType } from "./types";

// ── Canonical naming ──────────────────────────────────────────
export const CANONICAL_LOCATION_ALIASES: Record<string, string> = {
  "Student Rec Center": "Student Recreation Center",
  "Southside Rec Center": "Southside Recreation Center",
  "Polo Road Rec Center": "Polo Road Recreation Center",
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
  name: string,
  fallback: { lat: number; lng: number },
): { lat: number; lng: number } {
  const canonicalName = getCanonicalLocationName(name);
  return (
    BUILDING_COORDS.get(canonicalName) ||
    AMENITY_COORDS.get(canonicalName) ||
    fallback
  );
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
    ...getCanonicalCoords("Student Recreation Center", {
      lat: 30.6094,
      lng: -96.34,
    }),
    peak: 70,
    off: 10,
    radius: 220,
    type: "Rec",
    hours: "6:00 AM – 11:59 PM",
  },
  {
    name: "Southside Recreation Center",
    ...getCanonicalCoords("Southside Recreation Center", {
      lat: 30.6093,
      lng: -96.339,
    }),
    peak: 65,
    off: 10,
    radius: 200,
    type: "Rec",
  },
  {
    name: "Polo Road Recreation Center",
    ...getCanonicalCoords("Polo Road Recreation Center", {
      lat: 30.6237,
      lng: -96.3395,
    }),
    peak: 55,
    off: 8,
    radius: 200,
    type: "Rec",
  },
  {
    name: "Sterling C. Evans Library",
    ...getCanonicalCoords("Sterling C. Evans Library", {
      lat: 30.6171,
      lng: -96.3387,
    }),
    peak: 82,
    off: 18,
    radius: 160,
    type: "Library",
  },
  {
    name: "Evans Library Annex",
    ...getCanonicalCoords("Evans Library Annex", {
      lat: 30.6168,
      lng: -96.3383,
    }),
    peak: 70,
    off: 15,
    radius: 120,
    type: "Library",
  },
  {
    name: "West Campus Library",
    ...getCanonicalCoords("West Campus Library", {
      lat: 30.6146,
      lng: -96.344,
    }),
    peak: 60,
    off: 14,
    radius: 160,
    type: "Library",
  },
  {
    name: "Memorial Student Center",
    ...getCanonicalCoords("Memorial Student Center", {
      lat: 30.6123,
      lng: -96.3415,
    }),
    peak: 85,
    off: 15,
    radius: 180,
    type: "Dining",
  },
  {
    name: "Polo Road Garage Dining",
    ...getCanonicalCoords("Polo Road Garage Dining", {
      lat: 30.6235,
      lng: -96.3388,
    }),
    peak: 80,
    off: 10,
    radius: 180,
    type: "Dining",
  },
  {
    name: "Sbisa Dining Hall",
    ...getCanonicalCoords("Sbisa Dining Hall", {
      lat: 30.617135,
      lng: -96.343777,
    }),
    peak: 70,
    off: 5,
    radius: 150,
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
    hours: "6:00 AM – 11:59 PM",
    description: "Main rec center with fitness, courts, and aquatic areas.",
  },
  "Southside Recreation Center": {
    hours: "5:30 AM – 11:59 PM",
    description: "Southside fitness and recreation facility.",
  },
  "Polo Road Recreation Center": {
    hours: "6:00 AM – 9:00 PM weekdays",
    description: "North campus rec and fitness destination.",
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
      return "Study";
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

// ── Build the full campus directory ───────────────────────────
export function buildCampusDirectory(): CampusLocation[] {
  const buildingLocations = BUILDINGS.map((building) => ({
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

// ── Category definitions ──────────────────────────────────────
export const CATEGORIES = [
  { id: "Schedule", label: "Classes", icon: <Calendar size={18} /> },
  { id: "Bus", label: "Buses", icon: <Bus size={18} /> },
  { id: "Dining", label: "Dining", icon: <Utensils size={18} /> },
  { id: "Parking", label: "Parking", icon: <TrafficCone size={18} /> },
  { id: "Library", label: "Libraries", icon: <Library size={18} /> },
  { id: "Academic", label: "Academic", icon: <GraduationCap size={18} /> },
  { id: "Rec", label: "Gyms", icon: <Dumbbell size={18} /> },
  { id: "Study", label: "Study", icon: <Info size={18} /> },
  { id: "Heatmap", label: "Traffic", icon: <Layers size={18} /> },
];
