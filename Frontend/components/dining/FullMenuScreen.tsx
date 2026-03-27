import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL } from '../../config';
import { Card, SectionLabel, Badge } from './DiningUI';
import { useTheme } from '../SharedUI';
import { useDiningTheme } from './DiningTheme';

function formatMealLabel(meal: string) {
  const value = (meal || '').toLowerCase();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Menu';
}

export default function FullMenuScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const T = useDiningTheme(darkMode);
  const marbleSrc = darkMode
    ? require('../../assets/black_marble.jpg')
    : require('../../assets/white_marble.jpg');

  const { location, mealPeriod, title, locations, sourceHint } = route.params || {};
  const [menu, setMenu] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!location) {
      setError('Menu details are unavailable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        location,
        meal_period: mealPeriod || 'lunch',
      }).toString();
      const result = await fetch(`${API_URL}/dining/full-menu?${query}`).then((response) => response.json());
      if (result.success) {
        setMenu(result);
      } else {
        setError(result.message || 'No menu items available right now.');
      }
    } catch (fetchError) {
      setError('Could not load the menu.');
    } finally {
      setLoading(false);
    }
  }, [location, mealPeriod]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryCount = menu?.categories?.length || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={T.statusBar as any} backgroundColor="transparent" translucent />
      <ImageBackground source={marbleSrc} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.72)' }]} />
      </ImageBackground>

      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 24, color: T.text }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: T.text }]} numberOfLines={1}>{title || location || 'Full Menu'}</Text>
            <Text style={[s.subtitle, { color: T.text3 }]}>{formatMealLabel(mealPeriod || 'lunch')} full menu</Text>
          </View>
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  locationWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locationPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  locationText: { fontSize: 12, fontWeight: '700' },
  itemRow: { paddingVertical: 12, borderBottomWidth: 1 },
  itemName: { fontSize: 15, fontWeight: '800' },
  itemMeta: { fontSize: 12, marginTop: 4, fontWeight: '500' },
});
