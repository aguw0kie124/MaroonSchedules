import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../SharedUI';

interface TagChipsProps {
  tags?: string[] | null;
  label?: string;
  maxVisible?: number;
}

export function TagChips({ tags, label, maxVisible = 6 }: TagChipsProps) {
  const { COLORS } = useTheme();
  const visibleTags = (tags || []).filter(Boolean).slice(0, maxVisible);

  if (!visibleTags.length) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: COLORS.textSecondary }]}>{label}</Text> : null}
      <View style={styles.row}>
        {visibleTags.map((tag) => (
          <View
            key={tag}
            style={[
              styles.chip,
              {
                backgroundColor: COLORS.primary + '12',
                borderColor: COLORS.primary + '28',
              },
            ]}
          >
            <Text style={[styles.chipText, { color: COLORS.primary }]}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
