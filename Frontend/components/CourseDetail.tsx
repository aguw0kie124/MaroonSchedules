import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ArrowLeft, MapPin, User, Clock, BookOpen } from 'lucide-react-native';
import { Button } from './Button';
import { useCourseStore } from '../store/courseStore';
import { fetchSectionById } from '../api/client';

// Define Param List for Type Safety (Optional but good)
type RootStackParamList = {
    CourseDetail: { id: string };
};

type CourseDetailRouteProp = RouteProp<RootStackParamList, 'CourseDetail'>;

// Replaced static array with dynamic loading

const COLORS = {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    primary: '#500000',
    textSecondary: '#666',
    textPrimary: '#000',
    border: '#E0E0E0',
};

export function CourseDetail() {
    const route = useRoute<CourseDetailRouteProp>();
    const navigation = useNavigation<any>();
    const { courses, addCourse, saveCourse, savedCourses } = useCourseStore();

    const { id } = route.params || {};

    const [section, setSection] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadSection();
    }, [id]);

    const loadSection = async () => {
        try {
            const res = await fetchSectionById(id);
            setSection(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!section) {
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', marginTop: 40, color: COLORS.textPrimary }}>Course Section not found.</Text>
            </View>
        );
    }

    // Because this isn't adding courses anymore, this logic might be unutilized but kept to compile
    const isAdded = false;
    const isSaved = false;

    const handleAddToSchedule = () => {};
    const handleSaveForLater = () => {};

    const meeting = section.meetings?.[0];
    const timeStr = meeting?.beginTime ? `${meeting.beginTime} - ${meeting.endTime}` : 'Time TBA';
    const daysStr = meeting?.daysOfWeek?.length ? meeting.daysOfWeek.join('') : 'Days TBA';
    const locationStr = meeting?.building ? `${meeting.building} ${meeting.room || ''}`.trim() : 'Location TBA';
    const prof = section.instructors?.[0];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={COLORS.textPrimary} />
                </Pressable>

                <Text style={styles.title}>{section.courseTitle || `${section.dept} ${section.courseNumber}`}</Text>
                <Text style={styles.subtitle}>{section.dept} {section.courseNumber} - Section {section.sectionNumber || section.section || section.id}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Info Card */}
                <View style={styles.card}>
                    <InfoRow icon={BookOpen} label="Credits" value={`${section.creditHours || 3} credits`} />
                    <InfoRow icon={User} label="Professor" value={prof?.name || 'TBA'} />
                    <InfoRow icon={MapPin} label="Location" value={locationStr} />
                    <InfoRow
                        icon={Clock}
                        label="Meeting Times"
                        value={`${daysStr} @ ${timeStr}`}
                    />
                    {section.prerequisites && (
                        <InfoRow icon={BookOpen} label="Prerequisites" value={section.prerequisites} />
                    )}
                </View>

                {/* Description */}
                {(section.courseDescription || section.description) && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Description</Text>
                        <Text style={styles.description}>
                            {section.courseDescription || section.description}
                        </Text>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
                <Button
                    variant="primary"
                    style={styles.button}
                    onPress={handleAddToSchedule}
                // disabled={isAdded} // Button handles opacity? or need customization
                >
                    {isAdded ? 'Added to Schedule' : 'Add to Schedule'}
                </Button>
                <Button
                    variant="secondary"
                    style={styles.button}
                    onPress={handleSaveForLater}
                >
                    {isSaved ? 'Saved' : 'Save for Later'}
                </Button>
            </View>
        </View>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <View style={styles.infoRow}>
            <Icon size={20} color={COLORS.textSecondary} style={styles.icon} />
            <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: 16,
        paddingTop: 60, // Safe area
        backgroundColor: COLORS.surface,
        paddingBottom: 24,
        marginBottom: 16,
    },
    backButton: {
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 0,
        gap: 16,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        gap: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        color: COLORS.textSecondary,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    icon: {
        marginTop: 2,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        padding: 16,
        paddingBottom: 32,
        gap: 12,
    },
    button: {
        width: '100%',
    },
});
