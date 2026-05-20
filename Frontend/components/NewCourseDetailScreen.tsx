import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Modal, Pressable, ScrollView } from 'react-native';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { fetchCourseById, fetchSchedules, addSectionToSchedule } from '../api/client';
import { useTheme, Card, SectionRow, PrimaryButton } from './SharedUI';
import { useUser } from '@clerk/clerk-expo';
import { Calendar, ChevronRight } from 'lucide-react-native';
import { navigationRef } from '../navigation/Refs';

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
    const { courseId, returnTo } = route.params || {};
    const { user } = useUser();
    const userId = user?.id || 'anonymous';
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
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
        setSelectedSection(sectionId);
        setModalVisible(true);
    };

    const confirmAddToSchedule = async (scheduleId: string) => {
        if (!selectedSection || isAdding) return;
        
        setIsAdding(true);
        try {
            await addSectionToSchedule(scheduleId, selectedSection, userId);
            setModalVisible(false);
            
            // Show success message and stay on the screen
            alert("Section added to your schedule!");
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
                {course.prerequisites && (
                    <View style={{ marginTop: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' }}>Prerequisites</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            {parsePrereqTokens(course.prerequisites).map((token, idx) =>
                                token.type === 'course' ? (
                                    <Pressable
                                        key={idx}
                                        onPress={() => (navigationRef as any).navigate('Grades', {
                                            screen: 'APEquivalency',
                                            params: { initialFilter: token.value },
                                        })}
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
                        <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 6 }}>
                            Tap a course to see its AP equivalency
                        </Text>
                    </View>
                )}
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
