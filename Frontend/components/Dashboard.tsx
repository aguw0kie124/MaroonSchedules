import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Modal, TouchableWithoutFeedback, Image } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Plus, ChevronDown, CheckCircle2, Clock, ArrowRight, MapPin, TrendingUp, GraduationCap, Radio, Map as MapIcon, Sparkles, ChevronRight } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';
import { fetchSchedules, fetchUserProfile } from '../api/client';
import { useTheme, Card } from './SharedUI';

const { width } = Dimensions.get('window');

const WEEK_DAYS = [
    { label: 'Mon', value: 'M' },
    { label: 'Tue', value: 'T' },
    { label: 'Wed', value: 'W' },
    { label: 'Thu', value: 'R' },
    { label: 'Fri', value: 'F' },
];

export function Dashboard() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const { user } = useUser();

    const [schedules, setSchedules] = useState<any[]>([]);
    const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [maxCreditGoal, setMaxCreditGoal] = useState(15);

    const getDayString = () => {
        const days = ['U', 'M', 'T', 'W', 'R', 'F', 'S'];
        return days[new Date().getDay()];
    };

    const currentDayStr = getDayString();
    const defaultDay = ['U', 'S'].includes(currentDayStr) ? 'M' : currentDayStr;
    const [selectedDay, setSelectedDay] = useState(defaultDay);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (isFocused && user) {
            loadSchedules();
            // Load max_credits preference from user profile
            fetchUserProfile(user.id)
                .then(data => {
                    const mc = parseInt(data?.max_credits || '15', 10);
                    setMaxCreditGoal(isNaN(mc) ? 15 : mc);
                })
                .catch(() => { }); // silently keep default
        }
    }, [isFocused, user]);

    const loadSchedules = async () => {
        if (!user) return;
        try {
            const res = await fetchSchedules(user.id);
            setSchedules(res);
            if (res.length > 0) {
                setSelectedSchedule((prev: any) => prev ? (res.find((s: any) => s.schedule_id === prev.schedule_id) || res[0]) : res[0]);
            }
        } catch (e) { console.error(e); }
    };

    const displayCourses = selectedSchedule?.sections ? selectedSchedule.sections.map((sec: any, index: number) => {
        const meeting = sec.meetings?.[0];
        const timeStr = meeting?.beginTime ? `${meeting.beginTime}-${meeting.endTime}` : 'TBA';
        return {
            id: sec.id || sec.section_id,
            code: `${sec.dept || ''} ${sec.courseNumber || ''}`.trim() || `Section ${sec.section_id}`,
            name: sec.courseTitle || 'Class',
            time: timeStr,
            beginTime: meeting?.beginTime,
            endTime: meeting?.endTime,
            days: meeting?.daysOfWeek || [],
            credits: Number(sec.credit_hours || sec.creditHours || 3),
            location: meeting?.building ? `${meeting.building} ${meeting.room || ''}`.trim() : 'TBA',
            color: `hsl(${(index * 55) % 360}, 65%, 45%)`
        };
    }) : [];

    const totalCredits = displayCourses.reduce((sum: number, course: any) => sum + (course.credits || 0), 0);

    // Helper to convert a "H:MM AM/PM" string to total minutes for sorting
    const timeToMins = (t: string): number => {
        if (!t) return Infinity;
        const [time, period] = t.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + (m || 0);
    };

    const actualTodaysCourses = displayCourses
        .filter((course: any) => course.days && course.days.includes(currentDayStr))
        .sort((a: any, b: any) => timeToMins(a.beginTime) - timeToMins(b.beginTime));

    const visibleCourses = displayCourses
        .filter((course: any) => course.days && course.days.includes(selectedDay))
        .sort((a: any, b: any) => timeToMins(a.beginTime) - timeToMins(b.beginTime));

    // Find next class
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const nextClass = actualTodaysCourses
        .filter((c: any) => {
            if (!c.beginTime) return false;
            const [time, period] = c.beginTime.split(' ');
            let [h, m] = time.split(':').map(Number);
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return (h * 60 + m) > currentMinutes;
        })[0]; // todaysCourses is already sorted, so first match = next class

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Howdy, Ag!</Text>
                        <Text style={styles.name}>{user?.firstName || 'Aggie'}</Text>
                    </View>
                    <Pressable style={styles.avatar} onPress={() => navigation.navigate('Profile')}>
                        {user?.imageUrl ? (
                            <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>{user?.firstName?.[0] || 'A'}</Text>
                        )}
                    </Pressable>
                </View>

                {/* Next Class Widget */}
                {nextClass ? (
                    <Card style={styles.nextClassCard}>
                        <View style={styles.nextClassRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.nextClassLabel}>UP NEXT</Text>
                                <Text style={styles.nextClassTitle}>{nextClass.code}</Text>
                                <View style={styles.nextClassDetailRow}>
                                    <Clock size={14} color={COLORS.textTertiary} />
                                    <Text style={styles.nextClassDetail}>{nextClass.time}</Text>
                                    <MapPin size={14} color={COLORS.textTertiary} style={{ marginLeft: 8 }} />
                                    <Text style={styles.nextClassDetail} numberOfLines={1}>{nextClass.location}</Text>
                                </View>
                            </View>
                            <Pressable
                                style={styles.nextClassAction}
                                onPress={() => navigation.navigate('CourseDetail', { id: nextClass.id })}
                            >
                                <ArrowRight color="#FFF" size={20} />
                            </Pressable>
                        </View>
                    </Card>
                ) : (
                    <Card style={styles.noClassCard}>
                        <Text style={styles.noClassText}>Done for today! BTHO Homework. 👍</Text>
                    </Card>
                )}

                {/* Campus Highlights Promo */}
                <Pressable style={styles.promoCard} onPress={() => navigation.navigate('Places')}>
                    <View style={styles.promoIconBg}>
                        <MapPin color={COLORS.textPrimary} size={22} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={styles.promoTitle}>Campus Places</Text>
                        <Text style={styles.promoSub}>Check live occupancy before you go.</Text>
                    </View>
                    <ChevronRight color={COLORS.border} size={20} />
                </Pressable>

                {/* Current Schedule Selector */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>PLANNER</Text>
                        <Pressable onPress={() => setDropdownVisible(true)} style={styles.scheduleSwitcher}>
                            <Text style={styles.scheduleSwitcherText}>{selectedSchedule?.name || 'Select Schedule'}</Text>
                            <ChevronDown size={14} color={COLORS.primary} />
                        </Pressable>
                    </View>

                    <Card style={styles.progressCard}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressTitle}>{totalCredits} / {maxCreditGoal} Credits</Text>
                            <Text style={styles.progressSubtitle}>{Math.round((totalCredits / maxCreditGoal) * 100)}% of goal</Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min((totalCredits / maxCreditGoal) * 100, 100)}%` }]} />
                        </View>
                    </Card>
                </View>

                {/* Daily Schedule */}
                <View style={styles.section}>
                    <View style={styles.weekStrip}>
                        {WEEK_DAYS.map(day => (
                            <Pressable 
                                key={day.value}
                                style={[styles.dayButton, selectedDay === day.value && styles.dayButtonActive]}
                                onPress={() => setSelectedDay(day.value)}
                            >
                                <Text style={[styles.dayText, selectedDay === day.value && styles.dayTextActive]}>{day.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <View style={styles.courseList}>
                        {visibleCourses.length > 0 ? (
                            visibleCourses.map((course: any) => (
                                <Pressable
                                    key={course.id}
                                    onPress={() => navigation.navigate('CourseDetail', { id: course.id })}
                                    style={styles.courseItem}
                                >
                                    <View style={styles.courseContent}>
                                        <Text style={styles.courseCode}>{course.code}</Text>
                                        <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                                        <View style={styles.courseMeta}>
                                            <Clock size={12} color={COLORS.textTertiary} />
                                            <Text style={styles.courseMetaText}>{course.time}</Text>
                                        </View>
                                    </View>
                                    <ChevronRight color={COLORS.border} size={18} />
                                </Pressable>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No classes scheduled.</Text>
                        )}
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Fab */}
            <Pressable style={styles.fab} onPress={() => navigation.navigate('NewCourseSearch')}>
                <Plus size={28} color="#FFF" />
            </Pressable>

            {/* Modal for Selecting Schedule */}
            <Modal visible={dropdownVisible} transparent animationType="slide">
                <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Switch Schedule</Text>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {schedules.map(s => (
                                        <Pressable
                                            key={s.schedule_id}
                                            style={styles.scheduleOption}
                                            onPress={() => {
                                                setSelectedSchedule(s);
                                                setDropdownVisible(false);
                                            }}
                                        >
                                            <Text style={[styles.scheduleText, selectedSchedule?.schedule_id === s.schedule_id && { color: COLORS.primary, fontWeight: '700' }]}>
                                                {s.name}
                                            </Text>
                                            {selectedSchedule?.schedule_id === s.schedule_id && <CheckCircle2 color={COLORS.primary} size={20} />}
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 40, // Reduced from 60
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    name: {
        fontSize: 34, // Larger, more impressive header
        fontWeight: '800',
        letterSpacing: -1,
        color: COLORS.textPrimary,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    nextClassCard: {
        marginBottom: 16,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
        borderBottomWidth: 0, // removed bottom divider for next class
    },
    nextClassRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceElevated,
        padding: 20,
        borderRadius: 20, // keep soft rounded corners just for this hero card
    },
    nextClassLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSecondary,
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    nextClassTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    nextClassDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    nextClassDetail: {
        fontSize: 12,
        color: COLORS.textTertiary,
        marginLeft: 4,
    },
    nextClassAction: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        marginRight: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noClassCard: {
        marginBottom: 24,
        padding: 24,
        alignItems: 'center',
        backgroundColor: COLORS.surface,
    },
    noClassText: {
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    section: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    promoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 24,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    promoIconBg: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    promoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    promoSub: {
        fontSize: 12,
        color: COLORS.textTertiary,
        marginTop: 4,
    },
    scheduleSwitcher: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.surfaceElevated,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    scheduleSwitcherText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    progressCard: {
        backgroundColor: COLORS.surface,
        padding: 16,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 8,
    },
    progressTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    progressSubtitle: {
        fontSize: 12,
        color: COLORS.textTertiary,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
    },
    weekStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    dayButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
    },
    dayButtonActive: {
        backgroundColor: COLORS.primary,
    },
    dayText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    dayTextActive: {
        color: '#FFF',
    },
    courseList: {
        gap: 12,
    },
    courseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    courseContent: {
        flex: 1,
    },
    courseCode: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    courseName: {
        fontSize: 12,
        color: COLORS.textTertiary,
        marginTop: 2,
    },
    courseMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    courseMetaText: {
        fontSize: 11,
        color: COLORS.textTertiary,
    },
    emptyText: {
        color: COLORS.textTertiary,
        textAlign: 'center',
        padding: 20,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '70%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 20,
        textAlign: 'center',
    },
    scheduleOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    scheduleText: {
        fontSize: 17,
        color: 'rgba(255,255,255,0.6)',
    },
});
