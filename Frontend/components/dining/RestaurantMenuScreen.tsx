import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { getStaticRestaurantMenu } from '../../data/restaurantMenus';

function formatRetailMenuTitle(location?: string, title?: string) {
  const rawValue = (title || location || 'Menu').trim();
  const stripped = rawValue.replace(/\s+Menu$/i, '');
  return `${stripped || 'Menu'} Menu`;
}

export default function RestaurantMenuScreen({ navigation, route }: any) {
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);
  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;

  const { location, title } = route.params || {};
  const staticMenu = useMemo(() => getStaticRestaurantMenu(location), [location]);
  
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeCategoryKey, setActiveCategoryKey] = useState('all');

  const toggleCategory = useCallback((categoryName: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  }, []);

  const categoryOptions = useMemo(() => {
    const cats = staticMenu?.categories || [];
    const options = cats.map((c: any) => ({
      key: c.name.trim().toLowerCase(),
      label: c.name,
      count: (c.items || []).length,
    }));
    if (staticMenu?.maroonMeals) {
      options.unshift({
        key: 'maroon-meals',
        label: 'Maroon Meals',
        count: (staticMenu.maroonMeals.combos || []).length,
      });
    }
    if (options.length > 0) {
      options.unshift({
        key: 'all',
        label: 'All Stations',
        count: cats.reduce((s: number, c: any) => s + (c.items?.length || 0), 0),
      });
    }
    return options;
  }, [staticMenu]);

  const visibleCategories = useMemo(() => {
    if (activeCategoryKey === 'all') return staticMenu?.categories || [];
    if (activeCategoryKey === 'maroon-meals') return [];
    return (staticMenu?.categories || []).filter((c: any) => c.name.trim().toLowerCase() === activeCategoryKey);
  }, [staticMenu, activeCategoryKey]);

  useEffect(() => {
    const categoryNames = (staticMenu?.categories || []).map((category: any) => category.name);
    if (activeCategoryKey === 'all') {
      setCollapsedCategories(new Set(categoryNames));
    } else {
      setCollapsedCategories(new Set());
    }
  }, [staticMenu, activeCategoryKey]);

  if (!staticMenu) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: T.bg }]}>
        <View style={{ padding: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ChevronLeft size={28} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.emptyText, { color: T.text3, marginTop: 40 }]}>
            Menu for {location} is currently unavailable.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const menuTitle = formatRetailMenuTitle(location, title);
  const itemCount = (staticMenu.categories || []).reduce(
    (acc, cat) => acc + (cat.items?.length || 0),
    0,
  );
  const stationCount = staticMenu.categories?.length || 0;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: T.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      
      {wallpaperSource ? (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View style={[StyleSheet.absoluteFill, darkMode ? { backgroundColor: 'rgba(0,0,0,0.58)' } : { backgroundColor: 'rgba(255,255,255,0.72)' }]} />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ChevronLeft size={28} color={T.text} />
          </TouchableOpacity>
          <View>
            <Text style={[s.title, { color: T.text }]}>{menuTitle}</Text>
            <Text style={[s.subtitle, { color: T.textSecondary }]}>Restaurant Menu</Text>
          </View>
        </View>

        {categoryOptions.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.categoryFilterScroll}
            contentContainerStyle={s.categoryFilterRow}
          >
            {categoryOptions.map((category, idx) => (
              <TouchableOpacity
                key={`${category.key}-${idx}`}
                style={[
                  s.categoryFilterChip,
                  { backgroundColor: T.bg2, borderColor: T.border },
                  activeCategoryKey === category.key ? [s.categoryFilterChipActive, { borderColor: T.text }] : null,
                ]}
                onPress={() => {
                  setActiveCategoryKey(category.key);
                  setCollapsedCategories(new Set()); 
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.categoryFilterLabel,
                    { color: T.text2 },
                    activeCategoryKey === category.key ? { color: T.text } : null,
                  ]}
                >
                  {category.label}
                </Text>
                <View style={[s.categoryFilterCount, { backgroundColor: T.bg3 }]}>
                  <Text style={[s.categoryFilterCountText, { color: T.text3 }]}>
                    {category.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        <Text style={[s.metaSummary, { color: T.text3 }]}>
          {itemCount} items • {stationCount} stations
        </Text>

        {(staticMenu.locations || []).length > 1 ? (
          <View style={s.locationWrap}>
            {(staticMenu.locations || []).map((entry: string, idx: number) => (
              <View
                key={`${entry}-${idx}`}
                style={[
                  s.locationPill,
                  { backgroundColor: T.bg2, borderColor: T.border },
                ]}
              >
                <Text style={[s.locationText, { color: T.text2 }]}>{entry}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {staticMenu.maroonMeals && activeCategoryKey === 'maroon-meals' && (
          <View
            style={[
              s.featureBlock,
              {
                backgroundColor: darkMode ? 'rgba(80,0,0,0.16)' : 'rgba(80,0,0,0.05)',
                borderColor: darkMode ? 'rgba(185, 28, 28, 0.35)' : 'rgba(80,0,0,0.18)',
              },
            ]}
          >
            <View style={s.maroonMealsHeader}>
              <Text style={[s.featureLabel, { color: T.text }]}>Maroon Meals</Text>
            </View>
            <Text style={[s.maroonMealsNote, { color: T.text2 }]}>
              {staticMenu.maroonMeals.note}
            </Text>
            <View style={{ gap: 8 }}>
              {(staticMenu.maroonMeals.combos || []).map((combo, idx) => (
                <View key={`${combo.name}-${idx}`} style={[
                  s.maroonMealRow, 
                  { borderBottomColor: T.border },
                  idx === (staticMenu.maroonMeals!.combos.length - 1) ? { borderBottomWidth: 0 } : null
                ]}>
                  <Text style={[s.itemName, { color: T.text, flex: 1 }]}>{combo.name}</Text>
                  <View style={s.maroonMealValueBadge}>
                    <Text style={s.maroonMealValueText}>${combo.value.toFixed(2)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {(visibleCategories || []).map((category: any, catIdx: number) => {
          const isCollapsed = collapsedCategories.has(category.name);
          const categoryKey = `${category.name}-${catIdx}`;
          return (
            <View
              key={categoryKey}
              style={[
                s.categoryBlock,
                { backgroundColor: T.bg2 },
              ]}
            >
              <TouchableOpacity
                style={s.categoryHeader}
                onPress={() => toggleCategory(category.name)}
                activeOpacity={0.7}
              >
                  <Text
                    style={[
                      s.categoryTitle,
                      { color: T.text },
                    ]}
                  >
                    {category.name}
                </Text>
                {isCollapsed ? (
                  <ChevronDown size={16} color={T.amber} />
                ) : (
                  <ChevronUp size={16} color={T.amber} />
                )}
              </TouchableOpacity>

              {!isCollapsed && (
                <View style={s.categoryItemsWrap}>
                  {(category.items || []).map((item: any, itmIdx: number) => (
                    <View key={`${category.name}-${item.name}-${itmIdx}`} style={[s.itemRow, { borderBottomColor: T.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.itemName, { color: T.text }]}>{item.name}</Text>
                        {item.description ? (
                          <Text style={[s.itemDescription, { color: T.text3 }]} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                        <Text style={[s.itemMeta, { color: T.text3 }]}>
                          {Math.round(item.calories || 0) > 0 ? `${Math.round(item.calories)} kcal` : ''}
                          {!!item.protein && ` • ${Math.round(item.protein)}g protein`}
                          {!!item.portion && item.portion !== '—' && ` • ${item.portion}`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
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
  categoryFilterScroll: { marginBottom: 16 },
  categoryFilterRow: { gap: 8, paddingRight: 8 },
  categoryFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryFilterChipActive: {
    borderWidth: 1.5,
  },
  categoryFilterLabel: { fontSize: 12, fontWeight: '700' },
  categoryFilterCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: 'center',
  },
  categoryFilterCountText: { fontSize: 10, fontWeight: '800' },
  metaSummary: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  locationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  locationPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  featureBlock: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  featureLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  categoryBlock: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  categoryItemsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  itemRow: { paddingVertical: 13, borderBottomWidth: 1 },
  itemName: { fontSize: 15, fontWeight: '800' },
  itemDescription: { fontSize: 12, marginTop: 4, fontWeight: '400', lineHeight: 17 },
  itemMeta: { fontSize: 12, marginTop: 5, fontWeight: '500' },
  maroonMealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  maroonMealsNote: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginBottom: 14,
  },
  maroonMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  maroonMealValueBadge: {
    backgroundColor: 'rgba(80,0,0,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  maroonMealValueText: {
    color: '#500000',
    fontSize: 12,
    fontWeight: '800',
  },
});
