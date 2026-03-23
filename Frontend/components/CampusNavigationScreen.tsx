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
import MapView, { Marker, Polyline, Region, PROVIDER_GOOGLE } from 'react-native-maps';
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
  getIsSpeaking,
} from '../services/campusTTS';
import {
  requestMicPermission,
  startRecording,
  stopRecording as stopVoiceRecording,
  isCurrentlyRecording,
  processVoiceCommand,
  VoiceIntent,
} from '../services/campusVoice';

type NavMode = 'idle' | 'selected' | 'navigating';

export function CampusNavigationScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
  // ─── State ──────────────────────────────────────────────────
  const [navMode, setNavMode] = useState<NavMode>('idle');
  const [destination, setDestination] = useState<{
    type: 'building' | 'amenity';
    building?: CampusBuilding;
    amenity?: CampusAmenity;
    name: string;
  } | null>(null);
  const [activeRoute, setActiveRoute] = useState<WalkingRoute | null>(null);
  const [steps, setSteps] = useState<DirectionStep[]>([]);
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

  const initialRegion: Region = {
    ...TAMU_CENTER,
  };

  const pinnedItems = useMemo(() => getPinnedItems(), []);

  // ─── Effects ────────────────────────────────────────────────

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
      setSteps([]);
      setNavMode('idle');
      return;
    }

    const destCoord: Coordinate | null = destination.building
      ? { latitude: destination.building.latitude, longitude: destination.building.longitude }
      : destination.amenity
        ? { latitude: destination.amenity.latitude, longitude: destination.amenity.longitude }
        : null;

    if (!destCoord) return;

    const route = createRoute(userCoord, destCoord);
    setActiveRoute(route);

    const generatedSteps = buildDirectionSteps(
      DEFAULT_USER_LOCATION.name,
      destination.name,
      userCoord,
      destCoord,
      route.distanceMeters,
      route.estimatedTimeMinutes,
    );
    setSteps(generatedSteps);

    if (navMode === 'idle') setNavMode('selected');

    // Animate map to fit both points
    if (mapRef.current) {
      const minLat = Math.min(userCoord.latitude, destCoord.latitude);
      const maxLat = Math.max(userCoord.latitude, destCoord.latitude);
      const minLon = Math.min(userCoord.longitude, destCoord.longitude);
      const maxLon = Math.max(userCoord.longitude, destCoord.longitude);
      const fitRegion: Region = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.005),
        longitudeDelta: Math.max((maxLon - minLon) * 1.8, 0.005),
      };
      Keyboard.dismiss();
      setTimeout(() => mapRef.current?.animateToRegion(fitRegion, 800), 200);
    }

    if (Platform.OS !== 'web') Vibration.vibrate(50);
  }, [destination]);

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

  const handleStartDirections = async () => {
    if (!activeRoute || !steps.length) return;
    setNavMode('navigating');
    try {
      await stopSpeech();
      await speakRouteIntro(
        destination?.name || 'destination',
        formatDistance(activeRoute.distanceMeters),
        formatTime(activeRoute.estimatedTimeMinutes),
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
    setNavMode('idle');
    setSteps([]);
    if (mapRef.current) {
      mapRef.current.animateToRegion(initialRegion, 800);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <CampusSearchBar userCoord={userCoord} onSelect={handleSearchSelect} />
      </View>

      {/* Route Banner */}
      {activeRoute && destination && !isNavigating && (
        <View style={styles.routeBanner}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle} numberOfLines={1}>Walking to {destination.name}</Text>
            <Text style={styles.routeSub}>
              {formatDistance(activeRoute.distanceMeters)} • {formatTime(activeRoute.estimatedTimeMinutes)}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && styles.btnPressed]}
            onPress={handleStartDirections}
          >
            <Text style={styles.startBtnText}>Start</Text>
          </Pressable>
        </View>
      )}

      {/* Voice Banner */}
      {voiceBanner && (
        <View style={styles.voiceBannerContainer}>
          {voiceBanner.text && <Text style={styles.voiceBannerText}>🎙 "{voiceBanner.text}"</Text>}
          {voiceBanner.error && <Text style={styles.voiceBannerError}>⚠️ {voiceBanner.error}</Text>}
          <Pressable onPress={() => setVoiceBanner(null)} style={styles.voiceDismiss}>
            <Text style={styles.voiceDismissText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Map */}
      <View style={[styles.mapContainer, isNavigating && styles.mapMinimized]}>
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
          {activeRoute && (
            <Polyline
              coordinates={activeRoute.polyline}
              strokeColor={COLORS.primary}
              strokeWidth={4}
              lineDashPattern={[6, 4]}
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
          <Marker
            coordinate={{ latitude: userCoord.latitude + 0.00012, longitude: userCoord.longitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>You are here</Text>
            </View>
          </Marker>

          {/* Building markers */}
          {BUILDINGS.map((b) => {
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
          {AMENITIES.map((a) => {
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

      {/* Directions Panel */}
      {isNavigating && activeRoute && destination && steps.length > 0 && (
        <View style={styles.directionsContainer}>
          <CampusDirectionsPanel
            destinationName={destination.name}
            distanceLabel={formatDistance(activeRoute.distanceMeters)}
            etaLabel={formatTime(activeRoute.estimatedTimeMinutes)}
            steps={steps}
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
          hasRoute={!!activeRoute}
          destinationName={destination?.name}
          distanceLabel={activeRoute ? formatDistance(activeRoute.distanceMeters) : undefined}
          etaLabel={activeRoute ? formatTime(activeRoute.estimatedTimeMinutes) : undefined}
          onClearRoute={handleClearRoute}
          onStartDirections={handleStartDirections}
        />
      )}

      {/* Voice FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.voiceFab,
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
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: COLORS.background,
    zIndex: 1000,
  },
  routeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 999,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  routeSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  startBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginLeft: 12,
  },
  startBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  voiceBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    flex: 1,
    overflow: 'hidden',
  },
  mapMinimized: {
    flex: 0.3,
    minHeight: 180,
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
    flex: 0.7,
    minHeight: 280,
  },
  voiceFab: {
    position: 'absolute',
    bottom: 160,
    right: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    minHeight: 56,
    zIndex: 1001,
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
