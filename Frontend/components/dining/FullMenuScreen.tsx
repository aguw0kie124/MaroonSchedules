import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronLeft, Clock3, MapPin, UtensilsCrossed } from 'lucide-react-native';
import { Card } from './DiningUI';
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
  const stripped = rawValue
    .replace(/\s+(Breakfast|Lunch|Dinner)$/i, '')
    .replace(/\s+Menu$/i, '');
  return stripped || 'Dining Hall';
}

function buildItemMeta(item: any, showLocation: boolean) {
  const parts: string[] = [];
  if (item.calories) parts.push(`${Math.round(item.calories)} kcal`);
  if (item.protein) parts.push(`${Math.round(item.protein)}g protein`);
  if (item.location && showLocation) parts.push(item.location);
  return parts.join(' · ');
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const menu = menusByPeriod[activeMealPeriod] || null;
  const categoryCount = menu?.categories?.length || 0;
  const resolvedLocations = menu?.locations || locations || [];
  const showLocationForItems = resolvedLocations.length > 1;
  const menuSummary = useMemo(
    () => [
      { icon: UtensilsCrossed, label: 'Items', value: String(menu?.count ?? 0) },
      { icon: Clock3, label: 'Meal', value: formatMealLabel(activeMealPeriod) },
      { icon: MapPin, label: 'Sections', value: String(categoryCount) },
    ],
    [activeMealPeriod, categoryCount, menu?.count],
  );

  const load = useCallback(
    async (nextMealPeriod: DiningMealPeriod) => {
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
    },
    [isDiningHall, location, menusByPeriod],
  );

  useEffect(() => {
    load(activeMealPeriod);
  }, [activeMealPeriod, load]);

  useEffect(() => {
    if (!location || !isDiningHall) return;
    prefetchDiningMenus([location], availableMealPeriods).catch(() => {});
  }, [availableMealPeriods, isDiningHall, location]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topBar}>
          <TouchableOpacity
            style={[
              s.backBtn,
              { backgroundColor: T.btnBg, borderColor: T.cardBorder },
            ]}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={s.titleWrap}>
            <Text style={[s.kicker, { color: T.text3 }]}>Dining hall menu</Text>
            <Text style={[s.title, { color: T.text }]} numberOfLines={1}>
              {formatMenuTitle(location, title)}
            </Text>
          </View>
        </View>

        <Card style={s.heroCard}>
          <Text style={[s.heroTitle, { color: T.text }]}>
            {formatMealLabel(activeMealPeriod)}
          </Text>
          <Text style={[s.heroSubtitle, { color: T.text3 }]}>
            {isDiningHall
              ? 'Live menu from DineOnCampus.'
              : 'Menus are only shown for the main dining halls.'}
          </Text>

          <View style={s.summaryGrid}>
            {menuSummary.map((entry) => {
              const Icon = entry.icon;
              return (
                <View
                  key={entry.label}
                  style={[
                    s.summaryCard,
                    {
                      backgroundColor: T.bg3,
                      borderColor: T.border,
                    },
                  ]}
                >
                  <View style={s.summaryHeader}>
                    <Icon size={14} color={T.text3} />
                    <Text style={[s.summaryLabel, { color: T.text3 }]}>
                      {entry.label}
                    </Text>
                  </View>
                  <Text style={[s.summaryValue, { color: T.text }]}>
                    {entry.value}
                  </Text>
                </View>
              );
            })}
          </View>

          {sourceHint || menu?.source ? (
            <Text style={[s.sourceText, { color: T.text4 }]}>
              Source: {String(menu?.source || sourceHint || 'live').toUpperCase()}
            </Text>
          ) : null}
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
          <Card style={s.messageCard}>
            <Text style={[s.messageText, { color: T.text3 }]}>
              Menus are only shown for Sbisa, Commons, and Duncan.
            </Text>
          </Card>
        ) : loading ? (
          <Card style={s.messageCard}>
            <ActivityIndicator color={T.tamuMaroon} size="small" />
            <Text style={[s.messageText, { color: T.text3 }]}>Loading live menu…</Text>
          </Card>
        ) : error ? (
          <Card style={s.messageCard}>
            <Text style={[s.messageText, { color: T.text3 }]}>{error}</Text>
          </Card>
        ) : (
          <>
            {resolvedLocations.length > 1 ? (
              <Card style={s.locationsCard}>
                <Text style={[s.sectionEyebrow, { color: T.text3 }]}>Serving at</Text>
                <View style={s.locationWrap}>
                  {resolvedLocations.map((entry: string) => (
                    <View
                      key={entry}
                      style={[
                        s.locationPill,
                        { backgroundColor: T.bg3, borderColor: T.border },
                      ]}
                    >
                      <Text style={[s.locationText, { color: T.text2 }]}>{entry}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {(menu?.categories || []).map((category: any) => (
              <Card key={category.name} style={s.categoryCard}>
                <View style={s.categoryHeader}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[s.categoryTitle, { color: T.text }]}>
                      {category.name}
                    </Text>
                    <Text style={[s.categorySubtitle, { color: T.text3 }]}>
                      {category.items.length} items
                    </Text>
                  </View>
                </View>

                <View style={s.categoryList}>
                  {category.items.map((item: any, index: number) => {
                    const meta = buildItemMeta(item, showLocationForItems);
                    return (
                      <View
                        key={`${category.name}-${item.location || 'menu'}-${item.name}`}
                        style={[
                          s.itemRow,
                          { borderTopColor: T.border },
                          index === 0 && s.itemRowFirst,
                        ]}
                      >
                        <Text style={[s.itemName, { color: T.text }]}>{item.name}</Text>
                        {meta ? (
                          <Text style={[s.itemMeta, { color: T.text3 }]} numberOfLines={1}>
                            {meta}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
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
  content: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 28 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
  },
  mealTabsWrap: {
    marginBottom: 12,
  },
  messageCard: {
    borderRadius: 18,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  locationsCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  locationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  categorySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  categoryList: {
    marginTop: 6,
  },
  itemRow: {
    paddingVertical: 11,
    borderTopWidth: 1,
  },
  itemRowFirst: {
    borderTopWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  itemMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 3,
  },
});
