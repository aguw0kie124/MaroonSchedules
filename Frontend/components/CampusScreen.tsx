import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Map, MessageSquare, Sparkles, Calendar, Heart, Rss, Navigation, TrendingUp, GraduationCap, ChevronRight, Compass, Dumbbell } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { fetchUTDRecCenterStatus, type UTDRecCenterStatus } from '../services/utdRecService';
import type { Campus } from '../stores/campusStore';

const { width } = Dimensions.get('window');

function formatRecUpdatedAt(value?: string | null) {
    if (!value) return 'Just now';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function CampusScreen() {
    const { COLORS, campusTheme } = useTheme();
    const styles = getStyles(COLORS);
    const iconColor = COLORS.primary;
    const campusShortLabel = campusTheme.campus === 'UTD' ? 'UTD' : 'TAMU';
    const navigation = useNavigation<any>();
    const [selectedCampus, setSelectedCampus] = React.useState<Campus | null>(null);
    const [recCenterStatus, setRecCenterStatus] = React.useState<UTDRecCenterStatus | null>(null);
    const [recLoading, setRecLoading] = React.useState(false);

    React.useEffect(() => {
        AsyncStorage.getItem('selected_campus')
            .then((value) => {
                if (value === 'UTD' || value === 'TAMU') {
                    setSelectedCampus(value);
                } else {
                    setSelectedCampus(null);
                }
            })
            .catch(() => {
                setSelectedCampus(null);
            });
    }, []);

    React.useEffect(() => {
        let cancelled = false;

        if (selectedCampus !== 'UTD') {
            setRecCenterStatus(null);
            setRecLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setRecLoading(true);
        fetchUTDRecCenterStatus()
            .then((status) => {
                if (!cancelled) {
                    setRecCenterStatus(status);
                }
            })
            .catch((error) => {
                console.warn('Failed to fetch UTD Rec Center status', error);
            })
            .finally(() => {
                if (!cancelled) {
                    setRecLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedCampus]);

    const menuItems = [
        {
            title: 'EXPLORE',
            items: [
                { id: 'CampusNavigation', label: 'Campus Navigation', subtitle: 'Walking directions & voice nav', icon: <Navigation color={iconColor} size={22} /> },
                { id: 'Places', label: 'Places Map', subtitle: 'Live occupancy & category maps', icon: <Map color={iconColor} size={22} />, badge: 'NEW' },
                { id: 'ForYou', label: 'For You', subtitle: 'Personalized campus feed', icon: <Heart color={iconColor} size={22} /> },
            ]
        },
        {
            title: 'CAMPUS LIFE',
            items: [
                { id: 'EventsCalendar', label: 'Events Calendar', subtitle: `Live ${campusShortLabel} events & activities`, icon: <Calendar color={iconColor} size={22} /> },
                { id: 'Social', label: 'Campus Pings', subtitle: 'Popups, free food, activity, and campus buzz', icon: <Rss color={iconColor} size={22} />, badge: 'LIVE' },
            ]
        },
        {
            title: 'TRAFFIC DATA',
            items: [
                { id: 'CampusMap', label: 'Traffic Map', subtitle: 'Campus-wide occupancy heatmap', icon: <Map color={iconColor} size={22} /> },
                { id: 'LocationSearch', label: 'Location Search', subtitle: 'Search specific building stats', icon: <TrendingUp color={iconColor} size={22} /> },
            ]
        },
        {
            title: 'ACADEMICS',
            items: [
                { id: 'GPACalculator', label: 'GPA Calculator', subtitle: 'Calculate your semester GPA', icon: <GraduationCap color={iconColor} size={22} /> },
            ]
        }
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.logoBadge}>
                        <Compass color="#FFF" size={24} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Campus Hub</Text>
                        <Text style={styles.headerSubtitle}>Explore {campusTheme.branding.campusName}</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {selectedCampus === 'UTD' ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>UTD RECREATION</Text>
                        <View style={styles.recCard}>
                            <View style={styles.recHeaderRow}>
                                <View style={styles.recIconBox}>
                                    <Dumbbell color={iconColor} size={20} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.recTitle}>Rec Center</Text>
                                    <Text style={styles.recSubtitle}>UT Dallas Recreation Services</Text>
                                </View>
                            </View>

                            <View style={styles.recMetricsRow}>
                                <View style={styles.recMetricItem}>
                                    <Text style={styles.recMetricLabel}>Current occupancy</Text>
                                    <Text style={styles.recMetricValue}>
                                        {recLoading ? 'Loading...' : recCenterStatus?.occupancy || 'Unknown'}
                                    </Text>
                                </View>
                                <View style={styles.recMetricItem}>
                                    <Text style={styles.recMetricLabel}>Status</Text>
                                    <Text
                                        style={[
                                            styles.recMetricValue,
                                            recCenterStatus?.status === 'Closed'
                                                ? styles.recMetricValueClosed
                                                : styles.recMetricValueOpen,
                                        ]}
                                    >
                                        {recLoading ? 'Loading...' : recCenterStatus?.status || 'Open'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.recUpdatedText}>
                                Last updated: {formatRecUpdatedAt(recCenterStatus?.lastUpdated)}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {menuItems.map((section, idx) => (
                    <View key={idx} style={styles.section}>
                        <Text style={styles.sectionLabel}>{section.title}</Text>
                        <View style={styles.menuGroup}>
                            {section.items.map((item, itemIdx) => (
                                <View key={item.id}>
                                    <Pressable 
                                        style={({pressed}) => [styles.menuButton, pressed && styles.menuButtonPressed]} 
                                        onPress={() => navigation.navigate(item.id)}
                                    >
                                        <View style={styles.menuIconBox}>{item.icon}</View>
                                        <View style={styles.menuTextCol}>
                                            <View style={styles.menuLabelRow}>
                                                <Text style={styles.menuLabel}>{item.label}</Text>
                                                {item.badge && (
                                                    <View style={styles.badge}>
                                                        <Text style={styles.badgeText}>{item.badge}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                        </View>
                                        <ChevronRight color="rgba(255,255,255,0.2)" size={18} />
                                    </Pressable>
                                    {itemIdx < section.items.length - 1 && <View style={styles.menuDivider} />}
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingTop: 40, // Reduced from 60
        paddingBottom: 24,
        paddingHorizontal: 24,
        backgroundColor: COLORS.primary,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    logoBadge: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    scrollArea: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginTop: 24,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    menuGroup: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    menuDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginLeft: 68,
    },
    menuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
    },
    menuButtonPressed: {
        backgroundColor: COLORS.surfaceElevated,
    },
    menuIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: `${COLORS.primary}18`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    menuTextCol: {
        flex: 1,
    },
    menuLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    menuLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    menuSubtitle: {
        fontSize: 13,
        color: COLORS.textTertiary,
        marginTop: 4,
        lineHeight: 18,
    },
    badge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#FFF',
    },
    recCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
        gap: 14,
    },
    recHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    recIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: `${COLORS.primary}18`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    recSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 3,
    },
    recMetricsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    recMetricItem: {
        flex: 1,
        backgroundColor: COLORS.surfaceElevated,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    recMetricLabel: {
        fontSize: 11,
        color: COLORS.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: '700',
    },
    recMetricValue: {
        marginTop: 8,
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    recMetricValueOpen: {
        color: '#66D18F',
    },
    recMetricValueClosed: {
        color: '#FF8A8A',
    },
    recUpdatedText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
});
