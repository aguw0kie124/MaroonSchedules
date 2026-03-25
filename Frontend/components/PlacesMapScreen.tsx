import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
    TouchableOpacity,
    TextInput,
    ScrollView
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import axios from 'axios';
import { useTheme, Card } from './SharedUI';
import { Library, Dumbbell, Utensils, Info, Layers, Search, X, Star, Clock, Users, ChevronRight, MapPin } from 'lucide-react-native';
import { Platform } from 'react-native';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

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
    { id: 'Heatmap', label: 'Traffic', icon: <Layers size={18} /> },
    { id: 'Library', label: 'Libraries', icon: <Library size={18} /> },
    { id: 'Rec', label: 'Gyms', icon: <Dumbbell size={18} /> },
    { id: 'Dining', label: 'Food', icon: <Utensils size={18} /> },
];

export function PlacesMapScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const [locations, setLocations] = useState<CampusLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeLayer, setActiveLayer] = useState<string>('Heatmap');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const mapRef = React.useRef<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_URL}/traffic/retrieve`);
            const data = res.data;
            setLocations(data.filter((d: any) => d.coord));
        } catch (err) {
            console.warn("Failed to fetch traffic data", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLocations = useMemo(() => {
        if (activeLayer === 'Heatmap') return locations;
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

    const handleSelectLocation = (loc: CampusLocation) => {
        setSelectedId(loc.location);
        setSearchQuery('');
        setShowSearchResults(false);
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: loc.coord.lat,
                longitude: loc.coord.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 1000);
        }
    };

    const getStatusColor = (pct: number) => {
        if (pct < 40) return '#32D74B';
        if (pct < 75) return '#FF9500';
        return '#FF3B30';
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
                }}
                onMarkerPress={(e) => {
                    const id = e.nativeEvent.id;
                    if (id) {
                        setSelectedId(id);
                    }
                }}
            >
                {filteredLocations.map((loc) => {
                    const isSelected = selectedId === loc.location;
                    const color = getStatusColor(loc.percent_full);

                    const getCategoryIcon = (type: LocationType) => {
                        switch (type) {
                            case 'Library': return <Library />;
                            case 'Rec': return <Dumbbell />;
                            case 'Dining': return <Utensils />;
                            case 'Study': return <Info />;
                            case 'General': return <Info />;
                            default: return <Info />;
                        }
                    };
                    const catIcon = getCategoryIcon(loc.type);

                    return (
                        <React.Fragment key={loc.location}>
                            {activeLayer === 'Heatmap' ? (
                                <Circle
                                    center={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
                                    radius={Math.max(60, (loc.percent_full / 100) * 200)}
                                    fillColor={getStatusColor(loc.percent_full) + '33'}
                                    strokeColor={getStatusColor(loc.percent_full) + '66'}
                                    strokeWidth={3}
                                />
                            ) : (
                                <Marker
                                    identifier={loc.location}
                                    coordinate={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
                                    tracksViewChanges={true}
                                    anchor={{ x: 0.5, y: 1 }}
                                    zIndex={isSelected ? 100 : 1}
                                >
                                    <View style={styles.pinContainer} pointerEvents="none">
                                        <View style={[
                                            styles.pinHead,
                                            { backgroundColor: isSelected ? '#FF8A00' : '#800000' }
                                        ]}>
                                            <View style={styles.pinInnerCircle}>
                                                {React.cloneElement(catIcon as React.ReactElement<any>, {
                                                    size: 12,
                                                    color: isSelected ? '#FFF' : '#FF8A8A'
                                                })}
                                            </View>
                                        </View>
                                        <View style={[
                                            styles.pinTail,
                                            { borderTopColor: isSelected ? '#FF8A00' : '#800000' }
                                        ]} />
                                    </View>
                                </Marker>
                            )}
                        </React.Fragment>
                    );
                })}
            </MapView>

            <View style={styles.topContainer} pointerEvents="box-none">
                <View style={styles.searchBar}>
                    <Search size={22} color={COLORS.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: COLORS.textPrimary }]}
                        placeholder="Search for any location..."
                        placeholderTextColor={COLORS.textTertiary}
                        value={searchQuery}
                        onChangeText={(t) => {
                            setSearchQuery(t);
                            setShowSearchResults(true);
                        }}
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
                                    <Text style={styles.searchItemSub}>{loc.type} • {loc.percent_full}% full</Text>
                                </View>
                                <ChevronRight size={16} color={COLORS.textTertiary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.layerSelector} pointerEvents="box-none">
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat.id}
                        style={[
                            styles.layerBtn,
                            activeLayer === cat.id && styles.layerBtnActive
                        ]}
                        onPress={() => {
                            setActiveLayer(cat.id);
                            setSelectedId(null);
                        }}
                    >
                        {React.cloneElement(cat.icon as React.ReactElement<any>, {
                            color: activeLayer === cat.id ? '#FF8A8A' : COLORS.textPrimary
                        })}
                        <Text style={[
                            styles.layerText,
                            activeLayer === cat.id && styles.layerTextActive
                        ]}>
                            {cat.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {selectedLoc && (
                <View style={styles.detailCardContainer} pointerEvents="box-none">
                    <Card style={[styles.detailCard, { backgroundColor: '#0A0A0A', borderColor: '#222' }]}>
                        <View style={styles.cardTopRow}>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeText}>{selectedLoc.type.toUpperCase()}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                {selectedLoc.is_live ? (
                                    <View style={styles.liveBadge}>
                                        <View style={styles.livePulse} />
                                        <Text style={styles.liveText}>LIVE</Text>
                                    </View>
                                ) : (
                                    <View style={styles.aiBadge}>
                                        <Text style={styles.aiText}>AI ESTIMATE</Text>
                                    </View>
                                )}
                                <TouchableOpacity onPress={() => setSelectedId(null)}>
                                    <X size={24} color="#FFF" opacity={0.8} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                            <Text style={styles.locationName}>{selectedLoc.location}</Text>

                            <View style={styles.statsRow}>
                                <View style={styles.statInfo}>
                                    <Text style={styles.occupancyValue}>{selectedLoc.percent_full}%</Text>
                                    <Text style={styles.statSubText}>Occupancy</Text>
                                </View>
                                <View style={styles.hoursInfo}>
                                    <Clock size={14} color={COLORS.textTertiary} />
                                    <Text style={styles.hoursText}>{selectedLoc.hours || '6:00 AM - 12:00 AM'}</Text>
                                </View>
                            </View>

                            {/* Traffic History Mini-Chart */}
                            <View style={styles.chartContainer}>
                                <Text style={styles.chartTitle}>EXPERIMENTAL TRAFFIC (8H)</Text>
                                <View style={styles.chartBars}>
                                    {(selectedLoc.traffic_history || [20, 45, 15, 60, 40, 25, 20, 50]).map((val, i) => (
                                        <View key={i} style={styles.barWrapper}>
                                            <View style={[
                                                styles.barFill,
                                                {
                                                    height: Math.max(8, (val / 100) * 45),
                                                    backgroundColor: getStatusColor(val)
                                                }
                                            ]} />
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Reviews Section */}
                            <View style={styles.reviewsSection}>
                                <Text style={styles.sectionTitle}>LATEST REVIEWS</Text>
                                {(selectedLoc.reviews || [
                                    { user: "Asvath M.", rating: 4, comment: "Solid choice for studying or grabbing a bite." },
                                    { user: "Parin V.", rating: 5, comment: "I really enjoy the atmosphere here." }
                                ]).map((rev, i) => (
                                    <View key={i} style={styles.reviewItem}>
                                        <View style={styles.reviewMeta}>
                                            <Text style={styles.reviewUser}>{rev.user}</Text>
                                            <View style={styles.reviewStars}>
                                                {[...Array(5)].map((_, j) => (
                                                    <Star
                                                        key={j}
                                                        size={12}
                                                        fill={j < rev.rating ? '#FFD700' : 'transparent'}
                                                        color={j < rev.rating ? '#FFD700' : '#444'}
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                        <Text style={styles.reviewComment} numberOfLines={2}>{rev.comment}</Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </Card>
                </View>
            )}
        </View>
    );
}

const MAP_STYLE = [
    { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }] },
    { "featureType": "administrative.country", "elementType": "geometry", "stylers": [{ "visibility": "on" }] },
    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#121212" }, { "lightness": "5" }] },
    { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "visibility": "off" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#1D1D1D" }] }
];

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    map: { flex: 1, width: '100%' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    loaderText: { marginTop: 12, color: COLORS.textSecondary, fontWeight: '600' },

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
    layerText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
    layerTextActive: { color: '#FF8A8A' },

    topContainer: {
        position: 'absolute', top: 125, left: 16, right: 16, gap: 8
    },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#000', borderRadius: 15,
        paddingHorizontal: 16, paddingVertical: 14,
        borderWidth: 1, borderColor: '#222',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6
    },
    searchInput: { flex: 1, fontSize: 18, marginLeft: 12, padding: 0, fontWeight: '500' },
    searchResults: {
        backgroundColor: '#0A0A0A', borderRadius: 15,
        borderWidth: 1, borderColor: '#222',
        marginTop: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8
    },
    searchItem: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        borderBottomWidth: 1, borderBottomColor: '#222', gap: 14
    },
    searchItemName: { fontSize: 15, fontWeight: '600' },
    searchItemSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },

    pinContainer: { alignItems: 'center', justifyContent: 'center' },
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
        width: 0, height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 12,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2
    },

    detailCardContainer: {
        position: 'absolute', bottom: 20, left: 16, right: 16, maxHeight: '50%'
    },

    detailCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        paddingHorizontal: 20, paddingVertical: 18,
        borderWidth: 1.5, borderColor: '#333',
        borderRadius: 28,
        shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.7, shadowRadius: 24, elevation: 18,
        overflow: 'hidden'
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    typeBadge: {
        backgroundColor: '#400000', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10
    },
    typeText: { color: '#FF8A8A', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    livePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#32D74B' },
    liveText: { color: '#32D74B', fontSize: 12, fontWeight: '800' },
    aiBadge: { backgroundColor: 'rgba(255,149,0,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    aiText: { color: '#FF9500', fontSize: 12, fontWeight: '800' },

    locationName: { fontSize: 24, fontWeight: '900', color: '#FFF', lineHeight: 30, marginBottom: 10 },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 20 },
    statInfo: { gap: 4 },
    occupancyValue: { fontSize: 40, fontWeight: '900', color: '#FFF' },
    statSubText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
    hoursInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', marginBottom: 8 },
    hoursText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },

    chartContainer: { backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 20, marginBottom: 20 },
    chartTitle: { fontSize: 12, color: COLORS.textTertiary, fontWeight: '800', letterSpacing: 1.2, marginBottom: 14 },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 45, paddingHorizontal: 6 },
    barWrapper: { width: 12, height: 45, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderRadius: 4 },

    reviewsSection: { gap: 12 },
    sectionTitle: { fontSize: 13, color: COLORS.textTertiary, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
    reviewItem: { backgroundColor: 'rgba(255,255,255,0.04)', padding: 18, borderRadius: 20 },
    reviewMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    reviewUser: { fontSize: 15, fontWeight: '700', color: '#FFF' },
    reviewStars: { flexDirection: 'row', gap: 4 },
    reviewComment: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },

    eventBox: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 14, marginBottom: 16
    },
    eventText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500', flex: 1 },
    disclaimer: { fontSize: 12, color: COLORS.textTertiary, marginTop: 12, fontStyle: 'italic', textAlign: 'center' }
});
