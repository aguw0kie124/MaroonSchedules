import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MapPin, ChevronRight, Bus } from "lucide-react-native";
import type { CampusLocation } from "./types";

interface SearchOverlayProps {
  styles: any;
  COLORS: any;
  searchResults: CampusLocation[];
  busRouteResults: any[];
  isSearchExpanded: boolean;
  showSearchResults: boolean;
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
  onSelectLocation,
  onSelectBusRoute,
}: SearchOverlayProps) {
  const visiblePlaceResults = searchResults.slice(0, 6);
  const visibleRouteResults = busRouteResults.slice(0, 4);
  const hasPlaceResults = visiblePlaceResults.length > 0;
  const hasRouteResults = visibleRouteResults.length > 0;

  if (!isSearchExpanded || !showSearchResults || (!hasPlaceResults && !hasRouteResults)) {
    return null;
  }

  return (
    <View style={styles.searchResults}>
      {hasPlaceResults ? (
        <>
          <Text style={styles.searchSectionLabel}>Places</Text>
          {visiblePlaceResults.map((loc) => (
            <TouchableOpacity
              key={loc.location}
              style={styles.searchItem}
              onPress={() => onSelectLocation(loc)}
            >
              <MapPin size={15} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.searchItemName,
                    { color: COLORS.textPrimary },
                  ]}
                >
                  {loc.location}
                </Text>
                <Text style={styles.searchItemSub}>
                  {loc.shortName && loc.shortName !== loc.location
                    ? `${loc.shortName} • `
                    : ""}
                  {loc.type}
                </Text>
              </View>
              <ChevronRight size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      {hasRouteResults ? (
        <>
          <Text style={styles.searchSectionLabel}>Bus routes</Text>
          {visibleRouteResults.map((route) => (
            <TouchableOpacity
              key={route.Key}
              style={styles.searchItem}
              onPress={() => onSelectBusRoute(route)}
            >
              <Bus size={15} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.searchItemName, { color: COLORS.textPrimary }]}>
                  {route.ShortName ? `Route ${route.ShortName}` : route.Name}
                </Text>
                <Text style={styles.searchItemSub}>{route.Name}</Text>
              </View>
              <ChevronRight size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </>
      ) : null}
    </View>
  );
}
