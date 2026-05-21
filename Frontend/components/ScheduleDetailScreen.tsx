import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Pressable } from 'react-native';
import { useRoute, useNavigation, useIsFocused, CommonActions } from '@react-navigation/native';
import { fetchSchedules, removeSectionFromSchedule, requestJson } from '../api/client';
import { useTheme, PrimaryButton, SectionRow, Card } from './SharedUI';
import { useUser } from '@clerk/clerk-expo';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { useShareStore } from '../store/shareStore';
import { triggerNativeShare } from '../utils/share';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function ScheduleDetailScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { scheduleId, scheduleObj } = route.params;
    const { user } = useUser();
    const userId = user?.id || 'anonymous';
    const { openShare } = useShareStore();
    const [schedule, setSchedule] = useState<any>(scheduleObj);
    const { width } = useWindowDimensions();


    const handleBackToSchedules = () => {
        const state = navigation.getState();
        const schedIndex = state.routes.findIndex((r: any) => r.name === 'ScheduleList');
        
        if (schedIndex !== -1) {
            navigation.dispatch(
                CommonActions.reset({
                    index: schedIndex,
                    routes: state.routes.slice(0, schedIndex + 1),
                })
            );
        } else {
            const mainRoute = state.routes.find((r: any) => r.name === 'Main') || state.routes[0];
            const currentRoute = state.routes[state.routes.length - 1];
            navigation.dispatch(
                CommonActions.reset({
                    index: 2,
                    routes: [
                        mainRoute,
                        { name: 'ScheduleList', key: `ScheduleList-${Date.now()}` },
                        currentRoute,
                    ],
                })
            );
            setTimeout(() => {
                navigation.goBack();
            }, 0);
        }
    };

    const handleShare = () => {
        if (!schedule) return;
        triggerNativeShare({
            title: schedule.name,
            message: `Check out my ${getTermName(schedule.term_code)} schedule!`,
            url: `https://maroonschedules.com/schedules/${schedule.schedule_id}`,
            id: schedule.schedule_id,
            type: 'schedule',
        });
    };

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => (
                <Pressable
                    onPress={handleBackToSchedules}
                    style={{ marginLeft: 16, flexDirection: 'row', alignItems: 'center' }}
                >
                    <ChevronLeft size={28} color={COLORS.primary} />
                    <Text style={{ color: COLORS.primary, fontSize: 17, marginLeft: -4, fontWeight: '500' }}>Schedules</Text>
                </Pressable>
            ),
            headerRight: () => (
                <Pressable
                    onPress={handleShare}
                    style={{ marginRight: 16 }}
                >
                    <Share2 size={24} color={COLORS.primary} />
                </Pressable>
            ),
        });
    }, [navigation, COLORS, schedule]);

    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    const ROW_HEIGHT = 64;
    const TIME_COL_WIDTH = 50;
    const GRID_WIDTH = width - 32;
    const DAY_COL_WIDTH = (GRID_WIDTH - TIME_COL_WIDTH) / 5;

    // Helper to turn times into minutes from midnight (handles "am", "pm", "AM", "PM")
    const parseTimeToMinutes = (timeStr?: string) => {
        if (!timeStr) return null;
        let [time, period] = timeStr.split(' ');
        if (!time) return null;
        let [hrs, mins] = time.split(':').map(Number);
        period = period?.toUpperCase() || '';
        if (period === 'PM' && hrs !== 12) hrs += 12;
        if (period === 'AM' && hrs === 12) hrs = 0;
        return hrs * 60 + mins;
    };

    const getGridDay = (apiDay: string) => {
        const d = apiDay.toLowerCase();
        if (d === 'm' || d === 'monday') return 'Mon';
        if (d === 't' || d === 'tue' || d === 'tuesday') return 'Tue';
        if (d === 'w' || d === 'wednesday') return 'Wed';
        if (d === 'r' || d === 'th' || d === 'thursday') return 'Thu';
        if (d === 'f' || d === 'friday') return 'Fri';
        return null;
    };

    const getTermName = (code: string) => {
        if (!code) return '';
        const year = code.substring(0, 4);
        const suffix = code.substring(4);
        const seasonMap: Record<string, string> = {
            '11': 'Spring',
            '21': 'Summer',
            '22': 'Summer I',
            '23': 'Summer II',
            '31': 'Fall',
            '32': 'Fall (2)',
            '41': 'Winter',
        };
        const season = seasonMap[suffix] || `Term ${suffix}`;
        return `${season} ${year}`;
    };

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            loadSchedule();
        }
    }, [isFocused]);

    const loadSchedule = async () => {
        try {
            const data = await fetchSchedules(userId);
            const found = data.find((s: any) => s.schedule_id === scheduleId);
            if (!found) return;

            // Enrich any bare sections (backend cache miss → only has id)
            const enriched = await Promise.all(
                (found.sections || []).map(async (sec: any) => {
                    // A bare section has no dept, courseTitle, or sectionNumber
                    if (!sec.dept && !sec.courseTitle && !sec.name && !sec.sectionNumber) {
                        const secId = sec.id || sec.section_id;
                        // 1. Try local AsyncStorage cache (saved when user added the section)
                        try {
                            const cached = await AsyncStorage.getItem(`section_cache_${secId}`);
                            if (cached) return JSON.parse(cached);
                        } catch { /* ignore */ }
                        // 2. Fallback: try backend API
                        try {
                            const full = await requestJson(`/sections/${secId}`);
                            return full || sec;
                        } catch {
                            return sec;
                        }
                    }
                    return sec;
                })
            );
            setSchedule({ ...found, sections: enriched });
        } catch (e) { }
    };

    const handleRemove = async (sectionId: string) => {
        try {
            await removeSectionFromSchedule(scheduleId, sectionId, userId);
            const updated = { ...schedule, sections: schedule.sections.filter((s: any) => s.section_id !== sectionId) };
            setSchedule(updated);
            loadSchedule(); // background fetch sync
        } catch (e) { alert("Failed to remove."); }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <View style={styles.header}>
                <Text style={styles.title}>{schedule?.name}</Text>
                <Text style={styles.subtitle}>{getTermName(schedule?.term_code)}</Text>
            </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Courses ({schedule?.sections?.length || 0})</Text>
                    <PrimaryButton
                        title="+ Add Class"
                        onPress={() => navigation.navigate('NewCourseSearch', { returnTo: 'ScheduleDetail', scheduleId })}
                        style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                    />
                </View>

                {schedule?.sections?.map((sec: any) => (
                    <SectionRow
                        key={sec.id || sec.section_id}
                        section={sec}
                        onRemove={handleRemove}
                    />
                ))}

                {(!schedule?.sections || schedule.sections.length === 0) && (
                    <Text style={styles.empty}>No classes planned for this schedule.</Text>
                )}


            <View style={styles.weeklyHeader}>
                <Text style={styles.sectionTitle}>Weekly Grid Layout</Text>
            </View>
            <View style={{ width: GRID_WIDTH, marginBottom: 40, marginTop: 10 }}>
                {/* Day Headers */}
                <View style={styles.gridHeader}>
                    <View style={{ width: TIME_COL_WIDTH }} />
                    {days.map((day) => (
                        <View key={day} style={{ width: DAY_COL_WIDTH, alignItems: 'center' }}>
                            <Text style={styles.dayHeaderText}>{day}</Text>
                        </View>
                    ))}
                </View>

                {/* Grid */}
                <View style={styles.gridBody}>
                    {hours.map((hour) => (
                        <View key={hour} style={styles.gridRow}>
                            <View style={[styles.timeSlot, { width: TIME_COL_WIDTH }]}>
                                <Text style={styles.timeText}>
                                    {hour > 12 ? hour - 12 : hour}
                                    {hour >= 12 ? 'pm' : 'am'}
                                </Text>
                            </View>
                            {days.map((day) => (
                                <View key={day} style={[styles.gridCell, { width: DAY_COL_WIDTH }]} />
                            ))}
                        </View>
                    ))}

                    {/* Course Blocks */}
                    {schedule?.sections?.map((sec: any, idx: number) => {
                        const meeting = sec.meetings?.[0];
                        if (!meeting || !meeting.beginTime || !meeting.endTime) return null;

                        const startTime = parseTimeToMinutes(meeting.beginTime);
                        const endTime = parseTimeToMinutes(meeting.endTime);
                        if (!startTime || !endTime) return null;

                        // Give sections pseudo colors
                        const colors = ['#500000', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];
                        const blockColor = colors[idx % colors.length];

                        return meeting.daysOfWeek?.map((apiDay: string) => {
                            const gridDay = getGridDay(apiDay);
                            if (!gridDay) return null;
                            const dayIndex = days.indexOf(gridDay);
                            if (dayIndex === -1) return null;

                            const topOffset = ((startTime - 480) / 60) * ROW_HEIGHT;
                            const height = ((endTime - startTime) / 60) * ROW_HEIGHT;

                            // Safe course code display handling empty depts or ids
                            const courseCode = sec.dept
                                ? `${sec.dept} ${sec.courseNumber || ''}`
                                : (sec.courseTitle || sec.name || sec.course_display || sec.id || 'Course');
                            const secNum = sec.sectionNumber || sec.section || '';

                            return (
                                <View
                                    key={`${sec.id}-${gridDay}`}
                                    style={[
                                        styles.courseBlock,
                                        {
                                            left: TIME_COL_WIDTH + dayIndex * DAY_COL_WIDTH + 2,
                                            top: topOffset,
                                            width: DAY_COL_WIDTH - 4,
                                            height: Math.max(height, 24), // Ensure visual block isn't totally collapsed
                                            backgroundColor: blockColor,
                                        },
                                    ]}
                                >
                                    <Text style={styles.blockCode} numberOfLines={1}>{courseCode}{secNum ? ` - ${secNum}` : ''}</Text>
                                    <Text style={styles.blockText} numberOfLines={1}>{meeting.building} {meeting.room}</Text>
                                    <Text style={styles.blockText} numberOfLines={1}>{meeting.beginTime}</Text>
                                </View>
                            );
                        });
                    })}
                </View>
            </View>

        </ScrollView>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { marginBottom: 24 },
    title: { fontSize: 26, fontWeight: 'bold', color: COLORS.textPrimary },
    subtitle: { fontSize: 16, color: COLORS.textSecondary, marginTop: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
    empty: { textAlign: 'center', marginTop: 20, color: COLORS.textSecondary, marginBottom: 24 },
    weeklyHeader: { marginTop: 32, marginBottom: 12 },
    // Grid Styles
    gridHeader: { flexDirection: 'row', paddingBottom: 8 },
    dayHeaderText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
    gridBody: { position: 'relative' },
    gridRow: { flexDirection: 'row', height: 64 },
    timeSlot: { alignItems: 'flex-end', paddingRight: 8, paddingTop: 0 },
    timeText: { fontSize: 10, color: COLORS.textSecondary, transform: [{ translateY: -6 }] },
    gridCell: { borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
    courseBlock: {
        position: 'absolute',
        borderRadius: 8,
        padding: 4,
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    blockCode: { fontSize: 10, fontWeight: '700', color: 'white' },
    blockText: { fontSize: 8, color: 'white', opacity: 0.9 },
});
