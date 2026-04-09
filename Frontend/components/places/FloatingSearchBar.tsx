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
  onSubmitSearch?: () => void;
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
  onSubmitSearch,
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

        <View style={styles.floatingSearchInputWrap}>
          {isSearchExpanded ? (
            <TextInput
              style={styles.floatingSearchInput}
              placeholder="Search places and bus routes"
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
              returnKeyType="search"
              onSubmitEditing={() => onSubmitSearch?.()}
              multiline={false}
              numberOfLines={1}
              scrollEnabled
            />
          ) : (
            <TouchableOpacity
              style={styles.floatingSearchPrompt}
              onPress={() => {
                setIsSearchExpanded(true);
                setShowSearchResults(true);
              }}
            >
              <Text numberOfLines={1} style={styles.floatingSearchPromptText}>
                Search places and bus routes
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
