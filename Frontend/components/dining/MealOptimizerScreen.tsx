import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, SafeAreaView, StatusBar, ImageBackground } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, Divider, StatPill, ActionButton, Badge } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

const HALLS = [
  { key: 'Sbisa', label: 'Sbisa', sub: 'North Campus' },
  { key: 'Commons', label: 'Commons', sub: 'South Campus' },
  { key: 'Duncan', label: 'Duncan', sub: 'South / Quad' },
];
const MEALS = ['breakfast', 'lunch', 'dinner'];
const M_ICON: any = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };

export default function MealOptimizerScreen({ navigation }: any) {
  const { user } = useUser();
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const M_CLR: any = { breakfast: T.amber, lunch: T.sky, dinner: T.maroonLight };

  const [hall, setHall] = useState('Sbisa');
  const [selMeals, setSelMeals] = useState(['breakfast', 'lunch', 'dinner']);
  const [inclRest, setInclRest] = useState(true);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [active, setActive] = useState('breakfast');
  const [msg, setMsg] = useState<any>(null);

  const toggle = (m: string) => setSelMeals(s => s.includes(m) ? s.filter(x => x !== m) : [...s, m]);

  const run = async () => {
    if (!user || !selMeals.length) return;
    setLoading(true); setPlan(null); setMsg(null);
    try {
      const res = await fetch(`${API_URL}/dining/optimize/day?clerk_id=${user.id}&dining_hall=${hall}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_meals: selMeals, include_restaurant_alts: inclRest })
      }).then(r => r.json());
      
      setPlan(res);
      setActive(selMeals[0] || 'breakfast');
      if (res.liveMenu?.fetched) setMsg({ ok: true, text: `📡 Live menu: ${res.liveMenu.count} items from ${res.liveMenu.hall}` });
    } catch (e) {
      setMsg({ ok: false, text: 'Plan generation failed.' });
    }
    setLoading(false);
  };

  const addToTracker = async (mealPeriod: string, variant: any) => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/dining/tracker/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          meal_period: mealPeriod,
          label: variant.label,
          foods: variant.items || [],
        }),
      });
      setMsg({ ok: true, text: `Added "${variant.label}" to tracker!` });
    } catch { setMsg({ ok: false, text: 'Could not log meal.' }); }
  };

  const marbleSrc = darkMode
    ? require('../../assets/black_marble.jpg')
    : require('../../assets/white_marble.jpg');

  const mealPlan = plan?.plan || {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }]} />
      </ImageBackground>

      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                <Text style={{ fontSize: 24, color: T.text }}>←</Text>
            </TouchableOpacity>
            <Text style={[s.title, { color: T.text }]}>Meal Optimizer</Text>
        </View>

        <Card>
          <SectionLabel>Settings</SectionLabel>
          <View style={s.chipRow}>
            {HALLS.map(h => (
              <TouchableOpacity key={h.key} 
                  style={[s.chip, { borderColor: T.border, backgroundColor: T.bg3 }, hall === h.key && { borderColor: T.tamuGold, backgroundColor: T.tamuGold + '18' }]} 
                  onPress={() => setHall(h.key)}>
                <Text style={[s.chipText, { color: T.text2 }, hall === h.key && { color: T.tamuGold }]}>{h.label}</Text>
                <Text style={[s.chipSub, { color: T.text3 }]}>{h.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Divider />
          <SectionLabel>Meals</SectionLabel>
          <View style={s.chipRow}>
            {MEALS.map(m => (
              <TouchableOpacity key={m} 
                  style={[s.chip, { borderColor: T.border, backgroundColor: T.bg3 }, selMeals.includes(m) && { borderColor: M_CLR[m], backgroundColor: M_CLR[m] + '1a' }]} 
                  onPress={() => toggle(m)}>
                <Text style={{ fontSize: 18 }}>{M_ICON[m]}</Text>
                <Text style={[s.chipText, { color: T.text2 }, selMeals.includes(m) && { color: M_CLR[m] }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Divider />
          <View style={s.switchRow}>
            <View style={{flex:1}}>
              <Text style={{color: T.text2, fontSize:13, fontWeight:'600'}}>Restaurant Alternatives</Text>
              <Text style={{color: T.text3, fontSize:11, marginTop:2}}>Show $11 swipe options too</Text>
            </View>
            <Switch value={inclRest} onValueChange={setInclRest} trackColor={{ false: T.border2, true: T.maroon }} thumbColor={inclRest ? T.tamuGold : T.text3} />
          </View>

          <View style={{marginTop: 12}}>
            <ActionButton label={loading ? "Generating..." : "Generate Plan"} onPress={run} disabled={loading} style={{backgroundColor: T.tamuMaroon}} textStyle={{color: T.tamuGold}} />
          </View>
        </Card>

        {msg && <Badge label={msg.text} color={msg.ok ? T.sage : T.clay} />}

        {plan && (
          <View style={{ marginTop: 20 }}>
            {plan.profile && (
                <View style={s.pillRow}>
                    <StatPill label="Target" value={`${plan.profile.targetCalories} kcal`} color={T.amber} style={{flex: 1}} valueStyle={{fontSize: 16}} />
                    <StatPill label="Protein" value={`${plan.profile.macros?.protein}g`} color={T.sage} style={{flex: 1}} valueStyle={{fontSize: 16}} />
                    <StatPill label="Mode" value={plan.profile.mode ? plan.profile.mode.charAt(0).toUpperCase() + plan.profile.mode.slice(1) : '—'} color={T.sky} style={{flex: 1}} valueStyle={{fontSize: 10}} />
                </View>
            )}

            <View style={[s.tabs, { borderBottomColor: T.border }]}>
              {MEALS.filter(m => selMeals.includes(m)).map(m => (
                <TouchableOpacity key={m} style={[s.tab, active === m && { borderBottomColor: M_CLR[m], borderBottomWidth: 2 }]} onPress={() => setActive(m)}>
                  <Text style={[s.tabText, { color: T.text3 }, active === m && { color: M_CLR[m] }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {active && mealPlan[active] && (
              <MealPanel data={mealPlan[active]} color={M_CLR[active]} onAdd={(v: any) => addToTracker(active, v)} T={T} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MealPanel({ data, color, onAdd, T }: any) {
  return (
    <View style={{ marginTop: 15 }}>
      <SectionLabel>Dining Hall Options</SectionLabel>
      {data?.variants?.map((v: any, i: number) => (
        <Card key={i}>
          <View style={s.variantHeader}>
              <Text style={{ fontSize: 20 }}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.variantLabel, { color: T.text }]}>{v.label}</Text>
                <Text style={[s.variantSub, { color: T.text3 }]}>{Math.round(v.totals?.calories || 0)} kcal • {Math.round(v.totals?.protein || 0)}g P</Text>
              </View>
              <TouchableOpacity style={[s.addBtn, { borderColor: color }]} onPress={() => onAdd(v)}>
                <Text style={{ color, fontWeight: '700', fontSize: 12 }}>+ Add</Text>
              </TouchableOpacity>
          </View>
          <Divider />
          {v.items?.map((it: any, j: number) => (
              <Text key={j} style={[s.foodItem, { color: T.text2 }]}>• {it.name} <Text style={{color: T.amber}}>x{it.quantity}</Text></Text>
          ))}
        </Card>
      ))}

      {Object.keys(data?.restaurantPlans || {}).length > 0 && (
          <View style={{ marginTop: 15 }}>
              <SectionLabel>Retail Swipes ($11)</SectionLabel>
              {Object.entries(data.restaurantPlans).map(([name, p]: any) => (
                  <Card key={name}>
                      <View style={s.variantHeader}>
                        <View style={{flex: 1}}>
                            <Text style={[s.variantLabel, { color: T.text }]}>{name}</Text>
                            <Text style={[s.variantSub, { color: T.text3 }]}>{Math.round(p.totals?.calories || 0)} kcal</Text>
                        </View>
                        <TouchableOpacity style={[s.addBtn, { borderColor: '#5ab0e8' }]} onPress={() => onAdd({ ...p, label: name })}>
                            <Text style={{ color: '#5ab0e8', fontWeight: '700', fontSize: 12 }}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                  </Card>
              ))}
          </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  chip: { 
    flex: 1, 
    minWidth: 80,
    alignItems: 'center', 
    padding: 11, 
    borderRadius: 11, 
    borderWidth: 1,
    gap: 3 
  },
  chipText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipSub: { fontSize: 10 },
  switchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 24, borderBottomWidth: 1, marginBottom: 10 },
  tab: { paddingVertical: 14, flex: 1, alignItems: 'center' },
  tabText: { fontWeight: '900', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  variantHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  variantLabel: { fontWeight: '900', fontSize: 16, letterSpacing: -0.2 },
  variantSub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  addBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  foodItem: { fontSize: 13, marginBottom: 5, paddingLeft: 5 },
});
