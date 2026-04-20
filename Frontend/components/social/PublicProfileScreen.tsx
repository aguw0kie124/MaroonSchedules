import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  Alert,
  Modal
} from 'react-native';
import { 
  ArrowLeft, 
  LayoutGrid, 
  UserPlus, 
  UserCheck, 
  UserX, 
  MessageCircle,
  MoreVertical,
  MapPin,
  ChevronRight,
  Info,
  ArrowBigUp,
  ArrowBigDown,
  X,
  MapPin as MapPinIcon,
  Bookmark as BookmarkIcon,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';

import { useTheme, getDefaultAccentColor, WallpaperWrapper } from '../SharedUI';
import { apiFetch, requestJson } from '../../api/client';
import { API_URL } from '../../config';
import { ScalePressable } from '../common/Motion';
import { getUserPingFeed, getFriends } from '../../services/socialFeedService';
import { 
  mapActivityToPing, 
  categoryMeta, 
  formatRelativeAge 
} from '../CampusPingsScreen';
import { PingCommentsModal } from '../pings/PingCommentsModal';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const GRID_SIZE = width / COLUMN_COUNT;

export default function PublicProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { targetUserId, targetUserName, targetUserImage, isAnonymous } = route.params;
  const { user: currentUser } = useUser();
  const queryClient = useQueryClient();
  const { COLORS, theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [activeCommentsPing, setActiveCommentsPing] = useState<any | null>(null);
  const [selectedPing, setSelectedPing] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch Basic Profile (Skip if anonymous)
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-profile', targetUserId, isAnonymous],
    queryFn: async () => {
      if (isAnonymous) return { full_name: 'Anonymous', clerk_id: 'anonymous' };
      try {
        return await requestJson(`/chat/users/${targetUserId}/public`);
      } catch (e) {
        console.warn('Failed to fetch public profile', e);
        return {
          clerk_id: targetUserId,
          full_name: targetUserName || 'Aggie User',
          profile_image_url: targetUserImage || '',
          bio: ''
        };
      }
    }
  });

  // 2. Fetch User Pings
  const { data: userPings = [], isLoading: isLoadingPings, refetch: refetchPings } = useQuery({
    queryKey: ['public-user-pings', targetUserId],
    queryFn: async () => {
      const activities = await getUserPingFeed(targetUserId, 50);
      return activities.map((act: any) => mapActivityToPing(act, currentUser, new Map()));
    }
  });

  // 3. Fetch Friends (to get count) - Skip if anonymous
  const { data: friendsList = [], isLoading: isLoadingFriends, refetch: refetchFriends } = useQuery({
    queryKey: ['public-user-friends', targetUserId, isAnonymous],
    queryFn: async () => {
      if (isAnonymous) return [];
      return await getFriends(targetUserId);
    }
  });

  // 4. Friend Relationship Check (is following/friend?)
  const isMe = currentUser?.id === targetUserId;
  const isFriend = useMemo(() => {
    if (!currentUser?.id) return false;
    // Check if current user is in target user's friends list or vice versa
    // This is a bit complex without a dedicated "isFriend" endpoint, so we'll look for match
    return friendsList.some((f: any) => f.clerk_id === currentUser.id || f.id === currentUser.id);
  }, [friendsList, currentUser?.id]);

  const handleVotePing = async (ping: any, direction: number) => {
    if (!ping) return;
    const { toggleVote } = await import('../../services/socialFeedService');
    
    // Optimistic UI Update
    const currentVote = ping.userVote || 0;
    const nextUserVote = currentVote === direction ? 0 : direction;
    
    let scoreAdjustment = 0;
    if (nextUserVote === 0) {
      scoreAdjustment = -currentVote;
    } else if (currentVote === 0) {
      scoreAdjustment = direction;
    } else {
      scoreAdjustment = direction * 2;
    }
    
    setSelectedPing((prev: any) => prev ? {
      ...prev,
      userVote: nextUserVote,
      score: (prev.score || 0) + scoreAdjustment
    } : null);

    try {
      await toggleVote(ping.id, direction);
      queryClient.invalidateQueries({ queryKey: ['public-user-feed', targetUserId] });
    } catch (error) {
      // Revert optimistic update on error if needed
    }
  };

  const handleOpenComments = (ping: any) => {
    setSelectedPing(null);
    setActiveCommentsPing(ping);
  };

  const openPingOnMap = (ping: any) => {
    navigation.navigate('PlacesMap', { targetPing: ping });
  };

  const savePingToPlans = (ping: any) => {
    Alert.alert('Saved', 'This ping has been added to your plans.');
  };

  const renderEnlargedPostModal = () => {
    if (!selectedPing) return null;
    const cat = categoryMeta(selectedPing.category || 'General');

    return (
      <Modal
        visible={!!selectedPing}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPing(null)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setSelectedPing(null)}
        >
          <Animated.View 
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={{ 
              width: width * 0.88,
              backgroundColor: COLORS.background,
              borderRadius: 32,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Pressable style={{ padding: 24 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cat.accent + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <cat.Icon size={20} color={cat.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.textPrimary }}>{selectedPing.title}</Text>
                    <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontWeight: '600' }}>{selectedPing.category} • {formatRelativeAge(selectedPing.createdAt)}</Text>
                  </View>
                  <ScalePressable onPress={() => setSelectedPing(null)} style={{ padding: 4 }}>
                    <X size={20} color={COLORS.textTertiary} />
                  </ScalePressable>
               </View>

               {selectedPing.imageUrl && (
                 <Image source={{ uri: selectedPing.imageUrl }} style={{ width: '100%', height: 280, borderRadius: 24, marginBottom: 20 }} resizeMode="cover" />
               )}

               {selectedPing.body ? (
                 <ScrollView style={{ maxHeight: 200, marginBottom: 20 }} showsVerticalScrollIndicator={false}>
                   <Text style={{ fontSize: 16, color: COLORS.textPrimary, lineHeight: 24, fontWeight: '500' }}>
                     {selectedPing.body}
                   </Text>
                 </ScrollView>
               ) : null}

               <View style={{ 
                 flexDirection: 'row', 
                 alignItems: 'center', 
                 justifyContent: 'space-between',
                 paddingTop: 16,
                 borderTopWidth: 1,
                 borderTopColor: COLORS.border,
                 marginTop: 4
               }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ScalePressable 
                        onPress={() => handleVotePing(selectedPing, 1)}
                        style={{ padding: 6 }}
                      >
                        <ArrowBigUp 
                          size={28} 
                          color={selectedPing.userVote === 1 ? '#3FA86A' : COLORS.textPrimary} 
                          fill={selectedPing.userVote === 1 ? '#3FA86A' : 'transparent'}
                        />
                      </ScalePressable>
                      
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '800', 
                        color: selectedPing.userVote === 1 ? '#3FA86A' : (selectedPing.userVote === -1 ? '#D8616E' : COLORS.textPrimary) 
                      }}>
                        {selectedPing.score || 0}
                      </Text>
                      
                      <ScalePressable 
                        onPress={() => handleVotePing(selectedPing, -1)}
                        style={{ padding: 6 }}
                      >
                        <ArrowBigDown 
                          size={28} 
                          color={selectedPing.userVote === -1 ? '#D8616E' : COLORS.textPrimary} 
                          fill={selectedPing.userVote === -1 ? '#D8616E' : 'transparent'}
                        />
                      </ScalePressable>
                    </View>

                    <ScalePressable 
                      onPress={() => handleOpenComments(selectedPing)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 }}
                    >
                      <MessageCircle size={24} color={COLORS.textPrimary} />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textPrimary }}>
                        {selectedPing.commentCount || 0}
                      </Text>
                    </ScalePressable>
                 </View>

                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <ScalePressable 
                      onPress={() => openPingOnMap(selectedPing)}
                      style={{ padding: 6 }}
                    >
                      <MapPinIcon size={24} color={COLORS.textPrimary} />
                    </ScalePressable>
                 </View>
               </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPings(), refetchFriends()]);
    setRefreshing(false);
  }, [refetchPings, refetchFriends]);

  const toggleFriend = async () => {
    try {
      if (isFriend) {
          await requestJson(`/chat/users/${targetUserId}/friends/remove`, {
              method: 'DELETE',
              body: JSON.stringify({ friend_id: currentUser?.id })
          });
      } else {
          await requestJson(`/chat/users/${targetUserId}/friends/add`, {
              method: 'POST',
              body: JSON.stringify({ friend_id: currentUser?.id })
          });
      }
      refetchFriends();
      queryClient.invalidateQueries({ queryKey: ['campus-ping-friends'] });
    } catch (e) {
      console.warn('Failed to toggle friend status', e);
      Alert.alert('Error', 'Could not update friend status. Try again later.');
    }
  };

  const renderContentGrid = () => {
    if (isLoadingPings) {
      return (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      );
    }

    if (userPings.length === 0) {
      return (
        <View style={{ padding: 60, alignItems: 'center' }}>
          <LayoutGrid size={48} color={COLORS.textTertiary} strokeWidth={1} style={{ marginBottom: 16 }} />
          <Text style={{ color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' }}>No pings yet</Text>
          <Text style={{ color: COLORS.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
            When {profile?.full_name || 'this user'} shares pings, they'll show up here.
          </Text>
        </View>
      );
    }

    const mediaPings = userPings.filter((p: any) => p.imageUrl);
    const textPings = userPings.filter((p: any) => !p.imageUrl);

    return (
      <View style={currentStyles.postsGrid}>
        {userPings.map((ping: any, index: number) => {
          const cardWidth = (width - 32 - 20) / 3;
          return (
            <ScalePressable
              key={ping.id || index}
              style={[currentStyles.postSquare, { 
                width: cardWidth,
                borderRadius: 24,
                height: cardWidth * 1.33 
              }]}
              onPress={() => setSelectedPing(ping)}
            >
              {ping.imageUrl ? (
                <Image source={{ uri: ping.imageUrl }} style={[currentStyles.postImage, { borderRadius: 24 }]} />
              ) : (
                <View style={[currentStyles.gridTextCard, { backgroundColor: COLORS.surfaceElevated, borderRadius: 24 }]}>
                  <Text style={currentStyles.gridTextTitle} numberOfLines={3}>{ping.title}</Text>
                  <View style={currentStyles.gridTextFooter}>
                     <MapPin size={10} color={COLORS.textTertiary} />
                     <Text style={currentStyles.gridTextMeta} numberOfLines={1}>{ping.locationTag}</Text>
                  </View>
                </View>
              )}
            </ScalePressable>
          );
        })}
      </View>
    );
  };

  const currentStyles = getStyles(COLORS, isDark, accentColor);

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <SafeAreaView style={{ flex: 0, backgroundColor: COLORS.background }} />
      
      {/* Floating Back Button */}
      <View style={currentStyles.backButtonWrapper}>
        <ScalePressable onPress={() => navigation.goBack()} style={currentStyles.backButton}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </ScalePressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      >
        <View style={currentStyles.profileTopSection}>
          <View style={currentStyles.avatarContainer}>
             <View style={currentStyles.avatarRing}>
                {profile?.profile_image_url ? (
                  <Image source={{ uri: profile.profile_image_url }} style={currentStyles.avatarImage} />
                ) : (
                  <View style={[currentStyles.avatarPlaceholder, { backgroundColor: COLORS.surfaceElevated }]}>
                    <Text style={currentStyles.avatarInitials}>{(profile?.full_name || 'A')[0]}</Text>
                  </View>
                )}
             </View>
          </View>

          <Text style={currentStyles.nameText}>{profile?.full_name || 'Aggie User'}</Text>
          {profile?.bio ? <Text style={currentStyles.bioText}>{profile.bio}</Text> : null}

          {/* Stats & Action Row */}
          <View style={currentStyles.statCardRow}>
            <ScalePressable 
              containerStyle={{ flex: 1 }}
              style={currentStyles.modernStatCard}
              onPress={() => friendsList.length > 0 && Alert.alert('Friends', `${profile?.full_name || 'This user'} has ${friendsList.length} friends.`)}
            >
               <Text style={currentStyles.modernStatValue}>{friendsList.length}</Text>
               <Text style={currentStyles.modernStatLabel}>Friends</Text>
            </ScalePressable>

            <ScalePressable 
              containerStyle={{ flex: 1 }}
              style={currentStyles.modernStatCard}
            >
               <Text style={currentStyles.modernStatValue}>{userPings.length}</Text>
               <Text style={currentStyles.modernStatLabel}>Pings</Text>
            </ScalePressable>

            {!isMe && !isAnonymous && (
              <ScalePressable 
                containerStyle={{ flex: 1 }}
                style={[
                  currentStyles.modernStatCard, 
                  isFriend && { backgroundColor: `${COLORS.primary}20` }
                ]}
                onPress={toggleFriend}
              >
                {isFriend ? (
                  <UserCheck size={20} color={COLORS.primary} />
                ) : (
                  <UserPlus size={20} color={COLORS.textPrimary} />
                )}
                <Text style={[currentStyles.modernStatLabel, isFriend && { color: COLORS.primary }]}>
                  {isFriend ? 'Friends' : 'Add'}
                </Text>
              </ScalePressable>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={{ paddingTop: 0 }}>
           {renderContentGrid()}
        </View>

        {renderEnlargedPostModal()}
      </ScrollView>

      {activeCommentsPing && (
        <PingCommentsModal
          visible={!!activeCommentsPing}
          ping={activeCommentsPing}
          onClose={() => setActiveCommentsPing(null)}
        />
      )}
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean, accentColor: string) => StyleSheet.create({
  backButtonWrapper: {
    position: 'absolute',
    top: 44,
    left: 12,
    zIndex: 100,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTopSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: COLORS.primary,
    padding: 4,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  nameText: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  statCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  modernStatCard: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernStatValue: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  modernStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textTertiary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileTabsWrapper: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 4,
  },
  profileTabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    paddingHorizontal: 16,
  },
  postSquare: {
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  gridTextCard: {
    width: '100%',
    height: '100%',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTextTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  gridTextFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridTextMeta: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textTertiary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
