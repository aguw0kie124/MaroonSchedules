import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { Search, ShieldCheck, UserRoundPlus } from 'lucide-react-native';

import { requestJson } from '../../api/client';
import { Button } from '../Button';
import { useTheme } from '../SharedUI';
import { TagSelector } from './TagSelector';
import { TagChips } from '../common/TagChips';

interface ClubSettings {
  clerk_id: string;
  organization_name: string;
  club_tag?: string | null;
  auto_approve_join_requests: boolean;
}

interface ClubJoinRequest {
  id: string;
  requester_clerk_id: string;
  requester_name?: string | null;
  requester_email?: string | null;
  club_tag?: string | null;
  status: string;
  requested_at?: string | null;
}

interface ManagedUser {
  clerk_id: string;
  email?: string | null;
  full_name?: string | null;
  profile_image_url?: string | null;
  is_admin?: boolean;
  tags: string[];
}

export function AdminTagManagementScreen() {
  const { COLORS } = useTheme();
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [clubSettings, setClubSettings] = useState<ClubSettings | null>(null);
  const [clubTagDraft, setClubTagDraft] = useState<string[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [savingClubSettings, setSavingClubSettings] = useState(false);
  const [joinRequests, setJoinRequests] = useState<ClubJoinRequest[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [savingUserTags, setSavingUserTags] = useState(false);

  const loadTagLibrary = useCallback(async () => {
    if (!user?.id) return;
    const data = await requestJson(`/admin/tags?clerk_id=${encodeURIComponent(user.id)}`, {}, 15000);
    setAvailableTags(data.tags || []);
  }, [user?.id]);

  const loadClubSettings = useCallback(async () => {
    if (!user?.id) return;
    const data = await requestJson(`/admin/club/settings?clerk_id=${encodeURIComponent(user.id)}`, {}, 15000);
    setClubSettings(data);
    setClubTagDraft(data.club_tag ? [data.club_tag] : []);
    setAutoApprove(!!data.auto_approve_join_requests);
  }, [user?.id]);

  const loadJoinRequests = useCallback(async () => {
    if (!user?.id) return;
    const data = await requestJson(`/admin/club-join-requests?clerk_id=${encodeURIComponent(user.id)}&status=pending`, {}, 15000);
    setJoinRequests(Array.isArray(data) ? data : []);
  }, [user?.id]);

  const loadUsers = useCallback(async (query?: string) => {
    if (!user?.id) return;
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({
        clerk_id: user.id,
        limit: '25',
      });
      if (query && query.trim()) {
        params.set('query', query.trim());
      }
      const data = await requestJson(`/admin/users?${params.toString()}`, {}, 15000);
      setUsers(Array.isArray(data) ? data : []);
    } finally {
      setLoadingUsers(false);
    }
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      await Promise.all([
        loadTagLibrary(),
        loadClubSettings(),
        loadJoinRequests(),
        loadUsers(),
      ]);
    } catch (error) {
      console.warn(error);
      Alert.alert('Could not load access tools', 'Please try again in a moment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadClubSettings, loadJoinRequests, loadTagLibrary, loadUsers, user?.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
  };

  const handleSearchSubmit = () => {
    loadUsers(userQuery).catch((error) => {
      console.warn(error);
      Alert.alert('Search failed', 'We could not load matching users.');
    });
  };

  const handleSaveClubSettings = async () => {
    if (!user?.id) return;
    setSavingClubSettings(true);
    try {
      const response = await requestJson('/admin/club/settings', {
        method: 'PUT',
        body: JSON.stringify({
          clerk_id: user.id,
          club_tag: clubTagDraft[0] || null,
          auto_approve_join_requests: autoApprove,
        }),
      }, 15000);
      setClubSettings(response);
      setClubTagDraft(response.club_tag ? [response.club_tag] : []);
      await Promise.all([loadTagLibrary(), loadJoinRequests()]);
      Alert.alert('Club settings saved', 'Your club tag and join workflow are updated.');
    } catch (error) {
      console.warn(error);
      Alert.alert('Save failed', 'We could not update your club settings.');
    } finally {
      setSavingClubSettings(false);
    }
  };

  const handleJoinReview = async (requestId: string, approve: boolean) => {
    if (!user?.id) return;
    try {
      await requestJson(`/admin/club-join-requests/${requestId}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: JSON.stringify({
          clerk_id: user.id,
          assign_club_tag: approve,
        }),
      }, 15000);
      setJoinRequests((current) => current.filter((request) => request.id !== requestId));
      if (approve) {
        await loadUsers(userQuery);
      }
    } catch (error) {
      console.warn(error);
      Alert.alert('Update failed', 'We could not update that join request.');
    }
  };

  const openUserEditor = (managedUser: ManagedUser) => {
    setEditingUser(managedUser);
    setEditingTags(managedUser.tags || []);
  };

  const closeUserEditor = () => {
    setEditingUser(null);
    setEditingTags([]);
    setSavingUserTags(false);
  };

  const handleSaveUserTags = async () => {
    if (!user?.id || !editingUser) return;
    setSavingUserTags(true);
    try {
      const updated = await requestJson(`/admin/users/${encodeURIComponent(editingUser.clerk_id)}/tags`, {
        method: 'PUT',
        body: JSON.stringify({
          clerk_id: user.id,
          tags: editingTags,
        }),
      }, 15000);
      setUsers((current) =>
        current.map((item) =>
          item.clerk_id === editingUser.clerk_id
            ? { ...item, tags: updated.tags || editingTags }
            : item,
        ),
      );
      await loadTagLibrary();
      closeUserEditor();
      Alert.alert('Tags updated', 'The user access tags were saved.');
    } catch (error) {
      console.warn(error);
      Alert.alert('Save failed', 'We could not update that user.');
      setSavingUserTags(false);
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
    sectionCard: {
      borderRadius: 20,
      padding: 18,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 14,
    },
    sectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    sectionText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    switchCopy: {
      flex: 1,
      gap: 4,
    },
    switchTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    switchMeta: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    requestCard: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    requestName: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    requestMeta: {
      color: COLORS.textSecondary,
      fontSize: 13,
    },
    requestActions: {
      flexDirection: 'row',
      gap: 10,
    },
    searchShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: COLORS.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 15,
      paddingVertical: 13,
    },
    userCard: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    userHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    userTitleWrap: {
      flex: 1,
      gap: 4,
    },
    userName: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    userMeta: {
      color: COLORS.textSecondary,
      fontSize: 13,
    },
    adminBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: COLORS.primary + '12',
      borderWidth: 1,
      borderColor: COLORS.primary + '22',
    },
    adminBadgeText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    emptyState: {
      color: COLORS.textSecondary,
      fontSize: 14,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.42)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
      maxHeight: '86%',
      gap: 14,
    },
    modalTitle: {
      color: COLORS.textPrimary,
      fontSize: 22,
      fontWeight: '800',
    },
    modalSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
  });

  if (loading && !clubSettings) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Admin Portal</Text>
          <Text style={styles.title}>Manage Access</Text>
          <Text style={styles.subtitle}>
            Set your club tag, approve member requests, and manually adjust user access tags for targeted event visibility.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Club Tag</Text>
          <Text style={styles.sectionText}>
            Members who join your organization can inherit this tag. You can also auto-approve requests for instant access.
          </Text>
          <TagSelector
            label="Default club tag"
            helperText="Reuse an existing tag or create a new one. Only one default club tag is applied automatically."
            selectedTags={clubTagDraft}
            availableTags={availableTags}
            placeholder="e.g. Engineering Honors"
            onChange={(tags) => setClubTagDraft(tags.slice(-1))}
          />
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>Auto-approve join requests</Text>
              <Text style={styles.switchMeta}>
                When enabled, students receive your club tag as soon as they request access.
              </Text>
            </View>
            <Switch
              value={autoApprove}
              onValueChange={setAutoApprove}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '66' }}
              thumbColor={autoApprove ? COLORS.primary : '#FFFFFF'}
            />
          </View>
          <Button onPress={handleSaveClubSettings} disabled={savingClubSettings}>
            {savingClubSettings ? 'Saving...' : 'Save Club Settings'}
          </Button>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pending Club Requests</Text>
          {joinRequests.length ? (
            joinRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View>
                  <Text style={styles.requestName}>{request.requester_name || request.requester_clerk_id}</Text>
                  <Text style={styles.requestMeta}>{request.requester_email || request.requester_clerk_id}</Text>
                  <Text style={styles.requestMeta}>
                    Requested {request.requested_at ? new Date(request.requested_at).toLocaleString() : 'recently'}
                  </Text>
                </View>
                <TagChips tags={request.club_tag ? [request.club_tag] : []} label="Club tag" />
                <View style={styles.requestActions}>
                  <Button variant="secondary" onPress={() => handleJoinReview(request.id, false)}>
                    Reject
                  </Button>
                  <Button onPress={() => handleJoinReview(request.id, true)}>Approve</Button>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyState}>No pending requests right now.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>User Tag Management</Text>
          <Text style={styles.sectionText}>
            Search by name, email, or Clerk ID. Manual changes take effect across campus event feeds immediately.
          </Text>
          <View style={styles.searchShell}>
            <Search size={16} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={userQuery}
              onChangeText={setUserQuery}
              placeholder="Search users"
              placeholderTextColor={COLORS.textTertiary}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>
          <Button variant="secondary" onPress={handleSearchSubmit}>
            {loadingUsers ? 'Searching...' : 'Search Users'}
          </Button>

          {users.length ? (
            users.map((managedUser) => (
              <View key={managedUser.clerk_id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userTitleWrap}>
                    <Text style={styles.userName}>{managedUser.full_name || managedUser.email || managedUser.clerk_id}</Text>
                    <Text style={styles.userMeta}>{managedUser.email || managedUser.clerk_id}</Text>
                  </View>
                  <Button variant="secondary" onPress={() => openUserEditor(managedUser)}>
                    Edit Tags
                  </Button>
                </View>
                {managedUser.is_admin ? (
                  <View style={styles.adminBadge}>
                    <ShieldCheck size={14} color={COLORS.primary} />
                    <Text style={styles.adminBadgeText}>Bypass access filter</Text>
                  </View>
                ) : null}
                <TagChips tags={managedUser.tags} label="User tags" />
              </View>
            ))
          ) : (
            <Text style={styles.emptyState}>No users matched that search yet.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={!!editingUser} transparent animationType="slide" onRequestClose={closeUserEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit User Tags</Text>
            <Text style={styles.modalSubtitle}>
              Update the access tags for {editingUser?.full_name || editingUser?.email || editingUser?.clerk_id}.
            </Text>
            <TagSelector
              label="User tags"
              helperText="These tags control which tagged events this user can see. Admin users bypass the restriction."
              selectedTags={editingTags}
              availableTags={availableTags}
              placeholder="Add access tag"
              onChange={setEditingTags}
            />
            <View style={{ gap: 12 }}>
              <Button onPress={handleSaveUserTags} disabled={savingUserTags}>
                {savingUserTags ? 'Saving...' : 'Save User Tags'}
              </Button>
              <Button variant="secondary" onPress={closeUserEditor}>
                Cancel
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
