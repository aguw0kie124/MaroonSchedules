// Frontend/components/GradesScreen.tsx
// Grade-distribution search screen for the MaroonSchedules app.
//
// Shows: subject + course# search → summary card → deduplicated prof list → ProfDetailScreen

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
    ScrollView,
} from 'react-native';
import { BarChart2, X, ChevronRight, GraduationCap, Star, AlertCircle, Search, ArrowUpDown, TrendingUp } from 'lucide-react-native';

import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { searchCourseGrades } from '../services/grades';
import { gpaColor } from '../utils/grades';
import { requestJson } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findApForCourse } from '../data/apEquivalencies';
import {
    CourseStats,
    GradeSearchResult,
    InstructorSectionStat,
    ProfSummary,
} from '../types/grades';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

type ScreenState = 'idle' | 'loading' | 'results' | 'error';
type SortKey = 'gpa' | 'rating' | 'name' | 'students';
type SortDirection = 'asc' | 'desc';

// ── Group sections by instructor → ProfSummary ──────────────────
function groupByProfessor(sections: InstructorSectionStat[]): ProfSummary[] {
    const map = new Map<string, InstructorSectionStat[]>();
    for (const s of sections) {
        const key = (s.instructor || 'STAFF').toUpperCase().trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
    }
    return [...map.entries()].map(([key, secs]) => {
        const total = secs.reduce((sum, s) => sum + s.enrollment, 0);
        const a = secs.reduce((sum, s) => sum + s.a_count, 0);
        const b = secs.reduce((sum, s) => sum + s.b_count, 0);
        const c = secs.reduce((sum, s) => sum + s.c_count, 0);
        const d = secs.reduce((sum, s) => sum + s.d_count, 0);
        const f = secs.reduce((sum, s) => sum + s.f_count, 0);
        const i = secs.reduce((sum, s) => sum + s.i_count, 0);
        const q = secs.reduce((sum, s) => sum + s.q_count, 0);
        const sv = secs.reduce((sum, s) => sum + s.s_count, 0);
        const u = secs.reduce((sum, s) => sum + s.u_count, 0);
        const x = secs.reduce((sum, s) => sum + s.x_count, 0);
        const weightedGpa = secs.reduce((sum, s) => sum + s.avgGpa * s.enrollment, 0);
        const avgGpa = total > 0 ? weightedGpa / total : 0;
        const safe = (n: number) => total > 0 ? (n / total) * 100 : 0;
        return {
            instructor: secs[0].instructor || 'STAFF',
            avgGpa,
            totalStudents: total,
            sectionCount: secs.length,
            sections: secs,
            a_count: a, b_count: b, c_count: c, d_count: d, f_count: f,
            i_count: i, q_count: q, s_count: sv, u_count: u, x_count: x,
            percentA: safe(a), percentB: safe(b), percentC: safe(c),
            percentD: safe(d), percentF: safe(f), percentQ: safe(q),
        } as ProfSummary;
    });
}

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

// Prerequisites card — tappable course chips that navigate to APEquivalency
// Shows inline AP credit availability for each prerequisite course
function PrerequisitesCard({
    prerequisites,
    COLORS,
}: {
    prerequisites: string;
    COLORS: any;
}) {
    const navigation = useNavigation<any>();
    if (!prerequisites || prerequisites === 'None') return null;

    // Parse prereq string into text + course-code tokens
    const coursePattern = /([A-Z]{2,5}\s+\d{3}[A-Z0-9]*)/g;
    const tokens: Array<{ type: 'text' | 'course'; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = coursePattern.exec(prerequisites)) !== null) {
        if (match.index > lastIndex) tokens.push({ type: 'text', value: prerequisites.slice(lastIndex, match.index) });
        tokens.push({ type: 'course', value: match[0] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < prerequisites.length) tokens.push({ type: 'text', value: prerequisites.slice(lastIndex) });

    // Collect AP info for each prerequisite course
    const courseTokens = tokens.filter(t => t.type === 'course');
    const prereqApInfo = new Map<string, { apExam: string; minScore: number }[]>();
    for (const ct of courseTokens) {
        const apMatches = findApForCourse(ct.value);
        if (apMatches.length > 0) {
            // Deduplicate by exam name, keeping the lowest score
            const byExam = new Map<string, number>();
            for (const m of apMatches) {
                const cur = byExam.get(m.apExam);
                if (!cur || m.apScore < cur) byExam.set(m.apExam, m.apScore);
            }
            prereqApInfo.set(ct.value, Array.from(byExam.entries()).map(([apExam, minScore]) => ({ apExam, minScore })));
        }
    }

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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {tokens.map((token, idx) =>
                    token.type === 'course' ? (
                        <Pressable
                            key={idx}
                            onPress={() => navigation.navigate('APEquivalency', { initialFilter: token.value })}
                            style={({ pressed }) => ({
                                backgroundColor: pressed ? '#FF9F0A40' : '#FF9F0A18',
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderWidth: 1,
                                borderColor: '#FF9F0A40',
                            })}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF9F0A' }}>{token.value}</Text>
                        </Pressable>
                    ) : (
                        <Text key={idx} style={{ fontSize: 13, color: COLORS.textSecondary }}>{token.value}</Text>
                    )
                )}
            </View>

            {/* Inline AP credit info for prerequisite courses */}
            {prereqApInfo.size > 0 && (
                <View style={{ marginTop: 10, gap: 6 }}>
                    <View style={{ height: 1, backgroundColor: COLORS.border, marginBottom: 2 }} />
                    {Array.from(prereqApInfo.entries()).map(([course, aps]) => (
                        <Pressable
                            key={course}
                            onPress={() => navigation.navigate('APEquivalency', { initialFilter: course })}
                            style={({ pressed }) => ({
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: pressed ? '#30D15820' : '#30D15810',
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderWidth: 1,
                                borderColor: '#30D15830',
                                gap: 6,
                            })}
                        >
                            <Text style={{ fontSize: 13 }}>🎓</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#30D158' }}>
                                    {course} — skippable via AP
                                </Text>
                                <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 1 }}>
                                    {aps.map(a => `${a.apExam} (${a.minScore}+)`).join(', ')}
                                </Text>
                            </View>
                            <ChevronRight size={14} color="#30D158" />
                        </Pressable>
                    ))}
                </View>
            )}

            <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 6 }}>
                Tap a course to see its AP credit equivalency
            </Text>
        </View>
    );
}

// GPA-over-time bar chart — uses fixed pixel widths to work inside FlatList
function GpaTimelineChart({
    sections,
    COLORS,
    title,
    chartWidth,
}: {
    sections: InstructorSectionStat[];
    COLORS: any;
    title?: string;
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

    const BAR_MAX_HEIGHT = 90;
    const GAP = 4;
    const innerWidth = chartWidth - 28; // 14px padding each side
    const barW = Math.max(16, (innerWidth - GAP * (data.length - 1)) / data.length);

    const maxGpa = 4.0;
    const allGpas = data.map(d => d.avgGpa);
    const minGpaRaw = Math.min(...allGpas);
    const minGpa = Math.max(0, minGpaRaw - 0.5);
    const range = maxGpa - minGpa || 0.01;

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TrendingUp size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }} numberOfLines={1}>
                    {title || 'Avg GPA by Year'}
                </Text>
            </View>
            {/* Scroll horizontally if many years */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: GAP, height: BAR_MAX_HEIGHT + 36, paddingBottom: 4 }}>
                    {data.map(({ year, avgGpa }) => {
                        const barH = Math.max(10, ((avgGpa - minGpa) / range) * BAR_MAX_HEIGHT);
                        const color = avgGpa >= 3.5 ? '#30D158' : avgGpa >= 3.0 ? '#64D2FF' : avgGpa >= 2.5 ? '#FF9F0A' : '#FF453A';
                        return (
                            <View key={year} style={{ width: barW, alignItems: 'center', justifyContent: 'flex-end' }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color, marginBottom: 3 }}>
                                    {avgGpa.toFixed(2)}
                                </Text>
                                <View style={{
                                    width: barW * 0.75,
                                    height: barH,
                                    backgroundColor: color,
                                    borderRadius: 5,
                                }} />
                                <Text style={{ fontSize: 9, color: COLORS.textTertiary, marginTop: 4 }}>
                                    {year}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
            <Text style={{ fontSize: 10, color: COLORS.textTertiary, textAlign: 'right', marginTop: 2 }}>
                Y-axis: GPA · X-axis: year
            </Text>
        </View>
    );
}

// Shows AP exams that can grant credit for a specific TAMU course
function APCreditCard({ subject, courseNum, COLORS }: { subject: string; courseNum: string; COLORS: any }) {
    const courseCode = `${subject} ${courseNum}`;
    const matches = findApForCourse(courseCode);
    if (!matches || matches.length === 0) return null;

    const bestMatches = new Map<string, { minScore: number; credits: number }>();
    for (const m of matches) {
        const cur = bestMatches.get(m.apExam);
        if (!cur || m.apScore < cur.minScore) {
            bestMatches.set(m.apExam, { minScore: m.apScore, credits: m.credits });
        }
    }
    const uniqueMatches = Array.from(bestMatches.entries()).map(([apExam, data]) => ({ apExam, ...data }));

    const scoreColor = (score: number) => score >= 5 ? '#30D158' : score >= 4 ? '#64D2FF' : '#FF9F0A';

    return (
        <View style={{
            marginHorizontal: 16,
            marginBottom: 8,
            backgroundColor: COLORS.surfaceElevated,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: '#30D15830',
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 16 }}>🎓</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textPrimary }}>
                    AP Credit Available
                </Text>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>
                You may earn credit for {courseCode} through the following AP exams:
            </Text>
            {uniqueMatches.map((m, i) => (
                <View key={i} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: COLORS.border,
                }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textPrimary }}>{m.apExam}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>{m.credits} credit hour{m.credits !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={{
                        paddingHorizontal: 10, paddingVertical: 4,
                        backgroundColor: scoreColor(m.minScore) + '20',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: scoreColor(m.minScore) + '40',
                    }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: scoreColor(m.minScore) }}>
                            {m.minScore === 5 ? 'Score 5' : `Score ${m.minScore}+`}
                        </Text>
                    </View>
                </View>
            ))}
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

function ProfCard({
    prof,
    onPress,
    profRating,
    COLORS,
    styles,
}: {
    prof: ProfSummary;
    onPress: () => void;
    profRating?: { overall_rating?: number; total_reviews?: number };
    COLORS: any;
    styles: any;
}) {
    const accentGpa = gpaColor(prof.avgGpa);
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.75 }]}
        >
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={styles.instructorName}>{prof.instructor || 'STAFF'}</Text>
                            <RatingBadge
                                rating={profRating?.overall_rating}
                                reviews={profRating?.total_reviews}
                                COLORS={COLORS}
                            />
                        </View>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                            {prof.sectionCount} section{prof.sectionCount !== 1 ? 's' : ''} · {prof.totalStudents.toLocaleString()} students
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={[styles.sectionGpa, { color: accentGpa }]}>
                            {prof.avgGpa.toFixed(2)}
                        </Text>
                        <Text style={{ color: COLORS.textTertiary, fontSize: 10 }}>avg GPA</Text>
                    </View>
                </View>

                {/* Inline mini-distribution */}
                <Text style={[styles.miniDist, { marginTop: 8 }]}>
                    <Text style={{ color: '#30D158' }}>A: {prof.percentA.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#64D2FF' }}>B: {prof.percentB.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#FF9F0A' }}>C: {prof.percentC.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#FF6B35' }}>D: {prof.percentD.toFixed(0)}%</Text>
                    {'  '}
                    <Text style={{ color: '#FF453A' }}>F: {prof.percentF.toFixed(0)}%</Text>
                </Text>
            </View>
            <ChevronRight size={18} color={COLORS.textTertiary} style={{ marginLeft: 8, alignSelf: 'center' }} />
        </Pressable>
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
    const navigation = useNavigation<any>();
    const { width: screenWidth } = useWindowDimensions();
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
    const [courseInfo, setCourseInfo] = useState<any>(null);
    const [profRatings, setProfRatings] = useState<Record<string, { overall_rating?: number; total_reviews?: number }>>({});
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);

    // ── Filter / sort state ──
    const [nameFilter, setNameFilter] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('gpa');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // Helper: look up professor rating for an instructor name
    const findProfRating = useCallback((instrName: string) => {
        const key = (instrName || '').toUpperCase().trim();
        if (!key || key === 'STAFF') return undefined;
        // Direct match
        if (profRatings[key]) return profRatings[key];
        // Extract last name (first word, splitting on comma or space)
        const lastName = key.split(/[,\s]/)[0]?.trim();
        if (!lastName || lastName.length < 2) return undefined;
        // Match by last name against all known professors
        return Object.entries(profRatings).find(([name]) => {
            const otherLastName = name.split(/[,\s]/)[0]?.trim();
            return lastName === otherLastName;
        })?.[1];
    }, [profRatings]);

    // Derived: grouped by prof, filtered + sorted
    const filteredProfs = useMemo(() => {
        if (!result?.sections) return [];
        let profs = groupByProfessor(result.sections);

        // Name filter
        if (nameFilter.trim()) {
            const q = nameFilter.trim().toUpperCase();
            profs = profs.filter(p =>
                (p.instructor || '').toUpperCase().includes(q)
            );
        }

        // Sort
        const dir = sortDir === 'asc' ? 1 : -1;
        profs.sort((a, b) => {
            if (sortKey === 'gpa') {
                return (a.avgGpa - b.avgGpa) * dir;
            }
            if (sortKey === 'students') {
                return (a.totalStudents - b.totalStudents) * dir;
            }
            if (sortKey === 'rating') {
                const rA = findProfRating(a.instructor)?.overall_rating || 0;
                const rB = findProfRating(b.instructor)?.overall_rating || 0;
                return (rA - rB) * dir;
            }
            // name
            return (a.instructor || '').localeCompare(b.instructor || '') * dir;
        });

        return profs;
    }, [result?.sections, nameFilter, sortKey, sortDir, findProfRating]);

    const toggleSort = useCallback((key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'name' ? 'asc' : 'desc');
        }
    }, [sortKey]);

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

                // Also fetch ratings for unique instructors from grade data
                // that weren't found in the course catalog
                if (data.sections?.length) {
                    const uniqueInstructors = [...new Set(
                        data.sections
                            .map((s: any) => s.instructor)
                            .filter((n: string) => n && n !== 'STAFF')
                    )];
                    // Check which ones we don't have ratings for yet
                    const missing = uniqueInstructors.filter((name: string) => {
                        const key = name.toUpperCase().trim();
                        if (ratings[key]) return false;
                        const lastName = key.split(/[,\s]/)[0]?.trim();
                        if (!lastName || lastName.length < 2) return false;
                        return !Object.keys(ratings).some(k =>
                            k.split(/[,\s]/)[0]?.trim() === lastName
                        );
                    });
                    // Batch fetch (limit to first 15 unique profs to avoid API spam)
                    const toFetch = missing.slice(0, 15);
                    if (toFetch.length > 0) {
                        const fetched: Record<string, { overall_rating?: number; total_reviews?: number }> = {};
                        await Promise.allSettled(
                            toFetch.map(async (instrName: string) => {
                                try {
                                    const searchName = instrName.split(',')[0]?.trim() || instrName.split(/\s/)[0]?.trim() || instrName;
                                    const profData = await requestJson(`/professors/search?name=${encodeURIComponent(searchName)}`);
                                    if (profData?.overall_rating && profData.overall_rating > 0) {
                                        fetched[instrName.toUpperCase().trim()] = {
                                            overall_rating: profData.overall_rating,
                                            total_reviews: profData.total_reviews,
                                        };
                                    }
                                } catch {}
                            })
                        );
                        if (Object.keys(fetched).length > 0) {
                            setProfRatings(prev => ({ ...prev, ...fetched }));
                        }
                    }
                }
            } catch {
                // Course info is supplementary — don't block grade results
                setCourseInfo(null);
            }
        } catch (err: any) {
            setErrorMsg('Sorry, class not found!');
            setScreenState('error');
        }
    };

    const handleSearch = useCallback(() => {
        performSearch(subject, courseNum);
    }, [subject, courseNum]);

    const handleReset = useCallback(() => {
        setSubject('');
        setCourseNum('');
        setResult(null);
        setScreenState('idle');
        setErrorMsg('');
        setSearchedSubject('');
        setSearchedCourseNum('');
        setNameFilter('');
        setCourseInfo(null);
        setProfRatings({});
        AsyncStorage.removeItem(GRADES_STORAGE_KEY).catch(() => {});
    }, []);

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
                    {/* Subject input with inline X */}
                    <View style={[styles.inputWrap, { flex: 1.2 }]}>
                        <TextInput
                            style={styles.input}
                            placeholder="Subject"
                            placeholderTextColor={COLORS.textTertiary}
                            value={subject}
                            onChangeText={t => setSubject(t.toUpperCase())}
                            autoCapitalize="characters"
                            returnKeyType="next"
                        />
                        {subject.length > 0 && (
                            <Pressable
                                onPress={handleReset}
                                hitSlop={8}
                                style={styles.inputClearBtn}
                            >
                                <X size={13} color={COLORS.textTertiary} />
                            </Pressable>
                        )}
                    </View>
                    {/* Number input with inline X */}
                    <View style={[styles.inputWrap, { flex: 1 }]}>
                        <TextInput
                            style={styles.input}
                            placeholder="Number"
                            placeholderTextColor={COLORS.textTertiary}
                            value={courseNum}
                            onChangeText={setCourseNum}
                            keyboardType="default"
                            returnKeyType="search"
                            onSubmitEditing={handleSearch}
                        />
                        {courseNum.length > 0 && (
                            <Pressable
                                onPress={() => setCourseNum('')}
                                hitSlop={8}
                                style={styles.inputClearBtn}
                            >
                                <X size={13} color={COLORS.textTertiary} />
                            </Pressable>
                        )}
                    </View>
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
                                        <APCreditCard
                                            subject={searchedSubject}
                                            courseNum={searchedCourseNum}
                                            COLORS={COLORS}
                                        />
                                        <PrerequisitesCard
                                            prerequisites={courseInfo?.prerequisites || ''}
                                            COLORS={COLORS}
                                        />
                                        <GpaTimelineChart
                                            sections={result.sections}
                                            COLORS={COLORS}
                                            chartWidth={screenWidth - 32}
                                            title={`${searchedSubject} ${searchedCourseNum} — Avg GPA by Year (All Profs)`}
                                        />

                                        {/* ── Filter / Sort toolbar ── */}
                                        <View style={styles.filterBar}>
                                            {/* Search by professor name */}
                                            <View style={styles.nameSearchWrap}>
                                                <Search size={14} color={COLORS.textTertiary} />
                                                <TextInput
                                                    style={styles.nameSearchInput}
                                                    placeholder="Search professor…"
                                                    placeholderTextColor={COLORS.textTertiary}
                                                    value={nameFilter}
                                                    onChangeText={setNameFilter}
                                                    autoCapitalize="none"
                                                    autoCorrect={false}
                                                />
                                                {nameFilter.length > 0 && (
                                                    <Pressable onPress={() => setNameFilter('')} hitSlop={8}>
                                                        <X size={14} color={COLORS.textTertiary} />
                                                    </Pressable>
                                                )}
                                            </View>

                                            {/* Sort pills */}
                                            <View style={styles.sortRow}>
                                                {([['gpa', 'GPA'], ['rating', 'Rating'], ['students', 'Students'], ['name', 'Name']] as [SortKey, string][]).map(([key, label]) => {
                                                    const isActive = sortKey === key;
                                                    return (
                                                        <Pressable
                                                            key={key}
                                                            onPress={() => toggleSort(key)}
                                                            style={[styles.sortPill, isActive && { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary + '40' }]}
                                                        >
                                                            <Text style={[styles.sortPillText, isActive && { color: COLORS.primary, fontWeight: '700' }]}>
                                                                {label}
                                                            </Text>
                                                            {isActive && (
                                                                <ArrowUpDown size={11} color={COLORS.primary} />
                                                            )}
                                                            {isActive && (
                                                                <Text style={{ fontSize: 9, color: COLORS.primary, fontWeight: '600' }}>
                                                                    {sortDir === 'asc' ? '↑' : '↓'}
                                                                </Text>
                                                            )}
                                                        </Pressable>
                                                    );
                                                })}
                                            </View>

                                            {nameFilter.trim() !== '' && (
                                                <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 4 }}>
                                                    {filteredProfs.length} professor{filteredProfs.length !== 1 ? 's' : ''} found
                                                </Text>
                                            )}
                                        </View>
                                    </>
                                }
                                data={filteredProfs}
                                keyExtractor={(item) => item.instructor}
                                renderItem={({ item }) => {
                                    const profRating = findProfRating(item.instructor);
                                    return (
                                        <ProfCard
                                            prof={item}
                                            onPress={() => navigation.navigate('ProfDetail', {
                                                prof: item,
                                                subject: searchedSubject,
                                                courseNum: searchedCourseNum,
                                                profRating,
                                            })}
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
            paddingRight: 32, // make room for clear button
            fontSize: 15,
            color: COLORS.textPrimary,
            flex: 1,
        },
        inputWrap: {
            position: 'relative',
            justifyContent: 'center',
        },
        inputClearBtn: {
            position: 'absolute',
            right: 10,
            height: 46,
            justifyContent: 'center',
            alignItems: 'center',
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
        // Filter / sort toolbar
        filterBar: {
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 10,
        },
        nameSearchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 10,
            paddingHorizontal: 10,
            height: 36,
            gap: 6,
            marginBottom: 8,
        },
        nameSearchInput: {
            flex: 1,
            fontSize: 13,
            color: COLORS.textPrimary,
            paddingVertical: 0,
        },
        sortRow: {
            flexDirection: 'row',
            gap: 6,
        },
        sortPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        sortPillText: {
            fontSize: 12,
            fontWeight: '600',
            color: COLORS.textSecondary,
        },
    });