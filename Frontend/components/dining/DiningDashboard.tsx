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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Nutrition Dashboard</Text>
          </View>
        </View>

        <Card style={s.menuCard}>
          <View style={s.chipRow}>
            {HALLS.map(h => (
              <TouchableOpacity
                key={h.key}
                style={[
                  s.chip,
                  s.glassChip,
                  { borderColor: T.btnBorder, backgroundColor: T.btnBg },
                  hall === h.key && {
                    borderColor: darkMode ? T.tamuGold : 'rgba(12,12,14,0.88)',
                    backgroundColor: selectedGlassFill,
                  },
                ]}
                onPress={() => setHall(h.key)}
              >
                <Text
                  style={[s.chipText, { color: T.text2 }, hall === h.key && { color: selectedGlassText }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {h.label}
                </Text>
                <Text style={[s.chipSub, { color: T.text3 }, hall === h.key && { color: selectedGlassSub }]}>
                  {h.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.menuActionRow}>
            <ActionButton 
              label={`${hall} menu`}
              onPress={openFullMenu}
              style={[s.menuActionButton, { backgroundColor: T.tamuMaroon }]}
              textStyle={s.menuActionButtonText}
              textColor="#FFFFFF"
            />
            <View style={s.inlineSearchWrap}>
              <FoodDatabaseScreen navigation={navigation} embedded />
            </View>
          </View>
        </Card>

        <Card style={s.trackerCard}>
          <View style={[s.daySwitcherRow, { borderBottomColor: T.border }]}>
            <TouchableOpacity onPress={() => shiftDate(-1)} style={s.dateAction}>
              <ChevronLeft size={24} color={T.text2} />
            </TouchableOpacity>
            <Text style={[s.dayText, { color: T.text }]}>{trackerDate === getLocalDateString() ? 'Today' : trackerDate}</Text>
            <TouchableOpacity onPress={() => shiftDate(1)} style={s.dateAction} disabled={trackerDate === getLocalDateString()}>
              <ChevronRight size={24} color={trackerDate === getLocalDateString() ? T.border : T.text2} />
            </TouchableOpacity>
          </View>

          <View style={s.trackerHeaderRow}>
            <View style={s.headerActions}>
              <TouchableOpacity
                style={[s.streakChip, { backgroundColor: `${T.amber}14`, borderColor: `${T.amber}30` }]}
                onPress={() => navigation.navigate('StreakHub')}
                activeOpacity={0.8}
              >
                <Text style={s.streakEmoji}>🔥</Text>
                <Text style={[s.streakChipText, { color: T.amber }]}>{currentStreak}d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.settingsChip, { backgroundColor: T.bg3, borderColor: T.border }]}
                onPress={() => navigation.navigate('DiningSettings')}
                activeOpacity={0.8}
              >
                <Settings2 size={14} color={T.text2} />
                <Text style={[s.settingsChipText, { color: T.text2 }]}>Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
          {trackerLoading ? (
            <ActivityIndicator color={T.amber} style={{ marginVertical: 10 }} />
          ) : (
            <View style={s.trackerGrid}>
              {trackerStats.map((stat) => (
                <View key={stat.label} style={[s.trackerStat, { backgroundColor: T.bg3, borderColor: T.border }]}>
                  <Text style={[s.trackerStatLabel, { color: T.text3 }]}>{stat.label}</Text>
                  <Text style={[s.trackerStatValue, { color: stat.color }]} numberOfLines={1}>
                    {stat.value}
                  </Text>
                  <Text style={[s.trackerStatSuffix, { color: T.text3 }]} numberOfLines={1}>
                    {stat.suffix}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {tracker?.entries?.length > 0 && !trackerLoading && (
            <View style={[s.historySection, { borderColor: T.border, backgroundColor: T.bg3 }]}>
              <TouchableOpacity style={s.historyHeader} onPress={() => setHistoryExpanded(!historyExpanded)} activeOpacity={0.7}>
                <Text style={[s.historyTitle, { color: T.text }]}>What you ate</Text>
                {historyExpanded ? <ChevronUp size={20} color={T.text2} /> : <ChevronDown size={20} color={T.text2} />}
              </TouchableOpacity>
              {historyExpanded && (
                <View style={s.historyContent}>
                  {(() => {
                    const grouped = (tracker.entries || []).reduce((acc: any, entry: any) => {
                       const p = entry.meal_period === 'every-day' ? 'Restaurants' : (entry.meal_period || 'Other');
                       if (!acc[p]) acc[p] = [];
                       acc[p].push(entry);
                       return acc;
                    }, {});
                    return Object.entries(grouped).map(([period, items]: any) => (
                      <View key={period} style={s.historyGroup}>
                           <Text style={[s.historyGroupLabel, { color: T.text3 }]}>{period.toUpperCase()}</Text>
                           {items.map((it: any) => (
                             <View key={it.id} style={s.historyItem}>
                               <Text style={[s.historyItemName, { color: T.text }]}>{it.label}</Text>
                               <Text style={[s.historyItemMacros, { color: T.text3 }]}>
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
        </Card>
      </ScrollView>
    </SafeAreaView>
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
    },
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    contentContainer: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 40,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      gap: 14,
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
