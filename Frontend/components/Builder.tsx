import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { Card } from './Card';
import { useCourseStore } from '../store/courseStore';

type ViewMode = 'week' | 'list';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const dayMap: Record<string, string> = {
    M: 'Mon',
    T: 'Tue',
    W: 'Wed',
    Th: 'Thu',
    F: 'Fri',
};

const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm

const COLORS = {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    primary: '#500000',
    textSecondary: '#666',
    textPrimary: '#000',
    border: '#E0E0E0',
    danger: '#DC2626',
};

export function Builder() {
    const { courses, removeCourse } = useCourseStore();
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

    // Detect time conflicts
    const conflicts = detectConflicts(courses);
    const hasConflicts = conflicts.length > 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Schedule Builder</Text>

                <View style={styles.controls}>
                    {/* Term Selector (Mock) */}
                    <View style={styles.mockSelect}>
                        <Text style={styles.mockSelectText}>Spring 2026</Text>
                    </View>

                    {/* View Toggles */}
                    <View style={styles.toggleGroup}>
                        <Pressable
                            onPress={() => setViewMode('week')}
                            style={[styles.toggleButton, viewMode === 'week' && styles.toggleButtonActive]}
                        >
                            <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>Week</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setViewMode('list')}
                            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
                        >
                            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Conflict Banner */}
                {hasConflicts && (
                    <View style={styles.conflictBanner}>
                        <AlertTriangle size={20} color="white" style={styles.conflictIcon} />
                        <View style={styles.conflictTextContainer}>
                            <Text style={styles.conflictTitle}>Time Conflict Detected</Text>
                            <Text style={styles.conflictMessage}>{conflicts[0]}</Text>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.content}>
                {viewMode === 'week' ? (
                    <WeekView
                        courses={courses}
                        conflicts={conflicts}
                        selectedCourse={selectedCourse}
                        onSelectCourse={setSelectedCourse}
                        onRemoveCourse={removeCourse}
                    />
                ) : (
                    <ListView courses={courses} onRemoveCourse={removeCourse} />
                )}
            </View>
        </View>
    );
}

function WeekView({
    courses,
    conflicts,
    selectedCourse,
    onSelectCourse,
    onRemoveCourse,
}: any) {
    const { width } = useWindowDimensions();
    const TIME_COL_WIDTH = 50;
    // Fit precisely on screen with small padding (16px total horizontal padding)
    // If width is very small, we might want a minimum, but request was to "fit on screen"
    const GRID_WIDTH = width - 32;
    const DAY_COL_WIDTH = (GRID_WIDTH - TIME_COL_WIDTH) / 5;

    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16 }}>
            <View style={{ width: GRID_WIDTH }}>
                {/* Day Headers */}
                <View style={styles.gridHeader}>
                    <View style={{ width: TIME_COL_WIDTH }} />
                    {days.map((day) => (
                        <View key={day} style={{ width: DAY_COL_WIDTH, alignItems: 'center' }}>
                            <Text style={styles.dayHeaderText}>{day}</Text>
                        </View>
                    ))}
                </View>

                {/* Grid */}
                <View style={styles.gridBody}>
                    {hours.map((hour) => (
                        <View key={hour} style={styles.gridRow}>
                            <View style={[styles.timeSlot, { width: TIME_COL_WIDTH }]}>
                                <Text style={styles.timeText}>
                                    {hour > 12 ? hour - 12 : hour}
                                    {hour >= 12 ? 'pm' : 'am'}
                                </Text>
                            </View>
                            {days.map((day) => (
                                <View
                                    key={day}
                                    style={[styles.gridCell, { width: DAY_COL_WIDTH }]}
                                />
                            ))}
                        </View>
                    ))}

                    {/* Course Blocks */}
                    {courses.map((course: any) =>
                        course.days.map((day: string) => {
                            const dayIndex = days.indexOf(dayMap[day]);
                            if (dayIndex === -1) return null;

                            const topOffset = ((course.startTime - 480) / 60) * ROW_HEIGHT;
                            const height = ((course.endTime - course.startTime) / 60) * ROW_HEIGHT;
                            const hasConflict = conflicts.some((c: string) => c.includes(course.code));

                            return (
                                <Pressable
                                    key={`${course.id}-${day}`}
                                    onPress={() => onSelectCourse(course.id)}
                                    style={[
                                        styles.courseBlock,
                                        {
                                            left: TIME_COL_WIDTH + dayIndex * DAY_COL_WIDTH + 2,
                                            top: topOffset, // Adjust topOffset based on row height constant
                                            width: DAY_COL_WIDTH - 4,
                                            height: height,
                                            backgroundColor: course.color,
                                            borderColor: hasConflict ? COLORS.danger : 'transparent',
                                            borderWidth: hasConflict ? 2 : 0,
                                        },
                                    ]}
                                >
                                    <Text style={styles.blockCode} numberOfLines={1}>{course.code}</Text>
                                    <Text style={styles.blockText} numberOfLines={1}>{course.location}</Text>
                                    <Text style={styles.blockText} numberOfLines={1}>{course.time}</Text>

                                    {hasConflict && (
                                        <AlertTriangle size={12} color="white" style={styles.blockConflictIcon} />
                                    )}

                                    {selectedCourse === course.id && (
                                        <Pressable
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                onRemoveCourse(course.id);
                                                onSelectCourse(null);
                                            }}
                                            style={styles.removeBlockButton}
                                        >
                                            <X size={12} color="white" />
                                        </Pressable>
                                    )}
                                </Pressable>
                            );
                        })
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

// ListView Function (unchanged start)
function ListView({ courses, onRemoveCourse }: any) {
    return (
        <ScrollView contentContainerStyle={styles.listContent}>
            {courses.length > 0 ? (
                courses.map((course: any) => (
                    <Card key={course.id} style={styles.listCard}>
                        <View style={styles.listCardContent}>
                            <View
                                style={[styles.colorStrip, { backgroundColor: course.color }]}
                            />
                            <View style={styles.listInfo}>
                                <Text style={styles.listCode}>{course.code}</Text>
                                <Text style={styles.listName}>{course.name}</Text>
                                <View style={styles.listMeta}>
                                    <Text style={styles.listMetaText}>
                                        {course.days.join('')} {course.time}
                                    </Text>
                                    <Text style={styles.bullet}>•</Text>
                                    <Text style={styles.listMetaText}>{course.location}</Text>
                                </View>
                            </View>
                            <Pressable
                                onPress={() => onRemoveCourse(course.id)}
                                style={styles.listRemoveButton}
                            >
                                <X size={16} color={COLORS.danger} />
                            </Pressable>
                        </View>
                    </Card>
                ))
            ) : (
                <Card>
                    <Text style={styles.emptyText}>
                        No courses added yet. Go to Search to add courses.
                    </Text>
                </Card>
            )}
            <View style={{ height: 80 }} />
        </ScrollView>
    );
}

function detectConflicts(courses: any[]) {
    const conflicts: string[] = [];

    for (let i = 0; i < courses.length; i++) {
        for (let j = i + 1; j < courses.length; j++) {
            const c1 = courses[i];
            const c2 = courses[j];

            // Check if they share any days
            const sharedDays = c1.days.filter((d: string) => c2.days.includes(d));

            if (sharedDays.length > 0) {
                // Check time overlap
                if (
                    (c1.startTime < c2.endTime && c1.endTime > c2.startTime) ||
                    (c2.startTime < c1.endTime && c2.endTime > c1.startTime)
                ) {
                    conflicts.push(`${c1.code} overlaps with ${c2.code}`);
                }
            }
        }
    }

    return conflicts;
}

const ROW_HEIGHT = 64;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: 16,
        paddingTop: 60,
        backgroundColor: COLORS.background, // Match container
        zIndex: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        color: COLORS.textPrimary,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    mockSelect: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    mockSelectText: {
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    toggleGroup: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 4,
    },
    toggleButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 6,
    },
    toggleButtonActive: {
        backgroundColor: COLORS.primary,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    toggleTextActive: {
        color: 'white',
    },
    conflictBanner: {
        backgroundColor: COLORS.danger,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    conflictIcon: {
        marginTop: 2,
    },
    conflictTextContainer: {
        flex: 1,
    },
    conflictTitle: {
        color: 'white',
        fontWeight: '600',
        marginBottom: 4,
    },
    conflictMessage: {
        color: 'white',
        opacity: 0.9,
        fontSize: 12,
    },
    content: {
        flex: 1,
    },
    // Grid Styles
    gridHeader: {
        flexDirection: 'row',
        paddingBottom: 8,
    },
    dayHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    gridBody: {
        position: 'relative',
    },
    gridRow: {
        flexDirection: 'row',
        height: ROW_HEIGHT,
    },
    timeSlot: {
        alignItems: 'flex-end',
        paddingRight: 8,
        paddingTop: 0, // Align with top border line
    },
    timeText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        transform: [{ translateY: -6 }], // Center vertically on line roughly
    },
    gridCell: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    // Course Block Styles
    courseBlock: {
        position: 'absolute',
        borderRadius: 8,
        padding: 4,
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    blockCode: {
        fontSize: 10,
        fontWeight: '700',
        color: 'white',
    },
    blockText: {
        fontSize: 8,
        color: 'white',
        opacity: 0.9,
    },
    blockConflictIcon: {
        position: 'absolute',
        top: 4,
        right: 4,
    },
    removeBlockButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.danger,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
    },
    // List View Styles
    listContent: {
        padding: 16,
        gap: 12,
    },
    listCard: {
        padding: 0,
        overflow: 'hidden',
    },
    listCardContent: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    colorStrip: {
        width: 6,
        height: 50,
        borderRadius: 3,
    },
    listInfo: {
        flex: 1,
    },
    listCode: {
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    listName: {
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: 8,
    },
    listMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    listMetaText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    bullet: {
        color: COLORS.textSecondary,
    },
    listRemoveButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        padding: 16,
    },
});
