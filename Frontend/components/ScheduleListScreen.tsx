import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Modal, TextInput, Pressable, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { fetchSchedules, createSchedule, deleteSchedule } from '../api/client';
import { COLORS, PrimaryButton } from './SharedUI';
import { Grid3x3, CheckCircle2, X } from 'lucide-react-native';

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

    const handleDelete = (id: string, schedName: string) => {
        Alert.alert("Delete Schedule", `Are you sure you want to permanently delete "${schedName}"?`, [
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

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        // Generate pseudo-random gradient variations based on index for the wallet-pass look
        const hue = (index * 45) % 360;
        const color = `hsl(${hue}, 80%, 40%)`;

        return (
            <Pressable 
                onPress={() => navigation.navigate('ScheduleDetail', { scheduleId: item.schedule_id, scheduleObj: item })}
                onLongPress={() => handleDelete(item.schedule_id, item.name)}
                style={({pressed}) => [styles.walletCard, { backgroundColor: color }, pressed && styles.cardPressed]}
            >
                <View style={styles.walletHeader}>
                    <Text style={styles.walletTerm}>{item.term_code}</Text>
                    <CheckCircle2 color="rgba(255,255,255,0.8)" size={20} />
                </View>
                <View style={styles.walletBody}>
                    <Text style={styles.walletName}>{item.name}</Text>
                    <Text style={styles.walletDetails}>{item.section_ids?.length || 0} enrolled classes</Text>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Schedules</Text>
                <PrimaryButton title="+ New" onPress={() => setModalVisible(true)} style={styles.newBtn} />
            </View>

            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 40}}/> : (
                <FlatList 
                    data={schedules}
                    keyExtractor={i => i.schedule_id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Grid3x3 color={COLORS.border} size={64} style={{marginBottom: 16}} />
                            <Text style={styles.emptyTitle}>No Schedules Found</Text>
                            <Text style={styles.emptyText}>Create a new schedule to start organizing sections for your upcoming term.</Text>
                        </View>
                    }
                />
            )}

            <Modal visible={modalVisible} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                            <Text style={styles.modalTitle}>New Schedule</Text>
                            <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                <X size={20} color={COLORS.textSecondary} />
                            </Pressable>
                        </View>
                        
                        <Text style={styles.inputLabel}>Schedule Name</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholderTextColor={COLORS.textSecondary} 
                            placeholder="e.g. Plan A" 
                            value={name} 
                            onChangeText={setName} 
                        />
                        
                        <Text style={styles.inputLabel}>Term Code</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholderTextColor={COLORS.textSecondary} 
                            placeholder="e.g. 202611" 
                            value={term} 
                            onChangeText={setTerm} 
                        />
                        
                        <PrimaryButton title="Create" onPress={handleCreate} style={{ marginTop: 24 }} />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: COLORS.background 
    },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: { 
        fontSize: 34, 
        fontWeight: '800', 
        letterSpacing: -1,
        color: COLORS.textPrimary 
    },
    newBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    listContainer: {
        padding: 16,
        paddingBottom: 40,
        gap: 16,
    },
    walletCard: { 
        height: 140,
        borderRadius: 20, // Apple smooth geometry
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
        justifyContent: 'space-between',
    },
    cardPressed: {
        transform: [{scale: 0.97}],
        opacity: 0.9,
    },
    walletHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    walletTerm: {
        fontSize: 14,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    walletBody: {
        marginTop: 'auto',
    },
    walletName: { 
        fontSize: 26, 
        fontWeight: '800',
        letterSpacing: -0.5,
        color: '#FFFFFF',
        marginBottom: 4,
    },
    walletDetails: { 
        fontSize: 15, 
        color: 'rgba(255,255,255,0.9)', 
        fontWeight: '500', 
    },
    emptyState: { 
        alignItems: 'center', 
        marginTop: 80, 
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 15,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
    modalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        justifyContent: 'flex-end',
    },
    modalContent: { 
        backgroundColor: COLORS.surface, 
        padding: 24, 
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalTitle: { 
        fontSize: 22, 
        fontWeight: '800',
        letterSpacing: -0.5,
        color: COLORS.textPrimary,
    },
    closeBtn: {
        padding: 8,
        backgroundColor: COLORS.background,
        borderRadius: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 8,
        marginTop: 16,
    },
    input: { 
        backgroundColor: COLORS.background, 
        padding: 16, 
        borderRadius: 12, 
        fontSize: 17, 
        color: COLORS.textPrimary,
    }
});
