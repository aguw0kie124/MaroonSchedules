import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
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
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);
  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : darkMode
      ? require('../../assets/black_marble.jpg')
      : require('../../assets/white_marble.jpg');

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
      <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.72)' }]} />
      </ImageBackground>

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

        <View style={s.metaRow}>
          <Badge label={`${menu?.count ?? 0} items`} color={T.amber} />
          <Badge label={`${categoryCount} categories`} color={T.sky} />
          <Badge label={(menu?.source || sourceHint || 'menu').toUpperCase()} color={T.sage} />
        </View>

        {!isDiningHall ? (
          <Card>
            <Text style={[s.emptyText, { color: T.text3 }]}>
              Menus are only shown for the main dining halls.
            </Text>
          </Card>
        ) : loading ? (
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
                  <View key={`${category.name}-${item.location || 'menu'}-${item.name}`} style={[s.itemRow, { borderBottomColor: T.border }]}>
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
  itemRow: { paddingVertical: 12, borderBottomWidth: 1 },
  itemName: { fontSize: 15, fontWeight: '800' },
  itemMeta: { fontSize: 12, marginTop: 4, fontWeight: '500' },
});
