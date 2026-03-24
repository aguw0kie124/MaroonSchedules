import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, StatPill, Divider, ActionButton } from './DiningUI';

const RESTAURANTS = ['Chick-fil-A', 'Panda Express', 'Shake Smart', 'Houston Street Subs', 'Salata', 'Abu Omar Halal'];
const SHORT: any = { 'Chick-fil-A': 'CFA', 'Panda Express': 'Panda', 'Shake Smart': 'Shake', 'Houston Street Subs': 'Subs', 'Abu Omar Halal': 'Abu Omar' };

export default function RetailSwipesScreen({ navigation }: any) {
  const { user } = useUser();
  const [info, setInfo] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showLog, setShowLog] = useState(false);
  const [logRest, setLogRest] = useState('Chick-fil-A');
  const [logCost, setLogCost] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [selRest, setSelRest] = useState('Chick-fil-A');
  const [selMeal, setSelMeal] = useState('lunch');
  const [optResult, setOptResult] = useState<any>(null);
  const [optLoad, setOptLoad] = useState(false);

  useEffect(() => { load(); loadProfile(); }, []);

  const loadProfile = async () => {
      if (!user) return;
      try {
          const res = await fetch(`${API_URL}/dining/profile/${user.id}`).then(r => r.json());
          setProfile(res);
      } catch {}
  };

  const load = async () => {
    if (!user) return;
    try {
      const resp = await fetch(`${API_URL}/dining/swipes/${user.id}`).then(r => r.json());
      setInfo(resp);
    } catch {}
  };

  const doLog = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/dining/swipes/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: new Date().toISOString().split('T')[0], restaurant: logRest, total_cost: +logCost || 11 }),
      });
      load(); setShowLog(false); setLogCost('');
    } catch { Alert.alert('Error', 'Failed to log swipe'); }
    setSaving(false);
  };

  const doDelete = (id: any) => Alert.alert('Remove?', '', [
    { text: 'Cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await fetch(`${API_URL}/dining/swipes/${user?.id}/${id}`, { method: 'DELETE' }); load(); } catch {}
    }},
  ]);

  const doOptimize = async () => {
    if (!user) return;
    setOptLoad(true); setOptResult(null);
    try {
        // Updated call to match the Query param expectations
        const res = await fetch(`${API_URL}/dining/optimize/day?clerk_id=${user.id}&dining_hall=${selRest}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected_meals: [selMeal], include_restaurant_alts: true })
        }).then(r => r.json());
        
        if (res.status === 'success' && res.plan?.[selMeal]) {
            const mPlan = res.plan[selMeal];
            // The backend for retail now returns the result in restaurantPlans[selRest]
            const opt = mPlan.restaurantPlans?.[selRest];
            if (opt && opt.success) setOptResult({ ...opt, success: true });
            else setOptResult({ success: false, error: opt?.error || 'No valid combo found under $11.' });
        } else {
            setOptResult({ success: false, error: res.error || 'Optimization failed for this meal.' });
        }
    } catch (e) { setOptResult({ success: false, error: 'Connection error.' }); }
    setOptLoad(false);
  };

  const { swipes = [], usedThisWeek = 0, remaining = 7, todayUsed = 0 } = info || {};

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={s.title}>Retail Swipes</Text>

      <Card>
        <SectionLabel>This Week ($11/swipe · 7/wk)</SectionLabel>
        <View style={s.pillRow}>
          <StatPill label="Used" value={`${usedThisWeek}/7`} color={usedThisWeek >= 6 ? '#ff4d4d' : '#E8922A'} />
          <StatPill label="Left" value={remaining} color="#52d98a" />
          <StatPill label="Today" value={`${todayUsed}/2`} color="#5ab0e8" />
        </View>

        <TouchableOpacity style={s.logBtn} onPress={() => setShowLog(!showLog)}>
          <Text style={s.logText}>{showLog ? '✕ Cancel' : '+ Log Swipe'}</Text>
        </TouchableOpacity>

        {showLog && (
          <View style={{ marginTop: 15 }}>
            <TextInput style={s.input} placeholder="Cost (default $11)" placeholderTextColor="#555" value={logCost} onChangeText={setLogCost} keyboardType="decimal-pad" />
            <SectionLabel>Restaurant</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              {RESTAURANTS.map(r => (
                <TouchableOpacity key={r} style={[s.restChip, logRest === r && s.restChipActive]} onPress={() => setLogRest(r)}>
                  <Text style={[s.restText, logRest === r && { color: '#E8922A' }]}>{SHORT[r] || r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ActionButton label="Save Log" onPress={doLog} disabled={saving} />
          </View>
        )}
      </Card>

      <Card>
        <SectionLabel>Optimize $11 Combo</SectionLabel>
        <Text style={s.subHeader}>Restaurant</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
          {RESTAURANTS.map(r => (
            <TouchableOpacity key={r} style={[s.restChip, selRest === r && s.restChipActive]} onPress={() => setSelRest(r)}>
              <Text style={[s.restText, selRest === r && { color: '#E8922A' }]}>{SHORT[r] || r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={s.subHeader}>Meal Period</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
            {['breakfast', 'lunch', 'dinner'].map(m => (
                <TouchableOpacity key={m} style={[s.mealChip, selMeal === m && s.mealChipActive]} onPress={() => setSelMeal(m)}>
                    <Text style={[s.mealText, selMeal === m && { color: '#5ab0e8' }]}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <ActionButton label={optLoad ? "Searching..." : "Optimize Combo"} onPress={doOptimize} disabled={optLoad} />

        {optResult && (
          <View style={{ marginTop: 15 }}>
            {optResult.success ? (
              <View style={s.optCard}>
                <Text style={s.optMsg}>✓ Best combo found!</Text>
                {optResult.items.map((it: any, i: number) => (
                  <View key={i} style={s.optRow}>
                      <Text style={s.optItemName}>{it.name}</Text>
                      <Text style={s.optItemQty}>×{it.quantity}</Text>
                  </View>
                ))}
                <Divider />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.optTotal}>{Math.round(optResult.totals?.calories)} kcal</Text>
                    <Text style={s.optPrice}>${optResult.totals?.cost?.toFixed(2)} / $11</Text>
                </View>
              </View>
            ) : <Text style={{ color: '#ff4d4d', textAlign: 'center' }}>{optResult.error}</Text>}
          </View>
        )}
      </Card>

      <Card>
        <SectionLabel>Usage History</SectionLabel>
        {swipes.length === 0 ? <Text style={{ color: '#555', textAlign: 'center' }}>No history</Text> : 
          swipes.map((sw: any) => (
            <View key={sw.id} style={s.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.historyRest}>{sw.restaurant}</Text>
                <Text style={s.historyDate}>{sw.date}</Text>
              </View>
              <Text style={s.historyCost}>${sw.total_cost.toFixed(2)}</Text>
              <TouchableOpacity onPress={() => doDelete(sw.id)} style={{ marginLeft: 15 }}><Text style={{ color: '#ff4d4d' }}>✕</Text></TouchableOpacity>
            </View>
          ))
        }
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 20 },
  pillRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  logBtn: { borderWidth: 1, borderColor: '#500000', padding: 12, borderRadius: 12, alignItems: 'center' },
  logText: { color: '#E8922A', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#111', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  subHeader: { fontSize: 10, color: '#888', fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  restChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', marginRight: 8 },
  restChipActive: { borderColor: '#E8922A', backgroundColor: '#E8922A11' },
  restText: { color: '#555', fontSize: 12, fontWeight: '700' },
  mealChip: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  mealChipActive: { borderColor: '#5ab0e8', backgroundColor: '#5ab0e811' },
  mealText: { color: '#555', fontSize: 11, fontWeight: '800' },
  optCard: { padding: 10, backgroundColor: '#080808', borderRadius: 12, borderWidth: 1, borderColor: '#111' },
  optMsg: { color: '#52d98a', fontWeight: '900', fontSize: 12, marginBottom: 10, textTransform: 'uppercase' },
  optRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  optItemName: { color: '#fff', fontSize: 13, flex: 1 },
  optItemQty: { color: '#E8922A', fontWeight: 'bold', marginLeft: 10 },
  optTotal: { color: '#5ab0e8', fontWeight: '900' },
  optPrice: { color: '#E8922A', fontWeight: '900' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  historyRest: { color: '#fff', fontWeight: '700', fontSize: 14 },
  historyDate: { color: '#444', fontSize: 11, marginTop: 2 },
  historyCost: { color: '#E8922A', fontWeight: 'bold' },
});
