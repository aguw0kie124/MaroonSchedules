import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@clerk/clerk-expo';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  MapPin,
  Minus,
  Plus,
  Search,
  UtensilsCrossed,
} from 'lucide-react-native';

import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { requestJson } from '../../api/client';
import { getLocalDateString } from '../../services/dateUtils';
import {
  DiningMealPeriod,
  fetchDiningFullMenuCached,
  getDiningMealOptionsForLocation,
  getDiningMealPeriodForLocation,
  prefetchDiningMenus,
} from '../../services/diningMenuCache';

function formatMealLabel(meal: string) {
  const value = (meal || '').toLowerCase();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Menu';
}

function formatLocationLabel(location?: string, title?: string) {
  const rawValue = (title || location || 'Menu').trim();
  return rawValue
    .replace(/\s+(Breakfast|Lunch|Dinner)$/i, '')
    .replace(/\s+Menu$/i, '')
    .trim();
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

function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCurrency(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `$${amount.toFixed(2)}`;
}

function buildItemBadges(item: any, showLocation: boolean) {
  const badges: Array<{ label: string; tone: 'accent' | 'success' | 'neutral' }> = [];

  if (item.protein && Number(item.protein) >= 15) {
    badges.push({
      label: `${Math.round(Number(item.protein))}g protein`,
      tone: 'success',
    });
  }

  if (item.calories && Number(item.calories) > 0) {
    badges.push({
      label: `${Math.round(Number(item.calories))} cal`,
      tone: 'neutral',
    });
  }

  if (showLocation && item.location) {
    badges.push({
      label: item.location,
      tone: 'accent',
    });
  }

  return badges.slice(0, 3);
}

function buildItemSupportLine(item: any, showLocation: boolean) {
  const bits: string[] = [];

  if (item.carbs && Number(item.carbs) > 0) {
    bits.push(`${Math.round(Number(item.carbs))}g carbs`);
  }

  if (item.fat && Number(item.fat) > 0) {
    bits.push(`${Math.round(Number(item.fat))}g fat`);
  }

  if (showLocation && item.location) {
    bits.push(item.location);
  }

  if (!bits.length && item.protein && Number(item.protein) > 0) {
    bits.push(`${Math.round(Number(item.protein))}g protein`);
  }

  return bits.join(' • ') || 'Available in this menu right now.';
}

function getCategoryPalette(categoryName: string, index: number, darkMode: boolean) {
  const lower = normalizeText(categoryName);

  if (lower.includes('salad')) {
    return darkMode
      ? { soft: 'rgba(52,199,89,0.18)', strong: '#7DF0A3', border: 'rgba(52,199,89,0.28)' }
      : { soft: '#EAF8EE', strong: '#2E8B57', border: '#CFEFD8' };
  }

  if (lower.includes('dessert')) {
    return darkMode
      ? { soft: 'rgba(255,149,0,0.18)', strong: '#FFC266', border: 'rgba(255,149,0,0.28)' }
      : { soft: '#FFF3E5', strong: '#C96B00', border: '#F7DDB9' };
  }

  if (lower.includes('drink')) {
    return darkMode
      ? { soft: 'rgba(10,132,255,0.18)', strong: '#74B9FF', border: 'rgba(10,132,255,0.28)' }
      : { soft: '#EAF4FF', strong: '#1769D1', border: '#D1E5FF' };
  }

  if (lower.includes('breakfast')) {
    return darkMode
      ? { soft: 'rgba(255,214,10,0.18)', strong: '#FFE580', border: 'rgba(255,214,10,0.28)' }
      : { soft: '#FFF8DE', strong: '#A67300', border: '#F6E8B3' };
  }

  const palettes = darkMode
    ? [
        { soft: 'rgba(10,132,255,0.18)', strong: '#74B9FF', border: 'rgba(10,132,255,0.28)' },
        { soft: 'rgba(255,69,58,0.18)', strong: '#FF8A80', border: 'rgba(255,69,58,0.28)' },
        { soft: 'rgba(94,92,230,0.18)', strong: '#B7B3FF', border: 'rgba(94,92,230,0.28)' },
        { soft: 'rgba(48,209,88,0.18)', strong: '#7AF2A1', border: 'rgba(48,209,88,0.28)' },
      ]
    : [
        { soft: '#EBF3FF', strong: '#1769D1', border: '#D4E3FF' },
        { soft: '#FFF0EE', strong: '#D84A3A', border: '#FFD8D1' },
        { soft: '#F1EDFF', strong: '#5B4BC4', border: '#E0D8FF' },
        { soft: '#ECFAF0', strong: '#2E8B57', border: '#D5F1DD' },
      ];

  return palettes[index % palettes.length];
}

export default function FullMenuScreen({ navigation, route }: any) {
  const { user } = useUser();
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);
  const s = useMemo(() => getStyles(T, darkMode), [T, darkMode]);
  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;

  const {
    location,
    mealPeriod,
    title,
    locations: routeLocations,
  } = route.params || {};

  const availableMealPeriods = getDiningMealOptionsForLocation(location);
  const locationLabel = formatLocationLabel(location, title);

  const [activeMealPeriod, setActiveMealPeriod] = useState<DiningMealPeriod>(
    (mealPeriod as DiningMealPeriod) || getDiningMealPeriodForLocation(location),
  );
  const [menusByPeriod, setMenusByPeriod] = useState<Record<string, any>>({});
  const menu = menusByPeriod[activeMealPeriod] || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portionCounts, setPortionCounts] = useState<
    Record<string, { count: number; entryIds: number[] }>
  >({});
  const [syncingItemKey, setSyncingItemKey] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeStation, setActiveStation] = useState('all');

  const load = useCallback(
    async (nextMealPeriod: DiningMealPeriod) => {
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

        if (result?.success) {
          setMenusByPeriod((current) => ({
            ...current,
            [nextMealPeriod]: result,
          }));
        } else {
          setError(result?.message || 'No menu items available right now.');
        }
      } catch (_fetchError) {
        setError('Could not load the menu.');
      } finally {
        setLoading(false);
      }
    },
    [location, menusByPeriod],
  );

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
      const tracker = await requestJson(
        `/dining/tracker/${encodeURIComponent(
          user.id,
        )}?date=${encodeURIComponent(getLocalDateString())}`,
      );

      const entries = Array.isArray(tracker?.entries) ? tracker.entries : [];
      const nextCounts = entries.reduce(
        (
          acc: Record<string, { count: number; entryIds: number[] }>,
          entry: any,
        ) => {
          if (entry.meal_period !== activeMealPeriod) return acc;
          const key = entry.label;
          const existing = acc[key] || { count: 0, entryIds: [] };
          existing.count += 1;
          existing.entryIds.push(entry.id);
          acc[key] = existing;
          return acc;
        },
        {},
      );

      setPortionCounts(nextCounts);
    } catch (trackerError) {
      console.error('Failed to refresh tracker counts', trackerError);
    }
  }, [activeMealPeriod, user]);

  useEffect(() => {
    refreshTrackerCounts();
  }, [refreshTrackerCounts]);

  const addPortion = useCallback(
    async (item: any) => {
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
    },
    [activeMealPeriod, location, refreshTrackerCounts, user],
  );

  const removePortion = useCallback(
    async (item: any) => {
      if (!user) return;

      const itemKey = buildMenuItemKey(item);
      const tracked = portionCounts[itemKey];
      const entryId = tracked?.entryIds?.[tracked.entryIds.length - 1];
      if (!entryId) return;

      setSyncingItemKey(itemKey);

      try {
        await requestJson(
          `/dining/tracker/${encodeURIComponent(user.id)}/${entryId}`,
          { method: 'DELETE' },
        );
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await refreshTrackerCounts();
      } catch (trackerError) {
        console.error('Could not remove menu item from tracker', trackerError);
        Alert.alert('Error', 'Could not remove this item right now.');
      } finally {
        setSyncingItemKey(null);
      }
    },
    [portionCounts, refreshTrackerCounts, user],
  );

  const toggleCategory = useCallback((categoryName: string) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  }, []);

  const menuLocations = useMemo<string[]>(() => {
    const values = Array.isArray(menu?.locations) && menu.locations.length
      ? menu.locations
      : Array.isArray(routeLocations)
        ? routeLocations
        : [];

    return Array.from(
      new Set(
        values.filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );
  }, [menu?.locations, routeLocations]);

  const stationOptions = useMemo(() => {
    const categories = Array.isArray(menu?.categories) ? menu.categories : [];
    return [
      { key: 'all', label: 'All Stations' },
      ...categories.map((category: any) => ({
        key: category.name,
        label: category.name,
      })),
    ];
  }, [menu?.categories]);

  useEffect(() => {
    if (
      activeStation !== 'all' &&
      !stationOptions.some((option) => option.key === activeStation)
    ) {
      setActiveStation('all');
    }
  }, [activeStation, stationOptions]);

  useEffect(() => {
    const categoryNames = Array.isArray(menu?.categories)
      ? menu.categories
          .map((category: any) => category?.name)
          .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)
      : [];

    if (!categoryNames.length) {
      setCollapsedCategories(new Set());
      return;
    }

    if (activeStation === 'all') {
      setCollapsedCategories(new Set(categoryNames));
      return;
    }

    setCollapsedCategories(new Set());
  }, [activeStation, menu?.categories]);

  const filteredCategories = useMemo(() => {
    const query = normalizeText(deferredSearchQuery);
    const categories = Array.isArray(menu?.categories) ? menu.categories : [];

    return categories
      .map((category: any) => {
        if (activeStation !== 'all' && category.name !== activeStation) {
          return null;
        }

        const items = Array.isArray(category.items) ? category.items : [];
        const filteredItems = query
          ? items.filter((item: any) => {
              const haystack = normalizeText(
                `${item.name} ${item.location} ${category.name} ${item.calories} ${item.protein}`,
              );
              return haystack.includes(query);
            })
          : items;

        if (!filteredItems.length) {
          return null;
        }

        return {
          ...category,
          items: filteredItems,
        };
      })
      .filter(Boolean) as Array<{ name: string; items: any[] }>;
  }, [activeStation, deferredSearchQuery, menu?.categories]);

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar
        barStyle={T.statusBar as any}
        backgroundColor="transparent"
        translucent
      />

      {wallpaperSource ? (
        <ImageBackground
          source={wallpaperSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: darkMode
                  ? 'rgba(4,8,12,0.74)'
                  : 'rgba(248,249,255,0.82)',
              },
            ]}
          />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />
      )}

      <View pointerEvents="none" style={s.ambientLayer}>
        <View style={s.ambientOrbOne} />
        <View style={s.ambientOrbTwo} />
      </View>

      <View style={s.screen}>
        <View style={s.topBar}>
          <TouchableOpacity
            style={s.navButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ChevronLeft size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={s.topBarTitle} numberOfLines={1}>
            {locationLabel}
          </Text>
          <View style={s.navSpacer} />
        </View>

        <ScrollView
          style={s.container}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.heroBlock}>
            <Text style={s.eyebrow}>{formatMealLabel(activeMealPeriod)} selection</Text>
            <Text style={s.heroTitle}>Full Menu</Text>
          </View>

          <View style={s.searchShell}>
            <Search size={18} color={T.text3} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search menu items..."
              placeholderTextColor={T.text4}
              style={s.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRailContent}
            style={s.chipRail}
          >
            {availableMealPeriods.map((period) => {
              const active = period === activeMealPeriod;
              return (
                <TouchableOpacity
                  key={period}
                  style={[s.primaryChip, active && s.primaryChipActive]}
                  activeOpacity={0.82}
                  onPress={() => {
                    setActiveMealPeriod(period as DiningMealPeriod);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                >
                  <Text
                    style={[
                      s.primaryChipText,
                      active && s.primaryChipTextActive,
                    ]}
                  >
                    {formatMealLabel(period)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {stationOptions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.stationRailContent}
              style={s.stationRail}
            >
              {stationOptions.map((option) => {
                const active = option.key === activeStation;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[s.stationChip, active && s.stationChipActive]}
                    activeOpacity={0.82}
                    onPress={() => {
                      setActiveStation(option.key);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                  >
                    <Text
                      style={[
                        s.stationChipText,
                        active && s.stationChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {menuLocations.length > 1 ? (
            <View style={s.locationPanel}>
              <View style={s.locationPanelHeader}>
                <MapPin size={16} color={T.sky} />
                <Text style={s.locationPanelTitle}>Available at</Text>
              </View>
              <View style={s.locationWrap}>
                {menuLocations.map((entry) => (
                  <View key={entry} style={s.locationPill}>
                    <Text style={s.locationText}>{entry}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {loading ? (
            <View style={s.feedbackCard}>
              <ActivityIndicator color={T.sky} size="large" />
              <Text style={s.feedbackTitle}>Loading menu</Text>
              <Text style={s.feedbackBody}>
                Pulling the latest {formatMealLabel(activeMealPeriod).toLowerCase()} items now.
              </Text>
            </View>
          ) : error ? (
            <View style={s.feedbackCard}>
              <Text style={s.feedbackTitle}>Menu unavailable</Text>
              <Text style={s.feedbackBody}>{error}</Text>
              <TouchableOpacity
                style={s.retryButton}
                onPress={() => load(activeMealPeriod)}
                activeOpacity={0.82}
              >
                <Text style={s.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : filteredCategories.length === 0 ? (
            <View style={s.feedbackCard}>
              <Text style={s.feedbackTitle}>Nothing matched that search</Text>
              <Text style={s.feedbackBody}>
                Try another keyword or switch back to all stations.
              </Text>
            </View>
          ) : (
            <>
              {filteredCategories.map((category, index) => {
                const palette = getCategoryPalette(category.name, index, darkMode);
                const isCollapsed = collapsedCategories.has(category.name);

                return (
                  <View
                    key={category.name}
                    style={[
                      s.stationCard,
                      {
                        borderColor: palette.border,
                        backgroundColor: darkMode
                          ? 'rgba(17,22,28,0.9)'
                          : 'rgba(255,255,255,0.9)',
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={s.stationHeader}
                      onPress={() => toggleCategory(category.name)}
                      activeOpacity={0.82}
                    >
                      <View
                        style={[
                          s.stationIconWrap,
                          { backgroundColor: palette.soft, borderColor: palette.border },
                        ]}
                      >
                        <UtensilsCrossed size={16} color={palette.strong} />
                      </View>

                      <View style={s.stationHeaderBody}>
                        <Text style={s.stationTitle}>{category.name}</Text>
                      </View>

                      <View style={s.stationHeaderMeta}>
                        <Text style={s.stationCount}>
                          {category.items.length}
                        </Text>
                        {isCollapsed ? (
                          <ChevronDown size={18} color={T.text3} />
                        ) : (
                          <ChevronUp size={18} color={T.text3} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {!isCollapsed ? (
                      <View style={s.stationItems}>
                        {category.items.map((item: any, itemIndex: number) => {
                          const itemKey = buildMenuItemKey(item);
                          const trackedCount = portionCounts[itemKey]?.count || 0;
                          const isSyncing = syncingItemKey === itemKey;
                          const badges = buildItemBadges(
                            item,
                            menuLocations.length > 1,
                          );
                          const priceLabel = formatCurrency(item.cost);

                          return (
                            <View
                              key={`${category.name}-${item.location || 'menu'}-${item.name}`}
                              style={[
                                s.menuItemRow,
                                itemIndex < category.items.length - 1 &&
                                  s.menuItemRowDivider,
                              ]}
                            >
                              <View style={s.menuItemBody}>
                                <View style={s.menuItemHeading}>
                                  <Text style={s.itemName}>{item.name}</Text>
                                  <Text
                                    style={[
                                      s.itemPrice,
                                      !priceLabel && s.itemIncluded,
                                    ]}
                                  >
                                    {priceLabel || 'Swipe'}
                                  </Text>
                                </View>

                                {badges.length ? (
                                  <View style={s.itemBadgeRow}>
                                    {badges.map((badge) => (
                                      <View
                                        key={`${itemKey}-${badge.label}`}
                                        style={[
                                          s.itemBadge,
                                          badge.tone === 'accent' && s.itemBadgeAccent,
                                          badge.tone === 'success' && s.itemBadgeSuccess,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            s.itemBadgeText,
                                            badge.tone === 'accent' &&
                                              s.itemBadgeTextAccent,
                                            badge.tone === 'success' &&
                                              s.itemBadgeTextSuccess,
                                          ]}
                                        >
                                          {badge.label}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : null}

                                <Text style={s.itemSupportText} numberOfLines={2}>
                                  {buildItemSupportLine(
                                    item,
                                    menuLocations.length > 1,
                                  )}
                                </Text>
                              </View>

                              <View style={s.itemActionRail}>
                                <View style={s.countPill}>
                                  {trackedCount > 0 ? (
                                    <Text style={s.countPillText}>
                                      {trackedCount}
                                    </Text>
                                  ) : null}
                                </View>

                                {trackedCount > 0 ? (
                                  <TouchableOpacity
                                    style={[s.actionButton, s.removeButton]}
                                    onPress={() => removePortion(item)}
                                    disabled={isSyncing}
                                    activeOpacity={0.82}
                                  >
                                    <Minus size={16} color={T.text2} />
                                  </TouchableOpacity>
                                ) : (
                                  <View style={s.actionButtonSpacer} />
                                )}

                                <TouchableOpacity
                                  style={[s.actionButton, s.addButton]}
                                  onPress={() => addPortion(item)}
                                  disabled={isSyncing}
                                  activeOpacity={0.82}
                                >
                                  {isSyncing ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                  ) : (
                                    <Plus size={16} color="#FFFFFF" />
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function getStyles(T: ReturnType<typeof useDiningTheme>, darkMode: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: T.bg,
    },
    ambientLayer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    ambientOrbOne: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 120,
      backgroundColor: darkMode ? 'rgba(10,132,255,0.08)' : 'rgba(10,132,255,0.05)',
      top: -24,
      right: -70,
    },
    ambientOrbTwo: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 100,
      backgroundColor: darkMode ? 'rgba(80,0,0,0.14)' : 'rgba(80,0,0,0.04)',
      top: 120,
      left: -70,
    },
    screen: {
      flex: 1,
    },
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 14,
      paddingTop: 0,
      paddingBottom: 36,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 2,
      paddingBottom: 4,
    },
    navButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: darkMode ? 'rgba(16,20,26,0.84)' : 'rgba(255,255,255,0.76)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.06)',
    },
    navSpacer: {
      width: 34,
      height: 34,
    },
    topBarTitle: {
      flex: 1,
      textAlign: 'center',
      color: T.text,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
      paddingHorizontal: 8,
    },
    heroBlock: {
      marginTop: 0,
      marginBottom: 10,
    },
    eyebrow: {
      color: T.sage,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: 4,
    },
    heroTitle: {
      color: T.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.55,
    },
    searchShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: darkMode ? 'rgba(17,22,28,0.9)' : 'rgba(255,255,255,0.88)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: darkMode ? 0.14 : 0.05,
      shadowRadius: 10,
      elevation: 3,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      color: T.text,
      fontSize: 13,
      fontWeight: '600',
      paddingVertical: 0,
    },
    chipRail: {
      marginBottom: 8,
    },
    chipRailContent: {
      gap: 6,
      paddingRight: 14,
    },
    primaryChip: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: darkMode ? 'rgba(24,28,34,0.9)' : 'rgba(231,234,242,0.95)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.05)',
    },
    primaryChipActive: {
      backgroundColor: T.sky,
      borderColor: T.sky,
      shadowColor: T.sky,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: darkMode ? 0.18 : 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    primaryChipText: {
      color: T.text2,
      fontSize: 13,
      fontWeight: '700',
    },
    primaryChipTextActive: {
      color: '#FFFFFF',
    },
    stationRail: {
      marginBottom: 10,
    },
    stationRailContent: {
      gap: 6,
      paddingRight: 14,
    },
    stationChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: darkMode ? 'rgba(19,24,30,0.86)' : 'rgba(243,245,250,0.92)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.05)',
      maxWidth: 200,
    },
    stationChipActive: {
      backgroundColor: darkMode ? 'rgba(255,255,255,0.12)' : '#FFFFFF',
      borderColor: darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(10,132,255,0.16)',
    },
    stationChipText: {
      color: T.text3,
      fontSize: 11,
      fontWeight: '700',
    },
    stationChipTextActive: {
      color: T.text,
    },
    locationPanel: {
      borderRadius: 18,
      padding: 12,
      marginBottom: 12,
      backgroundColor: darkMode ? 'rgba(17,22,28,0.86)' : 'rgba(255,255,255,0.84)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.05)',
    },
    locationPanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    locationPanelTitle: {
      color: T.text,
      fontSize: 12,
      fontWeight: '800',
    },
    locationWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    locationPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(245,247,252,0.95)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.05)',
    },
    locationText: {
      color: T.text2,
      fontSize: 10,
      fontWeight: '700',
    },
    feedbackCard: {
      borderRadius: 24,
      padding: 20,
      alignItems: 'center',
      backgroundColor: darkMode ? 'rgba(17,22,28,0.88)' : 'rgba(255,255,255,0.9)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.05)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: darkMode ? 0.16 : 0.06,
      shadowRadius: 14,
      elevation: 4,
      marginTop: 8,
    },
    feedbackTitle: {
      color: T.text,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 14,
      marginBottom: 8,
      textAlign: 'center',
    },
    feedbackBody: {
      color: T.text3,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 280,
    },
    retryButton: {
      marginTop: 16,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: T.sky,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    stationCard: {
      borderRadius: 22,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: darkMode ? 0.14 : 0.05,
      shadowRadius: 12,
      elevation: 4,
    },
    stationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stationIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    stationHeaderBody: {
      flex: 1,
      minWidth: 0,
    },
    stationTitle: {
      color: T.text,
      fontSize: 14,
      fontWeight: '800',
    },
    stationHeaderMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 2,
    },
    stationCount: {
      color: T.text3,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.35,
    },
    stationItems: {
      marginTop: 10,
    },
    menuItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 12,
    },
    menuItemRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(12,12,14,0.08)',
    },
    menuItemBody: {
      flex: 1,
      minWidth: 0,
    },
    menuItemHeading: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 5,
    },
    itemName: {
      flex: 1,
      color: T.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
    },
    itemPrice: {
      color: T.sky,
      fontSize: 13,
      fontWeight: '800',
      paddingTop: 1,
    },
    itemIncluded: {
      color: T.text3,
    },
    itemBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginBottom: 6,
    },
    itemBadge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(243,245,250,0.96)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.05)',
    },
    itemBadgeAccent: {
      backgroundColor: darkMode ? 'rgba(10,132,255,0.16)' : 'rgba(10,132,255,0.08)',
      borderColor: darkMode ? 'rgba(10,132,255,0.22)' : 'rgba(10,132,255,0.14)',
    },
    itemBadgeSuccess: {
      backgroundColor: darkMode ? 'rgba(52,199,89,0.16)' : 'rgba(52,199,89,0.08)',
      borderColor: darkMode ? 'rgba(52,199,89,0.22)' : 'rgba(52,199,89,0.14)',
    },
    itemBadgeText: {
      color: T.text2,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    itemBadgeTextAccent: {
      color: T.sky,
    },
    itemBadgeTextSuccess: {
      color: T.sage,
    },
    itemSupportText: {
      color: T.text3,
      fontSize: 12,
      lineHeight: 17,
    },
    itemActionRail: {
      width: 36,
      alignItems: 'center',
      gap: 6,
      paddingTop: 1,
    },
    countPill: {
      minWidth: 24,
      minHeight: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.05)',
      paddingHorizontal: 6,
    },
    countPillText: {
      color: T.text2,
      fontSize: 10,
      fontWeight: '800',
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: darkMode ? 0.12 : 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    addButton: {
      backgroundColor: T.sky,
    },
    removeButton: {
      backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(243,245,250,0.96)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.06)',
    },
    actionButtonSpacer: {
      width: 32,
      height: 32,
    },
  });
}
