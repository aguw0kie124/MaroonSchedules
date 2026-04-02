import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { CATEGORY_META, ExploreCategory } from './EventUtils';

const styles = StyleSheet.create({
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  categoryChipCount: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
});

export function CategoryChip({
  category,
  count,
  active,
  onPress,
}: {
  category: ExploreCategory;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { accent, chipBg, chipText, icon: Icon } = CATEGORY_META[category];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.categoryChip,
        { backgroundColor: active ? accent : chipBg, opacity: count ? 1 : 0.48 },
      ]}
    >
      <Icon size={17} color={active ? '#FFFFFF' : chipText} />
      <Text style={[styles.categoryChipText, { color: active ? '#FFFFFF' : chipText }]}>
        {category}
      </Text>
      <Text
        style={[
          styles.categoryChipCount,
          { color: active ? 'rgba(255,255,255,0.82)' : `${chipText}CC` },
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}
