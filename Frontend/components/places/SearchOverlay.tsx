import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MapPin, ChevronRight } from "lucide-react-native";
import type { CampusLocation } from "./types";

interface SearchOverlayProps {
  styles: any;
  COLORS: any;
  searchResults: CampusLocation[];
  isSearchExpanded: boolean;
  showSearchResults: boolean;
  onSelectLocation: (loc: CampusLocation) => void;
}

export function SearchOverlay({
  styles,
  COLORS,
  searchResults,
  isSearchExpanded,
  showSearchResults,
  onSelectLocation,
}: SearchOverlayProps) {
  if (!isSearchExpanded || !showSearchResults || searchResults.length === 0) {
    return null;
  }

  return (
    <View style={styles.searchResults}>
      {searchResults.map((loc) => (
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
    </View>
  );
}
