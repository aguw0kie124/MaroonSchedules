import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  ExternalLink,
  Mail,
  Moon,
  RotateCw,
  Shield,
  Sun,
  UserRound,
  UserX,
  X,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useClerk, useUser } from '@clerk/clerk-expo';

import { SUPPORT_CONTACT_URL } from '../config';
import { requestNotificationPermissions } from '../services/notificationService';
import { useTheme } from './SharedUI';
import { useSessionStore } from '../store/sessionStore';
import { useAppShellStore } from '../store/appShellStore';
import { deleteAccount, getBlockedUsers, unblockUser } from '../services/socialFeedService';

export default function ProfileSettingsScreen({ navigation }: any) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  const {
    COLORS,
    theme,
    setTheme,
  } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const {
    notificationsEnabled,
    setNotificationsEnabled,
    eventNotifications,
    pingNotifications,
    setNotificationPreference,
    notificationLeadTime,
    setNotificationLeadTime,
  } = useAppShellStore();

  const [showBlockedPanel, setShowBlockedPanel] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const emailValue = user?.primaryEmailAddress?.emailAddress || 'No linked email';

  const openExternal = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Unable to open URL', url, error);
    }
  }, []);

  const loadBlockedUsers = useCallback(async () => {
    if (!user?.id) return;
    setLoadingBlocked(true);
    try {
      const data = await getBlockedUsers(user.id);
      setBlockedUsers(data);
    } catch (error) {
      console.warn('Failed to load blocked users', error);
    } finally {
      setLoadingBlocked(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  const handleUnblock = useCallback(async (targetId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be signed in to unblock a user.');
      return;
    }
    try {
      await unblockUser(targetId, user.id);
      setBlockedUsers((current) => current.filter((item) => item.id !== targetId));
      Alert.alert('Success', 'User unblocked.');
    } catch (error) {
      console.warn('Failed to unblock user', error);
      Alert.alert('Error', 'Failed to unblock user.');
    }
  }, [user?.id]);

  const handleLogout = useCallback(async () => {
    resetSessionMode();
    await signOut();
  }, [resetSessionMode, signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account?',
      'This will permanently delete your profile, posts, reviews, and all social data. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            try {
              await deleteAccount(user.id);
              resetSessionMode();
              await signOut();
              Alert.alert('Account Deleted', 'Your data has been permanently removed.');
            } catch (error) {
              console.warn('Failed to delete account', error);
              Alert.alert('Error', 'Failed to delete account. Please contact support.');
            }
          },
        },
      ],
    );
  }, [resetSessionMode, signOut, user?.id]);

  const handleNotificationAccessToggle = useCallback(async (value: boolean) => {
    if (!value) {
      setNotificationsEnabled(false);
      setNotificationPreference('event', false);
      setNotificationPreference('ping', false);
      return;
    }

    try {
      const granted = await requestNotificationPermissions();
      setNotificationsEnabled(granted);
      if (!granted) {
        Alert.alert('Notifications Off', 'Please enable notifications in iPhone Settings to use reminders and post alerts.');
        return;
      }
    } catch (error) {
      console.warn('Failed to request notification permissions', error);
      setNotificationsEnabled(false);
      Alert.alert('Notifications Off', 'We could not enable notifications right now.');
    }
  }, [setNotificationPreference, setNotificationsEnabled]);

  const openProfileEditor = useCallback(() => {
    navigation.navigate('Main', {
      screen: 'Profile',
      params: { openEditProfile: true },
    });
  }, [navigation]);

  const renderSettingRow = ({
    icon,
    iconColor,
    iconBg,
    title,
    subtitle,
    value,
    onPress,
    right,
    danger = false,
  }: {
    icon: React.ReactNode;
    iconColor?: string;
    iconBg: string;
    title: string;
    subtitle?: string;
    value?: string;
    onPress?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
  }) => {
    const content = (
      <>
        <View style={[styles.rowIconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {right ?? (onPress ? <ChevronRight size={18} color={COLORS.textTertiary} /> : null)}
      </>
    );

    if (onPress) {
      return (
        <Pressable style={styles.settingsRow} onPress={onPress}>
          {content}
        </Pressable>
      );
    }

    return <View style={styles.settingsRow}>{content}</View>;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerButton} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionGroup}>
          <Text style={styles.groupLabel}>Account</Text>
          <View style={styles.sectionCard}>
            {renderSettingRow({
              icon: <UserRound size={18} color={COLORS.primary} />,
              iconBg: `${COLORS.primary}15`,
              title: 'Edit profile',
              onPress: openProfileEditor,
            })}
            <View style={styles.rowDivider} />
            {renderSettingRow({
              icon: <Mail size={18} color="#059669" />,
              iconBg: '#05966915',
              title: 'Linked account',
              value: emailValue,
            })}
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.groupLabel}>App</Text>
          <View style={styles.sectionCard}>
            {renderSettingRow({
              icon: theme === 'dark'
                ? <Moon size={18} color={COLORS.primary} />
                : <Sun size={18} color={COLORS.primary} />,
              iconBg: `${COLORS.primary}15`,
              title: 'Theme',
              right: (
                <View style={styles.themeToggleWrap}>
                  <Text style={styles.themeToggleLabel}>{theme === 'dark' ? 'Dark' : 'Light'}</Text>
                  <View style={{ transform: [{ scale: 0.82 }] }}>
                    <Switch
                      value={theme === 'dark'}
                      onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#FFF"
                    />
                  </View>
                </View>
              ),
            })}

            <View style={styles.rowDivider} />

            {renderSettingRow({
              icon: <RotateCw size={18} color="#2563EB" />,
              iconBg: '#2563EB15',
              title: 'Retake preferences survey',
              subtitle: 'Refresh your event, academic, and campus preferences.',
              onPress: () => {
                useAppShellStore.setState({
                  showNameOnboarding: false,
                  isEventPreferencesCompleted: false,
                  showEventPreferencesOnboarding: true,
                });
                navigation.goBack();
              },
            })}
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.groupLabel}>Notifications</Text>
          <View style={styles.sectionCard}>
            {renderSettingRow({
              icon: <Bell size={18} color="#F59E0B" />,
              iconBg: '#F59E0B15',
              title: 'Allow notifications',
              subtitle: 'Required for event reminders and post interaction alerts.',
              right: (
                <View style={{ transform: [{ scale: 0.82 }] }}>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleNotificationAccessToggle}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              ),
            })}
            <View style={styles.rowDivider} />
            {renderSettingRow({
              icon: <Bell size={18} color="#F59E0B" />,
              iconBg: '#F59E0B15',
              title: 'Event reminders',
              subtitle: 'Get notified before saved campus events start.',
              right: (
                <View style={{ transform: [{ scale: 0.82 }], opacity: notificationsEnabled ? 1 : 0.45 }}>
                  <Switch
                    value={notificationsEnabled && eventNotifications}
                    onValueChange={(value) => {
                      if (!notificationsEnabled) return;
                      setNotificationPreference('event', value);
                    }}
                    disabled={!notificationsEnabled}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              ),
            })}
            <View style={styles.rowDivider} />
            {renderSettingRow({
              icon: <Bell size={18} color="#2F80ED" />,
              iconBg: '#2F80ED15',
              title: 'Post interactions',
              subtitle: 'Get updates on comments and activity for your pings.',
              right: (
                <View style={{ transform: [{ scale: 0.82 }], opacity: notificationsEnabled ? 1 : 0.45 }}>
                  <Switch
                    value={notificationsEnabled && pingNotifications}
                    onValueChange={(value) => {
                      if (!notificationsEnabled) return;
                      setNotificationPreference('ping', value);
                    }}
                    disabled={!notificationsEnabled}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              ),
            })}

            <View style={[styles.leadTimeBlock, !notificationsEnabled && styles.disabledBlock]}>
              <Text style={styles.inlineLabel}>Lead Time</Text>
              <View style={styles.leadTimeRow}>
                {[5, 10, 15, 30, 60].map((opt) => {
                  const selected = notificationLeadTime === opt;
                  const label = opt === 60 ? '1h' : `${opt}m`;
                  return (
                    <Pressable
                      key={opt}
                      disabled={!notificationsEnabled}
                      onPress={() => setNotificationLeadTime(opt)}
                      style={[styles.leadTimeButton, selected && styles.leadTimeButtonSelected]}
                    >
                      <Text style={[styles.leadTimeText, selected && styles.leadTimeTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.groupLabel}>Privacy</Text>
          <View style={styles.sectionCard}>
            {renderSettingRow({
              icon: <Shield size={18} color="#EF4444" />,
              iconBg: '#EF444415',
              title: 'Blocked users',
              subtitle: 'Manage people you have blocked.',
              value: blockedUsers.length ? String(blockedUsers.length) : '0',
              onPress: () => setShowBlockedPanel(true),
            })}
            <View style={styles.rowDivider} />
            {renderSettingRow({
              icon: <Shield size={18} color="#7C3AED" />,
              iconBg: '#7C3AED15',
              title: 'Privacy policy',
              subtitle: 'How your data is handled in MaroonLife.',
              onPress: () => openExternal('https://www.termsfeed.com/live/4889a318-ae78-48e2-975d-2eddfe043866'),
              right: <ExternalLink size={16} color={COLORS.textTertiary} />,
            })}
            <View style={styles.rowDivider} />
            {renderSettingRow({
              icon: <Shield size={18} color="#475569" />,
              iconBg: '#47556915',
              title: 'Terms of service',
              subtitle: 'Review the terms that apply to your account.',
              onPress: () => openExternal('https://www.termsfeed.com/live/2fc33440-a5a9-4943-a1da-d3c5d5abc1e5'),
              right: <ExternalLink size={16} color={COLORS.textTertiary} />,
            })}
          </View>
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Pressable onPress={handleDeleteAccount} style={styles.deleteButton}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showBlockedPanel}
        animationType="fade"
        transparent
        onRequestClose={() => setShowBlockedPanel(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowBlockedPanel(false)}>
          <Pressable style={styles.savedModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.savedModalHeader}>
              <Text style={styles.savedModalTitle}>Blocked Users</Text>
              <Pressable onPress={() => setShowBlockedPanel(false)}>
                <X size={20} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.blockedModalBody}>
              {loadingBlocked ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
              ) : blockedUsers.length > 0 ? (
                blockedUsers.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <View style={styles.rowDivider} /> : null}
                    <View style={styles.blockedRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.name?.[0] || 'U'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.blockedName}>{item.name}</Text>
                        {item.major ? <Text style={styles.blockedMeta}>{item.major}</Text> : null}
                      </View>
                      <Pressable style={styles.unblockButton} onPress={() => handleUnblock(item.id)}>
                        <UserX size={16} color={COLORS.danger || '#EF4444'} />
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No blocked users</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 18,
    paddingBottom: 56,
  },
  sectionGroup: {
    gap: 6,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginLeft: 2,
  },
  sectionCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0,
    gap: 0,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  settingsRowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },
  rowTitleDanger: {
    color: COLORS.danger || '#EF4444',
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textTertiary,
  },
  rowValue: {
    maxWidth: 120,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  toolIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  inlineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textTertiary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  themeToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  leadTimeBlock: {
    marginTop: 0,
    marginLeft: 50,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  disabledBlock: {
    opacity: 0.45,
  },
  leadTimeRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  leadTimeButton: {
    height: 26,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  leadTimeButtonSelected: {
    borderBottomColor: COLORS.textPrimary,
  },
  leadTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textTertiary,
  },
  leadTimeTextSelected: {
    color: COLORS.textPrimary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  linkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  blockedModalBody: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
  },
  blockedPanel: {
    paddingTop: 12,
    gap: 12,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  blockedName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  blockedMeta: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  unblockButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  },
  emptyText: {
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  logoutButton: {
    paddingTop: 6,
    paddingBottom: 2,
    alignItems: 'flex-start',
  },
  logoutText: {
    color: isDark ? 'rgba(248,113,113,0.86)' : '#B45353',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButton: {
    paddingTop: 0,
    paddingBottom: 16,
    alignItems: 'flex-start',
  },
  deleteText: {
    color: COLORS.danger || '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  savedModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  savedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  savedModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  savedModalBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
});
