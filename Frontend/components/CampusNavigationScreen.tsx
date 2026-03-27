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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { CampusSearchBar } from './CampusSearchBar';
import { CampusDirectionsPanel } from './CampusDirectionsPanel';
import { CampusBottomSheet } from './CampusBottomSheet';
import {
  BUILDINGS,
  AMENITIES,
  TAMU_CENTER,
  DEFAULT_USER_LOCATION,
  getBuildingEmoji,
  getAmenityEmoji,
  CampusBuilding,
  CampusAmenity,
} from '../data/campus';
import {
  createRoute,
  computeDistanceMeters,
  formatDistance,
  formatTime,
  buildDirectionSteps,
  findNearestAmenity,
  WalkingRoute,
  DirectionStep,
  Coordinate,
} from '../services/campusDirections';
import {
  CampusSearchResult,
  searchCampus,
  getPinnedItems,
  getNearbyItems,
} from '../services/campusSearch';
import {
  speakRouteIntro,
  speakStep,
  stopSpeech,
} from '../services/campusTTS';
import {
  requestMicPermission,
  startRecording,
  stopRecording as stopVoiceRecording,
  isCurrentlyRecording,
  processVoiceCommand,
  VoiceIntent,
} from '../services/campusVoice';
import { buildTransitPlan, CampusTransitPlan } from '../services/campusTransitRouting';

type NavMode = 'idle' | 'selected' | 'navigating';
type TravelMode = 'walk' | 'bus';

type ManualOrigin = {
  name: string;
  coordinate: Coordinate;
};

const VOICE_PREF_KEY = 'campus_navigation_voice_enabled';
const SCREEN_HEIGHT = Dimensions.get('window').height;

export function CampusNavigationScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // ─── State ──────────────────────────────────────────────────
  const [navMode, setNavMode] = useState<NavMode>('idle');
  const [destination, setDestination] = useState<{
    type: 'building' | 'amenity';
    building?: CampusBuilding;
    amenity?: CampusAmenity;
    name: string;
  } | null>(null);
  const [manualOrigin, setManualOrigin] = useState<ManualOrigin | null>(null);
  const [activeRoute, setActiveRoute] = useState<WalkingRoute | null>(null);
  const [transitPlan, setTransitPlan] = useState<CampusTransitPlan | null>(null);
  const [steps, setSteps] = useState<DirectionStep[]>([]);
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [nearbyItems, setNearbyItems] = useState<CampusSearchResult[]>([]);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [voiceBanner, setVoiceBanner] = useState<{ text?: string; error?: string } | null>(null);
  const [userCoord, setUserCoord] = useState<Coordinate>({
    latitude: DEFAULT_USER_LOCATION.latitude,
    longitude: DEFAULT_USER_LOCATION.longitude,
  });
  const [locationReady, setLocationReady] = useState(false);

  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const routeGenerationRef = useRef(0);
  const voicePreferenceReadyRef = useRef(false);

  const initialRegion: Region = {
    ...TAMU_CENTER,
  };

  const pinnedItems = useMemo(() => getPinnedItems(), []);
  const seededDestinationRef = useRef(false);
  const routeStartCoord = manualOrigin?.coordinate || userCoord;
  const routeStartName = manualOrigin?.name || 'Current Location';
  const destinationCoord: Coordinate | null = useMemo(() => (
    destination?.building
      ? { latitude: destination.building.latitude, longitude: destination.building.longitude }
      : destination?.amenity
        ? { latitude: destination.amenity.latitude, longitude: destination.amenity.longitude }
        : null
  ), [destination]);
  const activeTransitPlan = travelMode === 'bus' ? transitPlan : null;
  const effectiveMode: TravelMode = activeTransitPlan ? 'bus' : 'walk';
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

    if (coordinates.length > 1 && mapRef.current.fitToCoordinates) {
      Keyboard.dismiss();
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding,
          animated: true,
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

    const fitRegion: Region = {
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
    let cancelled = false;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(VOICE_PREF_KEY);
        if (!cancelled && stored != null) {
          setVoiceEnabled(stored === 'true');
        }
      } catch (error) {
        console.warn('[CampusNav] Failed to load voice preference:', error);
      } finally {
        voicePreferenceReadyRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!voicePreferenceReadyRef.current) return;
    AsyncStorage.setItem(VOICE_PREF_KEY, voiceEnabled ? 'true' : 'false').catch((error) => {
      console.warn('[CampusNav] Failed to save voice preference:', error);
    });
    if (!voiceEnabled) {
      stopSpeech();
    }
  }, [voiceEnabled]);

  // Request location permission and start watching GPS
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[CampusNav] Location permission denied, using default location');
          setLocationReady(true);
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
        setLocationReady(true);

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
        console.error('[CampusNav] Location error:', e);
        setLocationReady(true);
      }
    })();

    return () => {
      sub?.remove();
    };
  }, []);

  // Update nearby items when location changes
  useEffect(() => {
    setNearbyItems(getNearbyItems(userCoord, 10));
  }, [userCoord]);

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

    const walkingRoute = createRoute(routeStartCoord, destCoord);
    const walkingSteps = buildDirectionSteps(
      routeStartName,
      destination.name,
      routeStartCoord,
      destCoord,
      walkingRoute.distanceMeters,
      walkingRoute.estimatedTimeMinutes,
    );
    setActiveRoute(walkingRoute);
    setSteps(walkingSteps);

    if (navMode === 'idle') setNavMode('selected');
    const generationId = routeGenerationRef.current + 1;
    routeGenerationRef.current = generationId;

    if (travelMode === 'walk') {
      setTransitPlan(null);
      setRouteLoading(false);
      setRouteNotice(null);
      fitMapToCoordinates(walkingRoute.polyline);
      if (Platform.OS !== 'web') Vibration.vibrate(50);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    setRouteNotice('Finding the best bus connection...');
    fitMapToCoordinates(walkingRoute.polyline);

    (async () => {
      try {
        const plan = await buildTransitPlan(routeStartCoord, destCoord, routeStartName, destination.name);
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
          setSteps(walkingSteps);
          setRouteNotice('No active bus trip is available right now. Walking directions are ready instead.');
        }
      } catch (error) {
        console.error('[CampusNav] Transit planning error:', error);
        if (!cancelled && generationId === routeGenerationRef.current) {
          setTransitPlan(null);
          setSteps(walkingSteps);
          setRouteNotice('Bus directions are temporarily unavailable. Walking directions are ready instead.');
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
  }, [destination, destinationCoord, routeStartCoord.latitude, routeStartCoord.longitude, routeStartName, travelMode]);

  useEffect(() => {
    if (seededDestinationRef.current) return;
    const initialDestination = route.params?.initialDestination;
    if (!initialDestination?.name || initialDestination?.latitude == null || initialDestination?.longitude == null) {
      return;
    }

    seededDestinationRef.current = true;
    setDestination({
      type: 'building',
      name: initialDestination.name,
      building: {
        id: initialDestination.id || `custom-${initialDestination.name}`,
        name: initialDestination.name,
        shortName: initialDestination.shortName || initialDestination.name,
        latitude: initialDestination.latitude,
        longitude: initialDestination.longitude,
        type: initialDestination.type || 'landmark',
      },
    });
  }, [route.params?.initialDestination]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleSearchSelect = (result: CampusSearchResult) => {
    Keyboard.dismiss();

    // Commands
    if (result.kind === 'command' && result.commandType) {
      const typeMap: Record<string, CampusAmenity['type']> = {
        'nearest-restroom': 'restroom',
        'nearest-coffee': 'coffee',
        'nearest-library': 'study', // use study rooms for library
        'nearest-dining': 'dining',
      };
      const amenityType = typeMap[result.commandType];
      if (amenityType) {
        // For library command, find nearest library building instead
        if (result.commandType === 'nearest-library') {
          const libs = BUILDINGS.filter((b) => b.type === 'library');
          let nearest = libs[0];
          let minD = Infinity;
          for (const lib of libs) {
            const d = computeDistanceMeters(userCoord, { latitude: lib.latitude, longitude: lib.longitude });
            if (d < minD) { minD = d; nearest = lib; }
          }
          if (nearest) {
            setDestination({ type: 'building', building: nearest, name: nearest.name });
          }
        } else {
          const amenity = findNearestAmenity(userCoord, amenityType);
          if (amenity) {
            setDestination({ type: 'amenity', amenity, name: amenity.name });
          }
        }
      }
      return;
    }

    // Building
    if (result.building) {
      setDestination({ type: 'building', building: result.building, name: result.building.name });
      return;
    }

    // Amenity
    if (result.amenity) {
      setDestination({ type: 'amenity', amenity: result.amenity, name: result.amenity.name });
    }
  };

  const handleOriginSelect = (result: CampusSearchResult) => {
    if (result.kind === 'command' && result.commandType) {
      const typeMap: Record<string, CampusAmenity['type']> = {
        'nearest-restroom': 'restroom',
        'nearest-coffee': 'coffee',
        'nearest-library': 'study',
        'nearest-dining': 'dining',
      };
      if (result.commandType === 'nearest-library') {
        const libs = BUILDINGS.filter((b) => b.type === 'library');
        let nearest = libs[0];
        let minD = Infinity;
        for (const lib of libs) {
          const d = computeDistanceMeters(userCoord, { latitude: lib.latitude, longitude: lib.longitude });
          if (d < minD) { minD = d; nearest = lib; }
        }
        if (nearest) {
          setManualOrigin({
            name: nearest.name,
            coordinate: { latitude: nearest.latitude, longitude: nearest.longitude },
          });
        }
        return;
      }
      const amenityType = typeMap[result.commandType];
      if (amenityType) {
        const amenity = findNearestAmenity(userCoord, amenityType);
        if (amenity) {
          setManualOrigin({
            name: amenity.name,
            coordinate: { latitude: amenity.latitude, longitude: amenity.longitude },
          });
        }
      }
      return;
    }

    if (result.building) {
      setManualOrigin({
        name: result.building.name,
        coordinate: { latitude: result.building.latitude, longitude: result.building.longitude },
      });
      return;
    }

    if (result.amenity) {
      setManualOrigin({
        name: result.amenity.name,
        coordinate: { latitude: result.amenity.latitude, longitude: result.amenity.longitude },
      });
    }
  };

  const handleStartDirections = async () => {
    const summaryDistance = displayedDistanceLabel;
    const summaryEta = displayedEtaLabel;
    if ((!activeRoute && !activeTransitPlan) || !steps.length || !summaryDistance || !summaryEta) return;
    setNavMode('navigating');
    fitMapToCoordinates(activeTransitPlan?.polyline || activeRoute?.polyline || [], 'navigating');
    if (!voiceEnabled) return;

    try {
      await stopSpeech();
      await speakRouteIntro(
        destination?.name || 'destination',
        summaryDistance,
        summaryEta,
        effectiveMode,
      );
      // Speak first step after intro
      if (steps.length > 0) {
        await speakStep(steps[0].instruction);
      }
    } catch (e) {
      console.error('[CampusNav] TTS error:', e);
    }
  };

  const handleEndDirections = async () => {
    await stopSpeech();
    setNavMode('selected');
  };

  const handleClearRoute = async () => {
    await stopSpeech();
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

  const handleToggleVoice = async () => {
    if (voiceEnabled) {
      await stopSpeech();
      setVoiceEnabled(false);
      return;
    }
    setVoiceEnabled(true);
    if (navMode === 'navigating' && steps.length > 0) {
      await speakStep(steps[0].instruction);
    }
  };

  // ─── Voice Handler ──────────────────────────────────────────
  const handleVoicePress = async () => {
    try {
      if (voiceState === 'idle') {
        await stopSpeech();
        const granted = await requestMicPermission();
        if (!granted) {
          setVoiceBanner({ error: 'Microphone permission required' });
          return;
        }
        setVoiceBanner(null);
        await startRecording();
        setVoiceState('listening');
        if (Platform.OS !== 'web') Vibration.vibrate(50);
      } else if (voiceState === 'listening') {
        setVoiceState('processing');
        const uri = await stopVoiceRecording();
        if (!uri) {
          setVoiceState('idle');
          setVoiceBanner({ error: 'Recording failed' });
          return;
        }

        const { transcript, intent } = await processVoiceCommand(uri);
        setVoiceBanner({ text: transcript || '(no transcript)' });

        // Execute intent
        executeVoiceIntent(intent);
        setVoiceState('idle');

        // Auto-dismiss banner after 4s
        setTimeout(() => setVoiceBanner(null), 4000);
      }
    } catch (e) {
      console.error('[CampusNav] Voice error:', e);
      setVoiceState('idle');
      setVoiceBanner({ error: 'Voice command failed' });
    }
  };

  const executeVoiceIntent = (intent: VoiceIntent) => {
    switch (intent.type) {
      case 'BUILDING': {
        const building = BUILDINGS.find((b) => b.id === intent.buildingId);
        if (building) {
          setDestination({ type: 'building', building, name: building.name });
        } else {
          setVoiceBanner({ error: `Building "${intent.raw}" not found` });
        }
        break;
      }
      case 'NEAREST': {
        const typeMap: Record<string, CampusAmenity['type']> = {
          restroom: 'restroom',
          coffee: 'coffee',
          dining: 'dining',
          library: 'study',
          study: 'study',
          parking: 'parking',
        };
        const amenityType = typeMap[intent.category];
        if (intent.category === 'library') {
          const libs = BUILDINGS.filter((b) => b.type === 'library');
          let nearest = libs[0];
          let minD = Infinity;
          for (const lib of libs) {
            const d = computeDistanceMeters(userCoord, { latitude: lib.latitude, longitude: lib.longitude });
            if (d < minD) { minD = d; nearest = lib; }
          }
          if (nearest) setDestination({ type: 'building', building: nearest, name: nearest.name });
        } else if (amenityType) {
          const amenity = findNearestAmenity(userCoord, amenityType);
          if (amenity) setDestination({ type: 'amenity', amenity, name: amenity.name });
          else setVoiceBanner({ error: `No ${intent.category} found nearby` });
        }
        break;
      }
      case 'SEARCH': {
        const results = searchCampus(intent.query, userCoord, 1);
        if (results.length > 0) {
          handleSearchSelect(results[0]);
        } else {
          setVoiceBanner({ error: `Could not find "${intent.query}"` });
        }
        break;
      }
      default:
        setVoiceBanner({ error: 'Could not understand. Try "nearest coffee" or "Zachry"' });
    }
  };

  // ─── Render ─────────────────────────────────────────────────
  const isNavigating = navMode === 'navigating';
  const showVoiceFab = !hasActiveRoute && !isNavigating;

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          showsUserLocation={false}
          showsCompass={true}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {/* Route polyline */}
          {(activeTransitPlan || activeRoute) && (
            <Polyline
              coordinates={activeTransitPlan?.polyline || activeRoute?.polyline || []}
              strokeColor={activeTransitPlan?.routeColor || COLORS.primary}
              strokeWidth={4}
              lineDashPattern={activeTransitPlan ? undefined : [6, 4]}
            />
          )}

          {/* User location marker */}
          <Marker
            coordinate={userCoord}
            title="You are here"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Animated.View style={[styles.userMarker, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.userMarkerText}>📍</Text>
            </Animated.View>
          </Marker>
          {manualOrigin && (
            <Marker
              coordinate={manualOrigin.coordinate}
              title={`Start: ${manualOrigin.name}`}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.startMarker}>
                <Text style={styles.startMarkerText}>S</Text>
              </View>
            </Marker>
          )}
          {destinationCoord ? (
            <Marker
              coordinate={destinationCoord}
              title={`Destination: ${destination.name}`}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.destinationMarker}>
                <Text style={styles.destinationMarkerText}>E</Text>
              </View>
            </Marker>
          ) : null}
          <Marker
            coordinate={{ latitude: userCoord.latitude + 0.00012, longitude: userCoord.longitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>You are here</Text>
            </View>
          </Marker>

          {/* Building markers */}
          {!hasActiveRoute && BUILDINGS.map((b) => {
            const isDestination = destination?.building?.id === b.id;
            return (
              <Marker
                key={b.id}
                coordinate={{ latitude: b.latitude, longitude: b.longitude }}
                title={b.name}
                description={b.shortName}
                onPress={() => {
                  setDestination({ type: 'building', building: b, name: b.name });
                }}
              >
                <View style={[styles.buildingMarker, isDestination && styles.destMarker]}>
                  <Text style={styles.markerEmoji}>{getBuildingEmoji(b.type)}</Text>
                </View>
              </Marker>
            );
          })}

          {/* Amenity markers */}
          {!hasActiveRoute && AMENITIES.map((a) => {
            const isDestination = destination?.amenity?.id === a.id;
            return (
              <Marker
                key={a.id}
                coordinate={{ latitude: a.latitude, longitude: a.longitude }}
                title={a.name}
                onPress={() => {
                  setDestination({ type: 'amenity', amenity: a, name: a.name });
                }}
              >
                <View style={[styles.amenityMarker, isDestination && styles.destAmenityMarker]}>
                  <Text style={styles.markerEmoji}>{getAmenityEmoji(a.type)}</Text>
                </View>
              </Marker>
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
                    navigation.navigate('Places');
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
                />
              </View>
              <View style={[styles.searchFieldWrap, styles.destinationSearchFieldWrap]}>
                <CampusSearchBar
                  userCoord={routeStartCoord}
                  onSelect={handleSearchSelect}
                  placeholder="Search destination"
                  displayValue={destination?.name}
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
                    travelMode === 'bus' && styles.modePillActive,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => setTravelMode('bus')}
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

          {voiceBanner && (
            <View style={styles.voiceBannerContainer}>
              {voiceBanner.text && <Text style={styles.voiceBannerText}>🎙 "{voiceBanner.text}"</Text>}
              {voiceBanner.error && <Text style={styles.voiceBannerError}>⚠️ {voiceBanner.error}</Text>}
              <Pressable onPress={() => setVoiceBanner(null)} style={styles.voiceDismiss}>
                <Text style={styles.voiceDismissText}>✕</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {/* Directions Panel */}
      {isNavigating && activeRoute && destination && steps.length > 0 && (
        <View style={styles.directionsContainer}>
          <CampusDirectionsPanel
            destinationName={destination.name}
            distanceLabel={displayedDistanceLabel || ''}
            etaLabel={displayedEtaLabel || ''}
            steps={steps}
            modeLabel={effectiveMode === 'bus' ? 'Bus Trip' : 'Walking'}
            routeNote={displayedRouteNote}
            voiceEnabled={voiceEnabled}
            onToggleVoice={handleToggleVoice}
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
          voiceEnabled={voiceEnabled}
          onToggleVoice={handleToggleVoice}
          onClearRoute={handleClearRoute}
          onStartDirections={handleStartDirections}
        />
      )}

      {/* Voice FAB */}
      {showVoiceFab ? (
        <Pressable
          style={({ pressed }) => [
            styles.voiceFab,
            isNavigating ? styles.voiceFabNavigating : styles.voiceFabDocked,
            voiceState === 'listening' && styles.voiceFabListening,
            voiceState === 'processing' && styles.voiceFabProcessing,
            pressed && styles.btnPressed,
          ]}
          onPress={handleVoicePress}
          disabled={voiceState === 'processing'}
        >
          {voiceState === 'processing' ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.voiceFabIcon}>
              {voiceState === 'listening' ? '⏹️' : '🎤'}
            </Text>
          )}
          <Text style={styles.voiceFabText}>
            {voiceState === 'listening' ? 'Tap to stop' : voiceState === 'processing' ? 'Processing…' : 'Voice'}
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
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
  modePillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modePillTextActive: {
    color: '#FFF',
  },
  originPill: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  originPillText: {
    color: COLORS.textPrimary,
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
    backgroundColor: 'rgba(8,8,8,0.92)',
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
