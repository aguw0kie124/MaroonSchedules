import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Keyboard,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { CampusSearchResult, searchCampus, getPinnedItems } from '../services/campusSearch';
import { getAmenityEmoji, getBuildingEmoji } from '../data/campus';
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
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
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

  const getItemIcon = (item: CampusSearchResult): string => {
    if (item.kind === 'command') {
      switch (item.commandType) {
        case 'nearest-restroom': return '🚻';
        case 'nearest-coffee': return '☕';
        case 'nearest-library': return '📚';
        case 'nearest-dining': return '🍔';
        default: return '📍';
      }
    }
    if (item.building) return getBuildingEmoji(item.building.type);
    if (item.amenity) return getAmenityEmoji(item.amenity.type);
    return '📍';
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
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.resultIcon}>{getItemIcon(item)}</Text>
                  <View style={styles.resultText}>
                    <Text style={styles.resultLabel}>{item.label}</Text>
                    <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {/* Search results */}
          {results.length > 0 && (
            <>
              {query.length === 0 && <View style={styles.divider} />}
              <Text style={styles.sectionLabel}>Results</Text>
              {results.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.resultIcon}>{getItemIcon(item)}</Text>
                  <View style={styles.resultText}>
                    <Text style={styles.resultLabel}>{item.label}</Text>
                    <Text style={styles.resultSubtitle}>
                      {item.subtitle}
                      {item.distance != null ? ` • ${formatDistance(item.distance)}` : ''}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
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
    backgroundColor: '#050505',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 18,
    height: 56,
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
    backgroundColor: '#1E1E1E',
  },
  resultIcon: {
    fontSize: 20,
    marginRight: 14,
    width: 28,
    textAlign: 'center',
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
