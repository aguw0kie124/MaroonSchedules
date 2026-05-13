import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useTheme } from '../SharedUI';
import { GradeDistributionRecord } from '../../types/courses';

type Props = {
  distributions: GradeDistributionRecord[];
  selectedInstructor: string;
};

const BAR_ORDER = [
  { key: 'A', color: '#34C759' },
  { key: 'B', color: '#64D2FF' },
  { key: 'C', color: '#FF9F0A' },
  { key: 'D', color: '#FF7A59' },
  { key: 'F', color: '#FF453A' },
  { key: 'Q', color: '#8E8E93' },
] as const;

export function GradeDistributionChart({ distributions, selectedInstructor }: Props) {
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);

  const latest = distributions[0];
  if (!latest) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No grade distribution data yet.</Text>
      </View>
    );
  }

  const maxValue = Math.max(1, ...BAR_ORDER.map((entry) => latest.grades?.[entry.key] ?? 0));

  return (
    <View style={styles.card}>
      <Text style={styles.header}>{selectedInstructor}</Text>
      <Text style={styles.meta}>
        GPA {latest.gpa?.toFixed(2) ?? 'N/A'} · {latest.total_enrolled} enrolled · {latest.term}
      </Text>

      {BAR_ORDER.map((entry) => {
        const value = latest.grades?.[entry.key] ?? 0;
        const barWidth = 260 * (value / maxValue);
        return (
          <View key={entry.key} style={styles.row}>
            <Text style={styles.label}>{entry.key}</Text>
            <Svg width={260} height={12}>
              <Rect x={0} y={0} width={260} height={12} rx={6} fill={COLORS.border} />
              <Rect x={0} y={0} width={barWidth} height={12} rx={6} fill={entry.color} />
            </Svg>
            <Text style={styles.value}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
      padding: 16,
      gap: 10,
    },
    header: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    meta: {
      color: COLORS.textSecondary,
      fontSize: 13,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    label: {
      width: 18,
      color: COLORS.textSecondary,
      fontWeight: '700',
    },
    value: {
      color: COLORS.textPrimary,
      fontWeight: '600',
      minWidth: 26,
      textAlign: 'right',
    },
    emptyState: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: COLORS.surface,
    },
    emptyText: {
      color: COLORS.textSecondary,
    },
  });
