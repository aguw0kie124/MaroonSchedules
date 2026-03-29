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
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from "react-native";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
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
  getOrderedItems,
  isNavItemVisible,
  useAppShellStore,
} from "../store/appShellStore";
import {
  DiningMealPeriod,
  fetchDiningFullMenuCached,
  getDiningMealOptionsForLocation,
  getDiningMealPeriodForLocation,
  getDiningMenuCandidates,
} from "../services/diningMenuCache";
import axios from "axios";

// ── Sub-components ────────────────────────────────────────────
import { FloatingSearchBar } from "./places/FloatingSearchBar";
import { LayerPillScroller } from "./places/LayerPillScroller";
import { SearchOverlay } from "./places/SearchOverlay";
import {
  BusRouteSelector,
  BusStopInfoCard,
  BusVehicleInfoCard,
} from "./places/BusLayerUI";
import { LocationBottomSheet } from "./places/LocationBottomSheet";
import { PlacesList } from "./places/PlacesList";

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
  getCanonicalCoords,
  getZoneDensity,
} from "./places/campusData";
import {
  getStatusColor,
  haversineDistanceMeters,
  getParkingRecommendation,
  getCategoryIcon,
} from "./places/utils";
import { getStyles } from "./places/placesStyles";
import { LocateFixed, Orbit } from "lucide-react-native";

// ── Transitional: still uses inline hooks from original file
//    (replace with useLocationData / useScheduleMap / useBusTransit
//     in the follow-on cleanup pass)

export function PlacesMapScreen() {
  const { COLORS, theme } = useTheme();
  const isDark = theme === "dark";
  const styles = getStyles(COLORS, isDark);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  // ── App-shell store ───────────────────────────────────────
  const navItems = useAppShellStore((s) => s.navItems);
  const placesPills = useAppShellStore((s) => s.placesPills);
  const parkingPermit = useAppShellStore((s) => s.parkingPermit);
  const togglePlacesPill = useAppShellStore((s) => s.togglePlacesPill);
  const movePlacesPill = useAppShellStore((s) => s.movePlacesPill);
  const isStandaloneTransitScreen = route.name === "BusRoutes";
  const isStandaloneBusVisible = isNavItemVisible(navItems, "BusRoutes");

  const orderedPlacesPills = useMemo(
    () =>
      getOrderedItems(placesPills).filter(
        (item) =>
          !(item.id === "Bus" && !isStandaloneTransitScreen && isStandaloneBusVisible),
      ),
    [isStandaloneBusVisible, isStandaloneTransitScreen, placesPills],
  );
  const visiblePlacesPills = useMemo(
    () => orderedPlacesPills.filter((item) => item.visible),
    [orderedPlacesPills],
  );

  const campusHubSnapshot = useCampusHubStore((s) => s.snapshot);
  const hydrateCampusHub = useCampusHubStore((s) => s.hydrate);

  // ── Map ref ───────────────────────────────────────────────
  const mapRef = useRef<any>(null);
  const lastPlacesFitKey = useRef<string | null>(null);

  // ── UI state ──────────────────────────────────────────────
  const [activeLayer, setActiveLayer] = useState<string>("Schedule");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isMapTilted, setIsMapTilted] = useState(false);

  // ── Location data ─────────────────────────────────────────
  const fullCampusIndex = useMemo(() => buildCampusDirectory(), []);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/traffic/retrieve`);
      let fetched = res.data.filter((d: any) => d.coord);
      const hubs = [
        { location: "Memorial Student Center", type: "Hub", coord: getCanonicalCoords("Memorial Student Center", { lat: 30.6123, lng: -96.3415 }), percent_full: 45, is_live: false, hours: "7:00 AM – 10:00 PM" },
        { location: "Polo Road Garage Dining", type: "Hub", coord: getCanonicalCoords("Polo Road Garage Dining", { lat: 30.6235, lng: -96.3388 }), percent_full: 30, is_live: false, hours: "7:00 AM – 9:00 PM" },
        { location: "Sbisa Dining Hall", type: "Dining", coord: getCanonicalCoords("Sbisa Dining Hall", { lat: 30.617135, lng: -96.343777 }), percent_full: 60, is_live: false, hours: "10:00 AM – 8:00 PM" },
      ];
      const combined = [...fetched];
      hubs.forEach((h) => {
        if (!combined.find((c: any) => c.location.includes(h.location) || h.location.includes(c.location))) combined.push(h);
      });
      const trafficLocations = combined.map((loc: any) => {
        const canonicalName = getCanonicalLocationName(loc.location);
        const zone = CAMPUS_ZONES.find((z) => z.name === canonicalName);
        const resolvedCoord = getCanonicalCoords(canonicalName, loc.coord);
        return { ...loc, location: canonicalName, coord: resolvedCoord, ...(zone?.hours ? { hours: zone.hours } : {}), source: "traffic" as const };
      });
      const mergedMap = new Map<string, CampusLocation>();
      fullCampusIndex.forEach((l) => mergedMap.set(l.location, l));
      trafficLocations.forEach((loc: CampusLocation) => {
        const canonicalName = getCanonicalLocationName(loc.location);
        const existing = mergedMap.get(canonicalName) || mergedMap.get(loc.location);
        if (loc.location !== canonicalName && mergedMap.has(loc.location)) mergedMap.delete(loc.location);
        mergedMap.set(canonicalName, { ...existing, ...loc, location: canonicalName, coord: getCanonicalCoords(canonicalName, loc.coord), type: existing?.type || loc.type || "General", shortName: existing?.shortName || loc.shortName, description: existing?.description || loc.description });
      });
      setLocations(Array.from(mergedMap.values()));
    } catch (err) {
      console.warn("Failed to fetch traffic data", err);
      setLocations(fullCampusIndex);
    } finally {
      setLoading(false);
    }
  }, [fullCampusIndex]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Schedule state ────────────────────────────────────────
  const [savedSchedules, setSavedSchedules] = useState<any[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);

  // ── Bus state ─────────────────────────────────────────────
  const [busRoutes, setBusRoutes] = useState<any[]>([]);
  const [busVehicles, setBusVehicles] = useState<any[]>([]);
  const [busStops, setBusStops] = useState<any[]>([]);
  const [selectedBusRouteId, setSelectedBusRouteId] = useState<string | null>(ALL_BUS_ROUTES_KEY);
  const [routePatterns, setRoutePatterns] = useState<any[]>([]);
  const [allRoutePatternsById, setAllRoutePatternsById] = useState<Record<string, { points: any[]; stops: any[] }>>({});
  const [isFetchingBus, setIsFetchingBus] = useState(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [routeSearchQuery, setRouteSearchQuery] = useState("");
  const [busDestinationQuery, setBusDestinationQuery] = useState("");
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [nearestBusInfo, setNearestBusInfo] = useState<string | null>(null);
  const busPollInterval = useRef<any>(null);
  const isFetchingRef = useRef(false);
  const isAllBusRoutesSelected = !selectedBusRouteId || selectedBusRouteId === ALL_BUS_ROUTES_KEY;

  // ── Review / dining state ─────────────────────────────────
  const [streamReviews, setStreamReviews] = useState<any[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [isPostingReview, setIsPostingReview] = useState(false);
  const [allReviewsModalVisible, setAllReviewsModalVisible] = useState(false);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  const [hubRestaurants, setHubRestaurants] = useState<string[]>([]);
  const [isFetchingDining, setIsFetchingDining] = useState(false);
  const [diningMenuOptions, setDiningMenuOptions] = useState<string[]>([]);
  const [activeDiningMenu, setActiveDiningMenu] = useState<string | null>(null);
  const [activeDiningMealPeriod, setActiveDiningMealPeriod] = useState<DiningMealPeriod>("lunch");
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);

  // ── Recreation facility map ───────────────────────────────
  const recreationFacilityMap = useMemo(() => {
    const facilities = campusHubSnapshot?.recreation.facilities || [];
    return new Map(facilities.map((f: any) => [getCanonicalLocationName(f.name), f]));
  }, [campusHubSnapshot?.recreation.facilities]);

  // ── Category / pill bar ───────────────────────────────────
  const visibleCategories = useMemo(() => {
    const ordered: any[] = visiblePlacesPills
      .map((item) => CATEGORIES.find((c) => c.id === item.id))
      .filter((c) => c?.id !== "Academic" && c?.id !== "Heatmap")
      .filter((c) => c != null);
    if (!ordered.length) {
      return CATEGORIES.filter(
        (category) =>
          category.id !== "Academic" && category.id !== "Heatmap",
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
  const scheduleOptions = useMemo(() => {
    // (same logic as original — pulls from campusHubSnapshot + savedSchedules)
    const options: any[] = [];
    const uploadedCourses = campusHubSnapshot?.academic?.courses || [];
    if (uploadedCourses.length > 0) {
      const label = campusHubSnapshot?.academic?.scheduleName?.trim() || "Uploaded Schedule";
      const entries = uploadedCourses.map((course: any) => {
        const locationLabel = (course.location || "").trim();
        const [building, ...roomParts] = locationLabel.split(/\s+/);
        return { id: `uploaded:${course.id || course.code}`, code: course.code || "Class", name: course.name || "Untitled Class", building, room: roomParts.join(" ").trim(), days: Array.isArray(course.days) ? course.days : [], timeLabel: course.time || "Time TBA", locationLabel, scheduleLabel: label };
      });
      if (entries.length > 0) options.push({ id: "uploaded", label, source: "uploaded", entries });
    }
    savedSchedules.forEach((schedule: any) => {
      const scheduleLabel = schedule.name || "Saved Schedule";
      const entries = (schedule.sections || []).map((section: any) => {
        const meeting = (section.meetings || [])[0] || {};
        const building = (meeting.building || "").trim();
        const room = (meeting.room || "").trim();
        const locationLabel = `${building} ${room}`.trim();
        return { id: `saved:${schedule.schedule_id}:${section.section_id || section.id}`, code: `${section.dept || ""} ${section.courseNumber || ""}`.trim() || `Section ${section.sectionNumber || "TBA"}`, name: section.courseTitle || "Untitled Class", building, room, days: Array.isArray(meeting.daysOfWeek) ? meeting.daysOfWeek : [], timeLabel: meeting.beginTime && meeting.endTime ? `${meeting.beginTime}-${meeting.endTime}` : "Time TBA", locationLabel, scheduleLabel };
      });
      if (entries.length > 0) options.push({ id: `saved:${schedule.schedule_id}`, label: scheduleLabel, source: "saved", entries });
    });
    return options;
  }, [campusHubSnapshot?.academic?.courses, campusHubSnapshot?.academic?.scheduleName, savedSchedules]);

  const activeScheduleOption = useMemo(() => scheduleOptions.find((o) => o.id === activeScheduleId) || scheduleOptions[0] || null, [activeScheduleId, scheduleOptions]);

  const scheduleLocations = useMemo<CampusLocation[]>(() => {
    if (!activeScheduleOption) return [];
    const grouped = new Map<string, { building: any; classMeetings: any[] }>();
    activeScheduleOption.entries.forEach((entry: any) => {
      const { BUILDING_LOOKUP, normalizeBuildingKey } = require("./places/campusData");
      const building = BUILDING_LOOKUP.get(normalizeBuildingKey(entry.building)) || BUILDING_LOOKUP.get(normalizeBuildingKey(entry.locationLabel));
      if (!building) return;
      const canonicalName = getCanonicalLocationName(building.name);
      const existing = grouped.get(canonicalName);
      if (existing) { existing.classMeetings.push(entry); return; }
      grouped.set(canonicalName, { building, classMeetings: [entry] });
    });
    return Array.from(grouped.entries()).map(([locationName, group]) => {
      const existing = fullCampusIndex.find((l) => l.location === locationName);
      return { ...(existing || { location: locationName, percent_full: 0, type: "Academic" as LocationType, is_live: false, available_seats: null, coord: { lat: group.building.latitude, lng: group.building.longitude } }), location: locationName, shortName: group.building.shortName, percent_full: 0, type: "Academic" as LocationType, is_live: false, available_seats: null, coord: { lat: group.building.latitude, lng: group.building.longitude }, source: "schedule" as const, scheduleLabel: activeScheduleOption.label, description: `${group.classMeetings.length} class location${group.classMeetings.length === 1 ? "" : "s"} from ${activeScheduleOption.label}.`, classMeetings: group.classMeetings };
    });
  }, [activeScheduleOption, fullCampusIndex]);

  const allMapLocations = useMemo(() => {
    const merged = new Map<string, CampusLocation>();
    locations.forEach((l) => merged.set(l.location, l));
    scheduleLocations.forEach((l) => merged.set(l.location, { ...(merged.get(l.location) || {}), ...l }));
    return Array.from(merged.values());
  }, [locations, scheduleLocations]);

  const filteredLocations = useMemo(() => {
    if (activeLayer === "Heatmap") return [];
    if (activeLayer === "Schedule") return scheduleLocations;
    if (activeLayer === "Dining") return allMapLocations.filter((l) => l.type === "Dining" || l.type === "Hub");
    if (activeLayer === "Academic") return allMapLocations.filter((l) => l.type === "Academic" || l.type === "Landmark");
    if (activeLayer === "Study") return allMapLocations.filter((l) => l.type === "Study" || l.type === "Library");
    return allMapLocations.filter((l) => l.type === activeLayer);
  }, [activeLayer, allMapLocations, scheduleLocations]);

  const sortedFilteredLocations = useMemo(() => {
    return [...filteredLocations].sort((a, b) => {
      const aD = userCoord ? haversineDistanceMeters(userCoord.latitude, userCoord.longitude, a.coord.lat, a.coord.lng) : null;
      const bD = userCoord ? haversineDistanceMeters(userCoord.latitude, userCoord.longitude, b.coord.lat, b.coord.lng) : null;
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
    const q = searchQuery.toLowerCase();
    return allMapLocations
      .filter((l) => l.location.toLowerCase().includes(q) || (l.shortName || "").toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = a.location.toLowerCase().startsWith(q) ? 0 : 1;
        const bS = b.location.toLowerCase().startsWith(q) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return a.location.localeCompare(b.location);
      })
      .slice(0, 8);
  }, [allMapLocations, searchQuery]);

  const busDestinationResults = useMemo(() => {
    if (!busDestinationQuery.trim()) return [];
    const q = busDestinationQuery.toLowerCase();
    return allMapLocations.filter((l) => l.location.toLowerCase().includes(q) || (l.shortName || "").toLowerCase().includes(q)).slice(0, 6);
  }, [allMapLocations, busDestinationQuery]);

  const busPulseAnim = useRef(new Animated.Value(1)).current;

  const selectedLoc = useMemo(() => allMapLocations.find((l) => l.location === selectedId), [allMapLocations, selectedId]);
  const markerLocations = useMemo(() => {
    if (activeLayer === "Heatmap" || activeLayer === "Bus") return selectedLoc ? [selectedLoc] : [];
    const merged = new Map<string, CampusLocation>();
    filteredLocations.forEach((l) => merged.set(l.location, l));
    if (selectedLoc) merged.set(selectedLoc.location, selectedLoc);
    return Array.from(merged.values());
  }, [activeLayer, filteredLocations, selectedLoc]);

  const selectedRoute = useMemo(
    () => isAllBusRoutesSelected ? null : busRoutes.find((r) => r.Key === selectedBusRouteId) ?? null,
    [busRoutes, isAllBusRoutesSelected, selectedBusRouteId],
  );
  const busRouteOptions = useMemo(() => [{ Key: ALL_BUS_ROUTES_KEY, ShortName: "ALL", Name: "Show All Routes", Color: "#1E1E1E" }, ...busRoutes], [busRoutes]);
  const filteredBusRoutes = useMemo(() => {
    const q = routeSearchQuery.trim().toLowerCase();
    if (!q) return busRouteOptions;
    return busRouteOptions.filter((r) => (r.ShortName || "").toString().toLowerCase().includes(q) || (r.Name || "").toString().toLowerCase().includes(q));
  }, [busRouteOptions, routeSearchQuery]);

  const scheduleSummaryLabel = useMemo(() => {
    if (isLoadingSchedules) return "Loading your class map...";
    if (!activeScheduleOption) return "No schedule mapped yet";
    return `${activeScheduleOption.entries.length} class${activeScheduleOption.entries.length === 1 ? "" : "es"} across ${scheduleLocations.length} building${scheduleLocations.length === 1 ? "" : "s"}`;
  }, [activeScheduleOption, isLoadingSchedules, scheduleLocations.length]);

  const selectedRecreationFacility = useMemo(() => {
    if (!selectedLoc) return null;
    return recreationFacilityMap.get(getCanonicalLocationName(selectedLoc.location)) || null;
  }, [recreationFacilityMap, selectedLoc]);

  const isPrimaryDiningHallSelection = useMemo(() => {
    const ref = (activeDiningMenu || selectedLoc?.location || "").toLowerCase();
    return ref.includes("sbisa") || ref.includes("commons") || ref.includes("duncan");
  }, [activeDiningMenu, selectedLoc?.location]);

  const stopTimetable = useMemo(() => {
    if (activeLayer !== "Bus" || !selectedRoute || busStops.length === 0) return [];
    return busStops.slice(0, 12).map((stop, i) => {
      if (busVehicles.length === 0) return { stop, sequence: i + 1, etaLabel: "Route loaded", detail: "ETA pending" };
      const { getApproximateEtaMinutes } = require("./places/utils");
      const ranked = busVehicles.map((bus) => ({ bus, etaMinutes: getApproximateEtaMinutes(routePatterns, stop, bus) })).sort((a, b) => a.etaMinutes - b.etaMinutes);
      const next = ranked[0];
      if (!next) return { stop, sequence: i + 1, etaLabel: "No estimate", detail: "Live feed unavailable" };
      return { stop, sequence: i + 1, etaLabel: next.etaMinutes <= 1 ? "Now" : `${next.etaMinutes} min`, detail: next.bus.RouteShortName ? `Route ${next.bus.RouteShortName}` : next.bus.Name || "Live bus" };
    });
  }, [activeLayer, busStops, busVehicles, routePatterns, selectedRoute]);

  const allRouteBoards = useMemo(() => {
    if (!isAllBusRoutesSelected) return [];
    const { getApproximateEtaMinutes, isVehicleOnRoute } = require("./places/utils");
    return busRoutes.map((route) => {
      const pattern = allRoutePatternsById[route.Key];
      const routePoints = pattern?.points || [];
      const routeStops = pattern?.stops || [];
      const routeVehicles = busVehicles.filter((bus) => isVehicleOnRoute(bus, route));
      const entries = routeStops.slice(0, 4).map((stop: any, i: number) => {
        const ranked = routeVehicles.map((bus) => ({ bus, etaMinutes: getApproximateEtaMinutes(routePoints, stop, bus) })).sort((a: any, b: any) => a.etaMinutes - b.etaMinutes);
        const next = ranked[0];
        return { stop, sequence: i + 1, etaLabel: next ? (next.etaMinutes <= 1 ? "Now" : `${next.etaMinutes} min`) : "Route loaded", detail: next?.bus?.RouteShortName ? `Route ${next.bus.RouteShortName}` : route.Name || "Transit route" };
      });
      return { route, liveCount: routeVehicles.length, entries };
    }).filter((b: any) => b.entries.length > 0 || b.liveCount > 0);
  }, [allRoutePatternsById, busRoutes, busVehicles, isAllBusRoutesSelected]);

  const nearbyTransitInsight = useMemo(() => {
    if (!userCoord || activeLayer !== "Bus" || !selectedRoute) return null;
    const nearestStop = busStops.reduce((best: any, stop) => {
      const d = haversineDistanceMeters(userCoord.latitude, userCoord.longitude, stop.Latitude, stop.Longitude);
      return !best || d < best.distanceMeters ? { stop, distanceMeters: d } : best;
    }, null as any);
    const nearestVehicle = busVehicles.reduce((best: any, v) => {
      const d = haversineDistanceMeters(userCoord.latitude, userCoord.longitude, v.Latitude, v.Longitude);
      return !best || d < best.distanceMeters ? { vehicle: v, distanceMeters: d } : best;
    }, null as any);
    if ((!nearestStop || nearestStop.distanceMeters > 320) && (!nearestVehicle || nearestVehicle.distanceMeters > 380)) return null;
    return { nearestStop, nearestVehicle };
  }, [activeLayer, busStops, busVehicles, selectedRoute, userCoord]);

  // ── Callbacks ─────────────────────────────────────────────
  const getPlaceExternalLink = useCallback((loc: CampusLocation) => {
    const rec = recreationFacilityMap.get(getCanonicalLocationName(loc.location)) || null;
    if (rec?.source_url) return { label: "Open Official Page", url: rec.source_url };
    if (loc.type === "Dining" || loc.type === "Hub") return { label: "Dining Site", url: "https://dineoncampus.com/tamu" };
    if (loc.type === "Library" || loc.type === "Study") return { label: "Library Site", url: "https://library.tamu.edu/" };
    if (loc.type === "Parking") return { label: "Parking Guide", url: PARKING_INFO_URL };
    return { label: "Open in Maps", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.location} Texas A&M University`)}` };
  }, [recreationFacilityMap]);

  const openFullMenu = useCallback((locationName: string) => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    const params = { location: locationName, mealPeriod: getDiningMealPeriodForLocation(locationName), title: `${locationName} Menu`, sourceHint: "cached" };
    (rootNav?.navigate || navigation.navigate)("FullMenu", params);
  }, [navigation]);

  const openScheduleList = useCallback(() => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("ScheduleList");
  }, [navigation]);

  const openNewCourseSearch = useCallback(() => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("NewCourseSearch");
  }, [navigation]);

  const openBusTimetable = useCallback(() => {
    const params = isAllBusRoutesSelected
      ? { mode: "all", boards: allRouteBoards, liveBusCount: busVehicles.length }
      : { mode: "single", route: selectedRoute, entries: stopTimetable, liveBusCount: busVehicles.length, nearbyTransitInsight };
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    (rootNav?.navigate || navigation.navigate)("BusTimetable", params);
  }, [allRouteBoards, busVehicles.length, isAllBusRoutesSelected, navigation, nearbyTransitInsight, selectedRoute, stopTimetable]);

  const openNavigationToLocation = useCallback((loc: CampusLocation, mode: "walk" | "bus" = "walk") => {
    const rootNav = navigation.getParent?.("RootStack") || navigation.getParent?.();
    const params = { initialTravelMode: mode, initialDestination: { id: loc.location, name: loc.location, shortName: loc.shortName || loc.location, latitude: loc.coord.lat, longitude: loc.coord.lng, type: loc.type.toLowerCase() } };
    (rootNav?.navigate || navigation.navigate)("CampusNavigation", params);
  }, [navigation]);

  const fetchReviews = useCallback(async (placeId: string, limit = 5) => {
    if (limit > 5) setIsFetchingReviews(true);
    try {
      const { getPlaceReviews } = require("../services/streamFeeds");
      const revs = await getPlaceReviews(placeId, limit);
      setStreamReviews(revs);
    } catch (e) { console.warn("Failed to fetch stream reviews", e); }
    finally { setIsFetchingReviews(false); }
  }, []);

  const handlePostReview = useCallback(async () => {
    if (!selectedId || !newReviewText.trim() || newRating === 0) return;
    setIsPostingReview(true);
    try {
      const { postPlaceReview } = require("../services/streamFeeds");
      await postPlaceReview(selectedId, newRating, newReviewText.trim());
      setReviewModalVisible(false);
      setNewReviewText("");
      setNewRating(5);
      fetchReviews(selectedId);
    } catch (e) { console.warn("Failed to post review", e); }
    finally { setIsPostingReview(false); }
  }, [fetchReviews, newRating, newReviewText, selectedId]);

  const loadBestDiningPreview = useCallback(async (locationName: string, preferredMeal: DiningMealPeriod) => {
    const mealOptions = getDiningMealOptionsForLocation(locationName);
    const firstMeal = mealOptions.find((m) => m === preferredMeal) || mealOptions[0] || preferredMeal;
    const orderedMeals: DiningMealPeriod[] = [firstMeal, ...mealOptions.filter((m) => m !== firstMeal)];
    let fallbackPreview: any = null, fallbackMeal = firstMeal;
    for (const meal of orderedMeals) {
      const preview = await fetchDiningFullMenuCached({ location: locationName, mealPeriod: meal }).catch(() => null);
      if (!fallbackPreview) { fallbackPreview = preview; fallbackMeal = meal; }
      if (preview?.success && preview?.categories?.length) return { preview, meal };
    }
    return { preview: fallbackPreview, meal: fallbackMeal };
  }, []);

  const fetchDiningData = useCallback(async (loc: CampusLocation) => {
    setIsFetchingDining(true);
    try {
      const hubRes = await axios.get(`${API_URL}/dining/hubs/${encodeURIComponent(loc.location)}`).catch(() => null);
      const nextRestaurants = hubRes?.data && Array.isArray(hubRes.data.restaurants) ? hubRes.data.restaurants : [];
      setHubRestaurants(nextRestaurants);
      const menuCandidates = getDiningMenuCandidates(loc.location, nextRestaurants);
      setDiningMenuOptions(menuCandidates);
      const nextMenu = menuCandidates[0] || null;
      setActiveDiningMenu(nextMenu);
      setActiveDiningMealPeriod(nextMenu ? (getDiningMealPeriodForLocation(nextMenu) as DiningMealPeriod) : "lunch");
      setDiningMenuPreview(null);
    } catch (e) { console.warn("Failed to fetch dining data", e); }
    finally { setIsFetchingDining(false); }
  }, []);

  const handleSelectLocation = useCallback((loc: CampusLocation) => {
    setSelectedId(loc.location);
    setIsSearchExpanded(false);
    setSearchQuery("");
    setShowSearchResults(false);
    if (mapRef.current) {
      mapRef.current.animateToRegion({ latitude: loc.coord.lat - 0.001, longitude: loc.coord.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    }
  }, []);

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
    if (!routesToLoad.length) { setAllRoutePatternsById({}); setBusVehicles([]); return; }
    const patternEntries = await Promise.all(routesToLoad.map(async (r) => [r.Key, await transitService.getRoutePattern(r.Key)] as const));
    const nextPatterns = patternEntries.reduce((acc, [k, p]) => { acc[k] = p; return acc; }, {} as any);
    setAllRoutePatternsById(nextPatterns);
    const vehicles = await transitService.getVehicles();
    setBusVehicles(vehicles);
    setBusStops([]); setRoutePatterns([]);
    const allPoints = patternEntries.flatMap(([, p]: any) => p.points || []);
    if (mapRef.current && allPoints.length > 0) mapRef.current.fitToCoordinates(allPoints, { edgePadding: { top: 220, right: 60, bottom: 110, left: 60 }, animated: true });
  }, []);

  const handleSelectBusRoute = useCallback(async (routeId: string, availableRoutes: any[] = busRoutes) => {
    setSelectedBusRouteId(routeId); setSelectedStop(null); setSelectedBus(null);
    if (routeId === ALL_BUS_ROUTES_KEY) { await loadAllBusRoutes(availableRoutes); return; }
    try {
      const { points, stops } = await transitService.getRoutePattern(routeId);
      setRoutePatterns(points?.length ? points : []);
      setBusStops(stops?.length ? stops : []);
      if (mapRef.current && points?.length) mapRef.current.fitToCoordinates(points, { edgePadding: { top: 220, right: 60, bottom: 80, left: 60 }, animated: true });
      setBusVehicles(await transitService.getVehicles(routeId));
    } catch (e) { console.warn("Failed to select bus route", e); }
  }, [busRoutes, loadAllBusRoutes]);

  const { getClosestProgressMeters, haversineDistanceMeters: hav, formatBusDistance } = require("./places/utils");
  const resolveNearestBusForStop = useCallback((stop: any, vehicles: any[]) => {
    if (!stop || vehicles.length === 0) { setNearestBusInfo(selectedRoute ? "Route loaded" : "Transit route loaded"); return; }
    const stopProgress = getClosestProgressMeters(routePatterns, { latitude: stop.Latitude, longitude: stop.Longitude });
    const ranked = vehicles.map((bus) => {
      const direct = hav(bus.Latitude, bus.Longitude, stop.Latitude, stop.Longitude);
      if (!stopProgress) return { bus, distanceMeters: direct };
      const busProgress = getClosestProgressMeters(routePatterns, { latitude: bus.Latitude, longitude: bus.Longitude });
      if (!busProgress) return { bus, distanceMeters: direct };
      const delta = Math.abs(stopProgress.progressMeters - busProgress.progressMeters);
      const wrapped = stopProgress.totalRouteMeters > 0 ? Math.min(delta, stopProgress.totalRouteMeters - delta) : delta;
      return { bus, distanceMeters: Math.min(direct, wrapped + stopProgress.offsetMeters + busProgress.offsetMeters) };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);
    const nearest = ranked[0];
    if (!nearest) { setNearestBusInfo(selectedRoute ? "Route loaded" : "Transit route loaded"); return; }
    setSelectedBus(nearest.bus);
    const eta = Math.max(1, Math.round(nearest.distanceMeters / 220));
    const label = nearest.bus.RouteShortName ? `Route ${nearest.bus.RouteShortName}` : nearest.bus.Name ? `Bus ${nearest.bus.Name}` : undefined;
    setNearestBusInfo(formatBusDistance(nearest.distanceMeters, eta, label));
  }, [routePatterns, selectedRoute]);

  const handleStopPress = useCallback((stop: any) => {
    setSelectedStop(stop); setSelectedBus(null); setNearestBusInfo("Finding closest bus...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resolveNearestBusForStop(stop, busVehicles);
  }, [busVehicles, resolveNearestBusForStop]);

  // ── Effects ───────────────────────────────────────────────
  // Location permissions + GPS watch
  useEffect(() => {
    let mounted = true, watcher: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!mounted || perm.status !== "granted") return;
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoord({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
        if (!mounted || !mapRef.current) return;
        mapRef.current.animateToRegion({ latitude: cur.coords.latitude, longitude: cur.coords.longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }, 700);
        watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 15000 }, (pos) => { if (mounted) setUserCoord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); });
      } catch (e) { console.warn("Unable to center on current location", e); }
    })();
    return () => { mounted = false; watcher?.remove(); };
  }, []);

  // Keep active layer valid
  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === activeLayer)) setActiveLayer(visibleCategories[0]?.id || "Bus");
  }, [activeLayer, visibleCategories]);

  // Route param: initialLayer focus
  useEffect(() => {
    const nextLayer = route.params?.initialLayer;
    const token = route.params?.focusToken;
    if (!nextLayer || !token) return;
    setActiveLayer(nextLayer); setSelectedId(null); setSelectedStop(null); setSelectedBus(null); setNearestBusInfo(null); setIsSearchExpanded(false); setSearchQuery(""); setShowSearchResults(false);
  }, [route.params?.focusToken, route.params?.initialLayer]);

  // Hydrate hub when tab needs it
  useEffect(() => {
    if (user?.id && (activeLayer === "Rec" || activeLayer === "Library" || activeLayer === "Schedule")) {
      hydrateCampusHub(user.id).catch(() => {});
    }
  }, [activeLayer, hydrateCampusHub, user?.id]);

  // Pulse animation for Bus layer
  useEffect(() => {
    if (activeLayer === "Bus") {
      Animated.loop(Animated.sequence([
        Animated.timing(busPulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(busPulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
      ])).start();
    }
  }, [activeLayer, busPulseAnim]);

  // Fetch saved schedules
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) { setSavedSchedules([]); setIsLoadingSchedules(false); return; }
    setIsLoadingSchedules(true);
    const { fetchSchedules } = require("../api/client");
    fetchSchedules(user.id).then((data: any) => { if (!cancelled) setSavedSchedules(Array.isArray(data) ? data : []); }).catch(() => { if (!cancelled) setSavedSchedules([]); }).finally(() => { if (!cancelled) setIsLoadingSchedules(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Sync active schedule
  useEffect(() => {
    if (scheduleOptions.length === 0) { if (activeScheduleId !== null) setActiveScheduleId(null); return; }
    if (!activeScheduleId || !scheduleOptions.some((o: any) => o.id === activeScheduleId)) setActiveScheduleId(scheduleOptions[0].id);
  }, [activeScheduleId, scheduleOptions]);

  // Bus fetch on layer switch
  useEffect(() => {
    if (activeLayer === "Bus") {
      (async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true; setIsFetchingBus(true);
        try {
          const metadata = await transitService.getRoutesMetadata();
          const activeIds = await transitService.getActiveRoutes();
          const active = metadata.filter((m: any) => activeIds.includes(m.ShortName) || activeIds.includes(m.Key) || activeIds.includes(m.Name));
          const final = active.length ? active : metadata;
          setBusRoutes(final);
          const valid = final.some((r: any) => r.Key === selectedBusRouteId);
          if (final.length && (isAllBusRoutesSelected || !selectedBusRouteId || !valid)) handleSelectBusRoute(ALL_BUS_ROUTES_KEY, final);
        } catch (e) { console.warn("Failed to fetch bus routes", e); }
        finally { setIsFetchingBus(false); isFetchingRef.current = false; }
      })();
    }
  }, [activeLayer]);

  // Bus polling
  useEffect(() => {
    if (activeLayer === "Bus" && selectedBusRouteId) {
      busPollInterval.current = setInterval(async () => {
        const updated = isAllBusRoutesSelected ? await transitService.getVehicles() : await transitService.getVehicles(selectedBusRouteId);
        setBusVehicles(updated);
      }, 5000);
    } else { if (busPollInterval.current) clearInterval(busPollInterval.current); }
    return () => { if (busPollInterval.current) clearInterval(busPollInterval.current); };
  }, [activeLayer, isAllBusRoutesSelected, selectedBusRouteId]);

  // Update nearest bus when vehicles change
  useEffect(() => {
    if (activeLayer === "Bus" && selectedStop) resolveNearestBusForStop(selectedStop, busVehicles);
  }, [activeLayer, busVehicles, routePatterns, selectedStop, resolveNearestBusForStop]);

  // Auto-fit map to filtered locations
  useEffect(() => {
    if (!mapRef.current || activeLayer === "Bus" || activeLayer === "Heatmap" || selectedId || sortedFilteredLocations.length === 0) return;
    const fitKey = `${activeLayer}:${sortedFilteredLocations.length}:${sortedFilteredLocations[0]?.location || ""}`;
    if (lastPlacesFitKey.current === fitKey) return;
    lastPlacesFitKey.current = fitKey;
    const points = sortedFilteredLocations.slice(0, 18).map((l) => ({ latitude: l.coord.lat, longitude: l.coord.lng }));
    if (points.length === 1) { mapRef.current.animateToRegion({ latitude: points[0].latitude - 0.0018, longitude: points[0].longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 650); return; }
    mapRef.current.fitToCoordinates(points, { edgePadding: { top: 210, right: 48, bottom: 250, left: 48 }, animated: true });
  }, [activeLayer, selectedId, sortedFilteredLocations]);

  // Sheet selection - fetch reviews + dining on select
  useEffect(() => {
    if (selectedId) {
      fetchReviews(selectedId);
    } else {
      setStreamReviews([]); setHubRestaurants([]); setDiningMenuOptions([]); setActiveDiningMenu(null); setActiveDiningMealPeriod("lunch"); setDiningMenuPreview(null);
    }
  }, [selectedId, fetchReviews]);

  useEffect(() => {
    if (!selectedLoc || (selectedLoc.type !== "Dining" && selectedLoc.type !== "Hub")) { setHubRestaurants([]); setDiningMenuOptions([]); setActiveDiningMenu(null); setDiningMenuPreview(null); return; }
    fetchDiningData(selectedLoc);
  }, [selectedLoc, fetchDiningData]);

  useEffect(() => {
    if (!activeDiningMenu) return;
    let cancelled = false;
    setIsFetchingDining(true);
    loadBestDiningPreview(activeDiningMenu, activeDiningMealPeriod).then(({ preview, meal }) => {
      if (!cancelled) { if (meal !== activeDiningMealPeriod) setActiveDiningMealPeriod(meal); setDiningMenuPreview(preview); }
    }).catch((e) => console.warn("Failed to load dining menu preview", e)).finally(() => { if (!cancelled) setIsFetchingDining(false); });
    return () => { cancelled = true; };
  }, [activeDiningMealPeriod, activeDiningMenu, loadBestDiningPreview]);

  // Connect Stream feeds user
  useEffect(() => {
    if (user?.id) connectFeedsUser(user.id).catch(() => {});
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

        {/* Bus route polylines */}
        {activeLayer === "Bus" && !isAllBusRoutesSelected && routePatterns.length > 0 && (
          <Polyline coordinates={routePatterns} strokeColor={selectedRoute?.Color || "#007AFF"} strokeWidth={4} />
        )}
        {activeLayer === "Bus" && isAllBusRoutesSelected &&
          Object.entries(allRoutePatternsById).map(([routeKey, pattern]) => {
            const route = busRoutes.find((r) => r.Key === routeKey);
            return pattern.points.length > 0 ? (
              <Polyline key={routeKey} coordinates={pattern.points} strokeColor={route?.Color || "#007AFF"} strokeWidth={3} />
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
        {activeLayer === "Bus" && busVehicles.map((bus, i) => (
          <Marker
            key={`bus-${bus.Name || i}`}
            coordinate={{ latitude: bus.Latitude, longitude: bus.Longitude }}
            onPress={() => { setSelectedBus(bus); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Animated.View style={[styles.busVehicleMarker, { transform: [{ scale: busPulseAnim }] }]}>
              <View style={styles.busVehicleMarkerInner} />
            </Animated.View>
          </Marker>
        ))}

        {/* Campus location markers */}
        {activeLayer !== "Bus" && markerLocations.map((loc) => {
          const isSelected = loc.location === selectedId;
          const statusColor = getStatusColor(loc.percent_full);
          return (
            <Marker
              key={`loc-${loc.location}`}
              coordinate={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
              onPress={() => handleSelectLocation(loc)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={{ alignItems: "center", transform: [{ scale: isSelected ? 1.2 : 1.0 }] }}>
                <View style={[styles.markerPin, { backgroundColor: isSelected ? statusColor : COLORS.primary }]}>
                   {getCategoryIcon(loc.type, "#FFFFFF", isSelected ? 18 : 16)}
                </View>
                <View style={[styles.markerPinLeg, { borderTopColor: isSelected ? statusColor : COLORS.primary }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top UI Floating Elements */}
      <View style={[styles.topContainer, { top: Math.max(insets.top + 10, 54) }]}>
        <FloatingSearchBar
          styles={styles}
          COLORS={COLORS}
          isSearchExpanded={isSearchExpanded}
          setIsSearchExpanded={setIsSearchExpanded}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setShowSearchResults={setShowSearchResults}
          onOpenSettings={() => setIsEditorVisible(true)}
        />

        <SearchOverlay
          styles={styles}
          COLORS={COLORS}
          searchResults={searchResults}
          isSearchExpanded={isSearchExpanded}
          showSearchResults={showSearchResults}
          onSelectLocation={handleSelectLocation}
        />

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

      {/* Bus layer UI */}
      {activeLayer === "Bus" && (
        <BusRouteSelector
          styles={styles}
          COLORS={COLORS}
          busRoutes={busRoutes}
          selectedBusRouteId={selectedBusRouteId}
          selectedRoute={selectedRoute}
          isAllBusRoutesSelected={isAllBusRoutesSelected}
          isRouteDropdownOpen={isRouteDropdownOpen}
          setIsRouteDropdownOpen={setIsRouteDropdownOpen}
          routeSearchQuery={routeSearchQuery}
          setRouteSearchQuery={setRouteSearchQuery}
          filteredBusRoutes={filteredBusRoutes}
          handleSelectBusRoute={handleSelectBusRoute}
          openBusTimetable={openBusTimetable}
          busDestinationQuery={busDestinationQuery}
          setBusDestinationQuery={setBusDestinationQuery}
          busDestinationResults={busDestinationResults}
          openNavigationToLocation={openNavigationToLocation}
          selectedStop={selectedStop}
          setSelectedStop={setSelectedStop}
          selectedBus={selectedBus}
          setSelectedBus={setSelectedBus}
          nearestBusInfo={nearestBusInfo}
          handleStopPress={handleStopPress}
        />
      )}
      </View>

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

      {/* List view */}
      <PlacesList
        styles={styles}
        COLORS={COLORS}
        activeLayer={activeLayer}
        selectedId={selectedId}
        sortedFilteredLocations={sortedFilteredLocations}
        scheduleOptions={scheduleOptions}
        activeScheduleOption={activeScheduleOption}
        scheduleSummaryLabel={scheduleSummaryLabel}
        isLoadingSchedules={isLoadingSchedules}
        setActiveScheduleId={setActiveScheduleId}
        setSelectedId={setSelectedId}
        openScheduleList={openScheduleList}
        openNewCourseSearch={openNewCourseSearch}
        userCoord={userCoord}
        parkingPermit={parkingPermit}
        recreationFacilityMap={recreationFacilityMap}
        handleSelectLocation={handleSelectLocation}
      />

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
      />

      {/* Module editor modal */}
      {isEditorVisible && (
        <PageModuleEditor
          visible={isEditorVisible}
          onClose={() => setIsEditorVisible(false)}
          title="Places"
          items={getOrderedItems(placesPills).filter(
            (item) => item.id !== "Academic" && item.id !== "Heatmap",
          )}
          onToggle={togglePlacesPill}
          onMove={movePlacesPill}
        />
      )}
    </View>
  );
}
