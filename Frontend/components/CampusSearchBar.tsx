import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Keyboard,
} from 'react-native';
import { Coffee, Library, MapPin, Search, Utensils, X } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { CampusSearchResult, searchCampus, getPinnedItems } from '../services/campusSearch';
import { getAmenityIcon, getBuildingIcon } from '../data/campus';
import { formatDistance } from '../services/campusDirections';

interface CampusSearchBarProps {
  userCoord?: { latitude: number; longitude: number };
  onSelect: (result: CampusSearchResult) => void;
  placeholder?: string;
  showPinnedItems?: boolean;
  displayValue?: string;
}

export function CampusSearchBar({
  userCoord,
  onSelect,
  placeholder = 'Search buildings, dining, restrooms…',
  showPinnedItems = true,
  displayValue,
}: CampusSearchBarProps) {
    const { COLORS, theme } = useTheme();
    const styles = getStyles(COLORS, theme === 'dark');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CampusSearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (text.trim().length > 0) {
        setResults(searchCampus(text, userCoord));
      } else {
        setResults([]);
      }
    },
    [userCoord],
  );

  const handleSelect = (item: CampusSearchResult) => {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    setIsFocused(false);
    onSelect(item);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (!query && displayValue) {
      setQuery(displayValue);
      setResults(searchCampus(displayValue, userCoord));
    }
    setIsFocused(true);
  };

  const pinnedItems = getPinnedItems();
  const showDropdown = isFocused && (results.length > 0 || (query.length === 0 && showPinnedItems));
  const inputValue = isFocused ? query : (query || displayValue || '');

  const getItemIcon = (item: CampusSearchResult) => {
    if (item.kind === 'command') {
      switch (item.commandType) {
        case 'nearest-restroom': return MapPin;
        case 'nearest-coffee': return Coffee;
        case 'nearest-library': return Library;
        case 'nearest-dining': return Utensils;
        default: return MapPin;
      }
    }
    if (item.building) return getBuildingIcon(item.building.type);
    if (item.amenity) return getAmenityIcon(item.amenity.type);
    return MapPin;
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
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          returnKeyType="search"
          autoCorrect={false}
          selectTextOnFocus
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
          {/* Quick actions when no query */}
          {query.length === 0 && showPinnedItems && (
            <>
              <Text style={styles.sectionLabel}>Quick Actions</Text>
              {pinnedItems.map((item) => (
                (() => {
                  const Icon = getItemIcon(item);
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.resultIconWrap}>
                        <Icon size={18} color="#F3F1ED" />
                      </View>
                      <View style={styles.resultText}>
                        <Text style={styles.resultLabel}>{item.label}</Text>
                        <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
                      </View>
                    </Pressable>
                  );
                })()
              ))}
            </>
          )}

          {/* Search results */}
          {results.length > 0 && (
            <>
              {query.length === 0 && <View style={styles.divider} />}
              <Text style={styles.sectionLabel}>Results</Text>
              {results.map((item) => (
                (() => {
                  const Icon = getItemIcon(item);
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                      onPress={() => handleSelect(item)}
                    >
                      <View style={styles.resultIconWrap}>
                        <Icon size={18} color="#F3F1ED" />
                      </View>
                      <View style={styles.resultText}>
                        <Text style={styles.resultLabel}>{item.label}</Text>
                        <Text style={styles.resultSubtitle}>
                          {item.subtitle}
                          {item.distance != null ? ` • ${formatDistance(item.distance)}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })()
              ))}
            </>
          )}
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
});
