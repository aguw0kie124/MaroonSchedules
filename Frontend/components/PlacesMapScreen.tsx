import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  PanResponder,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  Keyboard,
} from "react-native";
import axios from "axios";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import {
  Bus,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cog,
  Compass,
  Dumbbell,
  ExternalLink,
  Flame,
  GraduationCap,
  Info,
  Layers,
  Library,
  Locate,
  LocateFixed,
  MapPin,
  Maximize2,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  Minimize2,
  Navigation,
  Orbit,
  Plus,
  Search,
  Share2,
  Star,
  TrafficCone,
  Utensils,
  X,
} from "lucide-react-native";
import type { WalkingRoute } from "../services/campusDirections";
import { useTheme } from "./SharedUI";
import { Card } from "./SharedUI";import { PageModuleEditor } from "./PageModuleEditor";
import MapView, {
  Marker,
  Circle,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import { transitService } from "../services/transitService";
import { useUser } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { connectFeedsUser } from "../services/streamFeeds";
import { API_URL } from "../config";
import { useCampusHubStore } from "../store/campusHubStore";
import { BUILDINGS, AMENITIES } from "../data/campus";
import {
  ParkingPermit,
  getOrderedItems,
  useAppShellStore,
} from "../store/appShellStore";
import {
  fetchDiningFullMenuCached,
  getDiningMealPeriodForLocation,
  getDiningMenuCandidates,
} from "../services/diningMenuCache";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Snap point translateY values (distance from top of screen)
const SNAP_PEEK = SCREEN_HEIGHT * 0.45; // ~55% of screen visible
const SNAP_FULL = SCREEN_HEIGHT * 0.08; // ~92% of screen visible
const SNAP_HIDDEN = SCREEN_HEIGHT; // off-screen
const SHEET_BOTTOM_OFFSET = 0;
const FLOATING_CARD_BOTTOM_OFFSET = 124;
const ALL_BUS_ROUTES_KEY = "__all__";
const ROOM_RESERVATION_URL = "https://tamu.libcal.com/reserve";
const PARKING_INFO_URL = "https://transport.tamu.edu/Parking";
const EVENTS_URL = "https://stuactonline.tamu.edu/app/events";

const TAMU_CENTER = {
  latitude: 30.6153,
  longitude: -96.341,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

const CANONICAL_LOCATION_ALIASES: Record<string, string> = {
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

function getCanonicalLocationName(name: string): string {
  return CANONICAL_LOCATION_ALIASES[name] || name;
}

function getCanonicalCoords(
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

const DARK_MAP_STYLE = [
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
const CAMPUS_ZONES: Array<{
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

function getTimeOfDayFactor(): number {
  const hour = new Date().getHours();
  if (hour >= 8 && hour < 9) return 0.55;
  if (hour >= 9 && hour < 11) return 0.95;
  if (hour >= 11 && hour < 14) return 1.0;
  if (hour >= 14 && hour < 17) return 0.85;
  if (hour >= 17 && hour < 19) return 0.6;
  if (hour >= 19 && hour < 22) return 0.45;
  return 0.12;
}

function getZoneDensity(zone: (typeof CAMPUS_ZONES)[0]): number {
  const factor = getTimeOfDayFactor();
  return Math.round(zone.off + (zone.peak - zone.off) * factor);
}

type LocationType =
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

interface CampusLocation {
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

const STATIC_LOCATION_META: Record<string, Partial<CampusLocation>> = {
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

function mapBuildingType(type: string): LocationType {
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

function mapAmenityType(type: string): LocationType {
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

function buildCampusDirectory(): CampusLocation[] {
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

const CATEGORIES = [
  { id: "Bus", label: "Buses", icon: <Bus size={18} /> },
  { id: "Dining", label: "Dining", icon: <Utensils size={18} /> },
  { id: "Parking", label: "Parking", icon: <TrafficCone size={18} /> },
  { id: "Library", label: "Libraries", icon: <Library size={18} /> },
  { id: "Academic", label: "Academic", icon: <GraduationCap size={18} /> },
  { id: "Rec", label: "Gyms", icon: <Dumbbell size={18} /> },
  { id: "Study", label: "Study", icon: <Info size={18} /> },
  { id: "Heatmap", label: "Traffic", icon: <Layers size={18} /> },
];

const getCategoryIcon = (type: LocationType) => {
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

const getStatusColor = (pct: number) => {
  if (pct < 40) return "#32D74B";
  if (pct < 75) return "#FF9500";
  return "#FF3B30";
};

function getCategoryPillIcon(id: string) {
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

function getDistanceLabel(distanceMeters: number | null) {
  if (distanceMeters == null) return "Campus";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

function getStopLabel(stop: any) {
  return (
    stop?.Name ||
    stop?.StopName ||
    stop?.Description ||
    stop?.StopCode ||
    "Transit Stop"
  );
}

function getParkingRecommendation(
  locationName: string,
  permit: ParkingPermit,
): { score: number; badge: string; detail: string } {
  const lower = locationName.toLowerCase();
  const isGarage = lower.includes("garage");
  const isWestCampus = lower.includes("west campus");
  const isResidentAdjacent =
    lower.includes("lot 30") || lower.includes("lot 61");

  if (permit === "visitor") {
    return isGarage
      ? {
          score: 0,
          badge: "Best Match",
          detail: "Visitor-friendly garages are prioritized first.",
        }
      : {
          score: 2,
          badge: "Check Access",
          detail: "Visitor access is usually easier in campus garages.",
        };
  }

  if (permit === "garage") {
    return isGarage
      ? {
          score: 0,
          badge: "Garage Fit",
          detail: "This matches a garage-first parking setup.",
        }
      : {
          score: 3,
          badge: "Secondary",
          detail: "A garage may be a cleaner match for this permit preference.",
        };
  }

  if (permit === "west_campus") {
    return isWestCampus
      ? {
          score: 0,
          badge: "West Campus",
          detail: "This is aligned with west campus parking.",
        }
      : {
          score: isGarage ? 1 : 3,
          badge: "Secondary",
          detail: "Useful, but west campus options rank higher.",
        };
  }

  if (permit === "resident") {
    return isResidentAdjacent
      ? {
          score: 0,
          badge: "Resident Fit",
          detail: "This lot is surfaced first for residential access.",
        }
      : {
          score: isGarage ? 2 : 1,
          badge: "Check Access",
          detail: "Verify housing access before relying on this option.",
        };
  }

  return isGarage
    ? {
        score: 0,
        badge: "Recommended",
        detail: "A strong all-around option for most valid permits.",
      }
    : {
        score: 1,
        badge: "Available",
        detail: "Keep this as a fallback if your primary lots are full.",
      };
}

function getLocationContextLink(location: CampusLocation) {
  if (location.type === "Parking") {
    return {
      label: "Parking Guide",
      url: PARKING_INFO_URL,
    };
  }

  if (
    location.type === "Library" ||
    location.type === "Study" ||
    location.type === "Academic"
  ) {
    return {
      label: "Reserve Room",
      url: ROOM_RESERVATION_URL,
    };
  }

  if (
    location.current_event ||
    location.type === "Landmark" ||
    location.type === "Hub"
  ) {
    return {
      label: "View Events",
      url: EVENTS_URL,
    };
  }

  return null;
}

function haversineDistanceMeters(
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

function toLocalXY(latitude: number, longitude: number, originLat: number) {
  const metersPerLat = 111320;
  const metersPerLng = Math.cos((originLat * Math.PI) / 180) * 111320;
  return {
    x: longitude * metersPerLng,
    y: latitude * metersPerLat,
  };
}

function getClosestProgressMeters(
  routePoints: Array<{ latitude: number; longitude: number }>,
  target: { latitude: number; longitude: number },
) {
  if (
    !routePoints ||
    !target ||
    target.latitude == null ||
    target.longitude == null
  )
    return null;
  const validPoints = routePoints.filter(
    (p) => p && p.latitude != null && p.longitude != null,
  );
  if (validPoints.length === 0) return null;
  if (validPoints.length === 1) {
    return {
      progressMeters: 0,
      totalRouteMeters: 0,
      offsetMeters:
        Math.hypot(
          target.latitude - validPoints[0].latitude,
          target.longitude - validPoints[0].longitude,
        ) * 111320, // rough meter approximation
    };
  }

  const originLat = target.latitude;
  const targetXY = toLocalXY(target.latitude, target.longitude, originLat);
  let traveledMeters = 0;
  let bestProgressMeters = 0;
  let bestDistanceMeters = Number.POSITIVE_INFINITY;

  for (let index = 0; index < validPoints.length - 1; index += 1) {
    const start = validPoints[index];
    const end = validPoints[index + 1];
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

function formatBusDistance(
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

function getApproximateEtaMinutes(
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

function isVehicleOnRoute(bus: any, route: any) {
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

export function PlacesMapScreen() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(COLORS, theme === "dark");
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { width: SCREEN_WIDTH } = Dimensions.get("window");

  // ── App-shell store ───────────────────────────────────────
  const placesPills = useAppShellStore((s) => s.placesPills);
  const parkingPermit = useAppShellStore((s) => s.parkingPermit);
  const togglePlacesPill = useAppShellStore((s) => s.togglePlacesPill);
  const movePlacesPill = useAppShellStore((s) => s.movePlacesPill);

  const [placesViewMode, setPlacesViewMode] = useState<"map" | "list">("map");
  const isStandaloneTransitScreen = route.name === "BusRoutes";  const orderedPlacesPills = useMemo(
    () => getOrderedItems(placesPills),
    [placesPills],
  );
  const visiblePlacesPills = useMemo(
    () => orderedPlacesPills.filter((item) => item.visible),
    [orderedPlacesPills],
  );

  // ── Proximity State ──
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [nearestBusInfo, setNearestBusInfo] = useState<string | null>(null);
  const busPulseAnim = useRef(new Animated.Value(1)).current;

  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<string>("Bus");
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const [categoryTrackWidth, setCategoryTrackWidth] = useState(0);

  // ── Pulse Animation ──
  useEffect(() => {
    if (activeLayer === "Bus") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(busPulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(busPulseAnim, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [activeLayer]);

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showBusTimetableSheet, setShowBusTimetableSheet] = useState(false);
  const [streamReviews, setStreamReviews] = useState<any[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [isPostingReview, setIsPostingReview] = useState(false);
  const [allReviewsModalVisible, setAllReviewsModalVisible] = useState(false);
  const [hubRestaurants, setHubRestaurants] = useState<string[]>([]);
  const [isFetchingDining, setIsFetchingDining] = useState(false);
  const [diningMenuOptions, setDiningMenuOptions] = useState<string[]>([]);
  const [activeDiningMenu, setActiveDiningMenu] = useState<string | null>(null);
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);

  // ── Transit State ──
  const [busRoutes, setBusRoutes] = useState<any[]>([]);
  const [busVehicles, setBusVehicles] = useState<any[]>([]);
  const [busStops, setBusStops] = useState<any[]>([]);
  const [userCoord, setUserCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedBusRouteId, setSelectedBusRouteId] = useState<string | null>(
    ALL_BUS_ROUTES_KEY,
  );
  const [selectedDirection, setSelectedDirection] = useState<string>("All");
  const [routePatterns, setRoutePatterns] = useState<any[]>([]);
  const [allRoutePatternsById, setAllRoutePatternsById] = useState<
    Record<string, { points: any[]; stops: any[] }>
  >({});
  const [isFetchingBus, setIsFetchingBus] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [routeSearchQuery, setRouteSearchQuery] = useState("");
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const busPollInterval = useRef<any>(null);
  const lastBusTapRef = useRef<number>(0);
  const { user } = useUser();
  const campusHubSnapshot = useCampusHubStore((state) => state.snapshot);
  const hydrateCampusHub = useCampusHubStore((state) => state.hydrate);
  const mapRef = useRef<any>(null);
  const lastPlacesFitKey = useRef<string | null>(null);

  const routeDirectionsAvailable = useMemo(() => {
    const dirs = new Set<string>();
    busStops.forEach((s: any) => {
      if (s.DirectionName) dirs.add(s.DirectionName);
    });
    return Array.from(dirs).filter(Boolean);
  }, [busStops]);

  // Auto-select the first direction when stops load
  // (no "All" option — always pick a concrete direction)
  useEffect(() => {
    if (routeDirectionsAvailable.length > 0) {
      setSelectedDirection(routeDirectionsAvailable[0]);
    }
  }, [routeDirectionsAvailable]);

  const filteredBusStopsForMap = useMemo(() => {
    if (selectedDirection === "All") return busStops;
    return busStops.filter((s: any) => s.DirectionName === selectedDirection);
  }, [busStops, selectedDirection]);

  const isAllBusRoutesSelected =
    !selectedBusRouteId || selectedBusRouteId === ALL_BUS_ROUTES_KEY;
  const selectedRoute = useMemo(
    () =>
      isAllBusRoutesSelected
        ? null
        : (busRoutes.find((route) => route.Key === selectedBusRouteId) ?? null),
    [busRoutes, isAllBusRoutesSelected, selectedBusRouteId],
  );
  const busRouteOptions = useMemo(
    () => [
      {
        Key: ALL_BUS_ROUTES_KEY,
        ShortName: "ALL",
        Name: "Show All Routes",
        Color: "#1E1E1E",
      },
      ...busRoutes,
    ],
    [busRoutes],
  );
  const fullCampusIndex = useMemo(() => buildCampusDirectory(), []);
  const recreationFacilityMap = useMemo(() => {
    const facilities = campusHubSnapshot?.recreation.facilities || [];
    return new Map(
      facilities.map((facility) => [
        getCanonicalLocationName(facility.name),
        facility,
      ]),
    );
  }, [campusHubSnapshot?.recreation.facilities]);
  const visibleCategories = useMemo(() => {
    const orderedCategories = visiblePlacesPills
      .map((item) => CATEGORIES.find((category) => category.id === item.id))
      .filter(Boolean) as typeof CATEGORIES;

    if (!orderedCategories.length) {
      return CATEGORIES;
    }

    const activeCategory = CATEGORIES.find(
      (category) => category.id === activeLayer,
    );
    if (
      activeCategory &&
      !orderedCategories.some((category) => category.id === activeCategory.id)
    ) {
      return [activeCategory, ...orderedCategories];
    }

    return orderedCategories;
  }, [activeLayer, visiblePlacesPills]);
  const topBarItems = useMemo(
    () => [
      ...visibleCategories.map((category) => ({
        ...category,
        isSettings: false,
      })),
      { id: "__settings__", label: "Settings", isSettings: true },
    ],
    [visibleCategories],
  );
  const filteredBusRoutes = useMemo(() => {
    const query = routeSearchQuery.trim().toLowerCase();
    if (!query) {
      return busRouteOptions;
    }

    return busRouteOptions.filter((route) => {
      const shortName = (route.ShortName || "").toString().toLowerCase();
      const name = (route.Name || "").toString().toLowerCase();
      return shortName.includes(query) || name.includes(query);
    });
  }, [busRouteOptions, routeSearchQuery]);
  const nearbyTransitInsight = useMemo(() => {
    if (!userCoord || activeLayer !== "Bus" || !selectedRoute) {
      return null;
    }

    const nearestStop = busStops.reduce(
      (best, stop) => {
        const distance = haversineDistanceMeters(
          userCoord.latitude,
          userCoord.longitude,
          stop.Latitude,
          stop.Longitude,
        );
        if (!best || distance < best.distanceMeters) {
          return { stop, distanceMeters: distance };
        }
        return best;
      },
      null as { stop: any; distanceMeters: number } | null,
    );

    const nearestVehicle = busVehicles.reduce(
      (best, vehicle) => {
        const distance = haversineDistanceMeters(
          userCoord.latitude,
          userCoord.longitude,
          vehicle.Latitude,
          vehicle.Longitude,
        );
        if (!best || distance < best.distanceMeters) {
          return { vehicle, distanceMeters: distance };
        }
        return best;
      },
      null as { vehicle: any; distanceMeters: number } | null,
    );

    if (
      (!nearestStop || nearestStop.distanceMeters > 320) &&
      (!nearestVehicle || nearestVehicle.distanceMeters > 380)
    ) {
      return null;
    }

    return {
      nearestStop,
      nearestVehicle,
    };
  }, [activeLayer, busStops, busVehicles, selectedRoute, userCoord]);
  const stopTimetable = useMemo(() => {
    if (activeLayer !== "Bus" || !selectedRoute || busStops.length === 0) {
      return [];
    }

    return busStops.map((stop, index) => {
      if (busVehicles.length === 0) {
        return {
          stop,
          sequence: index + 1,
          etaLabel: "Route loaded",
          detail: "ETA pending",
        };
      }

      const rankedBuses = busVehicles
        .map((bus) => ({
          bus,
          etaMinutes: getApproximateEtaMinutes(routePatterns, stop, bus),
        }))
        .sort((left, right) => left.etaMinutes - right.etaMinutes);
      const nextBus = rankedBuses[0];

      if (!nextBus) {
        return {
          stop,
          sequence: index + 1,
          etaLabel: "No estimate",
          detail: "Live feed unavailable",
        };
      }

      return {
        stop,
        sequence: index + 1,
        etaLabel: nextBus.etaMinutes <= 1 ? "Now" : `${nextBus.etaMinutes} min`,
        detail: nextBus.bus.RouteShortName
          ? `Route ${nextBus.bus.RouteShortName}`
          : nextBus.bus.Name || "Live bus",
      };
    });
  }, [activeLayer, busStops, busVehicles, routePatterns, selectedRoute]);

  const filteredStopTimetable = useMemo(() => {
    if (selectedDirection === "All") return stopTimetable;
    return stopTimetable.filter(
      (entry) => entry.stop?.DirectionName === selectedDirection,
    );
  }, [stopTimetable, selectedDirection]);
  const allRouteBoards = useMemo(() => {
    if (!isAllBusRoutesSelected) {
      return [];
    }

    return busRoutes
      .map((route) => {
        const pattern = allRoutePatternsById[route.Key];
        const routePoints = pattern?.points || [];
        const routeStops = pattern?.stops || [];
        const routeVehicles = busVehicles.filter((bus) =>
          isVehicleOnRoute(bus, route),
        );
        const entries = routeStops.slice(0, 4).map((stop, index) => {
          const rankedBuses = routeVehicles
            .map((bus) => ({
              bus,
              etaMinutes: getApproximateEtaMinutes(routePoints, stop, bus),
            }))
            .sort((left, right) => left.etaMinutes - right.etaMinutes);
          const nextBus = rankedBuses[0];

          return {
            stop,
            sequence: index + 1,
            etaLabel: nextBus
              ? nextBus.etaMinutes <= 1
                ? "Now"
                : `${nextBus.etaMinutes} min`
              : "Route loaded",
            detail: nextBus?.bus?.RouteShortName
              ? `Route ${nextBus.bus.RouteShortName}`
              : route.Name || "Transit route",
          };
        });

        return {
          route,
          liveCount: routeVehicles.length,
          entries,
        };
      })
      .filter((board) => board.entries.length > 0 || board.liveCount > 0);
  }, [allRoutePatternsById, busRoutes, busVehicles, isAllBusRoutesSelected]);
  const categorySlotWidth =
    categoryTrackWidth > 0 ? categoryTrackWidth / topBarItems.length : 0;
  const categoryIndicatorTranslateX =
    visibleCategories.length <= 1 || topBarItems.length <= 1
      ? 0
      : indicatorAnim.interpolate({
          inputRange: visibleCategories.map((_, index) => index),
          outputRange: visibleCategories.map(
            (_, index) => index * categorySlotWidth + 2,
          ),
        });

  useEffect(() => {
    if (!visibleCategories.some((category) => category.id === activeLayer)) {
      setActiveLayer(visibleCategories[0]?.id || "Bus");
    }
  }, [activeLayer, visibleCategories]);

  useEffect(() => {
    const nextLayer = route.params?.initialLayer;
    const focusToken = route.params?.focusToken;
    if (!nextLayer || !focusToken) return;

    setActiveLayer(nextLayer);
    setSelectedId(null);
    setSelectedStop(null);
    setSelectedBus(null);
    setNearestBusInfo(null);
    setIsSearchExpanded(false);
    setSearchQuery("");
    setShowSearchResults(false);
  }, [route.params?.focusToken, route.params?.initialLayer]);

  useEffect(() => {
    if (placesViewMode === "list") {
      setSelectedId(null);
    }
  }, [placesViewMode]);

  useEffect(() => {
    if (user?.id && (activeLayer === "Rec" || activeLayer === "Library")) {
      hydrateCampusHub(user.id).catch(() => {});
    }
  }, [activeLayer, hydrateCampusHub, user?.id]);

  useEffect(() => {
    let mounted = true;
    let watcher: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!mounted || permission.status !== "granted") return;
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserCoord({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        if (!mounted || !mapRef.current) return;
        mapRef.current.animateToRegion(
          {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            latitudeDelta: 0.018,
            longitudeDelta: 0.018,
          },
          700,
        );
        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 15000,
          },
          (position) => {
            if (!mounted) return;
            setUserCoord({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
        );
      } catch (locationError) {
        console.warn("Unable to center on current location", locationError);
      }
    })();
    return () => {
      mounted = false;
      watcher?.remove();
    };
  }, []);

  // ── Bottom sheet animation ──────────────────────────────────────────────
  const sheetY = useRef(new Animated.Value(SNAP_HIDDEN)).current;
  // Track where the sheet currently rests (for gesture delta calc)
  const sheetSnap = useRef<number>(SNAP_HIDDEN);
  // Track gesture start position
  const panStartY = useRef<number>(SNAP_HIDDEN);

  const animateSheet = useCallback(
    (toValue: number, onDone?: () => void) => {
      sheetSnap.current = toValue;
      Animated.spring(sheetY, {
        toValue,
        useNativeDriver: true,
        damping: 30,
        stiffness: 260,
        mass: 0.9,
      }).start(onDone);
    },
    [sheetY],
  );

  // Open/close sheet when selection changes
  useEffect(() => {
    if (selectedId) {
      setShowBusTimetableSheet(false);
      animateSheet(SNAP_PEEK);
      fetchReviews(selectedId);
    } else if (
      showBusTimetableSheet &&
      activeLayer === "Bus" &&
      !isAllBusRoutesSelected &&
      !selectedBus
    ) {
      animateSheet(SNAP_PEEK);
    } else {
      animateSheet(SNAP_HIDDEN);
      setStreamReviews([]);
      setHubRestaurants([]);
      setDiningMenuOptions([]);
      setActiveDiningMenu(null);
      setDiningMenuPreview(null);
    }
  }, [
    selectedId,
    showBusTimetableSheet,
    activeLayer,
    isAllBusRoutesSelected,
    selectedStop,
    selectedBus,
    animateSheet,
  ]);

  const fetchReviews = async (placeId: string, limit = 5) => {
    if (limit > 5) setIsFetchingReviews(true);
    try {
      const { getPlaceReviews } = require("../services/streamFeeds");
      const revs = await getPlaceReviews(placeId, limit);
      setStreamReviews(revs);
    } catch (e) {
      console.warn("Failed to fetch stream reviews", e);
    } finally {
      setIsFetchingReviews(false);
    }
  };

  const fetchDiningData = async (location: CampusLocation) => {
    setIsFetchingDining(true);
    try {
      const encodedId = encodeURIComponent(location.location);
      const hubUrl = `${API_URL}/dining/hubs/${encodedId}`;
      console.log(`[Dining] Fetching Hub/Menu for: ${location.location}`);

      const hubRes = await axios.get(hubUrl).catch(() => null);
      const nextRestaurants =
        hubRes && hubRes.data && Array.isArray(hubRes.data.restaurants)
          ? hubRes.data.restaurants
          : [];
      setHubRestaurants(nextRestaurants);

      const menuCandidates = getDiningMenuCandidates(
        location.location,
        nextRestaurants,
      );
      setDiningMenuOptions(menuCandidates);

      const nextMenuLocation = menuCandidates[0] || null;
      setActiveDiningMenu(nextMenuLocation);

      if (nextMenuLocation) {
        const menuPreview = await fetchDiningFullMenuCached({
          location: nextMenuLocation,
          mealPeriod: getDiningMealPeriodForLocation(nextMenuLocation),
        });
        setDiningMenuPreview(menuPreview);
      } else {
        setDiningMenuPreview(null);
      }
    } catch (e) {
      console.warn("Failed to fetch dining data", e);
    } finally {
      setIsFetchingDining(false);
    }
  };

  const loadAllBusRoutes = useCallback(async (routesToLoad: any[]) => {
    if (!routesToLoad.length) {
      setAllRoutePatternsById({});
      setBusVehicles([]);
      return;
    }

    const patternEntries = await Promise.all(
      routesToLoad.map(async (route) => {
        const pattern = await transitService.getRoutePattern(route.Key);
        return [route.Key, pattern] as const;
      }),
    );

    if (latestRouteSelectRef.current !== ALL_BUS_ROUTES_KEY) return;

    const nextPatterns = patternEntries.reduce(
      (acc, [routeKey, pattern]) => {
        acc[routeKey] = pattern;
        return acc;
      },
      {} as Record<string, { points: any[]; stops: any[] }>,
    );
    setAllRoutePatternsById(nextPatterns);

    // Fetch vehicles in bulk
    const allVehicles = await transitService.getVehicles();
    if (latestRouteSelectRef.current !== ALL_BUS_ROUTES_KEY) return;

    if (allVehicles.length > 0) {
      setBusVehicles(allVehicles);
    }
    setBusStops([]);
    setRoutePatterns([]);

    const allPoints = patternEntries
      .flatMap(([, pattern]) => pattern.points || [])
      .filter(
        (p) =>
          p &&
          p.latitude != null &&
          p.longitude != null &&
          !isNaN(p.latitude) &&
          !isNaN(p.longitude),
      );
    if (mapRef.current && allPoints.length > 0) {
      mapRef.current.fitToCoordinates(allPoints, {
        edgePadding: { top: 220, right: 60, bottom: 110, left: 60 },
        animated: true,
      });
    }
  }, []);

  const isFetchingRef = useRef(false);
  const latestRouteSelectRef = useRef<string | null>(null);
  const fetchBusData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsFetchingBus(true);
    try {
      console.log("[Transit] Fetching metadata and active routes...");
      const metadata = await transitService.getRoutesMetadata();
      const activeIds = await transitService.getActiveRoutes();

      console.log("[Transit] Metadata count:", metadata.length);
      console.log("[Transit] Active IDs:", activeIds);

      // Filter metadata to only show active routes
      // Note: Some systems use 'ShortName', others 'Name' for active IDs.
      const activeRoutes = metadata.filter(
        (m) =>
          activeIds.includes(m.ShortName) ||
          activeIds.includes(m.Key) ||
          activeIds.includes(m.Name),
      );

      // If filtering fails, show all metadata so the user has a dropdown
      const finalRoutes = activeRoutes.length > 0 ? activeRoutes : metadata;

      console.log("[Transit] Final Active Routes count:", finalRoutes.length);
      setBusRoutes(finalRoutes);

      // Check if current selection is invalid or missing
      const isSelectionActive = finalRoutes.some(
        (r) => r.Key === selectedBusRouteId,
      );
      if (
        finalRoutes.length > 0 &&
        (isAllBusRoutesSelected || !selectedBusRouteId || !isSelectionActive)
      ) {
        handleSelectBusRoute(ALL_BUS_ROUTES_KEY, finalRoutes);
      }
    } catch (e) {
      console.warn("Failed to fetch bus routes", e);
    } finally {
      setIsFetchingBus(false);
      isFetchingRef.current = false;
    }
  };

  const resolveNearestBusForStop = useCallback(
    (stop: any, vehicles: any[]) => {
      if (
        !stop ||
        stop.Latitude == null ||
        stop.Longitude == null ||
        vehicles.length === 0
      ) {
        setNearestBusInfo(
          selectedRoute ? "Route loaded" : "Transit route loaded",
        );
        return;
      }

      const stopProgress = getClosestProgressMeters(routePatterns, {
        latitude: stop.Latitude,
        longitude: stop.Longitude,
      });

      const rankedBuses = vehicles
        .filter((b) => b.Latitude != null && b.Longitude != null)
        .map((bus) => {
          const directDistanceMeters = haversineDistanceMeters(
            bus.Latitude,
            bus.Longitude,
            stop.Latitude,
            stop.Longitude,
          );

          if (!stopProgress) {
            return {
              bus,
              distanceMeters: directDistanceMeters,
            };
          }

          const busProgress = getClosestProgressMeters(routePatterns, {
            latitude: bus.Latitude,
            longitude: bus.Longitude,
          });

          if (!busProgress) {
            return {
              bus,
              distanceMeters: directDistanceMeters,
            };
          }

          const routeDelta = Math.abs(
            stopProgress.progressMeters - busProgress.progressMeters,
          );
          const wrappedDelta =
            stopProgress.totalRouteMeters > 0
              ? Math.min(routeDelta, stopProgress.totalRouteMeters - routeDelta)
              : routeDelta;

          return {
            bus,
            distanceMeters: Math.min(
              directDistanceMeters,
              wrappedDelta +
                stopProgress.offsetMeters +
                busProgress.offsetMeters,
            ),
          };
        })
        .sort((first, second) => first.distanceMeters - second.distanceMeters);

      const nearestBus = rankedBuses[0];
      if (!nearestBus) {
        setNearestBusInfo(
          selectedRoute ? "Route loaded" : "Transit route loaded",
        );
        return;
      }

      const etaMinutes = Math.max(
        1,
        Math.round(nearestBus.distanceMeters / 220),
      );
      const busLabel = nearestBus.bus.RouteShortName
        ? `Route ${nearestBus.bus.RouteShortName}`
        : nearestBus.bus.Name
          ? `Bus ${nearestBus.bus.Name}`
          : undefined;
      setNearestBusInfo(
        formatBusDistance(nearestBus.distanceMeters, etaMinutes, busLabel),
      );
    },
    [routePatterns, selectedRoute],
  );

  const handleStopPress = (stop: any, fromTimetable = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedStop(stop);
    setSelectedBus(null);
    if (!fromTimetable) {
      setShowBusTimetableSheet(false);
    }
    setNearestBusInfo("Finding closest bus...");
    // Run intensive closest-bus calculation asynchronously to not block the UI selection frame
    requestAnimationFrame(() => {
      resolveNearestBusForStop(stop, busVehicles);
    });
  };

  const handleSelectBusRoute = useCallback(
    async (routeId: string, availableRoutes: any[] = busRoutes) => {
      console.log("[Transit] Selecting route:", routeId);
      latestRouteSelectRef.current = routeId;

      // Clear vehicles FIRST — before changing the route ID.
      // This prevents any intermediate render where isAllBusRoutesSelected
      // flips to false while busVehicles still has every route's vehicles.
      if (routeId !== ALL_BUS_ROUTES_KEY) {
        setBusVehicles([]);
        setBusStops([]);
        setRoutePatterns([]);
      }

      setSelectedBusRouteId(routeId);
      setSelectedStop(null);
      setSelectedBus(null);

      if (routeId === ALL_BUS_ROUTES_KEY) {
        setRoutePatterns([]);
        await loadAllBusRoutes(availableRoutes);
        return;
      }

      try {
        const { points, stops } = await transitService.getRoutePattern(routeId);
        if (latestRouteSelectRef.current !== routeId) return;

        if (points && points.length > 0) {
          console.log("[Transit] Route trace points found:", points.length);
          setRoutePatterns(points);
        } else {
          console.warn("[Transit] No route trace found for:", routeId);
          setRoutePatterns([]);
        }

        if (stops && stops.length > 0) {
          console.log("[Transit] Stops found:", stops.length);
          setBusStops(stops);
        } else {
          console.warn("[Transit] No stops found for:", routeId);
          setBusStops([]);
        }

        const validPoints = (points || []).filter(
          (p: any) =>
            p &&
            p.latitude != null &&
            p.longitude != null &&
            !isNaN(p.latitude) &&
            !isNaN(p.longitude),
        );

        if (mapRef.current && validPoints.length > 0) {
          mapRef.current.fitToCoordinates(validPoints, {
            edgePadding: { top: 220, right: 60, bottom: 80, left: 60 },
            animated: true,
          });
        }

        const vehicles = await transitService.getVehicles(routeId);
        if (latestRouteSelectRef.current !== routeId) return;

        console.log(
          `[Transit] Found ${vehicles.length} vehicles for route ${routeId}`,
        );
        if (vehicles.length > 0) {
          console.log(
            "[Transit] Sample vehicle coords:",
            vehicles[0].Latitude,
            vehicles[0].Longitude,
          );
        }
        setBusVehicles(vehicles);
      } catch (e) {
        console.warn("Failed to select bus route", e);
      }
    },
    [busRoutes, loadAllBusRoutes],
  );

  // Poll for bus locations
  useEffect(() => {
    let isCancelled = false;

    if (activeLayer === "Bus" && selectedBusRouteId) {
      busPollInterval.current = setInterval(async () => {
        try {
          // Capture the exact route ID we are fetching for
          // so if the user switches routes mid-fetch, we can discard the result
          const pollRouteId = isAllBusRoutesSelected
            ? null
            : selectedBusRouteId;

          const updated = isAllBusRoutesSelected
            ? await transitService.getVehicles()
            : await transitService.getVehicles(selectedBusRouteId);

          // Only update if the poll returned actual data
          // AND the component hasn't unmounted or dependencies haven't changed
          if (!isCancelled && updated && updated.length > 0) {
            setBusVehicles(updated);
          }
        } catch (e) {
          // Silently ignore poll failures to keep existing markers visible
        }
      }, 5000);
    } else {
      if (busPollInterval.current) clearInterval(busPollInterval.current);
    }
    return () => {
      isCancelled = true;
      if (busPollInterval.current) clearInterval(busPollInterval.current);
    };
  }, [activeLayer, isAllBusRoutesSelected, selectedBusRouteId]);

  useEffect(() => {
    if (activeLayer === "Bus") {
      fetchBusData();
    }
  }, [activeLayer]);

  useEffect(() => {
    if (activeLayer === "Bus" && selectedStop) {
      resolveNearestBusForStop(selectedStop, busVehicles);
    }
  }, [
    activeLayer,
    busVehicles,
    routePatterns,
    selectedStop,
    resolveNearestBusForStop,
  ]);

  useEffect(() => {
    if (activeLayer === "Bus" && selectedBus) {
      const updatedBus = busVehicles.find((b) => b.Key === selectedBus.Key);
      if (updatedBus && updatedBus !== selectedBus) {
        setSelectedBus(updatedBus);
      }
    }
  }, [activeLayer, busVehicles, selectedBus]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
        onPanResponderGrant: () => {
          panStartY.current = sheetSnap.current;
          sheetY.stopAnimation();
        },
        onPanResponderMove: (_, { dy }) => {
          // Allow dragging between FULL and beyond PEEK (for dismiss momentum)
          const next = Math.max(SNAP_FULL, panStartY.current + dy);
          sheetY.setValue(next);
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          const liveY = panStartY.current + dy;

          // Fast flick determines intent
          if (vy > 1.0) {
            // Flick down
            if (sheetSnap.current < SNAP_PEEK - 20) {
              // Was at FULL → snap back to PEEK
              animateSheet(SNAP_PEEK);
            } else {
              // Was at PEEK → dismiss
              animateSheet(SNAP_HIDDEN, () => {
                setSelectedId(null);
                setShowBusTimetableSheet(false);
              });
            }
            return;
          }
          if (vy < -1.0) {
            // Flick up → go full
            animateSheet(SNAP_FULL);
            return;
          }

          // Slow drag: snap to nearest
          const midPeekFull = (SNAP_PEEK + SNAP_FULL) / 2;
          const midPeekHidden = (SNAP_PEEK + SNAP_HIDDEN) / 2;

          if (liveY > midPeekHidden) {
            // Below mid-hidden → dismiss
            animateSheet(SNAP_HIDDEN, () => {
              setSelectedId(null);
              setShowBusTimetableSheet(false);
            });
          } else if (liveY > midPeekFull) {
            // Between hidden and full mid → peek
            animateSheet(SNAP_PEEK);
          } else {
            // Above peek/full mid → full
            animateSheet(SNAP_FULL);
          }
        },
      }),
    [animateSheet],
  );
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/traffic/retrieve`);
      let fetched = res.data.filter((d: any) => d.coord);

      // Ensure Hubs are present even if traffic data misses them
      const hubs = [
        {
          location: "Memorial Student Center",
          type: "Hub",
          coord: getCanonicalCoords("Memorial Student Center", {
            lat: 30.6123,
            lng: -96.3415,
          }),
          percent_full: 45,
          is_live: false,
          hours: "7:00 AM – 10:00 PM",
        },
        {
          location: "Polo Road Garage Dining",
          type: "Hub",
          coord: getCanonicalCoords("Polo Road Garage Dining", {
            lat: 30.6235,
            lng: -96.3388,
          }),
          percent_full: 30,
          is_live: false,
          hours: "7:00 AM – 9:00 PM",
        },
        {
          location: "Sbisa Dining Hall",
          type: "Dining",
          coord: getCanonicalCoords("Sbisa Dining Hall", {
            lat: 30.617135,
            lng: -96.343777,
          }),
          percent_full: 60,
          is_live: false,
          hours: "10:00 AM – 8:00 PM",
        },
      ];

      const combined = [...fetched];
      hubs.forEach((h) => {
        if (
          !combined.find(
            (c) =>
              c.location.includes(h.location) ||
              h.location.includes(c.location),
          )
        ) {
          combined.push(h);
        }
      });

      // Merge high-fidelity hours/data from CAMPUS_ZONES
      const trafficLocations = combined.map((loc: any) => {
        const canonicalName = getCanonicalLocationName(loc.location);
        const zone = CAMPUS_ZONES.find((z) => z.name === canonicalName);
        const resolvedCoord = getCanonicalCoords(canonicalName, loc.coord);
        if (zone && zone.hours) {
          return {
            ...loc,
            location: canonicalName,
            coord: resolvedCoord,
            hours: zone.hours,
            source: "traffic" as const,
          };
        }
        return {
          ...loc,
          location: canonicalName,
          coord: resolvedCoord,
          source: "traffic" as const,
        };
      });
      const mergedMap = new Map<string, CampusLocation>();
      fullCampusIndex.forEach((location) =>
        mergedMap.set(location.location, location),
      );
      trafficLocations.forEach((location: CampusLocation) => {
        const canonicalName = getCanonicalLocationName(location.location);
        const existing =
          mergedMap.get(canonicalName) || mergedMap.get(location.location);

        if (
          location.location !== canonicalName &&
          mergedMap.has(location.location)
        ) {
          mergedMap.delete(location.location);
        }

        mergedMap.set(canonicalName, {
          ...existing,
          ...location,
          location: canonicalName,
          coord: getCanonicalCoords(canonicalName, location.coord),
          type: existing?.type || location.type || "General",
          shortName: existing?.shortName || location.shortName,
          description: existing?.description || location.description,
        });
      });
      setLocations(Array.from(mergedMap.values()));
    } catch (err) {
      console.warn("Failed to fetch traffic data", err);
      setLocations(fullCampusIndex);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    if (activeLayer === "Heatmap") return [];
    if (activeLayer === "Dining")
      return locations.filter(
        (loc) => loc.type === "Dining" || loc.type === "Hub",
      );
    if (activeLayer === "Academic") {
      return locations.filter(
        (loc) => loc.type === "Academic" || loc.type === "Landmark",
      );
    }
    if (activeLayer === "Study") {
      return locations.filter(
        (loc) => loc.type === "Study" || loc.type === "Library",
      );
    }
    return locations.filter((loc) => loc.type === activeLayer);
  }, [locations, activeLayer]);

  const sortedFilteredLocations = useMemo(() => {
    return [...filteredLocations].sort((left, right) => {
      const leftDistance = userCoord
        ? haversineDistanceMeters(
            userCoord.latitude,
            userCoord.longitude,
            left.coord.lat,
            left.coord.lng,
          )
        : null;
      const rightDistance = userCoord
        ? haversineDistanceMeters(
            userCoord.latitude,
            userCoord.longitude,
            right.coord.lat,
            right.coord.lng,
          )
        : null;

      if (activeLayer === "Parking") {
        const leftParking = getParkingRecommendation(
          left.location,
          parkingPermit,
        );
        const rightParking = getParkingRecommendation(
          right.location,
          parkingPermit,
        );
        if (leftParking.score !== rightParking.score) {
          return leftParking.score - rightParking.score;
        }
      }

      if (
        leftDistance != null &&
        rightDistance != null &&
        leftDistance !== rightDistance
      ) {
        return leftDistance - rightDistance;
      }

      return left.location.localeCompare(right.location);
    });
  }, [activeLayer, filteredLocations, parkingPermit, userCoord]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return locations
      .filter(
        (loc) =>
          loc.location.toLowerCase().includes(query) ||
          (loc.shortName || "").toLowerCase().includes(query) ||
          (loc.description || "").toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const aDistance = userCoord
          ? haversineDistanceMeters(
              userCoord.latitude,
              userCoord.longitude,
              a.coord.lat,
              a.coord.lng,
            )
          : null;
        const bDistance = userCoord
          ? haversineDistanceMeters(
              userCoord.latitude,
              userCoord.longitude,
              b.coord.lat,
              b.coord.lng,
            )
          : null;
        const aStarts = a.location.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.location.toLowerCase().startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) {
          return aStarts - bStarts;
        }
        if (aDistance != null && bDistance != null && aDistance !== bDistance) {
          return aDistance - bDistance;
        }
        return a.location.localeCompare(b.location);
      })
      .slice(0, 8);
  }, [locations, searchQuery, userCoord]);

  const selectedLoc = useMemo(
    () => locations.find((l) => l.location === selectedId),
    [locations, selectedId],
  );

  useEffect(() => {
    if (
      !mapRef.current ||
      activeLayer === "Bus" ||
      activeLayer === "Heatmap" ||
      placesViewMode !== "map" ||
      selectedId ||
      sortedFilteredLocations.length === 0
    ) {
      return;
    }

    const fitKey = `${activeLayer}:${sortedFilteredLocations.length}:${sortedFilteredLocations[0]?.location || ""}`;
    if (lastPlacesFitKey.current === fitKey) {
      return;
    }
    lastPlacesFitKey.current = fitKey;

    const points = sortedFilteredLocations
      .slice(0, Math.min(sortedFilteredLocations.length, 18))
      .map((loc) => ({
        latitude: loc.coord.lat,
        longitude: loc.coord.lng,
      }))
      .filter(
        (p) =>
          p &&
          p.latitude != null &&
          p.longitude != null &&
          !isNaN(p.latitude) &&
          !isNaN(p.longitude),
      );

    if (points.length === 0) return;

    if (points.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: points[0].latitude - 0.0018,
          longitude: points[0].longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        650,
      );
      return;
    }

    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 210, right: 48, bottom: 250, left: 48 },
      animated: true,
    });
  }, [activeLayer, placesViewMode, selectedId, sortedFilteredLocations]);
  const selectedRecreationFacility = useMemo(() => {
    if (!selectedLoc) return null;
    return (
      recreationFacilityMap.get(
        getCanonicalLocationName(selectedLoc.location),
      ) || null
    );
  }, [recreationFacilityMap, selectedLoc]);

  const getPlaceExternalLink = useCallback(
    (location: CampusLocation) => {
      const recreationFacility =
        recreationFacilityMap.get(
          getCanonicalLocationName(location.location),
        ) || null;

      if (recreationFacility?.source_url) {
        return {
          label: "Open Official Page",
          url: recreationFacility.source_url,
        };
      }

      if (location.type === "Dining" || location.type === "Hub") {
        return {
          label: "Dining Site",
          url: "https://dineoncampus.com/tamu",
        };
      }

      if (location.type === "Library" || location.type === "Study") {
        return {
          label: "Library Site",
          url: "https://library.tamu.edu/",
        };
      }

      if (location.type === "Parking") {
        return {
          label: "Parking Guide",
          url: PARKING_INFO_URL,
        };
      }

      const query = encodeURIComponent(
        `${location.location} Texas A&M University`,
      );
      return {
        label: "Open in Maps",
        url: `https://www.google.com/maps/search/?api=1&query=${query}`,
      };
    },
    [recreationFacilityMap],
  );

  useEffect(() => {
    if (
      !selectedLoc ||
      (selectedLoc.type !== "Dining" && selectedLoc.type !== "Hub")
    ) {
      setHubRestaurants([]);
      setDiningMenuOptions([]);
      setActiveDiningMenu(null);
      setDiningMenuPreview(null);
      return;
    }
    fetchDiningData(selectedLoc);
  }, [selectedLoc]);

  useEffect(() => {
    if (!activeDiningMenu) {
      return;
    }

    let cancelled = false;
    setIsFetchingDining(true);
    fetchDiningFullMenuCached({
      location: activeDiningMenu,
      mealPeriod: getDiningMealPeriodForLocation(activeDiningMenu),
    })
      .then((menuPreview) => {
        if (!cancelled) {
          setDiningMenuPreview(menuPreview);
        }
      })
      .catch((error) =>
        console.warn("Failed to load dining menu preview", error),
      )
      .finally(() => {
        if (!cancelled) {
          setIsFetchingDining(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeDiningMenu]);

  const openFullMenu = useCallback(
    (locationName: string) => {
      const rootNavigation =
        navigation.getParent?.("RootStack") || navigation.getParent?.();
      const targetMeal = getDiningMealPeriodForLocation(locationName);
      const params = {
        location: locationName,
        mealPeriod: targetMeal,
        title: `${locationName} Menu`,
        sourceHint: "cached",
      };

      if (rootNavigation?.navigate) {
        rootNavigation.navigate("FullMenu", params);
        return;
      }

      navigation.navigate("FullMenu", params);
    },
    [navigation],
  );

  const openBusTimetable = useCallback(() => {
    setSelectedStop(null);
    setSelectedBus(null);
    setSelectedId(null);
    setShowBusTimetableSheet(true);
  }, []);

  const openTripPlanner = useCallback(() => {
    const rootNavigation =
      navigation.getParent?.("RootStack") || navigation.getParent?.();
    const params = {
      preferredRouteKey: isAllBusRoutesSelected
        ? null
        : selectedRoute?.Key || null,
      preferredRouteName: isAllBusRoutesSelected
        ? "Best available route"
        : selectedRoute?.Name || selectedRoute?.ShortName || "Selected route",
    };

    if (rootNavigation?.navigate) {
      rootNavigation.navigate("TransitTripPlanner", params);
      return;
    }

    navigation.navigate("TransitTripPlanner", params);
  }, [isAllBusRoutesSelected, navigation, selectedRoute]);

  const handleSelectLocation = useCallback((loc: CampusLocation) => {
    Keyboard.dismiss();
    setSelectedId(loc.location);
    setSearchQuery("");
    setShowSearchResults(false);
    setIsSearchExpanded(false);
    setSelectedStop(null);
    setSelectedBus(null);
    setNearestBusInfo(null);
    setIsRouteDropdownOpen(false);
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: loc.coord.lat - 0.0022,
          longitude: loc.coord.lng,
          latitudeDelta: 0.0085,
          longitudeDelta: 0.0085,
        },
        800,
      );
    }
  }, []);

  const handlePostReview = async () => {
    if (!user || !selectedId || !newReviewText.trim()) return;
    setIsPostingReview(true);
    try {
      const { addPlaceReview } = require("../services/streamFeeds");
      await addPlaceReview({
        userId: user.id,
        userName: user.fullName || user.username || "Aggie",
        userImage: user.imageUrl,
        placeId: selectedId,
        rating: newRating,
        text: newReviewText.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReviewModalVisible(false);
      setNewReviewText("");
      setNewRating(5);
      fetchReviews(selectedId);
    } catch (e) {
      console.warn("Failed to post review", e);
    } finally {
      setIsPostingReview(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loaderText}>Mapping campus traffic...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={TAMU_CENTER}
        showsUserLocation={true}
        showsPointsOfInterest={activeLayer === "Heatmap" ? false : true}
        showsBuildings={activeLayer === "Heatmap" ? false : true}
        showsTraffic={false}
        customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
        onPress={() => {
          Keyboard.dismiss();
          setSelectedId(null);
          setShowBusTimetableSheet(false);
          setShowSearchResults(false);
          if (isSearchExpanded) {
            LayoutAnimation.configureNext({
              duration: 250,
              create: { type: "easeInEaseOut", property: "opacity" },
              update: {
                type: "spring",
                springDamping: 0.9,
                initialVelocity: 0.5,
              },
              delete: { type: "easeOut", property: "opacity" },
            });
            setIsSearchExpanded(false);
            setSearchQuery("");
          }
        }}
        onMarkerPress={(e) => {
          const id = e.nativeEvent.id;
          if (id) setSelectedId(id);
        }}
      >
        {/* AI-estimated campus-wide density zones */}
        {activeLayer === "Heatmap" &&
          CAMPUS_ZONES.map((zone, i) => {
            const density = getZoneDensity(zone);
            const color = getStatusColor(density);
            return (
              <Circle
                key={`zone-${i}`}
                center={{ latitude: zone.lat, longitude: zone.lng }}
                radius={zone.radius}
                fillColor={color + "2E"}
                strokeColor={color + "80"}
                strokeWidth={2}
              />
            );
          })}

        {/* Transit Layer: Route Polyline */}
        {activeLayer === "Bus" && userCoord ? (
          <Marker
            coordinate={userCoord}
            title="You are here"
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={260}
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationInner} />
            </View>
          </Marker>
        ) : null}

        {activeLayer === "Bus"
          ? isAllBusRoutesSelected
            ? busRoutes.map((route) => {
                const routePattern =
                  allRoutePatternsById[route.Key]?.points || [];
                if (!routePattern.length) return null;
                return (
                  <Polyline
                    key={`all-route-${route.Key}`}
                    coordinates={routePattern}
                    strokeColor={
                      route.Color || transitService.getRouteColor(route.Key)
                    }
                    strokeWidth={2}
                    lineDashPattern={[0]}
                  />
                );
              })
            : routePatterns.length > 0 && (
                <>
                  <Polyline
                    key={`base-path-${selectedBusRouteId}`}
                    coordinates={routePatterns}
                    strokeColor={
                      (selectedRoute?.Color ||
                        transitService.getRouteColor(
                          selectedBusRouteId || "",
                        )) + "50"
                    }
                    strokeWidth={4}
                    lineDashPattern={[0]}
                    zIndex={10}
                  />
                  {selectedDirection !== "All" && (
                    <Polyline
                      key={`active-path-${selectedBusRouteId}-${selectedDirection}`}
                      coordinates={routePatterns.filter(
                        (p: any) =>
                          "DirectionName" in p &&
                          p.DirectionName === selectedDirection,
                      )}
                      strokeColor={
                        selectedRoute?.Color ||
                        transitService.getRouteColor(selectedBusRouteId || "")
                      }
                      strokeWidth={4}
                      lineDashPattern={[0]}
                      zIndex={20}
                    />
                  )}
                  {selectedDirection === "All" && (
                    <Polyline
                      key={`all-path-${selectedBusRouteId}`}
                      coordinates={routePatterns}
                      strokeColor={
                        selectedRoute?.Color ||
                        transitService.getRouteColor(selectedBusRouteId || "")
                      }
                      strokeWidth={4}
                      lineDashPattern={[0]}
                      zIndex={20}
                    />
                  )}
                </>
              )
          : null}

        {/* Transit Layer: Bus Stops (MaroonRides Style: Blue Pins) */}
        {activeLayer === "Bus" &&
          !isAllBusRoutesSelected &&
          busStops
            .filter((s) => s.Latitude != null && s.Longitude != null)
            .map((stop, idx) => {
              const isActiveDir =
                selectedDirection === "All" ||
                stop.DirectionName === selectedDirection;

              // Render regular unselected stops
              return (
                <Marker
                  key={`stop-${selectedBusRouteId}-${stop.StopCode || idx}-${isActiveDir}`}
                  coordinate={{
                    latitude: stop.Latitude,
                    longitude: stop.Longitude,
                  }}
                  onPress={() => handleStopPress(stop)}
                  zIndex={isActiveDir ? 100 : 50}
                  tracksViewChanges={false}
                >
                  <View
                    style={[
                      styles.busStopPin,
                      !isActiveDir && { opacity: 0.25 },
                    ]}
                  >
                    <MapPin size={12} color="#FFF" />
                  </View>
                </Marker>
              );
            })}

        {/* Selected Bus Stop Overlay (Prevents disappearing unselected markers) */}
        {activeLayer === "Bus" &&
          !isAllBusRoutesSelected &&
          selectedStop &&
          selectedStop.Latitude != null &&
          !isNaN(selectedStop.Latitude) &&
          !isNaN(selectedStop.Longitude) && (
            <Marker
              key={`selected-stop-${selectedStop.StopCode}`}
              coordinate={{
                latitude: selectedStop.Latitude,
                longitude: selectedStop.Longitude,
              }}
              zIndex={200}
              onPress={() => setSelectedStop(null)}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.busStopPin,
                  {
                    transform: [{ scale: 1.25 }],
                    backgroundColor: "#005bb5",
                    borderColor: "#FFD700",
                    borderWidth: 2,
                  },
                ]}
              >
                <MapPin size={12} color="#FFF" />
              </View>
            </Marker>
          )}

        {/* Transit Layer: Bus Vehicles (MaroonRides Style: Bus Icons) */}
        {activeLayer === "Bus" &&
          !isAllBusRoutesSelected &&
          busStops.length > 0 &&
          busVehicles
            .filter((b) => b.Latitude != null && b.Longitude != null)
            .map((bus) => {
              const isActiveDir =
                selectedDirection === "All" ||
                bus.DirectionName === selectedDirection;
              return (
                <Marker
                  key={`bus-${bus.Key}-${isActiveDir}-${bus.Heading || 0}`}
                  coordinate={{
                    latitude: bus.Latitude,
                    longitude: bus.Longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={isActiveDir ? 200 : 150}
                  flat={true}
                  tracksViewChanges={false}
                  opacity={isActiveDir ? 1 : 0.25}
                  onPress={() => {
                    const now = Date.now();
                    if (now - lastBusTapRef.current < 250) return;
                    lastBusTapRef.current = now;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                    requestAnimationFrame(() => {
                      if (
                        selectedDirection !== "All" &&
                        bus.DirectionName &&
                        bus.DirectionName !== selectedDirection
                      ) {
                        setSelectedDirection(bus.DirectionName);
                      }
                      setSelectedBus(bus);
                      setSelectedStop(null);
                    });
                  }}
                >
                  <View
                    style={[
                      styles.busMarker,
                      {
                        backgroundColor: "#FFFFFF",
                        borderColor:
                          bus.RouteColor || selectedRoute?.Color || "#500000",
                        borderWidth: 2,
                        // Make it a teardrop shape pointing Top-Right (45 degrees)
                        borderTopRightRadius: 0,
                        // Rotate the teardrop so its tip points in the bus's heading direction
                        transform: [
                          { rotate: `${(bus.Heading || 0) - 45}deg` },
                        ],
                      },
                    ]}
                  >
                    <View
                      // Counter-rotate the inner icon so the bus stays upright
                      style={{
                        transform: [
                          { rotate: `${-((bus.Heading || 0) - 45)}deg` },
                        ],
                      }}
                    >
                      <Bus
                        size={16}
                        color={
                          bus.RouteColor || selectedRoute?.Color || "#500000"
                        }
                      />
                    </View>
                  </View>
                </Marker>
              );
            })}

        {/* Highlight ring for the selected/tracked bus */}
        {activeLayer === "Bus" &&
          !isAllBusRoutesSelected &&
          selectedBus &&
          selectedBus.Latitude != null &&
          !isNaN(selectedBus.Latitude) &&
          !isNaN(selectedBus.Longitude) && (
            <Marker
              key={`tracked-bus-highlight-${selectedBus.Key}-${selectedBus.Heading || 0}`}
              coordinate={{
                latitude: selectedBus.Latitude,
                longitude: selectedBus.Longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={240}
              flat={true}
              tracksViewChanges={false}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderTopRightRadius: 0,
                  borderWidth: 3,
                  borderColor: "#C99700",
                  backgroundColor: "transparent",
                  transform: [
                    { rotate: `${(selectedBus.Heading || 0) - 45}deg` },
                  ],
                }}
              />
            </Marker>
          )}

        {/* Marker rendering fixes: Ensure markers are always rendered for active categories */}
        {locations
          .filter((loc) => {
            if (activeLayer === "Heatmap" || activeLayer === "Bus")
              return loc.location === selectedId;
            const isDiningTab = activeLayer === "Dining";
            const isAcademicTab = activeLayer === "Academic";
            const isStudyTab = activeLayer === "Study";
            return (
              loc.location === selectedId ||
              loc.type === activeLayer ||
              (isDiningTab && loc.type === "Hub") ||
              (isAcademicTab && loc.type === "Landmark") ||
              (isStudyTab && loc.type === "Library")
            );
          })
          .map((loc) => {
            const isSelected = selectedId === loc.location;
            const catIcon = getCategoryIcon(loc.type);
            return (
              <Marker
                key={`marker-${loc.location}-${isSelected ? "selected" : "unselected"}`}
                identifier={loc.location}
                coordinate={{
                  latitude: loc.coord.lat,
                  longitude: loc.coord.lng,
                }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 1 }}
                zIndex={isSelected ? 100 : 1}
                onPress={() => setSelectedId(loc.location)}
              >
                <View style={styles.pinContainer} pointerEvents="none">
                  <View
                    style={[
                      styles.pinHead,
                      { backgroundColor: isSelected ? "#FF8A00" : "#800000" },
                    ]}
                  >
                    <View style={styles.pinInnerCircle}>
                      {React.cloneElement(catIcon as React.ReactElement<any>, {
                        size: 12,
                        color: isSelected ? "#FFF" : "#FF8A8A",
                      })}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.pinTail,
                      { borderTopColor: isSelected ? "#FF8A00" : "#800000" },
                    ]}
                  />
                </View>
              </Marker>
            );
          })}
      </MapView>

      {/* Unified Top Navigation Pill Bar */}
      <View style={styles.topContainer} pointerEvents="box-none">
        <View
          style={[
            styles.pillBar,
            isSearchExpanded && {
              backgroundColor:
                theme === "dark"
                  ? "rgba(8,8,10,0.96)"
                  : "rgba(255,255,255,0.94)",
              borderColor:
                theme === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(12,12,14,0.08)",
            },
          ]}
        >
          {isSearchExpanded ? (
            <View style={styles.searchExpanded}>
              <Search size={20} color={COLORS.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: COLORS.textPrimary }]}
                placeholder="Search any location..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setShowSearchResults(true);
                }}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  style={{ marginRight: 12 }}
                >
                  <X size={18} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setIsSearchExpanded(false);
                  setSearchQuery("");
                  setShowSearchResults(false);
                }}
              >
                <Text style={styles.cancelSearchText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.searchIconBtn}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setIsSearchExpanded(true);
                  setIsRouteDropdownOpen(false);
                }}
              >
                <Search size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
              <View style={styles.pillDivider} />
              <View
                style={styles.pillTabsContainer}
                onLayout={(event) =>
                  setCategoryTrackWidth(event.nativeEvent.layout.width)
                }
              >
                <Animated.View
                  style={[
                    styles.pillIndicator,
                    {
                      width: Math.max(categorySlotWidth - 4, 0),
                      transform: [{ translateX: categoryIndicatorTranslateX }],
                    },
                  ]}
                />
                {topBarItems.map((category) => {
                  const isSettings = Boolean((category as any).isSettings);
                  const isActive = !isSettings && category.id === activeLayer;
                  const Icon = isSettings
                    ? Cog
                    : getCategoryPillIcon(category.id);

                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.pillTab}
                      onPress={() => {
                        if (isSettings) {
                          setIsEditorVisible(true);
                          return;
                        }
                        setActiveLayer(category.id);
                        setSelectedId(null);
                      }}
                    >
                      <Icon
                        size={18}
                        color={isActive ? "#FFFFFF" : COLORS.textTertiary}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      {isActive ? (
                        <Text
                          style={[
                            styles.pillLabel,
                            isActive
                              ? styles.pillLabelActive
                              : styles.pillLabelInactive,
                          ]}
                          numberOfLines={1}
                        >
                          {category.label}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {isSearchExpanded && showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((loc) => (
              <TouchableOpacity
                key={loc.location}
                style={styles.searchItem}
                onPress={() => handleSelectLocation(loc)}
              >
                <MapPin size={15} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.searchItemName,
                      { color: COLORS.textPrimary },
                    ]}
                  >
                    {loc.location}
                  </Text>
                  <Text style={styles.searchItemSub}>
                    {loc.shortName && loc.shortName !== loc.location
                      ? `${loc.shortName} • `
                      : ""}
                    {loc.type}
                  </Text>
                </View>
                <ChevronRight size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeLayer !== "Bus" && activeLayer !== "Heatmap" && (
          <View style={styles.viewModeBar}>
            <View style={styles.viewModeToggle}>
              {(["map", "list"] as string[]).map((mode) => {
                const selected = placesViewMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.viewModeButton,
                      selected && styles.viewModeButtonActive,
                    ]}
                    onPress={() => setPlacesViewMode(mode as "map" | "list")}
                  >
                    <Text
                      style={[
                        styles.viewModeButtonText,
                        selected && styles.viewModeButtonTextActive,
                      ]}
                    >
                      {mode === "map" ? "Map" : "List"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.resultCountChip}>
              <Text style={styles.resultCountText}>
                {sortedFilteredLocations.length} places
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bus Route Selector Overlay - Independent and Left Aligned */}
      {activeLayer === "Bus" && busRoutes.length > 0 && (
        <View style={styles.busRouteSelectorOuter} pointerEvents="box-none">
          <View style={styles.busRouteSelectorRow}>
            <TouchableOpacity
              style={styles.busRouteDropdownTrigger}
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut,
                );
                setIsRouteDropdownOpen(!isRouteDropdownOpen);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View
                style={[
                  styles.selectedRouteBadge,
                  isAllBusRoutesSelected && styles.selectedRouteBadgeMuted,
                ]}
              >
                <View
                  style={{
                    minWidth: 32,
                    paddingHorizontal: 4,
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.selectedRouteNumber} numberOfLines={1}>
                    {isAllBusRoutesSelected
                      ? "ALL"
                      : busRoutes.find((r) => r.Key === selectedBusRouteId)
                          ?.ShortName || "??"}
                  </Text>
                </View>
              </View>
              <View style={styles.selectedRouteTextStack}>
                <Text style={styles.labelSubText}>Current Route</Text>
                <Text style={styles.selectedRouteName} numberOfLines={1}>
                  {isAllBusRoutesSelected
                    ? "Show All Routes"
                    : busRoutes.find((r) => r.Key === selectedBusRouteId)
                        ?.Name || "Select Route"}
                </Text>
              </View>
              <View style={styles.chevronIcon}>
                <ChevronDown
                  size={16}
                  color={COLORS.textTertiary}
                  style={
                    isRouteDropdownOpen && { transform: [{ rotate: "180deg" }] }
                  }
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.busTimetableButton}
              onPress={openBusTimetable}
              activeOpacity={0.85}
            >
              <Clock size={16} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {!isAllBusRoutesSelected && routeDirectionsAvailable.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 2, marginBottom: 4 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
            >
              {routeDirectionsAvailable.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setSelectedDirection(d)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 16,
                    borderRadius: 16,
                    backgroundColor:
                      selectedDirection === d
                        ? "#500000"
                        : isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.05)",
                  }}
                >
                  <Text
                    style={{
                      color:
                        selectedDirection === d
                          ? "#FFF"
                          : isDark
                            ? "#FFF"
                            : "#000",
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.planTripButton}
            onPress={openTripPlanner}
            activeOpacity={0.88}
          >
            <View style={styles.planTripIconWrap}>
              <Navigation size={16} color="#FFFFFF" />
            </View>
            <View style={styles.planTripTextStack}>
              <Text style={styles.planTripLabel}>Plan a Trip</Text>
              <Text style={styles.planTripMeta} numberOfLines={1}>
                Start, destination, time, and routing preferences
              </Text>
            </View>
            <ChevronRight size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {isRouteDropdownOpen && (
            <View style={styles.busRoutesDropdown}>
              <View style={styles.routeSearchRow}>
                <Search size={15} color={COLORS.textTertiary} />
                <TextInput
                  value={routeSearchQuery}
                  onChangeText={setRouteSearchQuery}
                  placeholder="Search route or number"
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.routeSearchInput}
                />
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.busDropdownScroll}
                nestedScrollEnabled={true}
              >
                {filteredBusRoutes.length === 0 ? (
                  <View style={styles.emptyRouteSearchState}>
                    <Text style={styles.emptyRouteSearchTitle}>
                      No routes match that search.
                    </Text>
                    <Text style={styles.emptyRouteSearchBody}>
                      Try a route number like 01 or a route name keyword.
                    </Text>
                  </View>
                ) : (
                  filteredBusRoutes.map((route) => {
                    const isSelected = selectedBusRouteId === route.Key;
                    return (
                      <TouchableOpacity
                        key={route.Key}
                        style={[
                          styles.busRouteItem,
                          isSelected && styles.busRouteItemActive,
                        ]}
                        onPress={() => {
                          handleSelectBusRoute(route.Key);
                          setIsRouteDropdownOpen(false);
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Medium,
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.routeItemBadge,
                            isSelected
                              ? styles.routeItemBadgeActive
                              : styles.routeItemBadgeIdle,
                          ]}
                        >
                          <Text
                            style={[
                              styles.routeItemNumber,
                              !isSelected && styles.routeItemNumberIdle,
                            ]}
                          >
                            {route.ShortName}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.routeItemName,
                            isSelected && styles.routeItemNameActive,
                          ]}
                        >
                          {route.Name}
                        </Text>
                        {isSelected && <View style={styles.activeCheckDot} />}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {placesViewMode === "list" &&
        activeLayer !== "Bus" &&
        activeLayer !== "Heatmap" && (
          <View style={styles.placesListOverlay} pointerEvents="box-none">
            <Card style={styles.placesListCard}>
              <View style={styles.placesListHeader}>
                <Text style={styles.placesListTitle}>{activeLayer} Places</Text>
                <Text style={styles.placesListSubtitle}>
                  Unified campus nodes with dining, events, parking, and room
                  actions layered in.
                </Text>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.placesListContent}
              >
                {sortedFilteredLocations.map((loc) => {
                  const distanceMeters = userCoord
                    ? haversineDistanceMeters(
                        userCoord.latitude,
                        userCoord.longitude,
                        loc.coord.lat,
                        loc.coord.lng,
                      )
                    : null;
                  const parkingRecommendation =
                    loc.type === "Parking"
                      ? getParkingRecommendation(loc.location, parkingPermit)
                      : null;
                  const recreationFacility =
                    recreationFacilityMap.get(
                      getCanonicalLocationName(loc.location),
                    ) || null;
                  return (
                    <TouchableOpacity
                      key={`list-${loc.location}`}
                      style={styles.placesListRow}
                      onPress={() => {
                        setPlacesViewMode("map");
                        handleSelectLocation(loc);
                      }}
                    >
                      <View style={styles.placesListIcon}>
                        {React.cloneElement(
                          getCategoryIcon(loc.type) as React.ReactElement<any>,
                          {
                            size: 16,
                            color: "#F3F1ED",
                          },
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.placesListRowHeader}>
                          <Text style={styles.placesListRowTitle}>
                            {loc.location}
                          </Text>
                          <Text style={styles.placesListRowDistance}>
                            {getDistanceLabel(distanceMeters)}
                          </Text>
                        </View>
                        <Text style={styles.placesListRowMeta}>
                          {loc.type === "Rec"
                            ? `Today: ${recreationFacility?.today_hours || recreationFacility?.hours_hint || loc.hours || "Check official page"}`
                            : loc.description || loc.hours || loc.type}
                        </Text>
                        {parkingRecommendation ? (
                          <Text style={styles.placesListParkingHint}>
                            {parkingRecommendation.badge} ·{" "}
                            {parkingRecommendation.detail}
                          </Text>
                        ) : null}
                      </View>
                      <ChevronRight size={16} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Card>
          </View>
        )}

      {/* Bus Stop Info Card - Docked at Bottom for Professional Look */}
      {activeLayer === "Bus" && selectedStop && (
        <View style={styles.dockedStopContainer}>
          <TouchableOpacity
            style={styles.busStopDockedCard}
            onPress={() => setSelectedStop(null)}
            activeOpacity={0.9}
          >
            <View style={styles.stopIconCircular}>
              <View style={styles.stopPulseMarker} />
              <MapPin size={20} color="#007AFF" />
            </View>
            <View style={{ flex: 1, paddingLeft: 12 }}>
              <Text style={styles.dockedStopName} numberOfLines={1}>
                {getStopLabel(selectedStop)}
              </Text>
              {selectedBus && (
                <Text style={styles.busStopHintText} numberOfLines={1}>
                  Tracking{" "}
                  {selectedBus.RouteShortName
                    ? `route ${selectedBus.RouteShortName}`
                    : `bus ${selectedBus.Name}`}
                </Text>
              )}
              <View style={styles.proximityRow}>
                <Clock
                  size={12}
                  color={COLORS.textTertiary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.dockedStopProximity}>
                  {nearestBusInfo || "Stop details loading"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeStopBtn}
              onPress={() => setSelectedStop(null)}
            >
              <X size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      {/* Bus Vehicle Info Card (MaroonRides Style) */}
      {activeLayer === "Bus" && selectedBus && (
        <TouchableOpacity
          style={styles.busVehicleInfoCard}
          onPress={() => setSelectedBus(null)}
          activeOpacity={0.9}
        >
          <View style={styles.busInfoIcon}>
            <Bus size={24} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.busInfoBadgeRow}>
              <View style={styles.busInfoBadge}>
                <Text style={styles.busInfoBadgeText}>
                  ID: {selectedBus.Name}
                </Text>
              </View>
              {selectedBus.Speed != null && (
                <View
                  style={[
                    styles.busInfoBadge,
                    { backgroundColor: isDark ? "#2C2C2E" : "#E5E5EA" },
                  ]}
                >
                  <Text
                    style={[
                      styles.busInfoBadgeText,
                      { color: isDark ? "#A1A1A6" : "#666" },
                    ]}
                  >
                    {Math.round(selectedBus.Speed * 2.23694)} mph
                  </Text>
                </View>
              )}
              {selectedBus.Capacity > 0 && (
                <View
                  style={[
                    styles.loadBadge,
                    {
                      backgroundColor:
                        selectedBus.PassengersOnboard / selectedBus.Capacity >
                        0.8
                          ? "#FF3B3020"
                          : "#32D74B20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.loadText,
                      {
                        color:
                          selectedBus.PassengersOnboard / selectedBus.Capacity >
                          0.8
                            ? "#FF3B30"
                            : "#32D74B",
                      },
                    ]}
                  >
                    {Math.round(
                      (selectedBus.PassengersOnboard / selectedBus.Capacity) *
                        100,
                    )}
                    % Full
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.busInfoRouteName}>
              Heading on Route{" "}
              {selectedBus.RouteShortName ||
                selectedRoute?.ShortName ||
                selectedBus.RouteName ||
                "Bus Route"}
            </Text>
          </View>
          <X size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      )}

      {/* ── Route Timeline Bottom Sheet ─────────────────────────────── */}
      {!isAllBusRoutesSelected &&
        activeLayer === "Bus" &&
        !selectedBus &&
        showBusTimetableSheet && (
          <Animated.View
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: sheetY }] },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.locationName}>
                  {busRoutes.find((r) => r.Key === selectedBusRouteId)?.Name ||
                    "Bus Route"}
                </Text>
                <View style={styles.sheetBadgeRow}>
                  <Text style={styles.typeTextSlim}>Route Timetable</Text>
                  <View style={styles.liveBadgeSlim}>
                    <Text style={styles.dotSeparator}>•</Text>
                    <View style={styles.livePulse} />
                    <Text style={styles.liveTextSlim}>Live ETA</Text>
                  </View>
                </View>
              </View>
            </View>

            <ScrollView
              style={{ flex: 1, marginTop: 4 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                paddingHorizontal: 16,
                paddingBottom: 60,
              }}
              nestedScrollEnabled={true}
            >
              {filteredStopTimetable.map((entry: any) => {
                const isSelected =
                  selectedStop?.StopCode === entry.stop?.StopCode;
                return (
                  <TouchableOpacity
                    key={`${entry.stop?.StopCode || entry.sequence}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: isSelected
                        ? "rgba(0, 122, 255, 0.15)"
                        : isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                      borderRadius: 14,
                      gap: 12,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? "rgba(0, 122, 255, 0.5)"
                        : isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.05)",
                    }}
                    onPress={() => {
                      handleStopPress(entry.stop, true);
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isSelected
                          ? "#007AFF"
                          : isDark
                            ? "#2C2C2E"
                            : "#E5E5EA",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: isSelected
                            ? "#FFFFFF"
                            : isDark
                              ? "#EBEBF5"
                              : "#3A3A3D",
                        }}
                      >
                        {entry.sequence}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: isSelected ? "#007AFF" : COLORS.textPrimary,
                          fontWeight: "600",
                          fontSize: 15,
                        }}
                      >
                        {entry.stop?.Name || entry.stop?.StopName || "Bus Stop"}
                      </Text>
                      <Text
                        style={{
                          color: COLORS.textTertiary,
                          fontSize: 13,
                          marginTop: 2,
                        }}
                      >
                        {entry.detail}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor:
                          entry.etaLabel === "Now" ||
                          entry.etaLabel?.includes("min")
                            ? isDark
                              ? "rgba(255,90,90,0.15)"
                              : "rgba(80,0,0,0.1)"
                            : isDark
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.05)",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color:
                            entry.etaLabel === "Now" ||
                            entry.etaLabel?.includes("min")
                              ? isDark
                                ? "#FF5A5A"
                                : "#500000"
                              : COLORS.textSecondary,
                        }}
                      >
                        {entry.etaLabel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

      {/* ── Google Maps-style Bottom Sheet ─────────────────────────────── */}
      {selectedId && activeLayer !== "Bus" && !selectedStop && !selectedBus && (
        <Animated.View
          style={[styles.bottomSheet, { transform: [{ translateY: sheetY }] }]}
          {...panResponder.panHandlers}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {selectedLoc ? (
            <>
              {/* Header — always visible at peek height */}
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.locationName}>
                    {selectedLoc.location}
                  </Text>
                  <View style={styles.sheetBadgeRow}>
                    <Text style={styles.typeTextSlim}>{selectedLoc.type}</Text>
                    {selectedLoc.is_live ? (
                      <View style={styles.liveBadgeSlim}>
                        <Text style={styles.dotSeparator}>•</Text>
                        <View style={styles.livePulse} />
                        <Text style={styles.liveTextSlim}>Live Traffic</Text>
                      </View>
                    ) : (
                      <View style={styles.aiBadgeSlim}>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Text style={styles.aiTextSlim}>Directory</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ alignItems: "center", gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedId(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.dismissBtn}
                  >
                    <X size={18} color="#888" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.circularActionBtn}
                    onPress={() =>
                      navigation.navigate("CampusNavigation", {
                        initialDestination: {
                          id: selectedLoc.location,
                          name: selectedLoc.location,
                          shortName:
                            selectedLoc.shortName || selectedLoc.location,
                          latitude: selectedLoc.coord.lat,
                          longitude: selectedLoc.coord.lng,
                          type:
                            selectedLoc.type === "Academic"
                              ? "academic"
                              : selectedLoc.type === "Library"
                                ? "library"
                                : selectedLoc.type === "Dining"
                                  ? "dining"
                                  : selectedLoc.type === "Rec"
                                    ? "recreation"
                                    : selectedLoc.type === "Housing"
                                      ? "housing"
                                      : selectedLoc.type === "Athletics"
                                        ? "athletics"
                                        : "landmark",
                        },
                      })
                    }
                  >
                    <Navigation size={20} fill="#FFF" color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {selectedLoc.description ? (
                <Text style={styles.descriptionText} numberOfLines={2}>
                  {selectedLoc.description}
                </Text>
              ) : null}

              {(() => {
                const parkingRecommendation =
                  selectedLoc.type === "Parking"
                    ? getParkingRecommendation(
                        selectedLoc.location,
                        parkingPermit,
                      )
                    : null;
                const contextLink = getLocationContextLink(selectedLoc);
                const externalLink = getPlaceExternalLink(selectedLoc);
                return (
                  <>
                    <View style={styles.quickActionRow}>
                      <TouchableOpacity
                        style={styles.quickActionPill}
                        onPress={() =>
                          Linking.openURL(externalLink.url).catch((error) => {
                            console.warn(
                              "Unable to open place external link",
                              error,
                            );
                          })
                        }
                      >
                        <ExternalLink size={14} color="#F3F1ED" />
                        <Text style={styles.quickActionText}>
                          {externalLink.label}
                        </Text>
                      </TouchableOpacity>

                      {(selectedLoc.type === "Dining" ||
                        selectedLoc.type === "Hub") &&
                      activeDiningMenu ? (
                        <TouchableOpacity
                          style={[
                            styles.quickActionPill,
                            styles.quickActionPrimary,
                          ]}
                          onPress={() => openFullMenu(activeDiningMenu)}
                        >
                          <Utensils size={14} color="#FFFFFF" />
                          <Text style={styles.quickActionPrimaryText}>
                            Open Menu
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {contextLink ? (
                        <TouchableOpacity
                          style={styles.quickActionPill}
                          onPress={() =>
                            Linking.openURL(contextLink.url).catch((error) => {
                              console.warn(
                                "Unable to open place context link",
                                error,
                              );
                            })
                          }
                        >
                          <ExternalLink size={14} color="#F3F1ED" />
                          <Text style={styles.quickActionText}>
                            {contextLink.label}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {parkingRecommendation ? (
                      <View style={styles.contextCard}>
                        <Text style={styles.contextCardTitle}>
                          {parkingRecommendation.badge}
                        </Text>
                        <Text style={styles.contextCardBody}>
                          {parkingRecommendation.detail}
                        </Text>
                      </View>
                    ) : null}

                    {selectedLoc.current_event ? (
                      <View style={styles.contextCard}>
                        <Text style={styles.contextCardTitle}>
                          Active at this place
                        </Text>
                        <Text style={styles.contextCardBody}>
                          {selectedLoc.current_event}
                        </Text>
                      </View>
                    ) : null}
                  </>
                );
              })()}

              {/* Hub Restaurants */}
              {hubRestaurants.length > 0 ? (
                <View style={styles.infoBlock}>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.sectionTitle}>Inside this Hub</Text>
                    <View style={styles.restaurantChipList}>
                      {hubRestaurants.map((r, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.restaurantChip,
                            activeDiningMenu ===
                              getDiningMenuCandidates(r)[0] &&
                              styles.restaurantChipActive,
                          ]}
                          onPress={() => {
                            const nextMenu = getDiningMenuCandidates(r)[0];
                            if (nextMenu) {
                              setActiveDiningMenu(nextMenu);
                            }
                          }}
                        >
                          <Text style={styles.restaurantChipText}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.hoursText}>
                      Tap a restaurant to preview its menu and open the full
                      cached menu instantly.
                    </Text>
                  </View>
                  <View style={styles.hoursInfo}>
                    <Clock size={12} color={COLORS.textTertiary} />
                    <Text style={styles.hoursText}>
                      {selectedLoc.hours || "Open Today · 7:00 AM – 10:00 PM"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.infoBlock}>
                  {selectedLoc.type === "Library" ||
                  selectedLoc.type === "Rec" ? (
                    <View style={styles.occupancyBlock}>
                      <View style={styles.occupancyHeaderRow}>
                        <Layers
                          size={18}
                          color={getStatusColor(selectedLoc.percent_full)}
                        />
                        <View style={{ marginLeft: 8, flex: 1 }}>
                          <Text style={styles.occupancyLiveLabel}>
                            Live Occupancy
                          </Text>
                          <Text
                            style={[
                              styles.occupancyLiveText,
                              {
                                color: getStatusColor(selectedLoc.percent_full),
                              },
                            ]}
                          >
                            {selectedLoc.percent_full}% Full
                          </Text>
                        </View>
                      </View>
                      <View style={styles.occupancyTrack}>
                        <View
                          style={[
                            styles.occupancyFill,
                            {
                              width: `${selectedLoc.percent_full}%` as any,
                              backgroundColor: getStatusColor(
                                selectedLoc.percent_full,
                              ),
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.hoursInfo}>
                        <Clock size={16} color={"#888"} />
                        <Text style={styles.hoursText}>
                          {selectedLoc.type === "Rec"
                            ? `Today: ${selectedRecreationFacility?.today_hours || selectedRecreationFacility?.hours_hint || selectedLoc.hours || "Check official facility page"}`
                            : selectedLoc.hours || "6:00 AM – 12:00 AM"}
                        </Text>
                      </View>
                      {selectedLoc.type === "Rec" &&
                      selectedRecreationFacility?.source_url ? (
                        <TouchableOpacity
                          style={styles.inlineLinkRow}
                          onPress={() =>
                            Linking.openURL(
                              selectedRecreationFacility.source_url,
                            ).catch(() => {})
                          }
                        >
                          <ExternalLink size={14} color="#F3F1ED" />
                          <Text style={styles.inlineLinkText}>
                            Open official facility page
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.hoursInfoBlock}>
                      <Clock size={16} color={"#888"} />
                      <Text style={styles.hoursText}>
                        {selectedLoc.hours || "6:00 AM – 12:00 AM"}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.sheetDivider} />

              {/* Scrollable detail content */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
                scrollEventThrottle={16}
              >
                {/* Traffic chart - Remounted for rec centers and libraries */}
                {(selectedLoc.type === "Library" ||
                  selectedLoc.type === "Rec") && (
                  <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>
                      Foot Traffic · Last 8h
                    </Text>
                    <View style={styles.chartBars}>
                      {(
                        selectedLoc.traffic_history || [
                          20, 45, 15, 60, 40, 25, 20, 50,
                        ]
                      ).map((val: number, i: number) => (
                        <View key={i} style={styles.barWrapper}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: Math.max(8, (val / 100) * 45),
                                backgroundColor: getStatusColor(val),
                              },
                            ]}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {(selectedLoc.type === "Dining" ||
                  selectedLoc.type === "Hub") && (
                  <View style={styles.infoBlock}>
                    <View style={styles.reviewsHeader}>
                      <Text style={styles.sectionTitle}>Menu Preview</Text>
                      {activeDiningMenu ? (
                        <TouchableOpacity
                          onPress={() => openFullMenu(activeDiningMenu)}
                        >
                          <Text style={styles.seeAllText}>Open full menu</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {diningMenuOptions.length > 1 ? (
                      <View style={styles.restaurantChipList}>
                        {diningMenuOptions.map((option) => (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.restaurantChip,
                              activeDiningMenu === option &&
                                styles.restaurantChipActive,
                            ]}
                            onPress={() => setActiveDiningMenu(option)}
                          >
                            <Text style={styles.restaurantChipText}>
                              {option}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}

                    {isFetchingDining ? (
                      <ActivityIndicator
                        color={COLORS.primary}
                        style={{ marginVertical: 18 }}
                      />
                    ) : diningMenuPreview?.categories?.length ? (
                      <View style={styles.menuList}>
                        {diningMenuPreview.categories
                          .flatMap((category: any) =>
                            category.items.slice(0, 2),
                          )
                          .slice(0, 6)
                          .map((item: any) => (
                            <View
                              key={`${activeDiningMenu}-${item.name}`}
                              style={styles.menuItemCard}
                            >
                              <View style={styles.menuItemDetails}>
                                <Text style={styles.menuItemName}>
                                  {item.name}
                                </Text>
                                <View style={styles.menuItemMeta}>
                                  <Clock size={12} color="#888" />
                                  <Text style={styles.menuItemCal}>
                                    {Math.round(item.calories || 0)} kcal
                                  </Text>
                                  {item.protein ? (
                                    <Text style={styles.menuItemCal}>
                                      {Math.round(item.protein)}g protein
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                              <TouchableOpacity
                                onPress={() =>
                                  openFullMenu(
                                    activeDiningMenu || selectedLoc.location,
                                  )
                                }
                              >
                                <ExternalLink
                                  size={16}
                                  color={COLORS.primary}
                                />
                              </TouchableOpacity>
                            </View>
                          ))}
                      </View>
                    ) : (
                      <View style={styles.emptyReviews}>
                        <Text style={styles.emptyReviewsText}>
                          No cached menu preview is available for this location
                          yet.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Reviews from Stream */}
                <View style={styles.reviewsHeader}>
                  <Text style={styles.sectionTitle}>Reviews</Text>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setReviewModalVisible(true)}
                    >
                      <Text style={styles.addReviewText}>+ Add Review</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setAllReviewsModalVisible(true);
                        fetchReviews(selectedId, 30);
                      }}
                    >
                      <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {streamReviews.length > 0 ? (
                  streamReviews.slice(0, 5).map((rev, i) => (
                    <View key={rev.id || i} style={styles.reviewItem}>
                      <View style={styles.reviewMeta}>
                        <View style={styles.reviewUserRow}>
                          <View style={styles.userAvatar}>
                            <Text style={styles.avatarText}>{rev.user[0]}</Text>
                          </View>
                          <Text style={styles.reviewUser}>{rev.user}</Text>
                        </View>
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={11}
                              fill={s <= rev.rating ? "#FFD700" : "transparent"}
                              color={s <= rev.rating ? "#FFD700" : "#555"}
                            />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.reviewComment} numberOfLines={3}>
                        {rev.comment}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyReviews}>
                    <Text style={styles.emptyReviewsText}>
                      No reviews found for this location.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </>
          ) : null}
        </Animated.View>
      )}

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} animationType="fade" transparent>
        <TouchableWithoutFeedback onPress={() => setReviewModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ width: "100%", alignItems: "center" }}
            >
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.reviewModalContainer}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Rate {selectedId}</Text>
                    <TouchableOpacity
                      onPress={() => setReviewModalVisible(false)}
                    >
                      <X size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          setNewRating(s);
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                        }}
                        style={styles.starTouch}
                      >
                        <Star
                          size={38}
                          fill={s <= newRating ? "#FFD700" : "transparent"}
                          color={s <= newRating ? "#FFD700" : "#333"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Sharing your experience helps other Aggies..."
                      placeholderTextColor="#555"
                      multiline
                      value={newReviewText}
                      onChangeText={setNewReviewText}
                      maxLength={500}
                    />
                    <Text style={styles.charCount}>
                      {newReviewText.length}/500
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.premiumPostBtn,
                      (!newReviewText.trim() || newRating === 0) && {
                        opacity: 0.4,
                      },
                    ]}
                    onPress={handlePostReview}
                    disabled={
                      !newReviewText.trim() ||
                      newRating === 0 ||
                      isPostingReview
                    }
                  >
                    <View style={styles.btnContent}>
                      {isPostingReview ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.premiumPostBtnText}>
                          Post Review
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* Full Reviews Modal */}
      <Modal
        visible={allReviewsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAllReviewsModalVisible(false)}
      >
        <View style={styles.fullReviewsContainer}>
          <View style={styles.fullReviewsHeader}>
            <TouchableOpacity
              onPress={() => setAllReviewsModalVisible(false)}
              style={styles.backBtn}
            >
              <ChevronRight
                size={24}
                color="#FFF"
                style={{ transform: [{ rotate: "180deg" }] }}
              />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.fullReviewsTitle}>User Reviews</Text>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "600" }}>
                {selectedId}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {isFetchingReviews ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={{ color: "#FFF", marginTop: 16, fontWeight: "600" }}>
                Loading Reviews...
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
            >
              {streamReviews.length > 0 ? (
                streamReviews.map((rev, i) => (
                  <View key={i} style={styles.reviewItem}>
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewUser}>{rev.user}</Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={11}
                            fill={s <= rev.rating ? "#FFD700" : "transparent"}
                            color={s <= rev.rating ? "#FFD700" : "#444"}
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyReviews}>
                  <Text style={styles.emptyReviewsText}>
                    No reviews found for this location.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      <PageModuleEditor
        visible={isEditorVisible}
        onClose={() => setIsEditorVisible(false)}
        title={isStandaloneTransitScreen ? "Transit" : "Places"}
        description={
          isStandaloneTransitScreen
            ? "Control which transit layers stay in the standalone bus view."
            : ""
        }
        items={orderedPlacesPills}
        onToggle={togglePlacesPill}
        onMove={movePlacesPill}
      />
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    map: { flex: 1, width: "100%" },
    loader: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: COLORS.background,
    },
    loaderText: {
      marginTop: 12,
      color: COLORS.textSecondary,
      fontWeight: "600",
    },

    // ── Unified Top Navigation ──────────────────────────────────────────────
    topContainer: {
      position: "absolute",
      top: 54,
      left: 16,
      right: 16,
      gap: 10,
      zIndex: 6000,
      elevation: 30,
    },
    pageControlFloating: {
      alignSelf: "flex-end",
    },
    pillBar: {
      flexDirection: "row",
      backgroundColor: isDark
        ? "rgba(14,14,16,0.82)"
        : "rgba(255,255,255,0.88)",
      borderRadius: 999,
      padding: 6,
      position: "relative",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      minHeight: 54,
      alignItems: "center",
      zIndex: 2,
      overflow: "visible",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 18,
      elevation: 14,
    },
    searchExpanded: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
    },
    cancelSearchText: {
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.textPrimary,
      marginLeft: 8,
    },
    pillTabsContainer: {
      flex: 1,
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      position: "relative",
    },
    searchIconBtn: {
      width: 44,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    pillDivider: {
      width: 1,
      height: 22,
      backgroundColor: COLORS.border,
      marginRight: 4,
    },
    pillIndicator: {
      position: "absolute",
      top: 2,
      bottom: 2,
      left: 0,
      backgroundColor: isDark ? "rgba(0,0,0,0.78)" : "rgba(12,12,14,0.88)",
      borderRadius: 999,
    },
    pillTab: {
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: 4,
      zIndex: 1,
    },
    pillLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: COLORS.textTertiary,
    },
    pillLabelActive: {
      color: "#FFFFFF",
    },
    pillLabelInactive: {
      color: COLORS.textTertiary,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      marginLeft: 10,
      padding: 0,
      fontWeight: "500",
    },
    searchResults: {
      position: "absolute",
      top: 64,
      left: 0,
      right: 0,
      backgroundColor: isDark
        ? "rgba(14,14,16,0.92)"
        : "rgba(255,255,255,0.94)",
      borderRadius: 28,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 20,
      zIndex: 10,
    },
    searchItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.06)",
      gap: 14,
    },
    searchItemName: { fontSize: 15, fontWeight: "600" },
    searchItemSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
    viewModeBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    viewModeToggle: {
      flexDirection: "row",
      alignItems: "center",
      padding: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      backgroundColor: isDark
        ? "rgba(14,14,16,0.86)"
        : "rgba(255,255,255,0.88)",
      flex: 1,
    },
    viewModeButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      paddingVertical: 9,
    },
    viewModeButtonActive: {
      backgroundColor: isDark ? "rgba(0,0,0,0.74)" : "rgba(12,12,14,0.88)",
    },
    viewModeButtonText: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textTertiary,
    },
    viewModeButtonTextActive: {
      color: "#FFFFFF",
    },
    resultCountChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      backgroundColor: isDark
        ? "rgba(14,14,16,0.86)"
        : "rgba(255,255,255,0.88)",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    resultCountText: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textPrimary,
    },

    // ── Pins ────────────────────────────────────────────────────────────────
    pinContainer: { alignItems: "center", justifyContent: "center" },
    pinHead: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 2,
      borderColor: "#FFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 6,
    },
    pinInnerCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    pinTail: {
      width: 0,
      height: 0,
      backgroundColor: "transparent",
      borderStyle: "solid",
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 12,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      marginTop: -3,
    },

    // ── Bottom Sheet ────────────────────────────────────────────────────────
    bottomSheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: SHEET_BOTTOM_OFFSET,
      height: SCREEN_HEIGHT * 0.85,
      backgroundColor: isDark ? "#0C0C0C" : "#FFFFFF",
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#1F1F1F" : "rgba(12,12,14,0.08)",
      paddingHorizontal: 20,
      paddingTop: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 40,
      zIndex: 7000,
      overflow: "hidden",
    },
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? "#333" : "rgba(12,12,14,0.14)",
      alignSelf: "center",
      marginBottom: 18,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
      gap: 12,
    },
    locationName: {
      fontSize: 24,
      fontWeight: "800",
      color: COLORS.textPrimary,
      lineHeight: 30,
      marginBottom: 4,
    },
    sheetBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    typeTextSlim: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    dotSeparator: {
      color: isDark ? "#555" : "rgba(12,12,14,0.32)",
      fontSize: 14,
      marginHorizontal: 2,
    },
    liveBadgeSlim: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    liveTextSlim: { color: "#32D74B", fontSize: 13, fontWeight: "700" },
    aiBadgeSlim: { flexDirection: "row", alignItems: "center", gap: 6 },
    aiTextSlim: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    livePulse: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#32D74B",
    },
    dismissBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? "#1C1C1C" : "#F3F4F7",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    descriptionText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    quickActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 14,
    },
    quickActionPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: isDark ? "#161616" : "#F6F7FA",
      borderWidth: 1,
      borderColor: isDark ? "#262626" : "rgba(12,12,14,0.08)",
    },
    quickActionPrimary: {
      backgroundColor: "#500000",
      borderColor: "#500000",
    },
    quickActionText: {
      color: isDark ? "#F3F1ED" : COLORS.textPrimary,
      fontSize: 12,
      fontWeight: "800",
    },
    quickActionPrimaryText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    contextCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? "#252525" : "rgba(12,12,14,0.08)",
      backgroundColor: isDark ? "#131313" : "#F8F9FB",
      padding: 14,
      marginBottom: 14,
    },
    contextCardTitle: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 6,
    },
    contextCardBody: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },

    occupancyBlock: {
      marginBottom: 8,
      backgroundColor: isDark ? "#161616" : "#F8F9FB",
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? "#222" : "rgba(12,12,14,0.08)",
    },
    occupancyHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    occupancyLiveLabel: {
      fontSize: 13,
      color: "#AAA",
      fontWeight: "600",
      marginBottom: 2,
    },
    occupancyLiveText: { fontSize: 16, fontWeight: "800" },
    occupancyTrack: {
      height: 6,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 16,
    },
    occupancyFill: { height: "100%", borderRadius: 3 },

    hoursInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
    hoursText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600" },
    hoursInfoBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    inlineLinkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
    },
    inlineLinkText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    metaPillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },
    metaPill: {
      backgroundColor: isDark ? "#161616" : "#F5F6F8",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? "#262626" : "rgba(12,12,14,0.08)",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    metaPillText: {
      color: isDark ? "#D6D6D6" : COLORS.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },

    sheetDivider: {
      height: 1,
      backgroundColor: isDark ? "#1C1C1C" : "rgba(12,12,14,0.08)",
      marginBottom: 16,
    },

    chartContainer: { marginBottom: 24 },
    chartTitle: {
      fontSize: 12,
      color: COLORS.textTertiary,
      fontWeight: "600",
      marginBottom: 12,
    },
    chartBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 45,
    },
    barWrapper: {
      width: 12,
      height: 45,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 4,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    barFill: { width: "100%", borderRadius: 2 },

    sectionTitle: {
      fontSize: 13,
      color: COLORS.textSecondary,
      fontWeight: "700",
      marginBottom: 12,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    reviewItem: {
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#1C1C1C" : "rgba(12,12,14,0.08)",
    },
    reviewMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    reviewUser: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
    reviewUserRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    userAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#333",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#AAA", fontSize: 10, fontWeight: "800" },
    reviewStars: { flexDirection: "row", gap: 3 },
    reviewComment: {
      fontSize: 14,
      color: COLORS.textSecondary,
      lineHeight: 20,
    },

    infoBlock: { marginBottom: 20 },
    restaurantChipList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    restaurantChip: {
      backgroundColor: isDark ? "#1A1A1A" : "#F5F6F8",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? "#333" : "rgba(12,12,14,0.08)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    restaurantChipActive: {
      borderColor: COLORS.primary,
      backgroundColor: "rgba(80,0,0,0.28)",
    },
    restaurantChipText: {
      color: isDark ? "#FFF" : COLORS.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    menuList: { marginBottom: 16, gap: 10 },
    menuItemCard: {
      backgroundColor: isDark ? "#111" : "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: isDark ? "#222" : "rgba(12,12,14,0.08)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
    },
    menuItemDetails: { flex: 1, gap: 6 },
    menuItemName: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    menuItemMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    menuItemCal: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },

    reviewsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      marginTop: 8,
    },
    seeAllText: {
      color: "#FFD700",
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    addReviewText: {
      color: "#32D74B",
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    emptyReviews: { paddingVertical: 30, alignItems: "center" },
    emptyReviewsText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },

    // ── Review Modal ────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    reviewModalContainer: {
      width: "100%",
      backgroundColor: "#121212",
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: "#222",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 12,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: { fontSize: 22, fontWeight: "800", color: "#FFF" },
    starRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
      marginBottom: 24,
    },
    starTouch: { padding: 4 },
    inputContainer: { marginBottom: 24 },
    reviewInput: {
      backgroundColor: "#1A1A1A",
      borderRadius: 16,
      padding: 16,
      color: "#FFF",
      fontSize: 16,
      height: 120,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: "#333",
    },
    charCount: {
      position: "absolute",
      bottom: 10,
      right: 12,
      fontSize: 10,
      color: "#555",
    },
    premiumPostBtn: {
      backgroundColor: "#FFD700",
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
    },
    premiumPostBtnText: {
      color: "#000",
      fontSize: 17,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    btnContent: { flexDirection: "row", alignItems: "center", gap: 8 },

    // ── Full Reviews Modal ──────────────────────────────────────────────────
    fullReviewsContainer: {
      flex: 1,
      backgroundColor: "#000",
      paddingTop: Platform.OS === "ios" ? 60 : 40,
    },
    fullReviewsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: "#222",
    },
    fullReviewsTitle: { fontSize: 18, fontWeight: "800", color: "#FFF" },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#111",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#333",
    },

    // ── Transit Styles ──────────────────────────────────────────────────────
    busRouteSelectorOuter: {
      position: "absolute",
      top: 130, // Way below the pill bar
      left: 20,
      width: "84%",
      zIndex: 3000,
      gap: 10,
    },
    busRouteSelectorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    busRouteDropdownTrigger: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark
        ? "rgba(12, 12, 14, 0.88)"
        : "rgba(255,255,255,0.94)",
      borderRadius: 24,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      gap: 12,
      flex: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 8,
    },
    selectedRouteBadge: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: "#500000",
      alignItems: "center",
      justifyContent: "center",
    },
    selectedRouteBadgeMuted: {
      backgroundColor: isDark
        ? "rgba(255,255,255,0.10)"
        : "rgba(12,12,14,0.78)",
    },
    selectedRouteNumber: {
      color: "#FFF",
      fontSize: 13,
      fontWeight: "900",
    },
    selectedRouteTextStack: {
      flex: 1,
      justifyContent: "center",
    },
    labelSubText: {
      color: COLORS.textTertiary,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 1,
    },
    selectedRouteName: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: "800",
    },
    chevronIcon: {
      paddingHorizontal: 8,
    },
    busTimetableButton: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: isDark
        ? "rgba(12, 12, 14, 0.88)"
        : "rgba(255,255,255,0.98)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.12)",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 8,
    },
    planTripButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: isDark
        ? "rgba(12,12,14,0.90)"
        : "rgba(255,255,255,0.96)",
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.24,
      shadowRadius: 10,
      elevation: 8,
    },
    planTripIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.primary,
    },
    planTripTextStack: {
      flex: 1,
      gap: 2,
    },
    planTripLabel: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: "800",
    },
    planTripMeta: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: "600",
    },
    busRoutesDropdown: {
      marginTop: 8,
      maxHeight: 300,
      backgroundColor: isDark
        ? "rgba(12,12,14,0.94)"
        : "rgba(255,255,255,0.96)",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 15,
      elevation: 15,
    },
    busDropdownScroll: {
      paddingVertical: 8,
    },
    routeSearchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    placesListOverlay: {
      position: "absolute",
      top: 178,
      left: 16,
      right: 16,
      bottom: FLOATING_CARD_BOTTOM_OFFSET + 12,
      zIndex: 3400,
    },
    placesListCard: {
      flex: 1,
      paddingBottom: 6,
      backgroundColor: isDark
        ? "rgba(12,12,14,0.88)"
        : "rgba(255,255,255,0.94)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
    },
    placesListHeader: {
      marginBottom: 8,
      gap: 4,
    },
    placesListTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },
    placesListSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    placesListContent: {
      paddingBottom: 16,
      gap: 10,
    },
    placesListRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    placesListIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.primary,
    },
    placesListRowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 4,
    },
    placesListRowTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: "800",
      flex: 1,
    },
    placesListRowDistance: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    placesListRowMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    placesListParkingHint: {
      color: COLORS.textPrimary,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 5,
    },
    routeSearchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      paddingVertical: 0,
    },
    emptyRouteSearchState: {
      paddingHorizontal: 16,
      paddingVertical: 22,
      gap: 6,
    },
    emptyRouteSearchTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: "800",
    },
    emptyRouteSearchBody: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    busRouteItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    busRouteItemActive: {
      backgroundColor: isDark ? "rgba(128,0,0,0.1)" : "rgba(80,0,0,0.08)",
    },
    routeItemBadge: {
      minWidth: 36,
      paddingHorizontal: 6,
      height: 32,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    routeItemBadgeActive: {
      backgroundColor: COLORS.primary,
    },
    routeItemBadgeIdle: {
      backgroundColor: isDark ? "#1A1A1A" : "#EFF1F5",
      borderWidth: isDark ? 0 : 1,
      borderColor: isDark ? "transparent" : "rgba(12,12,14,0.08)",
    },
    routeItemNumber: {
      color: "#FFF",
      fontSize: 12,
      fontWeight: "800",
    },
    routeItemNumberIdle: {
      color: isDark ? "#FFF" : COLORS.textPrimary,
    },
    routeItemName: {
      flex: 1,
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    routeItemNameActive: {
      color: COLORS.textPrimary,
      fontWeight: "800",
    },
    activeCheckDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#F3F1ED",
      marginLeft: 8,
    },
    busTransitPanel: {
      backgroundColor: "rgba(12,12,14,0.88)",
      borderRadius: 28,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      padding: 16,
      gap: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 10,
    },
    busTransitHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    busTransitTitle: {
      color: "#FFF",
      fontSize: 15,
      fontWeight: "800",
    },
    busTransitSubtitle: {
      color: "#A6A6AC",
      fontSize: 12,
      marginTop: 2,
    },
    nearbyTransitCard: {
      backgroundColor: "rgba(255,255,255,0.04)",
      borderRadius: 20,
      padding: 14,
      gap: 6,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
    },
    nearbyTransitCardMuted: {
      backgroundColor: "rgba(255,255,255,0.03)",
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.04)",
    },
    nearbyTransitTitle: {
      color: "#FFF",
      fontSize: 13,
      fontWeight: "800",
    },
    nearbyTransitBody: {
      color: "#D2D2D7",
      fontSize: 12,
      lineHeight: 18,
    },
    nearbyTransitMutedText: {
      color: "#A6A6AC",
      fontSize: 12,
      lineHeight: 18,
    },
    stopBoardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stopBoardTitle: {
      color: "#FFF",
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    stopBoardMeta: {
      color: "#A6A6AC",
      fontSize: 11,
      fontWeight: "700",
    },
    stopBoardList: {
      gap: 8,
    },
    stopBoardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: "rgba(255,255,255,0.04)",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
    },
    stopBoardSequence: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    stopBoardSequenceText: {
      color: "#F3F1ED",
      fontSize: 11,
      fontWeight: "800",
    },
    stopBoardName: {
      color: "#FFF",
      fontSize: 13,
      fontWeight: "700",
    },
    stopBoardDetail: {
      color: "#9A9AA0",
      fontSize: 11,
      marginTop: 2,
    },
    stopBoardEta: {
      color: "#F3F1ED",
      fontSize: 12,
      fontWeight: "800",
    },
    circularActionBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#007AFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6,
    },
    busMarker: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "#800000",
      borderWidth: 2,
      borderColor: "#FFD700",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
      elevation: 6,
    },
    userLocationMarker: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(255,255,255,0.24)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.65)",
    },
    userLocationInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#4DA3FF",
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    busMarkerText: {
      color: "#FFF",
      fontSize: 12,
      fontWeight: "900",
    },
    busStopPin: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#007AFF", // Standard Blue
      borderWidth: 1.5,
      borderColor: "#FFF",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    busStopInfoCard: {
      position: "absolute",
      bottom: FLOATING_CARD_BOTTOM_OFFSET + 12,
      left: 20,
      right: 20,
      backgroundColor: "rgba(12, 12, 12, 0.98)",
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: "#800000",
      zIndex: 2000,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    stopInfoIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#007AFF",
      alignItems: "center",
      justifyContent: "center",
    },
    stopInfoName: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 2,
    },
    stopInfoProximity: {
      color: "#FFD700",
      fontSize: 13,
      fontWeight: "700",
    },
    busVehicleInfoCard: {
      position: "absolute",
      bottom: 95,
      left: 20,
      right: 20,
      backgroundColor: isDark
        ? "rgba(18, 18, 20, 0.90)"
        : "rgba(255,255,255,0.98)",
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      zIndex: 2000,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    busInfoIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#800000",
      alignItems: "center",
      justifyContent: "center",
    },
    busInfoBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    busInfoBadge: {
      backgroundColor: isDark ? "#333" : "#EFF1F5",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    busInfoBadgeText: {
      color: COLORS.textPrimary,
      fontSize: 11,
      fontWeight: "700",
    },
    loadBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    loadText: {
      fontSize: 11,
      fontWeight: "700",
    },
    busInfoRouteName: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    dockedStopContainer: {
      position: "absolute",
      bottom: FLOATING_CARD_BOTTOM_OFFSET,
      left: 20,
      right: 20,
      zIndex: 5000, // VERY HIGH to be on top of everything
    },
    busStopDockedCard: {
      backgroundColor: isDark
        ? "rgba(18,18,20,0.90)"
        : "rgba(255,255,255,0.98)",
      borderRadius: 20,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(12,12,14,0.08)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 15,
      elevation: 10,
    },
    stopIconCircular: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0, 122, 255, 0.1)",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    stopPulseMarker: {
      position: "absolute",
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#007AFF",
      opacity: 0.3,
    },
    dockedStopName: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 4,
    },
    busStopHintText: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 6,
    },
    proximityRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    dockedStopProximity: {
      color: "#007AFF",
      fontSize: 13,
      fontWeight: "700",
    },
    closeStopBtn: {
      padding: 8,
    },
  });
