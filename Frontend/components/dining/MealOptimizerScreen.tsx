import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, SafeAreaView, StatusBar, ImageBackground } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { requestJson } from '../../api/client';
import { Card, SectionLabel, Divider, StatPill, ActionButton, Badge } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { PillTabs } from '../PillTabs';
import { getLocalDateString } from '../../services/dateUtils';
import { MapPin, MoonStar, Plus, SunMedium, Sunrise, UtensilsCrossed } from 'lucide-react-native';
import { getDiningMealPeriodForLocation, prefetchDiningMenus } from '../../services/diningMenuCache';

const HALLS = [
  { key: 'Sbisa', label: 'Sbisa', sub: 'North Campus' },
  { key: 'Commons', label: 'Commons', sub: 'South Campus' },
  { key: 'Duncan', label: 'Duncan', sub: 'South / Quad' },
];
const MEALS = ['breakfast', 'lunch', 'dinner'];
const M_ICON: any = { breakfast: Sunrise, lunch: SunMedium, dinner: MoonStar };

export default function MealOptimizerScreen({ navigation, embedded = false }: any) {
  const { user } = useUser();
  const { COLORS, theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const M_CLR: any = { breakfast: T.amber, lunch: T.sky, dinner: T.sage };
  const selectedGlassFill = darkMode ? T.tamuGold + '18' : 'rgba(12,12,14,0.84)';
  const selectedGlassText = darkMode ? T.tamuGold : '#FFFFFF';
  const selectedGlassSub = darkMode ? T.text3 : 'rgba(255,255,255,0.72)';

  const [hall, setHall] = useState('Sbisa');
  const [selMeals, setSelMeals] = useState(['breakfast', 'lunch', 'dinner']);
  const [inclRest, setInclRest] = useState(true);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [active, setActive] = useState('breakfast');
  const [activeTopTab, setActiveTopTab] = useState<'menus' | 'location'>('menus');
  const [msg, setMsg] = useState<any>(null);

  useEffect(() => {
    prefetchDiningMenus(HALLS.map((item) => item.key), MEALS).catch(() => {});
  }, []);

  useEffect(() => {
    prefetchDiningMenus([hall], MEALS).catch(() => {});
  }, [hall]);

  const toggle = (m: string) => setSelMeals(s => s.includes(m) ? s.filter(x => x !== m) : [...s, m]);

  const run = async () => {
    if (!user || !selMeals.length) return;
    setActiveTopTab('menus');
    setLoading(true); setPlan(null); setMsg(null);
    try {
      const res = await requestJson(`/dining/optimize/day?clerk_id=${encodeURIComponent(user.id)}&dining_hall=${encodeURIComponent(hall)}`, {
          method: 'POST',
          body: JSON.stringify({ selected_meals: selMeals, include_restaurant_alts: inclRest })
      });
      
      setPlan(res);
      setActive(selMeals[0] || 'breakfast');
      if (res.liveMenu?.fetched) setMsg({ ok: true, text: `Cached ${res.liveMenu.count} menu items for ${res.liveMenu.hall}.` });
    } catch (e) {
      setMsg({ ok: false, text: 'Plan generation failed.' });
    }
    setLoading(false);
  };

  const addToTracker = async (mealPeriod: string, variant: any) => {
    if (!user) return;
    try {
      await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}`, {
        method: 'POST',
        body: JSON.stringify({
          date: getLocalDateString(),
          meal_period: mealPeriod,
          label: variant.label,
          foods: variant.items || [],
        }),
      });
      setMsg({ ok: true, text: `Added "${variant.label}" to tracker!` });
    } catch { setMsg({ ok: false, text: 'Could not log meal.' }); }
  };

  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;

  const mealPlan = plan?.plan || {};
  const openFullMenu = (mealPeriod: string) => {
    navigation.navigate('FullMenu', {
      location: hall,
      mealPeriod,
      title: `${hall} Menu`,
      sourceHint: plan?.liveMenu?.fetched ? 'live' : 'database',
    });
  };

  const content = (
      <ScrollView style={s.container} contentContainerStyle={{ paddingHorizontal: embedded ? 0 : 16, paddingTop: embedded ? 0 : 4, paddingBottom: 48 }}>
        {!embedded ? (
          <>
            <PillTabs
              items={[
                { key: 'menus', label: 'Menus', icon: UtensilsCrossed },
                { key: 'location', label: 'Location', icon: MapPin },
              ]}
              activeKey={activeTopTab}
              onChange={(key) => {
                setActiveTopTab(key as 'menus' | 'location');
              }}
              floating={false}
              compact={false}
              activeTextMode="active-only"
              layout="stacked"
            />

            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={{ fontSize: 24, color: T.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[s.title, { color: T.text }]}>Menus</Text>
            </View>
          </>
        ) : null}

        <Card>
          <SectionLabel>Location</SectionLabel>
          <View style={s.chipRow}>
            {HALLS.map(h => (
              <TouchableOpacity key={h.key} 
                  style={[
                    s.chip,
                    s.glassChip,
                    { borderColor: T.btnBorder, backgroundColor: T.btnBg },
                    hall === h.key && {
                      borderColor: darkMode ? T.tamuGold : 'rgba(12,12,14,0.88)',
                      backgroundColor: selectedGlassFill,
                    },
                  ]} 
                  onPress={() => {
                    setHall(h.key);
                    setActiveTopTab('location');
                  }}>
                <Text style={[s.chipText, { color: T.text2 }, hall === h.key && { color: selectedGlassText }]}>{h.label}</Text>
                <Text style={[s.chipSub, { color: T.text3 }, hall === h.key && { color: selectedGlassSub }]}>{h.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Divider />
          <SectionLabel>Meals</SectionLabel>
          <View style={s.chipRow}>
            {MEALS.map((m) => {
              const MealIcon = M_ICON[m];
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    s.chip,
                    s.glassChip,
                    { borderColor: T.btnBorder, backgroundColor: T.btnBg },
                    selMeals.includes(m) && {
                      borderColor: M_CLR[m],
                      backgroundColor: darkMode ? M_CLR[m] + '1a' : M_CLR[m] + '20',
                    },
                  ]}
                  onPress={() => toggle(m)}
                >
                  <MealIcon size={16} color={selMeals.includes(m) ? (darkMode ? M_CLR[m] : T.text) : T.text3} />
                  <Text style={[s.chipText, { color: T.text2 }, selMeals.includes(m) && { color: darkMode ? M_CLR[m] : T.text }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Divider />
          <View style={s.switchRow}>
            <View style={{flex:1}}>
              <Text style={{color: T.text2, fontSize:13, fontWeight:'600'}}>Restaurant Alternatives</Text>
              <Text style={{color: T.text3, fontSize:11, marginTop:2}}>Show $11 swipe options too</Text>
            </View>
            <Switch value={inclRest} onValueChange={setInclRest} trackColor={{ false: T.border2, true: COLORS.primary }} thumbColor={inclRest ? T.tamuGold : T.text3} />
          </View>

          <View style={{marginTop: 12}}>
            <ActionButton label={loading ? "Generating..." : "Generate Plan"} onPress={run} disabled={loading} style={{backgroundColor: T.tamuMaroon}} textStyle={{color: T.tamuGold}} />
          </View>
          <View style={{ marginTop: 10 }}>
            <ActionButton
              label="Open Full Menu"
              onPress={() => openFullMenu(active || getDiningMealPeriodForLocation(hall))}
              style={{ backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border }}
              textStyle={{ color: T.text }}
            />
          </View>
        </Card>

        {msg && <Badge label={msg.text} color={msg.ok ? T.sage : T.clay} />}

        {plan && (
          <View style={{ marginTop: 20 }}>
            {plan.profile && (
                <View style={s.pillRow}>
                    <StatPill
                      label="Target"
                      value={`${plan.profile.targetCalories} kcal`}
                      color={T.amber}
                      style={[s.statPill, { flex: 1, backgroundColor: T.btnBg, borderColor: T.btnBorder }]}
                      labelStyle={{ color: T.text3 }}
                      valueStyle={{ fontSize: 16 }}
                    />
                    <StatPill
                      label="Protein"
                      value={`${plan.profile.macros?.protein}g`}
                      color={T.sage}
                      style={[s.statPill, { flex: 1, backgroundColor: T.btnBg, borderColor: T.btnBorder }]}
                      labelStyle={{ color: T.text3 }}
                      valueStyle={{ fontSize: 16 }}
                    />
                    <StatPill
                      label="Mode"
                      value={plan.profile.mode ? plan.profile.mode.charAt(0).toUpperCase() + plan.profile.mode.slice(1) : '—'}
                      color={T.sky}
                      style={[s.statPill, { flex: 1, backgroundColor: T.btnBg, borderColor: T.btnBorder }]}
                      labelStyle={{ color: T.text3 }}
                      valueStyle={{ fontSize: 10 }}
                    />
                </View>
            )}

            <View style={[s.tabs, { borderBottomColor: T.border }]}>
              {MEALS.filter(m => selMeals.includes(m)).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    s.tab,
                    s.glassTab,
                    { backgroundColor: T.btnBg, borderColor: T.btnBorder },
                    active === m && { borderBottomColor: M_CLR[m], borderBottomWidth: 2, borderColor: M_CLR[m], backgroundColor: M_CLR[m] + '14' },
                  ]}
                  onPress={() => setActive(m)}
                >
                  <Text style={[s.tabText, { color: T.text3 }, active === m && { color: M_CLR[m] }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {active && mealPlan[active] && (
          <MealPanel
                data={mealPlan[active]}
                color={M_CLR[active]}
                onAdd={(v: any) => addToTracker(active, v)}
                T={T}
              />
            )}
          </View>
        )}
      </ScrollView>
  );

  if (embedded) {
    return <View style={{ flex: 1 }}>{content}</View>;
  }

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

// Shorten full location names to compact pill labels
const LOC_SHORT: Record<string, string> = {
  'Sbisa Underground Food Court': 'Sbisa UG',
  'MSC Food Court': 'MSC',
  'West Campus Food Hall': 'West Campus',
  'Polo Garage': 'Polo',
  'Rec Center': 'Rec Center',
  'Sbisa Complex': 'Sbisa',
  'Underground Food Court': 'Underground',
  'Southside': 'Southside',
  'Evans Library': 'Evans',
  'The Quad': 'Quad',
  'Zachry': 'Zachry',
  'Langford': 'Langford',
  'Creekside Market': 'Creekside',
  'RELLIS': 'RELLIS',
  'Bush Library': 'Bush Lib',
};
function shortenLoc(full: string): string {
  for (const [pattern, short] of Object.entries(LOC_SHORT)) {
    if (full.includes(pattern)) return short;
  }
  // Fallback: take the part after the dash
  const dash = full.indexOf(' - ');
  if (dash > 0) return full.substring(dash + 3);
  return full;
}

function MealPanel({ data, color, onAdd, T }: any) {
  return (
    <View style={{ marginTop: 15 }}>
      <SectionLabel>Dining Hall Options</SectionLabel>
      {data?.variants?.map((v: any, i: number) => (
        <Card key={i}>
          <View style={s.variantHeader}>
              <View style={[s.variantIconWrap, { backgroundColor: color + '18' }]}>
                <UtensilsCrossed size={18} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.variantLabel, { color: T.text }]}>{v.label}</Text>
                <Text style={[s.variantSub, { color: T.text3 }]}>{Math.round(v.totals?.calories || 0)} kcal • {Math.round(v.totals?.protein || 0)}g P</Text>
              </View>
              <TouchableOpacity style={[s.addBtn, { borderColor: color }]} onPress={() => onAdd(v)}>
                <View style={s.addBtnContent}>
                  <Plus size={13} color={color} />
                  <Text style={{ color, fontWeight: '700', fontSize: 12 }}>Add</Text>
                </View>
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
                      {p.success !== false ? (
                        <>
                          <View style={s.variantHeader}>
                            <View style={{flex: 1}}>
                                <Text style={[s.variantLabel, { color: T.text }]}>{name}</Text>
                                <Text style={[s.variantSub, { color: T.text3 }]}>{Math.round(p.totals?.calories || 0)} kcal • ${p.totals?.cost?.toFixed(2) || '0'} / $11</Text>
                            </View>
                            <TouchableOpacity style={[s.addBtn, { borderColor: '#5ab0e8' }]} onPress={() => onAdd({ ...p, label: name })}>
                                <View style={s.addBtnContent}>
                                  <Plus size={13} color="#5ab0e8" />
                                  <Text style={{ color: '#5ab0e8', fontWeight: '700', fontSize: 12 }}>Add</Text>
                                </View>
                            </TouchableOpacity>
                          </View>

                          {p.items && p.items.length > 0 && <Divider />}
                          {p.items?.map((it: any, j: number) => (
                              <Text key={j} style={[s.foodItem, { color: T.text2 }]}>• {it.name} <Text style={{color: T.amber}}>x{it.quantity}</Text> <Text style={{color: T.text3, fontSize: 10}}>({Math.round(it.calories || 0)} kcal)</Text></Text>
                          ))}
                          
                          {/* Location pills */}
                          {p.locations && p.locations.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                              {p.locations.map((loc: string, i: number) => (
                                <View key={i} style={{ backgroundColor: T.bg3, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.border }}>
                                  <Text style={{ color: T.text3, fontSize: 9, fontWeight: '700' }}>{shortenLoc(loc)}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </>
                      ) : (
                        <View>
                          <Text style={[s.variantLabel, { color: T.text }]}>{name}</Text>
                          <Text style={{ color: T.text3, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>Menu may vary — check location</Text>
                          {p.locations && p.locations.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                              {p.locations.map((loc: string, i: number) => (
                                <View key={i} style={{ backgroundColor: T.bg3, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.border }}>
                                  <Text style={{ color: T.text3, fontSize: 9, fontWeight: '700' }}>{shortenLoc(loc)}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
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
    padding: 13, 
    borderRadius: 20, 
    borderWidth: 1,
    gap: 3 
  },
  glassChip: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipSub: { fontSize: 10 },
  switchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 10, borderBottomWidth: 1, marginBottom: 14, paddingBottom: 12 },
  tab: { paddingVertical: 12, flex: 1, alignItems: 'center', borderRadius: 999, borderWidth: 1 },
  glassTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  tabText: { fontWeight: '900', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  statPill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  variantHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  variantIconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  variantLabel: { fontWeight: '900', fontSize: 16, letterSpacing: -0.2 },
  variantSub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  addBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foodItem: { fontSize: 13, marginBottom: 5, paddingLeft: 5 },
  fullMenuBtn: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  fullMenuText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
});
