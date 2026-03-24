import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../config';
import { Card, SectionLabel, MacroBar, Divider, StatPill } from './DiningUI';

const MICROS: any = { vitamin_c: 90, calcium: 1000, iron: 8, potassium: 3400, magnesium: 420, sodium: 2300 };
const MICRO_CFG = [
  { key: 'vitamin_c', label: 'Vit C', unit: 'mg', color: '#E8922A' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', color: '#5ab0e8' },
  { key: 'iron', label: 'Iron', unit: 'mg', color: '#ff4d4d' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', color: '#52d98a' },
  { key: 'magnesium', label: 'Magnes.', unit: 'mg', color: '#d4a030' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', color: '#999' },
];

export default function MealTrackerScreen({ navigation }: any) {
  const { user } = useUser();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tracker, setTracker] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch(`${API_URL}/dining/tracker/${user.id}?date=${date}`).then(r => r.json()),
        fetch(`${API_URL}/dining/profile/${user.id}`).then(r => r.json()),
      ]);
      setTracker(tRes);
      setProfile(pRes);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user, date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shift = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const doDelete = (id: any, label: string) => Alert.alert('Remove?', `"${label}"`, [
    { text: 'Cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { 
          // Note: Backend might need a specific delete endpoint or I can just re-log empty?
          // Actually, I should add a delete endpoint to the backend for meal_log.
          await fetch(`${API_URL}/dining/tracker/${user?.id}/${id}`, { method: 'DELETE' });
          load(); 
      } catch {}
    }},
  ]);

  const totals = tracker?.totals || {};
  const entries = tracker?.entries || [];
  const target = profile?.targetCalories || 2000;
  const macros = profile?.macros || { protein: 150, carbs: 200, fat: 60 };
  const calPct = Math.min(1, (totals.calories || 0) / target);
  const isToday = date === new Date().toISOString().split('T')[0];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      <View style={s.header}>
        <Text style={s.title}>Meal Tracker</Text>
      </View>

      <View style={s.dateNav}>
        <TouchableOpacity onPress={() => shift(-1)}><Text style={s.dateArrow}>‹</Text></TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.dateText}>{date}</Text>
          {isToday && <Text style={s.todayBadge}>TODAY</Text>}
        </View>
        <TouchableOpacity onPress={() => shift(1)}><Text style={s.dateArrow}>›</Text></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator color="#E8922A" style={{ marginTop: 20 }} /> : (
        <>
          <Card>
            <SectionLabel>Daily Totals</SectionLabel>
            <View style={s.calRow}>
                <Text style={s.calVal}>{Math.round(totals.calories || 0)}</Text>
                <Text style={s.calTarget}>/ {target} kcal</Text>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${calPct * 100}%`, backgroundColor: '#E8922A' }]} /></View>
            
            <Divider />
            <MacroBar label="Protein" current={totals.protein || 0} target={macros.protein} color="#52d98a" />
            <MacroBar label="Carbs" current={totals.carbs || 0} target={macros.carbs} color="#5ab0e8" />
            <MacroBar label="Fat" current={totals.fat || 0} target={macros.fat} color="#d4a030" />
          </Card>

          <Card>
            <SectionLabel>Micronutrients</SectionLabel>
            <View style={s.microGrid}>
                {MICRO_CFG.map(m => {
                    const val = totals[m.key] || 0;
                    const pct = Math.min(1, val / MICROS[m.key]);
                    return (
                        <View key={m.key} style={s.microItem}>
                            <Text style={[s.microVal, { color: m.color }]}>{Math.round(val)}</Text>
                            <Text style={s.microLabel}>{m.label}</Text>
                            <View style={s.microTrack}><View style={[s.microFill, { width: `${pct * 100}%`, backgroundColor: m.color }]} /></View>
                        </View>
                    );
                })}
            </View>
          </Card>

          <Card>
            <SectionLabel>Logged Meals</SectionLabel>
            {entries.length === 0 ? <Text style={{ color: '#666', textAlign: 'center' }}>No meals logged</Text> : 
              entries.map((e: any, i: number) => (
                <View key={e.id} style={s.entryRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.entryLabel}>{e.label}</Text>
                        <Text style={s.entryInfo}>{Math.round(e.calories)} kcal • {e.meal_period}</Text>
                    </View>
                    <TouchableOpacity onPress={() => doDelete(e.id, e.label)}>
                        <Text style={{ color: '#ff4d4d' }}>✕</Text>
                    </TouchableOpacity>
                </View>
              ))
            }
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff' },
  dateNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderRadius: 12, padding: 10, marginBottom: 20 },
  dateArrow: { fontSize: 32, color: '#E8922A', fontWeight: '300' },
  dateText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  todayBadge: { color: '#E8922A', fontSize: 10, fontWeight: '800' },
  calRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 10 },
  calVal: { fontSize: 32, fontWeight: '900', color: '#fff' },
  calTarget: { color: '#666', fontSize: 14 },
  track: { height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  microItem: { width: '30%', backgroundColor: '#000', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  microVal: { fontSize: 16, fontWeight: '800' },
  microLabel: { fontSize: 9, color: '#666', textTransform: 'uppercase', marginTop: 2 },
  microTrack: { width: '100%', height: 2, backgroundColor: '#222', marginTop: 5 },
  microFill: { height: '100%' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  entryLabel: { color: '#fff', fontWeight: '700' },
  entryInfo: { color: '#666', fontSize: 11, marginTop: 2 },
});
