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
  Pressable,
  Alert,
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
  LocateFixed,
  Orbit,
  Plus,
  Locate,
  Maximize2,
  Minimize2,
  Bus,
  ChevronDown,
  MessageCircle,
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
import MapViewRNM from "react-native-maps";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { initializeFeedUser, toggleVote } from "../services/socialFeedService";
import { requestJson } from "../api/client";
import { getLocalDateString } from "../services/dateUtils";
import { API_URL } from "../config";

import { useCampusHubStore } from "../store/campusHubStore";
import { getOrderedItems, useAppShellStore } from "../store/appShellStore";
import { useSessionStore } from "../store/sessionStore";
import {
  type DiningMealPeriod,
  getDiningMealPeriodForLocation,
  isDiningHallMenuLocation,
} from "../services/diningMenuCache";
import { triggerNativeShare } from "../utils/share";
import { getStaticRestaurantMenu } from "../data/restaurantMenus";

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
import { useBusTransit } from "./places/useBusTransit";

// ── Shared data / utilities ───────────────────────────────────
import { TourProvider, TourTarget, useTour } from "./onboarding/TourProvider";
import {
  TAMU_CENTER,
  ALL_BUS_ROUTES_KEY,
  PARKING_INFO_URL,
  type CampusLocation,
  type LocationType,
  type ScheduleMeetingEntry,
} from "./places/types";
import {
  CAMPUS_ZONES,
  CATEGORIES,
  getLocationSelectionId,
  getCanonicalLocationName,
  getZoneDensity,
  mergeCampusLocations,
  shouldHideFoodCourtLocationInBrowse,
  normalizeBuildingKey,
} from "./places/campusData";
import {
  getStatusColor,
  getCategoryColor,
  haversineDistanceMeters,
  getDistanceLabel,
  getParkingRecommendation,
  getCategoryIcon,
  getApproximateEtaMinutes,
  isVehicleOnRoute,
} from "./places/utils";
import { getStyles } from "./places/placesStyles";
import {
  applyCampusHotspotItemVote,
  fetchCampusPulseMap,
  invalidateCampusPulseCache,
  voteHotspotItem,
  type CampusHotspot,
} from "../services/campusPulse";
import {
  MapCircleOverlay,
  MapMarker,
  MapPolylineOverlay,
  useMapCamera,
} from "./map/mapUtils";
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

const PULSE_OVERVIEW_EDGE_PADDING = {
  top: 250,
  right: 120,
  bottom: 350,
  left: 120,
};
const PULSE_OVERVIEW_RADIUS_METERS = 30_000;
const PULSE_SELECTION_REGION = {
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};
const PULSE_SELECTION_ANIMATION_MS = 520;
const DEFAULT_USER_CAMERA_ZOOM = 15.15;
const MAX_RESTORE_CAMERA_ZOOM = 15.45;
const MIN_RESTORE_CAMERA_ZOOM = 14.2;

const isPulseCoordNearCollegeStation = (latitude: number, longitude: number) =>
  haversineDistanceMeters(
    latitude,
    longitude,
    TAMU_CENTER.latitude,
    TAMU_CENTER.longitude,
  ) <= PULSE_OVERVIEW_RADIUS_METERS;

const getPulseFocusRegion = (latitude: number, longitude: number) => ({
  latitude: latitude + 0.0045,
  longitude,
  ...PULSE_SELECTION_REGION,
});

const zoomFromLatitudeDelta = (latitudeDelta?: number) => {
  if (!latitudeDelta || !Number.isFinite(latitudeDelta) || latitudeDelta <= 0) {
    return DEFAULT_USER_CAMERA_ZOOM;
  }
  return Math.log2(360 / latitudeDelta);
};

// ── Memoized Bus Marker ────────────────────────────────────
const BusMarker = React.memo(({ 
  bus, 
  onPress, 
  isDark, 
  routeColor, 
  routeShortName, 
  isAllBusRoutesSelected, 
  selectedDirection,
  isTrackedBus
}: any) => {
  const bLat = bus.Latitude != null ? bus.Latitude : bus.lat;
  const bLng = bus.Longitude != null ? bus.Longitude : bus.lng;
  const rawHeading = bus.heading || bus.Heading || 0;
  const heading = Number.isFinite(Number(rawHeading)) ? Number(rawHeading) : 0;

  // Performance optimization: only track view changes for 250ms when coordinates change
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [bLat, bLng, heading]);

  if (bLat == null || bLng == null || !Number.isFinite(bLat) || !Number.isFinite(bLng)) return null;

  const busDir = bus.direction || bus.DirectionName || "Unknown Direction";
  const matchesDirection =
    isAllBusRoutesSelected ||
    selectedDirection === "All" ||
    (busDir || "").toLowerCase().includes((selectedDirection || "All").toLowerCase());
  
  const opacity = matchesDirection ? 1 : 0.8;
  const displayName = routeShortName.length > 3 ? routeShortName.slice(0, 3) : routeShortName;
  const busCompositeKey = `bus-${bus.RouteKey}-${bus.Key || bus.Id || bus.Name || bus.VehicleId}`;

  return (
    <MapMarker
      id={busCompositeKey}
      coordinate={{ latitude: bLat, longitude: bLng }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View
        style={{
          opacity,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: `${heading}deg` }],
        }}
        renderToHardwareTextureAndroid={true}
        shouldRasterizeIOS={true}
      >
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 6,
            borderRightWidth: 6,
            borderBottomWidth: 8,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: isDark ? "#fff" : "#000",
            marginBottom: -2,
            zIndex: 2,
          }}
        />
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: routeColor,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: isDark ? "#fff" : "#000",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 10,
              fontWeight: "800",
              textAlign: "center",
              transform: [{ rotate: `${-heading}deg` }],
            }}
          >
            {displayName}
          </Text>
        </View>
      </View>
    </MapMarker>
  );
});

export function PlacesMapScreen({ route, navigation }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(COLORS, isDark);
  const { user } = useUser();
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
    useMapCamera(TAMU_CENTER);
  const currentBusRouteFetchId = useRef<string | null>(null);
  const lastPlacesFitKey = useRef<string | null>(null);
  const currentMapZoomRef = useRef(DEFAULT_USER_CAMERA_ZOOM);
  const currentMapCenterRef = useRef(TAMU_CENTER);
  const suppressNextOverviewFitRef = useRef(false);
  const [isListDroppedDown, setIsListDroppedDown] = useState(false);
  const listDropdownScrollRef = useRef<ScrollView | null>(null);
  const recCenterDropdownYRef = useRef(0);
  const { activeTargetName, advanceStep } = useTour();

  const scrollToRecCenterDropdownItem = useCallback(() => {
    if (!listDropdownScrollRef.current) return;
    listDropdownScrollRef.current.scrollTo({
      y: Math.max(0, recCenterDropdownYRef.current - 16),
      animated: true,
    });
  }, []);

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

  useEffect(() => {
    if (activeTargetName !== "rec-center-item" || !isListDroppedDown) {
      return;
    }
    const timer = setTimeout(() => {
      scrollToRecCenterDropdownItem();
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTargetName, isListDroppedDown, scrollToRecCenterDropdownItem]);

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
  const [hasManualMapMovement, setHasManualMapMovement] = useState(false);
  const [isCompactDetail, setIsCompactDetail] = useState(false);
  const timelineHeight = useSharedValue(0);

  // ── Meal Tracking state ───────────────────────────────────
  const [trackerCounts, setTrackerCounts] = useState<Record<string, { count: number; entryIds: number[] }>>({});
  const [isSyncingTracker, setIsSyncingTracker] = useState(false);

  // ── Location data ─────────────────────────────────────────
  const {
    fullCampusIndex,
    locations,
    refreshLocations,
  } = useLocationData({ autoFetch: true });
  const pulseHotspotsRef = useRef<CampusHotspot[]>([]);
  const pulsePlacesRef = useRef<CampusLocation[]>([]);
  const selectedHotspotIdRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const {
    data: pulseHotspots = [],
    isLoading: isLoadingPulse,
    refetch: refetchPulse,
  } = useQuery({
    queryKey: ['campus-pulse', user?.id, API_URL],
    queryFn: async () => {
      const { hotspots: rawHotspots } = await fetchCampusPulseMap(60, {
        clerkId: user?.id || undefined,
        force: true
      });

      const currentPulsePlaces = pulsePlacesRef.current;
      const placeLookup = new Map(
        currentPulsePlaces.flatMap((place) => {
          const keys = [place.location];
          if (place.placeId) keys.push(place.placeId);
          return keys.map((key) => [key, place] as const);
        }),
      );

      return rawHotspots.map((hotspot) => {
        let place = (hotspot.placeId ? placeLookup.get(hotspot.placeId) : null) || placeLookup.get(hotspot.locationName) || null;
        if (!place && hotspot.coord) {
          place = {
            placeId: hotspot.placeId || `geo:${hotspot.id}`,
            location: hotspot.locationName || "Location",
            shortName: (hotspot.locationName || "Location").slice(0, 10),
            percent_full: 0,
            type: "General" as any,
            is_live: true,
            available_seats: null,
            coord: hotspot.coord,
            source: "pulse",
          } as any;
        }
        return { ...hotspot, place };
      });
    },
    enabled: activeLayer === 'Pulse' || !!pulsePlacesRef.current.length,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30000, // 30 seconds
  });
  // isLoadingPulse is now handled by useQuery
  // const [isLoadingPulse, setIsLoadingPulse] = useState(false);
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

  // ── Unified Bus Transit Hook ──────────────────────────────
  const {
    busRoutes,
    busVehicles,
    busStops,
    selectedBusRouteId,
    setSelectedBusRouteId,
    selectedRoute,
    busRouteOptions,
    isRouteDropdownOpen,
    setIsRouteDropdownOpen,
    selectedDirection,
    setSelectedDirection,
    selectedStop,
    setSelectedStop,
    selectedBus,
    setSelectedBus,
    nearestBusInfo,
    setNearestBusInfo,
    isAllBusRoutesSelected,
    routePatterns,
    routePaths,
    allRoutePatternsById,
    temporaryBusFocusRouteId,
    setTemporaryBusFocusRouteId,
    handleSelectBusRoute,
    resolveNearestBusForStop,
    stopTimetable,
    allRouteBoards,
    filteredBusRoutes,
    isFetchingBus,
    setIsFetchingBus,
    getNearbyTransitInsight,
    availableDirections
  } = useBusTransit(activeLayer, mapRef);

  const nearbyTransitInsight = useMemo(() => getNearbyTransitInsight(userCoord), [getNearbyTransitInsight, userCoord]);

  useEffect(() => {
    setIsListDroppedDown(false);
    setHasManualMapMovement(false);
  }, [activeLayer]);

  const isFetchingRef = useRef(false);

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
    // API `locations` must merge last: schedule rows set percent_full: 0 and omit hours_today /
    // visitor_parking_* and would otherwise overwrite live campus map snapshot fields.
    const merged = mergeCampusLocations(
      scheduleLocations as CampusLocation[],
      dynamicSearchLocations,
      locations,
    );

    // Remove the fake/duplicate Evans Library sitting at the Memorial Student Center (MSC) location
    // The real one is near the Annex (~30.616, -96.339). The ghost one is ~30.612, -96.341.
    return merged.filter(l => {
      const isIncorrectEvans = l.location.includes("Evans Library") &&
                              l.coord.lat < 30.615 &&
                              l.coord.lng < -96.340;
      const isCainGarage = l.location.toLowerCase().includes("cain") &&
                           l.location.toLowerCase().includes("garage");
      return !isIncorrectEvans && !isCainGarage;
    });
  }, [dynamicSearchLocations, locations, scheduleLocations]);

  const pulsePlaces = useMemo(() => {
    return mergeCampusLocations(fullCampusIndex, locations);
  }, [fullCampusIndex, locations]);

  // Keep refs in sync for stable callbacks
  pulsePlacesRef.current = pulsePlaces;
  selectedHotspotIdRef.current = selectedHotspotId;

  const filteredLocations = useMemo(() => {
    const browsableLocations = allMapLocations.filter((l) => !l.searchOnly);
    if (activeLayer === "Pulse") {
      return pulseHotspots
        .map((h) => h.place)
        .filter((p): p is CampusLocation => !!p);
    }
    if (activeLayer === "Heatmap") return [];
    if (activeLayer === "Today") return scheduleLocations;
    if (activeLayer === "Dining") {
      const isMarket = (l: CampusLocation) =>
        l.location.includes("Market") || l.location.includes("Aggie Express");

      return allMapLocations.filter(
        (l) =>
          ((l.type === "Dining" || l.type === "Hub") &&
           (!l.searchOnly || isMarket(l))) &&
          !shouldHideFoodCourtLocationInBrowse(l, allMapLocations),
      );
    }
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
  }, [activeLayer, allMapLocations, scheduleLocations, pulseHotspots]);

  const sortedFilteredLocations = useMemo(() => {
    return [...filteredLocations].sort((a, b) => {
      // Prioritize primary dining over markets/convenience
      if (activeLayer === "Dining") {
        const isAMarket = a.location.includes("Market") || a.location.includes("Aggie Express");
        const isBMarket = b.location.includes("Market") || b.location.includes("Aggie Express");
        if (isAMarket && !isBMarket) return 1;
        if (!isAMarket && isBMarket) return -1;
      }

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
        const visitorGarageIds = [
          "osm:way:91100311",
          "garage-polo",
          "osm:way:450686873",
          "garage-university-center",
          "garage-west-campus"
        ];
        const aLoc = a.location || "";
        const bLoc = b.location || "";
        const isAVisitor = visitorGarageIds.includes(("placeId" in a ? a.placeId : "")) ||
                          aLoc.includes("Central Campus Garage") ||
                          aLoc.includes("Polo") ||
                          aLoc.includes("Stallings") ||
                          aLoc.includes("University Center Garage") ||
                          aLoc.includes("West Campus Garage");
        const isBVisitor = visitorGarageIds.includes(("placeId" in b ? b.placeId : "")) ||
                          bLoc.includes("Central Campus Garage") ||
                          bLoc.includes("Polo") ||
                          bLoc.includes("Stallings") ||
                          bLoc.includes("University Center Garage") ||
                          bLoc.includes("West Campus Garage");

        if (isAVisitor && !isBVisitor) return -1;
        if (!isAVisitor && isBVisitor) return 1;
        if (isAVisitor && isBVisitor) {
           const aSpots = (a as any).visitor_parking_available ?? 0;
           const bSpots = (b as any).visitor_parking_available ?? 0;
           if (aSpots !== bSpots) return bSpots - aSpots;
        }

        const aP = getParkingRecommendation(a.location, parkingPermit);
        const bP = getParkingRecommendation(b.location, parkingPermit);
        if (aP.score !== bP.score) return aP.score - bP.score;
      }
      if (aD != null && bD != null) {
        if (Math.abs(aD - bD) > 20) return aD - bD;
      }
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
    const q = searchQuery.trim().toLowerCase();
    const isNumericQuery = /^\d+$/.test(q);
    const matches = busRoutes.filter((route) => {
      const shortName = (route.ShortName || "").toString().toLowerCase();
      const name = (route.Name || "").toString().toLowerCase();
      if (isNumericQuery) {
        // For numeric queries, require exact ShortName match or name substring
        return shortName === q || name.includes(q);
      }
      return shortName.includes(q) || name.includes(q);
    });
    // Sort exact ShortName matches first
    matches.sort((a, b) => {
      const aShort = (a.ShortName || "").toString().toLowerCase();
      const bShort = (b.ShortName || "").toString().toLowerCase();
      const aExact = aShort === q ? 0 : 1;
      const bExact = bShort === q ? 0 : 1;
      return aExact - bExact;
    });
    return matches.slice(0, 4);
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
    isFetchingDetail,
    foodCourtVenues,
    isFetchingDining,
    diningMenuOptions,
    activeDiningMenu,
    setActiveDiningMenu,
    activeDiningMealPeriod,
    setActiveDiningMealPeriod,
    activeDiningDate,
    setActiveDiningDate,
    diningMenuPreview,
    isPrimaryDiningHallSelection,
    handleSelectLocation,
  } = usePlacesSelection({
    allMapLocations,
    setActiveLayer,
    currentLayer: activeLayer,
    onAfterSelectLocation: useCallback((loc: CampusLocation) => {
      // Integration for Pulse layer: selecting a location from the list or search
      // should trigger the corresponding hotspot sheet if it exists
      if (loc.source === "pulse") {
        const hotspot = pulseHotspots.find((h) => h.place?.location === loc.location || h.placeId === loc.placeId);
        if (hotspot) {
          setSelectedHotspotId(hotspot.id);
        }
      } else {
        setSelectedHotspotId(null);
      }
      setSelectedStop(null);
      setSelectedBus(null);
      setIsSearchExpanded(false);
      setSearchQuery("");
      setShowSearchResults(false);
      setIsCompactDetail(false);

      if (
        activeTargetName === "rec-center-item" &&
        getCanonicalLocationName(loc.location) ===
        getCanonicalLocationName("Student Recreation Center")
      ) {
        InteractionManager.runAfterInteractions(() => {
          advanceStep("rec-center-item");
        });
      }

      // Center map on selected location
      if (loc?.coord && mapRef.current) {
        if (loc.source === "pulse") {
          mapRef.current.animateToRegion(
            getPulseFocusRegion(loc.coord.lat, loc.coord.lng),
            PULSE_SELECTION_ANIMATION_MS,
          );
        } else {
          mapRef.current.animateCamera(
            {
              center: {
                latitude: loc.coord.lat,
                longitude: loc.coord.lng,
              },
              zoom: 16.6,
              pitch: isMapTilted ? 55 : 0,
              heading: 0,
            },
            { duration: 700 },
          );
        }
      }
    }, [activeTargetName, advanceStep, isMapTilted, pulseHotspots]),
  });
  const selectedHotspot = useMemo(
    () =>
      pulseHotspots.find((hotspot) => hotspot.id === selectedHotspotId) || null,
    [pulseHotspots, selectedHotspotId],
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

  const [isMapTransitionsStable, setIsMapTransitionsStable] = useState(false);

  useEffect(() => {
    setIsMapTransitionsStable(true);
    const timer = setTimeout(() => setIsMapTransitionsStable(false), 2500);
    return () => clearTimeout(timer);
  }, [selectedId]);

  const markerLocations = useMemo(() => {
    if (activeLayer === "Pulse") return selectedLoc ? [selectedLoc] : [];
    if (activeLayer === "Heatmap" || activeLayer === "Bus")
      return selectedLoc ? [selectedLoc] : [];

    const merged = new Map<string, CampusLocation>();

    // Canonicalize keys to prevent overlaps for major garages
    const getGarageStableKey = (l: CampusLocation) => {
      const name = l.location.toLowerCase();
      if (name.includes("central campus") || (name.includes("central") && name.includes("garage"))) return "garage-central-canonical";
      if (name.includes("cain") && name.includes("garage")) return "garage-cain-canonical";
      if (name.includes("polo") && name.includes("garage")) return "garage-polo-canonical";
      if (name.includes("stallings") && name.includes("garage")) return "garage-stallings-canonical";
      if (name.includes("university center") && name.includes("garage")) return "garage-ucg-canonical";
      if (name.includes("west campus") && name.includes("garage")) return "garage-wcg-canonical";
      return getLocationSelectionId(l);
    };

    filteredLocations.forEach((l) => {
      const key = getGarageStableKey(l);
      const existing = merged.get(key);
      // If we have multiple, prefer the one with live data or more detail
      if (!existing || (l.visitor_parking_available != null && existing.visitor_parking_available == null)) {
        merged.set(key, l);
      }
    });

    // Stable Marker Fix: Only add selectedLoc if it's NOT already in the layer's
    // filtered list (using the stable key)
    if (selectedLoc) {
      const key = getGarageStableKey(selectedLoc);
      if (!merged.has(key)) {
        merged.set(key, selectedLoc);
      }
    }
    return Array.from(merged.values());
  }, [activeLayer, filteredLocations, selectedLoc]);

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
    (locationName: string, mealPeriod?: DiningMealPeriod) => {
      const rootNav =
        navigation.getParent?.("RootStack") || navigation.getParent?.();

      const isHall = isDiningHallMenuLocation(locationName);
      const staticMenu = getStaticRestaurantMenu(locationName);

      if (!isHall && staticMenu) {
        (rootNav?.navigate || navigation.navigate)("RestaurantMenu", {
          location: locationName,
          title: locationName,
        });
      } else {
        const params = {
          location: locationName,
          mealPeriod: mealPeriod || getDiningMealPeriodForLocation(locationName),
          title: `${locationName} Menu`,
          sourceHint: "cached",
        };
        (rootNav?.navigate || navigation.navigate)("FullMenu", params);
      }
    },
    [navigation],
  );

  const openFacilityCounts = useCallback((loc: CampusLocation) => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("FacilityCounts", { location: loc });
  }, [navigation]);

  const openScheduleList = useCallback(() => {
    const rootNav =
      navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("ScheduleList");
  }, [navigation]);

  const openNewCourseSearch = useCallback(() => {
    const rootNav =
      navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("NewCourseSearch");
  }, [navigation]);

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



  const handleGetDirections = useCallback(
    (item: ScheduleMeetingEntry | string) => {
      const buildingName = typeof item === "string" ? item : (item.building || item.locationLabel);

      // If we have an entry with coordinates, use them directly for navigation
      if (typeof item === "object" && item.lat && item.lng) {
        const syntheticLoc: CampusLocation = {
          location: item.locationLabel || item.name || "Target",
          shortName: (item.name || item.locationLabel || "Target").slice(0, 12),
          coord: { lat: item.lat, lng: item.lng },
          type: "General",
          percent_full: 0,
          is_live: false,
          available_seats: null,
          source: "directory",
        };
        openNavigationToLocation(syntheticLoc);
        setIsTodayExpanded(false);
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
        return;
      }

      const allSearchable = [...fullCampusIndex, ...scheduleLocations];
      const loc = allSearchable.find((l) => {
        const canonical = getCanonicalLocationName(l.location);
        const searchCanon = getCanonicalLocationName(buildingName);
        return (
          canonical === searchCanon ||
          l.shortName === buildingName ||
          l.location === buildingName
        );
      });

      if (loc) {
        openNavigationToLocation(loc);
        setIsTodayExpanded(false);
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
      } else {
        // Fallback to search query
        setSearchQuery(buildingName);
        setIsSearchExpanded(true);
        setShowSearchResults(true);
      }
    },
    [fullCampusIndex, scheduleLocations, openNavigationToLocation]
  );

  const handleSelectHotspot = useCallback(
    (hotspot: CampusHotspot) => {
      setSelectedHotspotId(hotspot.id);
      setSelectedId(null);
      setSelectedStop(null);
      setSelectedBus(null);
      setNearestBusInfo(null);
      setIsRouteDropdownOpen(false);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
      if (!mapRef.current) return;
      mapRef.current.animateToRegion(
        getPulseFocusRegion(hotspot.coord.lat, hotspot.coord.lng),
        PULSE_SELECTION_ANIMATION_MS,
      );
    },
    [],
  );

  const openHotspotItem = useCallback(
    async (_hotspot: CampusHotspot, item: CampusHotspot["items"][number]) => {
      if (item.source === "event" && item.link) {
        try {
          await Linking.openURL(item.link);
        } catch (error) {
          console.warn("Failed to open event link", error);
        }
      }
    },
    [],
  );

  const toggleHotspotVote = useCallback(async (hotspotId: string, itemId: string, targetVote: number) => {
    const pulseKey = ['campus-pulse', user?.id, API_URL];
    const prevPulseData = queryClient.getQueryData(pulseKey) as CampusHotspot[] | undefined;
    if (!prevPulseData) return;

    const hotspot = prevPulseData.find(h => h.id === hotspotId);
    if (!hotspot) return;

    const item = hotspot.items?.find((i) => i.id === itemId);
    if (!item) return;

    // Toggle-to-undo logic
    const finalVote = item.userVote === targetVote ? 0 : targetVote;
    const currentVote = item.userVote || 0;
    const scoreDelta = finalVote - currentVote;

    // 1. Optimistically update the UI (Query Client)
    queryClient.setQueryData(pulseKey, (current: CampusHotspot[] | undefined) => {
      if (!current) return current;
      return current.map(h => {
        if (h.id === hotspotId) {
          const updatedItems = (h.items || []).map(i => {
            if (i.id === itemId) return applyCampusHotspotItemVote(i, finalVote);
            return i;
          });
          return { ...h, items: updatedItems, score: (h.score || 0) + scoreDelta };
        }
        return h;
      });
    });

    try {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}

      // 2. Dispatch real vote to backend
      const kind = finalVote === 1 ? 'upvote' : (finalVote === -1 ? 'downvote' : 'none');
      await toggleVote(itemId, kind);

      // 3. Sync memory-based cache for non-query-client consumers
      await voteHotspotItem(itemId, finalVote);
    } catch (e) {
      console.warn("[Pulse] vote failed", e);

      // 4. Rollback on failure
      if (prevPulseData) {
        queryClient.setQueryData(pulseKey, prevPulseData);
      }

      const errorMsg = e instanceof Error ? e.message : String(e);
      if (/rate limit/i.test(errorMsg)) {
        Alert.alert(
          "Slow down!",
          "You are voting too fast. Please wait a minute before trying again.",
          [{ text: "Understood" }]
        );
      } else if (/blocked/i.test(errorMsg)) {
        Alert.alert(
          "Interaction unavailable",
          "You cannot interact with this content due to a block relationship."
        );
      } else {
        // Silent log for general failures to avoid annoying popups on spotty connections
        console.warn("[Pulse] Connection error during vote commit");
      }
    }
  }, [user?.id, queryClient, applyCampusHotspotItemVote, pulseHotspots]);

  const refreshTrackerCounts = useCallback(async (locName: string, mealPeriod: DiningMealPeriod) => {
    if (!user) return;
    try {
      const tracker = await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}?date=${encodeURIComponent(getLocalDateString())}`);
      const entries = Array.isArray(tracker?.entries) ? tracker.entries : [];
      const nextCounts = entries.reduce((acc: Record<string, { count: number; entryIds: number[] }>, entry: any) => {
        if (entry.meal_period !== mealPeriod) return acc;
        const key = entry.label;
        const existing = acc[key] || { count: 0, entryIds: [] };
        existing.count += 1;
        existing.entryIds.push(entry.id);
        acc[key] = existing;
        return acc;
      }, {});
      setTrackerCounts(nextCounts);
    } catch (e) {
      console.warn('Failed to refresh tracker counts in map screen', e);
    }
  }, [user]);

  const addMealEntry = useCallback(async (item: any, location: string, mealPeriod: DiningMealPeriod) => {
    if (!user) {
      Alert.alert("Sign In", "Please sign in to track meals.");
      return;
    }
    setIsSyncingTracker(true);
    try {
      await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}`, {
        method: 'POST',
        body: JSON.stringify({
          date: getLocalDateString(),
          meal_period: mealPeriod,
          label: item.name,
          foods: [{
            name: item.name,
            source: 'dining_menu',
            calories: Number(item.calories || 0),
            protein: Number(item.protein || 0),
            carbs: Number(item.carbs || 0),
            fat: Number(item.fat || 0),
            location: location,
            meal_period: mealPeriod,
            quantity: 1,
          }],
        }),
      });
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
      await refreshTrackerCounts(location, mealPeriod);
    } catch (e) {
      console.warn('Meal add failed', e);
    } finally {
      setIsSyncingTracker(false);
    }
  }, [user, refreshTrackerCounts]);

  const removeMealEntry = useCallback(async (item: any, location: string, mealPeriod: DiningMealPeriod) => {
    if (!user) return;
    const existing = trackerCounts[item.name];
    if (!existing || existing.entryIds.length === 0) return;

    setIsSyncingTracker(true);
    try {
      const entryId = existing.entryIds[existing.entryIds.length - 1];
      await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}/${entryId}`, {
        method: 'DELETE',
      });
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
      await refreshTrackerCounts(location, mealPeriod);
    } catch (e) {
      console.warn('Meal remove failed', e);
    } finally {
      setIsSyncingTracker(false);
    }
  }, [user, trackerCounts, refreshTrackerCounts]);


  const fetchPulseHotspots = useCallback(async (options: { force?: boolean } = {}) => {
    if (options.force) {
      invalidateCampusPulseCache();
    }
    await refetchPulse();
  }, [refetchPulse]);


  const hasSeenPulseLayer = useRef(false);
  useEffect(() => {
    if (activeLayer !== "Pulse") return;
    if (!hasSeenPulseLayer.current) {
      hasSeenPulseLayer.current = true;
    } else {
      fetchPulseHotspots({ force: true });
    }
    setIsCompactDetail(false);
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
    mapRef.current.animateCamera(
      {
        center: currentMapCenterRef.current,
        pitch: nextTilted ? 55 : 0,
        heading: 0,
      },
      { duration: 500 },
    );
  }, [isMapTilted]);

  // ── Transit handlers ──────────────────────────────────────
  // transitService is now imported at top level

  const fitMapToActiveOverview = useCallback(() => {
    if (!mapRef.current) return;

    const fitToCoords = (
      coords: { latitude: number; longitude: number }[],
      edgePadding = { top: 180, right: 48, bottom: 220, left: 48 },
    ) => {
      const sanitizedCoords = coords.filter(
        c => c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
      );
      if (sanitizedCoords.length === 0) return;
      if (sanitizedCoords.length === 1) {
        mapRef.current.animateToRegion(
          {
            latitude: sanitizedCoords[0].latitude - 0.0018,
            longitude: sanitizedCoords[0].longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          650,
        );
        return;
      }
      mapRef.current.fitToCoordinates(sanitizedCoords, {
        edgePadding,
        animated: true,
      });
    };

    if (activeLayer === "Bus") {
      if (isAllBusRoutesSelected) {
        const routeCoords = Object.values(allRoutePatternsById).flatMap((pattern: any) =>
          Array.isArray(pattern?.points)
            ? pattern.points.map((point: any) => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }))
            : [],
        );
        const vehicleCoords = busVehicles
          .map((bus: any) => ({
            latitude: bus.Latitude,
            longitude: bus.Longitude,
          }))
          .filter(
            (coord: { latitude?: number; longitude?: number }) =>
              coord && Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude),
          ) as { latitude: number; longitude: number }[];
        fitToCoords([...routeCoords, ...vehicleCoords]);
        return;
      }

      if (routePatterns.length > 0) {
        fitToCoords(
          routePatterns.map((point: any) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          })),
        );
        return;
      }

      if (busStops.length > 0) {
        fitToCoords(
          busStops.map((stop: any) => ({
            latitude: stop.Latitude,
            longitude: stop.Longitude,
          })),
        );
      }
      return;
    }

    if (activeLayer === "Pulse") {
      const campusPulseCoords = pulseHotspots
        .map((hotspot) => ({
          latitude: hotspot.coord.lat,
          longitude: hotspot.coord.lng,
        }))
        .filter((coord) =>
          isPulseCoordNearCollegeStation(coord.latitude, coord.longitude),
        );

      if (campusPulseCoords.length > 0) {
        fitToCoords(campusPulseCoords, PULSE_OVERVIEW_EDGE_PADDING);
        return;
      }

      const allPulseCoords = pulseHotspots.map((hotspot) => ({
        latitude: hotspot.coord.lat,
        longitude: hotspot.coord.lng,
      }));

      if (allPulseCoords.length === 0) {
        fitToCoords(
          [{ latitude: TAMU_CENTER.latitude, longitude: TAMU_CENTER.longitude }],
          PULSE_OVERVIEW_EDGE_PADDING,
        );
        return;
      }

      fitToCoords(allPulseCoords, PULSE_OVERVIEW_EDGE_PADDING);
      return;
    }

    if (activeLayer === "Today") {
      fitToCoords(
        sortedFilteredLocations.map((loc) => ({
          latitude: loc.coord.lat,
          longitude: loc.coord.lng,
        })),
        { top: 210, right: 40, bottom: 250, left: 40 },
      );
      return;
    }

    fitToCoords(
      sortedFilteredLocations.slice(0, 18).map((loc) => ({
        latitude: loc.coord.lat,
        longitude: loc.coord.lng,
      })),
      { top: 210, right: 48, bottom: 250, left: 48 },
    );
  }, [
    activeLayer,
    allRoutePatternsById,
    busStops,
    busVehicles,
    isAllBusRoutesSelected,
    pulseHotspots,
    routePatterns,
    sortedFilteredLocations,
    userCoord,
  ]);

  const normalizeTransitValue = useCallback(
    (value: unknown) => (value || "").toString().trim().toLowerCase(),
    [],
  );

  const resolveRouteIdForBus = useCallback(
    (bus: any) => {
      const directMatch = bus.RouteKey || bus.routeKey || bus.routeId || null;
      if (directMatch) return directMatch;

      const routeShortName = normalizeTransitValue(
        bus.RouteShortName || bus.routeShortName,
      );
      const routeName = normalizeTransitValue(bus.RouteName || bus.routeName);

      const matchedRoute = busRoutes.find((route) => {
        const key = normalizeTransitValue(route.Key);
        const shortName = normalizeTransitValue(route.ShortName);
        const name = normalizeTransitValue(route.Name);
        return (
          (routeShortName &&
            (shortName === routeShortName || key === routeShortName)) ||
          (routeName && name === routeName)
        );
      });

      return matchedRoute?.Key || null;
    },
    [busRoutes, normalizeTransitValue],
  );


  // ── Auto-zoom and fitting logic ───────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedId || (activeLayer === "Pulse" && selectedHotspotId) || selectedStop || selectedBus) return;
    if (hasManualMapMovement) return;
    if (suppressNextOverviewFitRef.current) {
      suppressNextOverviewFitRef.current = false;
      return;
    }
    fitMapToActiveOverview();
  }, [
    activeLayer,
    fitMapToActiveOverview,
    busVehicles,
    routePatterns,
    selectedId,
    selectedHotspotId,
    isAllBusRoutesSelected,
    pulseHotspots,
    selectedStop,
    selectedBus,
    hasManualMapMovement,
  ]);


  // ── Meal Tracking Hydration ──────────────────────────────
  useEffect(() => {
    if (selectedLoc && isDiningHallMenuLocation(selectedLoc.location)) {
      const activePeriod = getDiningMealPeriodForLocation(selectedLoc.location);
      refreshTrackerCounts(selectedLoc.location, activePeriod);
    } else if (!selectedLoc) {
      setTrackerCounts({});
    }
  }, [selectedLoc, refreshTrackerCounts]);

  const handleSelectBusRouteFromSearch = useCallback(
    async (route: any) => {
      setActiveLayer("Bus");
      setIsSearchExpanded(false);
      setSearchQuery("");
      setShowSearchResults(false);
      setSelectedId(null);
      setSelectedStop(null);
      setSelectedBus(null);
      setTemporaryBusFocusRouteId(null);
      setIsRouteDropdownOpen(false);
      await handleSelectBusRoute(route.Key);
    },
    [handleSelectBusRoute],
  );

  const restoreAllRoutesFromTemporaryFocus = useCallback(() => {
    if (!temporaryBusFocusRouteId) return;
    setTemporaryBusFocusRouteId(null);
    handleSelectBusRoute(ALL_BUS_ROUTES_KEY);
  }, [handleSelectBusRoute, temporaryBusFocusRouteId]);

  const handleBusMarkerPress = useCallback(
    async (bus: any) => {
      const routeId = resolveRouteIdForBus(bus);
      const shouldFocusRoute = isAllBusRoutesSelected && !!routeId;

      if (shouldFocusRoute && routeId) {
        setTemporaryBusFocusRouteId(routeId);
        await handleSelectBusRoute(routeId);
      } else if (
        temporaryBusFocusRouteId &&
        routeId &&
        routeId !== temporaryBusFocusRouteId
      ) {
        setTemporaryBusFocusRouteId(null);
      }

      setSelectedStop(null);
      setSelectedBus(bus);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
    },
    [
      handleSelectBusRoute,
      isAllBusRoutesSelected,
      resolveRouteIdForBus,
      temporaryBusFocusRouteId,
    ],
  );

  const memoizedBusMarkers = useMemo(() => {
    return busVehicles.map((bus) => {
      const isTrackedBus =
        selectedBus?.Key && bus.Key
          ? selectedBus.Key === bus.Key
          : selectedBus?.Name === bus.Name;

      const routeShortName =
        (bus.routeShortName ||
        bus.RouteShortName ||
        selectedRoute?.ShortName ||
        "").toString();

      const routeColor =
        bus.routeColor ||
        bus.RouteColor ||
        selectedRoute?.Color ||
        "#007AFF";

      return (
        <BusMarker
          key={`bus-${bus.Key || bus.Id || bus.Name}`}
          bus={bus}
          isDark={isDark}
          routeColor={routeColor}
          routeShortName={routeShortName}
          isAllBusRoutesSelected={isAllBusRoutesSelected}
          selectedDirection={selectedDirection}
          isTrackedBus={isTrackedBus}
          onPress={() => handleBusMarkerPress(bus)}
        />
      );
    });
  }, [busVehicles, handleBusMarkerPress, isAllBusRoutesSelected, isDark, selectedBus, selectedDirection, selectedRoute]);



  const handleStopPress = useCallback(
    (stop: any) => {
      setSelectedStop(stop);
      setSelectedBus(null);
      setNearestBusInfo("Finding closest bus...");
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}

      resolveNearestBusForStop(stop, busVehicles);
    },
    [busVehicles, resolveNearestBusForStop],
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
    if (nextLocation) {
        setIsCompactDetail(true);
    }
  }, [
    route.params?.focusToken,
    route.params?.initialLayer,
    route.params?.initialLocation,
    route.params?.isCompact,
  ]);

  useEffect(() => {
    if (!pendingInitialLocation) return;
    const targetName = getCanonicalLocationName(pendingInitialLocation);
    const targetKey = normalizeBuildingKey(pendingInitialLocation);
    
    const match = allMapLocations.find((loc) => {
      const locName = getCanonicalLocationName(loc.location);
      if (locName === targetName) return true;
      if (normalizeBuildingKey(loc.location) === targetKey) return true;
      if (loc.shortName && normalizeBuildingKey(loc.shortName) === targetKey) return true;
      if (Array.isArray(loc.aliases) && loc.aliases.some(a => normalizeBuildingKey(a) === targetKey)) return true;
      return false;
    });
    if (!match) return;
    setSelectedId(getLocationSelectionId(match));
    setPendingInitialLocation(null);
    suppressNextOverviewFitRef.current = true;
  }, [allMapLocations, pendingInitialLocation]);

  useEffect(() => {
    if (!pendingInitialLocation || activeLayer !== "Pulse") return;
    const targetName = getCanonicalLocationName(pendingInitialLocation);
    const hotspotMatch = pulseHotspots.find(
      (hotspot) => getCanonicalLocationName(hotspot.locationName) === targetName,
    );
    if (!hotspotMatch) return;

    setSelectedHotspotId(hotspotMatch.id);
    setPendingInitialLocation(null);
    suppressNextOverviewFitRef.current = true;

    if (!mapRef.current) return;
    mapRef.current.animateToRegion(
      getPulseFocusRegion(hotspotMatch.coord.lat, hotspotMatch.coord.lng),
      PULSE_SELECTION_ANIMATION_MS,
    );
  }, [activeLayer, pendingInitialLocation, pulseHotspots]);

  useEffect(() => {
    if (activeLayer !== "Pulse" && selectedHotspotId) {
      setSelectedHotspotId(null);
    }
  }, [activeLayer, selectedHotspotId]);

  // Hydrate hub when tab needs it
  useEffect(() => {
    if (
      user?.id &&
      (activeLayer === "Rec" ||
        activeLayer === "Library" ||
        activeLayer === "Schedule")
    ) {
      hydrateCampusHub(user.id).catch(() => { });
    }
  }, [activeLayer, hydrateCampusHub, user?.id]);

  const hasFetchedInit = useRef(false);
  useEffect(() => {
    if (hasFetchedInit.current) return;

    const task = InteractionManager.runAfterInteractions(() => {
      hasFetchedInit.current = true;
      Promise.allSettled([
        refreshLocations(),
        fetchPulseHotspots(),
        Promise.resolve(refreshSchedules()),
      ]).catch(() => { });
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



  // Today selection should not auto-generate directions.
  useEffect(() => {
    setActiveWalkingRoute(null);
  }, [activeLayer, nextEntry, userCoord, selectedDate]);



  // Auto-fit map to filtered locations
  useEffect(() => {
    if (
      !mapRef.current ||
      activeLayer === "Bus" ||
      activeLayer === "Heatmap" ||
      activeLayer === "Today" ||
      activeLayer === "Pulse" ||
      selectedId ||
      sortedFilteredLocations.length === 0 ||
      (activeLayer === "Dining" && sortedFilteredLocations.every((l) => ("searchOnly" in l ? !!l.searchOnly : false)))
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
    if (user?.id) {
      try {
        initializeFeedUser(user);
      } catch (_) { }
    }
  }, [user]);

  // ── Render ────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapViewRNM
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={defaultCamera}
        showsUserLocation
        showsCompass={false}
        rotateEnabled={false}
        pitchEnabled
        onPanDrag={() => setHasManualMapMovement(true)}
        onRegionChangeComplete={(region) => {
          currentMapCenterRef.current = {
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
          };
          currentMapZoomRef.current = Math.min(
            MAX_RESTORE_CAMERA_ZOOM,
            Math.max(MIN_RESTORE_CAMERA_ZOOM, zoomFromLatitudeDelta(region.latitudeDelta)),
          );
        }}
        onPress={(e) => {
          // Only clear if we actually tapped the map background, not an annotation
          if (e.nativeEvent.action !== 'marker-press') {
            const hadSelection =
              !!selectedId || !!selectedHotspotId || !!selectedStop || !!selectedBus;
            const hadPulseHotspotSelection = !!selectedHotspotId;
            setSelectedId(null);
            setSelectedHotspotId(null);
            setSelectedStop(null);
            setSelectedBus(null);
            setNearestBusInfo(null);
            if (hadSelection) {
              if (hadPulseHotspotSelection) {
                suppressNextOverviewFitRef.current = true;
              }
            }
          }
        }}
      >

        {activeLayer === "Heatmap" &&
          CAMPUS_ZONES.map((zone) => {
            const density = getZoneDensity(zone);
            return (
              <MapCircleOverlay
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
          pulseHotspots.filter(h => h && h.coord && Number.isFinite(h.coord.lat) && Number.isFinite(h.coord.lng)).map((hotspot) => (
            <MapCircleOverlay
              key={`pulse-radius-${hotspot.id}`}
              id={`pulse-radius-${hotspot.id}`}
              center={{
                latitude: hotspot.coord.lat,
                longitude: hotspot.coord.lng,
              }}
              radiusMeters={(hotspot.radius || 100) * (1 + (hotspot.score || 0) * 0.15) * 0.05}
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
              const validPoints = (path.points || []).filter((pt: any) => pt && Number.isFinite(pt.latitude) && Number.isFinite(pt.longitude));
              return validPoints.length >= 2 ? (
                <MapPolylineOverlay
                  key={`path-${idx}`}
                  id={`path-${idx}`}
                  coordinates={validPoints}
                  color={getNeonColor(selectedRoute?.Color || "#007AFF")}
                  width={isSelected ? 6 : 4}
                />
              ) : null;
            })
            : (() => {
                const validPoints = routePatterns.filter((pt: any) => pt && Number.isFinite(pt.latitude) && Number.isFinite(pt.longitude));
                return validPoints.length >= 2 ? (
                  <MapPolylineOverlay
                    id="bus-route-pattern"
                    coordinates={validPoints}
                    color={getNeonColor(selectedRoute?.Color || "#007AFF")}
                    width={4}
                  />
                ) : null;
              })()
          )}
        {activeLayer === "Bus" &&
          isAllBusRoutesSelected &&
          Object.entries(allRoutePatternsById).map(([routeKey, pattern]) => {
            const route = busRoutes.find((r) => r.Key === routeKey);
            const validPoints = (pattern?.points || []).filter((pt: any) => pt && typeof pt.latitude === "number" && Number.isFinite(pt.latitude) && typeof pt.longitude === "number" && Number.isFinite(pt.longitude));
            return validPoints.length >= 2 ? (
              <MapPolylineOverlay
                key={routeKey}
                id={`all-route-${routeKey}`}
                coordinates={validPoints}
                color={getNeonColor(route?.Color || "#007AFF")}
                width={4}
              />
            ) : null;
          })}

        {/* Bus Layer: Vehicles and Stops */}
        {activeLayer === "Bus" && memoizedBusMarkers}

        {activeLayer === "Bus" &&
          busStops.map((stop) => {
            const sLat = stop.Latitude != null ? stop.Latitude : stop.lat;
            const sLng = stop.Longitude != null ? stop.Longitude : stop.lng;
            if (sLat == null || sLng == null || !Number.isFinite(sLat) || !Number.isFinite(sLng)) return null;

            const stopDir = stop.DirectionName || stop.direction || "Unknown";
            const stopSelected =
              selectedDirection === "All" ||
              isAllBusRoutesSelected ||
              (stopDir || "")
                .toLowerCase()
                .includes((selectedDirection || "All").toLowerCase());

            return (
              <MapMarker
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
                    { opacity: 1 },
                  ]}
                >
                  <View style={styles.busStopMarkerInner} />
                </View>
              </MapMarker>
            );
          })}




        {activeLayer === "Today" && activeWalkingRoute && (
          <MapPolylineOverlay
            id="walking-route"
            coordinates={activeWalkingRoute.polyline}
            color="#500000"
            width={4}
            lineDasharray={[1.5, 2.5]}
          />
        )}
        {activeLayer === "Pulse" &&
          pulseHotspots.filter(h => h && h.coord && Number.isFinite(h.coord.lat) && Number.isFinite(h.coord.lng)).map((hotspot) => {
            return (
              <MapMarker
                key={hotspot.id}
                id={`pulse-hotspot-${hotspot.id}`}
                coordinate={{
                  latitude: hotspot.coord.lat,
                  longitude: hotspot.coord.lng,
                }}
                onPress={() => handleSelectHotspot(hotspot)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.pulseMarkerWrap}>
                  <View
                    style={[
                      styles.pulseMarkerGlowOuter,
                      {
                        backgroundColor: `${hotspot.pulseColor}16`,
                      },
                    ]}
                  />
                  <View style={styles.pulseMarkerCluster}>
                    <View
                      style={[
                        styles.pulseMarkerGlowMid,
                        {
                          backgroundColor: `${hotspot.pulseColor}24`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.pulseMarkerGlowInner,
                        {
                          backgroundColor: `${hotspot.pulseColor}36`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.pulseMarkerCenterHalo,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.16)"
                            : "rgba(255,255,255,0.34)",
                          borderColor: `${hotspot.pulseColor}58`,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.pulseMarkerCore,
                          { backgroundColor: hotspot.pulseColor },
                        ]}
                      />
                      <View style={styles.pulseMarkerHighlight} />
                    </View>
                    {hotspot.commentCount > 0 && (
                      <View style={[styles.pulseCommentBadge, { backgroundColor: hotspot.pulseColor }]}>
                        <MessageCircle size={10} color="#FFFFFF" strokeWidth={3} />
                        <Text style={styles.pulseCommentBadgeText}>{hotspot.commentCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </MapMarker>
            );
          })}

        {activeLayer !== "Bus" &&
          markerLocations.map((loc) => {
            const isSelected = getLocationSelectionId(loc) === selectedId;
            const isTodayLayer = activeLayer === "Today";
            const visitorGarageIds = [
              "osm:way:91100311",
              "garage-polo",
              "osm:way:450686873",
              "garage-university-center",
              "garage-west-campus"
            ];
            const isVisitorParkingGarage = loc.type === "Parking" && (
              visitorGarageIds.includes(("placeId" in loc ? loc.placeId : "")) ||
              loc.location.includes("Central Campus Garage") ||
              loc.location.includes("Polo") ||
              loc.location.includes("Stallings") ||
              loc.location.includes("University Center Garage") ||
              loc.location.includes("West Campus Garage")
            );
            const isCapacityType = loc.type === "Library" || loc.type === "Rec" || isVisitorParkingGarage;

            const tracksChanges = isMapTransitionsStable || isSelected || !!selectedId || isCapacityType;

            const displayPercent =
              loc.capacity && loc.capacity > 0 && loc.current_count != null
                ? Math.round((loc.current_count / loc.capacity) * 100)
                : loc.percent_full != null && Number.isFinite(loc.percent_full)
                  ? loc.percent_full
                  : null;

            const isClosed = loc.hours_today?.toLowerCase().includes("closed") ||
                             loc.hours_holiday_notice?.toLowerCase().includes("closed");

            const pinColor = isTodayLayer
              ? getCategoryColor(loc.classMeetings?.[0]?.category)
              : isCapacityType
                ? (isClosed ? "#FF3B30" : getStatusColor(displayPercent))
                : COLORS.primary;
            const pinText =
              isTodayLayer && loc.sequenceIndex
                ? loc.sequenceIndex.toString()
                : null;

            if (loc.searchOnly && getLocationSelectionId(loc) !== selectedId) {
              return null;
            }

            if (!loc.coord || !Number.isFinite(loc.coord.lat) || !Number.isFinite(loc.coord.lng)) return null;

            return (
              <MapMarker
                key={`loc-${getLocationSelectionId(loc)}`}
                id={`loc-${getLocationSelectionId(loc)}`}
                coordinate={{
                  latitude: loc.coord.lat,
                  longitude: loc.coord.lng,
                }}
                onPress={() => {
                  setIsMapTransitionsStable(true);
                  handleSelectLocation(loc);
                }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={tracksChanges}
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
              </MapMarker>
            );
          })}
      </MapViewRNM>

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
            triggerNativeShare({
              title: "Campus Map",
              message: "Check out the live campus map on MaroonSchedules!",
              url: "https://maroonschedules.tamu.edu/places",
              type: "place",
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
                  setTemporaryBusFocusRouteId(null);
                  setIsRouteDropdownOpen(false);
                  setHasManualMapMovement(false);
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                            <Text style={[styles.nextUpLocation, { flex: 1 }]} numberOfLines={1}>
                              {nextEntry.locationLabel}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleGetDirections(nextEntry)}
                              style={[styles.nextUpDirectionsPill, { paddingVertical: 6, paddingHorizontal: 10 }]}
                              activeOpacity={0.85}
                            >
                              <Navigation size={13} color="#FFFFFF" />
                              <Text style={[styles.nextUpDirectionsPillText, { fontSize: 11 }]}>
                                {activeWalkingRoute?.estimatedTimeMinutes
                                  ? `Get Directions (${activeWalkingRoute.estimatedTimeMinutes} min)`
                                  : "Get Directions"}
                              </Text>
                            </TouchableOpacity>
                          </View>
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
                  handleSelectBusRoute={(routeId) => {
                    setTemporaryBusFocusRouteId(null);
                    handleSelectBusRoute(routeId);
                  }}
                  openBusTimetable={() => setIsTimetableSheetOpen(true)}
                  openTransitTripPlanner={() =>
                    navigation.navigate("TransitTripPlanner")
                  }
                  selectedDirection={selectedDirection}
                  setSelectedDirection={(value) =>
                    setSelectedDirection(value as "All" | "inbound" | "outbound")
                  }
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
                        ref={listDropdownScrollRef}
                        style={{ maxHeight: 320 }}
                        showsVerticalScrollIndicator={false}
                      >
                        {sortedFilteredLocations.map((loc) => {
                          const locCapacity = "capacity" in loc ? loc.capacity : null;
                          const locCurrentCount = "current_count" in loc ? loc.current_count : null;
                          const displayPercent =
                            locCapacity && locCapacity > 0 && locCurrentCount != null
                              ? Math.round((locCurrentCount / locCapacity) * 100)
                              : loc.percent_full != null && Number.isFinite(loc.percent_full)
                                ? loc.percent_full
                                : null;
                          const recUpdatedLabel =
                            loc.type === "Rec" &&
                            (("capacity_last_updated" in loc && loc.capacity_last_updated) ||
                              ("capacity_as_of" in loc && loc.capacity_as_of))
                              ? (() => {
                                  const raw =
                                    ("capacity_last_updated" in loc && loc.capacity_last_updated) ||
                                    ("capacity_as_of" in loc && loc.capacity_as_of);
                                  const parsed = new Date(
                                    String(raw).includes("T")
                                      ? String(raw)
                                      : String(raw).replace(" ", "T"),
                                  );
                                  return Number.isNaN(parsed.getTime())
                                    ? null
                                    : `Updated ${parsed.toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}`;
                                })()
                              : null;

                          const isRecCenterTourItem =
                            getCanonicalLocationName(loc.location) ===
                            getCanonicalLocationName("Student Recreation Center");

                          const visitorGarageIds = [
                            "osm:way:91100311",
                            "garage-polo",
                            "osm:way:450686873",
                            "garage-university-center",
                            "garage-west-campus"
                          ];
                          const isVisitorParkingGarage = loc.type === "Parking" && (
                            visitorGarageIds.includes(("placeId" in loc ? loc.placeId : "")) ||
                            loc.location.includes("Central Campus Garage") ||
                            loc.location.includes("Polo") ||
                            loc.location.includes("Stallings") ||
                            loc.location.includes("University Center Garage") ||
                            loc.location.includes("West Campus Garage")
                          );
                          const parkingAvailable = (loc as any).visitor_parking_available;

                          const item = (
                            <TouchableOpacity
                              key={`${('placeId' in loc && loc.placeId) || loc.location}-${loc.coord.lat}-${loc.coord.lng}`}
                              style={(styles as any).listDropdownItem}
                              onLayout={
                                isRecCenterTourItem
                                  ? (event) => {
                                    recCenterDropdownYRef.current =
                                      event.nativeEvent.layout.y;
                                    if (activeTargetName === "rec-center-item") {
                                      setTimeout(scrollToRecCenterDropdownItem, 0);
                                    }
                                  }
                                  : undefined
                              }
                              onPress={() => {
                                handleSelectLocation(loc);
                                setIsListDroppedDown(false);
                                if (
                                  isRecCenterTourItem &&
                                  activeTargetName === "rec-center-item"
                                ) {
                                  setTimeout(() => {
                                    advanceStep("rec-center-item");
                                  }, 0);
                                }
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
                                    displayPercent != null
                                    ? `${displayPercent}% full${recUpdatedLabel ? ` · ${recUpdatedLabel}` : ""} · `
                                    : isVisitorParkingGarage && parkingAvailable != null
                                      ? `${parkingAvailable.toLocaleString()} spaces available · `
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
                          );

                          if (!isRecCenterTourItem) {
                            return item;
                          }

                          return (
                            <TourTarget
                              key={`tour-${loc.location}`}
                              name="rec-center-item"
                              assistAction={() => {
                                handleSelectLocation(loc);
                                setIsListDroppedDown(false);
                                setTimeout(() => {
                                  advanceStep("rec-center-item");
                                }, 0);
                              }}
                            >
                              {item}
                            </TourTarget>
                          );
                        })}
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

      <PulseHotspotSheet
        visible={activeLayer === "Pulse" && !!selectedHotspot}
        hotspot={selectedHotspot}
        onClose={() => {
          suppressNextOverviewFitRef.current = true;
          setSelectedHotspotId(null);
        }}
        onOpenItem={openHotspotItem}
        onVote={toggleHotspotVote}
      />

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
        setSelectedStop={(stop) => {
          setSelectedStop(stop);
          if (!stop) {
            requestAnimationFrame(() => {
              if (temporaryBusFocusRouteId && !selectedBus) {
                restoreAllRoutesFromTemporaryFocus();
              } else {
                fitMapToActiveOverview();
              }
            });
          }
        }}
        nearestBusInfo={nearestBusInfo}
      />

      <BusVehicleInfoCard
        styles={styles}
        COLORS={COLORS}
        selectedBus={selectedBus && !selectedStop ? selectedBus : null}
        setSelectedBus={(bus) => {
          setSelectedBus(bus);
          if (!bus) {
            requestAnimationFrame(() => {
              if (temporaryBusFocusRouteId && !selectedStop) {
                restoreAllRoutesFromTemporaryFocus();
              } else {
                fitMapToActiveOverview();
              }
            });
          }
        }}
        selectedRoute={selectedRoute}
      />

      {/* Slidable lists / Dropdowns removed per user request - handled by Top Dropdown */}

      {/* Location bottom sheet */}
      <LocationBottomSheet
        styles={styles}
        COLORS={COLORS}
        isDark={isDark}
        selectedId={selectedId}
        setSelectedId={(id) => {
          setIsMapTransitionsStable(true);
          setSelectedId(id);
        }}
        selectedLoc={selectedLoc}
        foodCourtVenues={foodCourtVenues}
        diningMenuOptions={diningMenuOptions}
        activeDiningMenu={activeDiningMenu}
        setActiveDiningMenu={setActiveDiningMenu}
        activeDiningMealPeriod={activeDiningMealPeriod}
        setActiveDiningMealPeriod={setActiveDiningMealPeriod}
        activeDiningDate={activeDiningDate}
        setActiveDiningDate={setActiveDiningDate}
        diningMenuPreview={diningMenuPreview}
        isFetchingDining={isFetchingDining}
        isPrimaryDiningHallSelection={isPrimaryDiningHallSelection}
        openFullMenu={openFullMenu}
        openScheduleList={openScheduleList}
        selectedRecreationFacility={selectedRecreationFacility}
        recreationFacilityMap={recreationFacilityMap}
        openFacilityCounts={openFacilityCounts}
        navigation={navigation}
        getPlaceExternalLink={getPlaceExternalLink}
        selectedStop={selectedStop}
        selectedBus={selectedBus}
        openNavigationToLocation={openNavigationToLocation}
        isFetchingDetail={isFetchingDetail}
        trackerCounts={trackerCounts}
        onAddMeal={(item) => selectedLoc && addMealEntry(item, selectedLoc.location, getDiningMealPeriodForLocation(selectedLoc.location))}
        onRemoveMeal={(item) => selectedLoc && removeMealEntry(item, selectedLoc.location, getDiningMealPeriodForLocation(selectedLoc.location))}
        isSyncingTracker={isSyncingTracker}
        isCompact={isCompactDetail}
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
            setIsTimetableSheetOpen(false);
            handleStopPress(stop);
          }}
        />
      )}
    </View>
  );
}
