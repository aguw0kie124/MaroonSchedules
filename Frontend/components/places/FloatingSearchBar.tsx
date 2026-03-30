import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
} from "react-native";
import {
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react-native";

interface FloatingSearchBarProps {
  styles: any;
  COLORS: any;
  isSearchExpanded: boolean;
  setIsSearchExpanded: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setShowSearchResults: (value: boolean) => void;
  onOpenSettings: () => void;
}

export function FloatingSearchBar({
  styles,
  COLORS,
  isSearchExpanded,
  setIsSearchExpanded,
  searchQuery,
  setSearchQuery,
  setShowSearchResults,
  onOpenSettings,
}: FloatingSearchBarProps) {
  return (
    <View style={styles.floatingSearchStack}>
      <View style={styles.floatingSearchBar}>
        <TouchableOpacity
          style={styles.searchLeadingIcon}
          onPress={() => {
            setIsSearchExpanded(true);
            setShowSearchResults(true);
          }}
        >
          <Search size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        {isSearchExpanded ? (
          <TextInput
            style={styles.floatingSearchInput}
            placeholder="Search campus places..."
            placeholderTextColor={COLORS.textTertiary}
            value={searchQuery}
            onFocus={() => {
              setIsSearchExpanded(true);
              setShowSearchResults(true);
            }}
            onChangeText={(value) => {
              setSearchQuery(value);
              setShowSearchResults(true);
            }}
            autoFocus
          />
        ) : (
          <TouchableOpacity
            style={styles.floatingSearchPrompt}
            onPress={() => {
              setIsSearchExpanded(true);
              setShowSearchResults(true);
            }}
          >
            <Text style={styles.floatingSearchPromptText}>
              Search places, dining, routes...
            </Text>
          </TouchableOpacity>
        )}

        {isSearchExpanded && searchQuery.length > 0 ? (
          <TouchableOpacity
            style={styles.searchTrailingButton}
            onPress={() => setSearchQuery("")}
          >
            <X size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.searchTrailingButton}
          onPress={() => {
            if (isSearchExpanded) {
              setIsSearchExpanded(false);
              setSearchQuery("");
              setShowSearchResults(false);
              return;
            }
            onOpenSettings();
          }}
        >
          {isSearchExpanded ? (
            <Text style={styles.searchCancelText}>Cancel</Text>
          ) : (
            <SlidersHorizontal size={18} color={COLORS.textPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
