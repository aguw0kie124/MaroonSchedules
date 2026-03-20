import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Switch, Platform, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LogOut, Save, ChevronDown } from 'lucide-react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';

import { COLORS } from './SharedUI';

import { fetchUserProfile, updateUserProfile } from '../api/client';

const MAJOR_OPTIONS = [
    'Aerospace Engineering',
    'Agricultural Economics',
    'Animal Science',
    'Biochemistry',
    'Biomedical Engineering',
    'Biomedical Sciences',
    'Chemical Engineering',
    'Chemistry',
    'Civil Engineering',
    'Communication',
    'Computer Engineering',
    'Computer Science',
    'Construction Science',
    'Economics',
    'Electrical Engineering',
    'English',
    'Environmental Engineering',
    'Finance',
    'General Engineering',
    'Genetics',
    'Health',
    'History',
    'Industrial Distribution',
    'Industrial Engineering',
    'Information Technology',
    'Kinesiology',
    'Management',
    'Management Information Systems',
    'Marketing',
    'Mathematics',
    'Mechanical Engineering',
    'Microbiology',
    'Neuroscience',
    'Nuclear Engineering',
    'Nursing',
    'Nutrition',
    'Ocean Engineering',
    'Petroleum Engineering',
    'Philosophy',
    'Physics',
    'Political Science',
    'Psychology',
    'Sociology',
    'Statistics',
    'Supply Chain Management',
    'University Studies',
    'Visualization',
    'Other',
];

const GRADUATION_YEAR_OPTIONS = [
    '2025', '2026', '2027', '2028', '2029', '2030', '2031',
];

export function Profile() {
    const navigation = useNavigation<any>();
    const [preferences, setPreferences] = useState({
        major: '',
        graduationYear: '',
        preferredTime: 'Morning',
        maxCredits: '15',
        avoidFriday: false,
        showOnlineFirst: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pickerVisible, setPickerVisible] = useState<'major' | 'gradYear' | null>(null);

    const { user } = useUser();
    const { signOut } = useClerk();

    // Load saved profile from PostgreSQL on mount
    useEffect(() => {
        if (!user) return;
        fetchUserProfile(user.id)
            .then(data => {
                setPreferences({
                    major: data.major || '',
                    graduationYear: data.graduation_year || '',
                    preferredTime: data.preferred_time || 'Morning',
                    maxCredits: data.max_credits || '15',
                    avoidFriday: data.avoid_friday ?? false,
                    showOnlineFirst: data.show_online_first ?? true,
                });
            })
            .catch(err => console.warn('Failed to load profile:', err))
            .finally(() => setLoading(false));
    }, [user]);

    // Auto-save a single field to the backend
    const saveField = useCallback(async (fields: Record<string, any>) => {
        if (!user) return;
        try {
            await updateUserProfile(user.id, fields);
        } catch (err) {
            console.warn('Auto-save failed:', err);
        }
    }, [user]);

    const handleMajorSelect = (value: string) => {
        setPreferences(prev => ({ ...prev, major: value }));
        setPickerVisible(null);
        saveField({ major: value });
    };

    const handleGradYearSelect = (value: string) => {
        setPreferences(prev => ({ ...prev, graduationYear: value }));
        setPickerVisible(null);
        saveField({ graduation_year: value });
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateUserProfile(user.id, {
                major: preferences.major,
                graduation_year: preferences.graduationYear,
                preferred_time: preferences.preferredTime,
                max_credits: preferences.maxCredits,
                avoid_friday: preferences.avoidFriday,
                show_online_first: preferences.showOnlineFirst,
            });
            Alert.alert('Saved', 'Your preferences have been updated.');
        } catch (err) {
            Alert.alert('Error', 'Failed to save preferences.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Profile & Preferences</Text>

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {user?.firstName?.[0] || 'U'}
                    </Text>
                </View>
                <Text style={styles.name}>{user?.fullName || 'Aggie User'}</Text>
                <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress || 'user@tamu.edu'}</Text>
            </View>

            {/* Profile Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Information</Text>

                <DropdownField
                    label="Major"
                    value={preferences.major || 'Select your major'}
                    onPress={() => setPickerVisible('major')}
                />

                <DropdownField
                    label="Graduation Year"
                    value={preferences.graduationYear || 'Select year'}
                    onPress={() => setPickerVisible('gradYear')}
                />

                <InputField
                    label="Preferred Time of Day"
                    value={preferences.preferredTime}
                    onChange={(value) => setPreferences({ ...preferences, preferredTime: value })}
                />

                <InputField
                    label="Max Credits Per Term"
                    value={preferences.maxCredits}
                    onChange={(value) => setPreferences({ ...preferences, maxCredits: value })}
                    keyboardType="numeric"
                />
            </View>

            {/* Preferences */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferences</Text>

                <ToggleField
                    label="Avoid Friday Classes"
                    description="Prioritize schedules without Friday classes"
                    checked={preferences.avoidFriday}
                    onChange={(checked) => setPreferences({ ...preferences, avoidFriday: checked })}
                />

                <ToggleField
                    label="Show Online Courses First"
                    description="Display online courses at the top of search results"
                    checked={preferences.showOnlineFirst}
                    onChange={(checked) => setPreferences({ ...preferences, showOnlineFirst: checked })}
                />
            </View>

            {/* Save Button */}
            <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                    saving && { opacity: 0.6 },
                ]}
            >
                <Save size={20} color="#fff" />
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Preferences'}</Text>
            </Pressable>

            {/* Logout Button */}
            <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                    styles.logoutButton,
                    pressed && styles.pressed,
                ]}
            >
                <LogOut size={20} color={COLORS.danger} />
                <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>

            <View style={{ height: 80 }} />

            {/* Picker Modal */}
            <PickerModal
                visible={pickerVisible === 'major'}
                title="Select Major"
                options={MAJOR_OPTIONS}
                selectedValue={preferences.major}
                onSelect={handleMajorSelect}
                onClose={() => setPickerVisible(null)}
            />
            <PickerModal
                visible={pickerVisible === 'gradYear'}
                title="Graduation Year"
                options={GRADUATION_YEAR_OPTIONS}
                selectedValue={preferences.graduationYear}
                onSelect={handleGradYearSelect}
                onClose={() => setPickerVisible(null)}
            />
        </ScrollView>
    );
}

// ─── Reusable sub-components ─────────────────────────────────────────────

function DropdownField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.label}>{label}</Text>
            <Pressable onPress={onPress} style={styles.dropdown}>
                <Text style={[styles.dropdownText, !value && { color: COLORS.textSecondary }]}>
                    {value || `Select ${label.toLowerCase()}`}
                </Text>
                <ChevronDown size={18} color={COLORS.textSecondary} />
            </Pressable>
        </View>
    );
}

function PickerModal({
    visible,
    title,
    options,
    selectedValue,
    onSelect,
    onClose,
}: {
    visible: boolean;
    title: string;
    options: string[];
    selectedValue: string;
    onSelect: (value: string) => void;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHandle} />
                    <Text style={styles.modalTitle}>{title}</Text>
                    <FlatList
                        data={options}
                        keyExtractor={(item) => item}
                        style={{ maxHeight: 360 }}
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => onSelect(item)}
                                style={[
                                    styles.optionRow,
                                    item === selectedValue && styles.optionRowSelected,
                                ]}
                            >
                                <Text style={[
                                    styles.optionText,
                                    item === selectedValue && styles.optionTextSelected,
                                ]}>
                                    {item}
                                </Text>
                            </Pressable>
                        )}
                    />
                </View>
            </Pressable>
        </Modal>
    );
}

function InputField({
    label,
    value,
    onChange,
    keyboardType = 'default',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    keyboardType?: 'default' | 'numeric';
}) {
    return (
        <View style={styles.inputContainer}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChange}
                keyboardType={keyboardType}
                style={styles.input}
            />
        </View>
    );
}

function ToggleField({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Text style={styles.toggleDescription}>{description}</Text>
            </View>
            <Switch
                value={checked}
                onValueChange={onChange}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={'#fff'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    contentContainer: {
        padding: 16,
        paddingTop: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 24,
        color: COLORS.textPrimary,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '600',
        color: 'white',
    },
    name: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    email: {
        color: COLORS.textSecondary,
    },
    section: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        gap: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        color: COLORS.textPrimary,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    input: {
        height: 48,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    // Dropdown
    dropdown: {
        height: 48,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dropdownText: {
        fontSize: 16,
        color: COLORS.textPrimary,
        flex: 1,
    },
    // Toggle
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    toggleInfo: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
        color: COLORS.textPrimary,
    },
    toggleDescription: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    // Buttons
    saveButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    saveText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    logoutButton: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    logoutText: {
        color: COLORS.danger,
        fontWeight: '600',
        fontSize: 16,
    },
    pressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    // Modal / Picker
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHandle: {
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: COLORS.border,
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    optionRow: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    optionRowSelected: {
        backgroundColor: COLORS.primary + '18',
    },
    optionText: {
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    optionTextSelected: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});
