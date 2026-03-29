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
  Map,
  List,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react-native";
import type { PlacesViewMode } from "../../store/appShellStore";

interface FloatingSearchBarProps {
  styles: any;
  COLORS: any;
  isSearchExpanded: boolean;
  setIsSearchExpanded: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setShowSearchResults: (value: boolean) => void;
  placesViewMode: PlacesViewMode;
  setPlacesViewMode: (value: PlacesViewMode) => void;
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
  placesViewMode,
  setPlacesViewMode,
  onOpenSettings,
}: FloatingSearchBarProps) {
  const [isViewMenuOpen, setIsViewMenuOpen] = React.useState(false);

  const currentViewLabel = placesViewMode === "map" ? "Map" : "List";

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
              setIsViewMenuOpen(false);
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
              setIsViewMenuOpen(false);
            }}
          >
            <Text style={styles.floatingSearchPromptText}>
              Search campus places...
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
              setIsViewMenuOpen(false);
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

      {!isSearchExpanded ? (
        <TouchableOpacity
          style={styles.viewMenuTrigger}
          onPress={() => setIsViewMenuOpen((value) => !value)}
        >
          {placesViewMode === "map" ? (
            <Map size={14} color={COLORS.textPrimary} />
          ) : (
            <List size={14} color={COLORS.textPrimary} />
          )}
          <Text style={styles.viewMenuTriggerText}>{currentViewLabel}</Text>
          <ChevronDown size={14} color={COLORS.textTertiary} />
        </TouchableOpacity>
      ) : null}

      {!isSearchExpanded && isViewMenuOpen ? (
        <View style={styles.viewDropdownMenu}>
          <TouchableOpacity
            style={styles.viewDropdownItem}
            onPress={() => {
              setPlacesViewMode("map");
              setIsViewMenuOpen(false);
            }}
          >
            <Map size={15} color={COLORS.textPrimary} />
            <Text style={styles.viewDropdownItemText}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewDropdownItem}
            onPress={() => {
              setPlacesViewMode("list");
              setIsViewMenuOpen(false);
            }}
          >
            <List size={15} color={COLORS.textPrimary} />
            <Text style={styles.viewDropdownItemText}>List</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
