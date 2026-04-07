import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { MapPin, ChevronRight, Bus } from "lucide-react-native";
import type { CampusLocation } from "./types";
import { getLocationSelectionId } from "./campusData";

interface SearchOverlayProps {
  styles: any;
  COLORS: any;
  searchResults: CampusLocation[];
  busRouteResults: any[];
  isSearchExpanded: boolean;
  showSearchResults: boolean;
  searchQuery: string;
  isSearchingGlobal?: boolean;
  globalSearchError?: string | null;
  onSelectLocation: (loc: CampusLocation) => void;
  onSelectBusRoute: (route: any) => void;
}

export function SearchOverlay({
  styles,
  COLORS,
  searchResults,
  busRouteResults,
  isSearchExpanded,
  showSearchResults,
  searchQuery,
  isSearchingGlobal = false,
  globalSearchError = null,
  onSelectLocation,
  onSelectBusRoute,
}: SearchOverlayProps) {
  const getLocationSubtitle = (loc: CampusLocation) => {
    if (loc.address) return `${loc.address} • ${loc.type}`;
    if (loc.shortName && loc.shortName !== loc.location) {
      return `${loc.shortName} • ${loc.type}`;
    }
    return loc.type;
  };

  const visiblePlaceResults = searchResults.slice(0, 10);
  const visibleRouteResults = busRouteResults.slice(0, 4);
  const hasPlaceResults = visiblePlaceResults.length > 0;
  const hasRouteResults = visibleRouteResults.length > 0;
  const normalizedQuery = searchQuery.trim();
  const hasQuery = normalizedQuery.length >= 2;
  const showEmptyState =
    hasQuery &&
    !hasPlaceResults &&
    !hasRouteResults &&
    !isSearchingGlobal &&
    !globalSearchError;

  if (
    !isSearchExpanded ||
    !showSearchResults ||
    (!hasPlaceResults && !hasRouteResults && !isSearchingGlobal && !globalSearchError && !showEmptyState)
  ) {
    return null;
  }

  return (
    <View style={styles.searchResults}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        {hasPlaceResults ? (
          <>
            <Text style={styles.searchSectionLabel}>Results</Text>
            {visiblePlaceResults.map((loc) => (
              <TouchableOpacity
                key={getLocationSelectionId(loc)}
                style={styles.searchItem}
                onPress={() => onSelectLocation(loc)}
              >
                <MapPin size={15} color={COLORS.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.searchItemName,
                      { color: COLORS.textPrimary },
                    ]}
                  >
                    {loc.location}
                  </Text>
                  <Text numberOfLines={2} style={styles.searchItemSub}>
                    {getLocationSubtitle(loc)}
                  </Text>
                </View>
                <ChevronRight size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {isSearchingGlobal ? (
          <Text style={styles.searchSectionLabel}>Searching for more matches…</Text>
        ) : null}

        {globalSearchError ? (
          <Text style={styles.searchSectionLabel}>{globalSearchError}</Text>
        ) : null}

        {showEmptyState ? (
          <Text style={styles.searchSectionLabel}>
            {`No matches found for "${normalizedQuery}".`}
          </Text>
        ) : null}

        {hasRouteResults ? (
          <>
            <Text style={styles.searchSectionLabel}>Bus Routes</Text>
            {visibleRouteResults.map((route) => (
              <TouchableOpacity
                key={route.Key}
                style={styles.searchItem}
                onPress={() => onSelectBusRoute(route)}
              >
                <Bus size={15} color={COLORS.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={[styles.searchItemName, { color: COLORS.textPrimary }]}
                  >
                    {route.ShortName ? `Route ${route.ShortName}` : route.Name}
                  </Text>
                  <Text numberOfLines={2} style={styles.searchItemSub}>
                    {route.Name}
                  </Text>
                </View>
                <ChevronRight size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
