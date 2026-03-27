import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { CampusSearchResult } from '../services/campusSearch';
import { formatDistance } from '../services/campusDirections';
import { getBuildingEmoji, getAmenityEmoji } from '../data/campus';

interface CampusBottomSheetProps {
  nearbyItems: CampusSearchResult[];
  pinnedItems: CampusSearchResult[];
  onSelect: (item: CampusSearchResult) => void;
  hasRoute: boolean;
  destinationName?: string;
  routeMode?: 'walk' | 'bus';
  routeTitle?: string;
  distanceLabel?: string;
  etaLabel?: string;
  routeMeta?: string;
  routeNote?: string | null;
  routeAccentColor?: string;
  isLoadingRoute?: boolean;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  onClearRoute?: () => void;
  onStartDirections?: () => void;
}

export function CampusBottomSheet({
  nearbyItems,
  pinnedItems,
  onSelect,
  hasRoute,
  destinationName,
  routeMode = 'walk',
  routeTitle,
  distanceLabel,
  etaLabel,
  routeMeta,
  routeNote,
  routeAccentColor,
  isLoadingRoute = false,
  voiceEnabled = true,
  onToggleVoice,
  onClearRoute,
  onStartDirections,
}: CampusBottomSheetProps) {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
  const getIcon = (item: CampusSearchResult) => {
    if (item.kind === 'command') {
      switch (item.commandType) {
        case 'nearest-restroom': return '🚻';
        case 'nearest-coffee': return '☕';
        case 'nearest-library': return '📚';
        case 'nearest-dining': return '🍔';
        default: return '📍';
      }
    }
    if (item.building) return getBuildingEmoji(item.building.type);
    if (item.amenity) return getAmenityEmoji(item.amenity.type);
    return '📍';
  };

  return (
    <View style={[styles.container, hasRoute ? styles.containerRoute : styles.containerBrowse]}>
      {!hasRoute ? <View style={styles.handleBar} /> : null}

      {hasRoute && destinationName ? (
        <View style={[styles.routeCard, routeAccentColor ? { borderColor: routeAccentColor } : null]}>
          <View style={styles.routeHeader}>
            <View style={[styles.routeModeBadge, routeAccentColor ? { backgroundColor: routeAccentColor } : null]}>
              <Text style={styles.routeModeBadgeText}>{routeMode === 'bus' ? 'Bus Route' : 'Walk Route'}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && styles.btnPressed]}
              onPress={onClearRoute}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle} numberOfLines={2}>
              {routeTitle || `${routeMode === 'bus' ? 'Bus' : 'Walk'} to ${destinationName}`}
            </Text>
            <Text style={styles.routeSub}>{distanceLabel} • {etaLabel}</Text>
            {routeMeta ? (
              <Text style={styles.routeMetaText} numberOfLines={2}>
                {routeMeta}
              </Text>
            ) : null}
            {routeNote ? (
              <Text style={styles.routeNoteText} numberOfLines={3}>
                {routeNote}
              </Text>
            ) : null}
          </View>
          <View style={styles.routeFooter}>
            <Pressable
              style={({ pressed }) => [styles.voiceBtn, pressed && styles.btnPressed]}
              onPress={onToggleVoice}
            >
              {voiceEnabled ? <Volume2 color={COLORS.primary} size={16} /> : <VolumeX color={COLORS.textSecondary} size={16} />}
              <Text style={[styles.voiceBtnText, !voiceEnabled && styles.voiceBtnTextMuted]}>
                {voiceEnabled ? 'Voice On' : 'Voice Off'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.startBtn, pressed && styles.btnPressed, isLoadingRoute && styles.startBtnDisabled]}
              onPress={onStartDirections}
              disabled={isLoadingRoute}
            >
              <Text style={styles.startBtnText}>
                {isLoadingRoute ? 'Loading…' : routeMode === 'bus' ? 'Start Trip' : 'Start Walk'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Pinned quick actions */}
          <>
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.quickRow}>
              {pinnedItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
                  onPress={() => onSelect(item)}
                >
                  <Text style={styles.quickIcon}>{getIcon(item)}</Text>
                  <Text style={styles.quickLabel} numberOfLines={2}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </>

          {/* Nearby */}
          <Text style={styles.sectionLabel}>Nearby</Text>
          {nearbyItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.nearbyRow, pressed && styles.nearbyRowPressed]}
              onPress={() => onSelect(item)}
            >
              <Text style={styles.nearbyIcon}>{getIcon(item)}</Text>
              <View style={styles.nearbyText}>
                <Text style={styles.nearbyLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.nearbySub}>
                  {item.subtitle}
                  {item.distance != null ? ` • ${formatDistance(item.distance)}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(8,8,8,0.94)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  containerBrowse: {
    maxHeight: '38%',
    paddingTop: 10,
  },
  containerRoute: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  routeCard: {
    padding: 18,
    backgroundColor: 'rgba(8,8,8,0.96)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeInfo: {
    gap: 4,
  },
  routeModeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  routeModeBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  routeTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
  },
  routeSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  routeMetaText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  routeNoteText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  routeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  voiceBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  voiceBtnTextMuted: {
    color: COLORS.textSecondary,
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    minWidth: 110,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  startBtnDisabled: {
    opacity: 0.65,
  },
  clearBtn: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  clearBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickCardPressed: {
    backgroundColor: '#1E1E1E',
    transform: [{ scale: 0.97 }],
  },
  quickIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  nearbyRowPressed: {
    backgroundColor: '#1E1E1E',
  },
  nearbyIcon: {
    fontSize: 22,
    marginRight: 14,
    width: 30,
    textAlign: 'center',
  },
  nearbyText: {
    flex: 1,
  },
  nearbyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  nearbySub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
