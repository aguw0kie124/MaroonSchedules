import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCompletion, getProgress, setProgress } from '../../api/courses';
import { useCoursesStore } from '../../store/coursesStore';
import { useTheme } from '../SharedUI';
import { PlanCompletionResponse, UserCourseProgressResponse } from '../../types/courses';

export function ProgressTrackerScreen() {
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);
  const queryClient = useQueryClient();
  const selectedPlanId = useCoursesStore((state) => state.selectedPlanId);

  const progressQuery = useQuery<UserCourseProgressResponse>({
    queryKey: ['course-progress'],
    queryFn: () => getProgress(),
  });

  const completionQuery = useQuery<PlanCompletionResponse>({
    queryKey: ['plan-completion', selectedPlanId],
    queryFn: () => getCompletion(selectedPlanId as string),
    enabled: !!selectedPlanId,
  });

  const progressMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => setProgress(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-progress'] });
      queryClient.invalidateQueries({ queryKey: ['plan-completion'] });
    },
  });

  const grouped = React.useMemo(() => {
    const map: Record<string, UserCourseProgressResponse['items']> = {
      completed: [],
      in_progress: [],
      planned: [],
    };
    for (const item of progressQuery.data?.items || []) {
      map[item.status]?.push(item);
    }
    return map;
  }, [progressQuery.data?.items]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text style={styles.heading}>My Progress</Text>
        <Text style={styles.meta}>
          {completionQuery.data?.completed_hours ?? 0} / {completionQuery.data?.total_hours ?? 0} hours · GPA {completionQuery.data?.gpa?.toFixed(2) ?? 'N/A'}
        </Text>
      </View>

      {(['completed', 'in_progress', 'planned'] as const).map((status) => (
        <View key={status} style={styles.group}>
          <Text style={styles.groupTitle}>{status.replace('_', ' ').toUpperCase()}</Text>
          {(grouped[status] || []).length ? (
            grouped[status].map((item) => (
              <Pressable
                key={item.course_id}
                style={styles.row}
                onPress={() =>
                  progressMutation.mutate({
                    course_id: item.course_id,
                    status: status === 'planned' ? 'in_progress' : status === 'in_progress' ? 'completed' : 'planned',
                    grade: status === 'in_progress' ? 'A' : item.grade,
                  })
                }
              >
                <View>
                  <Text style={styles.courseCode}>{item.department} {item.number}</Text>
                  <Text style={styles.courseTitle}>{item.title}</Text>
                </View>
                <Text style={styles.badge}>{item.grade || item.status}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.empty}>No courses in this bucket yet.</Text>
          )}
        </View>
      ))}

      {completionQuery.data?.semesters?.length ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>REMAINING</Text>
          {completionQuery.data.semesters.flatMap((semester) => semester.courses.filter((course) => course.status === 'remaining')).map((course) => (
            <View key={`remaining-${course.code}`} style={styles.row}>
              <View>
                <Text style={styles.courseCode}>{course.code}</Text>
                <Text style={styles.courseTitle}>{course.title || 'Planned course'}</Text>
              </View>
              <Text style={styles.badge}>remaining</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    summary: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
    },
    heading: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
    meta: { color: COLORS.textSecondary, marginTop: 6 },
    group: { gap: 8 },
    groupTitle: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 16 },
    row: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    courseCode: { color: COLORS.primary, fontWeight: '800' },
    courseTitle: { color: COLORS.textPrimary, marginTop: 3 },
    badge: {
      color: COLORS.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    empty: { color: COLORS.textSecondary },
  });
