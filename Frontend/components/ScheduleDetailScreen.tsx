import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchSchedules, removeSectionFromSchedule } from '../api/client';
import { COLORS, PrimaryButton, SectionRow, Card } from './SharedUI';

export function ScheduleDetailScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { scheduleId, scheduleObj } = route.params;
    const [schedule, setSchedule] = useState<any>(scheduleObj);

    useEffect(() => {
        loadSchedule();
    }, []);

    const loadSchedule = async () => {
        try {
            const data = await fetchSchedules("test_user_1");
            const found = data.find((s: any) => s.schedule_id === scheduleId);
            if (found) setSchedule(found);
        } catch (e) {}
    };

    const handleRemove = async (sectionId: string) => {
        try {
            await removeSectionFromSchedule(scheduleId, sectionId, "test_user_1");
            const updated = { ...schedule, sections: schedule.sections.filter((s:any) => s.section_id !== sectionId) };
            setSchedule(updated);
            loadSchedule(); // background fetch sync
        } catch(e) { alert("Failed to remove."); }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            <View style={styles.header}>
                <Text style={styles.title}>{schedule?.name}</Text>
                <Text style={styles.subtitle}>{schedule?.term_code}</Text>
            </View>

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Sections ({schedule?.sections?.length || 0})</Text>
                <PrimaryButton 
                    title="+ Add Class" 
                    onPress={() => navigation.navigate('NewCourseSearch')} 
                    style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                />
            </View>

            {schedule?.sections?.map((sec: any) => (
                <SectionRow 
                    key={sec.section_id} 
                    section={{ id: sec.section_id, section: sec.section_id }} 
                    onRemove={handleRemove} 
                />
            ))}

            {(!schedule?.sections || schedule.sections.length === 0) && (
                <Text style={styles.empty}>No classes planned for this schedule.</Text>
            )}

            <View style={styles.weeklyHeader}>
                <Text style={styles.sectionTitle}>Weekly Grid Layout</Text>
            </View>
            <Card style={styles.gridCard}>
                <Text style={{color: COLORS.textSecondary, textAlign: 'center', marginVertical: 40}}>
                    (Weekly Timetable Layout Placeholder)
                </Text>
            </Card>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { marginBottom: 24 },
    title: { fontSize: 26, fontWeight: 'bold', color: COLORS.textPrimary },
    subtitle: { fontSize: 16, color: COLORS.textSecondary, marginTop: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
    empty: { textAlign: 'center', marginTop: 20, color: COLORS.textSecondary, marginBottom: 24 },
    weeklyHeader: { marginTop: 32, marginBottom: 12 },
    gridCard: { minHeight: 150, justifyContent: 'center' }
});
