import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated,
  TouchableOpacity, SafeAreaView, StatusBar,
  ImageBackground, ActivityIndicator, ScrollView
} from 'react-native';
import Svg, {
  Circle, G, Defs, Rect, ClipPath,
  LinearGradient as SvgGrad, Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { getLocalDateString } from '../../services/dateUtils';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_STROKE = 18;
const RING_GAP    = 14; 
const OUTER_R     = SW * 0.40; 
const SVG_W       = SW;
const CX          = SW / 2;
const RING_OFFSET = 10;
const CY          = OUTER_R + RING_OFFSET;
const SVG_H       = CY + OUTER_R + 10;

const RING_DEFS = [
  { key: 'protein', label: 'Protein', unit: 'g',    colorKey: 'ringProtein' },
  { key: 'carbs',   label: 'Carbs',   unit: 'g',    colorKey: 'ringCarbs'   },
  { key: 'fat',     label: 'Fat',     unit: 'g',    colorKey: 'ringFat'     },
];

function rR(i: number) { return OUTER_R - i * (RING_STROKE + RING_GAP); }
function circ(r: number) { return 2 * Math.PI * r; }

const WOOD_COLORS = ['#7a5530', '#9a7042', '#6a4520', '#8b6335'];

const TAB_ITEMS = [
  { id: 'Swipes',   label: 'Swipes',   icon: '🎫', screen: 'RetailSwipes' },
  { id: 'Database', label: 'Database', icon: '🗄️', screen: 'FoodDatabase'  },
];

export default function DiningDashboard({ navigation }: any) {
  const { user } = useUser();
  const { theme, useWallpaper: showWallpaper } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const [profile, setProfile] = useState<any>(null);
  const [tracker, setTracker] = useState<any>(null);
  const [fills, setFills]     = useState([0, 0, 0, 0]); // cal, protein, carbs, fat
  const [streak, setStreak]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(-1);

  const fillAnims  = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(28)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const today = getLocalDateString();
      const [profRes, trackRes, histRes] = await Promise.all([
        fetch(`${API_URL}/dining/profile/${user.id}`).then(r => r.json()),
        fetch(`${API_URL}/dining/tracker/${user.id}?date=${today}`).then(r => r.json()),
        fetch(`${API_URL}/dining/history/${user.id}?days=7`).then(r => r.json()).catch(() => []),
      ]);
      setProfile(profRes);
      setTracker(trackRes);

      const targetCalories = profRes?.targetCalories || 2000;
      const mac = profRes?.macros || { protein: 150, carbs: 200, fat: 55 };
      const tot = trackRes?.totals || {};

      const newFills = [
        Math.min(1, (tot.calories || 0) / targetCalories),
        Math.min(1, (tot.protein  || 0) / (mac.protein || 150)),
        Math.min(1, (tot.carbs    || 0) / (mac.carbs   || 200)),
        Math.min(1, (tot.fat      || 0) / (mac.fat     ||  55)),
      ];

      Animated.parallel(
        fillAnims.map((anim, i) =>
          Animated.spring(anim, { toValue: newFills[i], useNativeDriver: false, tension: 28, friction: 8 })
        )
      ).start();

      let s = 0;
      const mode = profRes?.mode || 'maintain';
      if (Array.isArray(histRes)) {
        histRes.reverse().forEach((d: any) => {
            const r = d.calories / targetCalories;
            let ok = false;
            if (mode === 'cut') ok = r >= 0.50 && r <= 1.15;
            else if (mode === 'bulk') ok = r >= 0.85;
            else ok = r >= 0.80 && r <= 1.20;
            if (ok) s++; else s = 0;
        });
      }
      setStreak(s);
    } catch (e) { console.warn(e); }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, speed: 14, bounciness: 5, useNativeDriver: false }),
    ]).start();

    const ids = fillAnims.map((anim, i) =>
      anim.addListener(({ value }) =>
        setFills(prev => { const n = [...prev]; n[i] = value; return n; })
      )
    );
    return () => { fillAnims.forEach((a, i) => a.removeListener(ids[i])); };
  }, []);

  const switchTab = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(index);
    Animated.spring(tabIndicator, {
      toValue: index,
      useNativeDriver: false,
      speed: 18,
      bounciness: 8,
    }).start();
    
    // Quick reset to unselect after navigating
    setTimeout(() => setActiveTab(-1), 500);
    navigation.navigate(TAB_ITEMS[index].screen);
  };

  if (loading) return <View style={s.safe}><ActivityIndicator color="#E8922A" size="large" style={{flex: 1}} /></View>;

  const tgt  = profile?.targetCalories || 2000;
  const tot  = tracker?.totals || {};
  const remaining = Math.max(0, tgt - (tot.calories || 0));
  const calFill = fills[0];

  const marbleSrc = darkMode
    ? require('../../assets/black_marble.jpg')
    : require('../../assets/white_marble.jpg');

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />

      {showWallpaper && (
        <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.08)',
          }]} />
        </ImageBackground>
      )}

      <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        
        {/* Floating Settings Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate('DiningSettings');
          }}
          style={[s.gearBtn, {
            position: 'absolute',
            top: 16,
            right: 24,
            zIndex: 100,
            backgroundColor: T.btnBg,
            borderColor: T.roseGold + '40',
          }]}
        >
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: 'space-evenly', paddingBottom: 10 }}>
            {/* Rings */}
            <View style={{ width: SW, height: SVG_H, alignItems: 'center' }}>
            <Svg width={SVG_W} height={SVG_H}>
                <Defs>
                {RING_DEFS.map((ring, i) => (
                    <SvgGrad key={`wg-${i}`} id={`wood-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0"   stopColor={WOOD_COLORS[0]} stopOpacity="1" />
                    <Stop offset="0.3" stopColor={WOOD_COLORS[1]} stopOpacity="1" />
                    <Stop offset="0.7" stopColor={WOOD_COLORS[2]} stopOpacity="1" />
                    <Stop offset="1"   stopColor={WOOD_COLORS[3]} stopOpacity="1" />
                    </SvgGrad>
                ))}
                <SvgGrad id="wood-center" x1="0" y1="1" x2="0" y2="0">
                    <Stop offset="0"   stopColor="#5a3a1a" stopOpacity="1" />
                    <Stop offset="0.4" stopColor="#8b6335" stopOpacity="1" />
                    <Stop offset="0.8" stopColor="#6a4520" stopOpacity="1" />
                    <Stop offset="1"   stopColor="#7a5530" stopOpacity="1" />
                </SvgGrad>
                <SvgGrad id="rg-sheen" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0"   stopColor="#b98d73" stopOpacity="0.6" />
                    <Stop offset="0.5" stopColor="#d4b59a" stopOpacity="0.9" />
                    <Stop offset="1"   stopColor="#b98d73" stopOpacity="0.6" />
                </SvgGrad>
                </Defs>

                {RING_DEFS.map((ring, i) => {
                const r    = rR(i);
                const c    = circ(r);
                const fill = Math.max(0, Math.min(1, fills[i + 1]));
                const dash = c * fill;
                const ringColor = (T as any)[ring.colorKey];
                return (
                    <G key={ring.key}>
                    <Circle cx={CX} cy={CY} r={r + RING_STROKE / 2 + 2} stroke={T.roseGold} strokeWidth={1.5} fill="none" opacity={0.45} />
                    <G rotation="-90" origin={`${CX},${CY}`}>
                        <Circle cx={CX} cy={CY} r={r} stroke={T.ringTrack} strokeWidth={RING_STROKE} fill="none" strokeLinecap="butt" />
                        {fill > 0.005 && (
                        <Circle cx={CX} cy={CY} r={r} stroke={`url(#wood-${i})`} strokeWidth={RING_STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} strokeDashoffset={0} />
                        )}
                        {fill > 0.02 && (
                        <Circle cx={CX} cy={CY} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={RING_STROKE * 0.30} fill="none" strokeLinecap="round" strokeDasharray={`${Math.min(dash, c * 0.10)} ${c}`} strokeDashoffset={-(dash - Math.min(dash, c * 0.10))} />
                        )}
                        {/* Color highlight inside wood grain */}
                        {fill > 0.005 && (
                        <Circle cx={CX} cy={CY} r={r} stroke={ringColor} strokeWidth={10} fill="none" opacity={0.7} strokeLinecap="round" strokeDasharray={`${dash} ${c}`} strokeDashoffset={0} />
                        )}
                    </G>
                    </G>
                );
                })}

                <Circle cx={CX} cy={CY} r={rR(RING_DEFS.length) + RING_STROKE / 2 + 2} stroke={T.roseGold} strokeWidth={1.5} fill="none" opacity={0.45} />

                {(() => {
                const innerR = rR(RING_DEFS.length) - 4;
                const fillH  = innerR * 2 * calFill;
                const topY   = CY + innerR - fillH;
                return (
                    <G>
                    <Circle cx={CX} cy={CY} r={innerR} fill={T.ringTrack} stroke={T.roseGold} strokeWidth={2} opacity={0.6} />
                    {calFill > 0.005 && (
                        <G>
                        <Defs>
                            <ClipPath id="cal-clip"><Circle cx={CX} cy={CY} r={innerR - 1} /></ClipPath>
                        </Defs>
                        <Rect x={CX - innerR} y={topY} width={innerR * 2} height={fillH} fill="url(#wood-center)" clipPath="url(#cal-clip)" />
                        </G>
                    )}
                    <Circle cx={CX} cy={CY} r={innerR} fill="none" stroke={T.roseGold} strokeWidth={2.5} opacity={0.7} />
                    </G>
                );
                })()}
            </Svg>

            <View style={[s.centerOverlay, { top: CY - 40 }]}>
                <Text style={[s.calNum, { color: (tot.calories || 0) > 0 ? '#FFFFFF' : T.text }]}>{Math.round(remaining).toLocaleString()}</Text>
                <Text style={[s.calSub, { color: (tot.calories || 0) > 0 ? '#FFFFFF' : T.text3 }]}>KCAL LEFT</Text>
            </View>
            </View>

            {/* Macros */}
            <View style={s.macroRow}>
            <MacroPill val={Math.round(tot.protein || 0)} label="protein" color={T.ringProtein} T={T} />
            <MacroPill val={Math.round(tot.carbs   || 0)} label="carbs"   color={T.ringCarbs}   T={T} />
            <MacroPill val={Math.round(tot.fat     || 0)} label="fat"     color={T.ringFat}     T={T} />
            </View>

            {/* Action Buttons: Unified Size and integrated text like MacroPills */}
            <View style={s.actionRow}>
                <ActionBtn icon="📋" label="Tracker" T={T} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('TrackerHub'); }} />
                <ActionBtn icon="🧬" label="Optimize" T={T} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('MealOptimizer'); }} />
                <ActionBtn icon="🔥" label={`${streak}d Streak`} T={T} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('StreakHub'); }} />
            </View>
        </View>

        {/* Tab Bar */}
        <View style={[s.tabBar, { backgroundColor: T.tabBarBg, borderColor: T.roseGold + '30' }]}>
          <Animated.View style={[s.tabIndicator, {
            backgroundColor: T.roseGold + '25',
            borderColor: T.roseGold + '40',
            opacity: activeTab >= 0 ? 1 : 0,
            transform: [{
              translateX: tabIndicator.interpolate({
                inputRange: [0, 1],
                outputRange: [0, (SW - 40) / 2],
              }),
            }],
            width: (SW - 40) / 2,
          }]} />

          {TAB_ITEMS.map((tab, i) => (
            <TouchableOpacity key={tab.id} style={s.tabItem} onPress={() => switchTab(i)} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
              <Text style={[s.tabLabel, { color: activeTab === i ? T.roseGold : T.text3 }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

function MacroPill({ val, label, color, T }: any) {
  return (
    <View style={[s.macroPill, { backgroundColor: T.btnBg, borderColor: T.btnBorder }]}>
      <Text style={[s.macroPillVal, { color }]}>{val}<Text style={[s.macroPillUnit, { color: color + 'aa' }]}>g</Text></Text>
      <Text style={[s.macroPillLabel, { color: T.text3 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, T, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: false, speed: 50 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: false, speed: 20, bounciness: 8 }).start();

  return (
    <TouchableOpacity onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} activeOpacity={1} style={{ flex: 1 }}>
      <Animated.View style={[{ 
          alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, width: '100%',
          backgroundColor: T.btnBg, borderColor: T.btnBorder, transform: [{ scale }], 
          overflow: 'hidden', shadowColor: T.btnShadow, shadowOffset: { width: 0, height: 4 }, 
          shadowOpacity: 0.25, shadowRadius: 8, elevation: 6
      }]}>
        <LinearGradient colors={[T.btnHighlight, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
        <Text style={{ fontSize: 24, marginBottom: 2 }}>{icon}</Text>
        <Text style={[s.macroPillLabel, { color: T.text2 }]}>{label.toUpperCase()}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  greeting: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 2.2, textTransform: 'uppercase', marginTop: 2 },
  gearBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  centerOverlay: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  calNum: { fontSize: 42, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -2, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  calSub: { fontSize: 9, fontWeight: '700', letterSpacing: 2.8, textTransform: 'uppercase', marginTop: 2 },
  macroRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, paddingHorizontal: 24, marginTop: 8 },
  macroPill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  macroPillVal: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  macroPillUnit: { fontSize: 12, fontWeight: '600' },
  macroPillLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1.2, marginTop: 2, textAlign: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, paddingHorizontal: 24, marginTop: 12 },
  actionBtnBox: { borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  tabBar: { marginHorizontal: 20, marginBottom: 95, marginTop: 5, flexDirection: 'row', borderRadius: 25, borderWidth: 1, paddingVertical: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8, overflow: 'hidden' },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, left: 8, borderRadius: 20, borderWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
});
