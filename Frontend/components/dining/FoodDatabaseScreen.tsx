import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@clerk/clerk-expo';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestJson } from '../../api/client';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';
import { getLocalDateString } from '../../services/dateUtils';

function buildFoodItemKey(item: any) {
  return `${item.name || 'food'}::${item.location || ''}`;
}

function buildFoodPayload(item: any) {
  return {
    name: item.name,
    source: item.source || 'database',
    calories: Number(item.calories || 0),
    protein: Number(item.protein || 0),
    carbs: Number(item.carbs || 0),
    fat: Number(item.fat || 0),
    fiber: item.fiber != null ? Number(item.fiber) : undefined,
    sodium: item.sodium != null ? Number(item.sodium) : undefined,
    potassium: item.potassium != null ? Number(item.potassium) : undefined,
    calcium: item.calcium != null ? Number(item.calcium) : undefined,
    iron: item.iron != null ? Number(item.iron) : undefined,
    vitamin_c: item.vitamin_c != null ? Number(item.vitamin_c) : undefined,
    vitamin_d: item.vitamin_d != null ? Number(item.vitamin_d) : undefined,
    magnesium: item.magnesium != null ? Number(item.magnesium) : undefined,
    location: item.location || 'Food Database',
    meal_period: 'snack',
    quantity: 1,
  };
}

function getEntryKey(entry: any) {
  let location = '';
  const foods = entry?.foods_json;

  try {
    const parsedFoods = Array.isArray(foods) ? foods : typeof foods === 'string' ? JSON.parse(foods) : [];
    location = parsedFoods?.[0]?.location || '';
  } catch (_error) {
    location = '';
  }

  return `${entry?.label || 'food'}::${location}`;
}

export default function FoodDatabaseScreen({ navigation, embedded = false }: any) {
  const { user } = useUser();
  const { theme, wallpaperUri } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);

  const [foods, setFoods] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [portionCounts, setPortionCounts] = useState<Record<string, { count: number; entryIds: number[] }>>({});
  const [syncingItemKey, setSyncingItemKey] = useState<string | null>(null);

  const loadFoods = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setFoods([]);
      return;
    }

    setLoading(true);
    try {
      const data = await requestJson(`/dining/foods?q=${encodeURIComponent(trimmed)}&source=all`);
      setFoods(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const refreshTrackerCounts = useCallback(async () => {
    if (!user) return;
    try {
      const tracker = await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}?date=${encodeURIComponent(getLocalDateString())}`);
      const entries = Array.isArray(tracker?.entries) ? tracker.entries : [];
      const nextCounts = entries.reduce((acc: Record<string, { count: number; entryIds: number[] }>, entry: any) => {
        const key = getEntryKey(entry);
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
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(loadFoods, 350);
    return () => clearTimeout(timer);
  }, [loadFoods]);

  useEffect(() => {
    refreshTrackerCounts();
  }, [refreshTrackerCounts]);

  const addPortion = useCallback(async (item: any) => {
    if (!user) return;
    const itemKey = buildFoodItemKey(item);
    setSyncingItemKey(itemKey);
    try {
      await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}`, {
        method: 'POST',
        body: JSON.stringify({
          date: getLocalDateString(),
          meal_period: 'snack',
          label: item.name,
          foods: [buildFoodPayload(item)],
        }),
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refreshTrackerCounts();
    } catch (trackerError) {
      console.error('Could not add database item to tracker', trackerError);
      Alert.alert('Error', 'Could not add this item right now.');
    } finally {
      setSyncingItemKey(null);
    }
  }, [refreshTrackerCounts, user]);

  const removePortion = useCallback(async (item: any) => {
    if (!user) return;
    const itemKey = buildFoodItemKey(item);
    const tracked = portionCounts[itemKey];
    const entryId = tracked?.entryIds?.[tracked.entryIds.length - 1];
    if (!entryId) return;

    setSyncingItemKey(itemKey);
    try {
      await requestJson(`/dining/tracker/${encodeURIComponent(user.id)}/${entryId}`, { method: 'DELETE' });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await refreshTrackerCounts();
    } catch (trackerError) {
      console.error('Could not remove database item from tracker', trackerError);
      Alert.alert('Error', 'Could not remove this item right now.');
    } finally {
      setSyncingItemKey(null);
    }
  }, [portionCounts, refreshTrackerCounts, user]);

  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;
  const renderFoodCard = (item: any, index?: number) => {
    const itemKey = buildFoodItemKey(item);
    const count = portionCounts[itemKey]?.count || 0;
    const isSyncing = syncingItemKey === itemKey;

    return (
      <View key={item.id?.toString() || `${itemKey}-${index ?? 0}`} style={[s.foodCard, { backgroundColor: T.card, borderColor: T.border }]}>
        <View style={s.foodInfo}>
          <Text style={[s.foodName, { color: T.text }]}>{item.name}</Text>
          {!!item.location && (
            <Text style={[s.foodSub, { color: T.text3 }]}>{item.location}</Text>
          )}
        </View>

        <View style={s.sideColumn}>
          <View style={s.macroCol}>
            <Text style={[s.macroVal, { color: T.amber }]}>{Math.round(item.calories || 0)} kcal</Text>
            <Text style={[s.macroPro, { color: T.sage }]}>{Math.round(item.protein || 0)}g P</Text>
          </View>
          <View style={s.actionWrap}>
            <View style={s.countSlot}>
              {count > 0 ? <Text style={[s.countText, { color: T.text3 }]}>{count}x</Text> : null}
            </View>
            {count > 0 ? (
              <TouchableOpacity
                style={[s.actionButton, { borderColor: T.clay, backgroundColor: `${T.clay}18` }]}
                onPress={() => removePortion(item)}
                disabled={isSyncing}
              >
                <Text style={[s.actionSymbol, { color: T.clay }]}>-</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[s.actionButton, { borderColor: T.sage, backgroundColor: `${T.sage}18` }]}
              onPress={() => addPortion(item)}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color={T.sage} size="small" />
              ) : (
                <Text style={[s.actionSymbol, { color: T.sage }]}>+</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[s.container, embedded && s.embeddedContainer]}
    >
      {!embedded ? (
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 24, color: T.text }}>←</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: T.text }]}>Database</Text>
          <View style={s.headerSpacer} />
        </View>
      ) : null}

      <View style={s.searchRow}>
        <TextInput
          style={[s.searchInput, { backgroundColor: T.bg3, borderColor: T.border, color: T.text }]}
          placeholder="Search foods..."
          placeholderTextColor={T.text3}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={T.amber} style={{ marginTop: 20 }} />
      ) : embedded ? (
        <View>
          {query.trim().length >= 2 && foods.length === 0 ? (
            <Text style={{ color: T.text3, textAlign: 'center', marginTop: 8, marginBottom: 12 }}>
              No matching foods found
            </Text>
          ) : (
            foods.slice(0, 6).map((item, index) => renderFoodCard(item, index))
          )}
        </View>
      ) : (
        <FlatList
          data={foods}
          keyExtractor={(item: any, index) => item.id?.toString() || `${buildFoodItemKey(item)}-${index}`}
          ListEmptyComponent={
            <Text style={{ color: T.text3, textAlign: 'center', marginTop: 40 }}>
              {query.trim().length < 2 ? 'Search for foods above' : 'No matching foods found'}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item, index }: any) => renderFoodCard(item, index)}
        />
      )}
    </KeyboardAvoidingView>
  );

  if (embedded) {
    return content;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }]} />
      </ImageBackground>
      {content}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  embeddedContainer: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 34, height: 34, justifyContent: 'center' },
  headerSpacer: { width: 34, height: 34 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, flex: 1, marginLeft: 10 },
  searchRow: { marginBottom: 0 },
  searchInput: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 0, fontSize: 14 },
  foodCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  foodInfo: {
    flex: 1,
    paddingRight: 12,
  },
  foodName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  foodSub: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  sideColumn: {
    alignItems: 'flex-end',
    marginLeft: 14,
  },
  macroCol: { alignItems: 'flex-end', marginBottom: 10 },
  macroVal: { fontWeight: '900', fontSize: 16 },
  macroPro: { fontWeight: '800', fontSize: 12, marginTop: 2 },
  actionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countSlot: {
    minWidth: 30,
    alignItems: 'flex-end',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSymbol: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
  },
});
