import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCourseDetail, setProgress } from '../../api/courses';
import { useTheme } from '../SharedUI';
import { GradeDistributionChart } from './GradeDistributionChart';
import { PrereqGraph } from './PrereqGraph';
import { CourseRecord, GradeDistributionRecord } from '../../types/courses';

export function CourseDetailScreen({ route, navigation }: any) {
  const { dept, number } = route.params;
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);
  const queryClient = useQueryClient();
  const [selectedInstructor, setSelectedInstructor] = React.useState<string>('');

  const { data, isLoading, error } = useQuery<CourseRecord>({
    queryKey: ['course-detail', dept, number],
    queryFn: () => getCourseDetail(dept, number),
  });

  const progressMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => setProgress(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress'] });
    },
  });

  React.useEffect(() => {
    const firstInstructor = Object.keys(data?.grade_distributions?.by_instructor || {})[0];
    if (firstInstructor && !selectedInstructor) {
      setSelectedInstructor(firstInstructor);
    }
  }, [data?.grade_distributions?.by_instructor, selectedInstructor]);

  const chartRows: GradeDistributionRecord[] =
    (selectedInstructor && data?.grade_distributions?.by_instructor?.[selectedInstructor]) || [];

  const handleCoursePress = (courseCode: string) => {
    const parts = courseCode.split(' ');
    if (parts.length !== 2) return;
    navigation.push('CourseDetailCatalog', { dept: parts[0], number: parts[1] });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.helper}>Loading course detail...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.helper}>Course detail is unavailable right now.</Text>
      </View>
    );
  }

  const instructors = Object.keys(data.grade_distributions?.by_instructor || {});

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.code}>{data.department} {data.number}</Text>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>
          {data.credit_hours} credit hours
          {data.grade_summary?.avg_gpa != null ? ` · avg GPA ${data.grade_summary.avg_gpa.toFixed(2)}` : ''}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{data.description || 'No description available.'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prerequisites</Text>
        <PrereqGraph groups={data.prerequisites || []} onCoursePress={handleCoursePress} />
        {data.raw_prereq_text ? <Text style={styles.rawText}>Catalog text: {data.raw_prereq_text}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Corequisites</Text>
        <View style={styles.chips}>
          {(data.corequisites || []).length ? (
            data.corequisites.map((coreq) => (
              <Pressable key={coreq} onPress={() => handleCoursePress(coreq)} style={styles.chip}>
                <Text style={styles.chipText}>{coreq}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.body}>No corequisites listed.</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => progressMutation.mutate({ course_id: data.id, status: 'planned' })}
        >
          <Text style={styles.primaryText}>Add to My Plan</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => progressMutation.mutate({ course_id: data.id, status: 'completed', grade: 'A' })}
        >
          <Text style={styles.secondaryText}>Mark as Completed</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Grade Distributions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.instructorRow}>
          {instructors.length ? (
            instructors.map((instructor) => (
              <Pressable
                key={instructor}
                onPress={() => setSelectedInstructor(instructor)}
                style={[
                  styles.instructorChip,
                  selectedInstructor === instructor && styles.instructorChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.instructorChipText,
                    selectedInstructor === instructor && styles.instructorChipTextActive,
                  ]}
                >
                  {instructor}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.body}>No grade history found.</Text>
          )}
        </ScrollView>
        {selectedInstructor ? (
          <GradeDistributionChart distributions={chartRows} selectedInstructor={selectedInstructor} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: 16, gap: 16, paddingBottom: 42 },
    hero: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 18,
    },
    code: { color: COLORS.primary, fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },
    title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 6 },
    subtitle: { color: COLORS.textSecondary, marginTop: 6 },
    section: { gap: 10 },
    sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
    body: { color: COLORS.textSecondary, lineHeight: 22 },
    rawText: { color: COLORS.textTertiary, fontSize: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipText: { color: COLORS.textPrimary, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 10 },
    primaryButton: {
      flex: 1,
      backgroundColor: COLORS.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
    },
    primaryText: { color: '#FFFFFF', fontWeight: '800' },
    secondaryButton: {
      flex: 1,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
    },
    secondaryText: { color: COLORS.textPrimary, fontWeight: '800' },
    instructorRow: { gap: 8, paddingBottom: 4 },
    instructorChip: {
      backgroundColor: COLORS.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    instructorChipActive: { backgroundColor: COLORS.primary },
    instructorChipText: { color: COLORS.textPrimary, fontWeight: '600' },
    instructorChipTextActive: { color: '#FFFFFF' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
    helper: { color: COLORS.textSecondary },
  });
