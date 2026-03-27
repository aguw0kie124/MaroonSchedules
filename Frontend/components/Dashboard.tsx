import React, { useEffect, useMemo } from 'react';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import {
    ArrowRight,
    Bell,
    BriefcaseBusiness,
    Bus,
    ChevronRight,
    Clock,
    Dumbbell,
    ExternalLink,
    MapPin,
} from 'lucide-react-native';
import { Card, useTheme } from './SharedUI';
import { useCampusHubStore } from '../store/campusHubStore';

const WEEK_DAYS = [
    { label: 'Mon', value: 'M' },
    { label: 'Tue', value: 'T' },
    { label: 'Wed', value: 'W' },
    { label: 'Thu', value: 'R' },
    { label: 'Fri', value: 'F' },
];

function getDefaultDay() {
    const day = ['U', 'M', 'T', 'W', 'R', 'F', 'S'][new Date().getDay()];
    return ['U', 'S'].includes(day) ? 'M' : day;
}

function getUrgencyColor(level: 'high' | 'medium' | 'low', colors: any) {
    if (level === 'high') return colors.danger;
    if (level === 'medium') return colors.warning;
    return colors.success;
}

export function Dashboard() {
    const { COLORS, theme, useWallpaper } = useTheme();
    const isDark = theme === 'dark';
    const styles = getStyles(COLORS, isDark);
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const { user } = useUser();
    const { snapshot, loading, error, hydrate } = useCampusHubStore();
    const [selectedDay, setSelectedDay] = React.useState(getDefaultDay());

    useEffect(() => {
        if (isFocused && user?.id) {
            hydrate(user.id).catch(() => {});
        }
    }, [hydrate, isFocused, user?.id]);

    const academic = snapshot?.academic;
    const notifications = (snapshot?.notifications || []).filter(notification => notification.id !== 'registration-state');
    const priorityNotifications = notifications.slice(0, 3);
    const recreationPreview = (snapshot?.recreation.facilities || []).slice(0, 2);
    const visibleCourses = useMemo(() => {
        return (academic?.courses || []).filter(course => course.days.includes(selectedDay));
    }, [academic?.courses, selectedDay]);
    const annexModule = snapshot?.services.find(service => service.id === 'annex');
    const openRecreationFacilities = () => {
        const rootNavigation = navigation.getParent?.('RootStack') || navigation.getParent?.();
        if (rootNavigation?.navigate) {
            rootNavigation.navigate('RecreationFacilities');
            return;
        }
        navigation.navigate('RecreationFacilities');
    };

    const marbleSrc = isDark
        ? require('../assets/black_marble.jpg')
        : require('../assets/white_marble.jpg');

    const openExternal = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch (linkError) {
            console.warn('Unable to open URL', url, linkError);
        }
    };

    return (
        <View style={[styles.container, useWallpaper && { backgroundColor: '#000' }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

            {useWallpaper && (
                <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
                    <View style={[StyleSheet.absoluteFill, {
                        backgroundColor: isDark ? 'rgba(0,0,0,0.68)' : 'rgba(255,255,255,0.52)',
                    }]} />
                </ImageBackground>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.greeting}>Campus OS</Text>
                        <Text style={styles.name}>{user?.firstName || 'Aggie'}</Text>
                        <Text style={styles.subhead}>
                            Academic, dining, transit, social, and campus operations in one flow.
                        </Text>
                    </View>
                    <Pressable style={styles.avatar} onPress={() => navigation.navigate('Profile')}>
                        {user?.imageUrl ? (
                            <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>{user?.firstName?.[0] || 'A'}</Text>
                        )}
                    </Pressable>
                </View>

                {loading && !snapshot ? (
                    <Card style={styles.loadingCard}>
                        <ActivityIndicator color={COLORS.primary} />
                        <Text style={styles.loadingText}>Hydrating your campus dashboard...</Text>
                    </Card>
                ) : (
                    <>
                        <Card style={styles.heroCard}>
                            <View style={styles.heroTopRow}>
                                <Text style={styles.heroEyebrow}>Today</Text>
                            </View>

                            {academic?.nextCourse ? (
                                <>
                                    <Text style={styles.heroTitle}>Up next: {academic.nextCourse.code}</Text>
                                    <Text style={styles.heroDetail}>{academic.nextCourse.name}</Text>
                                    <View style={styles.heroMetaRow}>
                                        <Clock size={14} color={COLORS.textTertiary} />
                                        <Text style={styles.heroMetaText}>{academic.nextCourse.time}</Text>
                                        <MapPin size={14} color={COLORS.textTertiary} />
                                        <Text style={styles.heroMetaText} numberOfLines={1}>{academic.nextCourse.location}</Text>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.heroTitle}>Your day is clear</Text>
                                    <Text style={styles.heroDetail}>
                                        No upcoming class is visible yet.
                                    </Text>
                                </>
                            )}

                            <View style={styles.heroActions}>
                                <Pressable style={styles.primaryAction} onPress={() => navigation.navigate('ScheduleList')}>
                                    <Text style={styles.primaryActionText}>Open Schedule</Text>
                                    <ArrowRight size={16} color="#FFFFFF" />
                                </Pressable>
                                <Pressable
                                    style={styles.secondaryAction}
                                    onPress={() => navigation.navigate('Places', {
                                        initialLayer: 'Bus',
                                        focusToken: Date.now(),
                                    })}
                                >
                                    <Bus size={16} color={COLORS.textPrimary} />
                                    <Text style={styles.secondaryActionText}>Transit Map</Text>
                                </Pressable>
                            </View>
                        </Card>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionLabel}>Today&apos;s Schedule</Text>
                                <Pressable onPress={() => navigation.navigate('ScheduleList')}>
                                    <Text style={styles.linkText}>Full schedule</Text>
                                </Pressable>
                            </View>
                            <Card style={styles.panelCard}>
                                <Text style={styles.summaryTitle}>{academic?.scheduleName || 'Primary schedule unavailable'}</Text>
                                <Text style={styles.summaryBody}>{academic?.sourceLabel || 'Academic data can be hydrated here.'}</Text>

                                <View style={styles.weekStrip}>
                                    {WEEK_DAYS.map(day => (
                                        <Pressable
                                            key={day.value}
                                            style={[styles.dayButton, selectedDay === day.value && styles.dayButtonActive]}
                                            onPress={() => setSelectedDay(day.value)}
                                        >
                                            <Text style={[styles.dayText, selectedDay === day.value && styles.dayTextActive]}>
                                                {day.label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>

                                <View style={styles.courseList}>
                                    {visibleCourses.length > 0 ? (
                                        visibleCourses.map(course => (
                                            <View key={course.id} style={styles.courseItem}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.courseCode}>{course.code}</Text>
                                                    <Text style={styles.courseName}>{course.name}</Text>
                                                    <Text style={styles.courseMetaText}>
                                                        {course.time} · {course.location} · {course.instructor}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.emptyText}>No classes scheduled for this day.</Text>
                                    )}
                                </View>
                            </Card>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionLabel}>Priority Alerts</Text>
                                <Pressable onPress={() => navigation.navigate('Social')}>
                                    <Text style={styles.linkText}>Open social hub</Text>
                                </Pressable>
                            </View>
                            <Card style={styles.panelCard}>
                                {priorityNotifications.map(notification => (
                                    <View key={notification.id} style={styles.notificationRow}>
                                        <View
                                            style={[
                                                styles.notificationDot,
                                                { backgroundColor: getUrgencyColor(notification.urgency, COLORS) },
                                            ]}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.notificationTitle}>{notification.title}</Text>
                                            <Text style={styles.notificationDetail}>{notification.detail}</Text>
                                        </View>
                                    </View>
                                ))}
                                {priorityNotifications.length === 0 && (
                                    <Text style={styles.emptyText}>No normalized notifications are available yet.</Text>
                                )}
                            </Card>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionLabel}>Campus Essentials</Text>
                            </View>
                            <Card style={styles.panelCard}>
                                <Pressable
                                    style={styles.essentialRow}
                                    onPress={() => openExternal(snapshot?.career.resources[0]?.url || 'https://tamu-csm.symplicity.com/students/index.php?signin_tab=0')}
                                >
                                    <View style={styles.essentialIconWrap}>
                                        <BriefcaseBusiness size={18} color={COLORS.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.essentialTitle}>Hire Aggies</Text>
                                        <Text style={styles.essentialMeta}>
                                            {snapshot?.career.summary || 'Jobs, employers, and career events.'}
                                        </Text>
                                    </View>
                                    <ExternalLink size={16} color={COLORS.primary} />
                                </Pressable>

                                <Pressable
                                    style={styles.essentialRow}
                                    onPress={openRecreationFacilities}
                                >
                                    <View style={styles.essentialIconWrap}>
                                        <Dumbbell size={18} color={COLORS.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.essentialTitle}>Recreation</Text>
                                        {recreationPreview.length > 0 ? (
                                            recreationPreview.map(facility => (
                                                <Text key={facility.id} style={styles.essentialMeta}>
                                                    {facility.name}: {facility.today_hours || facility.hours_hint}
                                                </Text>
                                            ))
                                        ) : (
                                            <Text style={styles.essentialMeta}>
                                                {snapshot?.recreation.summary || 'Recreation data unavailable.'}
                                            </Text>
                                        )}
                                    </View>
                                    <ChevronRight size={16} color={COLORS.primary} />
                                </Pressable>

                                <Pressable
                                    style={[styles.essentialRow, styles.essentialRowLast]}
                                    onPress={() => openExternal(annexModule?.url || 'https://www.library.tamu.edu/')}
                                >
                                    <View style={styles.essentialIconWrap}>
                                        <MapPin size={18} color={COLORS.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.essentialTitle}>The Annex</Text>
                                        <Text style={styles.essentialMeta}>
                                            {annexModule?.summary || 'Library and study support for quieter work sessions.'}
                                        </Text>
                                    </View>
                                    <ExternalLink size={16} color={COLORS.primary} />
                                </Pressable>
                            </Card>
                        </View>

                        {error ? (
                            <Card style={styles.errorCard}>
                                <Text style={styles.errorTitle}>Resilience Mode Active</Text>
                                <Text style={styles.errorBody}>
                                    Some live data could not be refreshed, so the dashboard is using the last safe state and local modules.
                                </Text>
                                <Text style={styles.errorDetail}>{error}</Text>
                            </Card>
                        ) : null}
                    </>
                )}

                <View style={{ height: 110 }} />
            </ScrollView>
        </View>
    );
}

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 62,
        paddingBottom: 110,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        gap: 14,
    },
    greeting: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.2,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
    },
    name: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1,
        color: COLORS.textPrimary,
        marginTop: 2,
    },
    subhead: {
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
        maxWidth: 280,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    loadingCard: {
        padding: 24,
        alignItems: 'center',
        borderRadius: 28,
        backgroundColor: COLORS.surfaceElevated,
        borderBottomWidth: 0,
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    heroCard: {
        borderRadius: 28,
        padding: 22,
        marginBottom: 16,
        backgroundColor: COLORS.surfaceElevated,
        borderBottomWidth: 0,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    heroEyebrow: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.1,
        textTransform: 'uppercase',
    },
    secondaryChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    secondaryChipText: {
        color: COLORS.textPrimary,
        fontSize: 12,
        fontWeight: '700',
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.7,
    },
    heroDetail: {
        fontSize: 15,
        color: COLORS.textSecondary,
        marginTop: 8,
        lineHeight: 22,
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
    },
    heroMetaText: {
        color: COLORS.textTertiary,
        fontSize: 13,
    },
    heroActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    primaryAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 999,
    },
    primaryActionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    secondaryAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: isDark ? '#151515' : '#F1F1F4',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 999,
    },
    secondaryActionText: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '700',
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 22,
    },
    metricCard: {
        flex: 1,
        padding: 16,
        borderRadius: 24,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 0,
        gap: 8,
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    metricLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 16,
    },
    section: {
        marginBottom: 22,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textSecondary,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
    },
    linkText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 13,
    },
    panelCard: {
        borderRadius: 28,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 0,
        padding: 18,
    },
    notificationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    notificationDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 5,
    },
    notificationTitle: {
        color: COLORS.textPrimary,
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    notificationDetail: {
        color: COLORS.textSecondary,
        fontSize: 13,
        lineHeight: 19,
    },
    essentialRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    essentialRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    essentialIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceElevated,
    },
    essentialTitle: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 4,
    },
    essentialMeta: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    moduleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    moduleCard: {
        width: '48%',
        minHeight: 152,
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
    },
    moduleTitle: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '800',
    },
    moduleBody: {
        color: COLORS.textPrimary,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    moduleCaption: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 17,
    },
    summaryTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    inlineModuleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    inlineMetaText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 10,
    },
    summaryBody: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 8,
        lineHeight: 20,
    },
    weekStrip: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 18,
        marginBottom: 16,
    },
    dayButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: COLORS.surfaceElevated,
        alignItems: 'center',
    },
    dayButtonActive: {
        backgroundColor: COLORS.primary,
    },
    dayText: {
        color: COLORS.textSecondary,
        fontWeight: '700',
        fontSize: 13,
    },
    dayTextActive: {
        color: '#FFFFFF',
    },
    courseList: {
        gap: 10,
    },
    courseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    courseCode: {
        color: COLORS.textPrimary,
        fontSize: 15,
        fontWeight: '800',
    },
    courseName: {
        color: COLORS.textPrimary,
        fontSize: 14,
        marginTop: 4,
        marginBottom: 4,
    },
    courseMetaText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    suggestionList: {
        gap: 10,
        marginTop: 14,
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    suggestionBadge: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
    },
    suggestionBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    suggestionName: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '700',
    },
    suggestionMeta: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
    serviceCard: {
        width: '48%',
        minHeight: 220,
        borderRadius: 24,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 0,
        padding: 16,
    },
    serviceRow: {
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    serviceName: {
        color: COLORS.textPrimary,
        fontSize: 13,
        fontWeight: '700',
    },
    serviceMeta: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 4,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    errorCard: {
        borderRadius: 24,
        backgroundColor: 'rgba(128,0,0,0.12)',
        borderBottomWidth: 0,
        padding: 18,
    },
    errorTitle: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '800',
    },
    errorBody: {
        color: COLORS.textSecondary,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 6,
    },
    errorDetail: {
        color: COLORS.accent,
        fontSize: 12,
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalTitle: {
        color: COLORS.textPrimary,
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 12,
    },
    resourceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    resourceLabel: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '700',
    },
    resourceUrl: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
});
