// Frontend/components/APEquivalencyScreen.tsx
// Searchable list of all TAMU AP Credit Equivalencies.
// Navigated to from:
//   - GradesScreen header "AP Credits" button (no filter)
//   - NewCourseDetailScreen prereq chip (initialFilter = "CSCE 121")

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    StyleSheet,
    SafeAreaView,
    Pressable,
    Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Search, X, GraduationCap, Star, ChevronRight } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { AP_EQUIVALENCIES, AP_EXAM_NAMES, type APEquivalency } from '../data/apEquivalencies';

// ── helpers ────────────────────────────────────────────────────

function scoreColor(score: number) {
    if (score <= 2) return '#FF453A';
    if (score === 3) return '#FF9F0A';
    if (score === 4) return '#64D2FF';
    return '#30D158';
}

// Group equivalencies by AP exam name (deduplicated per exam+score combination)
function groupByExam(items: APEquivalency[]): { exam: string; entries: APEquivalency[] }[] {
    const map = new Map<string, APEquivalency[]>();
    for (const item of items) {
        if (!map.has(item.apExam)) map.set(item.apExam, []);
        map.get(item.apExam)!.push(item);
    }
    return [...map.entries()].map(([exam, entries]) => ({ exam, entries }));
}

// ── sub-components ──────────────────────────────────────────────

function ScoreBadge({ score, COLORS }: { score: number; COLORS: any }) {
    const color = scoreColor(score);
    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            backgroundColor: color + '20',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
        }}>
            <Star size={10} color={color} fill={color} />
            <Text style={{ fontSize: 12, fontWeight: '800', color }}>{score}+</Text>
        </View>
    );
}

function ExamCard({
    exam,
    entries,
    COLORS,
    styles,
    highlightCourse,
}: {
    exam: string;
    entries: APEquivalency[];
    COLORS: any;
    styles: any;
    highlightCourse?: string;
}) {
    // Sort entries by score ascending
    const sorted = [...entries].sort((a, b) => a.apScore - b.apScore);

    return (
        <View style={styles.card}>
            {/* Exam name header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={[styles.iconBg]}>
                    <GraduationCap size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.examName}>{exam}</Text>
            </View>

            {/* One row per score band */}
            {sorted.map((entry, idx) => {
                const isHighlighted = highlightCourse
                    ? entry.tamuCourses.some(c => c.toUpperCase() === highlightCourse.toUpperCase())
                    : false;
                return (
                    <View
                        key={idx}
                        style={[
                            styles.scoreRow,
                            idx < sorted.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border },
                            isHighlighted && { backgroundColor: COLORS.primary + '12', borderRadius: 8, paddingHorizontal: 6 },
                        ]}
                    >
                        <ScoreBadge score={entry.apScore} COLORS={COLORS} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            {entry.tamuCourses.length > 0 ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {entry.tamuCourses.map(course => (
                                        <View
                                            key={course}
                                            style={[
                                                styles.coursePill,
                                                course.toUpperCase() === highlightCourse?.toUpperCase() && {
                                                    backgroundColor: COLORS.primary + '30',
                                                    borderColor: COLORS.primary,
                                                },
                                            ]}
                                        >
                                            <Text style={[
                                                styles.coursePillText,
                                                course.toUpperCase() === highlightCourse?.toUpperCase() && { color: COLORS.primary },
                                            ]}>
                                                {course}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontStyle: 'italic' }}>
                                    {entry.notes || 'No TAMU equivalency'}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.creditsText}>
                            {entry.credits > 0 ? `${entry.credits} cr` : '—'}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

// ── Main Screen ─────────────────────────────────────────────────

export function APEquivalencyScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const route = useRoute<any>();
    const navigation = useNavigation<any>();

    const initialFilter: string = route.params?.initialFilter || '';
    const [query, setQuery] = useState(initialFilter);

    // Derived: filter AP_EQUIVALENCIES by query (matches exam name OR tamu course)
    const filteredExams = useMemo(() => {
        const q = query.trim().toUpperCase();
        if (!q) return groupByExam(AP_EQUIVALENCIES);

        const matched = AP_EQUIVALENCIES.filter(e =>
            e.apExam.toUpperCase().includes(q) ||
            e.tamuCourses.some(c => c.toUpperCase().includes(q))
        );
        return groupByExam(matched);
    }, [query]);

    const highlightCourse = query.trim().toUpperCase();

    return (
        <SafeAreaView style={styles.container}>
            {/* Search bar */}
            <View style={styles.searchWrap}>
                <Search size={16} color={COLORS.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by exam or course (e.g. MATH 151)"
                    placeholderTextColor={COLORS.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    clearButtonMode="never"
                />
                {query.length > 0 && (
                    <Pressable onPress={() => setQuery('')} hitSlop={8}>
                        <X size={16} color={COLORS.textTertiary} />
                    </Pressable>
                )}
            </View>

            {/* Result count hint */}
            {query.trim().length > 0 && (
                <Text style={styles.resultHint}>
                    {filteredExams.length} exam{filteredExams.length !== 1 ? 's' : ''} matched
                </Text>
            )}

            <FlatList
                data={filteredExams}
                keyExtractor={item => item.exam}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, paddingTop: 8 }}
                renderItem={({ item }) => (
                    <ExamCard
                        exam={item.exam}
                        entries={item.entries}
                        COLORS={COLORS}
                        styles={styles}
                        highlightCourse={highlightCourse || undefined}
                    />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 60 }}>
                        <GraduationCap size={48} color={COLORS.textTertiary} />
                        <Text style={{ color: COLORS.textSecondary, marginTop: 12, fontSize: 15 }}>
                            No equivalencies found for "{query}"
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

// ── Styles ──────────────────────────────────────────────────────

const getStyles = (COLORS: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: COLORS.background,
        },
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 6,
            backgroundColor: COLORS.surfaceElevated,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 10 : 8,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        searchInput: {
            flex: 1,
            fontSize: 15,
            color: COLORS.textPrimary,
        },
        resultHint: {
            fontSize: 12,
            color: COLORS.textTertiary,
            marginHorizontal: 20,
            marginBottom: 4,
        },
        card: {
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
        },
        iconBg: {
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: COLORS.primary + '18',
            alignItems: 'center',
            justifyContent: 'center',
        },
        examName: {
            fontSize: 15,
            fontWeight: '700',
            color: COLORS.textPrimary,
            flex: 1,
            letterSpacing: -0.3,
        },
        scoreRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            gap: 4,
        },
        coursePill: {
            backgroundColor: COLORS.surfaceElevated,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        coursePillText: {
            fontSize: 12,
            fontWeight: '700',
            color: COLORS.textPrimary,
            letterSpacing: 0.2,
        },
        creditsText: {
            fontSize: 11,
            fontWeight: '600',
            color: COLORS.textTertiary,
            minWidth: 30,
            textAlign: 'right',
        },
    });
