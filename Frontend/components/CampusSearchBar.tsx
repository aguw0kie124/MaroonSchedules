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
import { COLORS } from './SharedUI';
import { CampusSearchResult, searchCampus, getPinnedItems } from '../services/campusSearch';
import { getAmenityEmoji, getBuildingEmoji } from '../data/campus';
import { formatDistance } from '../services/campusDirections';

interface CampusSearchBarProps {
  userCoord?: { latitude: number; longitude: number };
  onSelect: (result: CampusSearchResult) => void;
}

export function CampusSearchBar({ userCoord, onSelect }: CampusSearchBarProps) {
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

  const pinnedItems = getPinnedItems();
  const showDropdown = isFocused && (results.length > 0 || query.length === 0);

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
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.inputRow}>
        <Search color={COLORS.textSecondary} size={18} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Search buildings, dining, restrooms…"
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearBtn}>
            <X color={COLORS.textSecondary} size={16} />
          </Pressable>
        )}
      </View>

      {/* Dropdown */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {/* Quick actions when no query */}
          {query.length === 0 && (
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

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 48,
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
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 320,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
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
