import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ImageBackground,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@clerk/clerk-expo';
import { ChevronLeft } from 'lucide-react-native';
import { Card, SectionLabel, Badge } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { PillTabs } from '../PillTabs';
import { API_URL } from '../../config';
import { getLocalDateString } from '../../services/dateUtils';
import {
  DiningMealPeriod,
  fetchDiningFullMenuCached,
  getDiningMealOptionsForLocation,
  getDiningMealPeriodForLocation,
  isDiningHallMenuLocation,
  prefetchDiningMenus,
} from '../../services/diningMenuCache';

function formatMealLabel(meal: string) {
  const value = (meal || '').toLowerCase();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Menu';
}

function formatMenuTitle(location?: string, title?: string) {
  const rawValue = (title || location || 'Menu').trim();
  const stripped = rawValue.replace(/\s+(Breakfast|Lunch|Dinner)$/i, '').replace(/\s+Menu$/i, '');
  return `${stripped || 'Menu'} Menu`;
}

function buildMenuItemKey(item: any) {
  return item.name;
}

function buildFoodPayload(item: any, location: string, mealPeriod: DiningMealPeriod) {
  return {
    name: item.name,
    source: 'dining_menu',
    calories: Number(item.calories || 0),
    protein: Number(item.protein || 0),
    carbs: Number(item.carbs || 0),
    fat: Number(item.fat || 0),
    fiber: item.fiber != null ? Number(item.fiber) : undefined,
    sodium: item.sodium != null ? Number(item.sodium) : undefined,
    location: item.location || location,
    meal_period: mealPeriod,
    quantity: 1,
  };
}

function SwipeableMenuItem({
  item,
  portionCount,
  onAddPortion,
  onRemovePortion,
  borderColor,
  textColor,
  metaColor,
  accentAdd,
  accentRemove,
}: any) {
  const translateX = useRef(new Animated.Value(0)).current;

  const resetPosition = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 8,
    }).start();
  }, [translateX]);

  const triggerAdd = useCallback(async () => {
    await onAddPortion(item);
    resetPosition();
  }, [item, onAddPortion, resetPosition]);

  const triggerRemove = useCallback(async () => {
    if (portionCount <= 0) {
      resetPosition();
      return;
    }
    await onRemovePortion(item);
    resetPosition();
  }, [item, onRemovePortion, portionCount, resetPosition]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
        onPanResponderMove: (_, gesture) => {
          const clamped = Math.max(-96, Math.min(96, gesture.dx));
          translateX.setValue(clamped);
        },
        onPanResponderRelease: async (_, gesture) => {
          if (gesture.dx >= 60) {
            await triggerAdd();
            return;
          }
          if (gesture.dx <= -60) {
            await triggerRemove();
            return;
          }
          resetPosition();
        },
        onPanResponderTerminate: resetPosition,
      }),
    [resetPosition, translateX, triggerAdd, triggerRemove],
  );

  return (
    <View style={[s.swipeRowShell, { borderBottomColor: borderColor }]}>
      <View style={[s.swipeAction, s.swipeActionLeft, { backgroundColor: accentRemove }]}>
        <Text style={s.swipeActionText}>{portionCount > 0 ? 'Remove' : 'None'}</Text>
      </View>
      <View style={[s.swipeAction, s.swipeActionRight, { backgroundColor: accentAdd }]}>
        <Text style={s.swipeActionText}>Add</Text>
      </View>
      <Animated.View
        style={[
          s.itemRow,
          {
            borderBottomColor: borderColor,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[s.itemName, { color: textColor }]}>{item.name}</Text>
          <Text style={[s.itemMeta, { color: metaColor }]}>
            {Math.round(item.calories || 0)} kcal
            {!!item.protein && ` • ${Math.round(item.protein)}g protein`}
            {!!item.location && ` • ${item.location}`}
          </Text>
        </View>
        <View style={s.portionWrap}>
          <Text style={[s.portionCount, { color: portionCount > 0 ? textColor : metaColor }]}>
            {portionCount}x
          </Text>
          <Text style={[s.portionHint, { color: metaColor }]}>swipe</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function FullMenuScreen({ navigation, route }: any) {
  const { user } = useUser();
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);
  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;

  const { location, mealPeriod, title, locations, sourceHint } = route.params || {};
  const availableMealPeriods = getDiningMealOptionsForLocation(location);
  const isDiningHall = isDiningHallMenuLocation(location);
  const [activeMealPeriod, setActiveMealPeriod] = useState<DiningMealPeriod>(
    (mealPeriod as DiningMealPeriod) || getDiningMealPeriodForLocation(location),
  );
  const [menusByPeriod, setMenusByPeriod] = useState<Record<string, any>>({});
  const menu = menusByPeriod[activeMealPeriod] || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portionCounts, setPortionCounts] = useState<Record<string, { count: number; entryIds: number[] }>>({});
  const [syncingItemKey, setSyncingItemKey] = useState<string | null>(null);

  const load = useCallback(async (nextMealPeriod: DiningMealPeriod) => {
    if (!location) {
      setError('Menu details are unavailable.');
      setLoading(false);
      return;
    }

    if (menusByPeriod[nextMealPeriod]) {
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await fetchDiningFullMenuCached({
        location,
        mealPeriod: nextMealPeriod,
      });
      if (result.success) {
        setMenusByPeriod((current) => ({
          ...current,
          [nextMealPeriod]: result,
        }));
      } else {
        setError(result.message || 'No menu items available right now.');
      }
    } catch (fetchError) {
      setError('Could not load the menu.');
    } finally {
      setLoading(false);
    }
  }, [location, menusByPeriod]);

  useEffect(() => {
    load(activeMealPeriod);
  }, [activeMealPeriod, load]);

  useEffect(() => {
    if (!location) return;
    prefetchDiningMenus([location], availableMealPeriods).catch(() => {});
  }, [availableMealPeriods, location]);

  const refreshTrackerCounts = useCallback(async () => {
    if (!user) return;
    try {
      const tracker = await fetch(`${API_URL}/dining/tracker/${user.id}?date=${getLocalDateString()}`).then((response) => response.json());
      const entries = Array.isArray(tracker?.entries) ? tracker.entries : [];
      const nextCounts = entries.reduce((acc: Record<string, { count: number; entryIds: number[] }>, entry: any) => {
        if (entry.meal_period !== activeMealPeriod) return acc;
        const key = entry.label;
        const existing = acc[key] || { count: 0, entryIds: [] };
        existing.count += 1;
        existing.entryIds.push(entry.id);
        acc[key] = existing;
        return acc;
      }, {});
      setPortionCounts(nextCounts);
    } catch (trackerError) {
      console.error('Failed to refresh tracker counts', trackerError);
    }
  }, [activeMealPeriod, user]);

  useEffect(() => {
    refreshTrackerCounts();
  }, [refreshTrackerCounts]);

  const addPortion = useCallback(async (item: any) => {
    if (!user || !location) return;
    const itemKey = buildMenuItemKey(item);
    setSyncingItemKey(itemKey);
    try {
      await fetch(`${API_URL}/dining/tracker/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: getLocalDateString(),
          meal_period: activeMealPeriod,
          label: item.name,
          foods: [buildFoodPayload(item, location, activeMealPeriod)],
        }),
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refreshTrackerCounts();
    } catch (trackerError) {
      console.error('Could not add menu item to tracker', trackerError);
      Alert.alert('Error', 'Could not add this portion right now.');
    } finally {
      setSyncingItemKey(null);
    }
  }, [activeMealPeriod, location, refreshTrackerCounts, user]);

  const removePortion = useCallback(async (item: any) => {
    if (!user) return;
    const itemKey = buildMenuItemKey(item);
    const tracked = portionCounts[itemKey];
    const entryId = tracked?.entryIds?.[tracked.entryIds.length - 1];
    if (!entryId) return;

    setSyncingItemKey(itemKey);
    try {
      await fetch(`${API_URL}/dining/tracker/${user.id}/${entryId}`, { method: 'DELETE' });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refreshTrackerCounts();
    } catch (trackerError) {
      console.error('Could not remove menu item from tracker', trackerError);
      Alert.alert('Error', 'Could not remove this portion right now.');
    } finally {
      setSyncingItemKey(null);
    }
  }, [portionCounts, refreshTrackerCounts, user]);

  const categoryCount = menu?.categories?.length || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      {wallpaperSource ? (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.72)' }]} />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      )}

      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: T.text }]} numberOfLines={1}>
              {formatMenuTitle(location, title)}
            </Text>
            <Text style={[s.subtitle, { color: T.text3 }]}>
              {formatMealLabel(activeMealPeriod)}
              {isDiningHall ? ' service' : ' menu'}
            </Text>
          </View>
        </View>

        <View style={s.mealTabsWrap}>
          <PillTabs
            items={availableMealPeriods.map((period) => ({
              key: period,
              label: formatMealLabel(period),
            }))}
            activeKey={activeMealPeriod}
            onChange={(key) => setActiveMealPeriod(key as DiningMealPeriod)}
            floating
            compact
          />
        </View>

        <View style={s.metaRow}>
          <Badge label={`${menu?.count ?? 0} items`} color={T.amber} />
          <Badge label={`${categoryCount} categories`} color={T.sky} />
          <Badge label={(menu?.source || sourceHint || 'menu').toUpperCase()} color={T.sage} />
        </View>

        {loading ? (
          <View style={{ paddingTop: 40 }}>
            <ActivityIndicator color={T.tamuGold} size="large" />
          </View>
        ) : error ? (
          <Card>
            <Text style={[s.emptyText, { color: T.text3 }]}>{error}</Text>
          </Card>
        ) : (
          <>
            {menu?.locations?.length > 1 && (
              <Card>
                <SectionLabel>Locations</SectionLabel>
                <View style={s.locationWrap}>
                  {(menu.locations || locations || []).map((entry: string) => (
                    <View key={entry} style={[s.locationPill, { backgroundColor: T.bg3, borderColor: T.border }]}>
                      <Text style={[s.locationText, { color: T.text2 }]}>{entry}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {(menu?.categories || []).map((category: any) => (
              <Card key={category.name}>
                <SectionLabel>{category.name}</SectionLabel>
                {category.items.map((item: any) => (
                  <View key={`${category.name}-${item.location || 'menu'}-${item.name}`}>
                    <SwipeableMenuItem
                      item={item}
                      portionCount={portionCounts[buildMenuItemKey(item)]?.count || 0}
                      onAddPortion={addPortion}
                      onRemovePortion={removePortion}
                      borderColor={T.border}
                      textColor={T.text}
                      metaColor={T.text3}
                      accentAdd={T.sage}
                      accentRemove={T.clay}
                    />
                    {syncingItemKey === buildMenuItemKey(item) ? (
                      <View style={s.syncingBadge}>
                        <ActivityIndicator color={T.tamuGold} size="small" />
                      </View>
                    ) : null}
                  </View>
                ))}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  mealTabsWrap: { marginBottom: 14 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  locationWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locationPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  locationText: { fontSize: 12, fontWeight: '700' },
  swipeRowShell: { position: 'relative', overflow: 'hidden' },
  swipeAction: {
    position: 'absolute',
    top: 0,
    bottom: 1,
    width: 96,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionLeft: {
    left: 0,
  },
  swipeActionRight: {
    right: 0,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemRow: { paddingVertical: 12, borderBottomWidth: 1, backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '800' },
  itemMeta: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  portionWrap: { alignItems: 'flex-end', minWidth: 48 },
  portionCount: { fontSize: 16, fontWeight: '900' },
  portionHint: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
  syncingBadge: { position: 'absolute', right: 0, top: 10 },
});
