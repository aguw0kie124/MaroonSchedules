import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import {
  ArrowLeft,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { getDiningMealPeriodForLocation } from '../../services/diningMenuCache';
import { requestJson } from '../../api/client';
import { getLocalDateString } from '../../services/dateUtils';
import { Card, ActionButton } from './DiningUI';
import { computeDiningStreakStats } from '../../services/diningStreaks';
import FoodDatabaseScreen from './FoodDatabaseScreen';

const HALLS = [
  { key: 'Sbisa', label: 'Sbisa', sub: 'North Campus' },
  { key: 'Commons', label: 'Commons', sub: 'South Campus' },
  { key: 'Duncan', label: 'Duncan', sub: 'South / Quad' },
];

export default function DiningDashboard({ navigation }: any) {
  const { user } = useUser();
  const { COLORS, theme } = useTheme();
  const darkMode = theme === 'dark';
  const styles = getStyles(COLORS, darkMode);
  const T = useDiningTheme(darkMode);

  const [hall, setHall] = useState('Sbisa');
  const [tracker, setTracker] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [trackerLoading, setTrackerLoading] = useState(true);
  const [trackerDate, setTrackerDate] = useState(getLocalDateString());
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const shiftDate = useCallback((days: number) => {
    const d = new Date(trackerDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    setTrackerDate(d.toISOString().split('T')[0]);
  }, [trackerDate]);

  const openFullMenu = () => {
    const mealPeriod = getDiningMealPeriodForLocation(hall);
    navigation.navigate('FullMenu', {
      location: hall,
      mealPeriod,
      title: `${hall} Menu`,
      sourceHint: 'cached',
    });
  };

  const loadTrackerSummary = useCallback(async () => {
    if (!user) return;
    setTrackerLoading(true);
    try {
      const [trackerRes, profileRes, historyRes] = await Promise.all([
        requestJson(`/dining/tracker/${encodeURIComponent(user.id)}?date=${encodeURIComponent(trackerDate)}`),
        requestJson(`/dining/profile/${encodeURIComponent(user.id)}`),
        requestJson(`/dining/history/${encodeURIComponent(user.id)}?days=180`),
      ]);
      setTracker(trackerRes);
      setProfile(profileRes);
      setHistory(Array.isArray(historyRes) ? historyRes : []);
    } catch (error) {
      console.warn('Failed to load meal tracker summary', error);
    } finally {
      setTrackerLoading(false);
    }
  }, [user, trackerDate]);

  useEffect(() => {
    loadTrackerSummary();
  }, [loadTrackerSummary]);

  const selectedGlassFill = darkMode ? T.tamuGold + '18' : 'rgba(12,12,14,0.84)';
  const selectedGlassText = darkMode ? T.tamuGold : '#FFFFFF';
  const selectedGlassSub = darkMode ? T.text3 : 'rgba(255,255,255,0.72)';
  const totals = tracker?.totals || {};
  const target = profile?.targetCalories || 2000;
  const macros = profile?.macros || { protein: 150, carbs: 200, fat: 60 };
  const streakMode = profile?.mode || 'maintain';
  const currentStreak = computeDiningStreakStats(history, target, streakMode).currentStreak;
  const trackerStats = [
    { label: 'Calories', value: `${Math.round(totals.calories || 0)}`, suffix: `/ ${target} kcal`, color: T.text },
    { label: 'Protein', value: `${Math.round(totals.protein || 0)}`, suffix: ` / ${Math.round(macros.protein)}`, color: T.sage },
    { label: 'Carbs', value: `${Math.round(totals.carbs || 0)}`, suffix: ` / ${Math.round(macros.carbs)}`, color: T.sky },
    { label: 'Fat', value: `${Math.round(totals.fat || 0)}`, suffix: ` / ${Math.round(macros.fat)}`, color: T.tamuGold },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HALL SWITCHER */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: COLORS.textPrimary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '800' }}>Dining Locations</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {HALLS.map((h) => {
              const selected = hall === h.key;
              return (
                <Pressable
                  key={h.key}
                  onPress={() => setHall(h.key)}
                  style={{
                    flex: 1,
                    backgroundColor: selected ? (darkMode ? T.tamuGold : COLORS.primary) : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'),
                    borderRadius: 18,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: selected ? 0 : 1,
                    borderColor: COLORS.border,
                    gap: 4
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: selected ? (darkMode ? '#000' : '#FFF') : COLORS.textPrimary }}>{h.label}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: selected ? (darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)') : COLORS.textTertiary, textTransform: 'uppercase' }}>{h.sub.split(' ')[0]}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={openFullMenu}
            style={({ pressed }) => ({
              backgroundColor: COLORS.primary,
              paddingVertical: 16,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
              opacity: pressed ? 0.9 : 1,
              flexDirection: 'row',
              gap: 8,
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 5
            })}
          >
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>Explore Full Menu</Text>
            <ChevronRight size={18} color="#FFF" />
          </Pressable>
        </View>

        <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 4 }} />

        {/* TRACKER */}
        <View style={{ gap: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.amber + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: T.amber, textTransform: 'uppercase', letterSpacing: 0.8 }}>{currentStreak} Day Streak</Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.textPrimary }}>{trackerDate === getLocalDateString() ? 'Today' : trackerDate}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => shiftDate(-1)} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                <ChevronLeft size={20} color={COLORS.textPrimary} />
              </Pressable>
              <Pressable onPress={() => shiftDate(1)} disabled={trackerDate === getLocalDateString()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, opacity: trackerDate === getLocalDateString() ? 0.3 : 1 }}>
                <ChevronRight size={20} color={COLORS.textPrimary} />
              </Pressable>
            </View>
          </View>

          {trackerLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Calories', val: totals.calories || 0, goal: target, suffix: 'kcal', color: COLORS.primary },
                { label: 'Protein', val: totals.protein || 0, goal: macros.protein || 150, suffix: 'g', color: '#10B981' },
                { label: 'Carbs', val: totals.carbs || 0, goal: macros.carbs || 250, suffix: 'g', color: '#3B82F6' },
                { label: 'Fat', val: totals.fat || 0, goal: macros.fat || 80, suffix: 'g', color: '#F59E0B' },
              ].map((stat) => (
                <View key={stat.label} style={{ width: '48%', backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : '#FFF', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>{stat.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.textPrimary }}>{Math.round(stat.val)}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginBottom: 4, fontWeight: '700' }}>{stat.suffix}</Text>
                  </View>
                  <View style={{ marginTop: 12, height: 6, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, (stat.val / stat.goal) * 100)}%`, height: '100%', backgroundColor: stat.color }} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {tracker?.entries?.length > 0 && !trackerLoading && (
            <View style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 }} onPress={() => setHistoryExpanded(!historyExpanded)} activeOpacity={0.7}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.textPrimary }}>Summary of meals</Text>
                {historyExpanded ? <ChevronUp size={20} color={COLORS.textTertiary} /> : <ChevronDown size={20} color={COLORS.textTertiary} />}
              </TouchableOpacity>
              {historyExpanded && (
                <View style={{ padding: 20, paddingTop: 0 }}>
                  {(() => {
                    const grouped = (tracker.entries || []).reduce((acc: any, entry: any) => {
                      const p = entry.meal_period === 'every-day' ? 'Restaurants' : (entry.meal_period || 'Other');
                      if (!acc[p]) acc[p] = [];
                      acc[p].push(entry);
                      return acc;
                    }, {});
                    return Object.entries(grouped).map(([period, items]: any, pIdx, pArr) => (
                      <View key={period} style={{ marginTop: pIdx === 0 ? 0 : 16 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 1, marginBottom: 8 }}>{period.toUpperCase()}</Text>
                        {items.map((it: any, iIdx: number, iArr: any[]) => (
                          <View key={it.id} style={{ paddingVertical: 10, borderBottomWidth: iIdx === iArr.length - 1 ? 0 : 1, borderBottomColor: COLORS.border }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textPrimary }}>{it.label}</Text>
                            <Text style={{ fontSize: 12, color: COLORS.textTertiary, marginTop: 2 }}>
                              {Math.round(it.calories)} kcal • {Math.round(it.protein)}g P • {Math.round(it.carbs)}g C • {Math.round(it.fat)}g F
                            </Text>
                          </View>
                        ))}
                      </View>
                    ));
                  })()}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  menuCard: {
    paddingTop: 16,
    paddingBottom: 18,
  },
  chipRow: { flexDirection: 'row', gap: 10, marginTop: 8, justifyContent: 'space-between' },
  chip: {
    flex: 1,
    maxWidth: '31.5%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 124,
    paddingHorizontal: 10,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
  },
  glassChip: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  chipText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, textAlign: 'center', width: '100%' },
  chipSub: { fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 13, minHeight: 28 },
  menuActionRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuActionButton: {
    width: '38%',
    minHeight: 0,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 22,
  },
  menuActionButtonText: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  inlineSearchWrap: {
    flex: 1,
  },
  trackerCard: {
    paddingTop: 0,
    paddingBottom: 18,
  },
  daySwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
  },
  dateAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '800',
  },
  trackerHeaderRow: {
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakChipText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  settingsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  settingsChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  trackerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 16,
  },
  trackerStat: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  trackerStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  trackerStatValue: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  trackerStatSuffix: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  historySection: {
    marginTop: 18,
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  historyContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  historyGroup: {
    marginTop: 12,
  },
  historyGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  historyItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingRight: 10,
  },
  historyItemMacros: {
    fontSize: 12,
    fontWeight: '500',
  },
});

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: COLORS.background,
      container: {
        flex: 1,
        backgroundColor: COLORS.background,
      },
      contentContainerStyle: {
        paddingHorizontal: 18,
        paddingTop: 0,
        paddingBottom: 40,
        gap: 14,
      },
      alignItems: 'center',
      marginBottom: 4,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(80,0,0,0.06)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    title: {
      fontSize: 27,
      fontWeight: '900',
      letterSpacing: -1,
      color: COLORS.textPrimary,
    },
    card: {
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.88)',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    toolRowLast: {
      borderBottomWidth: 0,
    },
    toolIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(80,0,0,0.22)' : 'rgba(80,0,0,0.08)',
    },
    toolTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    toolSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
  });
