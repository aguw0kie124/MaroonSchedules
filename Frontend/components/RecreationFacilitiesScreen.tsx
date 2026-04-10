import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { ArrowLeft, Clock3, Dumbbell, ExternalLink, Users } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';

import { useTheme } from './SharedUI';
import { useCampusHubStore } from '../store/campusHubStore';

export function RecreationFacilitiesScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const { user } = useUser();
    const { snapshot, hydrate, loading } = useCampusHubStore();
    const facilities = snapshot?.recreation.facilities || [];

    useEffect(() => {
        if (isFocused && user?.id) {
            hydrate(user.id).catch(() => {});
        }
    }, [hydrate, isFocused, user?.id]);

    const openExternal = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch (error) {
            console.warn('Unable to open recreation URL', url, error);
        }
    };

    const formatLiveTimestamp = (value?: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleString(undefined, {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                    <ArrowLeft size={20} color={COLORS.textPrimary} />
                </Pressable>
                <View style={styles.headerCopy}>
                    <Text style={styles.title}>Recreation</Text>
                    <Text style={styles.subtitle}>
                        Facility details pulled from official Rec Sports pages and merged with live occupancy when available.
                    </Text>
                </View>
            </View>

            {loading && facilities.length === 0 ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading facility information...</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {facilities.map((facility) => (
                        <View key={facility.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.iconWrap}>
                                    <Dumbbell size={18} color={COLORS.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>{facility.name}</Text>
                                    <Text style={styles.cardSubtitle}>
                                        {facility.percent_full != null
                                            ? `${facility.percent_full}% full${facility.current_count != null && facility.capacity ? ` · ${facility.current_count}/${facility.capacity}` : ''}`
                                            : facility.hours_hint}
                                    </Text>
                                </View>
                            </View>

                            {facility.summary ? (
                                <Text style={styles.summary}>{facility.summary}</Text>
                            ) : null}

                            {facility.percent_full != null && facility.occupancy_name ? (
                                <Text style={styles.liveMeta}>Live count source: {facility.occupancy_name}</Text>
                            ) : null}

                            {facility.percent_full != null && facility.last_updated ? (
                                <Text style={styles.liveMeta}>
                                    Updated: {formatLiveTimestamp(facility.last_updated) || facility.last_updated}
                                </Text>
                            ) : null}

                            <View style={styles.infoRow}>
                                <Clock3 size={15} color={COLORS.textSecondary} />
                                <Text style={styles.infoText}>
                                    Today: {facility.today_hours || facility.hours_hint}
                                </Text>
                            </View>

                            {facility.weekly_hours?.length ? (
                                <View style={styles.weeklyHoursWrap}>
                                    {facility.weekly_hours.map((entry) => (
                                        <View key={`${facility.id}-${entry.day}`} style={styles.weeklyHoursRow}>
                                            <Text style={styles.weeklyDay}>{entry.day}</Text>
                                            <Text style={styles.weeklyHours}>{entry.hours}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            {facility.notices?.length ? (
                                <View style={styles.noticeWrap}>
                                    {facility.notices.map((notice, index) => (
                                        <View key={`${facility.id}-notice-${index}`} style={styles.noticeCard}>
                                            <Text style={styles.noticeWindow}>{notice.window || 'Facility notice'}</Text>
                                            <Text style={styles.noticeText}>{notice.detail}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            {facility.amenities?.length ? (
                                <View style={styles.amenitiesWrap}>
                                    {facility.amenities.map((amenity) => (
                                        <View key={`${facility.id}-${amenity}`} style={styles.amenityChip}>
                                            <Users size={12} color={COLORS.primary} />
                                            <Text style={styles.amenityText}>{amenity}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            <Pressable style={styles.linkRow} onPress={() => openExternal(facility.source_url)}>
                                <Text style={styles.linkText}>Open official facility page</Text>
                                <ExternalLink size={16} color={COLORS.primary} />
                            </Pressable>

                            {facility.hours_source ? (
                                <Text style={styles.hoursSource}>{facility.hours_source}</Text>
                            ) : null}
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingTop: 58,
        paddingHorizontal: 18,
        paddingBottom: 18,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    headerCopy: {
        flex: 1,
        gap: 8,
        paddingTop: 2,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: COLORS.textSecondary,
    },
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    loadingText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingBottom: 120,
        gap: 14,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceElevated || COLORS.surface,
    },
    cardTitle: {
        color: COLORS.textPrimary,
        fontSize: 17,
        fontWeight: '800',
    },
    cardSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 13,
        marginTop: 4,
    },
    summary: {
        color: COLORS.textPrimary,
        fontSize: 14,
        lineHeight: 20,
    },
    liveMeta: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    infoText: {
        flex: 1,
        color: COLORS.textSecondary,
        fontSize: 13,
        lineHeight: 19,
    },
    amenitiesWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    noticeWrap: {
        gap: 8,
    },
    noticeCard: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(128,0,0,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(128,0,0,0.16)',
    },
    noticeWindow: {
        color: COLORS.textPrimary,
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 4,
    },
    noticeText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    weeklyHoursWrap: {
        gap: 8,
        padding: 12,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceElevated || COLORS.background,
    },
    weeklyHoursRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    weeklyDay: {
        color: COLORS.textPrimary,
        fontSize: 13,
        fontWeight: '700',
    },
    weeklyHours: {
        flex: 1,
        textAlign: 'right',
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    amenityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: COLORS.surfaceElevated || COLORS.background,
    },
    amenityText: {
        color: COLORS.textPrimary,
        fontSize: 12,
        fontWeight: '600',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 6,
    },
    linkText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '700',
    },
    hoursSource: {
        color: COLORS.textTertiary || COLORS.textSecondary,
        fontSize: 11,
        lineHeight: 16,
    },
});
