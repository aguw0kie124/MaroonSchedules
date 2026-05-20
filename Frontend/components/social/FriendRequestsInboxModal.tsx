import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Mail, UserCheck, UserX, X } from 'lucide-react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';

import { useTheme } from '../SharedUI';
import { ScalePressable } from '../common/Motion';
import { addFriend, removeFriend } from '../../services/socialFeedService';
import { useNavigation } from '@react-navigation/native';

interface FriendRequest {
  id: string;
  full_name?: string;
  name?: string;
  profile_image_url?: string | null;
  requested_at?: string;
}

interface FriendRequestsInboxModalProps {
  visible: boolean;
  onClose: () => void;
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  onRefresh: () => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

function formatAge(iso?: string) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function FriendRequestsInboxModal({
  visible,
  onClose,
  incomingRequests,
  outgoingRequests,
  onRefresh,
}: FriendRequestsInboxModalProps) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const [actionLoading, setActionLoading] = useState<Record<string, 'accept' | 'deny'>>({});
  const [handled, setHandled] = useState<Set<string>>(new Set());

  // Clear handled set each time the modal opens so re-open shows fresh data
  useEffect(() => {
    if (!visible) setHandled(new Set());
  }, [visible]);

  const handleAccept = useCallback(
    async (entry: FriendRequest) => {
      if (!user?.id) return;
      setActionLoading((p) => ({ ...p, [entry.id]: 'accept' }));
      try {
        await addFriend(entry.id, user.id);
        setHandled((h) => new Set([...h, entry.id]));
        queryClient.invalidateQueries({ queryKey: ['campus-ping-friends'] });
        queryClient.invalidateQueries({ queryKey: ['campus-ping-friend-requests'] });
        onRefresh();
      } catch (e) {
        console.warn('[Inbox] accept failed', e);
      } finally {
        setActionLoading((p) => { const next = { ...p }; delete next[entry.id]; return next; });
      }
    },
    [user?.id, queryClient, onRefresh],
  );

  const handleDeny = useCallback(
    async (entry: FriendRequest) => {
      if (!user?.id) return;
      setActionLoading((p) => ({ ...p, [entry.id]: 'deny' }));
      try {
        await removeFriend(entry.id, user.id);
        setHandled((h) => new Set([...h, entry.id]));
        queryClient.invalidateQueries({ queryKey: ['campus-ping-friend-requests'] });
        onRefresh();
      } catch (e) {
        console.warn('[Inbox] deny failed', e);
      } finally {
        setActionLoading((p) => { const next = { ...p }; delete next[entry.id]; return next; });
      }
    },
    [user?.id, queryClient, onRefresh],
  );

  const openProfile = (entry: FriendRequest) => {
    onClose();
    navigation.navigate('PublicProfile', {
      targetUserId: entry.id,
      targetUserName: entry.full_name || entry.name || 'Aggie User',
      targetUserImage: entry.profile_image_url || null,
      isAnonymous: false,
    });
  };

  const visibleIncoming = incomingRequests.filter((r) => !handled.has(r.id));
  const styles = getStyles(COLORS, isDark);

  // All items combined for FlatList (incoming section + outgoing section)
  type Section = { type: 'label'; label: string } | { type: 'incoming'; data: FriendRequest } | { type: 'outgoing'; data: FriendRequest } | { type: 'empty' };
  const listData: Section[] = [];
  if (visibleIncoming.length > 0) {
    listData.push({ type: 'label', label: 'INCOMING' });
    visibleIncoming.forEach((r) => listData.push({ type: 'incoming', data: r }));
  } else {
    listData.push({ type: 'empty' });
  }
  if (outgoingRequests.length > 0) {
    listData.push({ type: 'label', label: 'SENT' });
    outgoingRequests.forEach((r) => listData.push({ type: 'outgoing', data: r }));
  }

  const renderItem = ({ item }: { item: Section }) => {
    if (item.type === 'label') {
      return <Text style={styles.sectionLabel}>{item.label}</Text>;
    }
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyState}>
          <UserCheck size={44} color={COLORS.textTertiary} strokeWidth={1.5} />
          <Text style={styles.emptyText}>No pending requests</Text>
          <Text style={styles.emptySubtext}>When someone sends you a connection request, it'll appear here.</Text>
        </View>
      );
    }
    const entry = item.data;
    const name = entry.full_name || entry.name || 'Aggie User';
    const isLoading = !!actionLoading[entry.id];
    const isOutgoing = item.type === 'outgoing';

    return (
      <Pressable style={styles.row} onPress={() => openProfile(entry)}>
        {entry.profile_image_url ? (
          <Image source={{ uri: entry.profile_image_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: isOutgoing ? COLORS.surfaceElevated : `${COLORS.primary}20` }]}>
            <Text style={[styles.avatarInitials, { color: isOutgoing ? COLORS.textTertiary : COLORS.primary }]}>{getInitials(name)}</Text>
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
          <Text style={styles.rowMeta}>
            {isOutgoing ? 'Awaiting response' : entry.requested_at ? formatAge(entry.requested_at) : ''}
          </Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
        ) : isOutgoing ? (
          <ScalePressable onPress={() => handleDeny(entry)} style={[styles.iconBtn, { backgroundColor: COLORS.surfaceElevated }]}>
            <UserX size={15} color={COLORS.textTertiary} />
          </ScalePressable>
        ) : (
          <View style={styles.actionRow}>
            <ScalePressable onPress={() => handleAccept(entry)} style={[styles.iconBtn, { backgroundColor: `${COLORS.primary}18` }]}>
              <Check size={16} color={COLORS.primary} strokeWidth={2.5} />
            </ScalePressable>
            <ScalePressable onPress={() => handleDeny(entry)} style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,80,80,0.12)' : 'rgba(220,50,50,0.08)' }]}>
              <X size={16} color="#D05050" strokeWidth={2.5} />
            </ScalePressable>
          </View>
        )}
      </Pressable>
    );
  };

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
            <Mail size={20} color={COLORS.primary} />
            <Text style={styles.headerTitle}>Connection Requests</Text>
            {visibleIncoming.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{visibleIncoming.length}</Text>
              </View>
            )}
          </View>
          <ScalePressable onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={COLORS.textPrimary} />
          </ScalePressable>
        </View>

        <FlatList
          data={listData}
          keyExtractor={(item, idx) =>
            item.type === 'label' ? `label-${item.label}` :
            item.type === 'empty' ? 'empty' :
            `${item.type}-${item.data.id}`
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          ItemSeparatorComponent={({ leadingItem }) =>
            leadingItem?.type === 'incoming' || leadingItem?.type === 'outgoing' ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 74 }} />
            ) : null
          }
        />
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
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.3,
    },
    badge: {
      backgroundColor: '#D05050',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: '800',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: COLORS.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 6,
    },
    emptyState: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 10,
      opacity: 0.7,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    emptySubtext: {
      fontSize: 13,
      color: COLORS.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
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
    actionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
