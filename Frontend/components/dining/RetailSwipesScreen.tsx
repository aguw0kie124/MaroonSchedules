import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, SafeAreaView, StatusBar, ImageBackground } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Trophy } from 'lucide-react-native';
import { API_URL } from '../../config';
import { Card, SectionLabel, StatPill, Divider, ActionButton } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { getLocalDateString } from '../../services/dateUtils';

const RESTAURANTS = ['Chick-fil-A', 'Panda Express', 'Shake Smart', 'Houston Street Subs', 'Salata', 'Abu Omar Halal', 'Copperhead Jack\'s', 'Einstein Bros. Bagels', '1876 Burgers', 'Cabo Grill', 'Rev\'s American Grill', 'Whoop Coop', 'Pizza @ Underground'];
const SHORT: any = { 'Chick-fil-A': 'CFA', 'Panda Express': 'Panda', 'Shake Smart': 'Shake', 'Houston Street Subs': 'Subs', 'Abu Omar Halal': 'Abu Omar', 'Copperhead Jack\'s': 'CopJacks', 'Einstein Bros. Bagels': 'Einstein', '1876 Burgers': '1876', 'Cabo Grill': 'Cabo', 'Rev\'s American Grill': 'Revs', 'Whoop Coop': 'Whoop', 'Pizza @ Underground': 'Pizza' };

const LOC_SHORT: Record<string, string> = {
  'Sbisa Underground Food Court': 'Sbisa UG', 'MSC Food Court': 'MSC', 'Polo Garage': 'Polo',
  'Sbisa Complex': 'Sbisa', 'Underground Food Court': 'Underground', 'Southside': 'Southside',
  'Evans Library': 'Evans', 'The Quad': 'Quad', 'Zachry': 'Zachry', 'Langford': 'Langford',
  'Rec Center': 'Rec Center', 'West Campus Food Hall': 'West Campus',
};
function shortenLoc(full: string): string {
  for (const [p, s] of Object.entries(LOC_SHORT)) if (full.includes(p)) return s;
  const d = full.indexOf(' - ');
  return d > 0 ? full.substring(d + 3) : full;
}

export default function RetailSwipesScreen({ navigation, embedded = false }: any) {
  const { user } = useUser();
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

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
      const resp = await fetch(`${API_URL}/dining/swipes/${user.id}?date=${getLocalDateString()}`).then(r => r.json());
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
        body: JSON.stringify({ date: getLocalDateString(), restaurant: logRest, total_cost: +logCost || 11 }),
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
        // Pass the BRAND name as dining_hall — the backend will look it up in RESTAURANT_GROUPS
        const res = await fetch(`${API_URL}/dining/optimize/day?clerk_id=${user.id}&dining_hall=${selRest}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected_meals: [selMeal], include_restaurant_alts: true })
        }).then(r => r.json());
        
        // FIX: Check res.success (not res.status)
        if (res.success && res.plan?.[selMeal]) {
            const mPlan = res.plan[selMeal];
            // Look for this brand in restaurantPlans
            const opt = mPlan.restaurantPlans?.[selRest];
            if (opt && opt.success && opt.items?.length > 0) {
                setOptResult({ 
                    ...opt, 
                    success: true,
                    locations: opt.locations || [],
                    topPick: opt.topPick || opt.items[0]?.name || ''
                });
            } else {
                // Try the first successful restaurant plan as fallback
                const plans = mPlan.restaurantPlans || {};
                const firstSuccess = Object.entries(plans).find(([_, p]: any) => p.success && p.items?.length > 0);
                if (firstSuccess) {
                    const [name, p]: any = firstSuccess;
                    setOptResult({ ...p, success: true, brandName: name });
                } else {
                    setOptResult({ success: false, error: opt?.error || 'No valid combo found under $11.' });
                }
            }
        } else {
            setOptResult({ success: false, error: 'Optimization failed. Try a different meal period.' });
        }
    } catch (e) { setOptResult({ success: false, error: 'Connection error.' }); }
    setOptLoad(false);
  };

  const { swipes = [], usedThisWeek = 0, remaining = 7, todayUsed = 0 } = info || {};
  const openFullMenu = () => {
    navigation.navigate('FullMenu', {
      location: selRest,
      mealPeriod: selMeal,
      title: `${selRest} Menu`,
      locations: optResult?.locations || [],
      sourceHint: 'database',
    });
  };

  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;

  const content = (
      <ScrollView style={s.container} contentContainerStyle={{ padding: embedded ? 0 : 20, paddingBottom: 60 }}>
        {!embedded ? (
          <View style={s.header}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
                  <Text style={{ fontSize: 24, color: T.text }}>←</Text>
              </TouchableOpacity>
              <Text style={[s.title, { color: T.text }]}>Retail Swipes</Text>
          </View>
        ) : null}

        <Card>
          <SectionLabel>This Week ($11/swipe · 7/wk)</SectionLabel>
          <View style={s.pillRow}>
            <StatPill label="Used" value={`${usedThisWeek}/7`} color={usedThisWeek >= 6 ? T.clay : T.amber} style={{flex: 1}} />
            <StatPill label="Left" value={remaining} color={T.sage} style={{flex: 1}} />
            <StatPill label="Today" value={`${todayUsed}/2`} color={T.sky} style={{flex: 1}} />
          </View>

          <TouchableOpacity style={[s.logBtn, { borderColor: T.tamuMaroon, backgroundColor: T.bg3 }]} onPress={() => setShowLog(!showLog)}>
            <Text style={[s.logText, { color: T.tamuGold }]}>{showLog ? '✕ Cancel' : '+ Log Swipe'}</Text>
          </TouchableOpacity>

          {showLog && (
            <View style={{ marginTop: 15 }}>
              <TextInput style={[s.input, { backgroundColor: T.bg3, borderColor: T.border, color: T.text }]} placeholder="Cost (default $11)" placeholderTextColor={T.text3} value={logCost} onChangeText={setLogCost} keyboardType="decimal-pad" />
              <SectionLabel>Restaurant</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                {RESTAURANTS.map(r => (
                  <TouchableOpacity key={r} style={[s.restChip, { backgroundColor: T.bg3, borderColor: T.border }, logRest === r && { borderColor: T.amber, backgroundColor: T.amber + '18' }]} onPress={() => setLogRest(r)}>
                    <Text style={[s.restText, { color: T.text2 }, logRest === r && { color: T.amber }]}>{SHORT[r] || r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ActionButton label="Save Log" onPress={doLog} disabled={saving} style={{backgroundColor: T.tamuMaroon}} textStyle={{color: T.tamuGold}} />
            </View>
          )}
        </Card>

        <Card>
          <SectionLabel>Optimize $11 Combo</SectionLabel>
          <Text style={[s.subHeader, { color: T.text3 }]}>Restaurant</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
            {RESTAURANTS.map(r => (
              <TouchableOpacity key={r} style={[s.restChip, { backgroundColor: T.bg3, borderColor: T.border }, selRest === r && { borderColor: T.amber, backgroundColor: T.amber + '18' }]} onPress={() => setSelRest(r)}>
                <Text style={[s.restText, { color: T.text2 }, selRest === r && { color: T.amber }]}>{SHORT[r] || r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[s.subHeader, { color: T.text3 }]}>Meal Period</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              {['breakfast', 'lunch', 'dinner'].map(m => (
                  <TouchableOpacity key={m} style={[s.mealChip, { backgroundColor: T.bg3, borderColor: T.border }, selMeal === m && { borderColor: T.sky, backgroundColor: T.sky + '18' }]} onPress={() => setSelMeal(m)}>
                      <Text style={[s.mealText, { color: T.text2 }, selMeal === m && { color: T.sky }]}>{m.toUpperCase()}</Text>
                  </TouchableOpacity>
              ))}
          </View>

          <ActionButton label={optLoad ? "Searching..." : "Optimize Combo"} onPress={doOptimize} disabled={optLoad} style={{backgroundColor: T.tamuMaroon}} textStyle={{color: T.tamuGold}} />

          {optResult && (
            <View style={{ marginTop: 15 }}>
              <TouchableOpacity style={[s.fullMenuBtn, { backgroundColor: T.sky + '14', borderColor: T.sky }]} onPress={openFullMenu}>
                <Text style={[s.fullMenuText, { color: T.sky }]}>Full Menu</Text>
              </TouchableOpacity>

              {optResult.success ? (
                <View style={[s.optCard, { backgroundColor: T.card, borderColor: T.border }]}>
                  <Text style={[s.optMsg, { color: T.sage }]}>✓ Best combo found!</Text>

                  {/* Top Pick Banner */}
                  {optResult.topPick && (
                    <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg3, padding: 10, borderRadius: 8, marginVertical: 10}}>
                        <Trophy size={18} color={T.sky} style={{ marginRight: 10 }} />
                        <View style={{flex: 1}}>
                            <Text style={{color: T.sky, fontSize: 10, fontWeight: '800'}}>ORDER THIS:</Text>
                            <Text style={{color: T.text, fontSize: 14, fontWeight: '700'}}>{optResult.topPick}</Text>
                        </View>
                    </View>
                  )}

                  {/* All items */}
                  {optResult.items.map((it: any, i: number) => (
                    <View key={i} style={s.optRow}>
                        <Text style={[s.optItemName, { color: T.text }]}>{it.name}</Text>
                        <Text style={[s.optItemQty, { color: T.amber }]}>×{it.quantity}</Text>
                    </View>
                  ))}
                  <Divider />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[s.optTotal, { color: T.sky }]}>{Math.round(optResult.totals?.calories)} kcal</Text>
                      <Text style={[s.optPrice, { color: T.amber }]}>${optResult.totals?.cost?.toFixed(2)} / $11</Text>
                  </View>

                  {/* Location pills */}
                  {optResult.locations && optResult.locations.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                      {optResult.locations.map((loc: string, i: number) => (
                        <View key={i} style={{ backgroundColor: T.bg3, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: T.border }}>
                          <Text style={{ color: T.text3, fontSize: 9, fontWeight: '700' }}>{shortenLoc(loc)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : <Text style={{ color: T.clay, textAlign: 'center', fontStyle: 'italic' }}>Menu may vary — check location</Text>}
            </View>
          )}
        </Card>

        <Card>
          <SectionLabel>Usage History</SectionLabel>
          {swipes.length === 0 ? <Text style={{ color: T.text3, textAlign: 'center' }}>No history</Text> : 
            swipes.map((sw: any) => (
              <View key={sw.id} style={[s.historyRow, { borderBottomColor: T.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.historyRest, { color: T.text }]}>{sw.restaurant}</Text>
                  <Text style={[s.historyDate, { color: T.text3 }]}>{sw.date}</Text>
                </View>
                <Text style={[s.historyCost, { color: T.amber }]}>${sw.total_cost.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => doDelete(sw.id)} style={{ marginLeft: 15 }}><Text style={{ color: T.clay }}>✕</Text></TouchableOpacity>
              </View>
            ))
          }
        </Card>
      </ScrollView>
  );

  if (embedded) {
    return content;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }]} />
      </ImageBackground>
      {content}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, flex: 1 },
  pillRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  logBtn: { borderWidth: 1, padding: 12, borderRadius: 999, alignItems: 'center' },
  logText: { fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderRadius: 20, padding: 12, marginBottom: 15, borderWidth: 1 },
  subHeader: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  restChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  restText: { fontSize: 12, fontWeight: '700' },
  mealChip: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 999, borderWidth: 1 },
  mealText: { fontSize: 11, fontWeight: '800' },
  optCard: { padding: 14, borderRadius: 24, borderWidth: 1 },
  optMsg: { fontWeight: '900', fontSize: 12, marginBottom: 10, textTransform: 'uppercase' },
  optRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  optItemName: { fontSize: 13, flex: 1 },
  optItemQty: { fontWeight: 'bold', marginLeft: 10 },
  optTotal: { fontWeight: '900' },
  optPrice: { fontWeight: '900' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  historyRest: { fontWeight: '700', fontSize: 14 },
  historyDate: { fontSize: 11, marginTop: 2 },
  historyCost: { fontWeight: 'bold' },
  fullMenuBtn: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  fullMenuText: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
});
