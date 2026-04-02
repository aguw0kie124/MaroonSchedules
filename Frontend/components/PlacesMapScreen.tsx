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
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  ScrollView,
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
import MapView, {
  Marker,
  Circle,
  Polyline,
} from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { connectFeedsUser } from "../services/streamFeeds";
import { API_URL } from "../config";
import { useCampusHubStore } from "../store/campusHubStore";
import {
  getOrderedVisibleItems,
  useAppShellStore,
} from "../store/appShellStore";
import { useShareStore } from "../store/shareStore";
import { fetchCampusPlacesMap } from "../api/client";
import {
  DiningMealPeriod,
  fetchDiningFullMenuCached,
  getDiningMealOptionsForLocation,
  getDiningMealPeriodForLocation,
  isDiningHallMenuLocation,
  getDiningMenuCandidates,
} from "../services/diningMenuCache";

// ── Sub-components ────────────────────────────────────────────
import { FloatingSearchBar } from "./places/FloatingSearchBar";
import { LayerPillScroller } from "./places/LayerPillScroller";
import { SearchOverlay } from "./places/SearchOverlay";
import {
  BusRouteSelector,
  BusStopInfoCard,
  BusVehicleInfoCard,
} from "./places/BusLayerUI";
import { PulseHotspotSheet } from "./places/PulseHotspotSheet";
import { LocationBottomSheet } from "./places/LocationBottomSheet";
import { ScheduleHeader } from "./places/ScheduleHeader";
import { PlacesList } from "./places/PlacesList";
import { TodayTimeline } from "./places/TodayTimeline";
import { useScheduleMap } from "./places/useScheduleMap";

// ── Shared data / utilities ───────────────────────────────────
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
  buildCampusDirectory,
  getCanonicalLocationName,
  getZoneDensity,
} from "./places/campusData";
import {
  getStatusColor,
  getCategoryColor,
  haversineDistanceMeters,
  getDistanceLabel,
  getParkingRecommendation,
  getCategoryIcon,
  getLayerForPlace,
} from "./places/utils";
import { getStyles } from "./places/placesStyles";
import {
  fetchCampusPulseMap,
  type CampusHotspot,
} from "../services/campusPulse";

// ── Transitional: still uses inline hooks from original file
//    (replace with useLocationData / useScheduleMap / useBusTransit
//     in the follow-on cleanup pass)

import { useBusTransit } from "./places/useBusTransit";
import { useLocationData } from "./places/useLocationData";
import { usePulseData } from "./places/usePulseData";
import { useMapLocations } from "./places/useMapLocations";
import { usePlaceDetails } from "./places/usePlaceDetails";

export function PlacesMapScreen() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(COLORS, isDark);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = Dimensions.get("window");

  const { 
    placesPills, 
    parkingPermit, 
    togglePlacesPill, 
    movePlacesPill 
  } = useAppShellStore();
  
  const visiblePlacesPills = useMemo(
    () => getOrderedVisibleItems(placesPills),
    [placesPills],
  );

  const campusHubSnapshot = useCampusHubStore((s) => s.snapshot);

  // ── Map ref ───────────────────────────────────────────────
  const mapRef = useRef<any>(null);
  const [isListDroppedDown, setIsListDroppedDown] = useState(false);

  // ── Unified Map UI State ─────────────────────────────────
  const [activeLayer, setActiveLayer] = useState<string>("Pulse");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isMapTilted, setIsMapTilted] = useState(false);
  const [pendingInitialLocation, setPendingInitialLocation] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeWalkingRoute, setActiveWalkingRoute] = useState<WalkingRoute | null>(null);
  const [isTodayExpanded, setIsTodayExpanded] = useState(false);

  // ── Unified Hooks ────────────────────────────────────────
  const { locations, loading, fullCampusIndex } = useLocationData();

  const {
    scheduleOptions,
    activeScheduleOption,
    scheduleLocations,
    isLoadingSchedules,
    nextEntry,
    activeScheduleId,
    setActiveScheduleId
  } = useScheduleMap(locations, selectedDate);

  const {
    busRoutes,
    busVehicles,
    busStops,
    selectedBusRouteId,
    setSelectedBusRouteId,
    selectedRoute,
    isAllBusRoutesSelected,
    routePatterns,
    allRoutePatternsById,
    isFetchingBus,
    isRouteDropdownOpen,
    setIsRouteDropdownOpen,
    selectedStop,
    setSelectedStop,
    selectedBus,
    setSelectedBus,
    nearestBusInfo,
    setNearestBusInfo,
    handleSelectBusRoute,
    stopTimetable,
    allRouteBoards,
    getNearbyTransitInsight,
    filteredBusRoutes,
  } = useBusTransit(activeLayer, mapRef);

  const {
    pulseHotspots,
    isLoadingPulse,
    selectedHotspotId: derivedHotspotId,
    setSelectedHotspotId: setDerivedHotspotId,
    selectedHotspot,
    fetchPulseHotspots,
    handleSelectHotspot,
    busPulseAnim
  } = usePulseData(activeLayer, locations, mapRef, isMapTilted);

  const {
    sortedFilteredLocations,
    allMapLocations,
    selectedLoc,
    markerLocations,
    filteredLocations
  } = useMapLocations(
    locations,
    scheduleLocations,
    activeLayer,
    userCoord,
    parkingPermit,
    selectedId
  );

  const {
    streamReviews,
    reviewModalVisible,
    setReviewModalVisible,
    newRating,
    setNewRating,
    newReviewText,
    setNewReviewText,
    isPostingReview,
    allReviewsModalVisible,
    setAllReviewsModalVisible,
    isFetchingReviews,
    hubRestaurants,
    isFetchingDining,
    diningMenuOptions,
    activeDiningMenu,
    setActiveDiningMenu,
    activeDiningMealPeriod,
    setActiveDiningMealPeriod,
    diningMenuPreview,
    setDiningMenuPreview,
    handlePostReview,
    fetchReviews,
    fetchDiningData,
    loadBestDiningPreview
  } = usePlaceDetails(selectedId, locations);

  // ── UI Handlers ──────────────────────────────────────────
  const handleSelectLocation = useCallback((loc: CampusLocation) => {
    setDerivedHotspotId(null);
    setSelectedId(loc.location);
    setSelectedStop(null);
    setSelectedBus(null);
    setIsSearchExpanded(false);
    setSearchQuery("");
    setShowSearchResults(false);
    
    if (mapRef.current && loc.coord) {
      mapRef.current.animateCamera({
        center: { latitude: loc.coord.lat, longitude: loc.coord.lng },
        zoom: 16.5,
        pitch: isMapTilted ? 55 : 0,
        heading: 0
      }, { duration: 600 });
    }
  }, [isMapTilted, setDerivedHotspotId]);

  const centerOnUserLocation = useCallback(async () => {
    try {
      let nextCoord = userCoord;
      if (!nextCoord) {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        nextCoord = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setUserCoord(nextCoord);
      }
      if (!nextCoord || !mapRef.current) return;
      mapRef.current.animateCamera({
        center: nextCoord,
        zoom: 16.5,
        pitch: isMapTilted ? 55 : 0,
        heading: 0
      }, { duration: 700 });
    } catch (e) {
      console.warn("Unable to center on user location", e);
    }
  }, [isMapTilted, userCoord]);

  const toggleMapPitch = useCallback(() => {
    const nextTilted = !isMapTilted;
    setIsMapTilted(nextTilted);
    if (!mapRef.current) return;
    const center = userCoord || TAMU_CENTER;
    mapRef.current.animateCamera({
      center,
      pitch: nextTilted ? 55 : 0,
      zoom: userCoord ? 16.5 : 15.5,
      heading: 0
    }, { duration: 500 });
  }, [isMapTilted, userCoord]);

  const openNavigationToLocation = useCallback((loc: CampusLocation, mode: "walk" | "bus" = "walk") => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    const params = {
      initialTravelMode: mode,
      initialDestination: {
        id: loc.location,
        name: loc.location,
        shortName: loc.shortName || loc.location,
        latitude: loc.coord.lat,
        longitude: loc.coord.lng,
        type: loc.type.toLowerCase()
      }
    };
    (rootNav?.navigate || navigation.navigate)("CampusNavigation", params);
  }, [navigation]);

  const openBusTimetable = useCallback(() => {
    const params = isAllBusRoutesSelected ? {
      mode: "all",
      boards: allRouteBoards,
      liveBusCount: busVehicles.length
    } : {
      mode: "single",
      route: selectedRoute,
      entries: stopTimetable,
      liveBusCount: busVehicles.length,
      nearbyTransitInsight: getNearbyTransitInsight(userCoord)
    };
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("BusTimetable", params);
  }, [allRouteBoards, busVehicles.length, isAllBusRoutesSelected, navigation, getNearbyTransitInsight, userCoord, selectedRoute, stopTimetable]);

  const openFullMenu = useCallback((locationName: string) => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    const params = {
      location: locationName,
      mealPeriod: getDiningMealPeriodForLocation(locationName),
      title: `${locationName} Menu`,
      sourceHint: "cached"
    };
    (rootNav?.navigate || navigation.navigate)("FullMenu", params);
  }, [navigation]);

  const openHotspotPlace = useCallback((hotspot: CampusHotspot) => {
    if (!hotspot.place) {
      if (mapRef.current) {
        mapRef.current.animateCamera({
          center: { latitude: hotspot.coord.lat, longitude: hotspot.coord.lng },
          zoom: 16.4,
          pitch: isMapTilted ? 55 : 0,
          heading: 0
        }, { duration: 650 });
      }
      return;
    }
    setActiveLayer(getLayerForPlace(hotspot.place));
    handleSelectLocation(hotspot.place);
  }, [handleSelectLocation, isMapTilted]);

  const openHotspotItem = useCallback(async (hotspot: CampusHotspot, item: CampusHotspot["items"][number]) => {
    if (item.source === "event" && item.link) {
      try {
        await Linking.openURL(item.link);
        return;
      } catch (error) {
        console.warn("Failed to open event link", error);
      }
    }
    openHotspotPlace(hotspot);
  }, [openHotspotPlace]);

  const recreationFacilityMap = useMemo(() => {
    const facilities = campusHubSnapshot?.recreation.facilities || [];
    return new Map(facilities.map((f: any) => [getCanonicalLocationName(f.name), f]));
  }, [campusHubSnapshot?.recreation.facilities]);

  const getPlaceExternalLink = useCallback((loc: CampusLocation) => {
    const rec = recreationFacilityMap.get(getCanonicalLocationName(loc.location)) || null;
    if (rec?.source_url) return { label: "Open Official Page", url: rec.source_url };
    if (loc.type === "Dining" || loc.type === "Hub") return { label: "Dining Site", url: "https://dineoncampus.com/tamu" };
    if (loc.type === "Library" || loc.type === "Study") return { label: "Library Site", url: "https://library.tamu.edu/" };
    if (loc.type === "Parking") return { label: "Parking Guide", url: PARKING_INFO_URL };
    return { label: "Open in Maps", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.location} Texas A&M University`)}` };
  }, [recreationFacilityMap]);

  // ── Formatting Utilities ──────────────────────────────────
  const formatDate = (date: Date) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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

  const selectedRecreationFacility = useMemo(() => {
    if (!selectedLoc) return null;
    return recreationFacilityMap.get(getCanonicalLocationName(selectedLoc.location)) || null;
  }, [recreationFacilityMap, selectedLoc]);

  const isPrimaryDiningHallSelection = useMemo(() => {
    const ref = (activeDiningMenu || selectedLoc?.location || "").toLowerCase();
    return ref.includes("sbisa") || ref.includes("commons") || ref.includes("duncan");
  }, [activeDiningMenu, selectedLoc?.location]);

  const visibleCategories = useMemo(() => {
    const ordered: any[] = visiblePlacesPills
      .map((item) => CATEGORIES.find((c) => c.id === item.id))
      .filter((c) => c?.id !== "Academic" && c?.id !== "Heatmap")
      .filter((c) => c != null);
    if (!ordered.length) {
      return CATEGORIES.filter((category) => category.id !== "Academic" && category.id !== "Heatmap");
    }
    const active = CATEGORIES.find((c) => c.id === activeLayer);
    if (active && active.id !== "Academic" && active.id !== "Heatmap" && !ordered.some((c) => c.id === active.id)) {
      return [active, ...ordered];
    }
    return ordered;
  }, [activeLayer, visiblePlacesPills]);

  // ── Effects ───────────────────────────────────────────────
  
  // Permissions + Watcher
  useEffect(() => {
    let mounted = true;
    let watcher: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted || status !== "granted") return;
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoord({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
          (pos) => { if (mounted) setUserCoord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); }
        );
      } catch (e) { console.warn("Location error", e); }
    })();
    return () => { mounted = false; watcher?.remove(); };
  }, []);

  // Sync active schedule
  useEffect(() => {
    if (scheduleOptions.length === 0) {
      if (activeScheduleId !== null) setActiveScheduleId(null);
      return;
    }
    if (!activeScheduleId || !scheduleOptions.some((o: any) => o.id === activeScheduleId)) {
      setActiveScheduleId(scheduleOptions[0].id);
    }
  }, [activeScheduleId, scheduleOptions, setActiveScheduleId]);

  // Hydrate hub when tab needs it
  const campusHubStore = useCampusHubStore();
  useEffect(() => {
    if (user?.id && (activeLayer === "Rec" || activeLayer === "Library")) {
      campusHubStore.hydrate(user.id).catch(() => {});
    }
  }, [activeLayer, user?.id, campusHubStore]);

  // Auto-fit map to data
  useEffect(() => {
    if (!mapRef.current || selectedId || derivedHotspotId) return;

    let coords: { latitude: number; longitude: number }[] = [];

    if (activeLayer === "Bus") {
      if (isAllBusRoutesSelected) {
        coords = busVehicles.map(v => ({ latitude: v.Latitude, longitude: v.Longitude }));
      } else {
        coords = routePatterns;
      }
    } else if (activeLayer === "Pulse") {
      coords = pulseHotspots.map(h => ({ latitude: h.coord.lat, longitude: h.coord.lng }));
    } else if (activeLayer === "Today") {
      coords = sortedFilteredLocations.map(l => ({ latitude: l.coord.lat, longitude: l.coord.lng }));
    } else if (sortedFilteredLocations.length > 0 && sortedFilteredLocations.length < 40) {
      coords = sortedFilteredLocations.map(l => ({ latitude: l.coord.lat, longitude: l.coord.lng }));
    }

    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 220, right: 60, bottom: 120, left: 60 },
        animated: true
      });
    }
  }, [activeLayer, sortedFilteredLocations, busVehicles, routePatterns, pulseHotspots, selectedId, derivedHotspotId, isAllBusRoutesSelected]);

  // Layer valid sync
  useEffect(() => {
    if (!visibleCategories.some(c => c.id === activeLayer)) {
      setActiveLayer(visibleCategories[0]?.id || "Pulse");
    }
  }, [activeLayer, visibleCategories]);

  // Transition Handlers
  const handleStopPress = useCallback((stop: any) => {
    setSelectedStop(stop);
    setSelectedBus(null);
    setNearestBusInfo("Finding closest bus...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [setSelectedStop, setSelectedBus, setNearestBusInfo]);

  const openScheduleList = useCallback(() => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("ScheduleList");
  }, [navigation]);

  // Connect Stream feeds user
  useEffect(() => {
    if (user?.id) connectFeedsUser(user.id).catch(() => { });
  }, [user]);

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={TAMU_CENTER}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Heatmap circles */}
        {activeLayer === "Heatmap" &&
          CAMPUS_ZONES.map((zone) => {
            const density = getZoneDensity(zone);
            return (
              <Circle
                key={zone.name}
                center={{ latitude: zone.lat, longitude: zone.lng }}
                radius={zone.radius}
                fillColor={
                  density >= 70 ? "rgba(255,59,48,0.22)" :
                    density >= 40 ? "rgba(255,149,0,0.18)" :
                      "rgba(50,215,75,0.14)"
                }
                strokeColor={
                  density >= 70 ? "rgba(255,59,48,0.5)" :
                    density >= 40 ? "rgba(255,149,0,0.45)" :
                      "rgba(50,215,75,0.4)"
                }
                strokeWidth={1.5}
              />
            );
          })}

        {activeLayer === "Pulse" &&
          pulseHotspots.map((hotspot) => (
            <Circle
              key={`pulse-radius-${hotspot.id}`}
              center={{
                latitude: hotspot.coord.lat,
                longitude: hotspot.coord.lng,
              }}
              radius={hotspot.radius}
              fillColor={`${hotspot.pulseColor}22`}
              strokeColor={`${hotspot.pulseColor}66`}
              strokeWidth={1.5}
            />
          ))}

        {/* Bus route polylines */}
        {activeLayer === "Bus" && !isAllBusRoutesSelected && routePatterns.length > 0 && (
          <Polyline coordinates={routePatterns} strokeColor={selectedRoute?.Color || "#007AFF"} strokeWidth={6} />
        )}
        {activeLayer === "Bus" && isAllBusRoutesSelected &&
          Object.entries(allRoutePatternsById).map(([routeKey, pattern]) => {
            const route = busRoutes.find((r) => r.Key === routeKey);
            return pattern.points.length > 0 ? (
              <Polyline key={routeKey} coordinates={pattern.points} strokeColor={route?.Color || "#007AFF"} strokeWidth={6} />
            ) : null;
          })}

        {/* Bus stops */}
        {activeLayer === "Bus" && busStops.map((stop) => (
          <Marker
            key={`stop-${stop.StopCode || stop.Name}`}
            coordinate={{ latitude: stop.Latitude, longitude: stop.Longitude }}
            onPress={() => handleStopPress(stop)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.busStopMarker}>
              <View style={styles.busStopMarkerInner} />
            </View>
          </Marker>
        ))}

        {/* Bus vehicles */}
        {activeLayer === "Bus" && busVehicles.map((bus, i) => {
          const isTrackedBus = selectedBus?.Name === bus.Name;
          const routeShortName = bus.routeShortName || bus.RouteShortName || selectedRoute?.ShortName || "";
          const routeColor = bus.routeColor || bus.RouteColor || selectedRoute?.Color || "#007AFF";

          const hasDash = routeShortName.includes("-");
          return (
            <Marker
              key={`bus-${bus.Id || bus.Name || i}`}
              coordinate={{ latitude: bus.Latitude || bus.lat, longitude: bus.Longitude || bus.lng }}
              onPress={() => { setSelectedBus(bus); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={isTrackedBus ? 1000 : 500}
            >
              <View style={[
                styles.busMarker,
                {
                  backgroundColor: routeColor,
                  transform: [
                    { rotate: `${bus.heading || bus.Heading || 0}deg` },
                    { scale: isTrackedBus ? 1.15 : 1 }
                  ]
                }
              ]}>
                <View style={{ 
                  transform: [{ rotate: `-${bus.heading || bus.Heading || 0}deg` }],
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 2
                }}>
                  <Text 
                    style={[
                      styles.busMarkerText, 
                      hasDash && { fontSize: 11, letterSpacing: -0.5 }
                    ]} 
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {routeShortName}
                  </Text>
                </View>
              </View>
            </Marker>
          );
        })}

        {/* Walking Route Polyline */}
        {activeLayer === "Today" && activeWalkingRoute && (
          <Polyline
            coordinates={activeWalkingRoute.polyline}
            strokeColor="#500000"
            strokeWidth={4}
            lineDashPattern={[5, 10]}
          />
        )}

        {activeLayer === "Pulse" &&
          pulseHotspots.map((hotspot) => {
            const isSelected = hotspot.id === derivedHotspotId;
            return (
              <Marker
                key={hotspot.id}
                coordinate={{
                  latitude: hotspot.coord.lat,
                  longitude: hotspot.coord.lng,
                }}
                onPress={() => handleSelectHotspot(hotspot)}
                anchor={{ x: 0.5, y: 0.66 }}
                zIndex={isSelected ? 1100 : 900}
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
              </Marker>
            );
          })}

        {/* Campus location markers */}
        {activeLayer !== "Bus" && markerLocations.map((loc) => {
          const isSelected = loc.location === selectedId;
          const isTodayLayer = activeLayer === "Today";
          const pinColor = isTodayLayer
            ? getCategoryColor(loc.classMeetings?.[0]?.category)
            : getStatusColor(loc.percent_full);
          const pinText = isTodayLayer && loc.sequenceIndex ? loc.sequenceIndex.toString() : null;

          return (
            <Marker
              key={`loc-${loc.location}`}
              coordinate={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
              onPress={() => handleSelectLocation(loc)}
              anchor={{ x: 0.5, y: 1 }}
            >
              {isTodayLayer ? (
                <View style={[(styles as any).numberedPinContainer, { transform: [{ scale: isSelected ? 1.2 : 1.0 }] }]}>
                  <View style={[(styles as any).numberedPinHead, { backgroundColor: pinColor }]}>
                    <Text style={(styles as any).numberedPinNumber}>{pinText || "•"}</Text>
                  </View>
                  <View style={[(styles as any).numberedPinTail, { borderTopColor: pinColor }]} />
                </View>
              ) : (
                <View style={{ alignItems: "center", transform: [{ scale: isSelected ? 1.2 : 1.0 }] }}>
                  <View style={[styles.markerPin, { backgroundColor: pinColor }]}>
                    {getCategoryIcon(loc.type, "#FFFFFF", isSelected ? 18 : 16)}
                  </View>
                  <View style={[styles.markerPinLeg, { borderTopColor: pinColor }]} />
                </View>
              )}
            </Marker>
          );
        })}
      </MapView>

      {/* Top UI Floating Elements */}
      <View style={[styles.topContainer, { top: 54, alignItems: "center" }]}>
        <FloatingSearchBar
          styles={styles}
          COLORS={COLORS}
          isSearchExpanded={isSearchExpanded}
          setIsSearchExpanded={setIsSearchExpanded}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setShowSearchResults={setShowSearchResults}
          onOpenSettings={() => setIsEditorVisible(true)}
          onShare={() => useShareStore.getState().openShare({
            title: "Campus Map",
            message: "Check out the live campus map on MaroonSchedules!",
            url: "https://maroonschedules.tamu.edu/places"
          })}
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <TouchableOpacity onPress={handlePrevDay}>
                        <ChevronLeft size={18} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                      <Text style={styles.dateNavTitle}>{formatDate(selectedDate)}</Text>
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
                  <ScrollView 
                    style={{ maxHeight: isTodayExpanded ? 400 : 200 }} 
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.nextUpCardBody}>
                      {isTodayExpanded ? (
                        <TodayTimeline
                          styles={styles}
                          COLORS={COLORS}
                          activeScheduleOption={activeScheduleOption}
                          onGetDirections={(building) => {
                            const loc = allMapLocations.find((l: any) =>
                              l.location === building ||
                              l.shortName === building ||
                              l.location.includes(building)
                            );
                            if (loc) openNavigationToLocation(loc);
                          }}
                        />
                      ) : nextEntry ? (
                        <View style={styles.nextUpMainRow}>
                          <View style={styles.nextUpTimeBox}>
                            <Text style={styles.nextUpTimeText}>{nextEntry.timeLabel}</Text>
                          </View>
                          <View style={styles.nextUpContent}>
                            <Text style={styles.nextUpTitle} numberOfLines={1}>{nextEntry.name}</Text>
                            <Text style={styles.nextUpLocation} numberOfLines={1}>{nextEntry.locationLabel}</Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <TouchableOpacity
                              style={styles.nextUpDirectionsPill}
                              onPress={() => {
                                const loc = allMapLocations.find((l: any) =>
                                  l.location === nextEntry.building ||
                                  l.shortName === nextEntry.building ||
                                  l.location.includes(nextEntry.building)
                                );
                                if (loc) {
                                  openNavigationToLocation(loc);
                                } else {
                                  openNavigationToLocation({
                                    location: nextEntry.building,
                                    type: "Building",
                                    coord: (nextEntry as any).lat ? { lat: (nextEntry as any).lat, lng: (nextEntry as any).lng } : { lat: 30.6181, lng: -96.3365 }
                                  } as any);
                                }
                              }}
                            >
                              <Navigation size={14} color="#FFFFFF" />
                              <Text style={styles.nextUpDirectionsPillText}>Directions</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.nextUpShareIcon}
                              onPress={() => useShareStore.getState().openShare({
                                title: nextEntry.name,
                                message: `Heading to ${nextEntry.name} at ${nextEntry.locationLabel}!`,
                                url: "https://maroonschedules.tamu.edu"
                              })}
                            >
                              <Share2 size={16} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={{ alignItems: "center", paddingVertical: 12 }}>
                          <Text style={[styles.nextUpTitle, { marginBottom: 2 }]}>All done for today!</Text>
                          <Text style={styles.nextUpLocation}>Nothing else in your schedule</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
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
                  openBusTimetable={() => navigation.navigate("BusTimetable")}
                  openTransitTripPlanner={() => navigation.navigate("TransitTripPlanner")}
                  selectedStop={selectedStop}
                  setSelectedStop={setSelectedStop}
                  selectedBus={selectedBus}
                  setSelectedBus={setSelectedBus}
                  nearestBusInfo={nearestBusInfo}
                  handleStopPress={handleStopPress}
                />
              </View>
            )}

            {activeLayer !== "Today" && activeLayer !== "Bus" && activeLayer !== "Pulse" && (
              <View style={{ marginTop: 12, width: "100%", alignItems: "flex-start" }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[(styles as any).listDropdownHeader, isListDroppedDown && (styles as any).listDropdownHeaderOpen]}
                  onPress={() => setIsListDroppedDown(!isListDroppedDown)}
                >
                  <Text style={(styles as any).listDropdownLabel}>List View</Text>
                  <ChevronDown 
                    size={18} 
                    color={COLORS.textPrimary} 
                    style={{ marginLeft: 8, transform: [{ rotate: isListDroppedDown ? "180deg" : "0deg" }] }}
                  />
                </TouchableOpacity>

                {isListDroppedDown && (
                  <View style={[(styles as any).listDropdownContent, { width: SCREEN_WIDTH - 32 }]}>
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
                            <Text style={(styles as any).listDropdownItemTitle} numberOfLines={1}>{loc.location}</Text>
                            <Text style={(styles as any).listDropdownItemSub} numberOfLines={1}>
                              {loc.percent_full != null ? `${loc.percent_full}% full · ` : ""}{loc.type}
                            </Text>
                          </View>
                          <ChevronRight size={16} color={COLORS.textTertiary} />
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
        <TouchableOpacity
          style={styles.mapFab}
          onPress={centerOnUserLocation}
        >
          <LocateFixed size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapFab}
          onPress={toggleMapPitch}
        >
          <Orbit size={22} color={isMapTilted ? COLORS.primary : COLORS.textPrimary} />
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
        onClose={() => setDerivedHotspotId(null)}
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
        hubRestaurants={hubRestaurants}
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
          items={getOrderedVisibleItems(placesPills).filter(
            (item) => item.id !== "Academic" && item.id !== "Heatmap",
          )}
          onToggle={togglePlacesPill}
          onMove={movePlacesPill}
        />
      )}
      {/* Global Search Results Overlay rendered at the end for top-level z-index */}
      <SearchOverlay
        styles={styles}
        COLORS={COLORS}
        searchResults={fullCampusIndex.filter(loc =>
          loc.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.shortName?.toLowerCase().includes(searchQuery.toLowerCase())
        )}
        busRouteResults={busRoutes.filter(route =>
          route.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          route.ShortName?.toLowerCase().includes(searchQuery.toLowerCase())
        )}
        isSearchExpanded={isSearchExpanded}
        showSearchResults={showSearchResults}
        onSelectLocation={(loc) => {
          handleSelectLocation(loc);
          setIsSearchExpanded(false);
          setShowSearchResults(false);
        }}
        onSelectBusRoute={(route) => {
          setActiveLayer("Bus");
          handleSelectBusRoute(route.Key);
          setIsSearchExpanded(false);
          setShowSearchResults(false);
        }}
      />
    </View>
  );
}
