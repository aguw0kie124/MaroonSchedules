import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { fetchCourseById, fetchSchedules, addSectionToSchedule } from '../api/client';
import { useTheme, Card, SectionRow, PrimaryButton } from './SharedUI';
import { useUser } from '@clerk/clerk-expo';
import { Calendar, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findApForCourse } from '../data/apEquivalencies';

// Parse a prereq string into alternating plain-text and course-code tokens
// e.g. "CSCE 121 or MATH 151" → [{type:'course', value:'CSCE 121'}, {type:'text', value:' or '}, ...]
function parsePrereqTokens(prereq: string): Array<{ type: 'text' | 'course'; value: string }> {
    const coursePattern = /([A-Z]{2,5}\s+\d{3}[A-Z0-9]*)/g;
    const tokens: Array<{ type: 'text' | 'course'; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = coursePattern.exec(prereq)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: prereq.slice(lastIndex, match.index) });
        }
        tokens.push({ type: 'course', value: match[0] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < prereq.length) {
        tokens.push({ type: 'text', value: prereq.slice(lastIndex) });
    }
    return tokens;
}

export function NewCourseDetailScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { courseId, returnTo, scheduleId: paramScheduleId } = route.params || {};
    const { user } = useUser();
    const userId = user?.id || 'anonymous';
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [selectedSection, setSelectedSection] = useState<any>(null);
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        loadCourse();
        loadSchedules();
    }, []);

    const loadCourse = async () => {
        try {
            const res = await fetchCourseById(courseId);
            setCourse(res);
        } catch (e) { console.warn(e); }
        setLoading(false);
    };

    const loadSchedules = async () => {
        try {
            const res = await fetchSchedules(userId);
            setSchedules(res);
        } catch (e) { console.warn(e); }
    };

    const handleAddSectionClick = (sectionId: string) => {
        // Find the full section object from the course data
        const sectionObj = (course?.sections || []).find((s: any) => s.id === sectionId);

        const proceedWithAdd = (secObj: any) => {
            // If we came from a specific schedule, add directly without showing the modal
            if (paramScheduleId) {
                setSelectedSection(secObj);
                confirmAddToSchedule(paramScheduleId, secObj);
            } else {
                setSelectedSection(secObj);
                setModalVisible(true);
            }
        };

        // If the section is closed, show a warning first
        if (sectionObj && !sectionObj.isOpen) {
            Alert.alert(
                'Section Closed',
                'This section is currently closed. Are you sure you want to add it to your schedule?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Add Anyway',
                        style: 'destructive',
                        onPress: () => proceedWithAdd(sectionObj),
                    },
                ]
            );
        } else {
            proceedWithAdd(sectionObj || { id: sectionId });
        }
    };

    const confirmAddToSchedule = async (targetScheduleId: string, sectionOverride?: any) => {
        const sec = sectionOverride || selectedSection;
        if (!sec || isAdding) return;
        
        setIsAdding(true);
        try {
            await addSectionToSchedule(targetScheduleId, sec.id, userId);

            // Cache the full section object locally so ScheduleDetailScreen can display it
            // This ensures calendar blocks render immediately with meetings, prof, location
            try {
                await AsyncStorage.setItem(
                    `section_cache_${sec.id}`,
                    JSON.stringify(sec),
                );
            } catch (_) { /* non-critical */ }

            setModalVisible(false);
            
            const sectionLabel = sec.dept
                ? `${sec.dept} ${sec.courseNumber} - Sec ${sec.sectionNumber}`
                : `Section ${sec.sectionNumber || sec.id}`;

            // Navigate back to the schedule detail so the user sees the updated calendar
            if (returnTo === 'ScheduleDetail' && paramScheduleId) {
                // Go back to ScheduleDetail — useIsFocused will trigger a reload
                navigation.goBack();
            } else {
                alert(`${sectionLabel} added to your schedule!`);
            }
        } catch (e) {
            alert("Failed to add section.");
        } finally {
            setIsAdding(false);
        }
    };

    if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
    if (!course) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Course not found.</Text>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.title}>{course.code} - {course.name}</Text>
                    </View>
                    <PrimaryButton 
                        title="View Grades" 
                        onPress={() => {
                            const parts = course.code.split(' ');
                            if (parts.length >= 2) {
                                navigation.navigate('GradesScreen', { initialSubject: parts[0], initialCourseNum: parts.slice(1).join(' ') });
                            }
                        }} 
                        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                        textStyle={{ fontSize: 13 }}
                    />
                </View>
                <Text style={[styles.subtitle, { marginBottom: course.prerequisites ? 6 : 0 }]}>{course.description || "No description available."}</Text>
                {course.prerequisites && (() => {
                    const tokens = parsePrereqTokens(course.prerequisites);
                    // Collect AP info for each prerequisite course
                    const prereqApInfo = new Map<string, { apExam: string; minScore: number }[]>();
                    for (const ct of tokens.filter(t => t.type === 'course')) {
                        const apMatches = findApForCourse(ct.value);
                        if (apMatches.length > 0) {
                            const byExam = new Map<string, number>();
                            for (const m of apMatches) {
                                const cur = byExam.get(m.apExam);
                                if (!cur || m.apScore < cur) byExam.set(m.apExam, m.apScore);
                            }
                            prereqApInfo.set(ct.value, Array.from(byExam.entries()).map(([apExam, minScore]) => ({ apExam, minScore })));
                        }
                    }
                    return (
                    <View style={{ marginTop: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' }}>Prerequisites</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            {tokens.map((token, idx) =>
                                token.type === 'course' ? (
                                    <Pressable
                                        key={idx}
                                        onPress={() => navigation.navigate('APEquivalency', { initialFilter: token.value })}
                                        style={({ pressed }) => ({
                                            backgroundColor: pressed ? COLORS.primary + '40' : COLORS.primary + '18',
                                            borderRadius: 8,
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderWidth: 1,
                                            borderColor: COLORS.primary + '40',
                                        })}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>
                                            {token.value}
                                        </Text>
                                    </Pressable>
                                ) : (
                                    <Text key={idx} style={{ fontSize: 13, color: COLORS.textSecondary }}>
                                        {token.value}
                                    </Text>
                                )
                            )}
                        </View>
                        {/* Inline AP credit info for prerequisite courses */}
                        {prereqApInfo.size > 0 && (
                            <View style={{ marginTop: 8, gap: 6 }}>
                                {Array.from(prereqApInfo.entries()).map(([course, aps]) => (
                                    <Pressable
                                        key={course}
                                        onPress={() => navigation.navigate('APEquivalency', { initialFilter: course })}
                                        style={({ pressed }) => ({
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: pressed ? '#30D15820' : '#30D15810',
                                            borderRadius: 8,
                                            paddingHorizontal: 10,
                                            paddingVertical: 6,
                                            borderWidth: 1,
                                            borderColor: '#30D15830',
                                            gap: 6,
                                        })}
                                    >
                                        <Text style={{ fontSize: 13 }}>🎓</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#30D158' }}>
                                                {course} — skippable via AP
                                            </Text>
                                            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 1 }}>
                                                {aps.map(a => `${a.apExam} (${a.minScore}+)`).join(', ')}
                                            </Text>
                                        </View>
                                        <ChevronRight size={14} color="#30D158" />
                                    </Pressable>
                                ))}
                            </View>
                        )}
                        <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 6 }}>
                            Tap a course to see its AP equivalency
                        </Text>
                    </View>
                    );
                })()}
            </View>

            {/* Schedule Planner button */}
            <Pressable
                onPress={() => navigation.navigate('ScheduleList')}
                style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginHorizontal: 16,
                    marginTop: 16,
                    backgroundColor: pressed ? COLORS.primary + '30' : COLORS.primary + '12',
                    borderRadius: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 16,
                    borderWidth: 1,
                    borderColor: COLORS.primary + '30',
                })}
            >
                <Calendar size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary, flex: 1 }}>
                    View Schedule Calendar
                </Text>
                <ChevronRight size={16} color={COLORS.primary} />
            </Pressable>

            <FlatList
                data={course.sections || []}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <SectionRow
                        section={item}
                        onAdd={handleAddSectionClick}
                    />
                )}
            />

            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Choose Schedule to Add To</Text>
                        {schedules.map(s => (
                            <Pressable 
                                key={s.schedule_id} 
                                style={[styles.scheduleOption, isAdding && { opacity: 0.5 }]} 
                                onPress={() => confirmAddToSchedule(s.schedule_id)}
                                disabled={isAdding}
                            >
                                <Text style={styles.scheduleText}>{s.name} ({s.term_code})</Text>
                            </Pressable>
                        ))}
                        {schedules.length === 0 && <Text style={{ marginBottom: 12, color: COLORS.textSecondary }}>No schedules found. Create one first!</Text>}
                        <PrimaryButton
                            title="Cancel"
                            variant="outline"
                            onPress={() => setModalVisible(false)}
                            style={{ marginTop: 12, borderColor: COLORS.border }}
                            textStyle={{ color: COLORS.textPrimary }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 14, color: COLORS.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: COLORS.textPrimary },
    scheduleOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    scheduleText: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' }
});
