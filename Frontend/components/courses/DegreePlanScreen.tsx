import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCompletion, getDegreePlan, getDegreePlans, setSelectedDegreePlan } from '../../api/courses';
import { useCoursesStore } from '../../store/coursesStore';
import { useTheme } from '../SharedUI';
import { DegreePlanRecord, PlanCompletionResponse } from '../../types/courses';

export function DegreePlanScreen() {
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);
  const queryClient = useQueryClient();
  const { selectedPlanId, setSelectedPlanId } = useCoursesStore();

  const plansQuery = useQuery<DegreePlanRecord[]>({
    queryKey: ['degree-plans'],
    queryFn: () => getDegreePlans({}),
  });

  const planQuery = useQuery<DegreePlanRecord>({
    queryKey: ['degree-plan', selectedPlanId],
    queryFn: () => getDegreePlan(selectedPlanId as string),
    enabled: !!selectedPlanId,
  });

  const completionQuery = useQuery<PlanCompletionResponse>({
    queryKey: ['plan-completion', selectedPlanId],
    queryFn: () => getCompletion(selectedPlanId as string),
    enabled: !!selectedPlanId,
  });

  const selectPlanMutation = useMutation({
    mutationFn: (plan: DegreePlanRecord) => setSelectedDegreePlan({ plan_id: plan.id, catalog_year: plan.catalog_year }),
    onSuccess: (_, plan) => {
      setSelectedPlanId(plan.id);
      queryClient.invalidateQueries({ queryKey: ['course-progress'] });
      queryClient.invalidateQueries({ queryKey: ['plan-completion'] });
    },
  });

  if (!selectedPlanId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Select your degree plan</Text>
        {(plansQuery.data || []).map((plan) => (
          <Pressable key={plan.id} style={styles.planCard} onPress={() => selectPlanMutation.mutate(plan)}>
            <Text style={styles.planTitle}>{plan.major}</Text>
            <Text style={styles.planMeta}>{plan.college} · {plan.catalog_year}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.progressCard}>
        <Text style={styles.heading}>{planQuery.data?.major || 'Degree Plan'}</Text>
        <Text style={styles.planMeta}>
          {completionQuery.data?.completed_hours ?? 0} / {completionQuery.data?.total_hours ?? 0} hours complete
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  100,
                  ((completionQuery.data?.completed_hours ?? 0) / Math.max(1, completionQuery.data?.total_hours ?? 1)) * 100,
                )}%`,
              },
            ]}
          />
        </View>
      </View>

      {(completionQuery.data?.semesters || []).map((semesterBlock) => (
        <View key={`${semesterBlock.semester.year_label}-${semesterBlock.semester.season}`} style={styles.semesterCard}>
          <Text style={styles.semesterTitle}>
            {semesterBlock.semester.year_label} {semesterBlock.semester.season}
          </Text>
          <Text style={styles.planMeta}>
            {semesterBlock.completed_hours} / {semesterBlock.total_hours} hours complete
          </Text>
          {semesterBlock.courses.map((course) => (
            <View key={course.code} style={styles.courseRow}>
              <View style={[styles.statusDot, course.status === 'completed' ? styles.green : course.status === 'in_progress' ? styles.yellow : styles.gray]} />
              <Text style={styles.courseText}>{course.code} · {course.title || 'Course'}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    heading: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
    progressCard: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      gap: 10,
    },
    progressTrack: {
      height: 12,
      borderRadius: 999,
      backgroundColor: COLORS.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: 12,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    planCard: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
    },
    planTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
    planMeta: { color: COLORS.textSecondary, marginTop: 4 },
    semesterCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      gap: 10,
    },
    semesterTitle: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 17 },
    courseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusDot: { width: 10, height: 10, borderRadius: 999 },
    courseText: { color: COLORS.textPrimary, flex: 1 },
    green: { backgroundColor: '#34C759' },
    yellow: { backgroundColor: '#FFCC00' },
    gray: { backgroundColor: COLORS.textTertiary },
  });
