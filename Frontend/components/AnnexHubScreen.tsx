import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight, LibraryBig, PackageSearch, Search } from 'lucide-react-native';

import { PillTabs } from './PillTabs';
import { Card, useTheme } from './SharedUI';
import {
  AnnexLibrary,
  AnnexRentalCategory,
  AnnexRentalsOverview,
  fetchAnnexLibraries,
  fetchAnnexRentals,
} from '../services/annexService';

type AnnexTab = 'libraries' | 'rentals';

export function AnnexHubScreen({ navigation }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const [activeTab, setActiveTab] = useState<AnnexTab>('libraries');
  const [query, setQuery] = useState('');
  const [libraries, setLibraries] = useState<AnnexLibrary[]>([]);
  const [rentals, setRentals] = useState<AnnexRentalsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchAnnexLibraries(), fetchAnnexRentals()])
      .then(([libraryData, rentalData]) => {
        if (cancelled) return;
        setLibraries(libraryData.items || []);
        setRentals(rentalData);
      })
      .catch((loadError: any) => {
        if (cancelled) return;
        setError(loadError?.message || 'Could not load library services right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLibraries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return libraries;
    return libraries.filter((library) => library.name.toLowerCase().includes(normalized));
  }, [libraries, query]);

  const filteredRentalCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const categories = rentals?.categories || [];
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [query, rentals?.categories]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={18} color={COLORS.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>The Annex</Text>
          <Text style={styles.title}>Library Services</Text>
          <Text style={styles.subtitle}>
            Stay inside the app to browse study rooms, availability, and library rentals.
          </Text>
        </View>

        <View style={styles.tabsWrap}>
          <PillTabs
            items={[
              { key: 'libraries', label: 'Libraries', icon: LibraryBig },
              { key: 'rentals', label: 'Rentals', icon: PackageSearch },
            ]}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as AnnexTab)}
            floating={false}
            compact={false}
            activeTextMode="active-only"
            layout="stacked"
          />
        </View>

        <View style={styles.searchWrap}>
          <Search size={18} color={COLORS.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={activeTab === 'libraries' ? 'Search libraries…' : 'Search rental categories…'}
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stateText}>Loading library services…</Text>
          </View>
        ) : error ? (
          <Card style={styles.stateCard}>
            <Text style={styles.errorTitle}>Annex unavailable</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </Card>
        ) : activeTab === 'libraries' ? (
          <View style={styles.sectionStack}>
            {filteredLibraries.map((library) => (
              <Pressable
                key={library.id}
                style={styles.listCard}
                onPress={() => navigation.navigate('AnnexLibraryDetail', { libraryId: library.id })}
              >
                <View style={styles.listIcon}>
                  <LibraryBig size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{library.name}</Text>
                  <Text style={styles.listMeta}>Rooms, rules, and live availability inside the app</Text>
                </View>
                <ChevronRight size={18} color={COLORS.textTertiary} />
              </Pressable>
            ))}

            {!filteredLibraries.length ? (
              <Card style={styles.stateCard}>
                <Text style={styles.stateText}>No libraries match that search.</Text>
              </Card>
            ) : null}
          </View>
        ) : (
          <View style={styles.sectionStack}>
            {rentals?.locations?.length ? (
              <Card style={styles.locationCard}>
                <Text style={styles.locationTitle}>Pickup Locations</Text>
                <View style={styles.locationChipRow}>
                  {rentals.locations.map((location) => (
                    <View key={location.id} style={styles.locationChip}>
                      <Text style={styles.locationChipText}>{location.name}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            {filteredRentalCategories.map((category: AnnexRentalCategory) => (
              <Pressable
                key={category.id}
                style={styles.listCard}
                onPress={() => navigation.navigate('AnnexRentalDetail', { rentalId: category.id })}
              >
                <View style={[styles.listIcon, { backgroundColor: '#11789A' }]}>
                  <PackageSearch size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{category.name}</Text>
                  <Text style={styles.listMeta}>Browse availability and request items through the library service flow</Text>
                </View>
                <ChevronRight size={18} color={COLORS.textTertiary} />
              </Pressable>
            ))}

            {!filteredRentalCategories.length ? (
              <Card style={styles.stateCard}>
                <Text style={styles.stateText}>No rental categories match that search.</Text>
              </Card>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      paddingTop: 48,
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    headerRow: {
      marginBottom: 14,
    },
    backButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    backText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    heroCard: {
      borderRadius: 28,
      padding: 20,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 14,
    },
    eyebrow: {
      color: COLORS.textTertiary,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 6,
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 6,
    },
    tabsWrap: {
      marginBottom: 14,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: COLORS.textPrimary,
    },
    sectionStack: {
      gap: 12,
    },
    listCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    listIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listTitle: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    listMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    locationCard: {
      gap: 10,
    },
    locationTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    locationChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    locationChip: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.04)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    locationChipText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    stateCard: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    stateText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
    errorTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    errorBody: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
    },
  });
