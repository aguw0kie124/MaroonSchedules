import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, SafeAreaView, StatusBar, ImageBackground } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import { requestJson } from '../../api/client';
import { Card, SectionLabel, MacroBar, Divider } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { getLocalDateString } from '../../services/dateUtils';

const MICROS: any = { vitamin_c: 90, calcium: 1000, iron: 8, potassium: 3400, magnesium: 420, sodium: 2300 };

export default function MealTrackerScreen({ navigation, embedded = false }: any) {
  const { user } = useUser();
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const [date, setDate] = useState(getLocalDateString());
  const [tracker, setTracker] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const MICRO_CFG = [
    { key: 'vitamin_c', label: 'Vit C', unit: 'mg', color: T.amber },
    { key: 'calcium', label: 'Calcium', unit: 'mg', color: T.sky },
    { key: 'iron', label: 'Iron', unit: 'mg', color: T.clay },
    { key: 'potassium', label: 'Potassium', unit: 'mg', color: T.sage },
    { key: 'magnesium', label: 'Magnes.', unit: 'mg', color: T.tamuGold },
    { key: 'sodium', label: 'Sodium', unit: 'mg', color: T.text3 },
  ];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        requestJson(`/dining/tracker/${encodeURIComponent(user.id)}?date=${encodeURIComponent(date)}`),
        requestJson(`/dining/profile/${encodeURIComponent(user.id)}`),
      ]);
      setTracker(tRes);
      setProfile(pRes);
    } catch (e) { console.warn(e); }
    setLoading(false);
  }, [user, date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shift = (days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    setDate(getLocalDateString(dt));
  };

  const doDelete = (id: any, label: string) => Alert.alert('Remove?', `"${label}"`, [
    { text: 'Cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { 
          await requestJson(`/dining/tracker/${encodeURIComponent(user?.id || '')}/${id}`, { method: 'DELETE' });
          load(); 
      } catch {}
    }},
  ]);

  const totals = tracker?.totals || {};
  const entries = tracker?.entries || [];
  const target = profile?.targetCalories || 2000;
  const macros = profile?.macros || { protein: 150, carbs: 200, fat: 60 };
  const calPct = Math.min(1, (totals.calories || 0) / target);
  const isToday = date === getLocalDateString();

  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;

  const contentBody = (
      <>
        <View style={[s.dateNav, { backgroundColor: T.bg3, borderColor: T.border }]}>
          <TouchableOpacity onPress={() => shift(-1)}><Text style={[s.dateArrow, { color: T.amber }]}>‹</Text></TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.dateText, { color: T.text }]}>{date}</Text>
            {isToday && <Text style={[s.todayBadge, { color: T.amber }]}>TODAY</Text>}
          </View>
          <TouchableOpacity onPress={() => shift(1)}><Text style={[s.dateArrow, { color: T.amber }]}>›</Text></TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={T.amber} style={{ marginTop: 20 }} /> : (
          <>
            <Card>
              <SectionLabel>Daily Totals</SectionLabel>
              <View style={s.calRow}>
                  <Text style={[s.calVal, { color: T.text }]}>{Math.round(totals.calories || 0)}</Text>
                  <Text style={[s.calTarget, { color: T.text3 }]}>/ {target} kcal</Text>
              </View>
              <View style={[s.track, { backgroundColor: T.border }]}><View style={[s.fill, { width: `${calPct * 100}%`, backgroundColor: T.amber }]} /></View>
              
              <Divider />
              <MacroBar label="Protein" current={totals.protein || 0} target={macros.protein} color={T.sage} />
              <MacroBar label="Carbs" current={totals.carbs || 0} target={macros.carbs} color={T.sky} />
              <MacroBar label="Fat" current={totals.fat || 0} target={macros.fat} color={T.tamuGold} />
            </Card>

            <Card>
              <SectionLabel>Micronutrients</SectionLabel>
              <View style={s.microGrid}>
                  {MICRO_CFG.map(m => {
                      const val = totals[m.key] || 0;
                      const pct = Math.min(1, val / MICROS[m.key]);
                      return (
                          <View key={m.key} style={[s.microItem, { backgroundColor: T.bg3, borderColor: T.border }]}>
                              <Text style={[s.microVal, { color: m.color }]}>{Math.round(val)}</Text>
                              <Text style={[s.microLabel, { color: T.text3 }]}>{m.label}</Text>
                              <View style={[s.microTrack, { backgroundColor: T.border }]}><View style={[s.microFill, { width: `${pct * 100}%`, backgroundColor: m.color }]} /></View>
                          </View>
                      );
                  })}
              </View>
            </Card>

            <Card>
              <SectionLabel>Logged Meals</SectionLabel>
              {entries.length === 0 ? <Text style={{ color: T.text3, textAlign: 'center' }}>No meals logged</Text> : 
                entries.map((e: any, i: number) => (
                  <View key={e.id} style={[s.entryRow, { borderBottomColor: T.border }]}>
                      <View style={{ flex: 1 }}>
                          <Text style={[s.entryLabel, { color: T.text }]}>{e.label}</Text>
                          <Text style={[s.entryInfo, { color: T.text3 }]}>{Math.round(e.calories)} kcal • {e.meal_period}</Text>
                      </View>
                      <TouchableOpacity onPress={() => doDelete(e.id, e.label)}>
                          <Text style={{ color: T.clay, fontSize: 18 }}>✕</Text>
                      </TouchableOpacity>
                  </View>
                ))
              }
            </Card>
          </>
        )}
      </>
  );

  if (embedded) {
    return <View style={[s.container, s.embeddedContainer]}>{contentBody}</View>;
  }

  const content = (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                <Text style={{ fontSize: 24, color: T.text }}>←</Text>
            </TouchableOpacity>
            <Text style={[s.title, { color: T.text }]}>Meal Tracker</Text>
        </View>
        {contentBody}
      </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.18)' }]} />
      </ImageBackground>
      {content}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  embeddedContainer: { paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, flex: 1 },
  dateNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 10, marginBottom: 20, borderWidth: 1 },
  dateArrow: { fontSize: 32, fontWeight: '300' },
  dateText: { fontWeight: 'bold', fontSize: 16 },
  todayBadge: { fontSize: 10, fontWeight: '800' },
  calRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 10 },
  calVal: { fontSize: 32, fontWeight: '900' },
  calTarget: { fontSize: 14 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  microItem: { width: '30%', padding: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  microVal: { fontSize: 16, fontWeight: '800' },
  microLabel: { fontSize: 9, textTransform: 'uppercase', marginTop: 2 },
  microTrack: { width: '100%', height: 2, marginTop: 5 },
  microFill: { height: '100%' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, alignItems: 'center' },
  entryLabel: { fontWeight: '700' },
  entryInfo: { fontSize: 11, marginTop: 2 },
});
