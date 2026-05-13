import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { getDegreePlans, getSelectedDegreePlan, setSelectedDegreePlan } from '../../api/courses';
import { useCoursesStore } from '../../store/coursesStore';
import { useTheme } from '../SharedUI';
import { DegreePlanRecord } from '../../types/courses';

const QUICK_ACTIONS = [
  { title: 'My Degree Plan', route: 'DegreePlan' },
  { title: 'My Progress', route: 'ProgressTracker' },
  { title: 'Browse by College', route: 'CourseSearch', params: { college: 'Engineering' } },
];

export function CoursesHomeScreen({ navigation }: any) {
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);
  const { searchQuery, setSearchQuery, selectedPlanId, setSelectedPlanId } = useCoursesStore();

  const plansQuery = useQuery<DegreePlanRecord[]>({
    queryKey: ['degree-plans'],
    queryFn: () => getDegreePlans({}),
  });

  useQuery({
    queryKey: ['selected-degree-plan'],
    queryFn: () => getSelectedDegreePlan(),
    onSuccess: (data: any) => {
      if (data?.plan_id) {
        setSelectedPlanId(data.plan_id);
      }
    },
  } as any);

  const selectionMutation = useMutation({
    mutationFn: (plan: DegreePlanRecord) => setSelectedDegreePlan({ plan_id: plan.id, catalog_year: plan.catalog_year }),
    onSuccess: (_value, plan) => setSelectedPlanId(plan.id),
  });

  const selectedPlan = (plansQuery.data || []).find((plan) => plan.id === selectedPlanId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Courses</Text>
        <Text style={styles.title}>Track your TAMU degree progress.</Text>
        <TextInput
          style={styles.input}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by department, number, or title"
          placeholderTextColor={COLORS.textTertiary}
          onSubmitEditing={() => navigation.navigate('CourseSearch', { query: searchQuery })}
        />
      </View>

      <View style={styles.grid}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.title}
            style={styles.card}
            onPress={() => navigation.navigate(action.route, action.params)}
          >
            <Text style={styles.cardTitle}>{action.title}</Text>
          </Pressable>
        ))}
      </View>

      {selectedPlan ? (
        <View style={styles.selectedCard}>
          <Text style={styles.selectedLabel}>Selected plan</Text>
          <Text style={styles.selectedTitle}>{selectedPlan.major}</Text>
          <Text style={styles.selectedMeta}>{selectedPlan.catalog_year} · {selectedPlan.college}</Text>
        </View>
      ) : (
        <View style={styles.selectCard}>
          <Text style={styles.cardTitle}>Select your degree plan</Text>
          {(plansQuery.data || []).slice(0, 5).map((plan) => (
            <Pressable key={plan.id} onPress={() => selectionMutation.mutate(plan)} style={styles.planRow}>
              <Text style={styles.planRowTitle}>{plan.major}</Text>
              <Text style={styles.planRowMeta}>{plan.catalog_year}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: 16, gap: 16, paddingBottom: 40 },
    hero: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 18,
      gap: 10,
    },
    eyebrow: { color: COLORS.primary, fontWeight: '800', textTransform: 'uppercase', fontSize: 13 },
    title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800', lineHeight: 31 },
    input: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
      color: COLORS.textPrimary,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    grid: { gap: 10 },
    card: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 18,
      padding: 16,
    },
    cardTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
    selectedCard: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 18,
      padding: 16,
      gap: 4,
    },
    selectedLabel: { color: COLORS.textSecondary, textTransform: 'uppercase', fontSize: 12, fontWeight: '700' },
    selectedTitle: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 18 },
    selectedMeta: { color: COLORS.textSecondary },
    selectCard: {
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 18,
      padding: 16,
      gap: 10,
    },
    planRow: {
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
    },
    planRowTitle: { color: COLORS.textPrimary, fontWeight: '700' },
    planRowMeta: { color: COLORS.textSecondary, marginTop: 2 },
  });
