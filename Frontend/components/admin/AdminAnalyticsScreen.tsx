import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useTheme } from '../SharedUI';
import { Button } from '../Button';
import { requestJson } from '../../api/client';
import { Users, Share2, MapPin, Star } from 'lucide-react-native';

interface AdminEvent {
  id: string;
  title: string;
  location_name: string;
  shares_count: number;
  rsvp_count: number;
  created_at: string;
  avg_rating?: number;
  private_feedbacks?: { rating: number, feedback: string, created_at: string }[];
}

export function AdminAnalyticsScreen() {
  const { COLORS } = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = async () => {
    if (!user?.id) return;
    try {
      const data = await requestJson(`/admin/events/me?clerk_id=${encodeURIComponent(user.id)}`);
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      padding: 24,
      paddingTop: 48,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    card: {
      backgroundColor: COLORS.surface,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    eventTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 8,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    locationText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginLeft: 6,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 16,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 16,
    },
    metric: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.background,
      padding: 12,
      borderRadius: 12,
      flex: 1,
      justifyContent: 'center'
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginLeft: 8,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: COLORS.textSecondary,
      fontSize: 16,
      textAlign: 'center'
    },
    feedbackSection: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 16,
    },
    feedbackTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textSecondary,
      marginBottom: 8,
    },
    feedbackItem: {
      backgroundColor: COLORS.background,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    feedbackStars: {
      flexDirection: 'row',
      gap: 2,
      marginBottom: 6,
    },
    feedbackText: {
      fontSize: 14,
      color: COLORS.textPrimary,
    }
  });

  const renderItem = ({ item }: { item: AdminEvent }) => (
    <View style={styles.card}>
      <Text style={styles.eventTitle}>{item.title}</Text>
      <View style={styles.locationRow}>
        <MapPin size={14} color={COLORS.textTertiary} />
        <Text style={styles.locationText}>{item.location_name}</Text>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Star size={18} color="#FFD700" fill="#FFD700" />
          <Text style={styles.metricValue}>{Number(item.avg_rating || 0).toFixed(1)}</Text>
        </View>
        <View style={styles.metric}>
          <Users size={18} color={COLORS.primary} />
          <Text style={styles.metricValue}>{item.rsvp_count} RSVP</Text>
        </View>
        <View style={styles.metric}>
          <Share2 size={18} color={COLORS.primary} />
          <Text style={styles.metricValue}>{item.shares_count}</Text>
        </View>
      </View>
      {item.private_feedbacks && item.private_feedbacks.length > 0 && (
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackTitle}>Private Feedback (Needs Improvement)</Text>
          {item.private_feedbacks.map((fb, idx) => (
            <View key={idx} style={styles.feedbackItem}>
              <View style={styles.feedbackStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star}
                    size={12}
                    fill={star <= fb.rating ? '#FFD700' : 'transparent'} 
                    color={star <= fb.rating ? '#FFD700' : COLORS.textTertiary}
                  />
                ))}
              </View>
              <Text style={styles.feedbackText}>{fb.feedback || "No comment provided."}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Button variant="secondary" onPress={() => signOut()}>Sign Out</Button>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>You haven't posted any events yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
