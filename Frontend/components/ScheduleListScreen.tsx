import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Modal, TextInput, Pressable, Alert } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { fetchSchedules, createSchedule, deleteSchedule } from '../api/client';
import { COLORS, Card, PrimaryButton } from './SharedUI';

export function ScheduleListScreen() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    
    const [name, setName] = useState('');
    const [term, setTerm] = useState('');

    useEffect(() => {
        if (isFocused) {
            loadSchedules();
        }
    }, [isFocused]);

    const loadSchedules = async () => {
        try {
            const data = await fetchSchedules("test_user_1");
            setSchedules(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!name || !term) return alert('Please enter name and term.');
        try {
            await createSchedule({ user_id: 'test_user_1', name, term_code: term });
            setModalVisible(false);
            setName('');
            setTerm('');
            loadSchedules();
        } catch(e) { alert('Error creating schedule.'); }
    };

    const handleDelete = (id: string) => {
        Alert.alert("Delete Schedule", "Are you sure you want to delete this schedule?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    try {
                        await deleteSchedule(id);
                        loadSchedules();
                    } catch(e) { alert("Failed to delete."); }
                } 
            }
        ]);
    };

    const renderItem = ({ item }: { item: any }) => (
        <Pressable 
            onPress={() => navigation.navigate('ScheduleDetail', { scheduleId: item.schedule_id, scheduleObj: item })}
            onLongPress={() => handleDelete(item.schedule_id)}
        >
            <Card style={styles.card}>
                <View>
                    <Text style={styles.schedName}>{item.name}</Text>
                    <Text style={styles.schedTerm}>{item.term_code} • {item.section_ids?.length || 0} classes</Text>
                </View>
                <Text style={{color: COLORS.primary, fontSize: 12}}>Long press to delete</Text>
            </Card>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Schedules</Text>
                <PrimaryButton title="+ New" onPress={() => setModalVisible(true)} style={{ paddingVertical: 8 }} />
            </View>

            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 40}}/> : (
                <FlatList 
                    data={schedules}
                    keyExtractor={i => i.schedule_id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                    ListEmptyComponent={<Text style={styles.empty}>No schedules yet. Create one!</Text>}
                />
            )}

            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create Schedule</Text>
                        <TextInput style={styles.input} placeholderTextColor="#000" placeholder="Name (e.g. Plan A)" value={name} onChangeText={setName} />
                        <TextInput style={styles.input} placeholderTextColor="#000" placeholder="Term (e.g. Fall 2026)" value={term} onChangeText={setTerm} />
                        <PrimaryButton title="Create" onPress={handleCreate} style={{ marginTop: 12 }} />
                        <PrimaryButton title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{ marginTop: 8 }} />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    schedName: { fontSize: 18, fontWeight: 'bold' },
    schedTerm: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
    empty: { textAlign: 'center', marginTop: 40, color: COLORS.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    input: { backgroundColor: COLORS.background, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, fontSize: 16, color: '#000' }
});
