import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
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
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';

import { Card, SectionLabel, Badge } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { PillTabs } from '../PillTabs';
import { requestJson } from '../../api/client';
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((categoryName: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  }, []);

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
    // When meal period changes, clear collapsed categories to keep everything expanded
    setCollapsedCategories(new Set());
  }, [activeMealPeriod, load]);

  useEffect(() => {
    if (!location) return;
    prefetchDiningMenus([location], availableMealPeriods).catch(() => {});
  }, [availableMealPeriods, location]);

  const refreshTrackerCounts = useCallback(async () => {
    if (!user) return;
    try {
      const tracker = await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}?date=${encodeURIComponent(getLocalDateString())}`);
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
      await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}`, {
        method: 'POST',
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
      Alert.alert('Error', 'Could not add this item right now.');
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
      await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}/${entryId}`, { method: 'DELETE' });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refreshTrackerCounts();
    } catch (trackerError) {
      console.error('Could not remove menu item from tracker', trackerError);
      Alert.alert('Error', 'Could not remove this item right now.');
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

            {(menu?.categories || []).map((category: any) => {
              const isCollapsed = collapsedCategories.has(category.name);
              return (
                <Card key={category.name} style={{ paddingHorizontal: 0 }}>
                  <TouchableOpacity
                    style={s.categoryHeader}
                    onPress={() => toggleCategory(category.name)}
                    activeOpacity={0.7}
                  >
                    <SectionLabel style={{ marginBottom: isCollapsed ? 0 : 16 }}>{category.name}</SectionLabel>
                    {!isCollapsed ? (
                      <ChevronUp size={16} color={T.amber} />
                    ) : (
                      <ChevronDown size={16} color={T.amber} />
                    )}
                  </TouchableOpacity>

                  {!isCollapsed && (
                    <View style={{ paddingHorizontal: 20 }}>
                      {category.items.map((item: any) => (
                        <View key={`${category.name}-${item.location || 'menu'}-${item.name}`} style={[s.itemRow, { borderBottomColor: T.border }]}>


                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={[s.itemName, { color: T.text }]}>{item.name}</Text>
                      <Text style={[s.itemMeta, { color: T.text3 }]}>
                        {Math.round(item.calories || 0)} kcal
                        {!!item.protein && ` • ${Math.round(item.protein)}g protein`}
                        {!!item.location && menu.locations?.length > 1 && ` • ${item.location}`}
                      </Text>
                    </View>
                    <View style={s.actionWrap}>
                      <View style={s.countSlot}>
                        {portionCounts[buildMenuItemKey(item)]?.count > 0 ? (
                          <Text style={[s.countText, { color: T.text3 }]}>
                            {portionCounts[buildMenuItemKey(item)]?.count}x
                          </Text>
                        ) : null}
                      </View>
                      {portionCounts[buildMenuItemKey(item)]?.count > 0 ? (
                        <TouchableOpacity
                          style={[s.actionButton, { borderColor: T.clay, backgroundColor: `${T.clay}18` }]}
                          onPress={() => removePortion(item)}
                          disabled={syncingItemKey === buildMenuItemKey(item)}
                        >
                          <Text style={[s.actionSymbol, { color: T.clay }]}>-</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={[s.actionButton, { borderColor: T.sage, backgroundColor: `${T.sage}18` }]}
                        onPress={() => addPortion(item)}
                        disabled={syncingItemKey === buildMenuItemKey(item)}
                      >
                        {syncingItemKey === buildMenuItemKey(item) ? (
                          <ActivityIndicator color={T.sage} size="small" />
                        ) : (
                          <Text style={[s.actionSymbol, { color: T.sage }]}>+</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                      ))}
                    </View>
                  )}
                </Card>
              );
            })}

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
  itemRow: { paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '800' },
  itemMeta: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  actionWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countSlot: { minWidth: 28, alignItems: 'flex-end', justifyContent: 'center' },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSymbol: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  countText: { fontSize: 12, fontWeight: '800', minWidth: 22, textAlign: 'right' },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
});
