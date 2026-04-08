import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  X,
  MapPin,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import { useTheme } from '../SharedUI';
import type { CampusHotspot } from '../../services/campusPulse';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PulseHotspotSheetProps {
  visible: boolean;
  hotspot: CampusHotspot | null;
  onClose: () => void;
  onOpenPlace: (hotspot: CampusHotspot) => void;
  onOpenItem: (hotspot: CampusHotspot, item: any) => void;
  onVote: (hotspotId: string, targetVote: number) => void;
}

export function PulseHotspotSheet({
  visible,
  hotspot,
  onClose,
  onOpenPlace,
  onOpenItem,
  onVote,
}: PulseHotspotSheetProps) {
  const { COLORS } = useTheme();

  if (!visible || !hotspot) return null;

  const categoryColor = hotspot.pulseColor || COLORS.primary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.pulseSheetOverlay} onPress={onClose}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View
        entering={SlideInDown.springify().damping(20)}
        exiting={SlideOutDown.springify().damping(25)}
        style={[
          styles.pulseSheetContainer,
          { backgroundColor: COLORS.surface, borderColor: COLORS.border },
        ]}
      >
        <View style={styles.pulseSheetHeader}>
          <View style={styles.pulseSheetHeaderTitleRow}>
            <View>
              <Text style={styles.pulseSheetTitle}>{hotspot.locationName}</Text>
              <Text style={[styles.pulseSheetStatus, { color: categoryColor }]}>
                {hotspot.pulseLabel} Area · {hotspot.pingCount} Active Pings
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.pulseSheetCloseButton}>
              <X size={20} color={COLORS.textTertiary} />
            </Pressable>
          </View>

          <View style={styles.pulseSheetActionRow}>
            <Pressable
              style={[styles.pulseSheetPrimaryBtn, { backgroundColor: categoryColor }]}
              onPress={() => onOpenPlace(hotspot)}
            >
              <MapPin size={18} color="#FFF" />
              <Text style={styles.pulseSheetPrimaryBtnText}>View Location</Text>
            </Pressable>
            
            <HotspotVoteControls 
              hotspot={hotspot} 
              onVote={(target) => onVote(hotspot.id, target)} 
            />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pulseSheetItemsContent}
        >
          {hotspot.items.map((item) => (
            <Pressable
              key={`${item.source}-${item.id}`}
              style={styles.pulseSheetItemCard}
              onPress={() => onOpenItem(hotspot, item)}
            >
              <View style={styles.pulseSheetItemHeader}>
                <Text style={styles.pulseSheetItemSource}>
                  {item.source === "event" ? "Featured Event" : "Live Ping"}
                </Text>
                <Text style={styles.pulseSheetItemTime}>{item.timeLabel}</Text>
              </View>
              <Text style={styles.pulseSheetItemTitle}>{item.title}</Text>
              <Text style={styles.pulseSheetItemMeta}>
                {item.category}
                {item.subtitle ? ` · ${item.subtitle}` : ""}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function HotspotVoteControls({ hotspot, onVote }: { hotspot: CampusHotspot; onVote: (target: number) => void }) {
  const { COLORS } = useTheme();
  const categoryColor = hotspot.pulseColor || COLORS.primary;

  return (
    <View style={styles.pulseSheetVoteStack}>
      <Pressable 
        onPress={() => onVote(1)}
        style={[styles.pulseSheetVoteButton, hotspot.userVote === 1 && { backgroundColor: categoryColor + '20' }]}
      >
        <ChevronUp size={24} color={hotspot.userVote === 1 ? categoryColor : COLORS.textSecondary} strokeWidth={hotspot.userVote === 1 ? 3 : 2} />
      </Pressable>
      <Text style={[styles.pulseSheetVoteScore, hotspot.userVote !== 0 && { color: hotspot.userVote === 1 ? categoryColor : '#FF4D6D' }]}>
        {hotspot.score || 0}
      </Text>
      <Pressable 
        onPress={() => onVote(-1)}
        style={[styles.pulseSheetVoteButton, hotspot.userVote === -1 && { backgroundColor: '#FF4D6D20' }]}
      >
        <ChevronDown size={24} color={hotspot.userVote === -1 ? '#FF4D6D' : COLORS.textSecondary} strokeWidth={hotspot.userVote === -1 ? 3 : 2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pulseSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pulseSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  pulseSheetHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  pulseSheetHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pulseSheetTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  pulseSheetStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  pulseSheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseSheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseSheetPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
    flex: 1,
    marginRight: 16,
  },
  pulseSheetPrimaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pulseSheetVoteStack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    paddingHorizontal: 4,
  },
  pulseSheetVoteButton: {
    padding: 10,
    borderRadius: 12,
  },
  pulseSheetVoteScore: {
    fontSize: 16,
    fontWeight: '900',
    minWidth: 28,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  pulseSheetItemsContent: {
    padding: 24,
    paddingBottom: 40,
  },
  pulseSheetItemCard: {
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  pulseSheetItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pulseSheetItemSource: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#6e6e73',
  },
  pulseSheetItemTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6e6e73',
  },
  pulseSheetItemTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  pulseSheetItemMeta: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6e6e73',
  },
});
