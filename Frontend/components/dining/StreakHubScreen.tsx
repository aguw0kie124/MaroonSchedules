import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, ImageBackground } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

const { width } = Dimensions.get('window');

export default function StreakHubScreen({ navigation }: any) {
  const { user } = useUser();
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const [history, setHistory] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetch(`${API_URL}/dining/profile/${user.id}`).then(r => r.json()).then(setProfile).catch(console.error);
      fetch(`${API_URL}/dining/history/${user.id}?days=30`).then(r => r.json()).then(setHistory).catch(console.error);
    }
  }, [user]);

  const target = profile?.targetCalories || 2000;
  const mode = profile?.mode || 'maintain';
  
  let currentStreak = 0;
  let maxStreak = 0;
  let totalDaysHit = 0;

  if (history.length > 0) {
      history.slice().reverse().forEach((d: any) => {
          const r = d.calories / target;
          let ok = false;
          if (mode === 'cut') ok = r >= 0.50 && r <= 1.15;
          else if (mode === 'bulk') ok = r >= 0.85;
          else ok = r >= 0.80 && r <= 1.20;
          
          if (ok) {
              currentStreak++;
              totalDaysHit++;
          } else {
              if (currentStreak > maxStreak) maxStreak = currentStreak;
              currentStreak = 0;
          }
      });
      if (currentStreak > maxStreak) maxStreak = currentStreak;
  }

  const marbleSrc = darkMode
    ? require('../../assets/black_marble.jpg')
    : require('../../assets/white_marble.jpg');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }]} />
      </ImageBackground>
      
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Text style={{ fontSize: 24, color: T.text }}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: T.text }]}>Your Streaks</Text>
        </View>
        <Text style={[s.sub, { color: T.text3 }]}>Consistency is key to tracking your diet!</Text>

        <View style={[s.fireBox, { borderColor: T.border2, backgroundColor: T.btnBg }]}>
            <Text style={{ fontSize: 60, marginBottom: 10 }}>🔥</Text>
            <Text style={[s.days, { color: T.text }]}>{currentStreak} Days</Text>
            <Text style={[s.streakLabel, { color: T.amber }]}>CURRENT STREAK</Text>
        </View>

        <View style={s.row}>
            <View style={[s.statBox, { borderColor: T.border, backgroundColor: T.card }]}>
                <Text style={{ fontSize: 24 }}>🏆</Text>
                <Text style={[s.statVal, { color: T.text }]}>{maxStreak}</Text>
                <Text style={[s.statLabel, { color: T.text3 }]}>MAX STREAK</Text>
            </View>
            <View style={[s.statBox, { borderColor: T.border, backgroundColor: T.card }]}>
                <Text style={{ fontSize: 24 }}>🎯</Text>
                <Text style={[s.statVal, { color: T.text }]}>{totalDaysHit}</Text>
                <Text style={[s.statLabel, { color: T.text3 }]}>DAYS HIT</Text>
            </View>
        </View>

      </ScrollView>
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
});
