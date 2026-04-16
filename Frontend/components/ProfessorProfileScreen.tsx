import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Pressable,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { MapPin, Star, ThumbsUp, MessageSquare, AlertCircle } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { requestJson } from '../api/client';
import { TagChips } from './common/TagChips';

interface Review {
  id: string;
  course_code: string;
  review_text: string;
  overall_rating: number;
  would_take_again: boolean | null;
  grade: string;
  review_date: string;
  tags: string[];
}

interface ProfessorDetails {
  id: string;
  name: string;
  overall_rating: number;
  total_reviews: number;
  would_take_again_percent: number;
  departments: string[];
  recent_reviews: Review[];
  overallSummary?: {
    sentiment: string;
    strengths: string[];
    complaints: string[];
  };
}

export function ProfessorProfileScreen() {
  const { COLORS } = useTheme();
  const route = useRoute<any>();
  const { professorId, professorName } = route.params;

  const [details, setDetails] = useState<ProfessorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const coursesList = React.useMemo(() => {
    if (!details?.recent_reviews) return [];
    const set = new Set<string>();
    details.recent_reviews.forEach((r) => set.add(r.course_code || 'General'));
    return Array.from(set).sort();
  }, [details]);

  const filteredReviews = React.useMemo(() => {
    if (!details?.recent_reviews) return [];
    if (!selectedCourse) return details.recent_reviews;
    return details.recent_reviews.filter((r) => (r.course_code || 'General') === selectedCourse);
  }, [details, selectedCourse]);

  useEffect(() => {
    fetchDetails();
  }, [professorId]);

  const fetchDetails = async () => {
    try {
      const data = await requestJson(`/professors/${encodeURIComponent(professorId)}`);
      setDetails(data);
    } catch (error) {
      console.warn('Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating?: number) => {
    if (!rating) return COLORS.textSecondary;
    if (rating >= 4.0) return '#10b981';
    if (rating >= 3.0) return '#f59e0b';
    return '#ef4444';
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCard: {
      backgroundColor: COLORS.surface,
      padding: 24,
      borderBottomWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      marginBottom: 16,
    },
    nameText: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    deptText: {
      fontSize: 15,
      color: COLORS.textSecondary,
      marginBottom: 20,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '600',
    },
    statsContainer: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
    },
    statLabel: {
      fontSize: 12,
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 12,
      marginLeft: 4,
    },
    summaryCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 20,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    summaryTitleText: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    bulletPoint: {
      fontSize: 14,
      color: COLORS.textSecondary,
      lineHeight: 22,
      marginBottom: 8,
      paddingLeft: 8,
    },
    reviewCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 16,
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    courseBadge: {
      backgroundColor: `${COLORS.primary}15`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    courseText: {
      color: COLORS.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    reviewRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    reviewText: {
      fontSize: 15,
      color: COLORS.textPrimary,
      lineHeight: 24,
      marginBottom: 16,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 12,
    },
    metaText: {
      fontSize: 13,
      color: COLORS.textSecondary,
    },
    dateText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: 8,
      textAlign: 'right',
    },
    filterScroll: {
      marginBottom: 16,
    },
    filterContent: {
      gap: 8,
      paddingHorizontal: 4,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    filterPillActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    filterPillText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    filterPillTextActive: {
      color: '#fff',
    },
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!details) {
    return (
      <View style={styles.center}>
        <AlertCircle size={32} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
        <Text style={{ color: COLORS.textSecondary }}>Failed to load professor details.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.nameText}>{details.name}</Text>
        {details.departments?.length > 0 && (
          <Text style={styles.deptText}>{details.departments.filter(Boolean).join(', ')}</Text>
        )}
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: getRatingColor(details.overall_rating) }]}>
              {details.overall_rating ? details.overall_rating.toFixed(1) : 'N/A'}<Text style={{ fontSize: 16 }}>/5</Text>
            </Text>
            <Text style={styles.statLabel}>Quality</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.textPrimary }]}>
              {details.would_take_again_percent ? `${Math.round(details.would_take_again_percent)}%` : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Take Again</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.textPrimary }]}>
              {details.total_reviews || 0}
            </Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        {details.overallSummary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <MessageSquare size={18} color={COLORS.primary} />
              <Text style={styles.summaryTitleText}>AI Review Summary</Text>
            </View>
            
            {details.overallSummary.strengths?.length > 0 && (
               <View style={{ marginBottom: 12 }}>
                 <Text style={[styles.summaryTitleText, { fontSize: 14, marginBottom: 8, color: '#10b981' }]}>Top Strengths</Text>
                 {details.overallSummary.strengths.slice(0, 3).map((item, i) => (
                   <Text key={`s-${i}`} style={styles.bulletPoint}>• {item}</Text>
                 ))}
               </View>
            )}

            {details.overallSummary.complaints?.length > 0 && (
               <View>
                 <Text style={[styles.summaryTitleText, { fontSize: 14, marginBottom: 8, color: '#ef4444' }]}>Top Complaints</Text>
                 {details.overallSummary.complaints.slice(0, 3).map((item, i) => (
                   <Text key={`c-${i}`} style={styles.bulletPoint}>• {item}</Text>
                 ))}
               </View>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        
        {coursesList.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            <Pressable
              style={[styles.filterPill, !selectedCourse && styles.filterPillActive]}
              onPress={() => setSelectedCourse(null)}
            >
              <Text style={[styles.filterPillText, !selectedCourse && styles.filterPillTextActive]}>All Courses</Text>
            </Pressable>
            {coursesList.map(c => (
              <Pressable
                key={c}
                style={[styles.filterPill, selectedCourse === c && styles.filterPillActive]}
                onPress={() => setSelectedCourse(c)}
              >
                <Text style={[styles.filterPillText, selectedCourse === c && styles.filterPillTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        
        {filteredReviews?.length > 0 ? (
          filteredReviews.map((review, idx) => (
            <View key={review.id || `rev-${idx}`} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.courseBadge}>
                  <Text style={styles.courseText}>{review.course_code || 'General'}</Text>
                </View>
                <View style={styles.reviewRating}>
                  <Star size={14} color={getRatingColor(review.overall_rating)} fill={getRatingColor(review.overall_rating)} />
                  <Text style={[styles.statValue, { fontSize: 16, color: getRatingColor(review.overall_rating) }]}>
                    {review.overall_rating.toFixed(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                {review.grade && review.grade !== 'Not sure yet' && (
                  <Text style={styles.metaText}>Grade: {review.grade}</Text>
                )}
                {review.would_take_again !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ThumbsUp size={12} color={review.would_take_again ? '#10b981' : '#ef4444'} />
                    <Text style={styles.metaText}>
                      {review.would_take_again ? 'Would take again' : 'Would not take again'}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.reviewText}>{review.review_text}</Text>
              
              {review.tags && review.tags.length > 0 && (
                <TagChips tags={review.tags} />
              )}

              <Text style={styles.dateText}>
                {new Date(review.review_date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ textAlign: 'center', color: COLORS.textSecondary, marginVertical: 32 }}>
            No written reviews found for this professor.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
