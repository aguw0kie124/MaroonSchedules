import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft,
  Database,
  Flame,
  Scale,
  Settings2,
  Ticket,
  UtensilsCrossed,
  ChevronRight,
} from 'lucide-react-native';

import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { getDiningMealPeriodForLocation } from '../../services/diningMenuCache';
import { Card, SectionLabel, ActionButton } from './DiningUI';

const TAMU_HALLS = [
  { key: 'Sbisa', label: 'Sbisa', sub: 'North Campus' },
  { key: 'Commons', label: 'Commons', sub: 'South Campus' },
  { key: 'Duncan', label: 'Duncan', sub: 'South / Quad' },
];
const UTD_HALLS = [
  { key: 'Dining Hall West', label: 'Dining Hall West', sub: 'Main Campus' },
  { key: 'Student Union', label: 'Student Union', sub: 'Food Court' },
  { key: 'Activity Center', label: 'Activity Center', sub: 'Campus Dining' },
];

const DASHBOARD_TOOLS = [
  {
    key: 'tracker',
    title: 'Meal Tracker',
    subtitle: 'Daily calories, macros, micronutrients, and meal log history.',
    route: 'MealTracker',
    icon: UtensilsCrossed,
  },
  {
    key: 'weight',
    title: 'Weight Tracker',
    subtitle: 'Body-weight logging and progress trends.',
    route: 'WeightTracker',
    icon: Scale,
  },
  {
    key: 'streaks',
    title: 'Streaks',
    subtitle: 'View consistency, streak counts, and goal-hit calendar history.',
    route: 'StreakHub',
    icon: Flame,
  },
  {
    key: 'swipes',
    title: 'Retail Swipes',
    subtitle: 'See the old retail swipe helper and related calculations.',
    route: 'RetailSwipes',
    icon: Ticket,
  },
  {
    key: 'database',
    title: 'Food Database',
    subtitle: 'Search dining nutrition details directly.',
    route: 'FoodDatabase',
    icon: Database,
  },
  {
    key: 'settings',
    title: 'Settings',
    subtitle: 'Body profile, goals, calorie targets, and advanced nutrition preferences.',
    route: 'DiningSettings',
    icon: Settings2,
  },
] as const;

export default function DiningDashboard({ navigation }: any) {
  const { COLORS, theme } = useTheme();
  const darkMode = theme === 'dark';
  const styles = getStyles(COLORS, darkMode);
  const T = useDiningTheme(darkMode);

  const [hall, setHall] = useState('Sbisa');
  const [selectedCampus, setSelectedCampus] = useState<'TAMU' | 'UTD'>('TAMU');
  const halls = useMemo(
    () => (selectedCampus === 'UTD' ? UTD_HALLS : TAMU_HALLS),
    [selectedCampus],
  );

  useEffect(() => {
    AsyncStorage.getItem('selected_campus')
      .then((value) => {
        if (value === 'UTD' || value === 'TAMU') {
          setSelectedCampus(value);
        }
      })
      .catch((error) => {
        console.warn('Failed to load selected campus for dining dashboard', error);
      });
  }, []);

  useEffect(() => {
    if (!halls.some((entry) => entry.key === hall)) {
      setHall(halls[0]?.key || 'Sbisa');
    }
  }, [hall, halls]);

  const openFullMenu = () => {
    const mealPeriod = getDiningMealPeriodForLocation(hall);
    navigation.navigate('FullMenu', {
      location: hall,
      mealPeriod,
      title: `${hall} Menu`,
      sourceHint: selectedCampus === 'UTD' ? 'utd-live' : 'cached',
    });
  };

  const selectedGlassFill = darkMode ? T.tamuGold + '18' : 'rgba(12,12,14,0.84)';
  const selectedGlassText = darkMode ? T.tamuGold : '#FFFFFF';
  const selectedGlassSub = darkMode ? T.text3 : 'rgba(255,255,255,0.72)';

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
            <Text style={styles.eyebrow}>Advanced</Text>
            <Text style={styles.title}>Nutrition Dashboard</Text>
            <Text style={styles.subtitle}>
              This stays off the main product path, but all the old calorie-tracker tools still live here.
            </Text>
          </View>
        </View>

        {/* New Live Menus Section */}
        <Card style={{ paddingVertical: 14 }}>
          <SectionLabel>Live Menus</SectionLabel>
          <Text style={[styles.subtitle, { marginTop: -4, marginBottom: 12 }]}>
            Jump straight into any dining hall menu without leaving the nutrition tools flow.
          </Text>
          <View style={s.chipRow}>
            {halls.map(h => (
              <TouchableOpacity key={h.key} 
                  style={[
                    s.chip,
                    s.glassChip,
                    { borderColor: T.btnBorder, backgroundColor: T.btnBg },
                    hall === h.key && {
                      borderColor: darkMode ? T.tamuGold : 'rgba(12,12,14,0.88)',
                      backgroundColor: selectedGlassFill,
                    },
                  ]} 
                  onPress={() => setHall(h.key)}>
                <Text style={[s.chipText, { color: T.text2 }, hall === h.key && { color: selectedGlassText }]}>{h.label}</Text>
                <Text style={[s.chipSub, { color: T.text3 }, hall === h.key && { color: selectedGlassSub }]}>{h.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ marginTop: 14 }}>
            <ActionButton 
              label={`View ${hall} Dining Hall Menu`} 
              onPress={openFullMenu}
              style={{ backgroundColor: T.tamuMaroon }}
              textStyle={{ color: T.text }}
            />
          </View>
        </Card>

        <View style={styles.card}>
          {DASHBOARD_TOOLS.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Pressable
                key={tool.key}
                style={[styles.toolRow, index === DASHBOARD_TOOLS.length - 1 && styles.toolRowLast]}
                onPress={() => navigation.navigate(tool.route)}
              >
                <View style={styles.toolIconWrap}>
                  <Icon size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toolTitle}>{tool.title}</Text>
                  <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
                </View>
                <ChevronRight size={16} color={COLORS.textTertiary} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  chip: { 
    flex: 1, 
    minWidth: 80,
    alignItems: 'center', 
    padding: 13, 
    borderRadius: 20, 
    borderWidth: 1,
    gap: 3 
  },
  glassChip: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  chipText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipSub: { fontSize: 10, fontWeight: '600' },
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
      padding: 18,
      paddingTop: 20,
      paddingBottom: 48,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
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
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: COLORS.textSecondary,
      marginBottom: 6,
    },
    title: {
      fontSize: 29,
      fontWeight: '900',
      letterSpacing: -0.8,
      color: COLORS.textPrimary,
    },
    subtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: COLORS.textSecondary,
    },
    card: {
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.88)',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 18,
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
