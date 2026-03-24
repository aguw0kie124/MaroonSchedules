import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { Card, SectionLabel, Divider, StatPill, ActionButton, Badge } from './DiningUI';

const HALLS = [
  { key: 'Sbisa', label: 'Sbisa', sub: 'North Campus' },
  { key: 'Commons', label: 'Commons', sub: 'South Campus' },
  { key: 'Duncan', label: 'Duncan', sub: 'South / Quad' },
];
const MEALS = ['breakfast', 'lunch', 'dinner'];
const M_ICON: any = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
const M_CLR: any = { breakfast: '#E8922A', lunch: '#5ab0e8', dinner: '#500000' };

export default function MealOptimizerScreen({ navigation }: any) {
  const { user } = useUser();
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

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={s.title}>Meal Optimizer</Text>

      <Card>
        <SectionLabel>Settings</SectionLabel>
        <View style={s.chipRow}>
          {HALLS.map(h => (
            <TouchableOpacity key={h.key} 
                style={[s.chip, hall === h.key && s.chipActive]} 
                onPress={() => setHall(h.key)}>
              <Text style={[s.chipText, hall === h.key && { color: '#E8922A' }]}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Divider />
        <SectionLabel>Meals</SectionLabel>
        <View style={s.chipRow}>
          {MEALS.map(m => (
            <TouchableOpacity key={m} 
                style={[s.chip, selMeals.includes(m) && { borderColor: M_CLR[m] }]} 
                onPress={() => toggle(m)}>
              <Text style={{ fontSize: 18 }}>{M_ICON[m]}</Text>
              <Text style={[s.chipText, selMeals.includes(m) && { color: M_CLR[m] }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Divider />
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Restaurant Alternatives</Text>
          <Switch value={inclRest} onValueChange={setInclRest} />
        </View>

        <ActionButton label={loading ? "Generating..." : "Generate Plan"} onPress={run} disabled={loading} />
      </Card>

      {msg && <Badge label={msg.text} color={msg.ok ? '#52d98a' : '#ff4d4d'} />}

      {plan && (
        <View style={{ marginTop: 20 }}>
          <View style={s.tabs}>
            {MEALS.filter(m => selMeals.includes(m)).map(m => (
              <TouchableOpacity key={m} style={[s.tab, active === m && { borderBottomColor: M_CLR[m], borderBottomWidth: 2 }]} onPress={() => setActive(m)}>
                <Text style={[s.tabText, active === m && { color: M_CLR[m] }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {active && plan?.plan?.[active] && (
            <MealPanel data={plan.plan[active]} color={M_CLR[active]} onAdd={(v: any) => addToTracker(active, v)} />
          )}
        </View>
      )}
    </ScrollView>
  );
}

function MealPanel({ data, color, onAdd }: any) {
  return (
    <View style={{ marginTop: 15 }}>
      <SectionLabel>Dining Hall Options</SectionLabel>
      {data?.variants?.map((v: any, i: number) => (
        <Card key={i}>
          <View style={s.variantHeader}>
              <Text style={{ fontSize: 20 }}>{v.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.variantLabel}>{v.label}</Text>
                <Text style={s.variantSub}>{Math.round(v.totals?.calories || 0)} kcal • {Math.round(v.totals?.protein || 0)}g P</Text>
              </View>
              <TouchableOpacity style={[s.addBtn, { borderColor: color }]} onPress={() => onAdd(v)}>
                <Text style={{ color, fontWeight: '700', fontSize: 12 }}>+ Add</Text>
              </TouchableOpacity>
          </View>
          <Divider />
          {v.items?.map((it: any, j: number) => (
              <Text key={j} style={s.foodItem}>• {it.name} (x{it.quantity})</Text>
          ))}
        </Card>
      ))}

      {Object.keys(data?.restaurantPlans || {}).length > 0 && (
          <View style={{ marginTop: 15 }}>
              <SectionLabel>Retail Swipes ($11)</SectionLabel>
              {Object.entries(data.restaurantPlans).map(([name, p]: any) => (
                  <Card key={name}>
                      <View style={s.variantHeader}>
                        <Text style={s.variantLabel}>{name}</Text>
                        <Text style={s.variantSub}>{Math.round(p.totals?.calories || 0)} kcal</Text>
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
  container: { flex: 1, backgroundColor: '#000' },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 20 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#222', backgroundColor: '#111', gap: 5 },
  chipActive: { borderColor: '#E8922A', backgroundColor: '#E8922A11' },
  chipText: { color: '#999', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  switchLabel: { color: '#fff', fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  tab: { paddingVertical: 10 },
  tabText: { color: '#666', fontWeight: '700', textTransform: 'capitalize' },
  variantHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  variantLabel: { color: '#fff', fontWeight: '800', fontSize: 14 },
  variantSub: { color: '#666', fontSize: 11 },
  addBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  foodItem: { color: '#999', fontSize: 12, marginBottom: 3 },
});
