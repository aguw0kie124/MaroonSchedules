import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Clock3, ExternalLink, MessageCircle, X } from 'lucide-react-native';

import { useTheme } from '../SharedUI';
import type { CampusHotspot, CampusHotspotItem } from '../../services/campusPulse';
import { getCampusHotspotItemVoteScore } from '../../services/campusPulse';
import { PingCommentsModal } from '../pings/PingCommentsModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HORIZONTAL_MARGIN = 12;
const SHELL_WIDTH = Math.min(SCREEN_WIDTH - 56, 310);
const PREVIEW_WIDTH = SHELL_WIDTH - 16;
const PREVIEW_HEIGHT = 186;
const POINTER_SIZE = 12;
const SHELL_VERTICAL_PADDING = 8;
const BUBBLE_HEIGHT_ESTIMATE = PREVIEW_HEIGHT + 46;
const FIXED_BUBBLE_LEFT = Math.max(
  HORIZONTAL_MARGIN,
  Math.round((SCREEN_WIDTH - SHELL_WIDTH) / 2),
);
const FIXED_BUBBLE_TOP = clamp(
  Math.round((SCREEN_HEIGHT - BUBBLE_HEIGHT_ESTIMATE) / 2 - 56),
  76,
  SCREEN_HEIGHT - BUBBLE_HEIGHT_ESTIMATE - 128,
);
const FIXED_POINTER_LEFT = Math.round(SHELL_WIDTH / 2 - POINTER_SIZE);

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentTarget, setCommentTarget] = useState<CampusHotspotItem | null>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [hotspot?.id]);

  if (!visible || !hotspot) return null;

  const items = hotspot.items || [];

  const handleScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (items.length <= 1) return;
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / PREVIEW_WIDTH,
    );
    setActiveIndex(clamp(nextIndex, 0, items.length - 1));
  };

  const shellBackgroundColor = isDark
    ? 'rgba(18,18,22,0.96)'
    : 'rgba(255,255,255,0.98)';
  const shellBorderColor = isDark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(20,20,24,0.08)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.overlayTapTarget} onPress={onClose} />

      <Animated.View
        entering={FadeIn.duration(110)}
        exiting={FadeOut.duration(90)}
        style={[
          styles.sheetWrap,
          { left: FIXED_BUBBLE_LEFT, top: FIXED_BUBBLE_TOP },
        ]}
      >
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: shellBackgroundColor,
              borderColor: shellBorderColor,
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(20,20,24,0.05)',
                opacity: pressed ? 0.74 : 1,
              },
            ]}
          >
            <X size={15} color={COLORS.textPrimary} />
          </Pressable>

          {items.length ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                bounces={false}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                scrollEnabled={items.length > 1}
                style={styles.carousel}
                onMomentumScrollEnd={handleScrollEnd}
              >
                {items.map((item) => (
                  <PreviewPage
                    key={`${item.source}-${item.id}`}
                    hotspot={hotspot}
                    item={item}
                    isDark={isDark}
                    onOpenItem={onOpenItem}
                    onVote={onVote}
                    onOpenComments={setCommentTarget}
                  />
                ))}
              </ScrollView>

              {items.length > 1 ? (
                <View style={styles.dotsRow}>
                  {items.map((item, index) => (
                    <View
                      key={`dot-${item.id}`}
                      style={[
                        styles.dot,
                        {
                          width: index === activeIndex ? 9 : 7,
                          height: index === activeIndex ? 9 : 7,
                          backgroundColor:
                            index === activeIndex
                              ? hotspot.pulseColor
                              : isDark
                                ? 'rgba(255,255,255,0.18)'
                                : 'rgba(20,20,24,0.14)',
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.singleItemSpacer} />
              )}
            </>
          ) : (
            <EmptyPreviewCard hotspot={hotspot} />
          )}
        </View>

        <BubbleTail
          direction="down"
          left={FIXED_POINTER_LEFT}
          backgroundColor={shellBackgroundColor}
          borderColor={shellBorderColor}
        />
      </Animated.View>

      <PingCommentsModal
        visible={!!commentTarget}
        target={
          commentTarget?.activityId
            ? {
                activityId: commentTarget.activityId,
                title: commentTarget.title,
                subtitle: commentTarget.locationTag || hotspot.locationName,
                commentCount: commentTarget.commentCount || 0,
              }
            : null
        }
        onClose={() => setCommentTarget(null)}
      />
    </View>
  );
}

function PreviewPage({
  hotspot,
  item,
  isDark,
  onOpenItem,
  onVote,
  onOpenComments,
}: {
  hotspot: CampusHotspot;
  item: CampusHotspotItem;
  isDark: boolean;
  onOpenItem: (hotspot: CampusHotspot, item: CampusHotspotItem) => void;
  onVote: (hotspotId: string, itemId: string, target: number) => void;
  onOpenComments: (item: CampusHotspotItem) => void;
}) {
  const { COLORS } = useTheme();
  const hasImage = Boolean(item.imageUrl);
  const primaryText = hasImage ? '#FFFFFF' : COLORS.textPrimary;
  const secondaryText = hasImage ? 'rgba(255,255,255,0.82)' : COLORS.textSecondary;
  const subtitle =
    item.subtitle?.trim() ||
    (item.source === 'event' ? 'Campus organizer' : 'Aggie');
  const previewBackgroundColor = hasImage
    ? '#121318'
    : isDark
      ? 'rgba(28,28,34,1)'
      : '#FFFFFF';

  const cardContent = (
    <View
      style={[
        styles.previewShell,
        {
          backgroundColor: previewBackgroundColor,
          borderColor: hasImage
            ? 'rgba(255,255,255,0.08)'
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(20,20,24,0.06)',
        },
      ]}
    >
      {hasImage ? (
        <>
          <Image
            source={{ uri: item.imageUrl! }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[
              'rgba(8,10,14,0.18)',
              'rgba(8,10,14,0.32)',
              'rgba(8,10,14,0.84)',
            ]}
            style={StyleSheet.absoluteFillObject}
          />
        </>
      ) : null}

      <View style={styles.previewContent}>
        <View style={styles.previewTopRow}>
          <Text
            style={[
              styles.previewLocation,
              { color: hasImage ? 'rgba(255,255,255,0.88)' : hotspot.pulseColor },
            ]}
            numberOfLines={1}
          >
            {hotspot.locationName.toUpperCase()}
          </Text>
        </View>

        <View style={styles.previewBody}>
          <Text style={[styles.previewTitle, { color: primaryText }]} numberOfLines={3}>
            {item.title}
          </Text>
          <Text style={[styles.previewSubtitle, { color: secondaryText }]} numberOfLines={2}>
            {item.source === 'event' ? subtitle : `Posted by ${subtitle}`}
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.metaPill}>
              <Clock3 size={12} color={secondaryText} />
              <Text style={[styles.metaPillText, { color: secondaryText }]} numberOfLines={1}>
                {item.timeLabel}
              </Text>
            </View>

            {item.source === 'ping' ? (
              <View style={styles.pingActionRow}>
                <ItemVoteControls
                  score={getCampusHotspotItemVoteScore(item)}
                  userVote={item.userVote || 0}
                  onVote={(target) => onVote(hotspot.id, item.id, target)}
                  categoryColor={hotspot.pulseColor}
                  lightText={hasImage}
                />
                {item.activityId ? (
                  <Pressable
                    onPress={() => onOpenComments(item)}
                    style={({ pressed }) => [
                      styles.iconAction,
                      {
                        backgroundColor: hasImage
                          ? 'rgba(255,255,255,0.14)'
                          : `${hotspot.pulseColor}10`,
                        borderColor: hasImage
                          ? 'rgba(255,255,255,0.08)'
                          : `${hotspot.pulseColor}20`,
                        opacity: pressed ? 0.74 : 1,
                      },
                    ]}
                  >
                    <MessageCircle
                      size={14}
                      color={hasImage ? '#FFFFFF' : hotspot.pulseColor}
                    />
                    <Text
                      style={[
                        styles.iconActionLabel,
                        { color: hasImage ? '#FFFFFF' : hotspot.pulseColor },
                      ]}
                    >
                      {item.commentCount || 0}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : item.link ? (
              <Pressable
                onPress={() => onOpenItem(hotspot, item)}
                style={({ pressed }) => [
                  styles.iconAction,
                  {
                    backgroundColor: hasImage
                      ? 'rgba(255,255,255,0.14)'
                      : `${hotspot.pulseColor}10`,
                    borderColor: hasImage
                      ? 'rgba(255,255,255,0.08)'
                      : `${hotspot.pulseColor}20`,
                    opacity: pressed ? 0.74 : 1,
                  },
                ]}
              >
                <ExternalLink
                  size={14}
                  color={hasImage ? '#FFFFFF' : hotspot.pulseColor}
                />
              </Pressable>
            ) : (
              <View
                style={[
                  styles.eventPill,
                  {
                    backgroundColor: hasImage
                      ? 'rgba(255,255,255,0.14)'
                      : `${hotspot.pulseColor}10`,
                    borderColor: hasImage
                      ? 'rgba(255,255,255,0.08)'
                      : `${hotspot.pulseColor}20`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.eventPillText,
                    { color: hasImage ? '#FFFFFF' : hotspot.pulseColor },
                  ]}
                >
                  Event
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  if (item.link) {
    return (
      <Pressable
        onPress={() => onOpenItem(hotspot, item)}
        style={({ pressed }) => [
          styles.previewPage,
          pressed && styles.previewPressed,
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return <View style={styles.previewPage}>{cardContent}</View>;
}

function EmptyPreviewCard({ hotspot }: { hotspot: CampusHotspot }) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
      <View style={styles.previewPage}>
        <View
          style={[
            styles.previewShell,
            {
              backgroundColor: isDark ? 'rgba(28,28,34,1)' : '#FFFFFF',
              borderColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(20,20,24,0.06)',
            },
          ]}
        >
          <View style={styles.previewContent}>
            <View style={styles.previewTopRow}>
              <Text
                style={[styles.previewLocation, { color: hotspot.pulseColor }]}
                numberOfLines={1}
              >
                {hotspot.locationName.toUpperCase()}
              </Text>
            </View>

            <View style={styles.previewBody}>
              <Text style={[styles.previewTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
                No live posts yet
              </Text>
              <Text
                style={[styles.previewSubtitle, { color: COLORS.textSecondary }]}
                numberOfLines={3}
              >
                {hotspot.summary?.trim() || `${hotspot.locationName} is quiet right now.`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.singleItemSpacer} />
    </>
  );
}

function ItemVoteControls({
  score,
  userVote,
  onVote,
  categoryColor,
  lightText = false,
}: {
  score: number;
  userVote: number;
  onVote: (target: number) => void;
  categoryColor: string;
  lightText?: boolean;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View
      style={[
        styles.voteRail,
        {
          backgroundColor: lightText
            ? 'rgba(255,255,255,0.14)'
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : '#F4F5F8',
          borderColor: lightText
            ? 'rgba(255,255,255,0.08)'
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(20,20,24,0.05)',
        },
      ]}
    >
      <Pressable
        onPress={() => onVote(userVote === 1 ? 0 : 1)}
        style={({ pressed }) => [
          styles.voteButton,
          userVote === 1 && { backgroundColor: `${categoryColor}1F` },
          pressed && { opacity: 0.72 },
        ]}
      >
        <ChevronUp
          size={14}
          color={
            userVote === 1
              ? categoryColor
              : lightText
                ? '#FFFFFF'
                : COLORS.textSecondary
          }
          strokeWidth={userVote === 1 ? 3 : 2}
        />
      </Pressable>

      <Text
        style={[
          styles.voteScore,
          { color: lightText ? '#FFFFFF' : COLORS.textPrimary },
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
          size={14}
          color={
            userVote === -1
              ? '#FF4D6D'
              : lightText
                ? '#FFFFFF'
                : COLORS.textSecondary
          }
          strokeWidth={userVote === -1 ? 3 : 2}
        />
      </Pressable>
    </View>
  );
}

function BubbleTail({
  direction,
  left,
  backgroundColor,
  borderColor,
}: {
  direction: 'up' | 'down';
  left: number;
  backgroundColor: string;
  borderColor: string;
}) {
  return (
    <View
      style={[
        styles.tailWrap,
        direction === 'up' ? styles.tailWrapUp : styles.tailWrapDown,
        { left },
      ]}
    >
      <View
        style={[
          styles.tailBorder,
          direction === 'up' ? styles.tailBorderUp : styles.tailBorderDown,
          direction === 'up'
            ? { borderBottomColor: borderColor }
            : { borderTopColor: borderColor },
        ]}
      />
      <View
        style={[
          styles.tailFill,
          direction === 'up' ? styles.tailFillUp : styles.tailFillDown,
          direction === 'up'
            ? { borderBottomColor: backgroundColor }
            : { borderTopColor: backgroundColor },
        ]}
      />
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

const styles = StyleSheet.create({
  overlayTapTarget: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheetWrap: {
    position: 'absolute',
    width: SHELL_WIDTH,
    zIndex: 7000,
    elevation: 18,
  },
  sheetCard: {
    width: SHELL_WIDTH,
    borderRadius: 24,
    borderWidth: 1,
    padding: SHELL_VERTICAL_PADDING,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 14,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  carousel: {
    width: PREVIEW_WIDTH,
    alignSelf: 'center',
  },
  previewPage: {
    width: PREVIEW_WIDTH,
  },
  previewPressed: {
    opacity: 0.76,
  },
  previewShell: {
    height: PREVIEW_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  previewContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 30,
  },
  previewLocation: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  previewBody: {
    gap: 8,
    paddingTop: 6,
  },
  previewTitle: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  previewSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    maxWidth: '88%',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  voteRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  voteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteScore: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },
  pingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconAction: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
  },
  iconActionLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  eventPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  eventPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
  },
  dot: {
    borderRadius: 999,
  },
  singleItemSpacer: {
    height: 8,
  },
  tailWrap: {
    position: 'absolute',
    width: POINTER_SIZE * 2,
    height: POINTER_SIZE + 2,
  },
  tailWrapUp: {
    top: -(POINTER_SIZE + 1),
  },
  tailWrapDown: {
    bottom: -(POINTER_SIZE + 1),
  },
  tailBorder: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: POINTER_SIZE,
    borderRightWidth: POINTER_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tailBorderUp: {
    top: 0,
    borderBottomWidth: POINTER_SIZE + 1,
  },
  tailBorderDown: {
    bottom: 0,
    borderTopWidth: POINTER_SIZE + 1,
  },
  tailFill: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: POINTER_SIZE - 1,
    borderRightWidth: POINTER_SIZE - 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    left: 1,
  },
  tailFillUp: {
    top: 2,
    borderBottomWidth: POINTER_SIZE - 1,
  },
  tailFillDown: {
    bottom: 2,
    borderTopWidth: POINTER_SIZE - 1,
  },
});
