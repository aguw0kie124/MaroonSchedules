import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  LayoutAnimation,
} from "react-native";
import { Search, X, Cog } from "lucide-react-native";
import { getCategoryPillIcon } from "./utils";
import { CATEGORIES } from "./campusData";

interface CategoryPillBarProps {
  styles: any;
  COLORS: any;
  theme: string;
  isSearchExpanded: boolean;
  setIsSearchExpanded: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  showSearchResults: boolean;
  setShowSearchResults: (v: boolean) => void;
  activeLayer: string;
  setActiveLayer: (v: string) => void;
  setSelectedId: (v: string | null) => void;
  setIsRouteDropdownOpen: (v: boolean) => void;
  setIsEditorVisible: (v: boolean) => void;
  visibleCategories: typeof CATEGORIES;
  topBarItems: Array<{ id: string; label: string; isSettings: boolean }>;
  categorySlotWidth: number;
  categoryIndicatorTranslateX: any;
  setCategoryTrackWidth: (v: number) => void;
}

export function CategoryPillBar({
  styles,
  COLORS,
  theme,
  isSearchExpanded,
  setIsSearchExpanded,
  searchQuery,
  setSearchQuery,
  showSearchResults,
  setShowSearchResults,
  activeLayer,
  setActiveLayer,
  setSelectedId,
  setIsRouteDropdownOpen,
  setIsEditorVisible,
  visibleCategories,
  topBarItems,
  categorySlotWidth,
  categoryIndicatorTranslateX,
  setCategoryTrackWidth,
}: CategoryPillBarProps) {
  const isDark = theme === "dark";

  return (
    <View
      style={[
        styles.pillBar,
        isSearchExpanded && {
          backgroundColor: isDark
            ? "rgba(8,8,10,0.96)"
            : "rgba(255,255,255,0.94)",
          borderColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(12,12,14,0.08)",
        },
      ]}
    >
      {isSearchExpanded ? (
        <View style={styles.searchExpanded}>
          <Search size={20} color={COLORS.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: COLORS.textPrimary }]}
            placeholder="Search any location..."
            placeholderTextColor={COLORS.textTertiary}
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t);
              setShowSearchResults(true);
            }}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ marginRight: 12 }}
            >
              <X size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
              setIsSearchExpanded(false);
              setSearchQuery("");
              setShowSearchResults(false);
            }}
          >
            <Text style={styles.cancelSearchText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.searchIconBtn}
            onPress={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
              setIsSearchExpanded(true);
              setIsRouteDropdownOpen(false);
            }}
          >
            <Search size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <View style={styles.pillDivider} />
          <View
            style={styles.pillTabsContainer}
            onLayout={(event) =>
              setCategoryTrackWidth(event.nativeEvent.layout.width)
            }
          >
            <Animated.View
              style={[
                styles.pillIndicator,
                {
                  width: Math.max(categorySlotWidth - 4, 0),
                  transform: [{ translateX: categoryIndicatorTranslateX }],
                },
              ]}
            />
            {topBarItems.map((category) => {
              const isSettings = Boolean((category as any).isSettings);
              const isActive = !isSettings && category.id === activeLayer;
              const Icon = isSettings
                ? Cog
                : getCategoryPillIcon(category.id);

              return (
                <TouchableOpacity
                  key={category.id}
                  style={styles.pillTab}
                  onPress={() => {
                    if (isSettings) {
                      setIsEditorVisible(true);
                      return;
                    }
                    setActiveLayer(category.id);
                    setSelectedId(null);
                  }}
                >
                  <Icon
                    size={18}
                    color={isActive ? "#FFFFFF" : COLORS.textTertiary}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive ? (
                    <Text
                      style={[
                        styles.pillLabel,
                        isActive
                          ? styles.pillLabelActive
                          : styles.pillLabelInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {category.label}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
