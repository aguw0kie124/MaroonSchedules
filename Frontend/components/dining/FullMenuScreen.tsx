import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, Clock3, UtensilsCrossed } from 'lucide-react-native';
import { Card, SectionLabel, Badge } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { PillTabs } from '../PillTabs';
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

export default function FullMenuScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const T = useDiningTheme(theme === 'dark');

  const { location, mealPeriod, title, locations, sourceHint } = route.params || {};
  const isDiningHall = isDiningHallMenuLocation(location);
  const availableMealPeriods = isDiningHall ? getDiningMealOptionsForLocation(location) : [];
  const [activeMealPeriod, setActiveMealPeriod] = useState<DiningMealPeriod>(
    (mealPeriod as DiningMealPeriod) || getDiningMealPeriodForLocation(location),
  );
  const [menusByPeriod, setMenusByPeriod] = useState<Record<string, any>>({});
  const menu = menusByPeriod[activeMealPeriod] || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextMealPeriod: DiningMealPeriod) => {
    if (!location) {
      setError('Menu details are unavailable.');
      setLoading(false);
      return;
    }

    if (!isDiningHall) {
      setError('Menus are only available for Sbisa, Commons, and Duncan.');
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
  }, [isDiningHall, location, menusByPeriod]);

  useEffect(() => {
    load(activeMealPeriod);
  }, [activeMealPeriod, load]);

  useEffect(() => {
    if (!location) return;
    if (!isDiningHall) return;
    prefetchDiningMenus([location], availableMealPeriods).catch(() => {});
  }, [availableMealPeriods, isDiningHall, location]);

  const categoryCount = menu?.categories?.length || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card style={s.heroCard}>
          <View style={s.heroHeader}>
            <TouchableOpacity style={[s.backBtn, { backgroundColor: T.btnBg, borderColor: T.cardBorder }]} onPress={() => navigation.goBack()}>
              <ChevronLeft size={22} color={T.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.kicker, { color: T.amber }]}>Dining hall menu</Text>
              <Text style={[s.title, { color: T.text }]} numberOfLines={1}>
                {formatMenuTitle(location, title)}
              </Text>
              <Text style={[s.subtitle, { color: T.text3 }]}>
                {isDiningHall ? 'Live DineOnCampus feed' : 'Menu viewer'}
              </Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <Badge label={`${menu?.count ?? 0} ITEMS`} color={T.amber} />
            <Badge label={`${categoryCount} CATEGORIES`} color={T.sky} />
            <Badge label={(menu?.source || sourceHint || 'live').toUpperCase()} color={T.sage} />
          </View>

          <View style={s.locationMetaRow}>
            <View style={s.locationMetaPill}>
              <Clock3 size={14} color={T.text3} />
              <Text style={[s.locationMetaText, { color: T.text2 }]}>
                {formatMealLabel(activeMealPeriod)}
              </Text>
            </View>
            <View style={s.locationMetaPill}>
              <UtensilsCrossed size={14} color={T.text3} />
              <Text style={[s.locationMetaText, { color: T.text2 }]}>
                {isDiningHall ? 'Dining hall service' : 'Menu details'}
              </Text>
            </View>
          </View>
        </Card>

        {isDiningHall ? (
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
        ) : null}

        {!isDiningHall ? (
          <Card>
            <Text style={[s.emptyText, { color: T.text3 }]}>
              Menus are only shown for the main dining halls.
            </Text>
          </Card>
        ) : loading ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator color={T.tamuGold} size="large" />
            <Text style={[s.loadingText, { color: T.text3 }]}>Loading live menu…</Text>
          </Card>
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
                <View style={s.categoryHeader}>
                  <SectionLabel>{category.name}</SectionLabel>
                  <Badge label={`${category.items.length} items`} color={T.sky} />
                </View>
                <View style={s.categoryList}>
                  {category.items.map((item: any, index: number) => (
                    <View
                      key={`${category.name}-${item.location || 'menu'}-${item.name}`}
                      style={[
                        s.itemRow,
                        { borderBottomColor: T.border },
                        index === category.items.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={[s.itemName, { color: T.text }]}>{item.name}</Text>
                        <Text style={[s.itemMeta, { color: T.text3 }]}>
                          {Math.round(item.calories || 0)} kcal
                          {!!item.protein && ` • ${Math.round(item.protein)}g protein`}
                          {!!item.location && menu.locations?.length > 1 && ` • ${item.location}`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
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
  heroCard: { marginBottom: 14, padding: 18 },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  kicker: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  backBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 21, borderWidth: 1 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2, fontWeight: '600' },
  mealTabsWrap: { marginBottom: 14 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  locationMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  locationMetaPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  locationMetaText: { fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  locationWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locationPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  locationText: { fontSize: 12, fontWeight: '700' },
  loadingCard: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  loadingText: { fontSize: 13, fontWeight: '600' },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryList: { marginTop: 2 },
  itemRow: { paddingVertical: 12, borderBottomWidth: 1 },
  itemName: { fontSize: 15, fontWeight: '800' },
  itemMeta: { fontSize: 12, marginTop: 4, fontWeight: '500' },
});
