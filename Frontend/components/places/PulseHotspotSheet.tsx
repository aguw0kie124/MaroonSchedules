import React from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { ChevronDown, ChevronUp, ExternalLink, Flame, X } from 'lucide-react-native';

import { useTheme } from '../SharedUI';
import type { CampusHotspot, CampusHotspotItem } from '../../services/campusPulse';
import { FLOATING_CARD_BOTTOM_OFFSET } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PulseHotspotSheetProps {
  visible: boolean;
  hotspot: CampusHotspot | null;
  onClose: () => void;
  onOpenItem: (hotspot: CampusHotspot, item: CampusHotspotItem) => void;
  onVote: (hotspotId: string, itemId: string, target: number) => void;
}

export function PulseHotspotSheet({
  visible,
  hotspot,
  onClose,
  onOpenItem,
  onVote,
}: PulseHotspotSheetProps) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  if (!visible || !hotspot) return null;

  const categoryColor = hotspot.pulseColor || COLORS.primary;
  const previewLabel =
    hotspot.previewLabel?.trim() ||
    `${hotspot.items.length} update${hotspot.items.length === 1 ? '' : 's'}`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.overlayTapTarget} onPress={onClose} />

      <Animated.View
        entering={SlideInDown.duration(240)}
        exiting={SlideOutDown.duration(180)}
        style={styles.sheetWrap}
      >
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: isDark ? 'rgba(20,20,22,0.985)' : 'rgba(255,255,255,0.99)',
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(12,12,14,0.08)',
            },
          ]}
        >
          <View
            style={[
              styles.handle,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(12,12,14,0.12)' },
            ]}
          />

          <View style={styles.header}>
            <View style={styles.headerBody}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.statusBadge, { backgroundColor: `${categoryColor}18` }]}>
                  <Flame size={12} color={categoryColor} />
                  <Text style={[styles.statusLabel, { color: categoryColor }]}>{hotspot.pulseLabel}</Text>
                </View>
                <Text style={[styles.previewLabel, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {previewLabel}
                </Text>
              </View>

              <Text style={[styles.title, { color: COLORS.textPrimary }]} numberOfLines={2}>
                {hotspot.locationName}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.05)',
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <X size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>What&apos;s happening here</Text>
            <Text style={[styles.sectionMeta, { color: COLORS.textSecondary }]}>
              {hotspot.dominantCategory}
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.itemsScroll}
            contentContainerStyle={styles.itemsContent}
          >
            {hotspot.items.length ? (
              hotspot.items.map((item, index) => {
                const isEventLink = item.source === 'event' && !!item.link;
                const card = (
                  <View
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
                        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.05)',
                      },
                    ]}
                  >
                    <View style={styles.itemHeader}>
                      <Text style={[styles.itemSource, { color: categoryColor }]}>
                        {item.source === 'event' ? 'Featured Event' : 'Live Ping'}
                      </Text>
                      <Text style={[styles.itemTime, { color: COLORS.textSecondary }]}>{item.timeLabel}</Text>
                    </View>

                    <View style={styles.itemBodyRow}>
                      <View style={styles.itemBody}>
                        <Text style={[styles.itemTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={[styles.itemMeta, { color: COLORS.textSecondary }]} numberOfLines={2}>
                          {item.category}
                          {item.subtitle ? ` · ${item.subtitle}` : ''}
                        </Text>
                      </View>

                      {item.source === 'ping' ? (
                        <ItemVoteControls
                          score={item.itemScore || 0}
                          userVote={item.userVote || 0}
                          onVote={(target) => onVote(hotspot.id, item.id, target)}
                          categoryColor={categoryColor}
                        />
                      ) : isEventLink ? (
                        <View
                          style={[
                            styles.linkBadge,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.05)',
                            },
                          ]}
                        >
                          <ExternalLink size={14} color={COLORS.textSecondary} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                );

                return (
                  <Animated.View
                    key={`${item.source}-${item.id}`}
                    entering={FadeIn.delay(index * 35).duration(220)}
                    layout={LinearTransition}
                  >
                    {isEventLink ? (
                      <Pressable
                        onPress={() => onOpenItem(hotspot, item)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
                      >
                        {card}
                      </Pressable>
                    ) : (
                      card
                    )}
                  </Animated.View>
                );
              })
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
                    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.05)',
                  },
                ]}
              >
                <Text style={[styles.emptyTitle, { color: COLORS.textPrimary }]}>No live posts yet</Text>
                <Text style={[styles.emptyBody, { color: COLORS.textSecondary }]}>
                  This hotspot is quiet right now, but it will stay pinned on the Pulse map.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

function ItemVoteControls({
  score,
  userVote,
  onVote,
  categoryColor,
}: {
  score: number;
  userVote: number;
  onVote: (target: number) => void;
  categoryColor: string;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View
      style={[
        styles.voteStack,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F7',
        },
      ]}
    >
      <Pressable
        onPress={() => onVote(userVote === 1 ? 0 : 1)}
        style={({ pressed }) => [
          styles.voteButton,
          userVote === 1 && { backgroundColor: `${categoryColor}20` },
          pressed && { opacity: 0.72 },
        ]}
      >
        <ChevronUp
          size={16}
          color={userVote === 1 ? categoryColor : COLORS.textSecondary}
          strokeWidth={userVote === 1 ? 3 : 2}
        />
      </Pressable>

      <Text
        style={[
          styles.voteScore,
          { color: COLORS.textPrimary },
          userVote === 1 && { color: categoryColor },
          userVote === -1 && { color: '#FF4D6D' },
        ]}
      >
        {score}
      </Text>

      <Pressable
        onPress={() => onVote(userVote === -1 ? 0 : -1)}
        style={({ pressed }) => [
          styles.voteButton,
          userVote === -1 && { backgroundColor: 'rgba(255,77,109,0.14)' },
          pressed && { opacity: 0.72 },
        ]}
      >
        <ChevronDown
          size={16}
          color={userVote === -1 ? '#FF4D6D' : COLORS.textSecondary}
          strokeWidth={userVote === -1 ? 3 : 2}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayTapTarget: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheetWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: FLOATING_CARD_BOTTOM_OFFSET + 12,
    zIndex: 7000,
    elevation: 18,
  },
  sheetCard: {
    maxHeight: SCREEN_HEIGHT * 0.42,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemsScroll: {
    maxHeight: SCREEN_HEIGHT * 0.2,
  },
  itemsContent: {
    gap: 8,
    paddingBottom: 4,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  itemSource: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 3,
  },
  itemMeta: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  linkBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteStack: {
    width: 34,
    borderRadius: 17,
    alignItems: 'center',
    paddingVertical: 3,
    gap: 1,
  },
  voteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteScore: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
