import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link2, Search, UserCheck, UserPlus, X, Users } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../SharedUI';
import { ScalePressable } from '../common/Motion';
import {
  addFriend,
  removeFriend,
  searchUsers,
} from '../../services/socialFeedService';
import { useNavigation } from '@react-navigation/native';

interface FindFriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function sortByMutuals(users: any[]) {
  return [...users].sort((a, b) => {
    const mutualDiff = (b.mutual_count || 0) - (a.mutual_count || 0);
    if (mutualDiff !== 0) return mutualDiff;
    return (a.full_name || a.name || '').localeCompare(b.full_name || b.name || '');
  });
}

function formatMutualLabel(count: number) {
  if (!count) return null;
  return count === 1 ? '1 mutual friend' : `${count} mutual friends`;
}

export function FindFriendsModal({ visible, onClose }: FindFriendsModalProps) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const searchRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all users when modal opens (for instant autofill)
  useEffect(() => {
    if (!visible || !user?.id) return;
    setLoadingAll(true);
    searchUsers('', user.id, 50)
      .then((data) => {
        const filtered = sortByMutuals(data.filter((r: any) => r.id !== user.id));
        setAllUsers(filtered);
        setResults(filtered);
      })
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, [visible, user?.id]);

  // Reset on close — clear allUsers so next open always gets fresh relationship statuses
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setAllUsers([]);
      setResults([]);
    }
  }, [visible]);

  // Debounced autofill filter — runs instantly on allUsers, no extra network call unless
  // allUsers doesn't have enough matches.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(sortByMutuals(allUsers));
      return;
    }
    const q = query.trim().toLowerCase();
    // Instant local filter first
    const local = allUsers.filter((u: any) => {
      const name = (u.full_name || u.name || '').toLowerCase();
      const uname = (u.username || '').toLowerCase();
      const major = (u.major || '').toLowerCase();
      return name.includes(q) || uname.includes(q) || major.includes(q);
    });
    setResults(sortByMutuals(local));

    // Also do a network search for names not in the preloaded list
    debounceRef.current = setTimeout(async () => {
      if (!user?.id) return;
      setSearching(true);
      try {
        const data = await searchUsers(query.trim(), user.id, 30);
        const filtered = sortByMutuals(data.filter((r: any) => r.id !== user.id));
        setResults(filtered);
        // Merge back into allUsers cache
        setAllUsers((prev) => {
          const ids = new Set(prev.map((u: any) => u.id));
          const newOnes = filtered.filter((u: any) => !ids.has(u.id));
          return [...prev, ...newOnes];
        });
      } catch (e) {
        // keep local results on error
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, allUsers, user?.id]);

  const getStatus = (entry: any): 'none' | 'accepted' | 'outgoing_pending' | 'incoming_pending' => {
    if (entry?.relationship_status) return entry.relationship_status;
    if (entry?.is_friend) return 'accepted';
    if (entry?.request_sent) return 'outgoing_pending';
    if (entry?.request_received) return 'incoming_pending';
    return 'none';
  };

  const updateLocal = (targetId: string, status: string) => {
    const updater = (list: any[]) =>
      list.map((r) =>
        r.id === targetId
          ? { ...r, relationship_status: status, is_friend: status === 'accepted', request_sent: status === 'outgoing_pending', request_received: status === 'incoming_pending' }
          : r,
      );
    setResults(updater);
    setAllUsers(updater);
  };

  const handleAction = useCallback(
    async (entry: any) => {
      if (!user?.id) return;
      const status = getStatus(entry);
      const id = entry.id;
      setActionLoading((p) => ({ ...p, [id]: true }));
      try {
        if (status === 'accepted' || status === 'outgoing_pending') {
          await removeFriend(id, user.id);
          updateLocal(id, 'none');
        } else {
          const result = await addFriend(id, user.id);
          const action = result?.friendship?.action;
          updateLocal(id, action === 'accepted' ? 'accepted' : 'outgoing_pending');
        }
        queryClient.invalidateQueries({ queryKey: ['campus-ping-friends'] });
        queryClient.invalidateQueries({ queryKey: ['campus-ping-friend-requests'] });
      } catch (e) {
        console.warn('[FindFriends] action failed', e);
      } finally {
        setActionLoading((p) => ({ ...p, [id]: false }));
      }
    },
    [user?.id, queryClient],
  );

  const openProfile = (entry: any) => {
    onClose();
    navigation.navigate('PublicProfile', {
      targetUserId: entry.id,
      targetUserName: entry.full_name || entry.name || 'Aggie User',
      targetUserImage: entry.profile_image_url || null,
      isAnonymous: false,
    });
  };

  const handleShareLink = async () => {
    if (!user?.id) return;
    const link = `maroonlife://add-friend/${user.id}`;
    const friendlyName = user.fullName || user.primaryEmailAddress?.emailAddress || 'me';
    try {
      await Share.share({
        message: `Connect with ${friendlyName} on MaroonSchedules! Tap to add as a friend: ${link}`,
        url: link,
      });
    } catch (e) {
      // user cancelled
    }
  };

  const renderButton = (entry: any) => {
    const status = getStatus(entry);
    const isLoading = actionLoading[entry.id];
    if (isLoading) {
      return (
        <View style={[styles.actionBtn, { backgroundColor: COLORS.surfaceElevated }]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }
    if (status === 'accepted') {
      return (
        <ScalePressable onPress={() => handleAction(entry)} style={[styles.actionBtn, { backgroundColor: `${COLORS.primary}18` }]}>
          <UserCheck size={15} color={COLORS.primary} />
          <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Friends</Text>
        </ScalePressable>
      );
    }
    if (status === 'outgoing_pending') {
      return (
        <ScalePressable onPress={() => handleAction(entry)} style={[styles.actionBtn, { backgroundColor: COLORS.surfaceElevated }]}>
          <Text style={[styles.actionBtnText, { color: COLORS.textTertiary }]}>Pending</Text>
        </ScalePressable>
      );
    }
    if (status === 'incoming_pending') {
      return (
        <ScalePressable onPress={() => handleAction(entry)} style={[styles.actionBtn, { backgroundColor: `${COLORS.primary}22` }]}>
          <UserCheck size={15} color={COLORS.primary} />
          <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Accept</Text>
        </ScalePressable>
      );
    }
    return (
      <ScalePressable onPress={() => handleAction(entry)} style={[styles.actionBtn, { backgroundColor: `${COLORS.primary}14` }]}>
        <UserPlus size={15} color={COLORS.primary} />
        <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Add Friend</Text>
      </ScalePressable>
    );
  };

  const styles = getStyles(COLORS, isDark);
  const showLoading = loadingAll && results.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { paddingTop: insets.top || 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Users size={20} color={COLORS.primary} />
            <Text style={styles.headerTitle}>Find Friends</Text>
          </View>
          <View style={styles.headerRight}>
            <ScalePressable onPress={handleShareLink} style={styles.shareBtn}>
              <Link2 size={18} color={COLORS.primary} />
            </ScalePressable>
            <ScalePressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textPrimary} />
            </ScalePressable>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Search size={16} color={searching || loadingAll ? COLORS.primary : COLORS.textTertiary} />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            placeholder="Search by name or @username…"
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={15} color={COLORS.textTertiary} />
            </Pressable>
          )}
          {(searching) && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 4 }} />}
        </View>

        {/* Share link banner */}
        <Pressable style={[styles.shareBanner, { backgroundColor: `${COLORS.primary}12`, borderColor: `${COLORS.primary}30` }]} onPress={handleShareLink}>
          <Link2 size={14} color={COLORS.primary} />
          <Text style={[styles.shareBannerText, { color: COLORS.primary }]}>Share your invite link to connect instantly</Text>
        </Pressable>

        {/* Results */}
        {showLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.emptyText, { marginTop: 12, color: COLORS.textTertiary }]}>Loading people…</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Users size={44} color={COLORS.textTertiary} strokeWidth={1.5} />
                <Text style={styles.emptyText}>
                  {query.trim().length > 0 ? `No users found for "${query}"` : 'No users yet'}
                </Text>
              </View>
            }
            renderItem={({ item: entry }) => {
              const name = entry.full_name || entry.name || 'Aggie User';
              const image = entry.profile_image_url || null;
              const mutualLabel = formatMutualLabel(entry.mutual_count || 0);
              const subtitleParts = [
                mutualLabel,
                entry.username ? `@${entry.username}` : null,
                !entry.username && entry.major ? entry.major : null,
              ].filter(Boolean);
              const subtitle = subtitleParts.join(' · ') || null;
              return (
                <Pressable style={styles.row} onPress={() => openProfile(entry)}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: `${COLORS.primary}20` }]}>
                      <Text style={[styles.avatarInitials, { color: COLORS.primary }]}>{getInitials(name)}</Text>
                    </View>
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                    {subtitle ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {mutualLabel ? (
                          <>
                            <Text style={[styles.rowMeta, { color: COLORS.primary, fontWeight: '700' }]}>
                              {mutualLabel}
                            </Text>
                            {subtitleParts.length > 1 ? (
                              <Text style={styles.rowMeta}>{` · ${subtitleParts.slice(1).join(' · ')}`}</Text>
                            ) : null}
                          </>
                        ) : (
                          subtitle
                        )}
                      </Text>
                    ) : null}
                  </View>
                  {renderButton(entry)}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 74 }} />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.3,
    },
    shareBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${COLORS.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: COLORS.textPrimary,
      fontWeight: '500',
      paddingVertical: 0,
    },
    shareBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    shareBannerText: {
      fontSize: 13,
      fontWeight: '600',
    },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
      fontWeight: '500',
      maxWidth: 240,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    avatarPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: 18,
      fontWeight: '800',
    },
    rowInfo: {
      flex: 1,
    },
    rowName: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    rowMeta: {
      fontSize: 12,
      color: COLORS.textTertiary,
      fontWeight: '500',
      marginTop: 2,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      minWidth: 84,
      justifyContent: 'center',
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });
