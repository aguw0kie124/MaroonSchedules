import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated,
  TouchableOpacity, StatusBar,
  ImageBackground, ActivityIndicator, ScrollView
} from 'react-native';
import Svg, {
  Circle, G, Defs, Rect, ClipPath,
  LinearGradient as SvgGrad, Stop,
} from 'react-native-svg';
import { ClipboardList, CookingPot, Database, Flame, Cog, Ticket } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { API_URL } from '../../config';
import { useTheme } from '../SharedUI';
import { PillTabs } from '../PillTabs';
import { PageModuleEditor } from '../PageModuleEditor';
import { useDiningTheme } from './DiningTheme';
import MealOptimizerScreen from './MealOptimizerScreen';
import MealTrackerScreen from './MealTrackerScreen';
import StreakHubScreen from './StreakHubScreen';
import RetailSwipesScreen from './RetailSwipesScreen';
import FoodDatabaseScreen from './FoodDatabaseScreen';
import { getLocalDateString } from '../../services/dateUtils';
import { computeDiningStreakStats } from '../../services/diningStreaks';
import { getOrderedItems, getOrderedVisibleItems, isNavItemVisible, useAppShellStore } from '../../store/appShellStore';
import { DINING_PREFETCH_LOCATIONS, prefetchDiningMenus } from '../../services/diningMenuCache';

const { width: SW } = Dimensions.get('window');
const CONTENT_W = Math.min(SW - 32, 440);

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_STROKE = 18;
const RING_GAP    = 14; 
const OUTER_R     = CONTENT_W * 0.40; 
const SVG_W       = CONTENT_W;
const CX          = CONTENT_W / 2;
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

export default function DiningDashboard({ navigation }: any) {
  const { user } = useUser();
  const { theme, useWallpaper: showWallpaper, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);
  const navItems = useAppShellStore((state) => state.navItems);
  const diningActions = useAppShellStore((state) => state.diningActions);
  const moveDiningAction = useAppShellStore((state) => state.moveDiningAction);
  const toggleDiningAction = useAppShellStore((state) => state.toggleDiningAction);
  const isStandaloneMenusVisible = isNavItemVisible(navItems, 'Menus');
  const orderedDiningActions = React.useMemo(
    () => getOrderedItems(diningActions).filter((item) => !(item.id === 'menus' && isStandaloneMenusVisible)),
    [diningActions, isStandaloneMenusVisible],
  );
  const visibleDiningActions = React.useMemo(
    () => orderedDiningActions.filter((item) => item.visible),
    [orderedDiningActions],
  );

  const [profile, setProfile] = useState<any>(null);
  const [tracker, setTracker] = useState<any>(null);
  const [fills, setFills]     = useState([0, 0, 0, 0]); // cal, protein, carbs, fat
  const [streak, setStreak]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [activeDiningTab, setActiveDiningTab] = useState<'menus' | 'tracker' | 'streak' | 'swipes' | 'database'>('tracker');

  const fillAnims  = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(28)).current;
  const visibleDiningModuleIds = React.useMemo(
    () => visibleDiningActions.map((item) => item.id),
    [visibleDiningActions],
  );
  const showHealthTracker = visibleDiningModuleIds.includes('rings') || visibleDiningModuleIds.includes('macros');
  const showRings = visibleDiningModuleIds.includes('rings');
  const showMacros = visibleDiningModuleIds.includes('macros');
  const trackerVisible = visibleDiningModuleIds.includes('tracker') || showHealthTracker;
  const diningTopTabs = React.useMemo(
    () => [
      visibleDiningModuleIds.includes('menus') ? { key: 'menus', label: 'Menus', icon: CookingPot } : null,
      trackerVisible ? { key: 'tracker', label: 'Tracker', icon: ClipboardList } : null,
      visibleDiningModuleIds.includes('streak') ? { key: 'streak', label: 'Streaks', icon: Flame } : null,
      visibleDiningModuleIds.includes('swipes') ? { key: 'swipes', label: 'Swipes', icon: Ticket } : null,
      visibleDiningModuleIds.includes('database') ? { key: 'database', label: 'Database', icon: Database } : null,
      { key: 'settings', label: 'Settings', icon: Cog },
    ].filter(Boolean) as Array<{ key: string; label: string; icon: any }>,
    [trackerVisible, visibleDiningModuleIds],
  );
  const firstDiningTab = React.useMemo(
    () => (diningTopTabs.find((tab) => tab.key !== 'settings')?.key || 'tracker') as 'menus' | 'tracker' | 'streak' | 'swipes' | 'database',
    [diningTopTabs],
  );

  React.useEffect(() => {
    if (!diningTopTabs.some((tab) => tab.key === activeDiningTab)) {
      setActiveDiningTab(firstDiningTab);
    }
  }, [activeDiningTab, diningTopTabs, firstDiningTab]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const today = getLocalDateString();
      const [profRes, trackRes, histRes] = await Promise.all([
        fetch(`${API_URL}/dining/profile/${user.id}`).then(r => r.json()),
        fetch(`${API_URL}/dining/tracker/${user.id}?date=${today}`).then(r => r.json()),
        fetch(`${API_URL}/dining/history/${user.id}?days=180`).then(r => r.json()).catch(() => []),
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

      const streakStats = computeDiningStreakStats(
        Array.isArray(histRes) ? histRes : [],
        targetCalories,
        profRes?.mode || 'maintain',
      );
      setStreak(streakStats.currentStreak);
      prefetchDiningMenus(DINING_PREFETCH_LOCATIONS).catch(() => {});
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

  if (loading) return <View style={s.safe}><ActivityIndicator color="#E8922A" size="large" style={{flex: 1}} /></View>;

  const tgt  = profile?.targetCalories || 2000;
  const tot  = tracker?.totals || {};
  const remaining = Math.max(0, tgt - (tot.calories || 0));
  const calFill = fills[0];

  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : darkMode
      ? require('../../assets/black_marble.jpg')
      : require('../../assets/white_marble.jpg');

  const renderTrackerContent = () => (
    <>
      {showRings ? (
        <View style={[s.healthPanel, {
          backgroundColor: darkMode ? 'rgba(10,10,12,0.52)' : 'rgba(255,255,255,0.58)',
          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.68)',
        }]}>
          <View style={s.trackerToggleRow}>
            <ToggleChip
              label="Rings"
              active={showRings}
              onPress={() => toggleDiningAction('rings')}
              T={T}
            />
            <ToggleChip
              label="Macros"
              active={showMacros}
              onPress={() => toggleDiningAction('macros')}
              T={T}
            />
          </View>

          {showRings ? (
            <>
              <View style={{ width: CONTENT_W, height: SVG_H, alignItems: 'center', alignSelf: 'center' }}>
                <Svg width={SVG_W} height={SVG_H}>
                  <Defs>
                    {RING_DEFS.map((ring, i) => (
                      <SvgGrad key={`wg-${i}`} id={`wood-${i}`} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={WOOD_COLORS[0]} stopOpacity="1" />
                        <Stop offset="0.3" stopColor={WOOD_COLORS[1]} stopOpacity="1" />
                        <Stop offset="0.7" stopColor={WOOD_COLORS[2]} stopOpacity="1" />
                        <Stop offset="1" stopColor={WOOD_COLORS[3]} stopOpacity="1" />
                      </SvgGrad>
                    ))}
                    <SvgGrad id="wood-center" x1="0" y1="1" x2="0" y2="0">
                      <Stop offset="0" stopColor="#5a3a1a" stopOpacity="1" />
                      <Stop offset="0.4" stopColor="#8b6335" stopOpacity="1" />
                      <Stop offset="0.8" stopColor="#6a4520" stopOpacity="1" />
                      <Stop offset="1" stopColor="#7a5530" stopOpacity="1" />
                    </SvgGrad>
                  </Defs>

                  {RING_DEFS.map((ring, i) => {
                    const r = rR(i);
                    const c = circ(r);
                    const fill = Math.max(0, Math.min(1, fills[i + 1]));
                    const dash = c * fill;
                    const ringColor = (T as any)[ring.colorKey];
                    return (
                      <G key={ring.key}>
                        <Circle cx={CX} cy={CY} r={r + RING_STROKE / 2 + 2} stroke={T.border3} strokeWidth={1.5} fill="none" opacity={0.45} />
                        <G rotation="-90" origin={`${CX},${CY}`}>
                          <Circle cx={CX} cy={CY} r={r} stroke={T.ringTrack} strokeWidth={RING_STROKE} fill="none" strokeLinecap="butt" />
                          {fill > 0.005 ? (
                            <Circle cx={CX} cy={CY} r={r} stroke={`url(#wood-${i})`} strokeWidth={RING_STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} strokeDashoffset={0} />
                          ) : null}
                          {fill > 0.005 ? (
                            <Circle cx={CX} cy={CY} r={r} stroke={ringColor} strokeWidth={10} fill="none" opacity={0.7} strokeLinecap="round" strokeDasharray={`${dash} ${c}`} strokeDashoffset={0} />
                          ) : null}
                        </G>
                      </G>
                    );
                  })}

                  <Circle cx={CX} cy={CY} r={rR(RING_DEFS.length) + RING_STROKE / 2 + 2} stroke={T.border3} strokeWidth={1.5} fill="none" opacity={0.45} />

                  {(() => {
                    const innerR = rR(RING_DEFS.length) - 4;
                    const fillH = innerR * 2 * calFill;
                    const topY = CY + innerR - fillH;
                    return (
                      <G>
                        <Circle cx={CX} cy={CY} r={innerR} fill={T.ringTrack} stroke={T.border3} strokeWidth={2} opacity={0.6} />
                        {calFill > 0.005 ? (
                          <G>
                            <Defs>
                              <ClipPath id="cal-clip"><Circle cx={CX} cy={CY} r={innerR - 1} /></ClipPath>
                            </Defs>
                            <Rect x={CX - innerR} y={topY} width={innerR * 2} height={fillH} fill="url(#wood-center)" clipPath="url(#cal-clip)" />
                          </G>
                        ) : null}
                        <Circle cx={CX} cy={CY} r={innerR} fill="none" stroke={T.border2} strokeWidth={2.5} opacity={0.7} />
                      </G>
                    );
                  })()}
                </Svg>

                <View style={[s.centerOverlay, { top: CY - 40 }]}>
                  <Text style={[s.calNum, { color: (tot.calories || 0) > 0 ? '#FFFFFF' : T.text }]}>{Math.round(remaining).toLocaleString()}</Text>
                  <Text style={[s.calSub, { color: (tot.calories || 0) > 0 ? '#FFFFFF' : T.text3 }]}>KCAL LEFT</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <View style={s.trackerToggleRow}>
          <ToggleChip
            label="Rings"
            active={showRings}
            onPress={() => toggleDiningAction('rings')}
            T={T}
          />
          <ToggleChip
            label="Macros"
            active={showMacros}
            onPress={() => toggleDiningAction('macros')}
            T={T}
          />
        </View>
      )}

      {showMacros ? (
        <View style={[s.macroRow, showRings ? s.macroRowSpaced : s.macroRowCompact]}>
          <MacroPill val={Math.round(tot.protein || 0)} label="protein" color={T.ringProtein} T={T} />
          <MacroPill val={Math.round(tot.carbs || 0)} label="carbs" color={T.ringCarbs} T={T} />
          <MacroPill val={Math.round(tot.fat || 0)} label="fat" color={T.ringFat} T={T} />
        </View>
      ) : null}

      {!showRings && !showMacros ? (
        <View style={s.emptyTrackerState}>
          <Text style={[s.emptyTrackerText, { color: T.text3 }]}>Turn Rings or Macros on above if you want those summary modules visible here.</Text>
        </View>
      ) : null}

      {visibleDiningModuleIds.includes('tracker') ? (
        <View style={s.embeddedTrackerWrap}>
          <MealTrackerScreen navigation={navigation} embedded />
        </View>
      ) : null}
    </>
  );

  const renderDiningTabContent = () => {
    if (activeDiningTab === 'menus') {
      return <MealOptimizerScreen navigation={navigation} embedded />;
    }

    if (activeDiningTab === 'tracker') {
      return renderTrackerContent();
    }

    if (activeDiningTab === 'streak') {
      return <StreakHubScreen navigation={navigation} embedded />;
    }

    if (activeDiningTab === 'swipes') {
      return <RetailSwipesScreen navigation={navigation} embedded />;
    }

    return <FoodDatabaseScreen navigation={navigation} embedded />;
  };

  return (
    <View style={[s.safe, { backgroundColor: T.bg }]}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />

      {showWallpaper && (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: darkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.10)',
          }]} />
        </ImageBackground>
      )}

      <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={s.topBarRow}>
          <PillTabs
            items={diningTopTabs}
            activeKey={activeDiningTab}
            onChange={(key) => {
              if (key === 'settings') {
                setIsEditorVisible(true);
                return;
              }
              setActiveDiningTab(key as 'menus' | 'tracker' | 'streak' | 'swipes' | 'database');
            }}
            floating={false}
            compact={false}
            activeTextMode="active-only"
            layout="stacked"
          />
        </View>

        <View style={s.tabPane}>
          {activeDiningTab === 'tracker' ? (
            <ScrollView
              style={s.tabScroll}
              contentContainerStyle={s.tabScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {renderDiningTabContent()}
            </ScrollView>
          ) : (
            renderDiningTabContent()
          )}
        </View>

      </Animated.View>

      <PageModuleEditor
        visible={isEditorVisible}
        onClose={() => setIsEditorVisible(false)}
        title="Dining"
        items={orderedDiningActions}
        onToggle={toggleDiningAction}
        onMove={moveDiningAction}
        secondaryActionLabel="Open Dining Settings"
        onSecondaryAction={() => {
          setIsEditorVisible(false);
          navigation.navigate('DiningSettings');
        }}
      />
    </View>
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

function ToggleChip({ label, active, onPress, T }: any) {
  return (
    <TouchableOpacity
      style={[
        s.toggleChip,
        {
          backgroundColor: active ? T.text : T.btnBg,
          borderColor: active ? T.text : T.btnBorder,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.toggleChipText, { color: active ? T.bg : T.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  healthPanel: {
    marginTop: 8,
    borderRadius: 30,
    borderWidth: 1,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  greeting: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 10, fontWeight: '600', letterSpacing: 2.2, textTransform: 'uppercase', marginTop: 2 },
  gearBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  centerOverlay: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  calNum: { fontSize: 42, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -2, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  calSub: { fontSize: 9, fontWeight: '700', letterSpacing: 2.8, textTransform: 'uppercase', marginTop: 2 },
  trackerToggleRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 0,
    marginTop: 2,
    marginBottom: 14,
  },
  toggleChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyTrackerState: {
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyTrackerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  macroRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingHorizontal: 0 },
  macroRowSpaced: { marginTop: 18, marginBottom: 14 },
  macroRowCompact: { marginTop: 0, marginBottom: 4 },
  embeddedTrackerWrap: {
    marginTop: 18,
  },
  tabPane: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabScroll: {
    flex: 1,
  },
  tabScrollContent: {
    paddingTop: 4,
    paddingBottom: 120,
  },
  macroPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  macroPillVal: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  macroPillUnit: { fontSize: 12, fontWeight: '600' },
  macroPillLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1.2, marginTop: 2, textAlign: 'center' },
});
