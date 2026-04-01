import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search as SearchIcon, SlidersHorizontal, Plus, Star } from 'lucide-react-native';
import { Chip } from './Chip';
import { Card } from './Card';
import { useCourseStore } from '../store/courseStore';

const availableCourses = [
    {
        id: '3',
        code: 'CSCE 310',
        name: 'Database Systems',
        credits: 3,
        professor: 'Dr. Williams',
        rating: 4.8,
        time: '09:00-10:15',
        days: ['T', 'Th'],
        location: 'HRBB 113',
        startTime: 540,
        endTime: 615,
        prerequisites: 'CSCE 221',
        description: 'Database design, SQL, and database management systems.',
        color: '#FFE5E5', // Adding color prop for consistency
    },
    {
        id: '4',
        code: 'CSCE 314',
        name: 'Programming Languages',
        credits: 3,
        professor: 'Dr. Anderson',
        rating: 4.5,
        time: '14:30-15:45',
        days: ['M', 'W', 'F'],
        location: 'ZACH 350',
        startTime: 870,
        endTime: 945,
        prerequisites: 'CSCE 221',
        description: 'Study of programming language concepts and paradigms.',
        color: '#E1BEE7',
    },
    {
        id: '5',
        code: 'ENGL 210',
        name: 'Technical Writing',
        credits: 3,
        professor: 'Dr. Martinez',
        rating: 4.3,
        time: '11:00-12:15',
        days: ['T', 'Th'],
        location: 'BLOCKER 166',
        startTime: 660,
        endTime: 735,
        description: 'Professional and technical writing for engineers.',
        color: '#C5CAE9',
    },
    {
        id: '6',
        code: 'CSCE 441',
        name: 'Computer Graphics',
        credits: 3,
        professor: 'Dr. Chen',
        rating: 4.7,
        time: '15:00-16:15',
        days: ['M', 'W'],
        location: 'HRBB 124',
        startTime: 900,
        endTime: 975,
        prerequisites: 'CSCE 221, MATH 304',
        description: '3D graphics, rendering algorithms, and OpenGL programming.',
        color: '#BBDEFB',
    },
    {
        id: '7',
        code: 'CSCE 482',
        name: 'Senior Capstone Design',
        credits: 3,
        professor: 'Dr. Thompson',
        rating: 4.4,
        time: '16:30-18:00',
        days: ['M', 'W'],
        location: 'ZACH 590',
        startTime: 990,
        endTime: 1080,
        prerequisites: 'Senior standing',
        description: 'Team-based software development project.',
        color: '#F8BBD0',
    },
];

const filters = ['Core', 'Elective', 'Online', 'Morning', 'Afternoon'];

const COLORS = {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    primary: '#500000',
    border: '#E0E0E0',
    textPrimary: '#000',
    textSecondary: '#666',
    warning: '#F59E0B', // Standard warning color
};

export function Search() {
    const navigation = useNavigation<any>();
    const { addCourse, courses } = useCourseStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

    const toggleFilter = (filter: string) => {
        setSelectedFilters((prev) =>
            prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
        );
    };

    const filteredCourses = availableCourses.filter((course) => {
        const matchesSearch =
            searchQuery === '' ||
            course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.professor.toLowerCase().includes(searchQuery.toLowerCase());

        // Fix: Ensure we are checking against the id properly, converting if needed
        const isAlreadyAdded = courses.some((c) => c.id === course.id);

        return matchesSearch && !isAlreadyAdded;
    });

    const handleAddCourse = (course: typeof availableCourses[0]) => {
        // Add missing props if needed or cast
        addCourse({ ...course, color: course.color || '#E0E0E0' } as any);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                {/* Search Bar */}
                <View style={styles.searchBarContainer}>
                    <SearchIcon size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        placeholder="Search by course or professor"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={styles.searchInput}
                        placeholderTextColor={COLORS.textSecondary}
                    />
                    <Pressable style={styles.filterIcon}>
                        <SlidersHorizontal size={20} color={COLORS.textSecondary} />
                    </Pressable>
                </View>

                {/* Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                    {filters.map((filter) => (
                        <Chip
                            key={filter}
                            label={filter}
                            selected={selectedFilters.includes(filter)}
                            onPress={() => toggleFilter(filter)}
                        />
                    ))}
                </ScrollView>
            </View>

            {/* Search Results */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {filteredCourses.map((course) => (
                    <Card key={course.id} style={styles.card}>
                        <View style={styles.cardContent}>
                            <Pressable
                                style={styles.cardInfo}
                                onPress={() => navigation.navigate('CourseDetail', { id: course.id })}
                            >
                                <View style={styles.courseHeader}>
                                    <Text style={styles.courseCode}>{course.code}</Text>
                                    <Text style={styles.bullet}>•</Text>
                                    <Text style={styles.courseCredits}>{course.credits} credits</Text>
                                </View>

                                <Text style={styles.courseName}>{course.name}</Text>

                                <View style={styles.courseMeta}>
                                    <View style={styles.ratingContainer}>
                                        <Star size={14} color={COLORS.warning} fill={COLORS.warning} />
                                        <Text style={styles.ratingText}>{course.rating}</Text>
                                    </View>
                                    <Text style={styles.bullet}>•</Text>
                                    <Text style={styles.professor}>{course.professor}</Text>
                                </View>

                                <Text style={styles.timeInfo}>
                                    {course.days.join('')} {course.time}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => handleAddCourse(course)}
                                style={({ pressed }) => [
                                    styles.addButton,
                                    pressed && styles.addButtonPressed
                                ]}
                            >
                                <Plus size={20} color="white" strokeWidth={2.5} />
                            </Pressable>
                        </View>
                    </Card>
                ))}

                {filteredCourses.length === 0 && (
                    <Card>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'No courses found' : 'All available courses have been added'}
                        </Text>
                    </Card>
                )}

                {/* Spacer for bottom tabs */}
                <View style={{ height: 80 }} />
            </ScrollView>
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
        backgroundColor: COLORS.background,
        zIndex: 10,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12, // rounded-xl
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 48,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    filterIcon: {
        padding: 4,
    },
    filterScroll: {
        flexGrow: 0,
    },
    filterContent: {
        paddingRight: 16,
        gap: 8,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 0,
    },
    card: {
        marginBottom: 12,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    cardInfo: {
        flex: 1,
    },
    courseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    courseCode: {
        fontWeight: '600',
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    bullet: {
        color: COLORS.textSecondary,
    },
    courseCredits: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    courseName: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
        color: COLORS.textPrimary,
    },
    courseMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    professor: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    timeInfo: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonPressed: {
        transform: [{ scale: 0.95 }],
    },
    emptyText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        padding: 16,
    },
});
