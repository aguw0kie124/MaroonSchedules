import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
// Removed local Card import in favor of SharedUI Card
import { useCourseStore } from '../store/courseStore';
import { useUser } from '@clerk/clerk-expo';

const { width } = Dimensions.get('window');

import { COLORS, Card } from './SharedUI';

export function Dashboard() {
    const navigation = useNavigation<any>();
    const { courses } = useCourseStore();
    const { user } = useUser();

    const currentTerm = 'Spring 2026';
    const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
    const maxCredits = 15;

    // Get today's courses (modified logic to ensure safe array access)
    // Assuming 'days' is array of strings like ['M', 'W', 'F']
    const todaysCourses = courses.filter(course => course.days && course.days.includes('M'));

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Howdy, Ag!</Text>
                        <Text style={styles.name}>{user?.firstName || 'Aggie'}</Text>
                    </View>
                    <Pressable
                        style={styles.avatar}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <Text style={styles.avatarText}>
                            {user?.firstName?.[0] || 'A'}
                        </Text>
                    </Pressable>
                </View>

                {/* Current Term Card */}
                <Card style={styles.termCard}>
                    <Text style={styles.cardTitle}>{currentTerm}</Text>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressLabels}>
                            <Text style={styles.caption}>
                                {totalCredits} / {maxCredits} credits
                            </Text>
                            <Text style={[styles.caption, { color: COLORS.textPrimary, fontWeight: 'bold' }]}>
                                {maxCredits - totalCredits} remaining
                            </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${Math.min((totalCredits / maxCredits) * 100, 100)}%` },
                                ]}
                            />
                        </View>
                    </View>
                </Card>

                {/* Today's Classes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today</Text>
                    <View style={styles.courseList}>
                        {todaysCourses.length > 0 ? (
                            todaysCourses.map((course) => (
                                <Pressable
                                    key={course.id}
                                    onPress={() => navigation.navigate('CourseDetail', { id: course.id })}
                                    style={({ pressed }) => [
                                        styles.courseItem,
                                        pressed && styles.courseItemPressed,
                                    ]}
                                >
                                    <View style={[styles.colorStrip, { backgroundColor: course.color }]} />
                                    <View style={styles.courseInfo}>
                                        <Text style={styles.courseCode}>{course.code}</Text>
                                        <Text style={styles.courseName}>{course.name}</Text>
                                    </View>
                                    <View style={styles.timeBadge}>
                                        <Text style={styles.timeText}>{course.time}</Text>
                                    </View>
                                </Pressable>
                            ))
                        ) : (
                            <Card>
                                <Text style={styles.emptyText}>No classes today! Time to BTHO your homework. 👍</Text>
                            </Card>
                        )}
                    </View>
                </View>

                {/* Spacer for FAB */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Floating Action Button */}
            <Pressable
                onPress={() => navigation.navigate('Search')} // Assuming 'Search' is the route name
                style={({ pressed }) => [
                    styles.fab,
                    pressed && styles.fabPressed,
                ]}
            >
                <Plus size={28} color="#fff" strokeWidth={2.5} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 60, // Safe area padding
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    name: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    termCard: {
        marginBottom: 24,
        padding: 20,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: COLORS.textPrimary,
    },
    progressContainer: {
        gap: 8,
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    caption: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    progressBarBg: {
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: COLORS.textPrimary,
    },
    courseList: {
        gap: 12,
    },
    courseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: 16,
        borderRadius: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    courseItemPressed: {
        backgroundColor: '#1E1E1E',
        transform: [{ scale: 0.98 }],
    },
    colorStrip: {
        width: 6,
        height: 48,
        borderRadius: 3,
    },
    courseInfo: {
        flex: 1,
    },
    courseCode: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
        color: COLORS.textPrimary,
    },
    courseName: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    timeBadge: {
        backgroundColor: '#2A0000', // Matches primaryLight from SharedUI
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    timeText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        padding: 16,
    },
    fab: {
        position: 'absolute',
        bottom: 32, // bottom-24 -> ~96px / 3? adjusted for native
        right: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabPressed: {
        transform: [{ scale: 0.95 }],
    },
});
