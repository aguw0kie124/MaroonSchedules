import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { COLORS } from './SharedUI';
import { CampusSearchResult } from '../services/campusSearch';
import { formatDistance } from '../services/campusDirections';
import { getBuildingEmoji, getAmenityEmoji } from '../data/campus';

interface CampusBottomSheetProps {
  nearbyItems: CampusSearchResult[];
  pinnedItems: CampusSearchResult[];
  onSelect: (item: CampusSearchResult) => void;
  hasRoute: boolean;
  destinationName?: string;
  distanceLabel?: string;
  etaLabel?: string;
  onClearRoute?: () => void;
  onStartDirections?: () => void;
}

export function CampusBottomSheet({
  nearbyItems,
  pinnedItems,
  onSelect,
  hasRoute,
  destinationName,
  distanceLabel,
  etaLabel,
  onClearRoute,
  onStartDirections,
}: CampusBottomSheetProps) {
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
    <View style={styles.container}>
      {/* Handle bar */}
      <View style={styles.handleBar} />

      {/* Route info card */}
      {hasRoute && destinationName && (
        <View style={styles.routeCard}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle} numberOfLines={1}>Walking to {destinationName}</Text>
            <Text style={styles.routeSub}>{distanceLabel} • {etaLabel}</Text>
          </View>
          <View style={styles.routeBtns}>
            <Pressable
              style={({ pressed }) => [styles.startBtn, pressed && styles.btnPressed]}
              onPress={onStartDirections}
            >
              <Text style={styles.startBtnText}>Start</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && styles.btnPressed]}
              onPress={onClearRoute}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pinned quick actions */}
        {!hasRoute && (
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
        )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '45%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  routeSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  routeBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  startBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  clearBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    color: '#FFF',
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
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    borderBottomColor: COLORS.border,
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
