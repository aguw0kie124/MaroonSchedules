import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, ImageBackground } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { Calendar } from 'react-native-calendars';
import { API_URL } from '../../config';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { computeDiningStreakStats, didHitDiningGoal } from '../../services/diningStreaks';
import { Flame, Target, Trophy } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function StreakHubScreen({ navigation, embedded = false }: any) {
  const { user } = useUser();
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetch(`${API_URL}/dining/profile/${user.id}`).then(r => r.json()).then(setProfile).catch(console.error);
      fetch(`${API_URL}/dining/history/${user.id}?days=180`).then(r => r.json()).then(setHistory).catch(console.error);
    }, [user]),
  );

  const target = profile?.targetCalories || 2000;
  const mode = profile?.mode || 'maintain';
  
  const { currentStreak, longestStreak, daysHit: totalDaysHit } = computeDiningStreakStats(
    history,
    target,
    mode,
  );
  const markedDates = history.reduce((acc, day) => {
    if (didHitDiningGoal(day, target, mode)) {
      acc[day.date] = {
        selected: true,
        selectedColor: darkMode ? 'rgba(232,146,42,0.88)' : 'rgba(12,12,14,0.88)',
        selectedTextColor: '#FFFFFF',
      };
    }
    return acc;
  }, {} as Record<string, any>);

  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : darkMode
      ? require('../../assets/black_marble.jpg')
      : require('../../assets/white_marble.jpg');

  const content = (
      <ScrollView contentContainerStyle={{ padding: embedded ? 0 : 24 }}>
        {!embedded ? (
          <>
            <View style={s.headerRow}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                  <Text style={{ fontSize: 24, color: T.text }}>←</Text>
              </TouchableOpacity>
              <Text style={[s.title, { color: T.text }]}>Your Streaks</Text>
            </View>
            <Text style={[s.sub, { color: T.text3 }]}>Consistency is key to tracking your diet!</Text>
          </>
        ) : null}

        <View style={[s.fireBox, { borderColor: T.border2, backgroundColor: T.btnBg }]}>
            <Flame size={52} color={T.amber} style={{ marginBottom: 10 }} />
            <Text style={[s.days, { color: T.text }]}>{currentStreak} Days</Text>
            <Text style={[s.streakLabel, { color: T.amber }]}>CURRENT STREAK</Text>
        </View>

        <View style={s.row}>
            <View style={[s.statBox, { borderColor: T.border, backgroundColor: T.card }]}>
                <Trophy size={22} color={T.sky} />
                <Text style={[s.statVal, { color: T.text }]}>{longestStreak}</Text>
                <Text style={[s.statLabel, { color: T.text3 }]}>MAX STREAK</Text>
            </View>
            <View style={[s.statBox, { borderColor: T.border, backgroundColor: T.card }]}>
                <Target size={22} color={T.sage} />
                <Text style={[s.statVal, { color: T.text }]}>{totalDaysHit}</Text>
                <Text style={[s.statLabel, { color: T.text3 }]}>DAYS HIT</Text>
            </View>
        </View>

        <View style={[s.calendarCard, { borderColor: T.border, backgroundColor: T.card }]}>
          <Text style={[s.calendarTitle, { color: T.text }]}>Streak Calendar</Text>
          <Text style={[s.calendarSubtitle, { color: T.text3 }]}>Filled days are days you hit your goal.</Text>
          <Calendar
            markedDates={markedDates}
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              textSectionTitleColor: T.text3,
              selectedDayBackgroundColor: darkMode ? 'rgba(232,146,42,0.88)' : 'rgba(12,12,14,0.88)',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: T.text,
              dayTextColor: T.text,
              textDisabledColor: T.text4,
              arrowColor: T.text,
              monthTextColor: T.text,
              indicatorColor: T.text,
              textDayFontWeight: '500',
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '700',
            }}
          />
        </View>

      </ScrollView>
  );

  if (embedded) {
    return content;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }]} />
      </ImageBackground>
      {content}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 32, fontWeight: '800' },
  sub: { fontSize: 13, marginBottom: 30, letterSpacing: 0.5 },
  fireBox: { alignItems: 'center', padding: 40, borderRadius: 24, borderWidth: 1, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 10 }, shadowRadius: 15, elevation: 10, marginBottom: 20 },
  days: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  streakLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  row: { flexDirection: 'row', gap: 16 },
  statBox: { flex: 1, padding: 20, alignItems: 'center', borderRadius: 20, borderWidth: 1 },
  statVal: { fontSize: 28, fontWeight: '800', marginVertical: 8 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  calendarCard: { marginTop: 20, borderRadius: 24, borderWidth: 1, padding: 18 },
  calendarTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  calendarSubtitle: { fontSize: 13, marginBottom: 10 },
});
