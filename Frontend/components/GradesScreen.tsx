// Frontend/components/GradesScreen.tsx
// Grade-distribution search screen for the MaroonSchedules app.
//
// Shows: subject + course# search → summary card → section list → detail modal

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    Modal,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { BarChart2, X, ChevronRight, GraduationCap, Star, AlertCircle } from 'lucide-react-native';

import { useRoute } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { searchCourseGrades } from '../services/grades';
import { gpaColor } from '../utils/grades';
import { requestJson } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    CourseStats,
    GradeSearchResult,
    InstructorSectionStat,
} from '../types/grades';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

type ScreenState = 'idle' | 'loading' | 'results' | 'error';

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function GpaBar({
    label,
    percent,
    color,
    COLORS,
}: {
    label: string;
    percent: number;
    color: string;
    COLORS: any;
}) {
    return (
        <View style={{ marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
                <Text style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' }}>
                    {percent.toFixed(1)}%
                </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.border }}>
                <View
                    style={{
                        height: 6,
                        borderRadius: 3,
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: color,
                    }}
                />
            </View>
        </View>
    );
}

function CourseSummaryCard({
    stats,
    subject,
    courseNum,
    COLORS,
    styles,
}: {
    stats: CourseStats;
    subject: string;
    courseNum: string;
    COLORS: any;
    styles: any;
}) {
    const accentGpa = gpaColor(stats.avgGpa);
    return (
        <View style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.iconBg, { backgroundColor: '#50000018' }]}>
                    <GraduationCap size={20} color={COLORS.primary} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.summaryTitle}>
                        {subject.toUpperCase()} {courseNum}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                        {stats.totalStudents.toLocaleString()} students across all sections
                    </Text>
                </View>
                <View style={[styles.gpaBadge, { backgroundColor: accentGpa + '20' }]}>
                    <Text style={[styles.gpaBadgeText, { color: accentGpa }]}>
                        {stats.avgGpa.toFixed(2)}
                    </Text>
                    <Text style={{ color: accentGpa, fontSize: 10, fontWeight: '600' }}>GPA</Text>
                </View>
            </View>

            <GpaBar label="A" percent={stats.percentA} color="#30D158" COLORS={COLORS} />
            <GpaBar label="B" percent={stats.percentB} color="#64D2FF" COLORS={COLORS} />
            <GpaBar label="C" percent={stats.percentC} color="#FF9F0A" COLORS={COLORS} />
            <GpaBar label="D" percent={stats.percentD} color="#FF6B35" COLORS={COLORS} />
            <GpaBar label="F" percent={stats.percentF} color="#FF453A" COLORS={COLORS} />
            {stats.percentQ > 0 && (
                <GpaBar label="Q (Drop)" percent={stats.percentQ} color="#8E8E93" COLORS={COLORS} />
            )}
        </View>
    );
}

// Prerequisites card shown after course summary
function PrerequisitesCard({
    prerequisites,
    COLORS,
}: {
    prerequisites: string;
    COLORS: any;
}) {
    if (!prerequisites || prerequisites === 'None') return null;
    return (
        <View style={{
            marginHorizontal: 16,
            marginBottom: 8,
            backgroundColor: COLORS.surfaceElevated,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertCircle size={16} color="#FF9F0A" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.2 }}>
                    Prerequisites
                </Text>
            </View>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 }}>
                {prerequisites}
            </Text>
        </View>
    );
}

// Professor rating badge shown in section cards and detail modal
function RatingBadge({
    rating,
    reviews,
    COLORS,
    compact,
}: {
    rating?: number;
    reviews?: number;
    COLORS: any;
    compact?: boolean;
}) {
    if (!rating || rating <= 0) return null;
    const ratingColor = rating >= 4.0 ? '#30D158' : rating >= 3.0 ? '#64D2FF' : rating >= 2.0 ? '#FF9F0A' : '#FF453A';
    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: ratingColor + '18',
            paddingHorizontal: compact ? 6 : 8,
            paddingVertical: compact ? 3 : 4,
            borderRadius: 8,
        }}>
            <Star size={compact ? 10 : 12} color={ratingColor} fill={ratingColor} />
            <Text style={{ fontSize: compact ? 11 : 12, fontWeight: '700', color: ratingColor }}>
                {rating.toFixed(1)}
            </Text>
            {reviews != null && reviews > 0 && !compact && (
                <Text style={{ fontSize: 10, color: COLORS.textTertiary }}>
                    ({reviews})
                </Text>
            )}
        </View>
    );
}

function SectionCard({
    item,
    onPress,
    profRating,
    COLORS,
    styles,
}: {
    item: InstructorSectionStat;
    onPress: () => void;
    profRating?: { overall_rating?: number; total_reviews?: number };
    COLORS: any;
    styles: any;
}) {
    const accentGpa = gpaColor(item.avgGpa);
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.75 }]}
        >
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.instructorName}>{item.instructor || 'STAFF'}</Text>
                            <RatingBadge
                                rating={profRating?.overall_rating}
                                reviews={profRating?.total_reviews}
                                COLORS={COLORS}
                                compact
                            />
                        </View>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                            Sec {item.section} · {item.semester} {item.year} · {item.enrollment} enrolled
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={[styles.sectionGpa, { color: accentGpa }]}>
                            {item.avgGpa.toFixed(2)}
                        </Text>
                        <Text style={{ color: COLORS.textTertiary, fontSize: 10 }}>avg GPA</Text>
                    </View>
                </View>

                {/* Inline mini-distribution */}
                <Text style={[styles.miniDist, { marginTop: 8 }]}>
                    <Text style={{ color: '#30D158' }}>A: {item.percentA.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#64D2FF' }}>B: {item.percentB.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#FF9F0A' }}>C: {item.percentC.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#FF6B35' }}>D: {item.percentD.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#FF453A' }}>F: {item.percentF.toFixed(0)}%</Text>
                </Text>
            </View>
            <ChevronRight size={18} color={COLORS.textTertiary} style={{ marginLeft: 8, alignSelf: 'center' }} />
        </Pressable>
    );
}

function DetailModal({
    item,
    subject,
    courseNum,
    profRating,
    onClose,
    COLORS,
    styles,
}: {
    item: InstructorSectionStat | null;
    subject: string;
    courseNum: string;
    profRating?: { overall_rating?: number; total_reviews?: number };
    onClose: () => void;
    COLORS: any;
    styles: any;
}) {
    const [profData, setProfData] = useState<any>(null);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [showReviews, setShowReviews] = useState(false);

    // Auto-fetch professor data when modal opens to check if reviews exist
    useEffect(() => {
        setProfData(null);
        setShowReviews(false);
        setLoadingReviews(false);

        if (!item?.instructor || item.instructor === 'STAFF') return;
        setLoadingReviews(true);

        const nameParts = item.instructor.split(',');
        const searchName = nameParts[0]?.trim() || item.instructor;

        requestJson(`/professors/search?name=${encodeURIComponent(searchName)}`)
            .then((data: any) => setProfData(data))
            .catch(() => {})
            .finally(() => setLoadingReviews(false));
    }, [item?.instructor]);

    if (!item) return null;
    const accentGpa = gpaColor(item.avgGpa);

    const grades = [
        { label: 'A', count: item.a_count, color: '#30D158' },
        { label: 'B', count: item.b_count, color: '#64D2FF' },
        { label: 'C', count: item.c_count, color: '#FF9F0A' },
        { label: 'D', count: item.d_count, color: '#FF6B35' },
        { label: 'F', count: item.f_count, color: '#FF453A' },
        { label: 'I', count: item.i_count, color: '#8E8E93' },
        { label: 'Q', count: item.q_count, color: '#636366' },
        { label: 'S', count: item.s_count, color: '#30D158' },
        { label: 'U', count: item.u_count, color: '#FF453A' },
        { label: 'X', count: item.x_count, color: '#8E8E93' },
    ].filter(g => g.count > 0);

    const reviews = profData?.reviews || [];
    const overallRating = profData?.overall_rating || profRating?.overall_rating;
    const totalReviews = profData?.total_reviews || profRating?.total_reviews;
    const wouldTakeAgain = profData?.would_take_again_percent;

    const ratingColor = (r: number) =>
        r >= 4.0 ? '#30D158' : r >= 3.0 ? '#64D2FF' : r >= 2.0 ? '#FF9F0A' : '#FF453A';

    return (
        <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
                    <View style={styles.modalHandle} />

                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalTitle}>
                                {subject.toUpperCase()} {courseNum} · Sec {item.section}
                            </Text>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
                                {item.semester} {item.year} · Prof. {item.instructor}
                            </Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color={COLORS.textSecondary} />
                        </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Professor Rating Summary */}
                        {overallRating != null && overallRating > 0 && (
                            <View style={{
                                backgroundColor: COLORS.surface,
                                borderRadius: 14,
                                padding: 14,
                                marginBottom: 12,
                                borderWidth: 1,
                                borderColor: COLORS.border,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <Star size={20} color="#FFD60A" fill="#FFD60A" />
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textPrimary }}>
                                        {overallRating.toFixed(1)} / 5.0
                                    </Text>
                                    {totalReviews != null && totalReviews > 0 && (
                                        <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
                                            ({totalReviews} reviews)
                                        </Text>
                                    )}
                                </View>
                                {wouldTakeAgain != null && wouldTakeAgain > 0 && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                        <View style={{
                                            height: 6, flex: 1, borderRadius: 3,
                                            backgroundColor: COLORS.border,
                                        }}>
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
                                {profData?.overallSummary?.strengths && (
                                    <View style={{ marginTop: 10 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, marginBottom: 4, letterSpacing: 0.5 }}>
                                            STRENGTHS
                                        </Text>
                                        {profData.overallSummary.strengths.slice(0, 2).map((s: string, i: number) => (
                                            <Text key={i} style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 16, marginBottom: 2 }}>
                                                • {s.length > 120 ? s.slice(0, 120) + '…' : s}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* GPA badge */}
                        <View style={[styles.modalGpaBadge, { backgroundColor: accentGpa + '18' }]}>
                            <Text style={[styles.modalGpaText, { color: accentGpa }]}>
                                {item.avgGpa.toFixed(3)}
                            </Text>
                            <Text style={{ color: accentGpa, fontSize: 13, fontWeight: '600' }}>
                                Average GPA · {item.enrollment} students
                            </Text>
                        </View>

                        {/* Grade bars */}
                        <View style={{ marginTop: 16 }}>
                            {grades.map(g => (
                                <View key={g.label} style={{ marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ color: COLORS.textSecondary, fontWeight: '700', width: 24 }}>
                                            {g.label}
                                        </Text>
                                        <Text style={{ color: COLORS.textPrimary, fontWeight: '600', flex: 1, paddingLeft: 8 }}>
                                            {g.count} students
                                        </Text>
                                        <Text style={{ color: g.color, fontWeight: '700' }}>
                                            {item.enrollment > 0 ? ((g.count / item.enrollment) * 100).toFixed(1) : '0.0'}%
                                        </Text>
                                    </View>
                                    <View style={{ height: 8, borderRadius: 4, backgroundColor: COLORS.border }}>
                                        <View
                                            style={{
                                                height: 8,
                                                borderRadius: 4,
                                                backgroundColor: g.color,
                                                width: item.enrollment > 0
                                                    ? `${Math.min((g.count / item.enrollment) * 100, 100)}%`
                                                    : '0%',
                                            }}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Professor Reviews */}
                        {/* Professor Reviews Section */}
                        {item.instructor && item.instructor !== 'STAFF' && (
                            <>
                                {/* Loading state */}
                                {loadingReviews && (
                                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color={COLORS.primary} />
                                        <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginTop: 6 }}>Loading professor data…</Text>
                                    </View>
                                )}

                                {/* No reviews — show inline message, no button needed */}
                                {!loadingReviews && profData && reviews.length === 0 && (
                                    <View style={{
                                        marginTop: 16, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center',
                                        backgroundColor: COLORS.surface, borderRadius: 12,
                                        borderWidth: 1, borderColor: COLORS.border,
                                    }}>
                                        <Text style={{ color: COLORS.textTertiary, fontSize: 13 }}>
                                            No written reviews available for this professor.
                                        </Text>
                                        {profData.overall_rating != null && profData.overall_rating > 0 && (
                                            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 6 }}>
                                                Overall rating: {profData.overall_rating.toFixed(1)} / 5.0 ({profData.total_reviews || 0} ratings)
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* Has reviews but not expanded — show button */}
                                {!loadingReviews && reviews.length > 0 && !showReviews && (
                                    <Pressable
                                        onPress={() => setShowReviews(true)}
                                        style={({ pressed }) => ({
                                            marginTop: 16,
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
                                )}

                                {/* Reviews expanded */}
                                {showReviews && reviews.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={{
                                    fontSize: 13, fontWeight: '700', color: COLORS.textTertiary,
                                    letterSpacing: 0.5, marginBottom: 10,
                                }}>
                                    STUDENT REVIEWS ({Math.min(reviews.length, 10)})
                                </Text>
                                {reviews.slice(0, 10).map((review: any, idx: number) => {
                                    const revRating = review.overall_rating || 0;
                                    const revColor = ratingColor(revRating);
                                    const reviewDate = review.review_date
                                        ? new Date(review.review_date).toLocaleDateString('en-US', {
                                            month: 'short', year: 'numeric',
                                        })
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
                                            {/* Review header */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <View style={{
                                                        backgroundColor: revColor + '20',
                                                        paddingHorizontal: 8, paddingVertical: 3,
                                                        borderRadius: 6,
                                                    }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '800', color: revColor }}>
                                                            {revRating.toFixed(1)}
                                                        </Text>
                                                    </View>
                                                    {review.grade && (
                                                        <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }}>
                                                            Grade: {review.grade}
                                                        </Text>
                                                    )}
                                                    {review.would_take_again != null && (
                                                        <Text style={{ fontSize: 11, color: review.would_take_again ? '#30D158' : '#FF453A' }}>
                                                            {review.would_take_again ? '✓ Would retake' : '✗ Wouldn\'t retake'}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Text style={{ fontSize: 11, color: COLORS.textTertiary }}>{reviewDate}</Text>
                                            </View>

                                            {/* Review text */}
                                            <Text style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 }}>
                                                {review.review_text}
                                            </Text>

                                            {/* Tags */}
                                            {review.tags && review.tags.length > 0 && (
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                                    {review.tags.map((tag: string, ti: number) => (
                                                        <View key={ti} style={{
                                                            backgroundColor: COLORS.primary + '15',
                                                            paddingHorizontal: 8, paddingVertical: 3,
                                                            borderRadius: 6,
                                                        }}>
                                                            <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.primary }}>
                                                                {tag}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                            </>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

// ──────────────────────────────────────────────────────────────
// Main Screen
// ──────────────────────────────────────────────────────────────

const GRADES_STORAGE_KEY = 'grade-dist-last-search';

export function GradesScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);

    const route = useRoute<any>();
    const initialSubject = route?.params?.initialSubject || '';
    const initialCourseNum = route?.params?.initialCourseNum || '';

    const [subject, setSubject] = useState(initialSubject || '');
    const [courseNum, setCourseNum] = useState(initialCourseNum || '');
    // Snapshot of what was actually searched — won't change while typing new input
    const [searchedSubject, setSearchedSubject] = useState('');
    const [searchedCourseNum, setSearchedCourseNum] = useState('');
    const [screenState, setScreenState] = useState<ScreenState>('idle');
    const [result, setResult] = useState<GradeSearchResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedSection, setSelectedSection] = useState<InstructorSectionStat | null>(null);
    const [courseInfo, setCourseInfo] = useState<any>(null);
    const [profRatings, setProfRatings] = useState<Record<string, { overall_rating?: number; total_reviews?: number }>>({});
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);

    // Restore last search from storage on mount
    useEffect(() => {
        if (initialSubject && initialCourseNum) {
            performSearch(initialSubject, initialCourseNum);
            setRestoredFromStorage(true);
            return;
        }
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(GRADES_STORAGE_KEY);
                if (saved) {
                    const { subject: savedSubj, courseNum: savedNum } = JSON.parse(saved);
                    if (savedSubj && savedNum) {
                        setSubject(savedSubj);
                        setCourseNum(savedNum);
                        performSearch(savedSubj, savedNum);
                    }
                }
            } catch {}
            setRestoredFromStorage(true);
        })();
    }, []);

    const performSearch = async (subjInput: string, numInput: string) => {
        const subj = subjInput.trim().toUpperCase();
        const num = numInput.trim();
        if (!subj || !num) return;

        setScreenState('loading');
        setResult(null);
        setErrorMsg('');
        setSearchedSubject(subj);
        setSearchedCourseNum(num);

        // Save to storage for persistence
        AsyncStorage.setItem(GRADES_STORAGE_KEY, JSON.stringify({ subject: subj, courseNum: num })).catch(() => {});

        try {
            const data = await searchCourseGrades(subj, num);
            setResult(data);
            setScreenState('results');

            // Fetch course info for prerequisites + professor ratings
            try {
                const courseId = `${subj}${num}`.replace(/\s/g, '');
                const info = await requestJson(`/courses/${courseId}`);
                setCourseInfo(info);
                // Build professor rating map from sections
                const ratings: Record<string, { overall_rating?: number; total_reviews?: number }> = {};
                if (info?.sections) {
                    for (const sec of info.sections) {
                        for (const inst of (sec.instructors || [])) {
                            if (inst?.name && inst.overall_rating) {
                                // Normalize name for matching (grade data uses "LAST, F" format)
                                const name = inst.name.toUpperCase().trim();
                                ratings[name] = {
                                    overall_rating: inst.overall_rating,
                                    total_reviews: inst.total_reviews,
                                };
                            }
                        }
                    }
                }
                setProfRatings(ratings);
            } catch {
                // Course info is supplementary — don't block grade results
                setCourseInfo(null);
            }
        } catch (err: any) {
            const raw = err?.message ?? 'Unknown error';
            const isJsonParseNoise =
                typeof raw === 'string' &&
                (raw.includes('Expecting value:') ||
                    raw.includes('Expected value:') ||
                    /parse response as JSON/i.test(raw));
            setErrorMsg(isJsonParseNoise ? 'Sorry, class not found' : raw);
            setScreenState('error');
        }
    };

    const handleSearch = useCallback(() => {
        performSearch(subject, courseNum);
    }, [subject, courseNum]);

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <BarChart2 size={22} color={COLORS.primary} />
                        <Text style={styles.headerTitle}>Grade Distribution</Text>
                    </View>
                    <Text style={styles.headerSub}>Powered by anex.us · TAMU data</Text>
                </View>

                {/* ── Search inputs ── */}
                <View style={styles.searchRow}>
                    <TextInput
                        style={[styles.input, { flex: 1.2 }]}
                        placeholder="Subject"
                        placeholderTextColor={COLORS.textTertiary}
                        value={subject}
                        onChangeText={t => setSubject(t.toUpperCase())}
                        autoCapitalize="characters"
                        returnKeyType="next"
                    />
                    <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Number"
                        placeholderTextColor={COLORS.textTertiary}
                        value={courseNum}
                        onChangeText={setCourseNum}
                        keyboardType="default"
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    <Pressable
                        style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
                        onPress={handleSearch}
                    >
                        <Text style={styles.searchBtnText}>Search</Text>
                    </Pressable>
                </View>

                {/* ── States ── */}
                {screenState === 'loading' && (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={[styles.stateMsg, { marginTop: 12 }]}>
                            Fetching grade data…
                        </Text>
                    </View>
                )}

                {screenState === 'error' && (
                    <View style={styles.centered}>
                        <Text style={[styles.stateMsg, { color: COLORS.danger }]}>
                            ⚠ {errorMsg}
                        </Text>
                    </View>
                )}

                {screenState === 'idle' && (
                    <View style={styles.centered}>
                        <BarChart2 size={48} color={COLORS.textTertiary} />
                        <Text style={[styles.stateMsg, { marginTop: 12 }]}>
                            Enter a subject and course number{'\n'}to see grade distributions
                        </Text>
                        <Text style={[styles.stateMsg, { marginTop: 6, fontSize: 13 }]}>
                            e.g. CSCE · 121
                        </Text>
                    </View>
                )}

                {screenState === 'results' && result && (
                    <>
                        {result.rows.length === 0 ? (
                            <View style={styles.centered}>
                                <Text style={styles.stateMsg}>
                                    No data found for {searchedSubject} {searchedCourseNum}.{'\n'}
                                    Try a different course.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                contentContainerStyle={{ paddingBottom: 100 }}
                                ListHeaderComponent={
                                    <>
                                        <CourseSummaryCard
                                            stats={result.stats}
                                            subject={searchedSubject}
                                            courseNum={searchedCourseNum}
                                            COLORS={COLORS}
                                            styles={styles}
                                        />
                                        <PrerequisitesCard
                                            prerequisites={courseInfo?.prerequisites || ''}
                                            COLORS={COLORS}
                                        />
                                    </>
                                }
                                data={result.sections}
                                keyExtractor={(item, idx) => `${item.term_code}_${item.section}_${item.instructor}_${idx}`}
                                renderItem={({ item }) => {
                                    // Find professor rating by matching instructor name
                                    const instrName = (item.instructor || '').toUpperCase().trim();
                                    const profRating = profRatings[instrName] ||
                                        Object.entries(profRatings).find(([name]) => {
                                            // Fuzzy match: grade data has "DOE, J" and API has "Doe, John"
                                            const lastName = instrName.split(',')[0]?.trim();
                                            return lastName && name.includes(lastName);
                                        })?.[1];
                                    return (
                                        <SectionCard
                                            item={item}
                                            onPress={() => setSelectedSection(item)}
                                            profRating={profRating}
                                            COLORS={COLORS}
                                            styles={styles}
                                        />
                                    );
                                }}
                                ItemSeparatorComponent={() => (
                                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border }} />
                                )}
                            />
                        )}
                    </>
                )}
            </KeyboardAvoidingView>

            {/* Detail modal */}
            <DetailModal
                item={selectedSection}
                subject={searchedSubject}
                courseNum={searchedCourseNum}
                profRating={selectedSection ? (
                    profRatings[(selectedSection.instructor || '').toUpperCase().trim()] ||
                    Object.entries(profRatings).find(([name]) => {
                        const lastName = (selectedSection.instructor || '').toUpperCase().split(',')[0]?.trim();
                        return lastName && name.includes(lastName);
                    })?.[1]
                ) : undefined}
                onClose={() => setSelectedSection(null)}
                COLORS={COLORS}
                styles={styles}
            />
        </SafeAreaView>
    );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const getStyles = (COLORS: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: COLORS.background,
        },
        header: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
        },
        headerTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: COLORS.textPrimary,
            letterSpacing: -0.5,
        },
        headerSub: {
            color: COLORS.textTertiary,
            fontSize: 12,
            marginTop: 2,
            marginLeft: 32,
        },
        searchRow: {
            flexDirection: 'row',
            paddingHorizontal: 16,
            gap: 8,
            marginTop: 8,
            marginBottom: 12,
        },
        input: {
            height: 46,
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            fontSize: 15,
            color: COLORS.textPrimary,
        },
        searchBtn: {
            height: 46,
            paddingHorizontal: 18,
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        searchBtnText: {
            color: '#fff',
            fontWeight: '700',
            fontSize: 15,
        },
        centered: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
        },
        stateMsg: {
            color: COLORS.textSecondary,
            fontSize: 15,
            textAlign: 'center',
            lineHeight: 22,
        },
        // Summary card
        summaryCard: {
            margin: 16,
            marginBottom: 8,
            backgroundColor: COLORS.surfaceElevated,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        summaryTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: COLORS.textPrimary,
            letterSpacing: -0.3,
        },
        iconBg: {
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        gpaBadge: {
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 8,
            alignItems: 'center',
        },
        gpaBadgeText: {
            fontSize: 22,
            fontWeight: '800',
            letterSpacing: -0.5,
        },
        // Section list
        sectionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: COLORS.background,
        },
        instructorName: {
            fontSize: 15,
            fontWeight: '700',
            color: COLORS.textPrimary,
            marginBottom: 2,
        },
        sectionGpa: {
            fontSize: 20,
            fontWeight: '800',
            letterSpacing: -0.5,
        },
        miniDist: {
            fontSize: 13,
            fontWeight: '600',
        },
        // Detail modal
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-end',
        },
        modalSheet: {
            backgroundColor: COLORS.surfaceElevated,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            maxHeight: '80%',
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
            fontSize: 18,
            fontWeight: '800',
            color: COLORS.textPrimary,
            letterSpacing: -0.3,
        },
        modalGpaBadge: {
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
        },
        modalGpaText: {
            fontSize: 36,
            fontWeight: '800',
            letterSpacing: -1,
        },
        closeBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: COLORS.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });