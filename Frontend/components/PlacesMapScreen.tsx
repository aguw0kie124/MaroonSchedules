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
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import axios from 'axios';
import { useTheme, Card } from './SharedUI';
import { Library, Dumbbell, Utensils, Info, Layers, Search, X, Star, Clock, MapPin, ChevronRight } from 'lucide-react-native';
import { Platform } from 'react-native';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

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
const CAMPUS_ZONES: Array<{
    name: string; lat: number; lng: number;
    peak: number; off: number; radius: number;
}> = [
    { name: 'Academic Building / Rudder Plaza', lat: 30.6129, lng: -96.3408, peak: 95, off: 15, radius: 200 },
    { name: 'MSC / Aggie Park',                  lat: 30.6118, lng: -96.3425, peak: 88, off: 20, radius: 250 },
    { name: 'Evans Library Cluster',              lat: 30.6174, lng: -96.3395, peak: 82, off: 18, radius: 180 },
    { name: 'Sbisa / Duncan Dining Area',         lat: 30.6199, lng: -96.3407, peak: 85, off: 30, radius: 200 },
    { name: 'Zachry / ZACH Engineering',          lat: 30.6211, lng: -96.3367, peak: 78, off: 12, radius: 200 },
    { name: 'BLOC Student Center',                lat: 30.6089, lng: -96.3435, peak: 75, off: 40, radius: 200 },
    { name: 'Student Rec Center',                 lat: 30.6081, lng: -96.3397, peak: 70, off: 10, radius: 220 },
    { name: 'North Gate / College Ave',           lat: 30.6225, lng: -96.3353, peak: 90, off: 55, radius: 220 },
    { name: 'Corps Dorms / Dorm Row',             lat: 30.6168, lng: -96.3437, peak: 60, off: 25, radius: 200 },
    { name: 'Kyle Field / Game Day Area',         lat: 30.6100, lng: -96.3407, peak: 40, off:  5, radius: 280 },
    { name: 'West Campus / Architecture',         lat: 30.6142, lng: -96.3465, peak: 65, off: 10, radius: 180 },
    { name: 'CS / HRBB Cluster',                  lat: 30.6218, lng: -96.3397, peak: 72, off: 12, radius: 180 },
    { name: 'Commons / Cain Dining',              lat: 30.6156, lng: -96.3451, peak: 80, off: 35, radius: 200 },
    { name: 'Parking Lot / Bus Stops',            lat: 30.6245, lng: -96.3415, peak: 55, off: 20, radius: 200 },
    { name: 'TAMU Research Park Area',            lat: 30.5983, lng: -96.3410, peak: 35, off:  8, radius: 220 },
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

type LocationType = 'Rec' | 'Library' | 'Dining' | 'Study' | 'General';

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
}

const CATEGORIES = [
    { id: 'Heatmap', label: 'Traffic',    icon: <Layers  size={18} /> },
    { id: 'Library', label: 'Libraries',  icon: <Library size={18} /> },
    { id: 'Rec',     label: 'Gyms',       icon: <Dumbbell size={18} /> },
    { id: 'Dining',  label: 'Food',       icon: <Utensils size={18} /> },
];

const getCategoryIcon = (type: LocationType) => {
    switch (type) {
        case 'Library': return <Library />;
        case 'Rec':     return <Dumbbell />;
        case 'Dining':  return <Utensils />;
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

    const [locations, setLocations]               = useState<CampusLocation[]>([]);
    const [loading, setLoading]                   = useState(true);
    const [activeLayer, setActiveLayer]           = useState<string>('Heatmap');
    const [selectedId, setSelectedId]             = useState<string | null>(null);
    const [searchQuery, setSearchQuery]           = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
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
        } else {
            animateSheet(SNAP_HIDDEN);
        }
    }, [selectedId, animateSheet]);

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
            setLocations(res.data.filter((d: any) => d.coord));
        } catch (err) {
            console.warn("Failed to fetch traffic data", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLocations = useMemo(() => {
        if (activeLayer === 'Heatmap') return [];
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
                }}
                onMarkerPress={(e) => {
                    const id = e.nativeEvent.id;
                    if (id) setSelectedId(id);
                }}
            >
                {/* Heatmap: AI-estimated campus-wide density zones */}
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

                {/* Category markers */}
                {activeLayer !== 'Heatmap' && filteredLocations.map((loc) => {
                    const isSelected = selectedId === loc.location;
                    const catIcon = getCategoryIcon(loc.type);
                    return (
                        <Marker
                            key={loc.location}
                            identifier={loc.location}
                            coordinate={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
                            tracksViewChanges={false}
                            anchor={{ x: 0.5, y: 1 }}
                            zIndex={isSelected ? 100 : 1}
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

            {/* Layer selector */}
            <View style={styles.layerSelector} pointerEvents="box-none">
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat.id}
                        style={[styles.layerBtn, activeLayer === cat.id && styles.layerBtnActive]}
                        onPress={() => { setActiveLayer(cat.id); setSelectedId(null); }}
                    >
                        {React.cloneElement(cat.icon as React.ReactElement<any>, {
                            color: activeLayer === cat.id ? '#FF8A8A' : COLORS.textPrimary
                        })}
                        <Text style={[styles.layerText, activeLayer === cat.id && styles.layerTextActive]}>
                            {cat.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Search bar */}
            <View style={styles.topContainer} pointerEvents="box-none">
                <View style={styles.searchBar}>
                    <Search size={22} color={COLORS.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: COLORS.textPrimary }]}
                        placeholder="Search for any location..."
                        placeholderTextColor={COLORS.textTertiary}
                        value={searchQuery}
                        onChangeText={(t) => { setSearchQuery(t); setShowSearchResults(true); }}
                        onFocus={() => setShowSearchResults(true)}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={20} color={COLORS.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {showSearchResults && searchResults.length > 0 && (
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

            {/* ── Google Maps-style Bottom Sheet ─────────────────────────────── */}
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

                        {/* Occupancy strip */}
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

                        <View style={styles.sheetDivider} />

                        {/* Scrollable detail content */}
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            scrollEventThrottle={16}
                        >
                            {/* Traffic chart */}
                            <View style={styles.chartContainer}>
                                <Text style={styles.chartTitle}>Foot Traffic · Last 8h</Text>
                                <View style={styles.chartBars}>
                                    {(selectedLoc.traffic_history || [20, 45, 15, 60, 40, 25, 20, 50]).map((val, i) => (
                                        <View key={i} style={styles.barWrapper}>
                                            <View style={[styles.barFill, {
                                                height: Math.max(8, (val / 100) * 45),
                                                backgroundColor: getStatusColor(val)
                                            }]} />
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Reviews */}
                            <Text style={styles.sectionTitle}>Reviews</Text>
                            {(selectedLoc.reviews || [
                                { user: "Asvath M.", rating: 4, comment: "Solid choice for studying or grabbing a bite." },
                                { user: "Parin V.",  rating: 5, comment: "I really enjoy the atmosphere here." }
                            ]).map((rev, i) => (
                                <View key={i} style={styles.reviewItem}>
                                    <View style={styles.reviewMeta}>
                                        <Text style={styles.reviewUser}>{rev.user}</Text>
                                        <View style={styles.reviewStars}>
                                            {[...Array(5)].map((_, j) => (
                                                <Star
                                                    key={j}
                                                    size={11}
                                                    fill={j < rev.rating ? '#FFD700' : 'transparent'}
                                                    color={j < rev.rating ? '#FFD700' : '#333'}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                    <Text style={styles.reviewComment} numberOfLines={3}>{rev.comment}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </>
                ) : null}
            </Animated.View>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    map:    { flex: 1, width: '100%' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    loaderText: { marginTop: 12, color: COLORS.textSecondary, fontWeight: '600' },

    // ── Layer selector ──────────────────────────────────────────────────────
    layerSelector: {
        position: 'absolute', top: 50, left: 16, right: 16,
        padding: 4, borderRadius: 16, flexDirection: 'row',
        backgroundColor: COLORS.surface, gap: 4,
        borderWidth: 1, borderColor: COLORS.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
    },
    layerBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, borderRadius: 12, gap: 4
    },
    layerBtnActive: { backgroundColor: '#3D0000' },
    layerText:      { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
    layerTextActive: { color: '#FF8A8A' },

    // ── Search ──────────────────────────────────────────────────────────────
    topContainer: { position: 'absolute', top: 130, left: 16, right: 16, gap: 8 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#000', borderRadius: 15,
        paddingHorizontal: 16, paddingVertical: 14,
        borderWidth: 1, borderColor: '#222',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6
    },
    searchInput:    { flex: 1, fontSize: 18, marginLeft: 12, padding: 0, fontWeight: '500' },
    searchResults: {
        backgroundColor: '#0A0A0A', borderRadius: 15,
        borderWidth: 1, borderColor: '#222',
        marginTop: 4, overflow: 'hidden',
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

    sectionTitle:  { fontSize: 12, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 4 },
    reviewItem:    { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1C1C1C' },
    reviewMeta:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    reviewUser:    { fontSize: 14, fontWeight: '600', color: '#FFF' },
    reviewStars:   { flexDirection: 'row', gap: 3 },
    reviewComment: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
});
