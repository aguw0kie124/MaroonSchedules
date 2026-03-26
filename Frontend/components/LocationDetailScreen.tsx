import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Star, MapPin, Users, Clock, MessageCircle } from 'lucide-react-native';
import { useTheme, Card, SectionRow } from './SharedUI';
import { ReviewModal } from './ReviewModal';

export const LocationDetailScreen = () => {
  const { COLORS } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { locationName, initialData } = route.params as { locationName: string; initialData?: any };

  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reviewsRes, statsRes] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/reviews/${encodeURIComponent(locationName)}`),
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/reviews/${encodeURIComponent(locationName)}/stats`)
      ]);
      
      const reviewsData = await reviewsRes.json();
      const statsData = await statsRes.json();
      
      setReviews(reviewsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch location detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [locationName]);

  const renderReviewItem = ({ item }: { item: any }) => (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={[styles.userName, { color: COLORS.textPrimary }]}>{item.user_name}</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={14} fill={s <= item.rating ? '#FFD700' : 'transparent'} color={s <= item.rating ? '#FFD700' : COLORS.textTertiary} />
          ))}
        </View>
      </View>
      {item.comment ? (
        <Text style={[styles.comment, { color: COLORS.textSecondary }]}>{item.comment}</Text>
      ) : null}
      <Text style={[styles.date, { color: COLORS.textTertiary }]}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <Text style={[styles.title, { color: COLORS.textPrimary }]}>{locationName}</Text>
          {stats && (
            <View style={styles.ratingOverview}>
              <Star size={24} fill="#FFD700" color="#FFD700" />
              <Text style={[styles.avgRating, { color: COLORS.textPrimary }]}>
                {stats.average_rating.toFixed(1)}
              </Text>
              <Text style={[styles.totalReviews, { color: COLORS.textTertiary }]}>
                ({stats.total_reviews} reviews)
              </Text>
            </View>
          )}
        </View>

        <Card style={styles.statsCard}>
          <SectionRow 
            icon={Users} 
            label="Current Occupancy" 
            value={initialData?.percent_full ? `${initialData.percent_full}%` : "No live data"} 
          />
          {initialData?.available_seats !== undefined && (
            <SectionRow 
              icon={MapPin} 
              label="Estimated Seats" 
              value={`${initialData.available_seats} available`} 
            />
          )}
        </Card>

        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Student Reviews</Text>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: COLORS.accent + '20' }]} 
              onPress={() => setShowReviewModal(true)}
            >
              <Text style={[styles.addButtonText, { color: COLORS.accent }]}>Leave Review</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={reviews}
              renderItem={renderReviewItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MessageCircle size={48} color={COLORS.textTertiary} />
                  <Text style={[styles.emptyText, { color: COLORS.textTertiary }]}>No reviews yet. Be the first!</Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>

      <ReviewModal 
        visible={showReviewModal} 
        onClose={() => setShowReviewModal(false)} 
        locationName={locationName}
        onReviewSubmitted={fetchData}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  heroSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avgRating: {
    fontSize: 20,
    fontWeight: '600',
  },
  totalReviews: {
    fontSize: 16,
  },
  statsCard: {
    marginBottom: 32,
  },
  reviewsSection: {
    marginBottom: 40,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    fontWeight: 'bold',
  },
  reviewCard: {
    marginBottom: 12,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontWeight: '600',
    fontSize: 16,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  comment: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  }
});
