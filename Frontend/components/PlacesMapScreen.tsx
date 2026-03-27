import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
    LayoutAnimation
} from 'react-native';
import axios from 'axios';
import { useTheme, Card } from './SharedUI';
import { 
    MapPin, Navigation, Info, Utensils, Star, X, ChevronRight, 
    TrafficCone, Library, Dumbbell, Clock, MessageSquare, Plus, 
    ChevronDown, ChevronUp, ExternalLink, Calendar, Flame,
    Layers, Search, MessageSquarePlus, Bus
} from 'lucide-react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { transitService } from '../services/transitService';
import { useUser } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { connectFeedsUser } from '../services/streamFeeds';
import { API_URL } from '../config';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Snap point translateY values (distance from top of screen)
const SNAP_PEEK  = SCREEN_HEIGHT * 0.58; // ~42% of screen visible
const SNAP_FULL  = SCREEN_HEIGHT * 0.08; // ~92% of screen visible
const SNAP_HIDDEN = SCREEN_HEIGHT;        // off-screen

const TAMU_CENTER = {
    latitude: 30.6153,
    longitude: -96.341,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
};

const DARK_MAP_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

// AI-estimated campus-wide density zones — independent of registered locations.
// Filtered to only show gyms and libraries as requested.
const CAMPUS_ZONES: Array<{
    name: string; lat: number; lng: number;
    peak: number; off: number; radius: number;
    type: 'Rec' | 'Library' | 'Dining';
    hours?: string;
}> = [
    { 
        name: 'Student Rec Center', 
        lat: 30.6097, lng: -96.3455, 
        peak: 70, off: 10, radius: 220, type: 'Rec',
        hours: '6:00 AM – 11:59 PM' // Updated based on March 26 data
    },
    { name: 'Southside Rec Center',              lat: 30.6093, lng: -96.3390, peak: 65, off: 10, radius: 200, type: 'Rec' },
    { name: 'Polo Road Rec Center',              lat: 30.6237, lng: -96.3395, peak: 55, off:  8, radius: 200, type: 'Rec' },
    { name: 'Evans Library',                     lat: 30.6168, lng: -96.3388, peak: 82, off: 18, radius: 160, type: 'Library' },
    { name: 'Evans Library Annex',               lat: 30.6168, lng: -96.3388, peak: 70, off: 15, radius: 120, type: 'Library' },
    { name: 'West Campus Library',               lat: 30.6095, lng: -96.3445, peak: 60, off: 14, radius: 160, type: 'Library' },
    { name: 'Evans Library Annex',               lat: 30.6168, lng: -96.3388, peak: 70, off: 15, radius: 120, type: 'Library' },
    { name: 'Memorial Student Center',           lat: 30.6125, lng: -96.3410, peak: 85, off: 15, radius: 180, type: 'Dining' },
    { name: 'Polo Road Garage',                  lat: 30.6237, lng: -96.3395, peak: 80, off: 10, radius: 180, type: 'Dining' },
    { name: 'Underground Food Court',            lat: 30.6128, lng: -96.3418, peak: 70, off:  5, radius: 150, type: 'Dining' },
];

function getTimeOfDayFactor(): number {
    const hour = new Date().getHours();
    if (hour >= 8  && hour < 9)  return 0.55;
    if (hour >= 9  && hour < 11) return 0.95;
    if (hour >= 11 && hour < 14) return 1.00;
    if (hour >= 14 && hour < 17) return 0.85;
    if (hour >= 17 && hour < 19) return 0.60;
    if (hour >= 19 && hour < 22) return 0.45;
    return 0.12;
}

function getZoneDensity(zone: typeof CAMPUS_ZONES[0]): number {
    const factor = getTimeOfDayFactor();
    return Math.round(zone.off + (zone.peak - zone.off) * factor);
}

type LocationType = 'Rec' | 'Library' | 'Dining' | 'Hub' | 'Study' | 'General';

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
}

const CATEGORIES = [
    { id: 'Heatmap', label: 'Traffic',    icon: <Layers  size={18} /> },
    { id: 'Bus',     label: 'Bus',        icon: <Bus     size={18} /> },
    { id: 'Library', label: 'Libraries',  icon: <Library size={18} /> },
    { id: 'Rec',     label: 'Gyms',       icon: <Dumbbell size={18} /> },
    { id: 'Dining',  label: 'Food',       icon: <Utensils size={18} /> },
];

const getCategoryIcon = (type: LocationType) => {
    switch (type) {
        case 'Library': return <Library />;
        case 'Rec':     return <Dumbbell />;
        case 'Dining':  
        case 'Hub':     return <Utensils />;
        default:        return <Info />;
    }
};

const getStatusColor = (pct: number) => {
    if (pct < 40) return '#32D74B';
    if (pct < 75) return '#FF9500';
    return '#FF3B30';
};

export function PlacesMapScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);

    // ── Proximity State ──
    const [selectedStop, setSelectedStop] = useState<any | null>(null);
    const [selectedBus, setSelectedBus] = useState<any | null>(null);
    const [nearestBusInfo, setNearestBusInfo] = useState<string | null>(null);
    const busPulseAnim = useRef(new Animated.Value(1)).current;

    const [locations, setLocations]               = useState<CampusLocation[]>([]);
    const [loading, setLoading]                   = useState(true);
    const [activeLayer, setActiveLayer]           = useState<string>('Heatmap');

    // ── Pulse Animation ──
    useEffect(() => {
        if (activeLayer === 'Bus') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(busPulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
                    Animated.timing(busPulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }
    }, [activeLayer]);

    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [selectedId, setSelectedId]             = useState<string | null>(null);
    const indicatorAnim = useRef(new Animated.Value(0)).current;
    const [searchQuery, setSearchQuery]           = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [streamReviews, setStreamReviews]       = useState<any[]>([]);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [newRating, setNewRating]               = useState(5);
    const [newReviewText, setNewReviewText]       = useState('');
    const [isPostingReview, setIsPostingReview]   = useState(false);
    const [allReviewsModalVisible, setAllReviewsModalVisible] = useState(false);
    const [hubRestaurants, setHubRestaurants]     = useState<string[]>([]);
    const [isFetchingDining, setIsFetchingDining] = useState(false);
    const [isFetchingReviews, setIsFetchingReviews] = useState(false);
    
    // ── Transit State ──
    const [busRoutes, setBusRoutes] = useState<any[]>([]);
    const [busVehicles, setBusVehicles] = useState<any[]>([]);
    const [busStops, setBusStops] = useState<any[]>([]);
    const [selectedBusRouteId, setSelectedBusRouteId] = useState<string | null>(null);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [routePatterns, setRoutePatterns] = useState<any[]>([]);
    const [isFetchingBus, setIsFetchingBus] = useState(false);
    const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
    const busPollInterval = useRef<any>(null);
    const { user }                                = useUser();
    const mapRef       = useRef<any>(null);

    // ── Bottom sheet animation ──────────────────────────────────────────────
    const sheetY       = useRef(new Animated.Value(SNAP_HIDDEN)).current;
    // Track where the sheet currently rests (for gesture delta calc)
    const sheetSnap    = useRef<number>(SNAP_HIDDEN);
    // Track gesture start position
    const panStartY    = useRef<number>(SNAP_HIDDEN);

    const animateSheet = useCallback((toValue: number, onDone?: () => void) => {
        sheetSnap.current = toValue;
        Animated.spring(sheetY, {
            toValue,
            useNativeDriver: true,
            damping: 30,
            stiffness: 260,
            mass: 0.9,
        }).start(onDone);
    }, [sheetY]);

    // Open/close sheet when selection changes
    useEffect(() => {
        if (selectedId) {
            animateSheet(SNAP_PEEK);
            fetchReviews(selectedId);
            fetchDiningData(selectedId);
        } else {
            animateSheet(SNAP_HIDDEN);
            setStreamReviews([]);
            setHubRestaurants([]);
            setHubRestaurants([]);
        }
    }, [selectedId, animateSheet]);

    const fetchReviews = async (placeId: string, limit = 5) => {
        if (limit > 5) setIsFetchingReviews(true);
        try {
            const { getPlaceReviews } = require('../services/streamFeeds');
            const revs = await getPlaceReviews(placeId, limit);
            setStreamReviews(revs);
        } catch (e) {
            console.warn("Failed to fetch stream reviews", e);
        } finally {
            setIsFetchingReviews(false);
        }
    };

    const fetchDiningData = async (placeId: string) => {
        setIsFetchingDining(true);
        try {
            // Use raw placeId (backend handles normalization)
            const encodedId = encodeURIComponent(placeId);
            const hubUrl = `${API_URL}/dining/hubs/${encodedId}`;
            const menuUrl = `${API_URL}/dining/menus/${encodedId}`;
            console.log(`[Dining] Fetching Hub/Menu for: ${placeId}`);
            
            // 1. Try to fetch as HUB
            const hubRes = await axios.get(hubUrl).catch(() => null);
            if (hubRes && hubRes.data && hubRes.data.restaurants) {
                setHubRestaurants(hubRes.data.restaurants);
            } else {
                setHubRestaurants([]);
            }


        } catch (e) {
            console.warn("Failed to fetch dining data", e);
        } finally {
            setIsFetchingDining(false);
        }
    };

    const isFetchingRef = useRef(false);
    const fetchBusData = async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsFetchingBus(true);
        try {
            console.log('[Transit] Fetching metadata and active routes...');
            const metadata = await transitService.getRoutesMetadata();
            const activeIds = await transitService.getActiveRoutes();
            
            console.log('[Transit] Metadata count:', metadata.length);
            console.log('[Transit] Active IDs:', activeIds);

            // Filter metadata to only show active routes
            // Note: Some systems use 'ShortName', others 'Name' for active IDs.
            const activeRoutes = metadata.filter(m => 
                activeIds.includes(m.ShortName) || 
                activeIds.includes(m.Key) ||
                activeIds.includes(m.Name)
            );
            
            // If filtering fails, show all metadata so the user has a dropdown
            const finalRoutes = activeRoutes.length > 0 ? activeRoutes : metadata;

            console.log('[Transit] Final Active Routes count:', finalRoutes.length);
            setBusRoutes(finalRoutes);
            
            // Check if current selection is invalid or missing
            const isSelectionActive = finalRoutes.some(r => r.Key === selectedBusRouteId);
            if (finalRoutes.length > 0 && (!selectedBusRouteId || !isSelectionActive)) {
                handleSelectBusRoute(finalRoutes[0].Key);
            }
        } catch (e) {
            console.warn("Failed to fetch bus routes", e);
        } finally {
            setIsFetchingBus(false);
            isFetchingRef.current = false;
        }
    };

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 3958.8; // miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const handleStopPress = (stop: any) => {
        setSelectedStop(stop);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Calculate proximity to nearest bus on this route (Refined Accuracy)
        if (busVehicles.length > 0) {
            const busesOnRoute = busVehicles.filter(v => v.RouteKey === selectedBusRouteId);
            if (busesOnRoute.length > 0) {
                let minDistance = Infinity;
                
                // Find nearest bus by coordinates
                busesOnRoute.forEach(bus => {
                    const d = Math.sqrt(
                        Math.pow(bus.Latitude - stop.Latitude, 2) + 
                        Math.pow(bus.Longitude - stop.Longitude, 2)
                    );
                    if (d < minDistance) minDistance = d;
                });
                
                // Conversions (Roughly 111,000 meters per degree)
                const meters = minDistance * 111000;
                const minutes = Math.round(meters / 280); // Rough estimate: 280m/min (10mph avg with stops)

                if (meters < 200) setNearestBusInfo('Arriving Now');
                else if (meters < 1000) setNearestBusInfo(`${Math.round(meters)}m away (Est. ${minutes}m)`);
                else setNearestBusInfo(`${(meters/1000).toFixed(1)}km away (Est. ${minutes}m)`);
            } else {
                setNearestBusInfo('No buses currently active');
            }
        } else {
            setNearestBusInfo('Searching for buses...');
        }
    };

    const handleSelectBusRoute = async (routeId: string) => {
        console.log('[Transit] Selecting route:', routeId);
        setSelectedBusRouteId(routeId);
        setSelectedStop(null); // Clear stop info when changing routes
        setSelectedBus(null); // Clear bus info when changing routes
        try {
            // 1. Fetch the route pattern (polyline) and STOPS
            const { points, stops } = await transitService.getRoutePattern(routeId);
            if (points && points.length > 0) {
                console.log('[Transit] Route trace points found:', points.length);
                setRoutePatterns(points);
            } else {
                console.warn('[Transit] No route trace found for:', routeId);
                setRoutePatterns([]);
            }

            if (stops && stops.length > 0) {
                console.log('[Transit] Stops found:', stops.length);
                setBusStops(stops);
            } else {
                console.warn('[Transit] No stops found for:', routeId);
                setBusStops([]);
            }

            // 1.5 Auto-zoom to fit the route bounds
            if (mapRef.current && points.length > 0) {
                mapRef.current.fitToCoordinates(points, {
                    edgePadding: { top: 220, right: 60, bottom: 80, left: 60 },
                    animated: true
                });
            }
            
            // 2. Fetch real-time vehicles
            const vehicles = await transitService.getVehicles(routeId);
            console.log(`[Transit] Found ${vehicles.length} vehicles for route ${routeId}`);
            if (vehicles.length > 0) {
                console.log('[Transit] Sample vehicle coords:', vehicles[0].Latitude, vehicles[0].Longitude);
            }
            setBusVehicles(vehicles);
        } catch (e) {
            console.warn("Failed to select bus route", e);
        }
    };

    // Poll for bus locations
    useEffect(() => {
        if (activeLayer === 'Bus' && selectedBusRouteId) {
            busPollInterval.current = setInterval(async () => {
                const updated = await transitService.getVehicles(selectedBusRouteId);
                setBusVehicles(updated);
            }, 5000);
        } else {
            if (busPollInterval.current) clearInterval(busPollInterval.current);
        }
        return () => {
            if (busPollInterval.current) clearInterval(busPollInterval.current);
        };
    }, [activeLayer, selectedBusRouteId]);

    useEffect(() => {
        if (activeLayer === 'Bus') {
            fetchBusData();
        }
    }, [activeLayer]);

    const panResponder = useMemo(() => PanResponder.create({
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
            const midPeekFull   = (SNAP_PEEK + SNAP_FULL)   / 2;
            const midPeekHidden = (SNAP_PEEK + SNAP_HIDDEN)  / 2;

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
    }), [animateSheet]);
    // ───────────────────────────────────────────────────────────────────────

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_URL}/traffic/retrieve`);
            let fetched = res.data.filter((d: any) => d.coord);
            
            // Ensure Hubs are present even if traffic data misses them
            const hubs = [
                { location: 'Memorial Student Center (MSC)', type: 'Hub', coord: { lat: 30.6123, lng: -96.3415 }, percent_full: 45, is_live: false, hours: '7:00 AM – 10:00 PM' },
                { location: 'Polo Road Garage', type: 'Hub', coord: { lat: 30.6225, lng: -96.3353 }, percent_full: 30, is_live: false, hours: '7:00 AM – 9:00 PM' },
                { location: 'The Underground', type: 'Hub', coord: { lat: 30.6120, lng: -96.3408 }, percent_full: 60, is_live: false, hours: '10:00 AM – 8:00 PM' }
            ];

            const combined = [...fetched];
            hubs.forEach(h => {
                if (!combined.find(c => c.location.includes(h.location) || h.location.includes(c.location))) {
                    combined.push(h);
                }
            });

            // Merge high-fidelity hours/data from CAMPUS_ZONES
            const finalData = combined.map(loc => {
                const zone = CAMPUS_ZONES.find(z => z.name === loc.location);
                if (zone && zone.hours) {
                    return { ...loc, hours: zone.hours };
                }
                return loc;
            });

            setLocations(finalData);
        } catch (err) {
            console.warn("Failed to fetch traffic data", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLocations = useMemo(() => {
        if (activeLayer === 'Heatmap') return [];
        if (activeLayer === 'Dining') return locations.filter(loc => loc.type === 'Dining' || loc.type === 'Hub');
        return locations.filter(loc => loc.type === activeLayer);
    }, [locations, activeLayer]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return locations.filter(loc =>
            loc.location.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);
    }, [locations, searchQuery]);

    const selectedLoc = useMemo(() =>
        locations.find(l => l.location === selectedId),
        [locations, selectedId]);

    const handleSelectLocation = useCallback((loc: CampusLocation) => {
        setSelectedId(loc.location);
        setSearchQuery('');
        setShowSearchResults(false);
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: loc.coord.lat,
                longitude: loc.coord.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 800);
        }
    }, []);

    const handlePostReview = async () => {
        if (!user || !selectedId || !newReviewText.trim()) return;
        setIsPostingReview(true);
        try {
            const { addPlaceReview } = require('../services/streamFeeds');
            await addPlaceReview({
                userId: user.id,
                userName: user.fullName || user.username || 'Aggie',
                userImage: user.imageUrl,
                placeId: selectedId,
                rating: newRating,
                text: newReviewText.trim()
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setReviewModalVisible(false);
            setNewReviewText('');
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
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                initialRegion={TAMU_CENTER}
                showsUserLocation={true}
                showsPointsOfInterest={activeLayer === 'Heatmap' ? false : true}
                showsBuildings={activeLayer === 'Heatmap' ? false : true}
                showsTraffic={false}
                customMapStyle={DARK_MAP_STYLE}
                onPress={() => {
                    setSelectedId(null);
                    setShowSearchResults(false);
                    if (isSearchExpanded) {
                        LayoutAnimation.configureNext({ duration: 250, create: { type: 'easeInEaseOut', property: 'opacity' }, update: { type: 'spring', springDamping: 0.9, initialVelocity: 0.5 }, delete: { type: 'easeOut', property: 'opacity' } });
                        setIsSearchExpanded(false);
                        setSearchQuery('');
                    }
                }}
                onMarkerPress={(e) => {
                    const id = e.nativeEvent.id;
                    if (id) setSelectedId(id);
                }}
            >
                {/* AI-estimated campus-wide density zones */}
                {activeLayer === 'Heatmap' && CAMPUS_ZONES.map((zone, i) => {
                    const density = getZoneDensity(zone);
                    const color = getStatusColor(density);
                    return (
                        <Circle
                            key={`zone-${i}`}
                            center={{ latitude: zone.lat, longitude: zone.lng }}
                            radius={zone.radius}
                            fillColor={color + '2E'}
                            strokeColor={color + '80'}
                            strokeWidth={2}
                        />
                    );
                })}

                {/* Transit Layer: Route Polyline */}
                {activeLayer === 'Bus' && routePatterns.length > 0 && (
                    <Polyline
                        coordinates={routePatterns}
                        strokeColor="#800000" // TAMU Maroon
                        strokeWidth={6}
                        lineDashPattern={[0]} // Solid
                    />
                )}

                {/* Transit Layer: Bus Stops (MaroonRides Style: Blue Pins) */}
                {activeLayer === 'Bus' && busStops.map((stop, idx) => (
                    <Marker
                        key={`stop-${stop.StopCode || idx}`}
                        coordinate={{ latitude: stop.Latitude, longitude: stop.Longitude }}
                        onPress={() => handleStopPress(stop)}
                        tracksViewChanges={false}
                        zIndex={100}
                    >
                        <View style={styles.busStopPin}>
                            <MapPin size={16} color="#FFF" />
                        </View>
                    </Marker>
                ))}

                {/* Transit Layer: Bus Vehicles (MaroonRides Style: Bus Icons with Number) */}
                {activeLayer === 'Bus' && busVehicles.map((bus) => (
                    <Marker
                        key={`bus-${bus.Key}`}
                        coordinate={{ latitude: bus.Latitude, longitude: bus.Longitude }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        zIndex={200}
                        flat={true}
                        onPress={() => {
                            setSelectedBus(bus);
                            setSelectedStop(null);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                    >
                        <View style={[
                            styles.busMarker, 
                            { transform: [{ rotate: `${bus.Heading}deg` }] }
                        ]}>
                            <View style={{ transform: [{ rotate: `-${bus.Heading}deg` }] }}>
                                <Text style={styles.busMarkerText}>
                                    {busRoutes.find(r => r.Key === bus.RouteKey)?.ShortName || ''}
                                </Text>
                            </View>
                        </View>
                    </Marker>
                ))}

                {/* Marker rendering fixes: Ensure markers are always rendered for active categories */}
                {locations.filter(loc => {
                    if (activeLayer === 'Heatmap' || activeLayer === 'Bus') return false;
                    const isDiningTab = activeLayer === 'Dining';
                    return loc.type === activeLayer || (isDiningTab && loc.type === 'Hub');
                }).map((loc) => {
                    const isSelected = selectedId === loc.location;
                    const catIcon = getCategoryIcon(loc.type);
                    return (
                        <Marker
                            key={`marker-${loc.location}`}
                            identifier={loc.location}
                            coordinate={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
                            tracksViewChanges={false}
                            anchor={{ x: 0.5, y: 1 }}
                            zIndex={isSelected ? 100 : 1}
                            onPress={() => setSelectedId(loc.location)}
                        >
                            <View style={styles.pinContainer} pointerEvents="none">
                                <View style={[styles.pinHead, { backgroundColor: isSelected ? '#FF8A00' : '#800000' }]}>
                                    <View style={styles.pinInnerCircle}>
                                        {React.cloneElement(catIcon as React.ReactElement<any>, {
                                            size: 12,
                                            color: isSelected ? '#FFF' : '#FF8A8A'
                                        })}
                                    </View>
                                </View>
                                <View style={[styles.pinTail, { borderTopColor: isSelected ? '#FF8A00' : '#800000' }]} />
                            </View>
                        </Marker>
                    );
                })}
            </MapView>

            {/* Unified Top Navigation Pill Bar */}
            <View style={styles.topContainer} pointerEvents="box-none">
                <View style={[styles.pillBar, isSearchExpanded && { backgroundColor: '#000', borderColor: '#222' }]}>
                    {isSearchExpanded ? (
                        <View style={styles.searchExpanded}>
                            <Search size={20} color={COLORS.textTertiary} />
                            <TextInput
                                style={[styles.searchInput, { color: COLORS.textPrimary }]}
                                placeholder="Search any location..."
                                placeholderTextColor={COLORS.textTertiary}
                                value={searchQuery}
                                onChangeText={(t) => { setSearchQuery(t); setShowSearchResults(true); }}
                                autoFocus
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 12 }}>
                                    <X size={18} color={COLORS.textTertiary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setIsSearchExpanded(false);
                                setSearchQuery('');
                                setShowSearchResults(false);
                            }}>
                                <Text style={styles.cancelSearchText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.pillTabsContainer}>
                            <TouchableOpacity
                                style={styles.searchIconBtn}
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setIsSearchExpanded(true);
                                }}
                            >
                                <Search size={20} color={COLORS.textTertiary} />
                            </TouchableOpacity>
                            <View style={styles.pillDivider} />
                            
                            {/* Animated Background Indicator */}
                            {(() => {
                                const totalWidth = width - 40;
                                const searchWidth = 44 + 4 + 1; // button + gap + divider
                                const availablePillSpace = totalWidth - searchWidth - 8; // minus outer padding
                                const pillTabWidth = availablePillSpace / CATEGORIES.length;
                                
                                const translateX = indicatorAnim.interpolate({
                                    inputRange: [0, 1, 2, 3, 4],
                                    outputRange: [0, pillTabWidth, pillTabWidth * 2, pillTabWidth * 3, pillTabWidth * 4],
                                });

                                return (
                                    <>
                                        <Animated.View 
                                            style={[
                                                styles.pillIndicator,
                                                { width: pillTabWidth, transform: [{ translateX }] }
                                            ]}
                                        />
                                        {CATEGORIES.map((cat, index) => {
                                            const isActive = activeLayer === cat.id;
                                            return (
                                                <TouchableOpacity
                                                    key={cat.id}
                                                    style={[styles.pillTab, { width: pillTabWidth }]}
                                                    onPress={() => {
                                                        setActiveLayer(cat.id);
                                                        setSelectedId(null);
                                                        Animated.spring(indicatorAnim, {
                                                            toValue: index,
                                                            useNativeDriver: true,
                                                            tension: 300,
                                                            friction: 30,
                                                        }).start();
                                                    }}
                                                >
                                                    {React.cloneElement(cat.icon as React.ReactElement<any>, {
                                                        color: isActive ? '#FFFFFF' : COLORS.textTertiary,
                                                        size: 14
                                                    })}
                                                    <Text style={[styles.pillLabel, isActive && styles.pillLabelActive, { marginTop: 2 }]}>
                                                        {cat.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </View>
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
                                    <Text style={[styles.searchItemName, { color: COLORS.textPrimary }]}>{loc.location}</Text>
                                    <Text style={styles.searchItemSub}>{loc.type} · {loc.percent_full}% full</Text>
                                </View>
                                <ChevronRight size={16} color={COLORS.textTertiary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Bus Route Selector Overlay - Independent and Left Aligned */}
            {activeLayer === 'Bus' && busRoutes.length > 0 && (
                <View style={styles.busRouteSelectorOuter} pointerEvents="box-none">
                    <TouchableOpacity 
                        style={styles.busRouteDropdownTrigger}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setIsRouteDropdownOpen(!isRouteDropdownOpen);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        <View style={styles.selectedRouteBadge}>
                            <View style={{ minWidth: 32, paddingHorizontal: 4, alignItems: 'center' }}>
                                <Text style={styles.selectedRouteNumber} numberOfLines={1}>
                                    {busRoutes.find(r => r.Key === selectedBusRouteId)?.ShortName || '??'}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.selectedRouteTextStack}>
                            <Text style={styles.labelSubText}>Current Route</Text>
                            <Text style={styles.selectedRouteName} numberOfLines={1}>
                                {busRoutes.find(r => r.Key === selectedBusRouteId)?.Name || 'Select Route'}
                            </Text>
                        </View>
                        <View style={styles.chevronIcon}>
                            <ChevronDown size={16} color={COLORS.textTertiary} style={isRouteDropdownOpen && { transform: [{ rotate: '180deg' }] }} />
                        </View>
                    </TouchableOpacity>

                    {isRouteDropdownOpen && (
                        <View style={styles.busRoutesDropdown}>
                            <ScrollView 
                                showsVerticalScrollIndicator={false} 
                                contentContainerStyle={styles.busDropdownScroll}
                                nestedScrollEnabled={true}
                            >
                                {busRoutes.map((route) => {
                                    const isSelected = selectedBusRouteId === route.Key;
                                    return (
                                        <TouchableOpacity
                                            key={route.Key}
                                            style={[styles.busRouteItem, isSelected && styles.busRouteItemActive]}
                                            onPress={() => {
                                                handleSelectBusRoute(route.Key);
                                                setIsRouteDropdownOpen(false);
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            }}
                                        >
                                            <View style={[styles.routeItemBadge, { backgroundColor: isSelected ? '#500000' : '#1A1A1A' }]}>
                                                <Text style={styles.routeItemNumber}>{route.ShortName}</Text>
                                            </View>
                                            <Text style={[styles.routeItemName, isSelected && styles.routeItemNameActive]}>
                                                {route.Name}
                                            </Text>
                                            {isSelected && <View style={styles.activeCheckDot} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* Bus Stop Info Card - Docked at Bottom for Professional Look */}
            {activeLayer === 'Bus' && selectedStop && (
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
                            <Text style={styles.dockedStopName} numberOfLines={1}>{selectedStop.Name}</Text>
                            <View style={styles.proximityRow}>
                                <Clock size={12} color={COLORS.textTertiary} style={{ marginRight: 4 }} />
                                <Text style={styles.dockedStopProximity}>{nearestBusInfo}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.closeStopBtn} onPress={() => setSelectedStop(null)}>
                            <X size={20} color={COLORS.textTertiary} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
            )}

            {/* Bus Vehicle Info Card (MaroonRides Style) */}
            {activeLayer === 'Bus' && selectedBus && (
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
                                <Text style={styles.busInfoBadgeText}>ID: {selectedBus.Name}</Text>
                            </View>
                            {selectedBus.Capacity > 0 && (
                                <View style={[
                                    styles.loadBadge, 
                                    { backgroundColor: (selectedBus.PassengersOnboard / selectedBus.Capacity) > 0.8 ? '#FF3B3020' : '#32D74B20' }
                                ]}>
                                    <Text style={[
                                        styles.loadText,
                                        { color: (selectedBus.PassengersOnboard / selectedBus.Capacity) > 0.8 ? '#FF3B30' : '#32D74B' }
                                    ]}>
                                        {Math.round((selectedBus.PassengersOnboard / selectedBus.Capacity) * 100)}% Full
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.busInfoRouteName}>
                            Heading on Route {busRoutes.find(r => r.Key === selectedBus.RouteKey)?.ShortName}
                        </Text>
                    </View>
                    <X size={20} color={COLORS.textTertiary} />
                </TouchableOpacity>
            )}

            {/* ── Google Maps-style Bottom Sheet ─────────────────────────────── */}
            {selectedId && activeLayer !== 'Bus' && (
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
                            <View style={{ flex: 1 }}>
                                <View style={styles.sheetBadgeRow}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeText}>{selectedLoc.type}</Text>
                                    </View>
                                    {selectedLoc.is_live ? (
                                        <View style={styles.liveBadge}>
                                            <View style={styles.livePulse} />
                                            <Text style={styles.liveText}>Live</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.aiBadge}>
                                            <Text style={styles.aiText}>AI Est.</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.locationName}>{selectedLoc.location}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSelectedId(null)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                style={styles.dismissBtn}
                            >
                                <X size={18} color="#888" />
                            </TouchableOpacity>
                        </View>

                        {/* Replace hardcoded occupancy with lists for Hubs/Dining */}
                        {/* Hub Restaurants */}
                        {hubRestaurants.length > 0 ? (
                            <View style={styles.infoBlock}>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.sectionTitle}>Inside this Hub</Text>
                                    <View style={styles.restaurantChipList}>
                                        {hubRestaurants.map((r, i) => (
                                            <View key={i} style={styles.restaurantChip}>
                                                <Text style={styles.restaurantChipText}>{r}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.hoursInfo}>
                                    <Clock size={12} color={COLORS.textTertiary} />
                                    <Text style={styles.hoursText}>{selectedLoc.hours || 'Open Today · 7:00 AM – 10:00 PM'}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.occupancyBlock}>
                                <View style={styles.occupancyRow}>
                                    <Text style={styles.occupancyValue}>{selectedLoc.percent_full}%</Text>
                                    <Text style={styles.statSubText}>occupancy</Text>
                                </View>
                                <View style={styles.occupancyTrack}>
                                    <View style={[styles.occupancyFill, {
                                        width: `${selectedLoc.percent_full}%` as any,
                                        backgroundColor: getStatusColor(selectedLoc.percent_full)
                                    }]} />
                                </View>
                                <View style={styles.hoursInfo}>
                                    <Clock size={12} color={COLORS.textTertiary} />
                                    <Text style={styles.hoursText}>{selectedLoc.hours || '6:00 AM – 12:00 AM'}</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.sheetDivider} />

                        {/* Scrollable detail content */}
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            scrollEventThrottle={16}
                        >
                            {/* Traffic chart - REMOVED per user request (was hardcoded/estimated) */}

                            {/* Reviews from Stream */}
                            <View style={styles.reviewsHeader}>
                                <Text style={styles.sectionTitle}>Reviews</Text>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <TouchableOpacity onPress={() => setReviewModalVisible(true)}>
                                        <Text style={styles.addReviewText}>+ Add Review</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        setAllReviewsModalVisible(true);
                                        fetchReviews(selectedId, 30);
                                    }}>
                                        <Text style={styles.seeAllText}>See all</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            {streamReviews.length > 0 ? streamReviews.slice(0, 5).map((rev, i) => (
                                <View key={rev.id || i} style={styles.reviewItem}>
                                    <View style={styles.reviewMeta}>
                                        <View style={styles.reviewUserRow}>
                                            <View style={styles.userAvatar}>
                                                <Text style={styles.avatarText}>{rev.user[0]}</Text>
                                            </View>
                                            <Text style={styles.reviewUser}>{rev.user}</Text>
                                        </View>
                                        <View style={styles.reviewStars}>
                                            {[1,2,3,4,5].map(s => (
                                                <Star key={s} size={11} fill={s <= rev.rating ? '#FFD700' : 'transparent'} color={s <= rev.rating ? '#FFD700' : '#555'} />
                                            ))}
                                        </View>
                                    </View>
                                    <Text style={styles.reviewComment} numberOfLines={3}>{rev.comment}</Text>
                                </View>
                            )) : (
                                <View style={styles.emptyReviews}>
                                    <Text style={styles.emptyReviewsText}>No reviews found for this location.</Text>
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
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ width: '100%', alignItems: 'center' }}
                        >
                            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
                                <View style={styles.reviewModalContainer}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Rate {selectedId}</Text>
                                        <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                                            <X size={20} color="#666" />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <View style={styles.starRow}>
                                        {[1,2,3,4,5].map(s => (
                                            <TouchableOpacity 
                                                key={s} 
                                                onPress={() => {
                                                    setNewRating(s);
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                }}
                                                style={styles.starTouch}
                                            >
                                                <Star 
                                                    size={38} 
                                                    fill={s <= newRating ? '#FFD700' : 'transparent'} 
                                                    color={s <= newRating ? '#FFD700' : '#333'} 
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
                                        <Text style={styles.charCount}>{newReviewText.length}/500</Text>
                                    </View>

                                    <TouchableOpacity 
                                        style={[styles.premiumPostBtn, (!newReviewText.trim() || newRating === 0) && { opacity: 0.4 }]} 
                                        onPress={handlePostReview}
                                        disabled={!newReviewText.trim() || newRating === 0 || isPostingReview}
                                    >
                                        <View style={styles.btnContent}>
                                            {isPostingReview ? (
                                                <ActivityIndicator size="small" color="#000" />
                                            ) : (
                                                <Text style={styles.premiumPostBtnText}>Post Review</Text>
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
                            <ChevronRight size={24} color="#FFF" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={styles.fullReviewsTitle}>User Reviews</Text>
                            <Text style={{ color: '#888', fontSize: 12, fontWeight: '600' }}>{selectedId}</Text>
                        </View>
                        <View style={{ width: 40 }} /> 
                    </View>

                    {isFetchingReviews ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#FFD700" />
                            <Text style={{ color: '#FFF', marginTop: 16, fontWeight: '600' }}>Loading Reviews...</Text>
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
                                                {[1,2,3,4,5].map(s => (
                                                    <Star key={s} size={11} fill={s <= rev.rating ? '#FFD700' : 'transparent'} color={s <= rev.rating ? '#FFD700' : '#444'} />
                                                ))}
                                            </View>
                                        </View>
                                        <Text style={styles.reviewComment}>{rev.comment}</Text>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyReviews}>
                                    <Text style={styles.emptyReviewsText}>No reviews found for this location.</Text>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    map:    { flex: 1, width: '100%' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    loaderText: { marginTop: 12, color: COLORS.textSecondary, fontWeight: '600' },

    // ── Unified Top Navigation ──────────────────────────────────────────────
    topContainer: { position: 'absolute', top: 54, left: 20, right: 20, gap: 8 },
    pillBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 32,
        padding: 4,
        position: 'relative',
        borderWidth: 1,
        borderColor: COLORS.border,
        minHeight: 46,
        alignItems: 'center',
    },
    searchExpanded: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    cancelSearchText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
        marginLeft: 8,
    },
    pillTabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    searchIconBtn: {
        width: 44,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pillDivider: {
        width: 1,
        height: 24,
        backgroundColor: COLORS.border,
        marginRight: 4,
    },
    pillIndicator: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: '#800000',
        borderRadius: 26,
        left: 49,
    },
    pillTab: {
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        zIndex: 2,
    },
    pillLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textTertiary,
    },
    pillLabelActive: {
        color: '#FFFFFF',
    },
    searchInput:    { flex: 1, fontSize: 16, marginLeft: 10, padding: 0, fontWeight: '500' },
    searchResults: {
        backgroundColor: '#0A0A0A', borderRadius: 15,
        borderWidth: 1, borderColor: '#222',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8
    },
    searchItem: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        borderBottomWidth: 1, borderBottomColor: '#1A1A1A', gap: 14
    },
    searchItemName: { fontSize: 15, fontWeight: '600' },
    searchItemSub:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },

    // ── Pins ────────────────────────────────────────────────────────────────
    pinContainer:   { alignItems: 'center', justifyContent: 'center' },
    pinHead: {
        width: 38, height: 38, borderRadius: 19,
        borderWidth: 2, borderColor: '#FFF',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 6
    },
    pinInnerCircle: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center'
    },
    pinTail: {
        width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid',
        borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 12,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        marginTop: -3,
    },

    // ── Bottom Sheet ────────────────────────────────────────────────────────
    bottomSheet: {
        position: 'absolute',
        left: 8, right: 8,
        bottom: 0,
        height: SCREEN_HEIGHT * 0.92,
        backgroundColor: '#0C0C0C',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 24,
    },
    dragHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#333',
        alignSelf: 'center', marginBottom: 18,
    },
    sheetHeader: {
        flexDirection: 'row', alignItems: 'flex-start',
        marginBottom: 16, gap: 12,
    },
    sheetBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    dismissBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#1C1C1C',
        alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
    },

    typeBadge: {
        backgroundColor: 'rgba(128,0,0,0.4)',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    },
    typeText:  { color: '#FF8A8A', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    livePulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#32D74B' },
    liveText:  { color: '#32D74B', fontSize: 11, fontWeight: '700' },
    aiBadge:   { backgroundColor: 'rgba(255,149,0,0.10)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    aiText:    { color: '#FF9500', fontSize: 11, fontWeight: '700' },

    locationName: { fontSize: 20, fontWeight: '700', color: '#FFF', lineHeight: 26 },

    occupancyBlock:  { marginBottom: 16 },
    occupancyRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
    occupancyValue:  { fontSize: 32, fontWeight: '800', color: '#FFF' },
    statSubText:     { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
    occupancyTrack:  {
        height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 2, overflow: 'hidden', marginBottom: 8,
    },
    occupancyFill:   { height: '100%', borderRadius: 2 },
    hoursInfo:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
    hoursText:       { fontSize: 12, color: COLORS.textTertiary, fontWeight: '500' },

    sheetDivider:    { height: 1, backgroundColor: '#1C1C1C', marginBottom: 16 },

    chartContainer:  { marginBottom: 24 },
    chartTitle:      { fontSize: 12, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 12 },
    chartBars:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 45 },
    barWrapper:      { width: 12, height: 45, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill:         { width: '100%', borderRadius: 2 },

    sectionTitle:  { fontSize: 13, color: '#AAA', fontWeight: '700', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
    reviewItem:    { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1C1C1C' },
    reviewMeta:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
     reviewUser:    { fontSize: 14, fontWeight: '700', color: '#FFF' },
    reviewUserRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    userAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#AAA', fontSize: 10, fontWeight: '800' },
    reviewStars:   { flexDirection: 'row', gap: 3 },
    reviewComment: { fontSize: 14, color: '#DDD', lineHeight: 20 },

    infoBlock: { marginBottom: 20 },
    restaurantChipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    restaurantChip: { backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
    restaurantChipText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
    menuList: { marginBottom: 16, gap: 10 },
    menuItemCard: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#222',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    menuItemDetails: { flex: 1, gap: 6 },
    menuItemName:    { color: '#FFF', fontSize: 15, fontWeight: '800' },
    menuItemMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    menuItemCal:     { color: '#888', fontSize: 12, fontWeight: '600' },
    
    reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
    seeAllText: { color: '#FFD700', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    addReviewText: { color: '#32D74B', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    emptyReviews: { paddingVertical: 30, alignItems: 'center' },
    emptyReviewsText: { color: '#444', fontSize: 14, fontWeight: '600' },

    // ── Review Modal ────────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    reviewModalContainer: { width: '100%', backgroundColor: '#121212', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#222', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
    starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 },
    starTouch: { padding: 4 },
    inputContainer: { marginBottom: 24 },
    reviewInput: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 16, height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333' },
    charCount: { position: 'absolute', bottom: 10, right: 12, fontSize: 10, color: '#555' },
    premiumPostBtn: { backgroundColor: '#FFD700', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
    premiumPostBtnText: { color: '#000', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    // ── Full Reviews Modal ──────────────────────────────────────────────────
    fullReviewsContainer: { flex: 1, backgroundColor: '#000', paddingTop: Platform.OS === 'ios' ? 60 : 40 },
    fullReviewsHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    fullReviewsTitle:    { fontSize: 18, fontWeight: '800', color: '#FFF' },
    backBtn:             { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },

    // ── Transit Styles ──────────────────────────────────────────────────────
    busRouteSelectorOuter: {
        position: 'absolute',
        top: 130, // Way below the pill bar
        left: 20,
        width: '75%',
        zIndex: 3000,
    },
    busRouteDropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(12, 12, 12, 0.95)',
        borderRadius: 24, 
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(128, 0, 0, 0.3)',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    selectedRouteBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#500000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedRouteNumber: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '900',
    },
    selectedRouteTextStack: {
        flex: 1,
        justifyContent: 'center',
    },
    labelSubText: {
        color: '#888',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 1,
    },
    selectedRouteName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
    },
    chevronIcon: {
        paddingHorizontal: 8,
    },
    busRoutesDropdown: {
        marginTop: 8,
        maxHeight: 300,
        backgroundColor: '#121212',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#222',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 15,
    },
    busDropdownScroll: {
        paddingVertical: 8,
    },
    busRouteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    busRouteItemActive: {
        backgroundColor: 'rgba(128,0,0,0.1)',
    },
    routeItemBadge: {
        minWidth: 36,
        paddingHorizontal: 6,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    routeItemNumber: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '800',
    },
    routeItemName: {
        flex: 1,
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    routeItemNameActive: {
        color: '#FFF',
        fontWeight: '800',
    },
    activeCheckDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFD700',
        marginLeft: 8,
    },
    busMarker: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#800000',
        borderWidth: 2,
        borderColor: '#FFD700', // Gold border for visibility
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 6,
    },
    busMarkerText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '900',
    },
    busStopPin: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#007AFF', // Standard Blue
        borderWidth: 2,
        borderColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    busStopInfoCard: {
        position: 'absolute',
        bottom: 120,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(12, 12, 12, 0.98)',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#800000',
        zIndex: 2000,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    stopInfoIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#007AFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopInfoName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 2,
    },
    stopInfoProximity: {
        color: '#FFD700',
        fontSize: 13,
        fontWeight: '700',
    },
    busVehicleInfoCard: {
        position: 'absolute',
        bottom: 120,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(12, 12, 12, 0.98)',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#800000',
        zIndex: 2000,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    busInfoIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#800000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    busInfoBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    busInfoBadge: {
        backgroundColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    busInfoBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    loadBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    loadText: {
        fontSize: 11,
        fontWeight: '700',
    },
    busInfoRouteName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    dockedStopContainer: {
        position: 'absolute',
        bottom: 100, // Safe distance from bottom nav
        left: 20,
        right: 20,
        zIndex: 5000, // VERY HIGH to be on top of everything
    },
    busStopDockedCard: {
        backgroundColor: '#121212',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    stopIconCircular: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    stopPulseMarker: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#007AFF',
        opacity: 0.3,
    },
    dockedStopName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 4,
    },
    proximityRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dockedStopProximity: {
        color: '#007AFF',
        fontSize: 13,
        fontWeight: '700',
    },
    closeStopBtn: {
        padding: 8,
    },
});
