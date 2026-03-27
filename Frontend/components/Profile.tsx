import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Switch, Platform, ActivityIndicator, Alert, Modal, FlatList, Image } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { LogOut, Save, ChevronDown, Camera, GraduationCap, Search, Calendar as CalendarIcon, ChevronRight, Wallet, BriefcaseBusiness } from 'lucide-react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from './SharedUI';

import { fetchCampusConnectors, fetchCampusOverview, fetchUserProfile, updateUserProfile } from '../api/client';

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

const PREFERRED_TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'No Preference'];

const MAX_CREDITS_OPTIONS = ['12', '15', '18', '21'];

const CONNECTOR_OPTIONS = [
    {
        systemId: 'howdy',
        label: 'Howdy Portal',
        description: 'Academic schedule, GPA, holds, and registration readiness.',
        icon: GraduationCap,
        tint: '#800000',
    },
    {
        systemId: 'transact',
        label: 'Transact eAccounts',
        description: 'Meal plans, balances, and recent dining transactions.',
        icon: Wallet,
        tint: '#A15C00',
    },
    {
        systemId: 'symplicity',
        label: 'Hire Aggies',
        description: 'Jobs, employers, interviews, and career event activity.',
        icon: BriefcaseBusiness,
        tint: '#236B54',
    },
];

function getConnectorStatusLabel(status?: string) {
    if (status === 'connected') return 'Connected';
    if (status === 'awaiting_login') return 'Finish Login';
    return 'Connect';
}

function getConnectorDescription(connector: any, fallback: string) {
    if (connector?.status === 'connected' && connector?.updated_at) {
        const updatedAt = new Date(connector.updated_at);
        return `Captured ${updatedAt.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })}`;
    }

    if (connector?.status === 'awaiting_login') {
        return 'Keep going in the connector browser until your campus data page is visible.';
    }

    return fallback;
}

export function Profile() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
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
    const [connectors, setConnectors] = useState<any[]>([]);
    const [connectorsLoading, setConnectorsLoading] = useState(true);
    const [academicStatus, setAcademicStatus] = useState<any | null>(null);
    const [pickerVisible, setPickerVisible] = useState<'major' | 'gradYear' | 'prefTime' | null>(null);
    const { COLORS, theme, setTheme, useWallpaper, setUseWallpaper } = useTheme();
    const styles = getStyles(COLORS);

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

    useEffect(() => {
        let cancelled = false;
        if (!user || !isFocused) return;

        setConnectorsLoading(true);
        fetchCampusConnectors(user.id)
            .then(data => {
                if (!cancelled) {
                    setConnectors(Array.isArray(data) ? data : []);
                }
            })
            .catch(err => console.warn('Failed to load connectors:', err))
            .finally(() => {
                if (!cancelled) {
                    setConnectorsLoading(false);
                }
            });

        fetchCampusOverview(user.id)
            .then(data => {
                if (!cancelled) {
                    setAcademicStatus(data?.academic || null);
                }
            })
            .catch(err => console.warn('Failed to load academic status:', err));

        return () => {
            cancelled = true;
        };
    }, [isFocused, user]);

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

    const handlePrefTimeSelect = (value: string) => {
        setPreferences(prev => ({ ...prev, preferredTime: value }));
        setPickerVisible(null);
        saveField({ preferred_time: value });
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
    
    const handleAvatarPress = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need camera roll permissions to upload a profile picture.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            if (!user) return;
            
            setSaving(true);
            try {
                // Clerk's setProfileImage can accept a base64 string directly.
                // This is often more reliable in React Native/Expo than Blob conversion.
                const base64Data = asset.base64;
                const mimeType = asset.mimeType || 'image/jpeg';
                
                if (base64Data) {
                    await user.setProfileImage({ 
                        file: `data:${mimeType};base64,${base64Data}` 
                    });
                    Alert.alert('Success', 'Profile picture updated successfully!');
                } else if (asset.uri) {
                    // Fallback to URI if base64 is missing
                    await user.setProfileImage({ file: asset.uri });
                    Alert.alert('Success', 'Profile picture updated successfully!');
                }
            } catch (err) {
                console.error('Failed to upload image:', err);
                Alert.alert('Error', 'Failed to update profile picture.');
            } finally {
                setSaving(false);
            }
        }
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
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
                <Pressable onPress={handleAvatarPress} style={styles.avatarWrapper}>
                    <View style={styles.avatar}>
                        {user?.imageUrl ? (
                            <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>
                                {user?.firstName?.[0] || 'U'}
                            </Text>
                        )}
                        <View style={styles.cameraIconBadge}>
                            <Camera size={14} color="#fff" />
                        </View>
                    </View>
                </Pressable>
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

                <DropdownField
                    label="Preferred Time of Day"
                    value={preferences.preferredTime || 'Select preference'}
                    onPress={() => setPickerVisible('prefTime')}
                />

                {/* Max credits segmented control */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Max Credits Per Term</Text>
                    <View style={styles.segmentedRow}>
                        {MAX_CREDITS_OPTIONS.map(opt => (
                            <Pressable
                                key={opt}
                                style={[
                                    styles.segmentBtn,
                                    preferences.maxCredits === opt && styles.segmentBtnActive,
                                ]}
                                onPress={() => {
                                    setPreferences(prev => ({ ...prev, maxCredits: opt }));
                                    saveField({ max_credits: opt });
                                }}
                            >
                                <Text style={[
                                    styles.segmentText,
                                    preferences.maxCredits === opt && styles.segmentTextActive,
                                ]}>{opt}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </View>

            {/* Preferences */}
            <View style={styles.section}>
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

            {/* Academic Tools */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Academic Tools</Text>

                <Pressable style={styles.toolRow} onPress={() => navigation.navigate('NewCourseSearch')}>
                    <View style={[styles.toolIconBg, { backgroundColor: COLORS.primaryLight }]}>
                        <Search size={20} color={COLORS.primary} />
                    </View>
                    <Text style={styles.toolTitle}>Course Search</Text>
                    <ChevronRight size={20} color={COLORS.border} />
                </Pressable>

                <Pressable style={styles.toolRow} onPress={() => navigation.navigate('ScheduleList')}>
                    <View style={[styles.toolIconBg, { backgroundColor: COLORS.accent + '20' }]}>
                        <CalendarIcon size={20} color={COLORS.accent} />
                    </View>
                    <Text style={styles.toolTitle}>My Saved Schedules</Text>
                    <ChevronRight size={20} color={COLORS.border} />
                </Pressable>

                <Pressable style={styles.toolRow} onPress={() => navigation.navigate('GPACalculator')}>
                    <View style={[styles.toolIconBg, { backgroundColor: '#4CAF5020' }]}>
                        <GraduationCap size={20} color="#4CAF50" />
                    </View>
                    <Text style={styles.toolTitle}>GPA Calculator</Text>
                    <ChevronRight size={20} color={COLORS.border} />
                </Pressable>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Academic Status</Text>
                <View style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Registration Readiness</Text>
                        <Text style={[
                            styles.statusValue,
                            academicStatus?.registrationReady ? styles.statusValuePositive : styles.statusValueWarning,
                        ]}>
                            {academicStatus?.registrationReady ? 'Ready' : 'Needs attention'}
                        </Text>
                    </View>
                    <Text style={styles.statusHelper}>
                        {academicStatus?.activeHolds?.length
                            ? `Active holds: ${academicStatus.activeHolds.join(', ')}`
                            : 'No active holds are visible from your current academic state.'}
                    </Text>
                    <Text style={styles.statusHelper}>
                        GPA: {academicStatus?.gpa || 'Connect Howdy'} · Source: {academicStatus?.sourceLabel || 'Unavailable'}
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Connected Services</Text>
                <Text style={styles.sectionSubtext}>
                    Sign in once inside the app and we will reuse that browser session on this device while refreshing campus data from the page you land on.
                </Text>

                {connectorsLoading ? (
                    <View style={styles.connectorLoadingRow}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.connectorLoadingText}>Checking saved campus connections...</Text>
                    </View>
                ) : (
                    CONNECTOR_OPTIONS.map((item, index) => {
                        const connector = connectors.find(entry => entry.system_id === item.systemId);
                        const Icon = item.icon;
                        const status = connector?.status || 'disconnected';

                        return (
                            <Pressable
                                key={item.systemId}
                                style={[
                                    styles.connectorRow,
                                    index === CONNECTOR_OPTIONS.length - 1 && styles.connectorRowLast,
                                ]}
                                onPress={() => navigation.navigate('CampusConnector', {
                                    systemId: item.systemId,
                                    label: connector?.label || item.label,
                                    loginUrl: connector?.login_url,
                                    dataScope: connector?.data_scope,
                                    sourceUrl: connector?.source_url,
                                })}
                            >
                                <View style={[styles.toolIconBg, { backgroundColor: `${item.tint}18` }]}>
                                    <Icon size={20} color={item.tint} />
                                </View>
                                <View style={styles.connectorContent}>
                                    <View style={styles.connectorHeader}>
                                        <Text style={styles.connectorTitle}>{item.label}</Text>
                                        <View
                                            style={[
                                                styles.connectorBadge,
                                                status === 'connected'
                                                    ? styles.connectorBadgeConnected
                                                    : status === 'awaiting_login'
                                                        ? styles.connectorBadgePending
                                                        : styles.connectorBadgeDisconnected,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.connectorBadgeText,
                                                    status === 'connected'
                                                        ? styles.connectorBadgeTextConnected
                                                        : status === 'awaiting_login'
                                                            ? styles.connectorBadgeTextPending
                                                            : styles.connectorBadgeTextDisconnected,
                                                ]}
                                            >
                                                {getConnectorStatusLabel(status)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.connectorDescription} numberOfLines={2}>
                                        {getConnectorDescription(connector, item.description)}
                                    </Text>
                                </View>
                                <ChevronRight size={20} color={COLORS.border} />
                            </Pressable>
                        );
                    })
                )}
            </View>

            {/* Appearance Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Appearance</Text>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Application Theme</Text>
                    <View style={styles.segmentedRow}>
                        <Pressable
                            style={[styles.segmentBtn, theme === 'light' && styles.segmentBtnActive]}
                            onPress={() => setTheme('light')}
                        >
                            <Text style={[styles.segmentText, theme === 'light' && styles.segmentTextActive]}>Light</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.segmentBtn, theme === 'dark' && styles.segmentBtnActive]}
                            onPress={() => setTheme('dark')}
                        >
                            <Text style={[styles.segmentText, theme === 'dark' && styles.segmentTextActive]}>Dark</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Background Style</Text>
                    <View style={styles.segmentedRow}>
                        <Pressable
                            style={[styles.segmentBtn, useWallpaper && styles.segmentBtnActive]}
                            onPress={() => setUseWallpaper(true)}
                        >
                            <Text style={[styles.segmentText, useWallpaper && styles.segmentTextActive]}>Wallpaper</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.segmentBtn, !useWallpaper && styles.segmentBtnActive]}
                            onPress={() => setUseWallpaper(false)}
                        >
                            <Text style={[styles.segmentText, !useWallpaper && styles.segmentTextActive]}>Solid</Text>
                        </Pressable>
                    </View>
                    <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 4 }}>
                        {useWallpaper ? 'Marble wallpaper on supported pages' : `Solid ${theme === 'dark' ? 'black' : 'white'} background`}
                    </Text>
                </View>
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
            <PickerModal
                visible={pickerVisible === 'prefTime'}
                title="Preferred Time of Day"
                options={PREFERRED_TIME_OPTIONS}
                selectedValue={preferences.preferredTime}
                onSelect={handlePrefTimeSelect}
                onClose={() => setPickerVisible(null)}
            />
        </ScrollView>
    );
}

// ─── Reusable sub-components ─────────────────────────────────────────────

function DropdownField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
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
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
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
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
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
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
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

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    contentContainer: {
        padding: 16,
        paddingTop: 85,
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
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarWrapper: {
        position: 'relative',
    },
    cameraIconBadge: {
        position: 'absolute',
        bottom: 12,
        right: 0,
        backgroundColor: COLORS.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 3,
        borderColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
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
    sectionSubtext: {
        fontSize: 13,
        lineHeight: 19,
        color: COLORS.textSecondary,
        marginTop: -4,
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
    // Tools
    toolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    toolIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    toolTitle: {
        flex: 1,
        fontSize: 16,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    connectorLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
    },
    connectorLoadingText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    connectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    connectorRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    connectorContent: {
        flex: 1,
        gap: 6,
    },
    connectorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    connectorTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    connectorDescription: {
        fontSize: 13,
        lineHeight: 18,
        color: COLORS.textSecondary,
    },
    connectorBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    connectorBadgeConnected: {
        backgroundColor: '#1C7C5420',
    },
    connectorBadgePending: {
        backgroundColor: '#C9780020',
    },
    connectorBadgeDisconnected: {
        backgroundColor: COLORS.border,
    },
    connectorBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    connectorBadgeTextConnected: {
        color: '#1C7C54',
    },
    connectorBadgeTextPending: {
        color: '#A45F00',
    },
    connectorBadgeTextDisconnected: {
        color: COLORS.textSecondary,
    },
    statusCard: {
        gap: 10,
        backgroundColor: COLORS.surfaceElevated || COLORS.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    statusLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    statusValue: {
        fontSize: 13,
        fontWeight: '800',
    },
    statusValuePositive: {
        color: '#1C7C54',
    },
    statusValueWarning: {
        color: '#A45F00',
    },
    statusHelper: {
        fontSize: 13,
        lineHeight: 18,
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
    // Segmented control (max credits)
    segmentedRow: {
        flexDirection: 'row',
        gap: 8,
    },
    segmentBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentBtnActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    segmentText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    segmentTextActive: {
        color: '#FFFFFF',
    },
});
