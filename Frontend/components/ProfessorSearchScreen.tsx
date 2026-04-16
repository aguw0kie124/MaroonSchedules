import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, MapPin, Star, UserRound } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { requestJson } from '../api/client';

interface ProfessorResult {
  id: string;
  name: string;
  overall_rating?: number;
  total_reviews?: number;
  departments?: (string | null)[];
}

export function ProfessorSearchScreen() {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfessorResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProfessors(query);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchProfessors = async (searchQuery: string) => {
    setLoading(true);
    try {
      const data = await requestJson(`/professors/search?q=${encodeURIComponent(searchQuery)}`, {}, 15000);
      setResults(data || []);
    } catch (error) {
      console.warn('Error fetching professors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating?: number) => {
    if (!rating) return COLORS.textSecondary;
    if (rating >= 4.0) return '#10b981'; // green
    if (rating >= 3.0) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const formatDepartments = (deps?: (string | null)[]) => {
    if (!deps || !deps.length) return '';
    return deps.filter(Boolean).join(', ');
  };

  const renderItem = ({ item }: { item: ProfessorResult }) => {
    const ratingStr = item.overall_rating ? item.overall_rating.toFixed(1) : 'N/A';
    const deptStr = formatDepartments(item.departments);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
        onPress={() => navigation.navigate('ProfessorProfileScreen', { professorId: item.id, professorName: item.name })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <UserRound size={20} color={COLORS.primary} />
          </View>
          <View style={styles.infoContainer}>
            <Text style={[styles.name, { color: COLORS.textPrimary }]}>{item.name}</Text>
            {deptStr ? (
              <View style={styles.deptRow}>
                <MapPin size={12} color={COLORS.textSecondary} />
                <Text style={[styles.deptText, { color: COLORS.textSecondary }]}>{deptStr}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.ratingBadge}>
            <Star size={14} color={getRatingColor(item.overall_rating)} fill={getRatingColor(item.overall_rating)} />
            <Text style={[styles.ratingText, { color: getRatingColor(item.overall_rating) }]}>
              {ratingStr}
            </Text>
          </View>
        </View>
        <Text style={[styles.reviewsText, { color: COLORS.textSecondary }]}>
          {item.total_reviews ? `${item.total_reviews} reviews` : 'No reviews'}
        </Text>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      margin: 16,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      height: 52,
    },
    input: {
      flex: 1,
      marginLeft: 12,
      color: COLORS.textPrimary,
      fontSize: 16,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    card: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    avatarContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${COLORS.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    infoContainer: {
      flex: 1,
    },
    name: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 4,
    },
    deptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    deptText: {
      fontSize: 13,
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${COLORS.textSecondary}10`,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    ratingText: {
      fontSize: 14,
      fontWeight: '800',
    },
    reviewsText: {
      fontSize: 13,
      marginLeft: 52,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 60,
    },
    emptyText: {
      fontSize: 15,
      color: COLORS.textSecondary,
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder="Search professors..."
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {query ? 'No professors found.' : 'Search for a professor to see reviews.'}
              </Text>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}
