// Frontend/components/ProfDetailScreen.tsx
// Per-professor grade detail page — navigated to from GradesScreen's prof list.
// Shows: aggregated bar chart + scrollable section history + professor reviews.

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    StyleSheet,
    useWindowDimensions,
    SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Star, Calendar, Users, ChevronRight, TrendingUp } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { gpaColor } from '../utils/grades';
import { requestJson } from '../api/client';
import { ProfSummary, InstructorSectionStat } from '../types/grades';

// ── Helpers ─────────────────────────────────────────────────────

function ratingColor(r: number) {
    return r >= 4.0 ? '#30D158' : r >= 3.0 ? '#64D2FF' : r >= 2.0 ? '#FF9F0A' : '#FF453A';
}

// ── GPA bar chart by year (per-section data) ──
function GpaTimelineChart({
    sections,
    COLORS,
    chartWidth,
}: {
    sections: InstructorSectionStat[];
    COLORS: any;
    chartWidth: number;
}) {
    if (!sections || sections.length === 0) return null;
    const byYear = new Map<number, { total: number; weightedSum: number }>();
    for (const s of sections) {
        if (!s.year || !s.avgGpa) continue;
        const cur = byYear.get(s.year) || { total: 0, weightedSum: 0 };
        cur.total += s.enrollment || 1;
        cur.weightedSum += s.avgGpa * (s.enrollment || 1);
        byYear.set(s.year, cur);
    }
    const data = [...byYear.entries()]
        .map(([year, v]) => ({ year, avgGpa: v.total > 0 ? v.weightedSum / v.total : 0 }))
        .sort((a, b) => a.year - b.year);
    if (data.length === 0) return null;
    const maxGpa = 4.0;
    const minGpa = Math.max(0, Math.min(...data.map(d => d.avgGpa)) - 0.3);
    const range = maxGpa - minGpa || 1;
    const BAR_MAX_HEIGHT = 80;
    const GAP = 4;
    const innerWidth = chartWidth - 28;
    const barW = Math.max(16, (innerWidth - GAP * (data.length - 1)) / data.length);
    return (
        <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TrendingUp size={14} color={COLORS.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 0.8 }}>GPA BY YEAR</Text>
            </View>
            <View style={{
                backgroundColor: COLORS.surfaceElevated,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
            }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: GAP, height: BAR_MAX_HEIGHT + 36, paddingBottom: 4 }}>
                        {data.map(({ year, avgGpa }) => {
                            const barH = Math.max(10, ((avgGpa - minGpa) / range) * BAR_MAX_HEIGHT);
                            const color = avgGpa >= 3.5 ? '#30D158' : avgGpa >= 3.0 ? '#64D2FF' : avgGpa >= 2.5 ? '#FF9F0A' : '#FF453A';
                            return (
                                <View key={year} style={{ width: barW, alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <Text style={{ fontSize: 9, fontWeight: '700', color, marginBottom: 3 }}>{avgGpa.toFixed(2)}</Text>
                                    <View style={{ width: barW * 0.75, height: barH, backgroundColor: color, borderRadius: 4 }} />
                                    <Text style={{ fontSize: 9, color: COLORS.textTertiary, marginTop: 4 }}>{year}</Text>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
                <Text style={{ fontSize: 10, color: COLORS.textTertiary, textAlign: 'right', marginTop: 4 }}>Y-axis: GPA · X-axis: year</Text>
            </View>
        </View>
    );
}

// ── Sub-components ───────────────────────────────────────────────

function GradeBar({
    label,
    count,
    total,
    color,
    COLORS,
}: {
    label: string;
    count: number;
    total: number;
    color: string;
    COLORS: any;
}) {
    const pct = total > 0 ? Math.min((count / total) * 100, 100) : 0;
    return (
        <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: COLORS.textSecondary, fontWeight: '700', width: 20, fontSize: 13 }}>
                    {label}
                </Text>
                <Text style={{ color: COLORS.textPrimary, fontWeight: '600', flex: 1, paddingLeft: 8, fontSize: 13 }}>
                    {count} students
                </Text>
                <Text style={{ color, fontWeight: '700', fontSize: 13 }}>
                    {pct.toFixed(1)}%
                </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: COLORS.border }}>
                <View style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: color,
                    width: `${pct}%`,
                }} />
            </View>
        </View>
    );
}

function SectionHistoryCard({
    section,
    COLORS,
}: {
    section: InstructorSectionStat;
    COLORS: any;
}) {
    const accentGpa = gpaColor(section.avgGpa);
    return (
        <View style={{
            backgroundColor: COLORS.surface,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textPrimary }}>
                        Sec {section.section} · {section.semester} {section.year}
                    </Text>
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                        {section.enrollment} enrolled
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: accentGpa, letterSpacing: -0.5 }}>
                        {section.avgGpa.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 10, color: COLORS.textTertiary }}>avg GPA</Text>
                </View>
            </View>
            {/* Mini distribution */}
            <Text style={{ fontSize: 12, fontWeight: '600' }}>
                <Text style={{ color: '#30D158' }}>A: {section.percentA.toFixed(0)}%</Text>
                {'  '}
                <Text style={{ color: '#64D2FF' }}>B: {section.percentB.toFixed(0)}%</Text>
                {'  '}
                <Text style={{ color: '#FF9F0A' }}>C: {section.percentC.toFixed(0)}%</Text>
                {'  '}
                <Text style={{ color: '#FF6B35' }}>D: {section.percentD.toFixed(0)}%</Text>
                {'  '}
                <Text style={{ color: '#FF453A' }}>F: {section.percentF.toFixed(0)}%</Text>
            </Text>
        </View>
    );
}

// ── Main Screen ──────────────────────────────────────────────────

export function ProfDetailScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { width: screenWidth } = useWindowDimensions();

    const {
        prof,
        subject,
        courseNum,
        profRating: initialRating,
    }: {
        prof: ProfSummary;
        subject: string;
        courseNum: string;
        profRating?: { overall_rating?: number; total_reviews?: number };
    } = route.params;

    const [profData, setProfData] = useState<any>(null);
    const [loadingProf, setLoadingProf] = useState(false);
    const [showReviews, setShowReviews] = useState(false);

    // Sort sections newest first
    const sections = [...prof.sections].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const order: Record<string, number> = { FALL: 0, SUMMER: 1, SPRING: 2 };
        return (order[a.semester] ?? 3) - (order[b.semester] ?? 3);
    });

    useEffect(() => {
        if (!prof.instructor || prof.instructor === 'STAFF') return;
        setLoadingProf(true);
        const searchName = prof.instructor.split(',')[0]?.trim() || prof.instructor;
        requestJson(`/professors/search?name=${encodeURIComponent(searchName)}`)
            .then((data: any) => setProfData(data))
            .catch(() => {})
            .finally(() => setLoadingProf(false));
    }, [prof.instructor]);

    const overallRating = profData?.overall_rating ?? initialRating?.overall_rating;
    const totalReviews = profData?.total_reviews ?? initialRating?.total_reviews;
    const wouldTakeAgain = profData?.would_take_again_percent;
    const reviews = profData?.reviews || [];
    const accentGpa = gpaColor(prof.avgGpa);

    const grades = [
        { label: 'A', count: prof.a_count, color: '#30D158' },
        { label: 'B', count: prof.b_count, color: '#64D2FF' },
        { label: 'C', count: prof.c_count, color: '#FF9F0A' },
        { label: 'D', count: prof.d_count, color: '#FF6B35' },
        { label: 'F', count: prof.f_count, color: '#FF453A' },
        { label: 'I', count: prof.i_count, color: '#8E8E93' },
        { label: 'Q', count: prof.q_count, color: '#636366' },
        { label: 'S', count: prof.s_count, color: '#30D158' },
        { label: 'U', count: prof.u_count, color: '#FF453A' },
        { label: 'X', count: prof.x_count, color: '#8E8E93' },
    ].filter(g => g.count > 0);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

                {/* ── Prof header card ── */}
                <View style={styles.headerCard}>
                    <Text style={styles.profName}>{prof.instructor || 'STAFF'}</Text>
                    <Text style={styles.courseLabel}>
                        {subject.toUpperCase()} {courseNum} · {prof.sectionCount} section{prof.sectionCount !== 1 ? 's' : ''}
                    </Text>

                    {/* Rating row */}
                    {overallRating != null && overallRating > 0 && (
                        <View style={{ marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Star size={18} color="#FFD60A" fill="#FFD60A" />
                                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textPrimary }}>
                                    {overallRating.toFixed(1)} / 5.0
                                </Text>
                                {totalReviews != null && totalReviews > 0 && (
                                    <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                                        ({totalReviews} reviews)
                                    </Text>
                                )}
                            </View>
                            {wouldTakeAgain != null && wouldTakeAgain > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                    <View style={{ height: 6, flex: 1, borderRadius: 3, backgroundColor: COLORS.border }}>
                                        <View style={{
                                            height: 6, borderRadius: 3,
                                            backgroundColor: '#30D158',
                                            width: `${Math.min(wouldTakeAgain, 100)}%`,
                                        }} />
                                    </View>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#30D158' }}>
                                        {wouldTakeAgain.toFixed(0)}% would take again
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                    {loadingProf && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={{ color: COLORS.textTertiary, fontSize: 12 }}>Loading professor data…</Text>
                        </View>
                    )}
                </View>

                {/* ── Overall GPA badge ── */}
                <View style={[styles.gpaBadge, { backgroundColor: accentGpa + '18' }]}>
                    <Text style={[styles.gpaText, { color: accentGpa }]}>{prof.avgGpa.toFixed(3)}</Text>
                    <Text style={{ color: accentGpa, fontSize: 13, fontWeight: '600' }}>
                        Average GPA · {prof.totalStudents.toLocaleString()} total students
                    </Text>
                </View>

                {/* ── GPA by year chart ── */}
                <GpaTimelineChart sections={prof.sections} COLORS={COLORS} chartWidth={screenWidth - 32} />

                {/* ── Grade Distribution Chart ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>GRADE DISTRIBUTION</Text>
                    {grades.map(g => (
                        <GradeBar
                            key={g.label}
                            label={g.label}
                            count={g.count}
                            total={prof.totalStudents}
                            color={g.color}
                            COLORS={COLORS}
                        />
                    ))}
                </View>

                {/* ── Section History ── */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={styles.sectionTitle}>SECTION HISTORY</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Calendar size={13} color={COLORS.textTertiary} />
                            <Text style={{ fontSize: 12, color: COLORS.textTertiary }}>{sections.length} sections</Text>
                        </View>
                    </View>
                    {sections.map((sec, idx) => (
                        <SectionHistoryCard key={`${sec.term_code}_${sec.section}_${idx}`} section={sec} COLORS={COLORS} />
                    ))}
                </View>

                {/* ── Schedule planner link ── */}
                <Pressable
                    onPress={() => navigation.navigate('ScheduleList')}
                    style={({ pressed }) => [styles.plannerBtn, pressed && { opacity: 0.75 }]}
                >
                    <Calendar size={16} color={COLORS.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary, flex: 1 }}>
                        Open Schedule Planner
                    </Text>
                    <ChevronRight size={16} color={COLORS.primary} />
                </Pressable>

                {/* ── Written Reviews ── */}
                {reviews.length > 0 && (
                    <View style={styles.section}>
                        {!showReviews ? (
                            <Pressable
                                onPress={() => setShowReviews(true)}
                                style={({ pressed }) => ({
                                    backgroundColor: pressed ? COLORS.primary + '30' : COLORS.primary + '15',
                                    borderRadius: 12,
                                    paddingVertical: 14,
                                    paddingHorizontal: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    borderWidth: 1,
                                    borderColor: COLORS.primary + '30',
                                })}
                            >
                                <Star size={16} color={COLORS.primary} />
                                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>
                                    View Written Reviews ({Math.min(reviews.length, 10)})
                                </Text>
                            </Pressable>
                        ) : (
                            <>
                                <Text style={styles.sectionTitle}>STUDENT REVIEWS ({Math.min(reviews.length, 10)})</Text>
                                {reviews.slice(0, 10).map((review: any, idx: number) => {
                                    const revRating = review.overall_rating || 0;
                                    const revColor = ratingColor(revRating);
                                    const reviewDate = review.review_date
                                        ? new Date(review.review_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                        : '';
                                    return (
                                        <View key={review.id || idx} style={{
                                            backgroundColor: COLORS.surface,
                                            borderRadius: 12,
                                            padding: 12,
                                            marginBottom: 8,
                                            borderWidth: 1,
                                            borderColor: COLORS.border,
                                        }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <View style={{ backgroundColor: revColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '800', color: revColor }}>{revRating.toFixed(1)}</Text>
                                                    </View>
                                                    {review.grade && (
                                                        <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }}>Grade: {review.grade}</Text>
                                                    )}
                                                    {review.would_take_again != null && (
                                                        <Text style={{ fontSize: 11, color: review.would_take_again ? '#30D158' : '#FF453A' }}>
                                                            {review.would_take_again ? '✓ Would retake' : '✗ Wouldn\'t retake'}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Text style={{ fontSize: 11, color: COLORS.textTertiary }}>{reviewDate}</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 }}>
                                                {review.review_text}
                                            </Text>
                                            {review.tags && review.tags.length > 0 && (
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                                    {review.tags.map((tag: string, ti: number) => (
                                                        <View key={ti} style={{ backgroundColor: COLORS.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                                            <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.primary }}>{tag}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ───────────────────────────────────────────────────────

const getStyles = (COLORS: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    headerCard: {
        margin: 16,
        marginBottom: 8,
        backgroundColor: COLORS.surfaceElevated,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    profName: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    courseLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    gpaBadge: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
    },
    gpaText: {
        fontSize: 40,
        fontWeight: '800',
        letterSpacing: -1,
    },
    section: {
        marginHorizontal: 16,
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textTertiary,
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    plannerBtn: {
        marginHorizontal: 16,
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: COLORS.primary + '12',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
    },
});
