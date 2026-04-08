import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  LinearTransition,
} from 'react-native-reanimated';
import {
  X,
  MapPin,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Zap,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../SharedUI';
import { Image } from 'react-native';
import type { CampusHotspot } from '../../services/campusPulse';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PulseHotspotSheetProps {
  visible: boolean;
  hotspot: CampusHotspot | null;
  onClose: () => void;
  onOpenPlace: (hotspot: CampusHotspot) => void;
  onOpenItem: (hotspot: CampusHotspot, item: any) => void;
  onVote: (hotspotId: string, itemId: string, target: number) => void;
}

export function PulseHotspotSheet({
  visible,
  hotspot,
  onClose,
  onOpenPlace,
  onOpenItem,
  onVote,
}: PulseHotspotSheetProps) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  if (!visible || !hotspot) return null;

  const categoryColor = hotspot.pulseColor || COLORS.primary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.pulseSheetOverlay} onPress={onClose}>
        <Animated.View 
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.duration(200)} 
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} 
        />
      </Pressable>

      <Animated.View
        entering={SlideInDown.duration(400).withCallback((finished) => {
          if (finished) {
            // Animation finished
          }
        })}
        exiting={SlideOutDown.duration(300)}
        style={[
          styles.pulseSheetContainer,
          { backgroundColor: isDark ? 'rgba(28, 28, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)' },
          { borderColor: COLORS.border + '40' },
        ]}
      >
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint={isDark ? 'dark' : 'light'} style={styles.blurContainer}>
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: COLORS.textTertiary + '40' }]} />
          </View>

          <View style={styles.pulseSheetHeader}>
            <View style={styles.pulseSheetHeaderTitleRow}>
              <View style={styles.titleContainer}>
                <Text style={[styles.pulseSheetTitle, { color: COLORS.textPrimary }]}>
                  {hotspot.locationName}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: categoryColor + '15' }]}>
                  <Zap size={12} color={categoryColor} fill={categoryColor} />
                  <Text style={[styles.pulseSheetStatus, { color: categoryColor }]}>
                    {hotspot.pulseLabel} · {hotspot.pingCount} Pings
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={[styles.pulseSheetCloseButton, { backgroundColor: COLORS.surfaceElevated }]}>
                <X size={20} color={COLORS.textTertiary} />
              </Pressable>
            </View>

            <View style={styles.pulseSheetActionRow}>
              <Pressable
                onPress={() => onOpenPlace(hotspot)}
                style={({ pressed }) => [
                  styles.pulseSheetPrimaryBtn,
                  { backgroundColor: categoryColor, opacity: pressed ? 0.8 : 1 }
                ]}
              >
                <LinearGradient
                  colors={[categoryColor, categoryColor + 'CC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnGradient}
                >
                  <MapPin size={18} color="#FFF" />
                  <Text style={styles.pulseSheetPrimaryBtnText}>View Location</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.pulseSheetItemsContent}
          >
            {hotspot.items.map((item, index) => (
              <Animated.View
                key={`${item.source}-${item.id}`}
                entering={FadeIn.delay(index * 50).duration(400)}
                layout={LinearTransition}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.pulseSheetItemCard,
                    { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      opacity: pressed ? 0.7 : 1
                    }
                  ]}
                  onPress={() => onOpenItem(hotspot, item)}
                >
                  <View style={styles.pulseSheetItemHeader}>
                    <View style={styles.sourceTag}>
                       <Text style={[styles.pulseSheetItemSource, { color: COLORS.textSecondary }]}>
                        {item.source === "event" ? "featured event" : "live ping"}
                      </Text>
                    </View>
                    <Text style={[styles.pulseSheetItemTime, { color: COLORS.textSecondary }]}>{item.timeLabel}</Text>
                  </View>
                  <Text style={[styles.pulseSheetItemTitle, { color: COLORS.textPrimary }]}>{item.title}</Text>
                  
                  {item.imageUrl && (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.pulseSheetItemImage}
                      resizeMode="cover"
                    />
                  )}
                  
                  <View style={styles.pulseSheetItemFooter}>
                    <Text style={[styles.pulseSheetItemMeta, { color: COLORS.textSecondary }]}>
                      {item.category}
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
                    </Text>
                    {item.source === "ping" && (
                      <ItemVoteControls
                        score={item.itemScore || 0}
                        userVote={item.userVote || 0}
                        onVote={(target) => {
                          onVote(hotspot.id, item.id, target);
                        }}
                        categoryColor={categoryColor}
                      />
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>
        </BlurView>
      </Animated.View>
    </View>
  );
}

function ItemVoteControls({ score, userVote, onVote, categoryColor }: { score: number, userVote: number, onVote: (target: number) => void, categoryColor: string }) {
  const { COLORS } = useTheme();

  return (
    <View style={[styles.itemVoteStack, { backgroundColor: COLORS.surfaceElevated }]}>
      <Pressable 
        onPress={() => onVote(userVote === 1 ? 0 : 1)}
        style={({ pressed }) => [
          styles.itemVoteButton, 
          userVote === 1 && { backgroundColor: categoryColor + '20' },
          pressed && { opacity: 0.7 }
        ]}
      >
        <ChevronUp size={18} color={userVote === 1 ? categoryColor : COLORS.textSecondary} strokeWidth={userVote === 1 ? 3 : 2} />
      </Pressable>
      <Text style={[styles.itemVoteScore, { color: COLORS.textPrimary }, userVote !== 0 && { color: userVote === 1 ? categoryColor : '#FF4D6D' }]}>
        {score}
      </Text>
      <Pressable 
        onPress={() => onVote(userVote === -1 ? 0 : -1)}
        style={({ pressed }) => [
          styles.itemVoteButton, 
          userVote === -1 && { backgroundColor: '#FF4D6D20' },
          pressed && { opacity: 0.7 }
        ]}
      >
        <ChevronDown size={18} color={userVote === -1 ? '#FF4D6D' : COLORS.textSecondary} strokeWidth={userVote === -1 ? 3 : 2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pulseSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  pulseSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.72,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
  },
  blurContainer: {
    flex: 1,
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  pulseSheetHeader: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  pulseSheetHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 16,
  },
  pulseSheetTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  pulseSheetStatus: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  pulseSheetCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseSheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pulseSheetPrimaryBtn: {
    borderRadius: 18,
    flex: 1,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  pulseSheetPrimaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  pulseSheetVoteStack: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 4,
  },
  pulseSheetVoteButton: {
    padding: 10,
    borderRadius: 14,
  },
  pulseSheetVoteScore: {
    fontSize: 17,
    fontWeight: '900',
    minWidth: 32,
    textAlign: 'center',
  },
  itemVoteStack: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  itemVoteButton: {
    padding: 6,
    borderRadius: 10,
  },
  itemVoteScore: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  pulseSheetItemsContent: {
    padding: 24,
    paddingBottom: 60,
  },
  pulseSheetItemCard: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  pulseSheetItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  pulseSheetItemSource: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pulseSheetItemTime: {
    fontSize: 13,
    fontWeight: '700',
  },
  pulseSheetItemTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  pulseSheetItemImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  pulseSheetItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pulseSheetItemMeta: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
});
