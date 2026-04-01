import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useTheme, Card } from './SharedUI';
import { fetchCampusPlacesMap } from '../api/client';

export function LocationSearchScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const [searchQuery, setSearchQuery] = useState('');
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedLocation, setExpandedLocation] = useState<string | null>(null);

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const snapshot = await fetchCampusPlacesMap();
            setLocations(Array.isArray(snapshot?.locations) ? snapshot.locations : []);
        } catch (err) {
            console.warn("Failed to fetch places map snapshot", err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = locations.filter(loc => (loc.location || '').toLowerCase().includes(searchQuery.toLowerCase()));

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
                    placeholder="Search for a campus location..."
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
