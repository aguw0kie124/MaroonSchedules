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
  Share2,
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
  onShare: () => void;
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
  onShare,
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
            placeholder="Search Texas A&M area places..."
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

        {isSearchExpanded && (
          <TouchableOpacity
            style={styles.searchTrailingButton}
            onPress={() => {
              setIsSearchExpanded(false);
              setSearchQuery("");
              setShowSearchResults(false);
            }}
          >
            <Text style={styles.searchCancelText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {!isSearchExpanded && (
          <TouchableOpacity
            style={styles.searchTrailingButton}
            onPress={onShare}
          >
            <Share2 size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
