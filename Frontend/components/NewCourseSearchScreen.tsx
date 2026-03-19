import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search as SearchIcon, ChevronRight } from 'lucide-react-native';
import { fetchCourses } from '../api/client';
import { COLORS } from './SharedUI';

export function NewCourseSearchScreen() {
    const navigation = useNavigation<any>();
    const [query, setQuery] = useState('');
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (query.trim().length > 2) {
                handleSearch();
            } else if (query.length === 0) {
                setCourses([]);
            }
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const parts = query.trim().split(' ');
            let params: any = {};
            if (parts.length > 1) {
                params.dept = parts[0];
                params.course_number = parts[1];
            } else if (parts.length === 1 && parts[0]) {
                params.dept = parts[0];
            }

            const res = await fetchCourses(params);
            setCourses(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <Pressable 
            style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('NewCourseDetail', { courseId: item.id })}
        >
            <View style={styles.cardContent}>
                <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{item.code.split(' ')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.courseCode}>{item.code}</Text>
                    <Text style={styles.courseName}>{item.name}</Text>
                    <Text style={styles.courseCredits}>{item.credits || 3} Credits</Text>
                </View>
                <ChevronRight color={COLORS.textSecondary} size={20} />
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Search</Text>
                <View style={styles.searchBar}>
                    <SearchIcon color={COLORS.textSecondary} size={20} style={{marginRight: 8}} />
                    <TextInput 
                        style={styles.searchInput} 
                        placeholder="Search courses (e.g. CSCE 110)" 
                        placeholderTextColor={COLORS.textSecondary}
                        value={query}
                        onChangeText={setQuery}
                        autoCorrect={false}
                        autoCapitalize="characters"
                        clearButtonMode="while-editing"
                    />
                </View>
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }}/>
            ) : (
                <FlatList 
                    data={courses}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        query.trim().length > 2 ? (
                            <Text style={styles.emptyText}>No courses found matching "{query}".</Text>
                        ) : (
                            <View style={styles.emptyState}>
                                <SearchIcon color={COLORS.border} size={64} style={{marginBottom: 16}} />
                                <Text style={styles.emptyTextTitle}>Find Your Courses, Ag!</Text>
                                <Text style={styles.emptyText}>Type a department code and number to pull instantly from the live TAMU databases. Whoop!</Text>
                            </View>
                        )
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: COLORS.background 
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 16,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 10,
    },
    title: { 
        fontSize: 34, 
        fontWeight: '800', 
        letterSpacing: -1,
        marginBottom: 16, 
        color: COLORS.textPrimary 
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background, // iOS Search gray
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: { 
        flex: 1,
        fontSize: 17, 
        color: COLORS.textPrimary,
        height: '100%',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
        gap: 12,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    cardPressed: {
        backgroundColor: '#1E1E1E',
        transform: [{scale: 0.98}],
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardBadge: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#2A0000',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    cardBadgeText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
    },
    courseCode: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.5,
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    courseName: {
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    courseCredits: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
        paddingHorizontal: 32,
    },
    emptyTextTitle: {
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
    }
});
