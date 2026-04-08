import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { CalendarDays, Dumbbell, GraduationCap, Library, MapPin, Star, UtensilsCrossed, Share2 } from 'lucide-react-native';
import { useTheme, Card } from './SharedUI';
import { useShareStore } from '../store/shareStore';
import { fetchCampusPlacesMap } from '../api/client';

interface ForYouItem {
  id: string;
  name: string;
  category: 'Study' | 'Dining' | 'Rec' | 'Library' | 'Event' | 'Other';
  percentFull: number;
  available: number;
  reason: string;
}

const CATEGORY_CONFIG: Record<string, { Icon: any; color: string }> = {
  Study: { Icon: GraduationCap, color: '#8B5CF6' },
  Dining: { Icon: UtensilsCrossed, color: '#F59E0B' },
  Rec: { Icon: Dumbbell, color: '#10B981' },
  Library: { Icon: Library, color: '#3B82F6' },
  Event: { Icon: CalendarDays, color: '#EC4899' },
  Other: { Icon: MapPin, color: '#6B7280' },
};

function classifyLocation(name: string): ForYouItem['category'] {
  const n = name.toLowerCase();
  if (n.includes('library') || n.includes('annex') || n.includes('wcl') || n.includes('evans') || n.includes('cushing')) return 'Library';
  if (n.includes('rec') || n.includes('pool') || n.includes('gym') || n.includes('court') || n.includes('field') || n.includes('climbing') || n.includes('turf')) return 'Rec';
  if (n.includes('dining') || n.includes('sbisa') || n.includes('commons') || n.includes('cafe') || n.includes('chick') || n.includes('starbucks') || n.includes('food')) return 'Dining';
  if (n.includes('study') || n.includes('lounge')) return 'Study';
  return 'Other';
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTimeRecommendation(): string {
  const h = new Date().getHours();
  if (h < 10) return 'Start your day at a quiet spot';
  if (h < 14) return 'Great time to grab lunch or study';
  if (h < 18) return 'Afternoon pick-me-up? Try these';
  return 'Wind down at these spots';
}

export function ForYouScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const openShare = useShareStore(state => state.openShare);
  const {
    data: locations = [],
    isLoading: loading,
    refetch,
    isRefetching: refreshing,
  } = useQuery({
    queryKey: ['for-you-locations'],
    queryFn: async () => {
      const snapshot = await fetchCampusPlacesMap();
      const data: { location: string; percent_full: number }[] = Array.isArray(snapshot?.locations)
        ? snapshot.locations
        : [];

      const items: ForYouItem[] = data.map((d, i) => {
        const cat = classifyLocation(d.location);
        const available = Math.max(0, Math.round((100 - d.percent_full) * 2));
        let reason = '';
        if (d.percent_full < 30) reason = 'Very quiet right now — great pick!';
        else if (d.percent_full < 50) reason = 'Not too busy, plenty of space';
        else if (d.percent_full < 70) reason = 'Moderate traffic, might fill up';
        else reason = 'Getting busy — go soon or try later';

        return {
          id: `${d.location}-${i}`,
          name: d.location,
          category: cat,
          percentFull: d.percent_full,
          available,
          reason,
        };
      });

      items.sort((a, b) => a.percentFull - b.percentFull);
      return items;
    },
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const categories = useMemo(() => {
    const cats = new Set(locations.map((l) => l.category));
    return ['All', ...Array.from(cats)];
  }, [locations]);

  const filtered = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'All') return locations.slice(0, 15);
    return locations.filter((l) => l.category === selectedCategory).slice(0, 15);
  }, [locations, selectedCategory]);

  const getCapacityColor = (pct: number) => {
    if (pct < 40) return '#32D74B';
    if (pct < 70) return '#FF9500';
    return '#FF3B30';
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Personalizing your feed…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{getTimeGreeting()}, Aggie!</Text>
        <Text style={styles.subtitle}>{getTimeRecommendation()}</Text>
      </View>

      {/* Category filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {categories.map((cat) => {
          const isActive = (selectedCategory || 'All') === cat;
          const Icon = cat !== 'All' ? CATEGORY_CONFIG[cat]?.Icon : null;
          return (
            <Pressable
              key={cat}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat === 'All' ? null : cat)}
            >
              <View style={styles.filterChipContent}>
                {Icon ? <Icon size={14} color="#FFFFFF" /> : null}
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {cat}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Top picks section */}
        {!selectedCategory && filtered.length >= 3 && (
          <>
            <Text style={styles.sectionLabel}>Top Picks Right Now</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topRow} contentContainerStyle={styles.topContent}>
              {filtered.slice(0, 4).map((item) => (
                (() => {
                  const Icon = CATEGORY_CONFIG[item.category]?.Icon || Star;
                  return (
                    <Card key={item.id} style={styles.topCard}>
                      <View style={[styles.topIconWrap, { backgroundColor: CATEGORY_CONFIG[item.category]?.color + '22' }]}>
                        <Icon size={24} color={CATEGORY_CONFIG[item.category]?.color || '#FFFFFF'} />
                      </View>
                  <Text style={styles.topName} numberOfLines={2}>{item.name}</Text>
                  <View style={[styles.topBadge, { backgroundColor: getCapacityColor(item.percentFull) }]}>
                    <Text style={styles.topBadgeText}>{item.percentFull}%</Text>
                  </View>
                   <Text style={styles.topReason} numberOfLines={2}>{item.reason}</Text>
                   <Pressable 
                     style={styles.cardShareBtn}
                     onPress={() => openShare({
                       title: item.name,
                       message: `Check out ${item.name} on MaroonSchedules! ${item.reason}`,
                       url: 'https://maroonschedules.tamu.edu'
                     })}
                   >
                     <Share2 size={16} color={COLORS.textSecondary} />
                   </Pressable>
                    </Card>
                  );
                })()
              ))}
            </ScrollView>
          </>
        )}

        {/* Full list */}
        <Text style={styles.sectionLabel}>All Spots</Text>
        {filtered.map((item) => (
          (() => {
            const Icon = CATEGORY_CONFIG[item.category]?.Icon || MapPin;
            return (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={[styles.itemIconBg, { backgroundColor: CATEGORY_CONFIG[item.category]?.color + '22' }]}>
                    <Icon size={18} color={CATEGORY_CONFIG[item.category]?.color || '#FFFFFF'} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemReason}>{item.reason}</Text>
                  </View>
                  <View style={styles.itemStats}>
                    <Text style={[styles.itemPct, { color: getCapacityColor(item.percentFull) }]}>
                      {item.percentFull}%
                    </Text>
                     <Text style={styles.itemAvail}>{item.available} avail</Text>
                     <Pressable 
                       style={styles.rowShareBtn}
                       onPress={() => openShare({
                         title: item.name,
                         message: `Check out ${item.name} on MaroonSchedules! ${item.reason}`,
                         url: 'https://maroonschedules.tamu.edu'
                       })}
                     >
                       <Share2 size={16} color={COLORS.textSecondary} />
                     </Pressable>
                   </View>
                </View>
                <View style={styles.miniBar}>
                  <View style={[styles.miniBarFill, { width: `${Math.min(item.percentFull, 100)}%`, backgroundColor: getCapacityColor(item.percentFull) }]} />
                </View>
              </Card>
            );
          })()
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 15 },
  header: {
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: COLORS.primary, borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  greeting: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  filterRow: { maxHeight: 50, backgroundColor: COLORS.background },
  filterContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#2A2A2A' },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  filterChipTextActive: { color: '#FFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: 18, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  topRow: { marginBottom: 8 },
  topContent: { gap: 12, flexDirection: 'row', paddingRight: 16 },
  topCard: { width: 150, padding: 14, alignItems: 'center' },
  topIconWrap: { width: 52, height: 52, borderRadius: 26, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  topName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 6 },
  topBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6 },
  topBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  topReason: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  itemCard: { marginBottom: 8, padding: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIconBg: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  itemReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  itemStats: { alignItems: 'flex-end' },
  itemPct: { fontSize: 16, fontWeight: '800' },
  itemAvail: { fontSize: 11, color: COLORS.textSecondary },
  miniBar: { height: 3, backgroundColor: '#1E1E1E', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },
  cardShareBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
  },
  rowShareBtn: {
    marginTop: 8,
    padding: 4,
  },
});
