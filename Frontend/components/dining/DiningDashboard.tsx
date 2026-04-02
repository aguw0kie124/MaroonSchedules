import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  Calculator,
  Database,
  Flame,
  Scale,
  Settings2,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react-native';

import { useTheme } from '../SharedUI';

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
    key: 'optimizer',
    title: 'Meal Optimizer',
    subtitle: 'Build a dining-hall plan around calorie and macro targets.',
    route: 'MealOptimizer',
    icon: Calculator,
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
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

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
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
