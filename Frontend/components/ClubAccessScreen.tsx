import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { UserRoundPlus } from 'lucide-react-native';

import { requestJson } from '../api/client';
import { Button } from './Button';
import { TagChips } from './common/TagChips';
import { useTheme } from './SharedUI';

interface ClubAccessItem {
  clerk_id: string;
  organization_name: string;
  club_tag?: string | null;
  auto_approve_join_requests?: boolean;
  join_status?: string | null;
  requested_at?: string | null;
}

export function ClubAccessScreen() {
  const { COLORS } = useTheme();
  const { user } = useUser();
  const [clubs, setClubs] = useState<ClubAccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingClubId, setRequestingClubId] = useState<string | null>(null);

  const loadClubs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await requestJson(`/clubs?clerk_id=${encodeURIComponent(user.id)}`, {}, 15000);
      setClubs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn(error);
      Alert.alert('Could not load clubs', error instanceof Error ? error.message : 'Please try again in a moment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  useFocusEffect(
    useCallback(() => {
      loadClubs();
    }, [loadClubs]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClubs();
  };

  const requestJoin = async (club: ClubAccessItem) => {
    if (!user?.id) return;
    setRequestingClubId(club.clerk_id);
    try {
      const result = await requestJson(`/clubs/${encodeURIComponent(club.clerk_id)}/join-requests`, {
        method: 'POST',
        body: JSON.stringify({ clerk_id: user.id }),
      }, 15000);
      setClubs((current) =>
        current.map((item) =>
          item.clerk_id === club.clerk_id
            ? {
                ...item,
                join_status: result.status,
                requested_at: result.requested_at || new Date().toISOString(),
              }
            : item,
        ),
      );
      Alert.alert(
        result.auto_approved ? 'Access granted' : 'Request sent',
        result.auto_approved
          ? `You now have access to ${club.organization_name} events.`
          : `Your request was sent to ${club.organization_name}.`,
      );
    } catch (error) {
      console.warn(error);
      Alert.alert('Request failed', 'We could not submit that join request.');
    } finally {
      setRequestingClubId(null);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 18,
    },
    heroCard: {
      borderRadius: 24,
      padding: 20,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 8,
    },
    eyebrow: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 26,
      fontWeight: '800',
    },
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    clubCard: {
      borderRadius: 20,
      padding: 18,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 12,
    },
    clubName: {
      color: COLORS.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    clubMeta: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    emptyText: {
      color: COLORS.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      paddingVertical: 32,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.heroCard}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                <UserRoundPlus size={22} color={COLORS.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Memberships</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.textPrimary }}>Club Access</Text>
              </View>
           </View>
        </View>

        {clubs.length ? (
          clubs.map((club) => {
            const status = (club.join_status || '').toLowerCase();
            const isApproved = status === 'approved';
            const isPending = status === 'pending';
            return (
              <View key={club.clerk_id} style={styles.clubCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.textPrimary }}>{club.organization_name}</Text>
                      <TagChips tags={club.club_tag ? [club.club_tag] : []} label="Official" />
                   </View>
                </View>
                
                <Text style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 }}>
                  {club.auto_approve_join_requests
                    ? 'This organization grants access automatically upon request.'
                    : 'Membership requests are reviewed manually by club officers.'}
                </Text>

                <View style={{ marginTop: 4 }}>
                  {isApproved ? (
                    <View style={{ height: 44, borderRadius: 12, backgroundColor: '#10B981' + '15', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#10B981' + '30' }}>
                       <Text style={{ fontSize: 14, fontWeight: '800', color: '#10B981' }}>Access Granted</Text>
                    </View>
                  ) : isPending ? (
                    <View style={{ height: 44, borderRadius: 12, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }}>
                       <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.textTertiary }}>Request Pending</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => requestJoin(club)}
                      disabled={requestingClubId === club.clerk_id}
                      style={({ pressed }) => ({
                        height: 48,
                        borderRadius: 14,
                        backgroundColor: COLORS.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: (pressed || requestingClubId === club.clerk_id) ? 0.8 : 1,
                        shadowColor: COLORS.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 4
                      })}
                    >
                       <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>
                         {requestingClubId === club.clerk_id ? 'Sending...' : 'Request to Join'}
                       </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.heroCard, { paddingVertical: 40, alignItems: 'center' }]}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>
                No clubs have configured access tags yet.
              </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
