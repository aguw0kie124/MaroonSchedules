import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ChartNoAxesColumn, ClipboardList } from 'lucide-react-native';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

const OPTIONS = [
  {
    id: 'MealLog',
    Icon: ClipboardList,
    label: 'Meal Tracker',
    sub: 'Log meals, view daily totals & micronutrients',
    colorKey: 'amber',
    screen: 'MealTracker',
  },
  {
    id: 'Weight',
    Icon: ChartNoAxesColumn,
    label: 'Weight Tracker',
    sub: 'Log weights, view trend chart & progress',
    colorKey: 'sky',
    screen: 'WeightTracker',
  },
];

export default function TrackerHubScreen({ navigation, embedded = false }: any) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const content = (
    <View style={{ flex: 1, padding: embedded ? 0 : 24 }}>
      {!embedded ? (
        <>
          <View style={s.headerRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                <Text style={{ fontSize: 24, color: T.text }}>←</Text>
            </TouchableOpacity>
            <Text style={[s.title, { color: T.text }]}>Tracker</Text>
          </View>
          <Text style={[s.intro, { color: T.text3 }]}>Choose what you'd like to track today.</Text>
        </>
      ) : null}

      {OPTIONS.map((opt) => {
        const color = (T as any)[opt.colorKey];
        const Icon = opt.Icon;
        return (
          <TouchableOpacity key={opt.id} onPress={() => navigation.navigate(opt.screen)} activeOpacity={0.82}>
            <View style={[s.card, { borderColor: color + '40', backgroundColor: T.card }]}>
              <LinearGradient colors={[color + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: T.radiusLg }]} />
              <View style={[s.cardIconWrap, { backgroundColor: color + '18' }]}>
                <Icon size={22} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardLabel, { color }]}>{opt.label}</Text>
                <Text style={[s.cardSub, { color: T.text3 }]}>{opt.sub}</Text>
              </View>
              <ArrowRight size={20} color={color} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (embedded) {
    return content;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      {content}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 32, fontWeight: '800' },
  intro: { fontSize: 13, marginBottom: 28, lineHeight: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  cardIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  cardSub:   { fontSize: 12, lineHeight: 16 },
});
