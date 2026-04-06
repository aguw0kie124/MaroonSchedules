import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useTheme, Card } from './SharedUI';
import { fetchCampusPlacesMap } from '../api/client';
import { buildExpandedPlacesDirectory, mergeCampusLocations } from './places/campusData';
import { searchCampusLocations } from './places/searchUtils';

export function LocationSearchScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const fullCampusIndex = React.useMemo(() => buildExpandedPlacesDirectory(), []);
    const [searchQuery, setSearchQuery] = useState('');
    const [locations, setLocations] = useState<any[]>(fullCampusIndex);
    const [loading, setLoading] = useState(true);
    const [expandedLocation, setExpandedLocation] = useState<string | null>(null);

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const snapshot = await fetchCampusPlacesMap();
            const nextLocations = Array.isArray(snapshot?.locations) ? snapshot.locations : [];
            setLocations(nextLocations.length ? mergeCampusLocations(fullCampusIndex, nextLocations) : fullCampusIndex);
        } catch (err) {
            console.warn("Failed to fetch places map snapshot", err);
            setLocations(fullCampusIndex);
        } finally {
            setLoading(false);
        }
    };

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filtered = normalizedQuery
        ? searchCampusLocations(locations, normalizedQuery, 80)
        : locations.filter((loc) => !loc.searchOnly);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ marginTop: 12, color: COLORS.textSecondary }}>Loading campus locations...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search Texas A&M area locations..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                />
            </View>
            <ScrollView contentContainerStyle={styles.listContainer}>
                {filtered.map((loc, idx) => {
                    const isExpanded = expandedLocation === loc.location;
                    return (
                        <Pressable key={idx} onPress={() => setExpandedLocation(isExpanded ? null : loc.location)}>
                            <Card style={styles.locationCard}>
                                <Text style={styles.locationTitle}>{loc.location}</Text>
                                {isExpanded && (
                                    <View style={styles.detailsContainer}>
                                        <Text style={styles.detailText}>
                                            <Text style={{fontWeight: 'bold'}}>Type: </Text>
                                            {loc.type}
                                        </Text>
                                        {loc.description ? (
                                            <Text style={styles.subDetailText}>{loc.description}</Text>
                                        ) : null}
                                        {loc.is_live ? (
                                            <>
                                                <Text style={styles.detailText}>
                                                    <Text style={{fontWeight: 'bold'}}>Current Capacity: </Text>
                                                    {loc.percent_full}%
                                                </Text>
                                                <View style={styles.capacityBarContainer}>
                                                    <View style={[
                                                        styles.capacityBar, 
                                                        { 
                                                            width: `${Math.min(loc.percent_full, 100)}%`, 
                                                            backgroundColor: loc.percent_full < 40 ? '#2E7D32' : loc.percent_full < 70 ? '#ED6C02' : '#C62828' 
                                                        }
                                                    ]} />
                                                </View>
                                            </>
                                        ) : (
                                            <Text style={styles.subDetailText}>
                                                {loc.coord ? `Coordinates: ${loc.coord.lat.toFixed(6)}, ${loc.coord.lng.toFixed(6)}` : 'Static location'}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </Card>
                        </Pressable>
                    );
                })}
                {filtered.length === 0 && (
                    <Text style={{ textAlign: 'center', color: COLORS.textSecondary, marginTop: 20 }}>
                        No locations found matching "{searchQuery}".
                    </Text>
                )}
                <View style={{height: 40}}/>
            </ScrollView>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    searchContainer: {
        padding: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    searchInput: {
        height: 48,
        backgroundColor: COLORS.background,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    listContainer: {
        padding: 16,
        gap: 12,
    },
    locationCard: {
        padding: 16,
    },
    locationTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    detailsContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    detailText: {
        fontSize: 16,
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    capacityBarContainer: {
        height: 8,
        backgroundColor: '#E0E0E0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    capacityBar: {
        height: '100%',
        borderRadius: 4,
    },
    subDetailText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    }
});
