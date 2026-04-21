import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Coffee, Library, MapPin, Utensils } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { CampusSearchResult } from '../services/campusSearch';
import { formatDistance } from '../services/campusDirections';
import { getCategoryIcon } from './places/utils';

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
  onClearRoute?: () => void;
  onStartDirections?: () => void;
  insetBottom?: number;
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
  onClearRoute,
  onStartDirections,
  insetBottom = 28,
}: CampusBottomSheetProps) {
    const { COLORS, theme } = useTheme();
    const styles = getStyles(COLORS, theme === 'dark');
  const renderIcon = (item: CampusSearchResult) => {
    if (item.kind === 'command') {
      switch (item.commandType) {
        case 'nearest-restroom': return <MapPin size={18} color="#F3F1ED" />;
        case 'nearest-coffee': return <Coffee size={18} color="#F3F1ED" />;
        case 'nearest-library': return <Library size={18} color="#F3F1ED" />;
        case 'nearest-dining': return <Utensils size={18} color="#F3F1ED" />;
        default: return <MapPin size={18} color="#F3F1ED" />;
      }
    }
    if (item.location) return getCategoryIcon(item.location.type, '#F3F1ED', 18);
    return <MapPin size={18} color="#F3F1ED" />;
  };

  return (
    <View style={[styles.container, hasRoute ? styles.containerRoute : styles.containerBrowse, { bottom: insetBottom }]}>
      {!hasRoute ? <View style={styles.handleBar} /> : null}

      {hasRoute && destinationName ? (
        <View style={[styles.routeCard, routeAccentColor ? { borderColor: routeAccentColor } : null]}>
          <View style={styles.routeHeader}>
            <View style={[styles.routeModeBadge, routeAccentColor ? { backgroundColor: routeAccentColor } : null]}>
              <Text style={styles.routeModeBadgeText}>
                {routeMode === 'bus' ? 'Bus Route' : 'Walk Route'}
              </Text>
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
          {pinnedItems.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Quick Actions</Text>
              <View style={styles.quickRow}>
                {pinnedItems.map((item) => (
                  (() => {
                    return (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
                        onPress={() => onSelect(item)}
                      >
                        <View style={styles.quickIconWrap}>
                          {renderIcon(item)}
                        </View>
                        <Text style={styles.quickLabel} numberOfLines={2}>{item.label}</Text>
                      </Pressable>
                    );
                  })()
                ))}
              </View>
            </>
          ) : null}

          {/* Nearby */}
          {nearbyItems.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Nearby</Text>
              {nearbyItems.map((item) => (
                (() => {
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.nearbyRow, pressed && styles.nearbyRowPressed]}
                      onPress={() => onSelect(item)}
                    >
                      <View style={styles.nearbyIconWrap}>
                        {renderIcon(item)}
                      </View>
                      <View style={styles.nearbyText}>
                        <Text style={styles.nearbyLabel} numberOfLines={1}>{item.label}</Text>
                        <Text style={styles.nearbySub}>
                          {item.subtitle}
                          {item.distance != null ? ` • ${formatDistance(item.distance)}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })()
              ))}
            </>
          ) : (
            <View style={styles.emptyBrowseCard}>
              <Text style={styles.emptyBrowseTitle}>Search Anywhere</Text>
              <Text style={styles.emptyBrowseBody}>
                Search for any city, campus, address, or landmark worldwide to start directions.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    backgroundColor: isDark ? 'rgba(8,8,8,0.94)' : 'rgba(255,255,255,0.96)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.10)',
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(12,12,14,0.16)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  routeCard: {
    padding: 14,
    backgroundColor: isDark ? 'rgba(8,8,8,0.96)' : 'rgba(255,255,255,0.98)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 10,
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
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  routeSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
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
    justifyContent: 'flex-end',
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
    backgroundColor: isDark ? 'rgba(0,0,0,0.42)' : 'rgba(12,12,14,0.05)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : COLORS.border,
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
    backgroundColor: isDark ? 'rgba(0,0,0,0.38)' : 'rgba(12,12,14,0.03)',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : COLORS.border,
  },
  quickCardPressed: {
    backgroundColor: isDark ? '#1E1E1E' : 'rgba(12,12,14,0.05)',
    transform: [{ scale: 0.97 }],
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
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
    borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : COLORS.border,
  },
  nearbyRowPressed: {
    backgroundColor: isDark ? '#1E1E1E' : 'rgba(12,12,14,0.05)',
  },
  nearbyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
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
  emptyBrowseCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  emptyBrowseTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBrowseBody: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
