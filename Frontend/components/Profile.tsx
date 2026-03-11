import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Switch, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LogOut } from 'lucide-react-native';

const COLORS = {
    background: '#F5F5F7',
    primary: '#500000',
    textSecondary: '#666',
    textPrimary: '#000',
    surface: '#FFFFFF',
    border: '#E0E0E0',
    danger: '#DC2626',
};

import { API_URL } from '../config';

export function Profile() {
    const navigation = useNavigation<any>();
    const [preferences, setPreferences] = useState({
        major: 'Computer Science',
        graduationYear: '2026',
        preferredTime: 'Morning',
        maxCredits: '15',
        avoidFriday: false,
        showOnlineFirst: true,
    });
    const [connectionStatus, setConnectionStatus] = useState<string>('Checking...');

    useEffect(() => {
        console.log(`Attempting to connect to: ${API_URL}/test_postgre`);
        fetch(`${API_URL}/test_postgre`)
            .then(res => res.json())
            .then(data => setConnectionStatus(`PostgreSQL Data: ${JSON.stringify(data)}`))
            .catch(err => {
                console.error("Connection error:", err);
                setConnectionStatus(`Error: ${err.message} \nURL: ${API_URL}/test_postgre`);
            });
    }, []);

    const handleLogout = () => {
        navigation.navigate('Onboarding'); // Or standard logout flow
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Profile & Preferences</Text>
            <Text style={{ textAlign: 'center', marginBottom: 20, color: COLORS.textSecondary }}>
                {connectionStatus}
            </Text>

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>R</Text>
                </View>
                <Text style={styles.name}>Ritej</Text>
                <Text style={styles.email}>ritej@tamu.edu</Text>
            </View>

            {/* Profile Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Information</Text>

                <InputField
                    label="Major"
                    value={preferences.major}
                    onChange={(value) => setPreferences({ ...preferences, major: value })}
                />

                <InputField
                    label="Graduation Year"
                    value={preferences.graduationYear}
                    onChange={(value) => setPreferences({ ...preferences, graduationYear: value })}
                />

                {/* Simplified Select as Text Input for now, or use Picker/Modal if available */}
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
        </ScrollView>
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
                thumbColor={'#fff'} // Always white thumb for typically
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
});
