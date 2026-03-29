import { ParkingPermit } from "../../store/appShellStore";

import React from "react";

import { Dimensions } from "react-native";
import { BUILDINGS, AMENITIES } from "../../data/campus";
import { Bus, MapPin, Navigation, Info, Utensils, Star, Flame, Calendar, Dumbbell, Library, GraduationCap, TrafficCone, Layers, Clock } from "lucide-react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Snap point translateY values (distance from top of screen)
export const SNAP_PEEK = SCREEN_HEIGHT * 0.45; // ~55% of screen visible
export const SNAP_FULL = SCREEN_HEIGHT * 0.08; // ~92% of screen visible
export const SNAP_HIDDEN = SCREEN_HEIGHT; // off-screen
export const SHEET_BOTTOM_OFFSET = 0;
export const FLOATING_CARD_BOTTOM_OFFSET = 124;
export const ALL_BUS_ROUTES_KEY = "__all__";
export const ROOM_RESERVATION_URL = "https://tamu.libcal.com/reserve";
export const PARKING_INFO_URL = "https://transport.tamu.edu/Parking";
export const EVENTS_URL = "https://stuactonline.tamu.edu/app/events";

export const TAMU_CENTER = {
  latitude: 30.6153,
  longitude: -96.341,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export const CANONICAL_LOCATION_ALIASES: Record<string, string> = {
  "Student Rec Center": "Student Recreation Center",
  "Southside Rec Center": "Southside Recreation Center",
  "Polo Road Rec Center": "Polo Road Recreation Center",
  "Evans Library": "Sterling C. Evans Library",
  "Memorial Student Center (MSC)": "Memorial Student Center",
};

export const BUILDING_COORDS = new Map(
  BUILDINGS.map((building) => [
    building.name,
    { lat: building.latitude, lng: building.longitude },
  ]),
);

export const AMENITY_COORDS = new Map(
  AMENITIES.map((amenity) => [
    amenity.name,
    { lat: amenity.latitude, lng: amenity.longitude },
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

export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#181818" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
];

// AI-estimated campus-wide density zones — independent of registered locations.
// Filtered to only show gyms and libraries as requested.
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
    hours: "6:00 AM – 11:59 PM", // Updated based on March 26 data
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

export type LocationType =
  | "Rec"
  | "Library"
  | "Dining"
  | "Hub"
  | "Study"
  | "General"
  | "Academic"
  | "Parking"
  | "Landmark"
  | "Housing"
  | "Athletics";

export interface CampusLocation {
  location: string;
  percent_full: number;
  type: LocationType;
  is_live: boolean;
  available_seats: number | null;
  coord: { lat: number; lng: number };
  current_event?: string;
  hours?: string;
  reviews?: Array<{ user: string; rating: number; comment: string }>;
  traffic_history?: number[];
  restaurants?: string[];
  menu_snippet?: string[] | null;
  shortName?: string;
  description?: string;
  source?: "traffic" | "directory";
}

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

export const CATEGORIES = [
  { id: "Bus", label: "Buses", icon: <Bus size={18} /> },
  { id: "Dining", label: "Dining", icon: <Utensils size={18} /> },
  { id: "Parking", label: "Parking", icon: <TrafficCone size={18} /> },
  { id: "Library", label: "Libraries", icon: <Library size={18} /> },
  { id: "Academic", label: "Academic", icon: <GraduationCap size={18} /> },
  { id: "Rec", label: "Gyms", icon: <Dumbbell size={18} /> },
  { id: "Study", label: "Study", icon: <Info size={18} /> },
  { id: "Heatmap", label: "Traffic", icon: <Layers size={18} /> },
];

export const getCategoryIcon = (type: LocationType) => {
  switch (type) {
    case "Library":
      return <Library />;
    case "Rec":
      return <Dumbbell />;
    case "Dining":
    case "Hub":
      return <Utensils />;
    case "Parking":
      return <TrafficCone />;
    case "Academic":
      return <Info />;
    case "Landmark":
      return <Star />;
    case "Study":
      return <Library />;
    default:
      return <Info />;
  }
};

export const getStatusColor = (pct: number) => {
  if (pct < 40) return "#32D74B";
  if (pct < 75) return "#FF9500";
  return "#FF3B30";
};

export function getCategoryPillIcon(id: string) {
  switch (id) {
    case "Bus":
      return Bus;
    case "Library":
      return Library;
    case "Rec":
      return Dumbbell;
    case "Dining":
      return Utensils;
    case "Parking":
      return TrafficCone;
    case "Academic":
      return GraduationCap;
    case "Study":
      return Info;
    case "Heatmap":
    default:
      return Layers;
  }
}

export function getDistanceLabel(distanceMeters: number | null) {
  if (distanceMeters == null) return "Campus";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

export function getStopLabel(stop: any) {
  return stop?.Name || stop?.StopName || stop?.Description || stop?.StopCode || 'Transit Stop';
}

export function getParkingRecommendation(
  locationName: string,
  permit: ParkingPermit,
): { score: number; badge: string; detail: string } {
  const lower = locationName.toLowerCase();
  const isGarage = lower.includes("garage");
  const isWestCampus = lower.includes("west campus");
  const isResidentAdjacent = lower.includes("lot 30") || lower.includes("lot 61");

  if (permit === "visitor") {
    return isGarage
      ? { score: 0, badge: "Best Match", detail: "Visitor-friendly garages are prioritized first." }
      : { score: 2, badge: "Check Access", detail: "Visitor access is usually easier in campus garages." };
  }

  if (permit === "garage") {
    return isGarage
      ? { score: 0, badge: "Garage Fit", detail: "This matches a garage-first parking setup." }
      : { score: 3, badge: "Secondary", detail: "A garage may be a cleaner match for this permit preference." };
  }

  if (permit === "west_campus") {
    return isWestCampus
      ? { score: 0, badge: "West Campus", detail: "This is aligned with west campus parking." }
      : { score: isGarage ? 1 : 3, badge: "Secondary", detail: "Useful, but west campus options rank higher." };
  }

  if (permit === "resident") {
    return isResidentAdjacent
      ? { score: 0, badge: "Resident Fit", detail: "This lot is surfaced first for residential access." }
      : { score: isGarage ? 2 : 1, badge: "Check Access", detail: "Verify housing access before relying on this option." };
  }

  return isGarage
    ? { score: 0, badge: "Recommended", detail: "A strong all-around option for most valid permits." }
    : { score: 1, badge: "Available", detail: "Keep this as a fallback if your primary lots are full." };
}

export function getLocationContextLink(location: CampusLocation) {
  if (location.type === "Parking") {
    return {
      label: "Parking Guide",
      url: PARKING_INFO_URL,
    };
  }

  if (location.type === "Library" || location.type === "Study" || location.type === "Academic") {
    return {
      label: "Reserve Room",
      url: ROOM_RESERVATION_URL,
    };
  }

  if (location.current_event || location.type === "Landmark" || location.type === "Hub") {
    return {
      label: "View Events",
      url: EVENTS_URL,
    };
  }

  return null;
}

export function haversineDistanceMeters(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
) {
  const earthRadiusMeters = 6371000;
  const dLat = ((endLat - startLat) * Math.PI) / 180;
  const dLng = ((endLng - startLng) * Math.PI) / 180;
  const startLatRad = (startLat * Math.PI) / 180;
  const endLatRad = (endLat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(startLatRad) *
      Math.cos(endLatRad);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function toLocalXY(latitude: number, longitude: number, originLat: number) {
  const metersPerLat = 111320;
  const metersPerLng = Math.cos((originLat * Math.PI) / 180) * 111320;
  return {
    x: longitude * metersPerLng,
    y: latitude * metersPerLat,
  };
}

export function getClosestProgressMeters(
  routePoints: Array<{ latitude: number; longitude: number }>,
  target: { latitude: number; longitude: number },
) {
  if (routePoints.length === 0) return null;
  if (routePoints.length === 1) return 0;

  const originLat = target.latitude;
  const targetXY = toLocalXY(target.latitude, target.longitude, originLat);
  let traveledMeters = 0;
  let bestProgressMeters = 0;
  let bestDistanceMeters = Number.POSITIVE_INFINITY;

  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const startXY = toLocalXY(start.latitude, start.longitude, originLat);
    const endXY = toLocalXY(end.latitude, end.longitude, originLat);
    const dx = endXY.x - startXY.x;
    const dy = endXY.y - startXY.y;
    const segmentLengthSquared = dx * dx + dy * dy;

    let t = 0;
    if (segmentLengthSquared > 0) {
      t =
        ((targetXY.x - startXY.x) * dx + (targetXY.y - startXY.y) * dy) /
        segmentLengthSquared;
      t = Math.max(0, Math.min(1, t));
    }

    const projectionX = startXY.x + dx * t;
    const projectionY = startXY.y + dy * t;
    const distanceToSegment = Math.hypot(
      targetXY.x - projectionX,
      targetXY.y - projectionY,
    );
    const segmentLengthMeters = Math.hypot(dx, dy);

    if (distanceToSegment < bestDistanceMeters) {
      bestDistanceMeters = distanceToSegment;
      bestProgressMeters = traveledMeters + segmentLengthMeters * t;
    }

    traveledMeters += segmentLengthMeters;
  }

  return {
    progressMeters: bestProgressMeters,
    totalRouteMeters: traveledMeters,
    offsetMeters: bestDistanceMeters,
  };
}

export function formatBusDistance(
  distanceMeters: number,
  etaMinutes: number,
  busLabel?: string,
) {
  const prefix = busLabel ? `${busLabel} · ` : "";
  if (distanceMeters <= 120) return `${prefix}Arriving now`;
  if (distanceMeters < 1000)
    return `${prefix}${Math.round(distanceMeters)} m away · ~${etaMinutes} min`;
  return `${prefix}${(distanceMeters / 1000).toFixed(1)} km away · ~${etaMinutes} min`;
}

export function getApproximateEtaMinutes(
  routePoints: Array<{ latitude: number; longitude: number }>,
  stop: any,
  bus: any,
) {
  const stopProgress = getClosestProgressMeters(routePoints, {
    latitude: stop.Latitude,
    longitude: stop.Longitude,
  });
  const busProgress = getClosestProgressMeters(routePoints, {
    latitude: bus.Latitude,
    longitude: bus.Longitude,
  });

  if (!stopProgress || !busProgress) {
    const fallbackDistance = haversineDistanceMeters(
      bus.Latitude,
      bus.Longitude,
      stop.Latitude,
      stop.Longitude,
    );
    return Math.max(1, Math.round(fallbackDistance / 220));
  }

  let routeDelta = stopProgress.progressMeters - busProgress.progressMeters;
  if (routeDelta < 0) {
    routeDelta += stopProgress.totalRouteMeters;
  }

  const effectiveDistance = Math.max(
    0,
    routeDelta + stopProgress.offsetMeters + busProgress.offsetMeters,
  );

  return Math.max(1, Math.round(effectiveDistance / 220));
}

export function isVehicleOnRoute(bus: any, route: any) {
  if (!bus || !route) return false;
  const routeKey = (route.Key || '').toString().toLowerCase();
  const routeShortName = (route.ShortName || '').toString().toLowerCase();
  const routeName = (route.Name || '').toString().toLowerCase();
  return [bus.RouteKey, bus.RouteShortName, bus.RouteName]
    .map((value: string) => (value || '').toString().toLowerCase())
    .some((value: string) => value === routeKey || value === routeShortName || value === routeName);
}

