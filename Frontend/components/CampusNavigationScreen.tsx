import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Pressable,
  Animated,
  Vibration,
  Keyboard,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { CampusSearchBar } from './CampusSearchBar';
import { CampusDirectionsPanel } from './CampusDirectionsPanel';
import { CampusBottomSheet } from './CampusBottomSheet';
import { MapPin } from 'lucide-react-native';
import {
  BUILDINGS,
  TAMU_CENTER,
  DEFAULT_USER_LOCATION,
} from '../data/campus';
import {
  createRoute,
  computeDistanceMeters,
  formatDistance,
  formatTime,
  buildDirectionSteps,
  WalkingRoute,
  DirectionStep,
  Coordinate,
  findNearestAmenity,
} from '../services/campusDirections';
import {
  CampusSearchResult,
  searchCampus,
  getPinnedItems,
  getNearbyItems,
} from '../services/campusSearch';

import { buildTransitPlan, CampusTransitPlan } from '../services/campusTransitRouting';
import type { CampusLocation } from './places/types';
import { buildExpandedPlacesDirectory, getLocationSelectionId } from './places/campusData';
import { getCategoryColor, getCategoryIcon } from './places/utils';
import { buildGlobalRoute, isCoordinateNearTexasAM, searchGlobalPlaces } from '../services/globalMap';
import {
  MapMarker,
  MapPolylineOverlay,
  useMapCamera,
} from './map/mapUtils';

type NavMode = 'idle' | 'selected' | 'navigating';
type TravelMode = 'walk' | 'drive' | 'bus';

type ManualOrigin = {
  name: string;
  coordinate: Coordinate;
};

type SeededLocationParams = {
  id?: string;
  name?: string;
  shortName?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
};

type NavigationDestination = {
  type: 'location';
  location: CampusLocation;
  name: string;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const CAMPUS_DISCOVERY_RADIUS_METERS = 20000;
const AUTO_DRIVE_DISTANCE_METERS = 5000;

function coerceSeededLocationType(type?: string): CampusLocation['type'] {
  switch ((type || '').toLowerCase()) {
    case 'library':
      return 'Library';
    case 'rec':
    case 'recreation':
      return 'Rec';
    case 'dining':
      return 'Dining';
    case 'hub':
      return 'Hub';
    case 'parking':
      return 'Parking';
    case 'landmark':
      return 'Landmark';
    case 'housing':
      return 'Housing';
    case 'athletics':
      return 'Athletics';
    case 'general':
      return 'General';
    default:
      return 'Academic';
  }
}

function getSeededDestination(initialDestination?: SeededLocationParams) {
  if (!initialDestination?.name || initialDestination.latitude == null || initialDestination.longitude == null) {
    return null;
  }

  return {
    type: 'location' as const,
    name: initialDestination.name,
    location: {
      placeId: initialDestination.id || `custom-${initialDestination.name}`,
      location: initialDestination.name,
      shortName: initialDestination.shortName || initialDestination.name,
      coord: {
        lat: initialDestination.latitude,
        lng: initialDestination.longitude,
      },
      type: coerceSeededLocationType(initialDestination.type),
      percent_full: 0,
      is_live: false,
      available_seats: null,
      source: 'directory' as const,
    },
  };
}

function getSeededOrigin(initialOrigin?: SeededLocationParams): ManualOrigin | null {
  if (!initialOrigin?.name || initialOrigin.latitude == null || initialOrigin.longitude == null) {
    return null;
  }

  return {
    name: initialOrigin.name,
    coordinate: {
      latitude: initialOrigin.latitude,
      longitude: initialOrigin.longitude,
    },
  };
}

function normalizeCampusLabel(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function toCoordinateFromLocation(location: CampusLocation): Coordinate {
  return {
    latitude: location.coord.lat,
    longitude: location.coord.lng,
  };
}

function toNavigationDestination(location: CampusLocation): NavigationDestination {
  return {
    type: 'location',
    location,
    name: location.location,
  };
}

function buildFallbackLocation(input: {
  placeId?: string;
  name: string;
  shortName?: string;
  latitude: number;
  longitude: number;
  type: CampusLocation['type'];
}): CampusLocation {
  return {
    placeId: input.placeId || `fallback-${normalizeCampusLabel(input.name)}`,
    location: input.name,
    shortName: input.shortName || input.name,
    coord: {
      lat: input.latitude,
      lng: input.longitude,
    },
    type: input.type,
    percent_full: 0,
    is_live: false,
    available_seats: null,
    source: 'directory',
  };
}

function resolveLocationMatch(
  locations: CampusLocation[],
  input: {
    placeId?: string;
    name: string;
    shortName?: string;
    latitude: number;
    longitude: number;
    type: CampusLocation['type'];
  },
) {
  const normalizedName = normalizeCampusLabel(input.name);
  const normalizedShortName = normalizeCampusLabel(input.shortName);
  const matched = locations.find((location) => {
    const selectionId = getLocationSelectionId(location);
    return (
      (input.placeId && (location.placeId === input.placeId || selectionId === input.placeId)) ||
      normalizeCampusLabel(location.location) === normalizedName ||
      (!!normalizedShortName && normalizeCampusLabel(location.shortName) === normalizedShortName)
    );
  });

  return matched || buildFallbackLocation(input);
}

function findNearestLibraryLocation(userCoordinate: Coordinate, locations: CampusLocation[]) {
  const libraries = BUILDINGS.filter((building) => building.type === 'Library');
  if (!libraries.length) return null;

  let nearest = libraries[0];
  let minDistance = computeDistanceMeters(userCoordinate, {
    latitude: nearest.latitude,
    longitude: nearest.longitude,
  });

  for (const library of libraries.slice(1)) {
    const distance = computeDistanceMeters(userCoordinate, {
      latitude: library.latitude,
      longitude: library.longitude,
    });
    if (distance < minDistance) {
      minDistance = distance;
      nearest = library;
    }
  }

  return resolveLocationMatch(locations, {
    placeId: nearest.id,
    name: nearest.name,
    shortName: nearest.shortName,
    latitude: nearest.latitude,
    longitude: nearest.longitude,
    type: 'Library',
  });
}

function resolveNearestAmenityLocation(
  userCoordinate: Coordinate,
  amenityType: 'restroom' | 'coffee' | 'dining' | 'study' | 'parking',
  locations: CampusLocation[],
) {
  const amenity = findNearestAmenity(userCoordinate, amenityType);
  if (!amenity) return null;

  const typeByAmenity: Record<typeof amenityType, CampusLocation['type']> = {
    restroom: 'General',
    coffee: 'Dining',
    dining: 'Dining',
    study: 'Study',
    parking: 'Parking',
  };

  return resolveLocationMatch(locations, {
    placeId: amenity.id,
    name: amenity.name,
    shortName: amenity.name,
    latitude: amenity.latitude,
    longitude: amenity.longitude,
    type: typeByAmenity[amenityType],
  });
}

export function CampusNavigationScreen() {
  const { COLORS, theme } = useTheme();
  const styles = getStyles(COLORS, theme === 'dark');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialDestinationParam = route.params?.initialDestination as SeededLocationParams | undefined;
  const initialOriginParam = route.params?.initialOrigin as SeededLocationParams | undefined;
  const initialTravelModeParam = route.params?.initialTravelMode as TravelMode | undefined;
  const navigationLocations = useMemo(
    () => buildExpandedPlacesDirectory().filter((location) => !location.searchOnly),
    [],
  );
  // ─── State ──────────────────────────────────────────────────
  const [navMode, setNavMode] = useState<NavMode>(initialDestinationParam ? 'selected' : 'idle');
  const [destination, setDestination] = useState<NavigationDestination | null>(() => getSeededDestination(initialDestinationParam));
  const [manualOrigin, setManualOrigin] = useState<ManualOrigin | null>(() => getSeededOrigin(initialOriginParam));
  const [activeRoute, setActiveRoute] = useState<WalkingRoute | null>(null);
  const [transitPlan, setTransitPlan] = useState<CampusTransitPlan | null>(null);
  const [steps, setSteps] = useState<DirectionStep[]>([]);
  const [travelMode, setTravelMode] = useState<TravelMode>(initialTravelModeParam || 'walk');
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [nearbyItems, setNearbyItems] = useState<CampusSearchResult[]>([]);
  const [userCoord, setUserCoord] = useState<Coordinate>({
    latitude: DEFAULT_USER_LOCATION.latitude,
    longitude: DEFAULT_USER_LOCATION.longitude,
  });
  const { cameraRef, defaultCamera, animateToRegion, animateCamera, fitToCoordinates } = useMapCamera(TAMU_CENTER);
  const mapRef = useRef<{
    animateToRegion: typeof animateToRegion;
    animateCamera: typeof animateCamera;
    fitToCoordinates: typeof fitToCoordinates;
  } | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const routeGenerationRef = useRef(0);
  const seededDestinationKeyRef = useRef<string | null>(null);
  const seededOriginKeyRef = useRef<string | null>(null);
  const seededTravelModeRef = useRef<TravelMode | null>(null);
  const didAutoCenterOnUserRef = useRef(false);

  const initialRegion = TAMU_CENTER;

  const preferredRouteKey = route.params?.preferredRouteKey as string | null | undefined;
  const tripPreference = route.params?.tripPreference as 'best' | 'fewer_transfers' | 'less_walking' | undefined;
  const routeStartCoord = manualOrigin?.coordinate || userCoord;
  const routeStartName = manualOrigin?.name || 'Current Location';
  const isUserNearCampus = isCoordinateNearTexasAM(userCoord, CAMPUS_DISCOVERY_RADIUS_METERS);
  const pinnedItems = useMemo(
    () => (isUserNearCampus ? getPinnedItems() : []),
    [isUserNearCampus],
  );
  const destinationCoord: Coordinate | null = useMemo(() => (
    destination?.location
      ? { latitude: destination.location.coord.lat, longitude: destination.location.coord.lng }
      : null
  ), [destination]);
  const busModeAvailable = !destinationCoord || (
    isCoordinateNearTexasAM(routeStartCoord, CAMPUS_DISCOVERY_RADIUS_METERS) &&
    isCoordinateNearTexasAM(destinationCoord, CAMPUS_DISCOVERY_RADIUS_METERS)
  );
  const activeTransitPlan = travelMode === 'bus' ? transitPlan : null;
  const effectiveMode: TravelMode = activeTransitPlan ? 'bus' : travelMode === 'bus' ? 'walk' : travelMode;
  const hasActiveRoute = !!destination && (!!activeRoute || !!activeTransitPlan);
  const summaryMode: TravelMode = travelMode === 'bus' && (activeTransitPlan || routeLoading) ? 'bus' : effectiveMode;
  const displayedDistanceLabel = activeTransitPlan
    ? formatDistance(activeTransitPlan.distanceMeters)
    : activeRoute
      ? formatDistance(activeRoute.distanceMeters)
      : undefined;
  const displayedEtaLabel = activeTransitPlan
    ? formatTime(activeTransitPlan.estimatedTimeMinutes)
    : activeRoute
      ? formatTime(activeRoute.estimatedTimeMinutes)
      : undefined;
  const displayedRouteTitle = destination
    ? activeTransitPlan
      ? `Ride ${activeTransitPlan.routeShortName || 'Bus'} to ${destination.name}`
      : travelMode === 'bus'
        ? `Plan a bus trip to ${destination.name}`
        : travelMode === 'drive'
          ? `Drive to ${destination.name}`
          : `Walk to ${destination.name}`
    : undefined;
  const displayedRouteMeta = activeTransitPlan
    ? `Board at ${activeTransitPlan.originStop.Name} • Exit at ${activeTransitPlan.destinationStop.Name}`
    : destination
      ? `From ${routeStartName}`
      : undefined;
  const displayedRouteNote = activeTransitPlan
    ? activeTransitPlan.nearestVehicleLabel
      ? `${activeTransitPlan.nearestVehicleLabel}. ${formatDistance(activeTransitPlan.walkingToStopMeters)} to the stop.`
      : `Walk ${formatDistance(activeTransitPlan.walkingToStopMeters)} to ${activeTransitPlan.originStop.Name}, then ride route ${activeTransitPlan.routeShortName}.`
    : routeNotice;
  const transitStopMarkers = useMemo(() => {
    if (!activeTransitPlan) return [];
    return [
      {
        key: 'board',
        title: activeTransitPlan.originStop.Name,
        badge: 'Board',
        coordinate: {
          latitude: activeTransitPlan.originStop.Latitude,
          longitude: activeTransitPlan.originStop.Longitude,
        },
      },
      {
        key: 'exit',
        title: activeTransitPlan.destinationStop.Name,
        badge: 'Exit',
        coordinate: {
          latitude: activeTransitPlan.destinationStop.Latitude,
          longitude: activeTransitPlan.destinationStop.Longitude,
        },
      },
    ];
  }, [activeTransitPlan]);
  const discoveryMarkers = useMemo(
    () => (
      destination
        ? []
        : isCoordinateNearTexasAM(routeStartCoord, CAMPUS_DISCOVERY_RADIUS_METERS)
          ? navigationLocations.filter((location) => Number.isFinite(location.coord?.lat) && Number.isFinite(location.coord?.lng))
          : []
    ),
    [destination, navigationLocations, routeStartCoord],
  );
  const selectDestination = (location: CampusLocation) => {
    const nextCoord = toCoordinateFromLocation(location);
    const distanceFromStart = computeDistanceMeters(routeStartCoord, nextCoord);
    const originSupportsCampusTransit = isCoordinateNearTexasAM(routeStartCoord, CAMPUS_DISCOVERY_RADIUS_METERS);
    const destinationSupportsCampusTransit = isCoordinateNearTexasAM(nextCoord, CAMPUS_DISCOVERY_RADIUS_METERS);
    setDestination(toNavigationDestination(location));
    setNavMode('selected');
    if (travelMode === 'bus' && (!originSupportsCampusTransit || !destinationSupportsCampusTransit)) {
      setTravelMode('drive');
      setRouteNotice('Campus buses only operate near Texas A&M, so this trip switched to driving directions.');
      return;
    }
    if (travelMode === 'walk' && distanceFromStart > AUTO_DRIVE_DISTANCE_METERS) {
      setTravelMode('drive');
      setRouteNotice('This is a longer trip, so driving directions are selected by default.');
      return;
    }
    setRouteNotice(null);
  };

  const resolveQuickActionLocation = (
    commandType: string,
    originCoordinate: Coordinate,
  ) => {
    if (commandType === 'nearest-library') {
      return findNearestLibraryLocation(originCoordinate, navigationLocations);
    }

    const amenityTypeMap: Record<string, 'restroom' | 'coffee' | 'dining' | 'study' | 'parking'> = {
      'nearest-restroom': 'restroom',
      'nearest-coffee': 'coffee',
      'nearest-dining': 'dining',
      'nearest-study': 'study',
      'nearest-parking': 'parking',
    };
    const amenityType = amenityTypeMap[commandType];

    return amenityType
      ? resolveNearestAmenityLocation(originCoordinate, amenityType, navigationLocations)
      : null;
  };

  const fitMapToCoordinates = (
    coordinates: Coordinate[],
    viewport: 'selection' | 'navigating' = 'selection',
  ) => {
    if (!mapRef.current || coordinates.length === 0) return;

    const edgePadding = viewport === 'navigating'
      ? {
          top: Math.round(SCREEN_HEIGHT * 0.14),
          right: 56,
          bottom: Math.round(SCREEN_HEIGHT * 0.34),
          left: 56,
        }
      : {
          top: Math.round(SCREEN_HEIGHT * 0.22),
          right: 56,
          bottom: Math.round(SCREEN_HEIGHT * 0.28),
          left: 56,
        };

    if (coordinates.length > 1) {
      Keyboard.dismiss();
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding,
          animated: true,
          duration: 800,
        });
      }, 150);
      return;
    }

    const latitudes = coordinates.map((point) => point.latitude);
    const longitudes = coordinates.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const fitRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.005),
      longitudeDelta: Math.max((maxLon - minLon) * 1.6, 0.005),
    };
    Keyboard.dismiss();
    setTimeout(() => mapRef.current?.animateToRegion(fitRegion, 800), 150);
  };

  // ─── Effects ────────────────────────────────────────────────

  useEffect(() => {
    mapRef.current = {
      animateToRegion,
      animateCamera,
      fitToCoordinates,
    };
  }, [animateCamera, animateToRegion, fitToCoordinates]);

  // Request location permission and start watching GPS
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[CampusNav] Location permission denied, using default location');
          return;
        }

        // Get initial position quickly
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coord = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        };
        setUserCoord(coord);

        // Watch for updates
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5, // update every 5 meters
            timeInterval: 3000,  // or every 3 seconds
          },
          (loc) => {
            setUserCoord({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          },
        );
        locationSubRef.current = sub;
      } catch (e) {
        console.warn('[CampusNav] Location error:', e);
      }
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  // Update nearby items when location changes
  useEffect(() => {
    setNearbyItems(isUserNearCampus ? getNearbyItems(userCoord, 10) : []);
  }, [isUserNearCampus, userCoord]);

  useEffect(() => {
    if (didAutoCenterOnUserRef.current || destination || manualOrigin || !mapRef.current) return;
    if (
      userCoord.latitude === DEFAULT_USER_LOCATION.latitude &&
      userCoord.longitude === DEFAULT_USER_LOCATION.longitude
    ) {
      return;
    }

    didAutoCenterOnUserRef.current = true;
    mapRef.current.animateCamera(
      {
        center: userCoord,
        zoom: isUserNearCampus ? 15 : 11,
        pitch: 0,
        heading: 0,
      },
      { duration: 900 },
    );
  }, [destination, isUserNearCampus, manualOrigin, userCoord]);

  // Pulse animation for user marker
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  // Route calculation when destination changes
  useEffect(() => {
    if (!destination) {
      setActiveRoute(null);
      setTransitPlan(null);
      setSteps([]);
      setRouteLoading(false);
      setRouteNotice(null);
      setNavMode('idle');
      return;
    }

    const destCoord = destinationCoord;

    if (!destCoord) return;

    const fallbackRoute = createRoute(routeStartCoord, destCoord);
    const fallbackSteps = buildDirectionSteps(
      routeStartName,
      destination.name,
      routeStartCoord,
      destCoord,
      fallbackRoute.distanceMeters,
      fallbackRoute.estimatedTimeMinutes,
    );
    setActiveRoute(fallbackRoute);
    setSteps(fallbackSteps);

    if (navMode === 'idle') setNavMode('selected');
    const generationId = routeGenerationRef.current + 1;
    routeGenerationRef.current = generationId;

    let cancelled = false;
    setRouteLoading(true);
    fitMapToCoordinates(fallbackRoute.polyline);

    (async () => {
      if (travelMode === 'bus') {
        if (!busModeAvailable) {
          setTransitPlan(null);
          setSteps(fallbackSteps);
          setRouteNotice('Campus buses only operate near Texas A&M. Choose Drive or Walk for this trip.');
          setRouteLoading(false);
          return;
        }
        setRouteNotice('Finding the best bus connection...');
      } else {
        setTransitPlan(null);
        setRouteNotice(travelMode === 'drive' ? 'Finding the best driving route...' : 'Finding the best walking route...');
      }

      try {
        if (travelMode === 'bus') {
          const plan = await buildTransitPlan(routeStartCoord, destCoord, routeStartName, destination.name, {
            preferredRouteKey,
            preference: tripPreference || 'best',
          });
          if (cancelled || generationId !== routeGenerationRef.current) return;

          if (plan) {
            setTransitPlan(plan);
            setSteps(plan.steps);
            setRouteNotice(
              plan.nearestVehicleLabel
                ? `${plan.nearestVehicleLabel} near ${plan.originStop.Name}.`
                : `Walk to ${plan.originStop.Name} and ride route ${plan.routeShortName}.`,
            );
            fitMapToCoordinates(plan.polyline);
          } else {
            setTransitPlan(null);
            setSteps(fallbackSteps);
            setRouteNotice('No active bus trip is available right now. Walking directions are ready instead.');
          }
        } else {
          const routedTrip = await buildGlobalRoute({
            origin: routeStartCoord,
            destination: destCoord,
            mode: travelMode === 'drive' ? 'drive' : 'walk',
            originName: routeStartName,
            destinationName: destination.name,
          });
          if (cancelled || generationId !== routeGenerationRef.current) return;

          setTransitPlan(null);
          setActiveRoute(routedTrip.route);
          setSteps(routedTrip.steps.length > 0 ? routedTrip.steps : fallbackSteps);
          setRouteNotice(null);
          fitMapToCoordinates(routedTrip.route.polyline);
        }
      } catch (error) {
        console.warn('[CampusNav] Route planning error:', error);
        if (!cancelled && generationId === routeGenerationRef.current) {
          setTransitPlan(null);
          setActiveRoute(fallbackRoute);
          setSteps(fallbackSteps);
          setRouteNotice(
            travelMode === 'bus'
              ? 'Bus directions are temporarily unavailable. Walking directions are ready instead.'
              : travelMode === 'drive'
                ? 'Live driving directions are temporarily unavailable. Showing a direct route estimate instead.'
                : 'Walking directions are temporarily unavailable. Showing a direct route estimate instead.',
          );
        }
      } finally {
        if (!cancelled && generationId === routeGenerationRef.current) {
          setRouteLoading(false);
          if (Platform.OS !== 'web') Vibration.vibrate(50);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    busModeAvailable,
    destination,
    destinationCoord,
    preferredRouteKey,
    routeStartCoord.latitude,
    routeStartCoord.longitude,
    routeStartName,
    travelMode,
    tripPreference,
  ]);

  useEffect(() => {
    const seededDestination = getSeededDestination(initialDestinationParam);
    if (!seededDestination) return;

    const key = [
      seededDestination.location.placeId,
      seededDestination.location.coord.lat,
      seededDestination.location.coord.lng,
    ].join(':');
    if (seededDestinationKeyRef.current === key) return;

    seededDestinationKeyRef.current = key;
    setDestination(seededDestination);
    setNavMode('selected');
  }, [
    initialDestinationParam?.id,
    initialDestinationParam?.latitude,
    initialDestinationParam?.longitude,
    initialDestinationParam?.name,
    initialDestinationParam?.shortName,
    initialDestinationParam?.type,
  ]);

  useEffect(() => {
    const seededOrigin = getSeededOrigin(initialOriginParam);
    if (!seededOrigin) return;

    const key = [
      seededOrigin.name,
      seededOrigin.coordinate.latitude,
      seededOrigin.coordinate.longitude,
    ].join(':');
    if (seededOriginKeyRef.current === key) return;

    seededOriginKeyRef.current = key;
    setManualOrigin(seededOrigin);
  }, [
    initialOriginParam?.id,
    initialOriginParam?.latitude,
    initialOriginParam?.longitude,
    initialOriginParam?.name,
    initialOriginParam?.shortName,
  ]);

  useEffect(() => {
    if (!initialTravelModeParam || seededTravelModeRef.current === initialTravelModeParam) return;
    seededTravelModeRef.current = initialTravelModeParam;
    setTravelMode(initialTravelModeParam);
  }, [initialTravelModeParam]);

  useEffect(() => {
    if (travelMode !== 'bus' || !destinationCoord || busModeAvailable) return;
    setTravelMode('drive');
    setRouteNotice('Campus buses only operate near Texas A&M, so this trip switched to driving directions.');
  }, [busModeAvailable, destinationCoord, travelMode]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleSearchSelect = (result: CampusSearchResult) => {
    Keyboard.dismiss();

    if (result.kind === 'command' && result.commandType) {
      const location = resolveQuickActionLocation(result.commandType, routeStartCoord);
      if (location) selectDestination(location);
      return;
    }

    if (result.location) {
      selectDestination(result.location);
      return;
    }
  };

  const handleOriginSelect = (result: CampusSearchResult) => {
    if (result.kind === 'command' && result.commandType) {
      const location = resolveQuickActionLocation(result.commandType, userCoord);
      if (location) {
        setManualOrigin({
          name: location.location,
          coordinate: toCoordinateFromLocation(location),
        });
      }
      return;
    }

    if (result.location) {
      setManualOrigin({
        name: result.location.location,
        coordinate: toCoordinateFromLocation(result.location),
      });
    }
  };

  const handleStartDirections = () => {
    const summaryDistance = displayedDistanceLabel;
    const summaryEta = displayedEtaLabel;
    if ((!activeRoute && !activeTransitPlan) || !steps.length || !summaryDistance || !summaryEta) return;
    
    setNavMode('navigating');
    fitMapToCoordinates(activeTransitPlan?.polyline || activeRoute?.polyline || [], 'navigating');
  };

  const handleEndDirections = async () => {
    setNavMode('selected');
  };

  const handleClearRoute = async () => {
    setDestination(null);
    setActiveRoute(null);
    setTransitPlan(null);
    setRouteLoading(false);
    setRouteNotice(null);
    setNavMode('idle');
    setSteps([]);
    if (mapRef.current) {
      mapRef.current.animateToRegion(initialRegion, 800);
    }
  };


  // ─── Render ─────────────────────────────────────────────────
  const isNavigating = navMode === 'navigating';

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={cameraRef}
          style={styles.map}
          initialRegion={defaultCamera}
          showsCompass
          showsUserLocation={false}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {/* Route polyline */}
          {(activeTransitPlan || activeRoute) && (
            <MapPolylineOverlay
              id="campus-navigation-route"
              coordinates={activeTransitPlan?.polyline || activeRoute?.polyline || []}
              color={activeTransitPlan?.routeColor || COLORS.primary}
              width={4}
              lineDasharray={activeTransitPlan ? undefined : [2, 2]}
            />
          )}

          {/* User location marker */}
          <MapMarker
            id="campus-navigation-user"
            coordinate={userCoord}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Animated.View style={[styles.userMarker, { transform: [{ scale: pulseAnim }] }]}>
              <MapPin size={18} color="#FFFFFF" />
            </Animated.View>
          </MapMarker>
          {manualOrigin && (
            <MapMarker
              id="campus-navigation-origin"
              coordinate={manualOrigin.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.startMarker}>
                <Text style={styles.startMarkerText}>S</Text>
              </View>
            </MapMarker>
          )}
          {transitStopMarkers.map((stop) => (
            <MapMarker
              key={stop.key}
              id={`campus-navigation-stop-${stop.key}`}
              coordinate={stop.coordinate}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.transitStopMarkerWrap}>
                <View style={[
                  styles.transitStopPill,
                  stop.badge === 'Board' ? styles.transitStopPillBoard : styles.transitStopPillExit,
                ]}>
                  <Text style={styles.transitStopPillBadge}>{stop.badge}</Text>
                  <Text style={styles.transitStopPillTitle} numberOfLines={1}>
                    {stop.title}
                  </Text>
                </View>
                <View style={[
                  styles.transitStopPin,
                  stop.badge === 'Board' ? styles.transitStopPinBoard : styles.transitStopPinExit,
                ]} />
              </View>
            </MapMarker>
          ))}
          {destinationCoord ? (
            <MapMarker
              id="campus-navigation-destination"
              coordinate={destinationCoord}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.destinationMarker}>
                <Text style={styles.destinationMarkerText}>E</Text>
              </View>
            </MapMarker>
          ) : null}
          <MapMarker
            id="campus-navigation-user-label"
            coordinate={{ latitude: userCoord.latitude + 0.00012, longitude: userCoord.longitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>You are here</Text>
            </View>
          </MapMarker>

          {/* Discovery markers */}
          {discoveryMarkers.map((location) => {
            const markerColor = getCategoryColor(location.type);
            return (
              <MapMarker
                key={getLocationSelectionId(location)}
                id={`campus-navigation-discovery-${getLocationSelectionId(location)}`}
                coordinate={toCoordinateFromLocation(location)}
                onPress={() => selectDestination(location)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={[
                    styles.buildingMarker,
                    {
                      backgroundColor: markerColor,
                      borderColor: 'rgba(255,255,255,0.9)',
                    },
                  ]}
                >
                  {getCategoryIcon(location.type, '#FFFFFF', 18)}
                </View>
              </MapMarker>
            );
          })}
        </MapView>
      </View>

      {!isNavigating ? (
        <View style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.searchContainer}>
            <View style={styles.searchHeaderRow}>
              <Pressable
                style={({ pressed }) => [styles.backButton, pressed && styles.btnPressed]}
                onPress={() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.navigate('Main', { screen: 'Places' });
                  }
                }}
              >
                <Text style={styles.backButtonIcon}>‹</Text>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </View>
            <View style={styles.searchStack}>
              <View style={[styles.searchFieldWrap, styles.originSearchFieldWrap]}>
                <CampusSearchBar
                  userCoord={userCoord}
                  onSelect={handleOriginSelect}
                  placeholder="Choose a starting point"
                  showPinnedItems={false}
                  displayValue={manualOrigin?.name}
                  enableGlobalSearch
                />
              </View>
              <View style={[styles.searchFieldWrap, styles.destinationSearchFieldWrap]}>
                <CampusSearchBar
                  userCoord={routeStartCoord}
                  onSelect={handleSearchSelect}
                  placeholder="Search destination"
                  displayValue={destination?.name}
                  enableGlobalSearch
                />
              </View>
            </View>
            <View style={styles.controlsRow}>
              <View style={styles.modeSwitch}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modePill,
                    travelMode === 'walk' && styles.modePillActive,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => setTravelMode('walk')}
                >
                  <Text style={[styles.modePillText, travelMode === 'walk' && styles.modePillTextActive]}>
                    Walk
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modePill,
                    travelMode === 'drive' && styles.modePillActive,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => setTravelMode('drive')}
                >
                  <Text style={[styles.modePillText, travelMode === 'drive' && styles.modePillTextActive]}>
                    Drive
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modePill,
                    travelMode === 'bus' && styles.modePillActive,
                    !busModeAvailable && destinationCoord && styles.modePillDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => {
                    if (!busModeAvailable && destinationCoord) {
                      setRouteNotice('Campus buses only operate near Texas A&M. Use Drive or Walk for this trip.');
                      return;
                    }
                    setTravelMode('bus');
                  }}
                >
                  <Text style={[styles.modePillText, travelMode === 'bus' && styles.modePillTextActive]}>
                    Bus
                  </Text>
                </Pressable>
              </View>
              <Pressable
                style={({ pressed }) => [styles.originPill, pressed && styles.btnPressed]}
                onPress={() => setManualOrigin(null)}
              >
                <Text style={styles.originPillText}>
                  {manualOrigin ? 'Use Current Location' : 'Using Current Location'}
                </Text>
              </Pressable>
            </View>
          </View>

        </View>
      ) : null}

      {/* Directions Panel */}
      {isNavigating && (activeRoute || activeTransitPlan) && destination && steps.length > 0 && (
        <View style={styles.directionsContainer}>
          <CampusDirectionsPanel
            destinationName={destination.name}
            distanceLabel={displayedDistanceLabel || ''}
            etaLabel={displayedEtaLabel || ''}
            steps={steps}
            modeLabel={
              effectiveMode === 'bus'
                ? 'Bus Trip'
                : effectiveMode === 'drive'
                  ? 'Driving'
                  : 'Walking'
            }
            routeNote={displayedRouteNote}
            onEnd={handleEndDirections}
          />
        </View>
      )}

      {/* Bottom Sheet */}
      {!isNavigating && (
        <CampusBottomSheet
          nearbyItems={nearbyItems}
          pinnedItems={pinnedItems}
          onSelect={handleSearchSelect}
          hasRoute={!!destination && (!!activeRoute || !!activeTransitPlan)}
          destinationName={destination?.name}
          routeMode={summaryMode}
          routeTitle={displayedRouteTitle}
          distanceLabel={displayedDistanceLabel}
          etaLabel={displayedEtaLabel}
          routeMeta={displayedRouteMeta}
          routeNote={displayedRouteNote}
          routeAccentColor={activeTransitPlan?.routeColor || COLORS.primary}
          isLoadingRoute={routeLoading}
          onClearRoute={handleClearRoute}
          onStartDirections={handleStartDirections}
        />
      )}

    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    zIndex: 1000,
  },
  searchContainer: {
    marginHorizontal: 14,
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    zIndex: 25,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(12,12,14,0.10)',
  },
  backButtonIcon: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
  },
  backButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  searchStack: {
    gap: 12,
    zIndex: 20,
    overflow: 'visible',
  },
  searchFieldWrap: {
    position: 'relative',
  },
  originSearchFieldWrap: {
    zIndex: 20,
    elevation: 20,
  },
  destinationSearchFieldWrap: {
    zIndex: 10,
    elevation: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    minHeight: 40,
    zIndex: 1,
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(12,12,14,0.10)',
    padding: 4,
    gap: 4,
  },
  modePill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modePillActive: {
    backgroundColor: COLORS.primary,
  },
  modePillDisabled: {
    opacity: 0.45,
  },
  modePillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modePillTextActive: {
    color: '#FFF',
  },
  originPill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  originPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  voiceBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(8,8,8,0.92)' : 'rgba(255,255,255,0.96)',
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    zIndex: 998,
  },
  voiceBannerText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  voiceBannerError: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 13,
  },
  voiceDismiss: {
    paddingLeft: 8,
  },
  voiceDismissText: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarkerText: {
    fontSize: 16,
  },
  youBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  youBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  startMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0B6E4F',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMarkerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  transitStopMarkerWrap: {
    alignItems: 'center',
  },
  transitStopPill: {
    maxWidth: 190,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  transitStopPillBoard: {
    backgroundColor: isDark ? 'rgba(8,8,8,0.94)' : 'rgba(255,255,255,0.98)',
    borderColor: COLORS.primary,
  },
  transitStopPillExit: {
    backgroundColor: isDark ? 'rgba(8,8,8,0.94)' : 'rgba(255,255,255,0.98)',
    borderColor: COLORS.danger,
  },
  transitStopPillBadge: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  transitStopPillTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  transitStopPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  transitStopPinBoard: {
    backgroundColor: COLORS.primary,
  },
  transitStopPinExit: {
    backgroundColor: COLORS.danger,
  },
  destinationMarker: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B0000',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  destinationMarkerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  busStopMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busStopMarkerText: {
    fontSize: 14,
  },
  busStopExitMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busStopExitText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  buildingMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  destMarker: {
    backgroundColor: COLORS.primary,
    borderColor: '#FFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
  },
  amenityMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  destAmenityMarker: {
    backgroundColor: COLORS.primary,
    borderColor: '#FFF',
    borderWidth: 3,
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  markerEmoji: {
    fontSize: 14,
  },
  directionsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    height: '44%',
    minHeight: 260,
    zIndex: 900,
  },
  voiceFab: {
    position: 'absolute',
    right: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    minHeight: 52,
    zIndex: 1001,
  },
  voiceFabDocked: {
    bottom: 112,
  },
  voiceFabNavigating: {
    bottom: 24,
  },
  voiceFabListening: {
    backgroundColor: COLORS.danger,
  },
  voiceFabProcessing: {
    backgroundColor: '#555',
  },
  voiceFabIcon: {
    fontSize: 20,
  },
  voiceFabText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
