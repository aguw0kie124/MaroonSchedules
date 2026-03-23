import React, { useEffect, useState, useMemo } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    ActivityIndicator, 
    Dimensions,
    TouchableOpacity
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import axios from 'axios';
import { useTheme, Card } from './SharedUI';
import { Library, Dumbbell, Utensils, Info, Layers } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

const TAMU_CENTER = {
    latitude: 30.6153,
    longitude: -96.341,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
};

type LocationType = 'Rec' | 'Library' | 'Dining' | 'Study' | 'General';

interface CampusLocation {
    location: string;
    percent_full: number;
    type: LocationType;
    is_live: boolean;
    available_seats: number | null;
    coord: { lat: number; lng: number };
    current_event?: string;
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

    const selectedLoc = useMemo(() => 
        locations.find(l => l.location === selectedId), 
    [locations, selectedId]);

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
                style={styles.map}
                initialRegion={TAMU_CENTER}
                showsUserLocation={true}
                customMapStyle={MAP_STYLE}
                onPress={() => setSelectedId(null)}
            >
                {filteredLocations.map((loc) => {
                    const isSelected = selectedId === loc.location;
                    const color = getStatusColor(loc.percent_full);

                    return (
                        <React.Fragment key={loc.location}>
                            {activeLayer === 'Heatmap' && (
                                <Circle
                                    center={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
                                    radius={50 + (loc.percent_full / 100) * 150}
                                    fillColor={isSelected ? 'rgba(255,255,255,0.3)' : `${color}44`}
                                    strokeColor={color}
                                    strokeWidth={isSelected ? 3 : 1}
                                />
                            )}
                            <Marker
                                coordinate={{ latitude: loc.coord.lat, longitude: loc.coord.lng }}
                                tracksViewChanges={false}
                                onPress={() => setSelectedId(loc.location)}
                            >
                                <View style={[
                                    styles.markerDot, 
                                    { backgroundColor: color, transform: [{ scale: isSelected ? 1.5 : 1 }] }
                                ]}>
                                    {isSelected && <View style={styles.markerInner} />}
                                </View>
                            </Marker>
                        </React.Fragment>
                    );
                })}
            </MapView>

            <View style={styles.layerSelector}>
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
                            color: activeLayer === cat.id ? '#FFF' : COLORS.textPrimary 
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
                <View style={styles.detailCardContainer}>
                    <Card style={styles.detailCard}>
                        <View style={styles.cardHeader}>
                            <View style={styles.typeBadge}>
                                <Text style={styles.typeText}>{selectedLoc.type.toUpperCase()}</Text>
                            </View>
                            {selectedLoc.is_live ? (
                                <View style={styles.liveBadge}>
                                    <View style={styles.livePulse} />
                                    <Text style={styles.liveText}>LIVE DATA</Text>
                                </View>
                            ) : (
                                <View style={styles.aiBadge}>
                                    <Text style={styles.aiText}>AI ESTIMATE</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.locationName}>{selectedLoc.location}</Text>
                        
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statVal}>{selectedLoc.percent_full}%</Text>
                                <Text style={styles.statLabel}>Fullness</Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: COLORS.border }]} />
                            <View style={styles.statBox}>
                                <Text style={styles.statVal}>
                                    {selectedLoc.is_live && selectedLoc.available_seats !== null 
                                        ? selectedLoc.available_seats 
                                        : '~' + Math.round((100-selectedLoc.percent_full)*1.5)}
                                </Text>
                                <Text style={styles.statLabel}>Est. Seats</Text>
                            </View>
                        </View>

                        {selectedLoc.current_event && (
                            <View style={styles.eventBox}>
                                <Info size={14} color={COLORS.primary} />
                                <Text style={styles.eventText} numberOfLines={1}>
                                    Happening: {selectedLoc.current_event}
                                </Text>
                            </View>
                        )}

                        {!selectedLoc.is_live && (
                            <Text style={styles.disclaimer}>
                                Estimated based on nearby campus traffic patterns.
                            </Text>
                        )}
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
        position: 'absolute', top: 60, left: 16, right: 16,
        padding: 4, borderRadius: 16, flexDirection: 'row',
        backgroundColor: COLORS.surface, gap: 4,
        borderWidth: 1, borderColor: COLORS.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
    },
    layerBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10, borderRadius: 12, gap: 4
    },
    layerBtnActive: { backgroundColor: COLORS.primary },
    layerText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
    layerTextActive: { color: '#FFF' },

    markerDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFF' },
    markerInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF', alignSelf: 'center', marginTop: 2 },

    detailCardContainer: {
        position: 'absolute', bottom: 30, left: 20, right: 20,
    },
    detailCard: {
        padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    typeBadge: { 
        backgroundColor: '#3D0000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 
    },
    typeText: { color: '#FF8A8A', fontSize: 10, fontWeight: '900' },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    livePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#32D74B' },
    liveText: { color: '#32D74B', fontSize: 10, fontWeight: '800' },
    aiBadge: { backgroundColor: 'rgba(255,149,0,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    aiText: { color: '#FF9500', fontSize: 10, fontWeight: '800' },

    locationName: { fontSize: 22, fontWeight: '800', color: '#FFF' },
    statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: 28, fontWeight: '900', color: '#FFF' },
    statLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
    statDivider: { width: 1, height: 40 },

    eventBox: { 
        flexDirection: 'row', alignItems: 'center', gap: 8, 
        backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 12 
    },
    eventText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500', flex: 1 },
    disclaimer: { fontSize: 11, color: COLORS.textTertiary, fontStyle: 'italic', textAlign: 'center' }
});
