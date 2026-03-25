import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

const OPTIONS = [
  {
    id: 'MealLog',
    icon: '📋',
    label: 'Meal Tracker',
    sub: 'Log meals, view daily totals & micronutrients',
    colorKey: 'amber',
    screen: 'MealTracker',
  },
  {
    id: 'Weight',
    icon: '📈',
    label: 'Weight Tracker',
    sub: 'Log weights, view trend chart & progress',
    colorKey: 'sky',
    screen: 'WeightTracker',
  },
];

export default function TrackerHubScreen({ navigation }: any) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const marbleSrc = darkMode
    ? require('../../assets/black_marble.jpg')
    : require('../../assets/white_marble.jpg');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]} />
      </ImageBackground>
      
      <View style={{ flex: 1, padding: 24 }}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Text style={{ fontSize: 24, color: T.text }}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: T.text }]}>Tracker</Text>
        </View>
        <Text style={[s.intro, { color: T.text3 }]}>Choose what you'd like to track today.</Text>

        {OPTIONS.map((opt) => {
          const color = (T as any)[opt.colorKey];
          return (
            <TouchableOpacity key={opt.id} onPress={() => navigation.navigate(opt.screen)} activeOpacity={0.82}>
              <View style={[s.card, { borderColor: color + '40', backgroundColor: T.card }]}>
                <LinearGradient colors={[color + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: T.radiusLg }]} />
                <Text style={s.cardIcon}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardLabel, { color }]}>{opt.label}</Text>
                  <Text style={[s.cardSub, { color: T.text3 }]}>{opt.sub}</Text>
                </View>
                <Text style={[s.cardArrow, { color }]}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 32, fontWeight: '800' },
  intro: { fontSize: 13, marginBottom: 28, lineHeight: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  cardIcon:  { fontSize: 34 },
  cardLabel: { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  cardSub:   { fontSize: 12, lineHeight: 16 },
  cardArrow: { fontSize: 26, fontWeight: '300' },
});
