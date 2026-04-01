import React from "react";
import {
  Info,
  Flame,
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
import type { CampusLocation, LocationType } from "./types";
import { PARKING_INFO_URL, ROOM_RESERVATION_URL, EVENTS_URL } from "./types";
import { ParkingPermit } from "../../store/appShellStore";

// ── Icon helpers ──────────────────────────────────────────────
export const getCategoryIcon = (type: LocationType, color = "#FFFFFF", size = 24) => {
  switch (type) {
    case "Library":
      return <Library color={color} size={size} />;
    case "Rec":
      return <Dumbbell color={color} size={size} />;
    case "Dining":
    case "Hub":
      return <Utensils color={color} size={size} />;
    case "Parking":
      return <TrafficCone color={color} size={size} />;
    case "Academic":
      return <Info color={color} size={size} />;
    case "Landmark":
      return <Star color={color} size={size} />;
    case "Study":
      return <Library color={color} size={size} />;
    default:
      return <Info color={color} size={size} />;
  }
};

export const getCategoryColor = (type: string | undefined): string => {
  if (!type) return "#500000";
  const t = type.toLowerCase();
  
  if (t.includes("engineering")) return "#007AFF"; // Blue
  if (t.includes("business")) return "#FF9500";    // Orange
  if (t.includes("science")) return "#32D74B";      // Green
  if (t.includes("social")) return "#FF2D55";       // Pink
  if (t.includes("dining")) return "#FF3B30";       // Red
  if (t.includes("library")) return "#5856D6";      // Purple
  if (t.includes("rec")) return "#00C7BE";          // Teal
  if (t.includes("study")) return "#AF52DE";        // Indigo
  if (t.includes("parking")) return "#8E8E93";      // Grey
  if (t.includes("bus")) return "#007AFF";          // Blue
  
  switch (type) {
    case "Academic": return "#500000"; // Maroon
    case "Dining": return "#FF3B30";   // Red
    case "Library": return "#5856D6";  // Purple
    case "Rec": return "#32D74B";      // Green
    case "Study": return "#FF9500";    // Orange
    case "Parking": return "#8E8E93";  // Grey
    case "Bus": return "#007AFF";      // Blue
    default: return "#500000";
  }
};

export function getCategoryPillIcon(id: string) {
  switch (id) {
    case "Pulse":
      return Flame;
    case "Schedule":
      return Calendar;
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

// ── Color helpers ─────────────────────────────────────────────
export const getStatusColor = (pct: number) => {
  if (pct < 40) return "#32D74B";
  if (pct < 75) return "#FF9500";
  return "#FF3B30";
};

// ── Distance / formatting ─────────────────────────────────────
export function getDistanceLabel(distanceMeters: number | null) {
  if (distanceMeters == null) return "Campus";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

export function formatScheduleDays(days: string[]) {
  if (!Array.isArray(days) || days.length === 0) {
    return "Days TBA";
  }
  return days.join(" ");
}

export function getStopLabel(stop: any) {
  return stop?.Name || stop?.StopName || stop?.Description || stop?.StopCode || "Transit Stop";
}

// ── Parking recommendation ────────────────────────────────────
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

// ── Context links ─────────────────────────────────────────────
export function getLocationContextLink(location: CampusLocation) {
  if (location.type === "Parking") {
    return { label: "Parking Guide", url: PARKING_INFO_URL };
  }

  if (location.type === "Library" || location.type === "Study" || location.type === "Academic") {
    return { label: "Reserve Room", url: ROOM_RESERVATION_URL };
  }

  if (location.current_event || location.type === "Landmark" || location.type === "Hub") {
    return { label: "View Events", url: EVENTS_URL };
  }

  return null;
}

// ── Geo math ──────────────────────────────────────────────────
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
  const routeKey = (route.Key || "").toString().toLowerCase();
  const routeShortName = (route.ShortName || "").toString().toLowerCase();
  const routeName = (route.Name || "").toString().toLowerCase();
  return [bus.RouteKey, bus.RouteShortName, bus.RouteName]
    .map((value: string) => (value || "").toString().toLowerCase())
    .some(
      (value: string) =>
        value === routeKey || value === routeShortName || value === routeName,
    );
}

// ── Time helper ───────────────────────────────────────────────
export function parseTimeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  
  // Handle formats like "8:30 AM", "10:20 PM", "08:30"
  const clean = timeStr.trim().toUpperCase();
  const parts = clean.split(/[:\s]+/);
  if (parts.length < 2) return 0;

  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  const isPM = clean.includes("PM");
  const isAM = clean.includes("AM");

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}
