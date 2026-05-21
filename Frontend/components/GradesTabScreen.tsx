// Frontend/components/GradesTabScreen.tsx
// Academics tab — wraps GradesScreen with a Schedule Planner entry link.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CalendarDays, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './SharedUI';
import { GradesScreen } from './GradesScreen';

export function GradesTabScreen() {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const styles = getStyles(COLORS, insets.top);

  return (
    <View style={styles.container}>
      {/* Top safe area fill */}
      <View style={{ height: insets.top, backgroundColor: COLORS.background }} />

      {/* Schedule planner entry */}
      <View style={styles.scheduleEntryWrap}>
        <Pressable
          style={({ pressed }) => [styles.scheduleEntryBtn, pressed && { opacity: 0.85 }]}
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

      {/* Grade Distributions */}
      <View style={styles.content}>
        <GradesScreen />
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, _topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
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
    content: {
      flex: 1,
    },
  });
