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
import { ScalePressable } from '../common/Motion';
import { addFriend, getUserPingFeed, removeFriend } from '../../services/socialFeedService';
import { 
  mapActivityToPing, 
  categoryMeta, 
  formatRelativeAge 
} from '../CampusPingsScreen';
import { PingCommentsModal } from '../pings/PingCommentsModal';

const { width } = Dimensions.get('window');

export default function PublicProfileScreen() {
  const navigation = useNavigation<any>();
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
  const { data: profile, isLoading: isLoadingProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['public-profile', targetUserId, isAnonymous],
    queryFn: async () => {
      if (isAnonymous) return { full_name: 'Anonymous', clerk_id: 'anonymous' };
      try {
        const { requestJson } = await import('../../api/client');
        return await requestJson(`/chat/users/${targetUserId}/public`);
      } catch (e) {
        console.warn('Failed to fetch public profile', e);
        return {
          clerk_id: targetUserId,
          full_name: targetUserName || 'Aggie User',
          profile_image_url: targetUserImage || '',
          bio: '',
          relationship_status: 'none',
          friend_count: 0,
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

  const isMe = currentUser?.id === targetUserId;
  const relationshipStatus = profile?.relationship_status || 'none';
  const connectionMeta = useMemo(() => {
    if (relationshipStatus === 'accepted') {
      return {
        icon: UserCheck,
        label: 'Friends',
        tint: COLORS.primary,
        backgroundColor: `${COLORS.primary}20`,
      };
    }
    if (relationshipStatus === 'incoming_pending') {
      return {
        icon: UserCheck,
        label: 'Accept',
        tint: COLORS.primary,
        backgroundColor: `${COLORS.primary}14`,
      };
    }
    if (relationshipStatus === 'outgoing_pending') {
      return {
        icon: UserPlus,
        label: 'Pending',
        tint: COLORS.textPrimary,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      };
    }
    return {
      icon: UserPlus,
      label: 'Add Friend',
      tint: COLORS.textPrimary,
      backgroundColor: undefined,
    };
  }, [COLORS.primary, COLORS.textPrimary, isDark, relationshipStatus]);
  const ConnectionIcon = connectionMeta.icon;

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
      await toggleVote(
        ping.activityId || ping.id,
        direction === 1 ? 'upvote' : 'downvote',
      );
      queryClient.invalidateQueries({ queryKey: ['public-user-pings', targetUserId] });
    } catch (error) {
      // Revert optimistic update on error if needed
    }
  };

  const handleOpenComments = (ping: any) => {
    setSelectedPing(null);
    setActiveCommentsPing(ping);
  };

  const openPingOnMap = (ping: any) => {
    navigation.navigate('Main', {
      screen: 'Places',
      params: {
        initialLayer: 'Pulse',
        initialLocation: ping.locationTag,
        focusToken: `public-ping:${ping.id}:${ping.createdAt}`,
      },
    });
  };

  const savePingToPlans = (ping: any) => {
    Alert.alert('Saved', 'This ping has been added to your plans.');
  };

  const renderEnlargedPostModal = () => {
    if (!selectedPing) return null;
    const cat = categoryMeta(selectedPing.category);
    const pingMetaLine = selectedPing.category
      ? `${selectedPing.category} • ${formatRelativeAge(selectedPing.createdAt)}`
      : formatRelativeAge(selectedPing.createdAt);

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
                    <Text style={{ fontSize: 13, color: COLORS.textTertiary, fontWeight: '600' }}>{pingMetaLine}</Text>
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
    await Promise.all([refetchProfile(), refetchPings()]);
    setRefreshing(false);
  }, [refetchPings, refetchProfile]);

  const toggleFriend = async () => {
    if (!currentUser?.id || isMe || isAnonymous) {
      return;
    }

    try {
      if (relationshipStatus === 'accepted' || relationshipStatus === 'outgoing_pending') {
        await removeFriend(targetUserId, currentUser.id);
        Alert.alert(
          relationshipStatus === 'accepted' ? 'Friend removed' : 'Request canceled',
          relationshipStatus === 'accepted'
            ? `You are no longer friends with ${profile?.full_name || profile?.username || targetUserName || 'this user'}.`
            : `Your friend request to ${profile?.full_name || profile?.username || targetUserName || 'this user'} was canceled.`,
        );
      } else {
        const result = await addFriend(targetUserId, currentUser.id);
        const action = result?.friendship?.action;
        if (action === 'accepted') {
          Alert.alert('Now Friends!', `${profile?.full_name || profile?.username || targetUserName || 'This user'} is now your friend.`);
        } else if (action === 'request_pending') {
          Alert.alert('Already Sent', `Your friend request to ${profile?.full_name || profile?.username || targetUserName || 'this user'} is still pending.`);
        } else if (action === 'already_connected') {
          Alert.alert('Already Friends', `You are already friends with ${profile?.full_name || profile?.username || targetUserName || 'this user'}.`);
        } else {
          Alert.alert('Request Sent', `${profile?.full_name || profile?.username || targetUserName || 'This user'} will be notified of your friend request.`);
        }
      }
      await refetchProfile();
      queryClient.invalidateQueries({ queryKey: ['campus-ping-friends'] });
      queryClient.invalidateQueries({ queryKey: ['campus-ping-friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['public-profile', targetUserId] });
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
          const cardWidth = Math.floor((width - 52) / 3);
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

          <Text style={currentStyles.nameText}>{profile?.full_name || profile?.username || 'Aggie User'}</Text>
          {profile?.username ? (
            <Text style={[currentStyles.bioText, { opacity: 0.6, marginTop: 2, marginBottom: profile?.bio ? 0 : 4 }]}>@{profile.username}</Text>
          ) : null}
          {profile?.bio ? <Text style={currentStyles.bioText}>{profile.bio}</Text> : null}

          {/* Stats & Action Row */}
          <View style={currentStyles.statCardRow}>
            <ScalePressable 
              containerStyle={{ flex: 1 }}
              style={currentStyles.modernStatCard}
            >
               <Text style={currentStyles.modernStatValue}>{profile?.friend_count ?? 0}</Text>
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
                  connectionMeta.backgroundColor ? { backgroundColor: connectionMeta.backgroundColor } : null,
                ]}
                onPress={toggleFriend}
              >
                <ConnectionIcon size={20} color={connectionMeta.tint} />
                <Text style={[currentStyles.modernStatLabel, { color: connectionMeta.tint }]}>
                  {connectionMeta.label}
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
          target={
            activeCommentsPing
              ? {
                  activityId: activeCommentsPing.activityId || activeCommentsPing.id,
                  title: activeCommentsPing.title,
                  subtitle: activeCommentsPing.locationTag,
                  commentCount: activeCommentsPing.commentCount,
                }
              : null
          }
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
