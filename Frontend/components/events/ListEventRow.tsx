import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BadgeCheck, Heart, Share2, Check } from 'lucide-react-native';
import { TAMUEvent, CATEGORY_META, classifyCategory, formatDate, formatTime } from './EventUtils';
import { useTheme } from '../SharedUI';

const styles = StyleSheet.create({
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 0,
    borderWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  listThumb: {
    width: 104,
    height: 76,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flex: 1,
    minWidth: 0,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  listTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  listMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  listActions: {
    justifyContent: 'center',
    gap: 8,
  },
  listActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function ListEventRow({
  event,
  saved,
  scheduled,
  onPress,
  onSave,
  onShare,
  onSchedule,
}: {
  event: TAMUEvent;
  saved: boolean;
  scheduled: boolean;
  onPress: () => void;
  onSave: () => void;
  onShare: () => void;
  onSchedule: () => void;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.listRow,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
      ]}
    >
      <View style={[styles.listThumb, { backgroundColor: meta.cardTint }]}>
        <Icon size={28} color="#FFFFFF" />
      </View>
      <View style={styles.listContent}>
        <View style={styles.listTitleRow}>
          <Text style={[styles.listTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
            {event.title}
          </Text>
          {event.group_title ? <BadgeCheck size={16} color="#2F80ED" /> : null}
        </View>
        <Text style={[styles.listMeta, { color: COLORS.textSecondary }]}>
          {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
        </Text>
        {event.location ? (
          <Text style={[styles.listMeta, { color: COLORS.textTertiary }]} numberOfLines={1}>
            {event.location}
          </Text>
        ) : null}
      </View>
      <View style={styles.listActions}>
        <Pressable onPress={onSave} style={styles.listActionButton}>
          <Heart size={20} color={saved ? '#FF4D6D' : COLORS.textSecondary} fill={saved ? '#FF4D6D' : 'none'} />
        </Pressable>
        <Pressable onPress={onShare} style={styles.listActionButton}>
          <Share2 size={20} color={COLORS.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onSchedule}
          style={[
            styles.listActionButton,
            {
              backgroundColor: scheduled
                ? '#3CCB6C'
                : isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(15,23,42,0.06)',
            },
          ]}
        >
          <Check size={20} color={scheduled ? '#FFFFFF' : '#3CCB6C'} />
        </Pressable>
      </View>
    </Pressable>
  );
}
