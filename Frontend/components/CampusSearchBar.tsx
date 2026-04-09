import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Keyboard,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Coffee, Library, MapPin, Search, Utensils, X } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { CampusSearchResult, searchCampus, getPinnedItems } from '../services/campusSearch';
import { computeDistanceMeters, formatDistance } from '../services/campusDirections';
import { getCategoryIcon } from './places/utils';
import { formatGlobalSearchSubtitle, searchGlobalPlaces } from '../services/globalMap';
import { searchCampusLocations } from './places/searchUtils';
import { getLocationSelectionId, mergeCampusLocations } from './places/campusData';

interface CampusSearchBarProps {
  userCoord?: { latitude: number; longitude: number };
  onSelect: (result: CampusSearchResult) => void;
  placeholder?: string;
  showPinnedItems?: boolean;
  displayValue?: string;
  enableGlobalSearch?: boolean;
}

export function CampusSearchBar({
  userCoord,
  onSelect,
  placeholder = 'Search buildings, dining, restrooms…',
  showPinnedItems = true,
  displayValue,
  enableGlobalSearch = false,
}: CampusSearchBarProps) {
  const { COLORS, theme } = useTheme();
  const styles = getStyles(COLORS, theme === 'dark');
  const [query, setQuery] = useState('');
  const [campusResults, setCampusResults] = useState<CampusSearchResult[]>([]);
  const [globalResults, setGlobalResults] = useState<CampusSearchResult[]>([]);
  const [isSearchingWorldwide, setIsSearchingWorldwide] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const selectingResultRef = useRef(false);
  const requestIdRef = useRef(0);
  const lastGlobalQueryRef = useRef('');

  const buildCampusResults = useCallback(
    (text: string) => searchCampus(text, userCoord),
    [userCoord],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      requestIdRef.current += 1;
      setQuery(text);
      if (text.trim().length > 0) {
        setCampusResults(buildCampusResults(text));
      } else {
        setCampusResults([]);
      }
      setGlobalResults([]);
      setGlobalSearchError(null);
      setIsSearchingWorldwide(false);
      lastGlobalQueryRef.current = '';
    },
    [buildCampusResults],
  );

  const commitSelection = (item: CampusSearchResult) => {
    selectingResultRef.current = true;
    Keyboard.dismiss();
    setQuery('');
    setCampusResults([]);
    setGlobalResults([]);
    setGlobalSearchError(null);
    setIsFocused(false);
    onSelect(item);
    setTimeout(() => {
      selectingResultRef.current = false;
    }, 0);
  };

  const runWorldwideSearch = useCallback(
    async (rawQuery?: string) => {
      const normalizedQuery = (rawQuery ?? query).trim();
      if (!enableGlobalSearch || normalizedQuery.length < 2) return;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsSearchingWorldwide(true);
      setGlobalSearchError(null);
      try {
        const matches = await searchGlobalPlaces(normalizedQuery, { limit: 6 });
        if (requestId !== requestIdRef.current) return;
        lastGlobalQueryRef.current = normalizedQuery.toLowerCase();
        setGlobalResults(
          matches.map((location) => ({
            id: `global:${location.placeId || `${location.location}:${location.coord.lat},${location.coord.lng}`}`,
            label: location.location,
            subtitle:
              formatGlobalSearchSubtitle(location) ||
              location.description ||
              'Search result',
            kind: 'location',
            location,
          })),
        );
        if (matches.length === 0) {
          setGlobalSearchError(`No matches found for "${normalizedQuery}".`);
        }
      } catch (error: any) {
        if (requestId !== requestIdRef.current) return;
        setGlobalResults([]);
        setGlobalSearchError(error?.message || 'Search is unavailable right now.');
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearchingWorldwide(false);
        }
      }
    },
    [enableGlobalSearch, query],
  );

  const handleResultPress = useCallback(
    async (item: CampusSearchResult) => {
      if (item.kind === 'command' && item.commandType === 'search-worldwide') {
        await runWorldwideSearch(item.query || query);
        return;
      }
      commitSelection(item);
    },
    [query, runWorldwideSearch],
  );

  const handleClear = () => {
    setQuery('');
    setCampusResults([]);
    setGlobalResults([]);
    setGlobalSearchError(null);
    setIsSearchingWorldwide(false);
    requestIdRef.current += 1;
    lastGlobalQueryRef.current = '';
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (!query && displayValue) {
      setQuery(displayValue);
      setCampusResults(buildCampusResults(displayValue));
    }
    setIsFocused(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (selectingResultRef.current) return;
      setIsFocused(false);
    }, 150);
  };

  useEffect(() => {
    if (!enableGlobalSearch) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    if (lastGlobalQueryRef.current === trimmed.toLowerCase()) return;

    const timeoutId = setTimeout(() => {
      runWorldwideSearch(trimmed);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [enableGlobalSearch, query, runWorldwideSearch]);

  const pinnedItems = getPinnedItems();
  const normalizedQuery = query.trim().toLowerCase();
  const combinedLocationResults = React.useMemo(() => {
    if (normalizedQuery.length === 0) return [];

    const campusLocations = campusResults
      .map((item) => item.location)
      .filter((location): location is NonNullable<CampusSearchResult['location']> => !!location);
    const searchedGlobalLocations = globalResults
      .map((item) => item.location)
      .filter((location): location is NonNullable<CampusSearchResult['location']> => !!location);
    const mergedLocations = mergeCampusLocations(campusLocations, searchedGlobalLocations);
    const rankedLocations = searchCampusLocations(
      mergedLocations,
      query,
      8,
      { referenceCoord: userCoord ?? null },
    );
    const resultBySelectionId = new Map<string, CampusSearchResult>();

    [...campusResults, ...globalResults].forEach((item) => {
      if (!item.location) return;
      resultBySelectionId.set(getLocationSelectionId(item.location), item);
    });

    return rankedLocations
      .map((location) => {
        const existing = resultBySelectionId.get(getLocationSelectionId(location));
        if (existing) {
          return {
            ...existing,
            distance:
              existing.distance ??
              (userCoord
                ? computeDistanceMeters(userCoord, {
                    latitude: location.coord.lat,
                    longitude: location.coord.lng,
                  })
                : undefined),
            location,
            subtitle: existing.subtitle || formatGlobalSearchSubtitle(location) || location.type,
          };
        }
        return {
          id: `loc:${getLocationSelectionId(location)}`,
          label: location.location,
          subtitle: formatGlobalSearchSubtitle(location) || location.type,
          kind: 'location' as const,
          location,
          distance: userCoord
            ? computeDistanceMeters(userCoord, {
                latitude: location.coord.lat,
                longitude: location.coord.lng,
              })
            : undefined,
        };
      })
      .slice(0, 8);
  }, [campusResults, globalResults, normalizedQuery, query, userCoord]);
  const showDropdown = isFocused && (
    combinedLocationResults.length > 0 ||
    isSearchingWorldwide ||
    !!globalSearchError ||
    (query.length === 0 && showPinnedItems)
  );
  const inputValue = isFocused ? query : (query || displayValue || '');

  const renderItemIcon = (item: CampusSearchResult) => {
    if (item.kind === 'command') {
      switch (item.commandType) {
        case 'nearest-restroom': return <MapPin size={18} color="#F3F1ED" />;
        case 'nearest-coffee': return <Coffee size={18} color="#F3F1ED" />;
        case 'nearest-library': return <Library size={18} color="#F3F1ED" />;
        case 'nearest-dining': return <Utensils size={18} color="#F3F1ED" />;
        case 'search-worldwide': return <Search size={18} color="#F3F1ED" />;
        default: return <MapPin size={18} color="#F3F1ED" />;
      }
    }
    if (item.location) {
      return getCategoryIcon(item.location?.type || 'General', '#F3F1ED', 18);
    }
    return <MapPin size={18} color="#F3F1ED" />;
  };

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      {/* Search input */}
      <View style={styles.inputRow}>
        <Search color={COLORS.textSecondary} size={18} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          value={inputValue}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="search"
          autoCorrect={false}
          selectTextOnFocus
          multiline={false}
          numberOfLines={1}
          scrollEnabled
          onSubmitEditing={() => {
            if (enableGlobalSearch && query.trim().length >= 2) {
              runWorldwideSearch(query);
            }
          }}
        />
        {inputValue.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearBtn}>
            <X color={COLORS.textSecondary} size={16} />
          </Pressable>
        )}
      </View>

      {/* Dropdown */}
      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.dropdownScrollContent}
          >
            {query.length === 0 && showPinnedItems && (
              <>
                <Text style={styles.sectionLabel}>Quick Actions</Text>
                {pinnedItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                    onPress={() => handleResultPress(item)}
                    hitSlop={8}
                  >
                    <View style={styles.resultIconWrap}>
                      {renderItemIcon(item)}
                    </View>
                    <View style={styles.resultText}>
                      <Text numberOfLines={1} style={styles.resultLabel}>{item.label}</Text>
                      <Text numberOfLines={2} style={styles.resultSubtitle}>{item.subtitle}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {combinedLocationResults.length > 0 && (
              <>
                {query.length === 0 && <View style={styles.divider} />}
                <Text style={styles.sectionLabel}>Results</Text>
                {combinedLocationResults.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                    onPress={() => handleResultPress(item)}
                    hitSlop={8}
                  >
                    <View style={styles.resultIconWrap}>
                      {renderItemIcon(item)}
                    </View>
                    <View style={styles.resultText}>
                      <Text numberOfLines={1} style={styles.resultLabel}>{item.label}</Text>
                      <Text numberOfLines={2} style={styles.resultSubtitle}>
                        {item.subtitle}
                        {item.distance != null ? ` • ${formatDistance(item.distance)}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {isSearchingWorldwide && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Searching for more matches…</Text>
              </View>
            )}

            {globalSearchError ? (
              <Text style={styles.emptyStateText}>{globalSearchError}</Text>
            ) : null}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  containerFocused: {
    zIndex: 2000,
    elevation: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(8,8,10,0.92)' : 'rgba(255,255,255,0.96)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(12,12,14,0.10)',
    paddingHorizontal: 18,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.18 : 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: COLORS.textPrimary,
    height: '100%',
  },
  clearBtn: {
    padding: 6,
  },
  dropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 320,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 2001,
    overflow: 'hidden',
  },
  dropdownScrollContent: {
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultRowPressed: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.05)',
  },
  resultIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  resultText: {
    flex: 1,
    minWidth: 0,
  },
  resultLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  resultSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
