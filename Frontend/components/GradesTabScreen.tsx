// Frontend/components/GradesTabScreen.tsx
// Combined Grades tab screen with segmented control toggling between
// Grade Distributions and GPA Calculator sub-views.

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { BarChart2, CalendarDays, ChevronRight, Hash } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './SharedUI';
import { GradesScreen } from './GradesScreen';
import { GPACalculatorScreen } from './GPACalculatorScreen';

type Tab = 'distributions' | 'gpa';

const TABS: { key: Tab; label: string; icon: typeof BarChart2 }[] = [
  { key: 'distributions', label: 'Distributions', icon: BarChart2 },
  { key: 'gpa', label: 'GPA Calc', icon: Hash },
];

export function GradesTabScreen() {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('distributions');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [segmentWidths, setSegmentWidths] = useState<number[]>([]);
  const [segmentXs, setSegmentXs] = useState<number[]>([]);

  const handleLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setSegmentWidths((prev) => {
        const next = [...prev];
        next[index] = width;
        return next;
      });
      setSegmentXs((prev) => {
        const next = [...prev];
        next[index] = x;
        return next;
      });
    },
    [],
  );

  const switchTab = useCallback(
    (tab: Tab) => {
      const idx = TABS.findIndex((t) => t.key === tab);
      Animated.spring(slideAnim, {
        toValue: idx,
        useNativeDriver: false,
        friction: 20,
        tension: 180,
      }).start();
      setActiveTab(tab);
    },
    [slideAnim],
  );

  const indicatorWidth =
    segmentWidths.length === TABS.length && segmentWidths.every((w) => w > 0)
      ? slideAnim.interpolate({
          inputRange: TABS.map((_, i) => i),
          outputRange: segmentWidths,
        })
      : 0;

  const indicatorLeft =
    segmentXs.length === TABS.length && segmentXs.every((x) => x >= 0)
      ? slideAnim.interpolate({
          inputRange: TABS.map((_, i) => i),
          outputRange: segmentXs,
        })
      : 0;

  const styles = getStyles(COLORS, insets.top);

  return (
    <View style={styles.container}>
      {/* Top safe area background fill */}
      <View style={[styles.topSafe, { height: insets.top }]} />

      {/* Schedule planner entry */}
      <View style={styles.scheduleEntryWrap}>
        <Pressable
          style={({ pressed }) => [
            styles.scheduleEntryBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => navigation.navigate('ScheduleList')}
        >
          <View style={[styles.scheduleEntryIcon, { backgroundColor: `${COLORS.primary}18` }]}>
            <CalendarDays size={20} color={COLORS.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.scheduleEntryText}>
            <Text style={styles.scheduleEntryTitle}>Schedule Planner</Text>
            <Text style={styles.scheduleEntrySub}>Build and manage your class schedules</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>
      </View>

      {/* Segmented control header */}
      <View style={styles.headerWrap}>
        <View style={styles.segmentedControl}>
          {/* Animated indicator */}
          {indicatorWidth !== 0 && indicatorLeft !== 0 && (
            <Animated.View
              style={[
                styles.indicator,
                {
                  width: indicatorWidth,
                  left: indicatorLeft,
                },
              ]}
            />
          )}

          {TABS.map((tab, index) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <Pressable
                key={tab.key}
                style={styles.segmentBtn}
                onPress={() => switchTab(tab.key)}
                onLayout={(e) => handleLayout(index, e)}
              >
                <Icon
                  size={16}
                  color={isActive ? COLORS.textPrimary : COLORS.textTertiary}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    isActive && styles.segmentLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'distributions' && <GradesScreen />}
        {activeTab === 'gpa' && <GPACalculatorScreen embedded />}
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    topSafe: {
      backgroundColor: COLORS.background,
    },
    scheduleEntryWrap: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
      backgroundColor: COLORS.background,
    },
    scheduleEntryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    scheduleEntryIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scheduleEntryText: {
      flex: 1,
    },
    scheduleEntryTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    scheduleEntrySub: {
      fontSize: 12,
      fontWeight: '500',
      color: COLORS.textTertiary,
      marginTop: 2,
    },
    headerWrap: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 12,
      backgroundColor: COLORS.background,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 3,
      borderWidth: 1,
      borderColor: COLORS.border,
      position: 'relative',
    },
    indicator: {
      position: 'absolute',
      top: 3,
      height: '100%',
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 11,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 6,
      zIndex: 1,
    },
    segmentLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textTertiary,
    },
    segmentLabelActive: {
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    content: {
      flex: 1,
    },
  });
