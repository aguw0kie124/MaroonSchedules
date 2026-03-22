import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Trash2, PlusCircle } from 'lucide-react-native';
import { COLORS } from './SharedUI';

// ─── Grade map ───────────────────────────────────────────────
const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'] as const;
type Grade = typeof GRADES[number];

const GRADE_POINTS: Record<Grade, number> = {
  A: 4.0,
  'B+': 3.5,
  B: 3.0,
  'C+': 2.5,
  C: 2.0,
  'D+': 1.5,
  D: 1.0,
  F: 0.0,
};

// ─── Types ───────────────────────────────────────────────────
interface Course {
  id: string;
  name: string;
  credits: string;
  grade: Grade;
}

const makeId = () => `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const DEFAULT_COURSES: Course[] = [
  { id: makeId(), name: '', credits: '3', grade: 'A' },
  { id: makeId(), name: '', credits: '3', grade: 'B+' },
];

// ─── GPA label colours ───────────────────────────────────────
function gpaColor(gpa: number): string {
  if (gpa >= 3.5) return '#32D74B';
  if (gpa >= 3.0) return '#34C759';
  if (gpa >= 2.5) return '#FF9500';
  if (gpa >= 2.0) return '#FF6B00';
  return '#FF3B30';
}

function gpaLabel(gpa: number): string {
  if (gpa >= 3.9) return 'Summa Cum Laude 🏅';
  if (gpa >= 3.7) return 'Magna Cum Laude 🎖️';
  if (gpa >= 3.5) return 'Cum Laude 🎓';
  if (gpa >= 3.0) return 'Good Standing 👍';
  if (gpa >= 2.0) return 'Satisfactory';
  return 'Below Minimum ⚠️';
}

// ─── Component ───────────────────────────────────────────────
export function GPACalculatorScreen() {
  const [courses, setCourses] = useState<Course[]>(DEFAULT_COURSES);

  // ── Derived GPA ──────────────────────────────────────────
  const { gpa, totalCredits, totalPoints } = useMemo(() => {
    let pts = 0;
    let hrs = 0;
    for (const c of courses) {
      const cr = parseFloat(c.credits);
      if (!isNaN(cr) && cr > 0) {
        pts += GRADE_POINTS[c.grade] * cr;
        hrs += cr;
      }
    }
    return {
      gpa: hrs > 0 ? pts / hrs : 0,
      totalCredits: hrs,
      totalPoints: pts,
    };
  }, [courses]);

  // ── Handlers ─────────────────────────────────────────────
  const addCourse = () => {
    setCourses(prev => [
      ...prev,
      { id: makeId(), name: '', credits: '3', grade: 'A' },
    ]);
  };

  const removeCourse = (id: string) => {
    if (courses.length === 1) {
      Alert.alert('At least one course required.');
      return;
    }
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  const updateCourse = (id: string, field: keyof Course, value: string) => {
    setCourses(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const setGrade = (id: string, grade: Grade) => {
    setCourses(prev => prev.map(c => (c.id === id ? { ...c, grade } : c)));
  };

  const reset = () => {
    Alert.alert('Reset', 'Clear all courses?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setCourses([
            { id: makeId(), name: '', credits: '3', grade: 'A' },
          ]);
        },
      },
    ]);
  };

  const gpaVal = isNaN(gpa) ? 0 : gpa;
  const color = gpaColor(gpaVal);

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🎓 GPA Calculator</Text>
          <Text style={styles.headerSubtitle}>Texas A&M · 4.0 Scale</Text>
        </View>
        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── GPA Ring ───────────────────────────────────────── */}
        <View style={styles.gpaCard}>
          <View style={[styles.gpaRing, { borderColor: color }]}>
            <Text style={[styles.gpaNumber, { color }]}>
              {gpaVal.toFixed(2)}
            </Text>
            <Text style={styles.gpaSmall}>/ 4.00</Text>
          </View>
          <Text style={[styles.gpaLabel, { color }]}>{gpaLabel(gpaVal)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalCredits}</Text>
              <Text style={styles.statLabel}>Credit Hrs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalPoints.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Quality Pts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{courses.length}</Text>
              <Text style={styles.statLabel}>Courses</Text>
            </View>
          </View>
        </View>

        {/* ── Course Rows ────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>COURSES</Text>

        {courses.map((course, idx) => (
          <View key={course.id} style={styles.courseCard}>
            {/* Row 1: name + delete */}
            <View style={styles.courseTopRow}>
              <TextInput
                style={styles.nameInput}
                placeholder={`Course ${idx + 1}`}
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={course.name}
                onChangeText={v => updateCourse(course.id, 'name', v)}
              />
              <Pressable
                onPress={() => removeCourse(course.id)}
                style={styles.deleteBtn}
              >
                <Trash2 size={16} color="#FF453A" />
              </Pressable>
            </View>

            {/* Row 2: credits + grade picker */}
            <View style={styles.courseBottomRow}>
              <View style={styles.creditsBox}>
                <Text style={styles.fieldLabel}>Credits</Text>
                <View style={styles.creditsBtnRow}>
                  {['1', '2', '3', '4'].map(cr => (
                    <Pressable
                      key={cr}
                      style={[
                        styles.creditBtn,
                        course.credits === cr && styles.creditBtnActive,
                      ]}
                      onPress={() => updateCourse(course.id, 'credits', cr)}
                    >
                      <Text
                        style={[
                          styles.creditBtnText,
                          course.credits === cr && styles.creditBtnTextActive,
                        ]}
                      >
                        {cr}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.gradeBox}>
                <Text style={styles.fieldLabel}>Grade</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gradePillRow}
                >
                  {GRADES.map(g => (
                    <Pressable
                      key={g}
                      style={[
                        styles.gradePill,
                        course.grade === g && {
                          backgroundColor: COLORS.primary,
                          borderColor: COLORS.primary,
                        },
                      ]}
                      onPress={() => setGrade(course.id, g)}
                    >
                      <Text
                        style={[
                          styles.gradePillText,
                          course.grade === g && { color: '#FFF', fontWeight: '800' },
                        ]}
                      >
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Grade point display */}
            <Text style={styles.gradePoints}>
              {GRADE_POINTS[course.grade].toFixed(1)} pts ×{' '}
              {parseFloat(course.credits) || 0} cr ={' '}
              {(
                GRADE_POINTS[course.grade] * (parseFloat(course.credits) || 0)
              ).toFixed(1)}{' '}
              quality pts
            </Text>
          </View>
        ))}

        {/* ── Add Course ─────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
          onPress={addCourse}
        >
          <PlusCircle size={18} color={COLORS.primary} />
          <Text style={styles.addBtnText}>Add Course</Text>
        </Pressable>

        {/* ── Grade Legend ───────────────────────────────────── */}
        <Text style={styles.sectionLabel}>GRADE SCALE</Text>
        <View style={styles.legendCard}>
          {GRADES.map(g => (
            <View key={g} style={styles.legendRow}>
              <Text style={styles.legendGrade}>{g}</Text>
              <Text style={styles.legendPoints}>{GRADE_POINTS[g].toFixed(1)}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  resetBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // GPA Card
  gpaCard: {
    backgroundColor: '#141414',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#212121',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  gpaRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: '#0F0F0F',
  },
  gpaNumber: { fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  gpaSmall: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: -4 },
  gpaLabel: { fontSize: 15, fontWeight: '700', marginBottom: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#222' },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 2,
  },

  // Course card
  courseCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#212121',
    padding: 14,
    marginBottom: 10,
  },
  courseTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  deleteBtn: {
    marginLeft: 10,
    padding: 8,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.2)',
  },
  courseBottomRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },

  // Credits
  creditsBox: { flex: 0 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 6 },
  creditsBtnRow: { flexDirection: 'row', gap: 6 },
  creditBtn: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  creditBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  creditBtnText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  creditBtnTextActive: { color: '#FFF' },

  // Grade
  gradeBox: { flex: 1 },
  gradePillRow: { flexDirection: 'row', gap: 6 },
  gradePill: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 9, backgroundColor: '#1A1A1A',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  gradePillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },

  // Quality pts
  gradePoints: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(80,0,0,0.15)',
    marginBottom: 28,
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },

  // Legend
  legendCard: {
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#212121',
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  legendGrade: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  legendPoints: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});
