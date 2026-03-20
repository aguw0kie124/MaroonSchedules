import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Modal, TouchableWithoutFeedback } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Plus, ChevronDown, CheckCircle2 } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';
import { fetchSchedules } from '../api/client';
import { COLORS, Card } from './SharedUI';

const { width } = Dimensions.get('window');

export function Dashboard() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const { user } = useUser();

    const [schedules, setSchedules] = useState<any[]>([]);
    const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
    const [dropdownVisible, setDropdownVisible] = useState(false);

    useEffect(() => {
        if (isFocused && user) {
            loadSchedules();
        }
    }, [isFocused, user]);

    const loadSchedules = async () => {
        if (!user) return;
        try {
            const res = await fetchSchedules(user.id);
            setSchedules(res);
            if (res.length > 0) {
                setSelectedSchedule((prev: any) => prev ? (res.find((s: any) => s.schedule_id === prev.schedule_id) || res[0]) : res[0]);
            } else {
                setSelectedSchedule(null);
            }
        } catch(e) { console.error(e); }
    };

    const displayCourses = selectedSchedule?.sections ? selectedSchedule.sections.map((sec: any, index: number) => {
        const meeting = sec.meetings?.[0];
        const timeStr = meeting?.beginTime ? `${meeting.beginTime}-${meeting.endTime}` : 'TBA';
        return {
            id: sec.id || sec.section_id,
            code: `${sec.dept || ''} ${sec.courseNumber || ''}`.trim() || `Section ${sec.section_id}`,
            name: sec.courseTitle || 'Class',
            time: timeStr,
            days: meeting?.daysOfWeek || [],
            credits: Number(sec.credit_hours || sec.creditHours || 3),
            color: `hsl(${(index * 50) % 360}, 65%, 45%)`
        };
    }) : [];

    const totalCredits = displayCourses.reduce((sum: number, course: any) => sum + (course.credits || 0), 0);
    const maxCredits = 15;
    const todaysCourses = displayCourses.filter((course: any) => course.days && course.days.includes('M'));

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Howdy, Ag!</Text>
                        <Text style={styles.name}>{user?.firstName || 'Aggie'}</Text>
                    </View>
                    <Pressable
                        style={styles.avatar}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <Text style={styles.avatarText}>
                            {user?.firstName?.[0] || 'A'}
                        </Text>
                    </Pressable>
                </View>

                {/* Current Term Card / Schedule Dropdown */}
                <Pressable onPress={() => setDropdownVisible(true)}>
                    <Card style={styles.termCard}>
                        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                            <Text style={styles.cardTitle}>{selectedSchedule ? `${selectedSchedule.name} (${selectedSchedule.term_code})` : 'No Schedule Selected'}</Text>
                            <ChevronDown size={20} color={COLORS.textPrimary} style={{marginLeft: 8, marginTop: -14}} />
                        </View>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressLabels}>
                            <Text style={styles.caption}>
                                {totalCredits} / {maxCredits} credits
                            </Text>
                            <Text style={[styles.caption, { color: COLORS.textPrimary, fontWeight: 'bold' }]}>
                                {maxCredits - totalCredits} remaining
                            </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${Math.min((totalCredits / maxCredits) * 100, 100)}%` },
                                ]}
                            />
                        </View>
                    </View>
                </Card>
                </Pressable>

                {/* Today's Classes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today</Text>
                    <View style={styles.courseList}>
                        {todaysCourses.length > 0 ? (
                            todaysCourses.map((course) => (
                                <Pressable
                                    key={course.id}
                                    onPress={() => navigation.navigate('CourseDetail', { id: course.id })}
                                    style={({ pressed }) => [
                                        styles.courseItem,
                                        pressed && styles.courseItemPressed,
                                    ]}
                                >
                                    <View style={[styles.colorStrip, { backgroundColor: course.color }]} />
                                    <View style={styles.courseInfo}>
                                        <Text style={styles.courseCode}>{course.code}</Text>
                                        <Text style={styles.courseName}>{course.name}</Text>
                                    </View>
                                    <View style={styles.timeBadge}>
                                        <Text style={styles.timeText}>{course.time}</Text>
                                    </View>
                                </Pressable>
                            ))
                        ) : (
                            <Card>
                                <Text style={styles.emptyText}>No classes today! Time to BTHO your homework. 👍</Text>
                            </Card>
                        )}
                    </View>
                </View>

                {/* Spacer for FAB */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Floating Action Button */}
            <Pressable
                onPress={() => navigation.navigate('Search')} // Assuming 'Search' is the route name
                style={({ pressed }) => [
                    styles.fab,
                    pressed && styles.fabPressed,
                ]}
            >
                <Plus size={28} color="#fff" strokeWidth={2.5} />
            </Pressable>
            
            {/* Modal for Selecting Schedule */}
            <Modal visible={dropdownVisible} transparent animationType="fade">
                <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Your Schedules</Text>
                                <ScrollView style={{maxHeight: 300}}>
                                    {schedules.map(s => (
                                        <Pressable 
                                            key={s.schedule_id} 
                                            style={styles.scheduleOption}
                                            onPress={() => {
                                                setSelectedSchedule(s);
                                                setDropdownVisible(false);
                                            }}
                                        >
                                            <Text style={[styles.scheduleText, selectedSchedule?.schedule_id === s.schedule_id && { color: COLORS.primary }]}>
                                                {s.name} ({s.term_code})
                                            </Text>
                                            {selectedSchedule?.schedule_id === s.schedule_id && (
                                                <CheckCircle2 color={COLORS.primary} size={20} />
                                            )}
                                        </Pressable>
                                    ))}
                                    {schedules.length === 0 && (
                                        <Text style={{textAlign: 'center', color: COLORS.textSecondary, marginTop: 20}}>
                                            No schedules found.
                                        </Text>
                                    )}
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 60, // Safe area padding
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    name: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    termCard: {
        marginBottom: 24,
        padding: 20,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: COLORS.textPrimary,
    },
    progressContainer: {
        gap: 8,
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    caption: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    progressBarBg: {
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: COLORS.textPrimary,
    },
    courseList: {
        gap: 12,
    },
    courseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 16,
        borderRadius: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    courseItemPressed: {
        backgroundColor: '#1E1E1E',
        transform: [{ scale: 0.98 }],
    },
    colorStrip: {
        width: 6,
        height: 48,
        borderRadius: 3,
    },
    courseInfo: {
        flex: 1,
    },
    courseCode: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
        color: COLORS.textPrimary,
    },
    courseName: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    timeBadge: {
        backgroundColor: '#2A0000', // Matches primaryLight from SharedUI
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    timeText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        padding: 16,
    },
    fab: {
        position: 'absolute',
        bottom: 32, // bottom-24 -> ~96px / 3? adjusted for native
        right: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabPressed: {
        transform: [{ scale: 0.95 }],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        width: '80%',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    scheduleOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    scheduleText: {
        fontSize: 16,
        color: COLORS.textPrimary,
        fontWeight: '500',
    }
});
