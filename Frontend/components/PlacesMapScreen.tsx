/**
 * PlacesMapScreen — thin orchestrator
 *
 * This component owns shared state and composes sub-components.
 * All logic has been decomposed into:
 *   hooks/     → useLocationData, useScheduleMap, useBusTransit
 *   places/    → CategoryPillBar, SearchOverlay, BusLayerUI,
 *                ScheduleHeader, LocationBottomSheet, PlacesList
 *   utils.ts   → pure functions
 *   campusData.ts → static data & directory
 *   types.ts   → shared interfaces & constants
 */

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
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  ScrollView,
  InteractionManager,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import {
  Menu,
  ChevronRight,
  ChevronLeft,
  Navigation,
  Compass,
  Calendar,
  Flame,
  LocateFixed,
  Orbit,
  Plus,
  Locate,
  Maximize2,
  Minimize2,
  Bus,
  ChevronDown,
  Share2,
  X,
} from "lucide-react-native";
import type { WalkingRoute } from "../services/campusDirections";
import { useTheme } from "./SharedUI";
import { PageModuleEditor } from "./PageModuleEditor";
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import MapView from "react-native-maps";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { connectFeedsUser } from "../services/streamFeeds";
import { API_URL } from "../config";
import { useCampusHubStore } from "../store/campusHubStore";
import { getOrderedItems, useAppShellStore } from "../store/appShellStore";
import { useSessionStore } from "../store/sessionStore";
import { useShareStore } from "../store/shareStore";
import { promptGuestLogin } from "../utils/guestAccess";
import {
  getDiningMealPeriodForLocation,
} from "../services/diningMenuCache";

// ── Sub-components ────────────────────────────────────────────
import { FloatingSearchBar } from "./places/FloatingSearchBar";
import { LayerPillScroller } from "./places/LayerPillScroller";
import { SearchOverlay } from "./places/SearchOverlay";
import { searchCampusLocations } from "./places/searchUtils";
import {
  BusRouteSelector,
  BusStopInfoCard,
  BusVehicleInfoCard,
} from "./places/BusLayerUI";
import { BusTimetableSheet } from "./places/BusTimetableSheet";
import { PulseHotspotSheet } from "./places/PulseHotspotSheet";
import { LocationBottomSheet } from "./places/LocationBottomSheet";
import { ScheduleHeader } from "./places/ScheduleHeader";
import { PlacesList } from "./places/PlacesList";
import { TodayTimeline } from "./places/TodayTimeline";
import { useLocationData } from "./places/useLocationData";
import { usePlacesSelection } from "./places/usePlacesSelection";
import { useScheduleMap } from "./places/useScheduleMap";

// ── Shared data / utilities ───────────────────────────────────
import { TourProvider, useTour } from "./onboarding/TourProvider";
import {
  TAMU_CENTER,
  ALL_BUS_ROUTES_KEY,
  PARKING_INFO_URL,
  type CampusLocation,
  type LocationType,
} from "./places/types";
import {
  CAMPUS_ZONES,
  CATEGORIES,
  getLocationSelectionId,
  getCanonicalLocationName,
  getZoneDensity,
  mergeCampusLocations,
  shouldHideFoodCourtLocationInBrowse,
} from "./places/campusData";
import {
  getStatusColor,
  getCategoryColor,
  haversineDistanceMeters,
  getDistanceLabel,
  getParkingRecommendation,
  getCategoryIcon,
} from "./places/utils";
import { getStyles } from "./places/placesStyles";
import {
  fetchCampusPulseMap,
  invalidateCampusPulseCache,
  type CampusHotspot,
} from "../services/campusPulse";
import {
  MapLibreCircleOverlay,
  MapLibreMarker,
  MapLibrePolylineOverlay,
  useMapLibreCamera,
} from "./map/mapLibreUtils";
import { searchGlobalPlaces } from "../services/globalMap";

// ── Transitional: still uses inline hooks from original file
//    (replace with useLocationData / useScheduleMap / useBusTransit
//     in the follow-on cleanup pass)

// Make map colors "neon" and bright
const getNeonColor = (hex: string) => {
  if (!hex || !hex.startsWith("#")) return "#00FFFF";
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  if (hex.toUpperCase() === "#500000") return "#FF0055"; // Maroon -> Neon Pink

  const max = Math.max(r, g, b);
  if (max === 0) return "#00FFFF";

  // Normalize so highest channel is 255
  const m = 255 / max;
  r = Math.round(r * m);
  g = Math.round(g * m);
  b = Math.round(b * m);

  // Add neon pop
  const thr = 60;
  if (r < thr) r += thr;
  if (g < thr) g += thr;
  if (b < thr) b += thr;

  return `#${[r, g, b]
    .map((c) => Math.min(255, c).toString(16).padStart(2, "0"))
    .join("")}`;
};

export function PlacesMapScreen({ route, navigation }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(COLORS, isDark);
  const { user } = useUser();
  const isGuest = useSessionStore((state) => state.isGuest);
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = Dimensions.get("window");

  // ── App-shell store ───────────────────────────────────────
  const placesPills = useAppShellStore((s) => s.placesPills);
  const parkingPermit = useAppShellStore((s) => s.parkingPermit);
  const togglePlacesPill = useAppShellStore((s) => s.togglePlacesPill);
  const movePlacesPill = useAppShellStore((s) => s.movePlacesPill);

  const orderedPlacesPills = useMemo(
    () => getOrderedItems(placesPills),
    [placesPills],
  );
  const visiblePlacesPills = useMemo(
    () => orderedPlacesPills.filter((item) => item.visible),
    [orderedPlacesPills],
  );

  const campusHubSnapshot = useCampusHubStore((s) => s.snapshot);
  const hydrateCampusHub = useCampusHubStore((s) => s.hydrate);

  // ── Map ref ───────────────────────────────────────────────
  const mapRef = useRef<any>(null);
  const { cameraRef, defaultCamera, animateToRegion, animateCamera, fitToCoordinates } =
    useMapLibreCamera(TAMU_CENTER);
  const currentBusRouteFetchId = useRef<string | null>(null);
  const lastPlacesFitKey = useRef<string | null>(null);
  const [isListDroppedDown, setIsListDroppedDown] = useState(false);
  const { activeTargetName, advanceStep } = useTour();

  // Onboarding: Force expand list when targeting items inside it
  useEffect(() => {
    mapRef.current = {
      animateToRegion,
      animateCamera,
      fitToCoordinates,
    };
  }, [animateCamera, animateToRegion, fitToCoordinates]);

  useEffect(() => {
    if (activeTargetName === "rec-center-item") {
      setIsListDroppedDown(true);
    }
  }, [activeTargetName]);

  // ── UI state ──────────────────────────────────────────────
  const [activeLayer, setActiveLayer] = useState<string>("Pulse");
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    null,
  );
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dynamicSearchLocations, setDynamicSearchLocations] = useState<CampusLocation[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(null);
  const [isTimetableSheetOpen, setIsTimetableSheetOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [userCoord, setUserCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isMapTilted, setIsMapTilted] = useState(false);
  const [pendingInitialLocation, setPendingInitialLocation] = useState<
    string | null
  >(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeWalkingRoute, setActiveWalkingRoute] =
    useState<WalkingRoute | null>(null);
  const [isTodayExpanded, setIsTodayExpanded] = useState(false);
  const timelineHeight = useSharedValue(0);

  // ── Location data ─────────────────────────────────────────
  const {
    fullCampusIndex,
    locations,
    refreshLocations,
  } = useLocationData({ autoFetch: false });
  const [pulseHotspots, setPulseHotspots] = useState<CampusHotspot[]>([]);
  const pulseHotspotsRef = useRef<CampusHotspot[]>([]);
  const pulsePlacesRef = useRef<CampusLocation[]>([]);
  const selectedHotspotIdRef = useRef<string | null>(null);
  const [isLoadingPulse, setIsLoadingPulse] = useState(false);
  const lastGlobalSearchQueryRef = useRef('');
  const globalSearchRequestIdRef = useRef(0);

  // ── Schedule state ────────────────────────────────────────
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);

  // ── Unified Schedule Hook ──────────────────────────────────
  const {
    scheduleOptions,
    activeScheduleOption,
    scheduleLocations,
    scheduleSummaryLabel,
    isLoadingSchedules,
    nextEntry,
    refreshSchedules,
  } = useScheduleMap(locations, selectedDate);

  // Onboarding: Automatically expand Today timeline if navigated from RSVP with delay for smoothness
  useEffect(() => {
    if (route.params?.isToday) {
      const timer = setTimeout(() => {
        // Switch date if provided (e.g. from RSVP journey)
        if (route.params?.eventDate) {
          const targetDate = new Date(route.params.eventDate);
          if (!isNaN(targetDate.getTime())) {
            setSelectedDate(targetDate);
          }
        }
        setActiveLayer("Today");
        setIsTodayExpanded(true);
        refreshSchedules();
        navigation.setParams({ isToday: undefined, eventDate: undefined });
      }, 400); // Wait for tab transition to complete
      return () => clearTimeout(timer);
    }
  }, [
    route.params?.isToday,
    route.params?.eventDate,
    navigation,
    refreshSchedules,
  ]);

  useEffect(() => {
    timelineHeight.value = withTiming(isTodayExpanded ? 1 : 0, {
      duration: 400,
    });
  }, [isTodayExpanded]);

  const animatedTimelineStyle = useAnimatedStyle(() => ({
    height: withTiming(isTodayExpanded ? 400 : 0, { duration: 400 }),
    opacity: withTiming(isTodayExpanded ? 1 : 0, { duration: 300 }),
    overflow: "hidden",
  }));

  // Onboarding: Fallback idle timers (10 seconds) to prevent users from getting stuck

  // Onboarding: Force-collapse if stuck or moved away from Today
  useEffect(() => {
    if (activeTargetName === "places-settings") {
      setIsTodayExpanded(false);
    }
  }, [activeTargetName]);

  // Onboarding: The schedule-preview step is now informational only until the user taps 'Edit'
  // which is correctly handled by the next target 'places-settings' in LayerPillScroller.
  useEffect(() => {
    if (activeTargetName === "places-settings" && isTodayExpanded) {
      setIsTodayExpanded(false);
    }
  }, [activeTargetName, isTodayExpanded]);

  // Onboarding: Fallback idle timers removed to enforce distinct user actions.

  // ── Bus state ─────────────────────────────────────────────
  const [busRoutes, setBusRoutes] = useState<any[]>([]);
  const [busVehicles, setBusVehicles] = useState<any[]>([]);
  const [busStops, setBusStops] = useState<any[]>([]);
  const [selectedBusRouteId, setSelectedBusRouteId] = useState<string | null>(
    ALL_BUS_ROUTES_KEY,
  );
  const [routePatterns, setRoutePatterns] = useState<any[]>([]);
  const [routePaths, setRoutePaths] = useState<any[]>([]);
  const [allRoutePatternsById, setAllRoutePatternsById] = useState<
    Record<string, { points: any[]; stops: any[]; paths?: any[] }>
  >({});
  const [isFetchingBus, setIsFetchingBus] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<string>("All");

  const isAllBusRoutesSelected =
    !selectedBusRouteId ||
    selectedBusRouteId === ALL_BUS_ROUTES_KEY ||
    selectedBusRouteId === "all";

  const availableDirections = useMemo(() => {
    if (isAllBusRoutesSelected) return ["All"];
    const dirs = new Set<string>();
    busVehicles.forEach((bus) => {
      const dir = bus.direction || bus.DirectionName;
      if (dir && typeof dir === "string") dirs.add(dir.trim());
    });
    // Add any missing directions from the stops just in case vehicles are offline
    busStops.forEach((stop) => {
      const dir = stop.DirectionName || stop.direction;
      if (dir && typeof dir === "string") dirs.add(dir.trim());
    });
    return Array.from(dirs).filter(Boolean);
  }, [busVehicles, busStops, isAllBusRoutesSelected]);

  useEffect(() => {
    if (!isAllBusRoutesSelected && availableDirections.length > 0) {
      if (
        !availableDirections.includes(selectedDirection) ||
        selectedDirection === "All"
      ) {
        setSelectedDirection(availableDirections[0]);
      }
    } else {
      setSelectedDirection("All");
    }
  }, [availableDirections, isAllBusRoutesSelected]);

  const [nearestBusInfo, setNearestBusInfo] = useState<string | null>(null);
  const busPollInterval = useRef<any>(null);

  useEffect(() => {
    setIsListDroppedDown(false);
  }, [activeLayer]);

  const isFetchingRef = useRef(false);

  // ── Review / dining state ─────────────────────────────────
  const [streamReviews, setStreamReviews] = useState<any[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [isPostingReview, setIsPostingReview] = useState(false);
  const [allReviewsModalVisible, setAllReviewsModalVisible] = useState(false);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);

  // ── Recreation facility map ───────────────────────────────
  const recreationFacilityMap = useMemo(() => {
    const facilities = campusHubSnapshot?.recreation.facilities || [];
    return new Map(
      facilities.map((f: any) => [getCanonicalLocationName(f.name), f]),
    );
  }, [campusHubSnapshot?.recreation.facilities]);

  const formatDate = (date: Date) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  // ── Category / pill bar ───────────────────────────────────
  const visibleCategories = useMemo(() => {
    const ordered: any[] = visiblePlacesPills
      .map((item) => CATEGORIES.find((c) => c.id === item.id))
      .filter((c) => c?.id !== "Academic" && c?.id !== "Heatmap")
      .filter((c) => c != null);
    if (!ordered.length) {
      return CATEGORIES.filter(
        (category) => category.id !== "Academic" && category.id !== "Heatmap",
      );
    }
    const active = CATEGORIES.find((c) => c.id === activeLayer);
    if (
      active &&
      active.id !== "Academic" &&
      active.id !== "Heatmap" &&
      !ordered.some((c) => c.id === active.id)
    ) {
      return [active, ...ordered];
    }
    return ordered;
  }, [activeLayer, visiblePlacesPills]);

  // ── Derived map locations ─────────────────────────────────
  const allMapLocations = useMemo(() => {
    return mergeCampusLocations(
      locations,
      scheduleLocations as CampusLocation[],
      dynamicSearchLocations,
    );
  }, [dynamicSearchLocations, locations, scheduleLocations]);

  const pulsePlaces = useMemo(() => {
    return mergeCampusLocations(fullCampusIndex, locations);
  }, [fullCampusIndex, locations]);

  // Keep refs in sync for stable callbacks
  pulsePlacesRef.current = pulsePlaces;
  selectedHotspotIdRef.current = selectedHotspotId;

  const filteredLocations = useMemo(() => {
    const browsableLocations = allMapLocations.filter((l) => !l.searchOnly);
    if (activeLayer === "Pulse") return [];
    if (activeLayer === "Heatmap") return [];
    if (activeLayer === "Today") return scheduleLocations;
    if (activeLayer === "Dining")
      return browsableLocations.filter(
        (l) =>
          (l.type === "Dining" || l.type === "Hub") &&
          !shouldHideFoodCourtLocationInBrowse(l, allMapLocations),
      );
    if (activeLayer === "Academic")
      return browsableLocations.filter(
        (l) => l.type === "Academic" || l.type === "Landmark",
      );
    if (activeLayer === "Rec")
      return browsableLocations.filter(
        (l) =>
          l.type === "Rec" || (l.type === "Hub" && l.location.includes("Rec")),
      );
    return browsableLocations.filter((l) => l.type === activeLayer);
  }, [activeLayer, allMapLocations, scheduleLocations]);

  const sortedFilteredLocations = useMemo(() => {
    return [...filteredLocations].sort((a, b) => {
      const aD = userCoord
        ? haversineDistanceMeters(
            userCoord.latitude,
            userCoord.longitude,
            a.coord.lat,
            a.coord.lng,
          )
        : null;
      const bD = userCoord
        ? haversineDistanceMeters(
            userCoord.latitude,
            userCoord.longitude,
            b.coord.lat,
            b.coord.lng,
          )
        : null;
      if (activeLayer === "Parking") {
        const aP = getParkingRecommendation(a.location, parkingPermit);
        const bP = getParkingRecommendation(b.location, parkingPermit);
        if (aP.score !== bP.score) return aP.score - bP.score;
      }
      if (aD != null && bD != null && aD !== bD) return aD - bD;
      return a.location.localeCompare(b.location);
    });
  }, [activeLayer, filteredLocations, parkingPermit, userCoord]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchCampusLocations(allMapLocations, searchQuery, 10, {
      referenceCoord: userCoord ?? null,
    });
  }, [allMapLocations, searchQuery, userCoord]);

  const busRouteSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return busRoutes
      .filter((route) => {
        const shortName = (route.ShortName || "").toString().toLowerCase();
        const name = (route.Name || "").toString().toLowerCase();
        return shortName.includes(q) || name.includes(q);
      })
      .slice(0, 4);
  }, [busRoutes, searchQuery]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      globalSearchRequestIdRef.current += 1;
      setGlobalSearchError(null);
      setIsSearchingGlobal(false);
      lastGlobalSearchQueryRef.current = '';
      return;
    }

    if (
      lastGlobalSearchQueryRef.current &&
      lastGlobalSearchQueryRef.current !== normalizedQuery
    ) {
      globalSearchRequestIdRef.current += 1;
      setGlobalSearchError(null);
      setIsSearchingGlobal(false);
    }
  }, [searchQuery]);

  const busPulseAnim = useRef(new Animated.Value(1)).current;

  const {
    selectedId,
    setSelectedId,
    selectedLoc,
    selectedPlaceDetail,
    foodCourtVenues,
    isFetchingDining,
    diningMenuOptions,
    activeDiningMenu,
    setActiveDiningMenu,
    activeDiningMealPeriod,
    setActiveDiningMealPeriod,
    diningMenuPreview,
    isPrimaryDiningHallSelection,
    handleSelectLocation,
  } = usePlacesSelection({
    allMapLocations,
    setActiveLayer,
    onAfterSelectLocation: () => {
      setSelectedHotspotId(null);
      setSelectedStop(null);
      setSelectedBus(null);
      setIsSearchExpanded(false);
      setSearchQuery("");
      setShowSearchResults(false);
    },
  });
  const selectedHotspot = useMemo(
    () =>
      pulseHotspots.find((hotspot) => hotspot.id === selectedHotspotId) || null,
    [pulseHotspots, selectedHotspotId],
  );

  // Onboarding progression for rec-center-item is user-action only.
  const handleMapMarkerPress = useCallback(
    (loc: CampusLocation) => {
      handleSelectLocation(loc);
      if (activeTargetName === "rec-center-item" && loc.type === "Rec") {
        advanceStep("rec-center-item");
      }
    },
    [activeTargetName, advanceStep, handleSelectLocation],
  );

  const pulseTotals = useMemo(() => {
    return pulseHotspots.reduce(
      (totals, hotspot) => ({
        hotspots: totals.hotspots + 1,
        pings: totals.pings + hotspot.pingCount,
        events: totals.events + hotspot.eventCount,
      }),
      { hotspots: 0, pings: 0, events: 0 },
    );
  }, [pulseHotspots]);
  const hottestHotspot = pulseHotspots[0] || null;
  const markerLocations = useMemo(() => {
    if (activeLayer === "Heatmap" || activeLayer === "Bus")
      return selectedLoc ? [selectedLoc] : [];
    const merged = new Map<string, CampusLocation>();
    filteredLocations.forEach((l) => merged.set(getLocationSelectionId(l), l));
    if (selectedLoc)
      merged.set(getLocationSelectionId(selectedLoc), selectedLoc);
    return Array.from(merged.values());
  }, [activeLayer, filteredLocations, selectedLoc]);

  const selectedRoute = useMemo(
    () =>
      isAllBusRoutesSelected
        ? null
        : (busRoutes.find((r) => r.Key === selectedBusRouteId) ?? null),
    [busRoutes, isAllBusRoutesSelected, selectedBusRouteId],
  );
  const busRouteOptions = useMemo(
    () => [
      {
        Key: ALL_BUS_ROUTES_KEY,
        ShortName: "ALL",
        Name: "All Routes",
        Color: "#1E1E1E",
      },
      ...busRoutes,
    ],
    [busRoutes],
  );
  const filteredBusRoutes = busRouteOptions;

  const selectedRecreationFacility = useMemo(() => {
    if (!selectedLoc) return null;
    return (
      selectedPlaceDetail?.recreation ||
      recreationFacilityMap.get(
        getCanonicalLocationName(selectedLoc.location),
      ) ||
      null
    );
  }, [recreationFacilityMap, selectedLoc, selectedPlaceDetail?.recreation]);

  const stopTimetable = useMemo(() => {
    if (activeLayer !== "Bus" || !selectedRoute || busStops.length === 0)
      return [];
    return busStops.slice(0, 12).map((stop, i) => {
      if (busVehicles.length === 0)
        return {
          stop,
          sequence: i + 1,
          etaLabel: "Route loaded",
          detail: "ETA pending",
        };
      const { getApproximateEtaMinutes } = require("./places/utils");
      const ranked = busVehicles
        .map((bus) => ({
          bus,
          etaMinutes: getApproximateEtaMinutes(routePatterns, stop, bus),
        }))
        .sort((a, b) => a.etaMinutes - b.etaMinutes);
      const next = ranked[0];
      if (!next)
        return {
          stop,
          sequence: i + 1,
          etaLabel: "No estimate",
          detail: "Live feed unavailable",
        };
      return {
        stop,
        sequence: i + 1,
        etaLabel: next.etaMinutes <= 1 ? "Now" : `${next.etaMinutes} min`,
        detail: next.bus.RouteShortName
          ? `Route ${next.bus.RouteShortName}`
          : next.bus.Name || "Live bus",
      };
    });
  }, [activeLayer, busStops, busVehicles, routePatterns, selectedRoute]);

  const allRouteBoards = useMemo(() => {
    if (!isAllBusRoutesSelected) return [];
    const {
      getApproximateEtaMinutes,
      isVehicleOnRoute,
    } = require("./places/utils");
    return busRoutes
      .map((route) => {
        const pattern = allRoutePatternsById[route.Key];
        const routePoints = pattern?.points || [];
        const routeStops = pattern?.stops || [];
        const routeVehicles = busVehicles.filter((bus) =>
          isVehicleOnRoute(bus, route),
        );
        const entries = routeStops.slice(0, 4).map((stop: any, i: number) => {
          const ranked = routeVehicles
            .map((bus) => ({
              bus,
              etaMinutes: getApproximateEtaMinutes(routePoints, stop, bus),
            }))
            .sort((a: any, b: any) => a.etaMinutes - b.etaMinutes);
          const next = ranked[0];
          return {
            stop,
            sequence: i + 1,
            etaLabel: next
              ? next.etaMinutes <= 1
                ? "Now"
                : `${next.etaMinutes} min`
              : "Route loaded",
            detail: next?.bus?.RouteShortName
              ? `Route ${next.bus.RouteShortName}`
              : route.Name || "Transit route",
          };
        });
        return { route, liveCount: routeVehicles.length, entries };
      })
      .filter((b: any) => b.entries.length > 0 || b.liveCount > 0);
  }, [allRoutePatternsById, busRoutes, busVehicles, isAllBusRoutesSelected]);

  const nearbyTransitInsight = useMemo(() => {
    if (!userCoord || activeLayer !== "Bus" || !selectedRoute) return null;
    const nearestStop = busStops.reduce((best: any, stop) => {
      const sLat = stop.Latitude !== undefined ? stop.Latitude : stop.lat;
      const sLng = stop.Longitude !== undefined ? stop.Longitude : stop.lng;
      if (sLat == null || sLng == null) return best;
      const d = haversineDistanceMeters(
        userCoord.latitude,
        userCoord.longitude,
        sLat,
        sLng,
      );
      return !best || d < best.distanceMeters
        ? { stop, distanceMeters: d }
        : best;
    }, null as any);
    const nearestVehicle = busVehicles.reduce((best: any, v) => {
      const vLat = v.Latitude !== undefined ? v.Latitude : v.lat;
      const vLng = v.Longitude !== undefined ? v.Longitude : v.lng;
      if (vLat == null || vLng == null) return best;
      const d = haversineDistanceMeters(
        userCoord.latitude,
        userCoord.longitude,
        vLat,
        vLng,
      );
      return !best || d < best.distanceMeters
        ? { vehicle: v, distanceMeters: d }
        : best;
    }, null as any);
    if (
      (!nearestStop || nearestStop.distanceMeters > 320) &&
      (!nearestVehicle || nearestVehicle.distanceMeters > 380)
    )
      return null;
    return { nearestStop, nearestVehicle };
  }, [activeLayer, busStops, busVehicles, selectedRoute, userCoord]);

  // ── Callbacks ─────────────────────────────────────────────
  const runGlobalSearch = useCallback(
    async (queryOverride?: string) => {
      const normalizedQuery = (queryOverride ?? searchQuery).trim();
      if (normalizedQuery.length < 2) return;

      const requestId = globalSearchRequestIdRef.current + 1;
      globalSearchRequestIdRef.current = requestId;
      setIsSearchingGlobal(true);
      setGlobalSearchError(null);
      try {
        const results = await searchGlobalPlaces(normalizedQuery, { limit: 6 });
        if (requestId !== globalSearchRequestIdRef.current) return;
        lastGlobalSearchQueryRef.current = normalizedQuery.toLowerCase();
        setDynamicSearchLocations((current) => mergeCampusLocations(current, results));
        if (results.length === 0) {
          setGlobalSearchError(`No matches found for "${normalizedQuery}".`);
        }
      } catch (error: any) {
        if (requestId !== globalSearchRequestIdRef.current) return;
        setGlobalSearchError(
          error?.message || "Search is unavailable right now.",
        );
      } finally {
        if (requestId === globalSearchRequestIdRef.current) {
          setIsSearchingGlobal(false);
        }
      }
    },
    [searchQuery],
  );

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    if (lastGlobalSearchQueryRef.current === trimmed.toLowerCase()) return;

    const timeoutId = setTimeout(() => {
      runGlobalSearch(trimmed);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [runGlobalSearch, searchQuery]);

  const getPlaceExternalLink = useCallback(
    (loc: CampusLocation) => {
      const rec =
        recreationFacilityMap.get(getCanonicalLocationName(loc.location)) ||
        null;
      if (rec?.source_url)
        return { label: "Open Official Page", url: rec.source_url };
      if (loc.type === "Dining" || loc.type === "Hub")
        return { label: "Dining Site", url: "https://dineoncampus.com/tamu" };
      if (loc.type === "Library")
        return { label: "Library Site", url: "https://library.tamu.edu/" };
      if (loc.type === "Parking")
        return { label: "Parking Guide", url: PARKING_INFO_URL };
      if (loc.source === "global") {
        return {
          label: "Open in Maps",
          url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            loc.address ? `${loc.location}, ${loc.address}` : loc.location,
          )}`,
        };
      }
      return {
        label: "Open in Maps",
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.location} Texas A&M University`)}`,
      };
    },
    [recreationFacilityMap],
  );

  const openFullMenu = useCallback(
    (locationName: string) => {
      const rootNav =
        navigation.getParent?.("RootStack") || navigation.getParent?.();
      const params = {
        location: locationName,
        mealPeriod: getDiningMealPeriodForLocation(locationName),
        title: `${locationName} Menu`,
        sourceHint: "cached",
      };
      (rootNav?.navigate || navigation.navigate)("FullMenu", params);
    },
    [navigation],
  );

  const openScheduleList = useCallback(() => {
    if (isGuest) {
      promptGuestLogin(
        navigation,
        "Saved schedules are only available once you log in.",
      );
      return;
    }
    const rootNav =
      navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("ScheduleList");
  }, [isGuest, navigation]);

  const openNewCourseSearch = useCallback(() => {
    if (isGuest) {
      promptGuestLogin(
        navigation,
        "Adding classes to your map requires a signed-in account.",
      );
      return;
    }
    const rootNav =
      navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("NewCourseSearch");
  }, [isGuest, navigation]);

  const openBusTimetable = useCallback(() => {
    const params = isAllBusRoutesSelected
      ? {
          mode: "all",
          boards: allRouteBoards,
          liveBusCount: busVehicles.length,
        }
      : {
          mode: "single",
          route: selectedRoute,
          entries: stopTimetable,
          liveBusCount: busVehicles.length,
          nearbyTransitInsight,
        };
    const rootNav =
      navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("BusTimetable", params);
  }, [
    allRouteBoards,
    busVehicles.length,
    isAllBusRoutesSelected,
    navigation,
    nearbyTransitInsight,
    selectedRoute,
    stopTimetable,
  ]);

  const openNavigationToLocation = useCallback(
    (loc: CampusLocation, mode: "walk" | "drive" | "bus" = "walk") => {
      const rootNav =
        navigation.getParent?.("RootStack") || navigation.getParent?.();
      const distanceFromUser = userCoord
        ? haversineDistanceMeters(
            userCoord.latitude,
            userCoord.longitude,
            loc.coord.lat,
            loc.coord.lng,
          )
        : null;
      const resolvedMode =
        mode === "walk" &&
        loc.source === "global" &&
        distanceFromUser != null &&
        distanceFromUser > 5000
          ? "drive"
          : mode;
      const params = {
        initialTravelMode: resolvedMode,
        initialDestination: {
          id: loc.location,
          name: loc.location,
          shortName: loc.shortName || loc.location,
          latitude: loc.coord.lat,
          longitude: loc.coord.lng,
          type: loc.type.toLowerCase(),
        },
      };
      (rootNav?.navigate || navigation.navigate)("CampusNavigation", params);
    },
    [navigation, userCoord],
  );

  const fetchReviews = useCallback(async (placeId: string, limit = 5) => {
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
  }, []);

  const handlePostReview = useCallback(async () => {
    if (isGuest) {
      promptGuestLogin(
        navigation,
        "Guest mode can browse reviews, but posting one needs a signed-in account.",
      );
      return;
    }
    const selectedReviewId =
      selectedLoc?.placeId || selectedLoc?.location || null;
    if (!selectedReviewId || !newReviewText.trim() || newRating === 0) return;
    setIsPostingReview(true);
    try {
      const { postPlaceReview } = require("../services/streamFeeds");
      await postPlaceReview(selectedReviewId, newRating, newReviewText.trim());
      setReviewModalVisible(false);
      setNewReviewText("");
      setNewRating(5);
      fetchReviews(selectedReviewId);
    } catch (e) {
      console.warn("Failed to post review", e);
    } finally {
      setIsPostingReview(false);
    }
  }, [
    fetchReviews,
    isGuest,
    navigation,
    newRating,
    newReviewText,
    selectedLoc,
  ]);

  const handleGetDirections = useCallback(
    (building: string) => {
      // Find building in directory (e.g. "MSC", "ZEC")
      const code = building.split(/\s+/)[0]?.toUpperCase();
      const loc = locations.find(
        (l) =>
          l.location.toUpperCase() === code ||
          (l.shortName && l.shortName.toUpperCase().includes(code)),
      );
      if (loc) {
        setSelectedId(getLocationSelectionId(loc));
        setIsTodayExpanded(false);
        // Center map
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coord.lat - 0.0015,
            longitude: loc.coord.lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          600,
        );
      }
    },
    [locations],
  );

  const handleSelectHotspot = useCallback(
    (hotspot: CampusHotspot) => {
      setSelectedHotspotId(hotspot.id);
      setSelectedId(null);
      setSelectedStop(null);
      setSelectedBus(null);
      setNearestBusInfo(null);
      setIsRouteDropdownOpen(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!mapRef.current) return;
      mapRef.current.animateCamera(
        {
          center: {
            latitude: hotspot.coord.lat,
            longitude: hotspot.coord.lng,
          },
          zoom: 16.2,
          pitch: isMapTilted ? 55 : 0,
          heading: 0,
        },
        { duration: 700 },
      );
    },
    [isMapTilted],
  );

  const openHotspotPlace = useCallback(
    (hotspot: CampusHotspot) => {
      if (!hotspot.place) {
        if (mapRef.current) {
          mapRef.current.animateCamera(
            {
              center: {
                latitude: hotspot.coord.lat,
                longitude: hotspot.coord.lng,
              },
              zoom: 16.4,
              pitch: isMapTilted ? 55 : 0,
              heading: 0,
            },
            { duration: 650 },
          );
        }
        return;
      }

      handleSelectLocation(hotspot.place);
    },
    [handleSelectLocation, isMapTilted],
  );

  const openHotspotItem = useCallback(
    async (hotspot: CampusHotspot, item: CampusHotspot["items"][number]) => {
      if (item.source === "event" && item.link) {
        try {
          await Linking.openURL(item.link);
          return;
        } catch (error) {
          console.warn("Failed to open event link", error);
        }
      }

      openHotspotPlace(hotspot);
    },
    [openHotspotPlace],
  );

  const fetchPulseHotspots = useCallback(async (options: { force?: boolean } = {}) => {
    const forceRefresh = options.force === true;
    if (!pulseHotspotsRef.current.length) {
      setIsLoadingPulse(true);
    }
    try {
      if (forceRefresh) {
        invalidateCampusPulseCache();
      }
      const rawHotspots = await fetchCampusPulseMap(12, { force: forceRefresh });
      const currentPulsePlaces = pulsePlacesRef.current;
      const placeLookup = new Map(
        currentPulsePlaces.flatMap((place) => {
          const keys = [place.location];
          if (place.placeId) keys.push(place.placeId);
          return keys.map((key) => [key, place] as const);
        }),
      );
      const hotspots = rawHotspots.map((hotspot) => ({
        ...hotspot,
        place:
          (hotspot.placeId ? placeLookup.get(hotspot.placeId) : null) ||
          placeLookup.get(hotspot.locationName) ||
          null,
      }));

      pulseHotspotsRef.current = hotspots;
      setPulseHotspots(hotspots);
      const currentSelectedId = selectedHotspotIdRef.current;
      if (
        currentSelectedId &&
        !hotspots.some((hotspot) => hotspot.id === currentSelectedId)
      ) {
        setSelectedHotspotId(null);
      }
    } catch (error) {
      console.warn("Failed to build pulse hotspots", error);
      if (!selectedHotspotIdRef.current) setPulseHotspots([]);
    } finally {
      setIsLoadingPulse(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSeenPulseLayer = useRef(false);
  useEffect(() => {
    if (activeLayer !== "Pulse") return;
    if (!hasSeenPulseLayer.current) {
      hasSeenPulseLayer.current = true;
      return;
    }
    fetchPulseHotspots({ force: true });
  }, [activeLayer, fetchPulseHotspots]);

  useFocusEffect(
    useCallback(() => {
      if (activeLayer !== "Pulse") return undefined;
      fetchPulseHotspots({ force: true });
      return undefined;
    }, [activeLayer, fetchPulseHotspots]),
  );

  const centerOnUserLocation = useCallback(async () => {
    try {
      let nextCoord = userCoord;
      if (!nextCoord) {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        nextCoord = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setUserCoord(nextCoord);
      }
      if (!nextCoord || !mapRef.current) return;
      mapRef.current.animateCamera(
        {
          center: nextCoord,
          zoom: 16.4,
          pitch: isMapTilted ? 55 : 0,
          heading: 0,
        },
        { duration: 700 },
      );
    } catch (error) {
      console.warn("Unable to center on user location", error);
    }
  }, [isMapTilted, userCoord]);

  const toggleMapPitch = useCallback(() => {
    const nextTilted = !isMapTilted;
    setIsMapTilted(nextTilted);
    if (!mapRef.current) return;
    const center = userCoord || TAMU_CENTER;
    mapRef.current.animateCamera(
      {
        center,
        pitch: nextTilted ? 55 : 0,
        zoom: userCoord ? 16.4 : 15.2,
        heading: 0,
      },
      { duration: 500 },
    );
  }, [isMapTilted, userCoord]);

  // ── Transit handlers ──────────────────────────────────────
  const { transitService } = require("../services/transitService");

  const loadAllBusRoutes = useCallback(async (routesToLoad: any[]) => {
    setBusVehicles([]);
    setBusStops([]);
    setRoutePatterns([]);
    setRoutePaths([]);
    if (!routesToLoad.length) {
      setAllRoutePatternsById({});
      return;
    }
    const patternEntries = await Promise.all(
      routesToLoad.map(
        async (r) =>
          [r.Key, await transitService.getRoutePattern(r.Key)] as const,
      ),
    );
    const nextPatterns = patternEntries.reduce((acc, [k, p]) => {
      acc[k] = p;
      return acc;
    }, {} as any);
    setAllRoutePatternsById(nextPatterns);
    const vehicles = await transitService.getVehicles();
    setBusVehicles(vehicles || []);
  }, []);

  // ── Auto-zoom and fitting logic ───────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedId || (activeLayer === "Pulse" && selectedHotspotId)) return;

    let coords: { latitude: number; longitude: number }[] = [];

    if (activeLayer === "Bus") {
      // Intentionally bypassed: We no longer auto-fit based on the live vehicle positions or routes globally
      // every single time the timer fires because it aggressively resets user zoom.
      // Route fittings are handled manually on route selection instead inside handleSelectBusRoute!
    } else if (activeLayer === "Pulse") {
      // Bypassed: Let the map stay at the campus-wide TAMU_CENTER initialRegion when on the Pulse tab.
      // Auto-zooming to hotspots bounds the camera incorrectly and breaks the intended overview.
    } else if (activeLayer === "Today") {
      // Only fit when there are multiple scheduled locations to show.
      coords = sortedFilteredLocations
        .filter((loc) => loc.coord)
        .map((loc) => ({ latitude: loc.coord.lat, longitude: loc.coord.lng }));
    } else {
      // General map fit for other layers (Dining, Parking, Places)
      if (filteredLocations.length > 0 && filteredLocations.length < 50) {
        // Only fit to filtered list if it's manageable.
        coords = filteredLocations
          .filter((loc) => loc.coord)
          .map((loc) => ({
            latitude: loc.coord.lat,
            longitude: loc.coord.lng,
          }));
      }
    }

    if (coords.length > 0) {
      const { width, height } = Dimensions.get("window");
      const isToday = activeLayer === "Today";
      const isPulse = activeLayer === "Pulse";

      if (isToday && coords.length < 2) {
        return;
      }

      // Dynamic padding to ensure data is centered in the visible ~65% of the viewport
      // Dynamic padding to ensure data is centered in the visible area below the Today box
      // Today: Scale with screen height (roughly 58% on pro phones, less on smaller)
      // pins have height (40px) and we want 20px margin.
      const topPadding = isToday
        ? Math.max(80, Math.min(height * 0.58, 540) - 200)
        : isPulse
          ? 250
          : 120;
      const bottomPadding = isPulse ? 220 : 120;
      const sidePadding = isToday ? 20 : width * 0.15;

      // Force 2D view (0 pitch) for Today to ensure padding logic is pixel-accurate
      if (isToday && isMapTilted) {
        setIsMapTilted(false);
        mapRef.current.animateCamera(
          { pitch: 0, heading: 0 },
          { duration: 400 },
        );
      }

      mapRef.current.fitToCoordinates(coords, {
        edgePadding: {
          top: topPadding,
          right: sidePadding,
          bottom: bottomPadding,
          left: sidePadding,
        },
        animated: true,
      });
    }
  }, [
    activeLayer,
    filteredLocations,
    isMapTilted,
    busVehicles,
    routePatterns,
    selectedId,
    selectedHotspotId,
    userCoord,
    isAllBusRoutesSelected,
    selectedRoute,
    pulseHotspots,
  ]);

  const handleSelectBusRoute = useCallback(
    async (routeId: string, availableRoutes: any[] = busRoutes) => {
      setSelectedBusRouteId(routeId);
      currentBusRouteFetchId.current = routeId;
      setBusVehicles([]);
      setSelectedStop(null);
      setSelectedBus(null);
      setRoutePatterns([]); // Clear previous traces
      setRoutePaths([]);
      setBusStops([]);

      if (routeId === ALL_BUS_ROUTES_KEY) {
        await loadAllBusRoutes(availableRoutes);
        return;
      }
      try {
        const { points, stops, paths } =
          await transitService.getRoutePattern(routeId);
          
        if (currentBusRouteFetchId.current !== routeId) return; // Prevent race condition crashes

        setRoutePatterns(points?.length ? points : []);
        setRoutePaths(paths?.length ? paths : []);
        setBusStops(stops?.length ? stops : []);
        if (mapRef.current && points?.length)
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 220, right: 60, bottom: 80, left: 60 },
            animated: true,
          });
        
        const vehicles = await transitService.getVehicles(routeId);
        if (currentBusRouteFetchId.current === routeId) {
          setBusVehicles(vehicles);
        }
      } catch (e) {
        console.warn("Failed to select bus route", e);
      }
    },
    [busRoutes, loadAllBusRoutes],
  );

  const handleSelectBusRouteFromSearch = useCallback(
    async (route: any) => {
      setActiveLayer("Bus");
      setIsSearchExpanded(false);
      setSearchQuery("");
      setShowSearchResults(false);
      setSelectedId(null);
      setSelectedStop(null);
      setSelectedBus(null);
      setIsRouteDropdownOpen(false);
      await handleSelectBusRoute(route.Key);
    },
    [handleSelectBusRoute],
  );

  const {
    getClosestProgressMeters,
    haversineDistanceMeters: hav,
    formatBusDistance,
  } = require("./places/utils");
  const resolveNearestBusForStop = useCallback(
    (stop: any, vehicles: any[]) => {
      if (!stop || vehicles.length === 0) {
        setNearestBusInfo(
          selectedRoute ? "Route loaded" : "Transit route loaded",
        );
        return;
      }
      const sLatP = stop.Latitude !== undefined ? stop.Latitude : stop.lat;
      const sLngP = stop.Longitude !== undefined ? stop.Longitude : stop.lng;
      if (sLatP == null || sLngP == null) return;

      const stopProgress = getClosestProgressMeters(routePatterns, {
        latitude: sLatP,
        longitude: sLngP,
      });
      const ranked = vehicles
        .map((bus) => {
          const busLat = bus.Latitude !== undefined ? bus.Latitude : bus.lat;
          const busLng = bus.Longitude !== undefined ? bus.Longitude : bus.lng;
          const stopLat =
            stop.Latitude !== undefined ? stop.Latitude : stop.lat;
          const stopLng =
            stop.Longitude !== undefined ? stop.Longitude : stop.lng;

          if (!busLat || !busLng || !stopLat || !stopLng) {
            return { bus, distanceMeters: Infinity };
          }

          const direct = hav(busLat, busLng, stopLat, stopLng);
          if (!stopProgress) return { bus, distanceMeters: direct };
          const busProgress = getClosestProgressMeters(routePatterns, {
            latitude: busLat,
            longitude: busLng,
          });
          if (!busProgress) return { bus, distanceMeters: direct };
          const delta = Math.abs(
            stopProgress.progressMeters - busProgress.progressMeters,
          );
          const wrapped =
            stopProgress.totalRouteMeters > 0
              ? Math.min(delta, stopProgress.totalRouteMeters - delta)
              : delta;
          return {
            bus,
            distanceMeters: Math.min(
              direct,
              wrapped + stopProgress.offsetMeters + busProgress.offsetMeters,
            ),
          };
        })
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
      const nearest = ranked[0];
      if (!nearest) {
        setNearestBusInfo(
          selectedRoute ? "Route loaded" : "Transit route loaded",
        );
        return;
      }
      setSelectedBus(nearest.bus);
      const eta = Math.max(1, Math.round(nearest.distanceMeters / 220));
      const label = nearest.bus.RouteShortName
        ? `Route ${nearest.bus.RouteShortName}`
        : nearest.bus.Name
          ? `Bus ${nearest.bus.Name}`
          : undefined;
      setNearestBusInfo(formatBusDistance(nearest.distanceMeters, eta, label));
    },
    [routePatterns, selectedRoute],
  );

  const handleStopPress = useCallback(
    (stop: any) => {
      setSelectedStop(stop);
      setSelectedBus(null);
      setNearestBusInfo("Finding closest bus...");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const sLat = stop.Latitude !== undefined ? stop.Latitude : stop.lat;
      const sLng = stop.Longitude !== undefined ? stop.Longitude : stop.lng;
      if (sLat != null && sLng != null && mapRef.current) {
        mapRef.current.animateCamera(
          {
            center: { latitude: sLat - 0.0018, longitude: sLng },
            zoom: 16.5,
          },
          { duration: 600 },
        );
      }

      resolveNearestBusForStop(stop, busVehicles);
    },
    [busVehicles, mapRef, resolveNearestBusForStop],
  );

  // ── Effects ───────────────────────────────────────────────
  // Location permissions + GPS watch
  useEffect(() => {
    let mounted = true,
      watcher: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!mounted || perm.status !== "granted") return;
        const cur = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserCoord({
          latitude: cur.coords.latitude,
          longitude: cur.coords.longitude,
        });
        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 15000,
          },
          (pos) => {
            if (mounted)
              setUserCoord({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
          },
        );
      } catch (e) {
        console.warn("Unable to center on current location", e);
      }
    })();
    return () => {
      mounted = false;
      watcher?.remove();
    };
  }, []);

  // Keep active layer valid
  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === activeLayer)) {
      setActiveLayer(visibleCategories[0]?.id || "Pulse");
    }
  }, [activeLayer, visibleCategories]);

  // Route param: initialLayer focus
  useEffect(() => {
    const nextLayer = route.params?.initialLayer;
    const token = route.params?.focusToken;
    const nextLocation = route.params?.initialLocation;
    if (!nextLayer && !token && !nextLocation) return;
    if (nextLayer) setActiveLayer(nextLayer);
    setSelectedId(null);
    setSelectedHotspotId(null);
    setSelectedStop(null);
    setSelectedBus(null);
    setNearestBusInfo(null);
    setIsSearchExpanded(false);
    setSearchQuery("");
    setShowSearchResults(false);
    setPendingInitialLocation(
      typeof nextLocation === "string" ? nextLocation : null,
    );
  }, [
    route.params?.focusToken,
    route.params?.initialLayer,
    route.params?.initialLocation,
  ]);

  useEffect(() => {
    if (!pendingInitialLocation) return;
    const targetName = getCanonicalLocationName(pendingInitialLocation);
    const match = allMapLocations.find(
      (loc) => getCanonicalLocationName(loc.location) === targetName,
    );
    if (!match) return;
    setSelectedId(getLocationSelectionId(match));
    setPendingInitialLocation(null);
  }, [allMapLocations, pendingInitialLocation]);

  useEffect(() => {
    if (activeLayer !== "Pulse" && selectedHotspotId) {
      setSelectedHotspotId(null);
    }
  }, [activeLayer, selectedHotspotId]);

  // Hydrate hub when tab needs it
  useEffect(() => {
    if (
      !isGuest &&
      user?.id &&
      (activeLayer === "Rec" ||
        activeLayer === "Library" ||
        activeLayer === "Schedule")
    ) {
      hydrateCampusHub(user.id).catch(() => {});
    }
  }, [activeLayer, hydrateCampusHub, isGuest, user?.id]);

  const hasFetchedInit = useRef(false);
  useEffect(() => {
    if (hasFetchedInit.current) return;

    const task = InteractionManager.runAfterInteractions(() => {
      hasFetchedInit.current = true;
      Promise.allSettled([
        refreshLocations(),
        fetchPulseHotspots(),
        Promise.resolve(refreshSchedules()),
      ]).catch(() => {});
    });
    return () => task.cancel();
  }, [fetchPulseHotspots, refreshLocations, refreshSchedules]);

  useEffect(() => {
    if (activeLayer !== "Pulse") return;
    const interval = setInterval(() => {
      fetchPulseHotspots();
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer]);

  // Pulse animation for Bus layer
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
  }, [activeLayer, busPulseAnim]);

  // Saved schedules state is now managed within useScheduleMap

  // Sync active schedule
  useEffect(() => {
    if (scheduleOptions.length === 0) {
      if (activeScheduleId !== null) setActiveScheduleId(null);
      return;
    }
    if (
      !activeScheduleId ||
      !scheduleOptions.some((o: any) => o.id === activeScheduleId)
    )
      setActiveScheduleId(scheduleOptions[0].id);
  }, [activeScheduleId, scheduleOptions]);

  // Bus fetch on layer switch
  useEffect(() => {
    if (activeLayer === "Bus") {
      (async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsFetchingBus(true);
        try {
          const metadata = await transitService.getRoutesMetadata();
          const activeIds = await transitService.getActiveRoutes();
          const active = metadata.filter(
            (m: any) =>
              activeIds.includes(m.ShortName) ||
              activeIds.includes(m.Key) ||
              activeIds.includes(m.Name),
          );
          const final = active.length ? active : metadata;
          setBusRoutes(final);
          const valid = final.some((r: any) => r.Key === selectedBusRouteId);
          if (
            final.length &&
            (isAllBusRoutesSelected || !selectedBusRouteId || !valid)
          )
            handleSelectBusRoute(ALL_BUS_ROUTES_KEY, final);
        } catch (e) {
          console.warn("Failed to fetch bus routes", e);
        } finally {
          setIsFetchingBus(false);
          isFetchingRef.current = false;
        }
      })();
    }
  }, [activeLayer]);

  // Bus polling
  useEffect(() => {
    if (activeLayer === "Bus" && selectedBusRouteId) {
      busPollInterval.current = setInterval(async () => {
        const updated = isAllBusRoutesSelected
          ? await transitService.getVehicles()
          : await transitService.getVehicles(selectedBusRouteId);
        setBusVehicles(updated);
      }, 5000);
    } else {
      if (busPollInterval.current) clearInterval(busPollInterval.current);
    }
    return () => {
      if (busPollInterval.current) clearInterval(busPollInterval.current);
    };
  }, [activeLayer, isAllBusRoutesSelected, selectedBusRouteId]);

  // Today selection should not auto-generate directions.
  useEffect(() => {
    setActiveWalkingRoute(null);
  }, [activeLayer, nextEntry, userCoord, selectedDate]);

  // Update nearest bus when vehicles change
  useEffect(() => {
    if (activeLayer === "Bus" && selectedStop)
      resolveNearestBusForStop(selectedStop, busVehicles);
  }, [
    activeLayer,
    busVehicles,
    routePatterns,
    selectedStop,
    resolveNearestBusForStop,
  ]);

  // Auto-fit map to filtered locations
  useEffect(() => {
    if (
      !mapRef.current ||
      activeLayer === "Bus" ||
      activeLayer === "Heatmap" ||
      activeLayer === "Today" ||
      activeLayer === "Pulse" ||
      selectedId ||
      sortedFilteredLocations.length === 0
    )
      return;
    const fitKey = `${activeLayer}:${sortedFilteredLocations.length}:${sortedFilteredLocations[0]?.location || ""}`;
    if (lastPlacesFitKey.current === fitKey) return;
    lastPlacesFitKey.current = fitKey;
    const points = sortedFilteredLocations
      .slice(0, 18)
      .map((l) => ({ latitude: l.coord.lat, longitude: l.coord.lng }));
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
  }, [activeLayer, selectedId, sortedFilteredLocations]);

  // Sheet selection - fetch reviews + dining on select
  useEffect(() => {
    const selectedReviewId =
      selectedLoc?.placeId || selectedLoc?.location || null;
    if (selectedId && selectedReviewId) {
      fetchReviews(selectedReviewId);
    } else {
      setStreamReviews([]);
    }
  }, [selectedId, selectedLoc, fetchReviews]);

  useEffect(() => {
    if (!selectedLoc || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: selectedLoc.coord.lat - 0.0015,
        longitude: selectedLoc.coord.lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      650,
    );
  }, [selectedLoc?.location, selectedLoc?.coord.lat, selectedLoc?.coord.lng]);

  // Connect native social client for compatibility across feed surfaces
  useEffect(() => {
    if (!isGuest && user?.id) {
      try {
        connectFeedsUser(user);
      } catch (_) {}
    }
  }, [isGuest, user]);

  // ── Render ────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={defaultCamera}
        showsCompass={false}
        showsUserLocation
        rotateEnabled={false}
        pitchEnabled
      >
        {activeLayer === "Heatmap" &&
          CAMPUS_ZONES.map((zone) => {
            const density = getZoneDensity(zone);
            return (
              <MapLibreCircleOverlay
                key={zone.name}
                id={`heatmap-${zone.name}`}
                center={{ latitude: zone.lat, longitude: zone.lng }}
                radiusMeters={zone.radius}
                fillColor={
                  density >= 70 ? "#FF3B30" : density >= 40 ? "#FF9500" : "#32D74B"
                }
                fillOpacity={density >= 70 ? 0.22 : density >= 40 ? 0.18 : 0.14}
                strokeColor={
                  density >= 70
                    ? "rgba(255,59,48,0.5)"
                    : density >= 40
                      ? "rgba(255,149,0,0.45)"
                      : "rgba(50,215,75,0.4)"
                }
                strokeWidth={1.5}
              />
            );
          })}

        {activeLayer === "Pulse" &&
          pulseHotspots.map((hotspot) => (
            <MapLibreCircleOverlay
              key={`pulse-radius-${hotspot.id}`}
              id={`pulse-radius-${hotspot.id}`}
              center={{
                latitude: hotspot.coord.lat,
                longitude: hotspot.coord.lng,
              }}
              radiusMeters={hotspot.radius}
              fillColor={hotspot.pulseColor}
              fillOpacity={0.13}
              strokeColor={`${hotspot.pulseColor}66`}
              strokeWidth={1.5}
            />
          ))}

        {activeLayer === "Bus" &&
          !isAllBusRoutesSelected &&
          (routePaths && routePaths.length > 0
            ? routePaths.map((path, idx) => {
                const isSelected =
                  selectedDirection === "All" ||
                  (path.DirectionName || "")
                    .toLowerCase()
                    .includes((selectedDirection || "All").toLowerCase());
                return (path.points || []).length > 0 ? (
                  <MapLibrePolylineOverlay
                    key={`path-${idx}`}
                    id={`path-${idx}`}
                    coordinates={path.points}
                    color={
                      isSelected
                        ? getNeonColor(selectedRoute?.Color || "#007AFF")
                        : getNeonColor(selectedRoute?.Color || "#007AFF") + "40"
                    }
                    width={isSelected ? 4 : 2}
                  />
                ) : null;
              })
            : routePatterns.length > 0 && (
                <MapLibrePolylineOverlay
                  id="bus-route-pattern"
                  coordinates={routePatterns}
                  color={getNeonColor(selectedRoute?.Color || "#007AFF")}
                  width={4}
                />
              ))}
        {activeLayer === "Bus" &&
          isAllBusRoutesSelected &&
          Object.entries(allRoutePatternsById).map(([routeKey, pattern]) => {
            const route = busRoutes.find((r) => r.Key === routeKey);
            return pattern?.points?.length > 0 ? (
              <MapLibrePolylineOverlay
                key={routeKey}
                id={`all-route-${routeKey}`}
                coordinates={pattern.points}
                color={getNeonColor(route?.Color || "#007AFF")}
                width={4}
              />
            ) : null;
          })}

        {activeLayer === "Bus" &&
          busStops.map((stop) => {
            const sLat = stop.Latitude !== undefined ? stop.Latitude : stop.lat;
            const sLng =
              stop.Longitude !== undefined ? stop.Longitude : stop.lng;
            if (sLat == null || sLng == null) return null;

            const stopDir = stop.DirectionName || stop.direction || "Unknown";
            const stopSelected =
              selectedDirection === "All" ||
              isAllBusRoutesSelected ||
              (stopDir || "")
                .toLowerCase()
                .includes((selectedDirection || "All").toLowerCase());

            return (
              <MapLibreMarker
                key={`stop-${stop.StopCode || stop.Name || sLat}`}
                id={`stop-${stop.StopCode || stop.Name || sLat}`}
                coordinate={{
                  latitude: sLat,
                  longitude: sLng,
                }}
                onPress={() => handleStopPress(stop)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={[
                    styles.busStopMarker,
                    { opacity: stopSelected ? 1 : 0.3 },
                  ]}
                >
                  <View style={styles.busStopMarkerInner} />
                </View>
              </MapLibreMarker>
            );
          })}

        {activeLayer === "Bus" &&
          !isAllBusRoutesSelected &&
          busVehicles.map((bus) => {
            const isTrackedBus =
              selectedBus?.Key && bus.Key
                ? selectedBus.Key === bus.Key
                : selectedBus?.Name === bus.Name;
            const routeShortName =
              bus.routeShortName ||
              bus.RouteShortName ||
              selectedRoute?.ShortName ||
              "";
            const routeColor =
              bus.routeColor ||
              bus.RouteColor ||
              selectedRoute?.Color ||
              "#007AFF";
            const heading = bus.heading || bus.Heading || 0;
            const busDir =
              bus.direction || bus.DirectionName || "Unknown Direction";

            const matchesDirection =
              selectedDirection === "All" ||
              (busDir || "")
                .toLowerCase()
                .includes((selectedDirection || "All").toLowerCase());
            const opacity = matchesDirection ? (isTrackedBus ? 1 : 0.9) : 0.3;

            return (
              <MapLibreMarker
                key={`bus-${bus.Key || bus.Id || bus.Name || bus.VehicleId}`}
                id={`bus-${bus.Key || bus.Id || bus.Name || bus.VehicleId}`}
                coordinate={{
                  latitude: bus.Latitude || bus.lat,
                  longitude: bus.Longitude || bus.lng,
                }}
                onPress={() => {
                  setSelectedBus(bus);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                  const bLat =
                    bus.Latitude !== undefined ? bus.Latitude : bus.lat;
                  const bLng =
                    bus.Longitude !== undefined ? bus.Longitude : bus.lng;
                  if (bLat != null && bLng != null && mapRef.current) {
                    mapRef.current.animateCamera(
                      {
                        center: { latitude: bLat - 0.0018, longitude: bLng },
                        zoom: 16.5,
                      },
                      { duration: 600 },
                    );
                  }
                }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={{
                    opacity,
                    alignItems: "center",
                    justifyContent: "center",
                    transform: [{ rotate: `${heading}deg` }],
                    shadowColor: "#000",
                    shadowOpacity: 0.3,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                >
                  <View
                    style={{
                      width: 0,
                      height: 0,
                      borderLeftWidth: 8,
                      borderRightWidth: 8,
                      borderBottomWidth: 14,
                      borderLeftColor: "transparent",
                      borderRightColor: "transparent",
                      borderBottomColor: routeColor,
                      marginBottom: -4,
                      zIndex: 2,
                    }}
                  />

                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: routeColor,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: isTrackedBus ? 3 : 2,
                      borderColor: isTrackedBus ? "#FFD700" : "white",
                      zIndex: 1,
                    }}
                  >
                    <View style={{ transform: [{ rotate: `-${heading}deg` }] }}>
                      <Bus
                        size={16}
                        color={isTrackedBus ? "#FFD700" : "white"}
                      />
                    </View>
                  </View>
                </View>
              </MapLibreMarker>
            );
          })}

        {activeLayer === "Today" && activeWalkingRoute && (
          <MapLibrePolylineOverlay
            id="walking-route"
            coordinates={activeWalkingRoute.polyline}
            color="#500000"
            width={4}
            lineDasharray={[1.5, 2.5]}
          />
        )}

        {activeLayer === "Pulse" &&
          pulseHotspots.map((hotspot) => {
            const isSelected = hotspot.id === selectedHotspotId;
            return (
              <MapLibreMarker
                key={hotspot.id}
                id={`pulse-hotspot-${hotspot.id}`}
                coordinate={{
                  latitude: hotspot.coord.lat,
                  longitude: hotspot.coord.lng,
                }}
                onPress={() => handleSelectHotspot(hotspot)}
                anchor={{ x: 0.5, y: 0.66 }}
              >
                <View
                  style={[
                    styles.pulseMarkerWrap,
                    { transform: [{ scale: isSelected ? 1.08 : 1 }] },
                  ]}
                >
                  <View
                    style={[
                      styles.pulseMarkerRing,
                      {
                        backgroundColor: `${hotspot.pulseColor}22`,
                        borderColor: `${hotspot.pulseColor}66`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.pulseMarkerCore,
                        { backgroundColor: hotspot.pulseColor },
                      ]}
                    >
                      <Flame size={14} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.pulseMarkerCount}>
                    <Text style={styles.pulseMarkerCountText}>
                      {hotspot.pingCount + hotspot.eventCount} LIVE
                    </Text>
                  </View>
                </View>
              </MapLibreMarker>
            );
          })}

        {activeLayer !== "Bus" &&
          markerLocations.map((loc) => {
            const isSelected = getLocationSelectionId(loc) === selectedId;
            const isTodayLayer = activeLayer === "Today";
            const isCapacityType = loc.type === "Library" || loc.type === "Rec";
            const pinColor = isTodayLayer
              ? getCategoryColor(loc.classMeetings?.[0]?.category)
              : isCapacityType
                ? getStatusColor(loc.percent_full)
                : COLORS.primary;
            const pinText =
              isTodayLayer && loc.sequenceIndex
                ? loc.sequenceIndex.toString()
                : null;

            return (
              <MapLibreMarker
                key={`loc-${getLocationSelectionId(loc)}`}
                id={`loc-${getLocationSelectionId(loc)}`}
                coordinate={{
                  latitude: loc.coord.lat,
                  longitude: loc.coord.lng,
                }}
                onPress={() => handleMapMarkerPress(loc)}
                anchor={{ x: 0.5, y: 1 }}
              >
                {isTodayLayer ? (
                  <View
                    style={[
                      (styles as any).numberedPinContainer,
                      { transform: [{ scale: isSelected ? 1.2 : 1.0 }] },
                    ]}
                  >
                    <View
                      style={[
                        (styles as any).numberedPinHead,
                        { backgroundColor: pinColor },
                      ]}
                    >
                      <Text style={(styles as any).numberedPinNumber}>
                        {pinText || "•"}
                      </Text>
                    </View>
                    <View
                      style={[
                        (styles as any).numberedPinTail,
                        { borderTopColor: pinColor },
                      ]}
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      transform: [{ scale: isSelected ? 1.2 : 1.0 }],
                    }}
                  >
                    <View
                      style={[styles.markerPin, { backgroundColor: pinColor }]}
                    >
                      {getCategoryIcon(
                        loc.type,
                        "#FFFFFF",
                        isSelected ? 18 : 16,
                      )}
                    </View>
                    <View
                      style={[
                        styles.markerPinLeg,
                        { borderTopColor: pinColor },
                      ]}
                    />
                  </View>
                )}
              </MapLibreMarker>
            );
          })}
      </MapView>

      {/* Top UI Floating Elements */}
      <View
        pointerEvents="box-none"
        style={[styles.topContainer, { top: 54, alignItems: "center" }]}
      >
        <FloatingSearchBar
          styles={styles}
          COLORS={COLORS}
          isSearchExpanded={isSearchExpanded}
          setIsSearchExpanded={setIsSearchExpanded}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setShowSearchResults={setShowSearchResults}
          onOpenSettings={() => setIsEditorVisible(true)}
          onShare={() =>
            useShareStore.getState().openShare({
              title: "Campus Map",
              message: "Check out the live campus map on MaroonSchedules!",
              url: "https://maroonschedules.tamu.edu/places",
            })
          }
          onSubmitSearch={() => runGlobalSearch()}
        />

        {!isSearchExpanded && (
          <>
            {/* Row 2: Category Pills */}
            <View style={{ marginTop: 12, width: "100%" }}>
              <LayerPillScroller
                styles={styles}
                COLORS={COLORS}
                activeLayer={activeLayer}
                layers={visibleCategories}
                onSelectLayer={(layer) => {
                  setActiveLayer(layer);
                  setSelectedId(null);
                  setSelectedStop(null);
                  setSelectedBus(null);
                  setIsRouteDropdownOpen(false);
                }}
                onOpenSettings={() => setIsEditorVisible(true)}
              />
            </View>

            {/* Row 3: Overlays (Today / Bus / List) */}
            {/* Row 3: Overlays (Today / Bus / List) */}
            {activeLayer === "Today" && (
              <View style={{ marginTop: 12, width: "100%" }}>
                <View style={styles.nextUpCard}>
                  {/* Card Header: Date Nav */}
                  <View style={styles.nextUpCardHeader}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <TouchableOpacity onPress={handlePrevDay}>
                        <ChevronLeft size={18} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                      <Text style={styles.dateNavTitle}>
                        {formatDate(selectedDate)}
                      </Text>
                      <TouchableOpacity onPress={handleNextDay}>
                        <ChevronRight size={18} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => setIsTodayExpanded(!isTodayExpanded)}
                      style={{ padding: 4 }}
                    >
                      {isTodayExpanded ? (
                        <Minimize2 size={18} color={COLORS.textPrimary} />
                      ) : (
                        <Maximize2 size={18} color={COLORS.textPrimary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.nextUpCardDivider} />

                  {/* Card Body: Summary or Timeline */}
                  <AnimatedReanimated.View style={animatedTimelineStyle}>
                    <ScrollView
                      style={{ height: 400 }}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.nextUpCardBody}>
                        <TodayTimeline
                          styles={styles}
                          COLORS={COLORS}
                          isDark={isDark}
                          activeScheduleOption={activeScheduleOption}
                          onGetDirections={handleGetDirections}
                        />
                      </View>
                    </ScrollView>
                  </AnimatedReanimated.View>

                  {!isTodayExpanded && nextEntry && (
                    <View style={styles.nextUpCardBody}>
                      <View style={styles.nextUpMainRow}>
                        <View style={styles.nextUpTimeBox}>
                          <Text style={styles.nextUpTimeText}>
                            {nextEntry.timeLabel}
                          </Text>
                        </View>
                        <View style={styles.nextUpContent}>
                          <Text style={styles.nextUpTitle} numberOfLines={1}>
                            {nextEntry.name}
                          </Text>
                          <Text style={styles.nextUpLocation} numberOfLines={1}>
                            {nextEntry.locationLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {activeLayer === "Bus" && (
              <View style={{ marginTop: 12, width: "100%" }}>
                <BusRouteSelector
                  styles={styles}
                  COLORS={COLORS}
                  busRoutes={busRoutes}
                  selectedBusRouteId={selectedBusRouteId}
                  selectedRoute={selectedRoute}
                  isAllBusRoutesSelected={isAllBusRoutesSelected}
                  isRouteDropdownOpen={isRouteDropdownOpen}
                  setIsRouteDropdownOpen={setIsRouteDropdownOpen}
                  filteredBusRoutes={filteredBusRoutes}
                  handleSelectBusRoute={handleSelectBusRoute}
                  openBusTimetable={() => setIsTimetableSheetOpen(true)}
                  openTransitTripPlanner={() =>
                    navigation.navigate("TransitTripPlanner")
                  }
                  selectedDirection={selectedDirection}
                  setSelectedDirection={setSelectedDirection}
                  availableDirections={availableDirections}
                  selectedStop={selectedStop}
                  setSelectedStop={setSelectedStop}
                  selectedBus={selectedBus}
                  setSelectedBus={setSelectedBus}
                  nearestBusInfo={nearestBusInfo}
                  handleStopPress={handleStopPress}
                />
              </View>
            )}

            {activeLayer !== "Today" &&
              activeLayer !== "Bus" &&
              activeLayer !== "Pulse" && (
                <View
                  style={{
                    marginTop: 12,
                    width: "100%",
                    alignItems: "flex-start",
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      (styles as any).listDropdownHeader,
                      isListDroppedDown &&
                        (styles as any).listDropdownHeaderOpen,
                    ]}
                    onPress={() => setIsListDroppedDown(!isListDroppedDown)}
                  >
                    <Text style={(styles as any).listDropdownLabel}>
                      List View
                    </Text>
                    <ChevronDown
                      size={18}
                      color={COLORS.textPrimary}
                      style={{
                        marginLeft: 8,
                        transform: [
                          { rotate: isListDroppedDown ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </TouchableOpacity>

                  {isListDroppedDown && (
                    <View
                      style={[
                        (styles as any).listDropdownContent,
                        { width: SCREEN_WIDTH - 32 },
                      ]}
                    >
                      <ScrollView
                        style={{ maxHeight: 320 }}
                        showsVerticalScrollIndicator={false}
                      >
                        {sortedFilteredLocations.map((loc) => (
                          <TouchableOpacity
                            key={loc.location}
                            style={(styles as any).listDropdownItem}
                            onPress={() => {
                              handleSelectLocation(loc);
                              setIsListDroppedDown(false);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={(styles as any).listDropdownItemTitle}
                                numberOfLines={1}
                              >
                                {loc.location}
                              </Text>
                              <Text
                                style={(styles as any).listDropdownItemSub}
                                numberOfLines={1}
                              >
                                {(loc.type === "Library" ||
                                  loc.type === "Rec") &&
                                loc.percent_full != null
                                  ? `${loc.percent_full}% full · `
                                  : ""}
                                {loc.type !== "Dining" && loc.type !== "Hub"
                                  ? loc.type
                                  : ""}
                              </Text>
                            </View>
                            <ChevronRight
                              size={16}
                              color={COLORS.textTertiary}
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
          </>
        )}
      </View>

      {/* Map control buttons removed per user request for all screens */}

      {/* Global Search Results Overlay moved to bottom for z-index priority */}

      <View style={styles.mapFabStack} pointerEvents="box-none">
        <TouchableOpacity style={styles.mapFab} onPress={centerOnUserLocation}>
          <LocateFixed size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapFab} onPress={toggleMapPitch}>
          <Orbit
            size={22}
            color={isMapTilted ? COLORS.primary : COLORS.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <BusStopInfoCard
        styles={styles}
        COLORS={COLORS}
        selectedStop={selectedStop}
        setSelectedStop={setSelectedStop}
        selectedBus={selectedBus}
        nearestBusInfo={nearestBusInfo}
      />

      <BusVehicleInfoCard
        styles={styles}
        COLORS={COLORS}
        selectedBus={selectedBus && !selectedStop ? selectedBus : null}
        setSelectedBus={setSelectedBus}
        selectedRoute={selectedRoute}
      />

      <PulseHotspotSheet
        styles={styles}
        COLORS={COLORS}
        hotspot={activeLayer === "Pulse" ? selectedHotspot : null}
        onClose={() => setSelectedHotspotId(null)}
        onOpenPlace={openHotspotPlace}
        onOpenItem={openHotspotItem}
      />

      {/* Slidable lists / Dropdowns removed per user request - handled by Top Dropdown */}

      {/* Location bottom sheet */}
      <LocationBottomSheet
        styles={styles}
        COLORS={COLORS}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        selectedLoc={selectedLoc}
        streamReviews={streamReviews}
        reviewModalVisible={reviewModalVisible}
        setReviewModalVisible={setReviewModalVisible}
        newRating={newRating}
        setNewRating={setNewRating}
        newReviewText={newReviewText}
        setNewReviewText={setNewReviewText}
        isPostingReview={isPostingReview}
        handlePostReview={handlePostReview}
        allReviewsModalVisible={allReviewsModalVisible}
        setAllReviewsModalVisible={setAllReviewsModalVisible}
        isFetchingReviews={isFetchingReviews}
        fetchReviews={fetchReviews}
        foodCourtVenues={foodCourtVenues}
        diningMenuOptions={diningMenuOptions}
        activeDiningMenu={activeDiningMenu}
        setActiveDiningMenu={setActiveDiningMenu}
        activeDiningMealPeriod={activeDiningMealPeriod}
        setActiveDiningMealPeriod={setActiveDiningMealPeriod}
        diningMenuPreview={diningMenuPreview}
        isFetchingDining={isFetchingDining}
        isPrimaryDiningHallSelection={isPrimaryDiningHallSelection}
        openFullMenu={openFullMenu}
        openScheduleList={openScheduleList}
        selectedRecreationFacility={selectedRecreationFacility}
        recreationFacilityMap={recreationFacilityMap}
        navigation={navigation}
        getPlaceExternalLink={getPlaceExternalLink}
        selectedStop={selectedStop}
        selectedBus={selectedBus}
        openNavigationToLocation={openNavigationToLocation}
      />

      {/* Module editor modal */}
      {isEditorVisible && (
        <PageModuleEditor
          visible={isEditorVisible}
          onClose={() => setIsEditorVisible(false)}
          title="Places"
          items={getOrderedItems(placesPills).filter(
            (item) =>
              item.id !== "Academic" &&
              item.id !== "Heatmap" &&
              (item as any).id !== "Study",
          )}
          onToggle={togglePlacesPill}
          onMove={movePlacesPill}
        />
      )}
      {/* Global Search Results Overlay rendered at the end for top-level z-index */}
      <SearchOverlay
        styles={styles}
        COLORS={COLORS}
        searchResults={searchResults}
        busRouteResults={busRouteSearchResults}
        isSearchExpanded={isSearchExpanded}
        showSearchResults={showSearchResults}
        searchQuery={searchQuery}
        isSearchingGlobal={isSearchingGlobal}
        globalSearchError={globalSearchError}
        onSelectLocation={(loc) => {
          handleSelectLocation(loc);
          setIsSearchExpanded(false);
          setShowSearchResults(false);
        }}
        onSelectBusRoute={(route) => {
          handleSelectBusRouteFromSearch(route);
          setIsSearchExpanded(false);
          setShowSearchResults(false);
        }}
      />

      {activeLayer === "Bus" && (
        <BusTimetableSheet
          visible={isTimetableSheetOpen}
          mode={selectedRoute ? "single" : "all"}
          onClose={() => setIsTimetableSheetOpen(false)}
          COLORS={COLORS}
          isDark={isDark}
          selectedRoute={selectedRoute}
          liveBusCount={busVehicles.length}
          stopTimetable={stopTimetable}
          onStopPress={(stop) => {
            const sLat =
              stop?.Latitude !== undefined ? stop.Latitude : stop?.lat;
            const sLng =
              stop?.Longitude !== undefined ? stop.Longitude : stop?.lng;
            if (mapRef.current && sLat && sLng) {
              mapRef.current.animateToRegion(
                {
                  latitude: sLat - 0.0018,
                  longitude: sLng,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                },
                600,
              );
            }
          }}
        />
      )}
    </View>
  );
}
