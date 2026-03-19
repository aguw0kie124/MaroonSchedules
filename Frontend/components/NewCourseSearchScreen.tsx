import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchCourses } from '../api/client';
import { COLORS, Card, PrimaryButton } from './SharedUI';

export function NewCourseSearchScreen() {
    const navigation = useNavigation<any>();
    const [query, setQuery] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            handleSearch();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [query, subjectFilter]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            // parse free text
            const parts = query.trim().split(' ');
            let params: any = {};
            if (parts.length > 1) {
                params.dept = parts[0];
                params.course_number = parts[1];
            } else if (parts.length === 1 && parts[0]) {
                params.dept = parts[0]; // generic dept search
            }
            if (subjectFilter) params.dept = subjectFilter;

            const res = await fetchCourses(params);
            setCourses(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <Card>
            <Pressable onPress={() => navigation.navigate('NewCourseDetail', { courseId: item.id })}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{item.code} - {item.name}</Text>
                <Text style={{ color: COLORS.textSecondary }}>Credits: {item.credits || 3}</Text>
                <PrimaryButton 
                    title="View Sections" 
                    onPress={() => navigation.navigate('NewCourseDetail', { courseId: item.id })}
                    style={{ marginTop: 12, paddingVertical: 8 }}
                />
            </Pressable>
        </Card>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Search Courses</Text>
            <TextInput 
                style={styles.searchInput} 
                placeholder="Search courses (e.g. CSCE 110)" 
                placeholderTextColor="#000"
                value={query}
                onChangeText={setQuery}
            />
            <View style={styles.filterRow}>
                <TextInput 
                    style={styles.filterInput} 
                    placeholder="Subject (e.g. MATH)"
                    placeholderTextColor="#000" 
                    value={subjectFilter}
                    onChangeText={setSubjectFilter}
                />
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }}/>
            ) : (
                <FlatList 
                    data={courses}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No courses found.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: COLORS.textPrimary },
    searchInput: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, color: '#000' },
    filterRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
    filterInput: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border, color: '#000' },
    emptyText: { textAlign: 'center', marginTop: 20, color: COLORS.textSecondary }
});
