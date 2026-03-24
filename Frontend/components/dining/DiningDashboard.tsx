import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useUser } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../config';
import { Card, SectionLabel, StatPill, Badge } from './DiningUI';

const { width: SW } = Dimensions.get('window');
const RING_STROKE = 18;
const RING_GAP = 10;
const OUTER_R = SW * 0.38;
const CX = SW / 2;
const CY = OUTER_R + 20;

const RING_DEFS = [
  { key: 'calories', label: 'Calories', color: '#e8922a' },
  { key: 'protein', label: 'Protein', color: '#52d98a' },
  { key: 'carbs', label: 'Carbs', color: '#5ab0e8' },
  { key: 'fat', label: 'Fat', color: '#d4a030' },
];

function rR(i: number) { return OUTER_R - i * (RING_STROKE + RING_GAP); }

export default function DiningDashboard({ navigation }: any) {
  const { user } = useUser();
  const [profile, setProfile] = useState<any>(null);
  const [totals, setTotals] = useState<any>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const fillAnims = useRef(RING_DEFS.map(() => new Animated.Value(0))).current;
  const [fills, setFills] = useState([0, 0, 0, 0]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [profRes, trackRes, histRes] = await Promise.all([
        fetch(`${API_URL}/dining/profile/${user.id}`).then(r => r.json()),
        fetch(`${API_URL}/dining/tracker/${user.id}?date=${today}`).then(r => r.json()),
        fetch(`${API_URL}/dining/history/${user.id}?days=7`).then(r => r.json()),
      ]);

      setProfile(profRes);
      setTotals(trackRes.totals || {});

      // Streak calculation
      const mode = profRes.mode || 'maintain';
      const target = profRes.targetCalories || 2000;
      let s = 0;
      histRes.reverse().forEach((d: any) => {
          const r = d.calories / target;
          let ok = false;
          if (mode === 'cut') ok = r >= 0.5 && r <= 1.05;
          else if (mode === 'bulk') ok = r >= 0.95;
          else ok = r >= 0.85 && r <= 1.15;
          if (ok) s++; else s = 0;
      });
      setStreak(s);

      const tgt = profRes.targetCalories || 2000;
      const mac = profRes.macros || { protein: 150, carbs: 250, fat: 60 };
      const tot = trackRes.totals || {};

      const newFills = [
        Math.min(1, (tot.calories || 0) / tgt),
        Math.min(1, (tot.protein || 0) / (mac.protein || 1)),
        Math.min(1, (tot.carbs || 0) / (mac.carbs || 1)),
        Math.min(1, (tot.fat || 0) / (mac.fat || 1)),
      ];

      Animated.parallel(
        fillAnims.map((anim, i) =>
          Animated.spring(anim, { toValue: newFills[i], useNativeDriver: false, tension: 20, friction: 7 })
        )
      ).start();

      fillAnims.forEach((anim, i) => {
          anim.addListener(({ value }) => {
              setFills(prev => { const n = [...prev]; n[i] = value; return n; });
          });
      });

    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.container}><ActivityIndicator color="#E8922A" size="large" /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.header}>
        <View>
            <Text style={s.greeting}>Howdy, {user?.firstName}!</Text>
            <Text style={s.subText}>Your nutrition at a glance</Text>
        </View>
        <TouchableOpacity style={s.settingsBtn} onPress={() => navigation.navigate('DiningSettings')}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={s.svgContainer}>
        <Svg width={SW} height={CY + OUTER_R + 20}>
          <G cx={CX} cy={CY}>
            {RING_DEFS.map((ring, i) => {
              const r = rR(i);
              const c = 2 * Math.PI * r;
              return (
                <React.Fragment key={ring.key}>
                  <Circle cx={CX} cy={CY} r={r} stroke="#111" strokeWidth={RING_STROKE} fill="none" />
                  <Circle 
                    cx={CX} cy={CY} r={r} 
                    stroke={ring.color} strokeWidth={RING_STROKE} fill="none" 
                    strokeDasharray={`${c} ${c}`}
                    strokeDashoffset={c * (1 - fills[i])}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${CX} ${CY})`}
                  />
                </React.Fragment>
              );
            })}
          </G>
        </Svg>
        <View style={s.centerInfo}>
            <Text style={s.centerVal}>{Math.round(totals.calories || 0)}</Text>
            <Text style={s.centerLabel}>kcal today</Text>
            {streak > 0 && (
                <View style={s.streakBadge}>
                    <Text style={s.streakText}>🔥 {streak} DAY STREAK</Text>
                </View>
            )}
        </View>
      </View>

      <View style={s.statsGrid}>
        <StatPill label="Protein" value={`${Math.round(totals.protein || 0)}g`} color="#52d98a" />
        <StatPill label="Carbs" value={`${Math.round(totals.carbs || 0)}g`} color="#5ab0e8" />
        <StatPill label="Fat" value={`${Math.round(totals.fat || 0)}g`} color="#E8922A" />
      </View>

      <View style={s.btnGrid}>
        <NavBtn label="Optimize" icon="🧬" color="#5ab0e8" onPress={() => navigation.navigate('MealOptimizer')} />
        <NavBtn label="Tracker" icon="📋" color="#52d98a" onPress={() => navigation.navigate('MealTracker')} />
        <NavBtn label="Weight" icon="⚖️" color="#E8922A" onPress={() => navigation.navigate('WeightTracker')} />
        <NavBtn label="Swipes" icon="🎫" color="#d4a030" onPress={() => navigation.navigate('RetailSwipes')} />
        <NavBtn label="Database" icon="🔍" color="#999" onPress={() => navigation.navigate('FoodDatabase')} />
      </View>

    </ScrollView>
  );
}

const NavBtn = ({ label, icon, color, onPress }: any) => (
    <TouchableOpacity style={[s.navBtn, { borderColor: color + '33' }]} onPress={onPress}>
        <Text style={s.navIcon}>{icon}</Text>
        <Text style={s.navLabel}>{label}</Text>
    </TouchableOpacity>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, paddingTop: 60, alignItems: 'center' },
  greeting: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  subText: { color: '#888', fontSize: 13, marginTop: 4, fontWeight: '600' },
  settingsBtn: { backgroundColor: '#111', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222' },
  svgContainer: { alignItems: 'center', marginTop: -20 },
  centerInfo: { position: 'absolute', top: CY - 30, alignItems: 'center', width: SW },
  centerVal: { fontSize: 42, fontWeight: '900', color: '#fff' },
  centerLabel: { color: '#666', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  streakBadge: { backgroundColor: '#E8922A22', borderColor: '#E8922A', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 15 },
  streakText: { color: '#E8922A', fontSize: 10, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 20, marginTop: 10 },
  navBtn: { width: (SW - 60) / 3, backgroundColor: '#111', borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1, gap: 8 },
  navIcon: { fontSize: 24 },
  navLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
