import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { fetchCourseById, fetchSchedules, addSectionToSchedule } from '../api/client';
import { COLORS, Card, SectionRow, PrimaryButton } from './SharedUI';

export function NewCourseDetailScreen() {
    const route = useRoute<any>();
    const { courseId } = route.params;
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);

    useEffect(() => {
        loadCourse();
        loadSchedules();
    }, []);

    const loadCourse = async () => {
        try {
            const res = await fetchCourseById(courseId);
            setCourse(res);
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const loadSchedules = async () => {
        try {
            const res = await fetchSchedules("test_user_1"); // hardcoded test user id
            setSchedules(res);
        } catch(e) { console.error(e); }
    };

    const handleAddSectionClick = (sectionId: string) => {
        setSelectedSection(sectionId);
        setModalVisible(true);
    };

    const confirmAddToSchedule = async (scheduleId: string) => {
        if (!selectedSection) return;
        try {
            await addSectionToSchedule(scheduleId, selectedSection, "test_user_1");
            alert("Added section successfully!"); // Optimistic toast placeholder
            setModalVisible(false);
        } catch (e) {
            alert("Failed to add section.");
        }
    };

    if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
    if (!course) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Course not found.</Text>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{course.code} - {course.name}</Text>
                <Text style={styles.subtitle}>{course.description || "No description available."}</Text>
            </View>

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
                            <Pressable key={s.schedule_id} style={styles.scheduleOption} onPress={() => confirmAddToSchedule(s.schedule_id)}>
                                <Text style={styles.scheduleText}>{s.name} ({s.term_code})</Text>
                            </Pressable>
                        ))}
                        {schedules.length === 0 && <Text style={{ marginBottom: 12 }}>No schedules found. Create one first!</Text>}
                        <PrimaryButton title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{ marginTop: 12 }} />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 14, color: COLORS.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    scheduleOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    scheduleText: { fontSize: 16, color: COLORS.primary, fontWeight: '500' }
});
