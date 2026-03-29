import { getStyles } from "./map/PlacesMapStyles";
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
  SNAP_PEEK,
  SNAP_FULL,
  SNAP_HIDDEN,
  SHEET_BOTTOM_OFFSET,
  FLOATING_CARD_BOTTOM_OFFSET,
  ALL_BUS_ROUTES_KEY,
  ROOM_RESERVATION_URL,
  PARKING_INFO_URL,
  EVENTS_URL,
  TAMU_CENTER,
  CANONICAL_LOCATION_ALIASES,
  BUILDING_COORDS,
  AMENITY_COORDS,
  getCanonicalLocationName,
  getCanonicalCoords,
  DARK_MAP_STYLE,
  CAMPUS_ZONES,
  getTimeOfDayFactor,
  getZoneDensity,
  LocationType,
  CampusLocation,
  STATIC_LOCATION_META,
  mapBuildingType,
  mapAmenityType,
  buildCampusDirectory,
  CATEGORIES,
  getCategoryIcon,
  getStatusColor,
  getCategoryPillIcon,
  getDistanceLabel,
  getStopLabel,
  getParkingRecommendation,
  getLocationContextLink,
  haversineDistanceMeters,
  toLocalXY,
  getClosestProgressMeters,
  formatBusDistance,
  getApproximateEtaMinutes,
  isVehicleOnRoute,
} from "./map/PlacesMapUtils";
import { useTheme, Card } from "./SharedUI";
import { PageModuleEditor } from "./PageModuleEditor";
import {
  MapPin,
  Navigation,
  Info,
  Utensils,
  Star,
  X,
  ChevronRight,
  TrafficCone,
  Library,
  Dumbbell,
  Clock,
  MessageSquare,
  Plus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar,
  Flame,
  Layers,
  Search,
  MessageSquarePlus,
  Bus,
  GraduationCap,
  Cog,
} from "lucide-react-native";
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
  PlacesViewMode,
  getOrderedItems,
  isNavItemVisible,
  useAppShellStore,
} from "../store/appShellStore";
import {
  fetchDiningFullMenuCached,
  getDiningMealPeriodForLocation,
  getDiningMenuCandidates,
} from "../services/diningMenuCache";

export function PlacesMapScreen() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(COLORS, theme === "dark");
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const navItems = useAppShellStore((state) => state.navItems);
  const placesPills = useAppShellStore((state) => state.placesPills);
  const movePlacesPill = useAppShellStore((state) => state.movePlacesPill);
  const parkingPermit = useAppShellStore((state) => state.parkingPermit);
  const placesViewMode = useAppShellStore((state) => state.placesViewMode);
  const setPlacesViewMode = useAppShellStore(
    (state) => state.setPlacesViewMode,
  );
  const togglePlacesPill = useAppShellStore((state) => state.togglePlacesPill);
  const isStandaloneTransitScreen = route.name === "BusRoutes";
  const isStandaloneBusVisible = isNavItemVisible(navItems, "BusRoutes");
  const orderedPlacesPills = useMemo(
    () =>
      getOrderedItems(placesPills).filter(
        (item) =>
          !(
            item.id === "Bus" &&
            !isStandaloneTransitScreen &&
            isStandaloneBusVisible
          ),
      ),
    [isStandaloneBusVisible, isStandaloneTransitScreen, placesPills],
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
  const [routePatterns, setRoutePatterns] = useState<any[]>([]);
  const [allRoutePatternsById, setAllRoutePatternsById] = useState<
    Record<string, { points: any[]; stops: any[] }>
  >({});
  const [isFetchingBus, setIsFetchingBus] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [routeSearchQuery, setRouteSearchQuery] = useState("");
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const busPollInterval = useRef<any>(null);
  const { user } = useUser();
  const campusHubSnapshot = useCampusHubStore((state) => state.snapshot);
  const hydrateCampusHub = useCampusHubStore((state) => state.hydrate);
  const mapRef = useRef<any>(null);
  const lastPlacesFitKey = useRef<string | null>(null);
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

    return busStops.slice(0, 12).map((stop, index) => {
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
    const activeIndex = Math.max(
      0,
      visibleCategories.findIndex((category) => category.id === activeLayer),
    );
    Animated.spring(indicatorAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      tension: 260,
      friction: 28,
    }).start();
  }, [activeLayer, indicatorAnim, visibleCategories]);

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
      animateSheet(SNAP_PEEK);
      fetchReviews(selectedId);
    } else {
      animateSheet(SNAP_HIDDEN);
      setStreamReviews([]);
      setHubRestaurants([]);
      setDiningMenuOptions([]);
      setActiveDiningMenu(null);
      setDiningMenuPreview(null);
    }
  }, [selectedId, animateSheet]);

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

    const nextPatterns = patternEntries.reduce(
      (acc, [routeKey, pattern]) => {
        acc[routeKey] = pattern;
        return acc;
      },
      {} as Record<string, { points: any[]; stops: any[] }>,
    );
    setAllRoutePatternsById(nextPatterns);

    const vehicles = await transitService.getVehicles();
    setBusVehicles(vehicles);
    setBusStops([]);
    setRoutePatterns([]);

    const allPoints = patternEntries.flatMap(
      ([, pattern]) => pattern.points || [],
    );
    if (mapRef.current && allPoints.length > 0) {
      mapRef.current.fitToCoordinates(allPoints, {
        edgePadding: { top: 220, right: 60, bottom: 110, left: 60 },
        animated: true,
      });
    }
  }, []);

  const isFetchingRef = useRef(false);
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
      if (!stop || vehicles.length === 0) {
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

      setSelectedBus(nearestBus.bus);
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

  const handleStopPress = (stop: any) => {
    setSelectedStop(stop);
    setSelectedBus(null);
    setNearestBusInfo("Finding closest bus...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resolveNearestBusForStop(stop, busVehicles);
  };

  const handleSelectBusRoute = useCallback(
    async (routeId: string, availableRoutes: any[] = busRoutes) => {
      console.log("[Transit] Selecting route:", routeId);
      setSelectedBusRouteId(routeId);
      setSelectedStop(null);
      setSelectedBus(null);

      if (routeId === ALL_BUS_ROUTES_KEY) {
        await loadAllBusRoutes(availableRoutes);
        return;
      }

      try {
        const { points, stops } = await transitService.getRoutePattern(routeId);
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

        if (mapRef.current && points.length > 0) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 220, right: 60, bottom: 80, left: 60 },
            animated: true,
          });
        }

        const vehicles = await transitService.getVehicles(routeId);
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
              animateSheet(SNAP_HIDDEN, () => setSelectedId(null));
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
            animateSheet(SNAP_HIDDEN, () => setSelectedId(null));
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
      }));

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

    const rootNavigation =
      navigation.getParent?.("RootStack") || navigation.getParent?.();
    if (rootNavigation?.navigate) {
      rootNavigation.navigate("BusTimetable", params);
      return;
    }

    navigation.navigate("BusTimetable", params);
  }, [
    allRouteBoards,
    busVehicles.length,
    isAllBusRoutesSelected,
    navigation,
    nearbyTransitInsight,
    selectedRoute,
    stopTimetable,
  ]);

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
        {activeLayer === "Heatmap" ? (
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
          })
        ) : null}

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

        {activeLayer === "Bus" ? (
          isAllBusRoutesSelected ? (
            busRoutes.map((route) => {
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
                  strokeWidth={4}
                  lineDashPattern={[0]}
                />
              );
            })
          ) : routePatterns.length > 0 ? (
            <Polyline
              coordinates={routePatterns}
              strokeColor={
                selectedRoute?.Color ||
                transitService.getRouteColor(selectedBusRouteId || "")
              }
              strokeWidth={6}
              lineDashPattern={[0]}
            />
          ) : null
        ) : null}

        {/* Transit Layer: Bus Stops (MaroonRides Style: Blue Pins) */}
        {activeLayer === "Bus" && !isAllBusRoutesSelected ? (
          busStops.map((stop, idx) => (
            <Marker
              key={`stop-${stop.StopCode || idx}`}
              coordinate={{
                latitude: stop.Latitude,
                longitude: stop.Longitude,
              }}
              onPress={() => handleStopPress(stop)}
              tracksViewChanges={false}
              zIndex={100}
            >
              <View style={styles.busStopPin}>
                <MapPin size={16} color="#FFF" />
              </View>
            </Marker>
          ))
        ) : null}

        {/* Transit Layer: Bus Vehicles (MaroonRides Style: Bus Icons with Number) */}
        {activeLayer === "Bus" ? (
          busVehicles.map((bus) => {
            const isTrackedBus = selectedBus?.Key === bus.Key;
            return (
              <Marker
                key={`bus-${bus.Key}-${isTrackedBus ? "tracked" : "untracked"}`}
                coordinate={{
                  latitude: bus.Latitude,
                  longitude: bus.Longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={isTrackedBus ? 240 : 200}
                flat={true}
                onPress={() => {
                  setSelectedBus(bus);
                  setSelectedStop(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <View
                  style={[
                    styles.busMarker,
                    {
                      backgroundColor:
                        bus.RouteColor || selectedRoute?.Color || "#500000",
                      transform: [
                        { rotate: `${bus.Heading}deg` },
                        { scale: isTrackedBus ? 1.18 : 1 },
                      ],
                    },
                    isTrackedBus && {
                      backgroundColor: "#C99700",
                      borderColor: "#FFFFFF",
                    },
                  ]}
                >
                  <View
                    style={{ transform: [{ rotate: `-${bus.Heading}deg` }] }}
                  >
                    <Text
                      style={[
                        styles.busMarkerText,
                        isTrackedBus && { color: "#2B1100" },
                      ]}
                    >
                      {bus.RouteShortName || selectedRoute?.ShortName || ""}
                    </Text>
                  </View>
                </View>
              </Marker>
            );
          })
        ) : null}

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
              {(["map", "list"] as PlacesViewMode[]).map((mode) => {
                const selected = placesViewMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.viewModeButton,
                      selected && styles.viewModeButtonActive,
                    ]}
                    onPress={() => setPlacesViewMode(mode)}
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

      {/* ── Google Maps-style Bottom Sheet ─────────────────────────────── */}
      {selectedId && !selectedStop && !selectedBus && (
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
