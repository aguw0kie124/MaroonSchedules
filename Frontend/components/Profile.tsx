import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  BriefcaseBusiness,
  Building2,
  Camera,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  Flame,
  GraduationCap,
  LayoutGrid,
  LibraryBig,
  LogIn,
  LogOut,
  Palette,
  Search,
  Settings2,
  Trophy,
  UserRound,
  Wallet,
  Compass,
  Sparkles,
  Trash2,
  Shield,
  Scale,
  UserX,
  Bell,
  LifeBuoy,
  CalendarDays,
} from 'lucide-react-native';
import { useClerk, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';

import { fetchCampusOverview, fetchUserProfile } from '../api/client';
import { SUPPORT_CONTACT_URL } from '../config';
import { PARKING_PERMIT_OPTIONS, useAppShellStore } from '../store/appShellStore';
import { useSessionStore } from '../store/sessionStore';
import { deleteAccount, getBlockedUsers, unblockUser } from '../services/socialFeedService';
import { useTour, TourTarget } from './onboarding/TourProvider';
import { PillTabs } from './PillTabs';
import { getDefaultAccentColor, useTheme } from './SharedUI';

import { TagChips } from './common/TagChips';


const SETTINGS_TABS = [
  { key: 'personal', label: 'Personal', icon: UserRound },
  { key: 'layout', label: 'Layout', icon: LayoutGrid },
  { key: 'resources', label: 'Resources', icon: LibraryBig },
] as const;

type SettingsTabKey = typeof SETTINGS_TABS[number]['key'];

function channelToHex(channel: number) {
  return channel.toString(16).padStart(2, '0');
}

function hexToRgb(color: string) {
  const normalized = color.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

const ACCENT_SPECTRUM_STOPS = [
  { ratio: 0, color: '#FFFFFF' },
  { ratio: 0.12, color: '#FF5A5F' },
  { ratio: 0.28, color: '#FFB300' },
  { ratio: 0.44, color: '#34C759' },
  { ratio: 0.6, color: '#00C7BE' },
  { ratio: 0.74, color: '#0A84FF' },
  { ratio: 0.88, color: '#BF5AF2' },
  { ratio: 1, color: '#000000' },
] as const;

function getSpectrumColorFromRatio(ratio: number) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const upperIndex = ACCENT_SPECTRUM_STOPS.findIndex((stop) => clamped <= stop.ratio);
  if (upperIndex <= 0) {
    return ACCENT_SPECTRUM_STOPS[0].color;
  }
  if (upperIndex === -1) {
    return ACCENT_SPECTRUM_STOPS[ACCENT_SPECTRUM_STOPS.length - 1].color;
  }
  const left = ACCENT_SPECTRUM_STOPS[upperIndex - 1];
  const right = ACCENT_SPECTRUM_STOPS[upperIndex];
  const span = right.ratio - left.ratio || 1;
  const progress = (clamped - left.ratio) / span;
  const leftRgb = hexToRgb(left.color);
  const rightRgb = hexToRgb(right.color);
  return rgbToHex(
    Math.round(leftRgb.r + (rightRgb.r - leftRgb.r) * progress),
    Math.round(leftRgb.g + (rightRgb.g - leftRgb.g) * progress),
    Math.round(leftRgb.b + (rightRgb.b - leftRgb.b) * progress),
  );
}

function getRatioFromColor(color: string) {
  const normalized = color.startsWith('#') ? color.toUpperCase() : `#${color.toUpperCase()}`;
  let closestRatio = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= 100; index += 1) {
    const ratio = index / 100;
    const candidate = hexToRgb(getSpectrumColorFromRatio(ratio));
    const target = hexToRgb(normalized);
    const distance =
      Math.abs(candidate.r - target.r) +
      Math.abs(candidate.g - target.g) +
      Math.abs(candidate.b - target.b);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestRatio = ratio;
    }
  }
  return closestRatio;
}

export function Profile() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { user } = useUser();
  const { signOut } = useClerk();
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  const isGuest = useSessionStore((state) => state.isGuest);
  const {
    COLORS,
    theme,
    setTheme,
    useWallpaper,
    wallpaperUri,
    setBackgroundMode,
    setCustomWallpaper,
    accentColor,
    setAccentColor,
    applyAccentToText,
    setApplyAccentToText,
  } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark, accentColor);
  const { startTour, advanceStep, activeTargetName } = useTour();

  const [academicStatus, setAcademicStatus] = useState<any | null>(null);
  const [loadingAcademicStatus, setLoadingAcademicStatus] = useState(true);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [accentSliderWidth, setAccentSliderWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const activeTab = useAppShellStore((state) => state.settingsTab) as SettingsTabKey;
  const setActiveTab = useAppShellStore((state) => state.setSettingsTab);
  const tabBarMode = useAppShellStore((state) => state.tabBarMode);
  const setTabBarMode = useAppShellStore((state) => state.setTabBarMode);
  const eventNotifications = useAppShellStore((state) => state.eventNotifications);
  const placeNotifications = useAppShellStore((state) => state.placeNotifications);
  const pingNotifications = useAppShellStore((state) => state.pingNotifications);
  const notificationLeadTime = useAppShellStore((state) => state.notificationLeadTime);
  const setNotificationPreference = useAppShellStore((state) => state.setNotificationPreference);
  const setNotificationLeadTime = useAppShellStore((state) => state.setNotificationLeadTime);
  const notificationsEnabled = useAppShellStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useAppShellStore((state) => state.setNotificationsEnabled);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [showBlockedPanel, setShowBlockedPanel] = useState(false);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const finishCardYRef = React.useRef(0);

  const wallpaperSource = wallpaperUri ? { uri: wallpaperUri } : undefined;
  const accentRatio = useMemo(() => getRatioFromColor(accentColor), [accentColor]);
  const accentPreviewColor = useMemo(() => getSpectrumColorFromRatio(accentRatio), [accentRatio]);
  const updateAccentFromPosition = React.useCallback((locationX: number) => {
    if (!accentSliderWidth) return;
    const clamped = Math.min(Math.max(locationX, 0), accentSliderWidth);
    setAccentColor(getSpectrumColorFromRatio(clamped / accentSliderWidth));
  }, [accentSliderWidth, setAccentColor]);

  const accentPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateAccentFromPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateAccentFromPosition(event.nativeEvent.locationX),
      }),
    [updateAccentFromPosition],
  );

  const scrollToFinishCard = React.useCallback((animated = true) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      y: Math.max(0, finishCardYRef.current - 140),
      animated,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user || !isFocused) return;

    setLoadingAcademicStatus(true);
    fetchCampusOverview(user.id)
      .then((data) => {
        if (!cancelled) {
          setAcademicStatus(data?.academic || null);
        }
      })
      .catch((error) => console.warn('Failed to load academic status:', error))
      .finally(() => {
        if (!cancelled) {
          setLoadingAcademicStatus(false);
        }
      });

    fetchUserProfile(user.id)
      .then((data) => {
        if (!cancelled) {
          setProfileTags(Array.isArray(data?.tags) ? data.tags : []);
        }
      })
      .catch((error) => console.warn('Failed to load profile tags:', error));

    return () => {
      cancelled = true;
    };
  }, [isFocused, isGuest, user]);

  useEffect(() => {
    if (activeTab === 'personal' && user) {
        loadBlockedUsers();
    }
  }, [activeTab, isGuest, user]);

  useEffect(() => {
    if ((activeTargetName === 'tour-finish' || activeTargetName === 'settings-tab') && activeTab !== 'personal') {
      setActiveTab('personal');
    }
  }, [activeTab, activeTargetName, setActiveTab]);

  useEffect(() => {
    if (activeTargetName !== 'tour-finish' || activeTab !== 'personal') {
      return;
    }
    const timer = setTimeout(() => {
      scrollToFinishCard();
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTab, activeTargetName, scrollToFinishCard]);

  const loadBlockedUsers = async () => {
    if (!user) return;
    setLoadingBlocked(true);
    try {
        const data = await getBlockedUsers(user.id);
        setBlockedUsers(data);
    } catch (err) {
        if (__DEV__) {
          console.warn('Failed to load blocked users', err);
        }
    } finally {
        setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (targetId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be signed in to unblock a user.');
      return;
    }
    try {
        await unblockUser(targetId, user.id);
        setBlockedUsers((current) => current.filter((item) => item.id !== targetId));
        await loadBlockedUsers();
        Alert.alert('Success', 'User unblocked.');
    } catch (err) {
        console.warn('Failed to unblock user', err);
        Alert.alert('Error', 'Failed to unblock user.');
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const data = await fetchCampusOverview(user.id);
      setAcademicStatus(data?.academic || null);
      const profile = await fetchUserProfile(user.id);
      setProfileTags(Array.isArray(profile?.tags) ? profile.tags : []);
      if (activeTab === 'personal') {
        await loadBlockedUsers();
      }
    } catch (error) {
      console.warn('Failed to refresh settings:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permission is required to update your photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0 && user) {
      const asset = result.assets[0];
      try {
        const base64Data = asset.base64;
        const mimeType = asset.mimeType || 'image/jpeg';

        if (base64Data) {
          await user.setProfileImage({
            file: `data:${mimeType};base64,${base64Data}`,
          });
        } else if (asset.uri) {
          await user.setProfileImage({ file: asset.uri });
        }
        Alert.alert('Updated', 'Your profile photo has been updated.');
      } catch (error) {
        console.warn('Failed to upload image:', error);
        Alert.alert('Error', 'Unable to update your profile photo.');
      }
    }
  };

  const handleWallpaperPick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permission is required to set a wallpaper.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setUploadingWallpaper(true);
      try {
        await setCustomWallpaper(result.assets[0].uri);
        setBackgroundMode('custom');
      } catch (error) {
        console.warn('Failed to set wallpaper:', error);
        Alert.alert('Error', 'Unable to save this wallpaper.');
      } finally {
        setUploadingWallpaper(false);
      }
    }
  };

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Unable to open URL', url, error);
    }
  };

  const handleLogout = async () => {
    resetSessionMode();
    await signOut();
  };

  const handleLogin = async () => {
    resetSessionMode();
    await signOut();
  };



  const openGuestRecCapacity = () => {
    const rootNav =
      navigation.getParent?.('RootStack') || navigation.getParent?.() || navigation;
    rootNav.navigate('Main', {
      screen: 'Places',
      params: {
        initialLayer: 'Rec',
        focusToken: 'guest-rec',
      },
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This will permanently delete your profile, posts, reviews, and all social data. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Everything', 
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await deleteAccount(user.id);
              resetSessionMode();
              await signOut();
              Alert.alert('Account Deleted', 'Your data has been permanently removed.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete account. Please contact support.');
            }
          }
        },
      ]
    );
  };

  const renderPersonalTab = () => (
    <>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Personal</Text>
          </View>
          <View style={styles.heroBadge}>
            <UserRound size={18} color={COLORS.textPrimary} />
          </View>
        </View>

        <View style={styles.profileCard}>
          <Pressable onPress={handleAvatarPress} style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{user?.firstName?.[0] || 'U'}</Text>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Camera size={14} color={COLORS.textPrimary} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.fullName || 'Aggie User'}</Text>
            <Text style={styles.email}>
              {user?.primaryEmailAddress?.emailAddress || 'user@tamu.edu'}
            </Text>
          </View>
        </View>
        <TagChips tags={profileTags} label="Your access tags" />
      </View>


      {activeTargetName === 'tour-finish' && (
        <LinearGradient
          colors={[COLORS.primary, '#9B2C2C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          onLayout={(event) => {
            finishCardYRef.current = event.nativeEvent.layout.y;
            if (activeTargetName === 'tour-finish') {
              setTimeout(() => {
                scrollToFinishCard();
              }, 0);
            }
          }}
          style={{ 
            marginTop: 24, 
            padding: 24, 
            borderRadius: 32, 
            elevation: 12,
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={28} color="#FFF" />
            </View>
            <View>
              <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>You're all set!</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>Onboarding Complete</Text>
            </View>
          </View>
          
          <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 15, lineHeight: 22, marginBottom: 28, fontWeight: '500' }}>
            Welcome to MaroonLife. Your personalized campus experience is ready for you to explore.
          </Text>

          <TourTarget name="tour-finish" assistAction={() => advanceStep('tour-finish')}>
            <Pressable 
              style={({ pressed }) => ({ 
                backgroundColor: '#FFF', 
                padding: 18, 
                borderRadius: 18, 
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }]
              })}
              onPress={() => advanceStep('tour-finish')}
            >
              <Text style={{ color: COLORS.primary, fontWeight: '900', fontSize: 17, letterSpacing: -0.2 }}>Launch MaroonLife</Text>
              <ChevronRight size={20} color={COLORS.primary} strokeWidth={3} />
            </Pressable>
          </TourTarget>
        </LinearGradient>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Academics</Text>

        <Pressable style={styles.toolRow} onPress={() => navigation.navigate('GradesScreen')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <GraduationCap size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Grades & Distributions</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable style={[styles.toolRow, styles.toolRowLast]} onPress={() => navigation.navigate('ScheduleList')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
            <Settings2 size={20} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Manage Academic Schedules</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>

        
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Life & Safety</Text>
        <Pressable style={[styles.toolRow, styles.toolRowLast]} onPress={() => navigation.navigate('ClubAccess')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(52, 211, 153, 0.12)' }]}>
            <CalendarDays size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Club Access</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Notifications</Text>
        {renderNotificationsTab(true, false)}
        {renderBlockedTab(true, true)}
      </View>


      <View style={styles.quickActionRow}>
        <Pressable
          style={[styles.quickActionCard, { borderColor: COLORS.primary }]}
          onPress={() => startTour()}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: COLORS.primary + '15' }]}>
            <Compass size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.quickActionTitle}>Restart Tour</Text>
        </Pressable>

        <Pressable
          style={[styles.quickActionCard, { borderColor: '#2F80ED' }]}
          onPress={() => {
            useAppShellStore.setState({
              isEventPreferencesCompleted: false,
              showEventPreferencesOnboarding: true,
            });
          }}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(47, 128, 237, 0.12)' }]}>
            <Sparkles size={18} color="#2F80ED" />
          </View>
          <Text style={styles.quickActionTitle}>Redo Questions</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={18} color={COLORS.textPrimary} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <Pressable 
        style={[styles.logoutButton, { backgroundColor: isDark ? '#441111' : '#FFF0F0', marginTop: 8, borderColor: isDark ? '#772222' : '#FFCCCC', borderWidth: 1 }]} 
        onPress={handleDeleteAccount}
      >
        <Trash2 size={18} color={isDark ? '#E56B6B' : '#CC0000'} />
        <Text style={[styles.logoutText, { color: isDark ? '#E56B6B' : '#CC0000' }]}>Delete Account</Text>
      </Pressable>
    </>
  );

  const renderLayoutTab = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tab Bar Style</Text>
        <Text style={styles.sectionSubtitle}>Choose your navigation look.</Text>
        <View style={styles.segmentedRow}>
          {[
            { id: 'floating', label: 'Floating' },
            { id: 'solid', label: 'Main' },
          ].map((option) => {
            const selected = tabBarMode === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.segmentButton, styles.segmentButtonStretch, selected && styles.segmentButtonActive]}
                onPress={() => setTabBarMode(option.id as 'floating' | 'solid')}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>

        <View style={styles.preferenceBlock}>
          <Text style={styles.preferenceLabel}>Theme</Text>
          <View style={styles.segmentedRow}>
            {['light', 'dark'].map((mode) => {
              const selected = theme === mode;
              return (
                <Pressable
                  key={mode}
                  style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                  onPress={() => setTheme(mode)}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                    {mode === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.preferenceBlock}>
          <Text style={styles.preferenceLabel}>Background</Text>
          <View style={styles.segmentedRow}>
            <Pressable
              style={[styles.segmentButton, !useWallpaper && styles.segmentButtonActive]}
              onPress={() => setBackgroundMode('solid')}
            >
              <Text style={[styles.segmentText, !useWallpaper && styles.segmentTextActive]}>Solid</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentButton, useWallpaper && styles.segmentButtonActive]}
              onPress={() => (wallpaperUri ? setBackgroundMode('custom') : handleWallpaperPick())}
            >
              <Text style={[styles.segmentText, useWallpaper && styles.segmentTextActive]}>Wallpaper</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.preferenceBlock}>
          <Text style={styles.preferenceLabel}>Accent Color</Text>
          <View style={styles.accentSliderCard}>
            <View style={styles.accentSliderHeader}>
              <View style={[styles.accentPreview, { backgroundColor: accentPreviewColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inlineSwitchTitle}>Accent Spectrum</Text>
              </View>
            </View>

            <View
              style={styles.accentSliderTrack}
              onLayout={(event) => setAccentSliderWidth(event.nativeEvent.layout.width)}
              {...accentPanResponder.panHandlers}
            >
              <View style={styles.accentSliderGradient}>
                {Array.from({ length: 24 }).map((_, index) => {
                  const ratio = index / 23;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.accentSliderSegment,
                        { backgroundColor: getSpectrumColorFromRatio(ratio) },
                      ]}
                    />
                  );
                })}
              </View>
              {accentSliderWidth ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.accentSliderThumb,
                    { left: Math.max(0, Math.min(accentSliderWidth - 26, accentRatio * accentSliderWidth - 13)) },
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.accentScaleRow}>
              <Text style={styles.accentScaleLabel}>Light</Text>
              <Pressable
                style={styles.accentResetButton}
                onPress={() => setAccentColor(getDefaultAccentColor(theme))}
              >
                <Text style={styles.accentResetText}>Use Theme Default</Text>
              </Pressable>
              <Text style={styles.accentScaleLabel}>Dark</Text>
            </View>
          </View>
          <View style={styles.inlineSwitchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inlineSwitchTitle}>Apply accent to accent text</Text>
            </View>
            <Switch
              value={applyAccentToText}
              onValueChange={setApplyAccentToText}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.wallpaperCard}>
          {wallpaperUri ? (
            <Image source={{ uri: wallpaperUri }} style={styles.wallpaperPreview} />
          ) : (
            <View style={styles.wallpaperPlaceholder}>
              <Palette size={22} color={COLORS.textTertiary} />
              <Text style={styles.wallpaperPlaceholderText}>No custom wallpaper selected</Text>
            </View>
          )}

          <View style={styles.wallpaperActions}>
            <Pressable style={styles.wallpaperButton} onPress={handleWallpaperPick}>
              <Text style={styles.wallpaperButtonText}>
                {uploadingWallpaper ? 'Uploading...' : wallpaperUri ? 'Replace' : 'Choose Image'}
              </Text>
            </Pressable>
            {wallpaperUri ? (
              <Pressable
                style={[styles.wallpaperButton, styles.wallpaperSecondaryButton]}
                onPress={() => setCustomWallpaper(null)}
              >
                <Text style={[styles.wallpaperButtonText, styles.wallpaperSecondaryButtonText]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </>
  );

  const renderNotificationsTab = (embedded = false, isLast = false) => {
    const content = (
      <>
      <Pressable
        style={[styles.toolRow, (showNotificationsPanel || isLast) && styles.toolRowLast]}
        onPress={() => setShowNotificationsPanel((current) => !current)}
      >
        <View style={[styles.toolIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Bell size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toolTitle}>Notifications</Text>
        </View>
        <ChevronRight
          size={20}
          color={COLORS.textTertiary}
          style={{ transform: [{ rotate: showNotificationsPanel ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {showNotificationsPanel ? (
        <>
          <View style={styles.inlinePanel}>
            <View style={styles.inlineSwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inlineSwitchTitle}>Event Reminders</Text>
              </View>
              <Switch
                value={eventNotifications}
                onValueChange={(v) => setNotificationPreference('event', v)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.inlineSwitchRow, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inlineSwitchTitle}>Transit Alerts</Text>
              </View>
              <Switch
                value={placeNotifications}
                onValueChange={(v) => setNotificationPreference('place', v)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.inlineSwitchRow, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inlineSwitchTitle}>Social Pings</Text>
              </View>
              <Switch
                value={pingNotifications}
                onValueChange={(v) => setNotificationPreference('ping', v)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={[styles.preferenceLabel, { marginTop: 24, marginBottom: 12, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }]}>
            Alert Lead Time
          </Text>
          <View style={styles.segmentedRow}>
            {[
              { id: 5, label: '5m' },
              { id: 10, label: '10m' },
              { id: 15, label: '15m' },
              { id: 30, label: '30m' },
              { id: 60, label: '1h' },
            ].map((option) => {
              const selected = notificationLeadTime === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                  onPress={() => setNotificationLeadTime(option.id)}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {showNotificationsPanel && !isLast && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8 }} />
      )}
      </>
    );

    if (embedded) return content;
    return <View style={styles.section}>{content}</View>;
  };

  const renderBlockedTab = (embedded = false, isLast = false) => {
    const content = (
      <>
      <Pressable
        style={[styles.toolRow, (showBlockedPanel || isLast) && styles.toolRowLast]}
        onPress={() => setShowBlockedPanel((current) => !current)}
      >
        <View style={[styles.toolIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
          <UserX size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toolTitle}>Blocked Users</Text>
        </View>
        <ChevronRight
          size={20}
          color={COLORS.textTertiary}
          style={{ transform: [{ rotate: showBlockedPanel ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {showBlockedPanel ? (
      loadingBlocked ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : blockedUsers.length > 0 ? (
        <View style={styles.inlinePanel}>
        {blockedUsers.map((item, index) => (
          <View 
            key={item.id} 
            style={[
                styles.toolRow, 
                index === blockedUsers.length - 1 && styles.toolRowLast,
                { paddingVertical: 12 }
            ]}
          >
            <View style={styles.avatar}>
              {item.profile_image_url ? (
                <Image source={{ uri: item.profile_image_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{item.name?.[0] || 'U'}</Text>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.toolTitle}>{item.name}</Text>
                <Text style={styles.email} numberOfLines={1}>{item.id}</Text>
            </View>
            <Pressable 
                style={{ 
                    padding: 8, 
                    backgroundColor: COLORS.surface + '20', 
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border
                }}
                onPress={() => handleUnblock(item.id)}
            >
                <UserX size={18} color={COLORS.danger || '#FF4444'} />
            </Pressable>
          </View>
        ))}
        </View>
      ) : (
        <View style={[styles.inlinePanel, { alignItems: 'center', padding: 40, opacity: 0.5 }]}>
            <Shield size={48} color={COLORS.textTertiary} strokeWidth={1} />
            <Text style={{ color: COLORS.textTertiary, marginTop: 12, fontSize: 15 }}>No blocked users</Text>
        </View>
      )
      ) : null}
      {showBlockedPanel && !isLast && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8 }} />
      )}
      </>
    );

    if (embedded) return content;
    return <View style={styles.section}>{content}</View>;
  };

  const renderResourcesTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Campus Resources</Text>

      {[
        {
          key: 'annex',
          title: 'Library Services',
          icon: LibraryBig,
          iconColor: '#00CFC7',
          iconBg: 'rgba(0, 207, 199, 0.14)',
          action: () => navigation.navigate('AnnexHub'),
          internal: true,
        },
        {
          key: 'howdy',
          title: 'Howdy Portal',
          icon: GraduationCap,
          iconColor: COLORS.primary,
          iconBg: 'rgba(80,0,0,0.12)',
          action: () => openExternal('https://howdy.tamu.edu/main/home/card-view'),
        },
        {
          key: 'hire',
          title: 'Hire Aggies',
          icon: BriefcaseBusiness,
          iconColor: '#3B82F6',
          iconBg: 'rgba(59,130,246,0.12)',
          action: () => openExternal('https://tamu-csm.symplicity.com/students/index.php?signin_tab=0'),
        },
        {
          key: 'transact',
          title: 'Transact eAccounts',
          icon: Wallet,
          iconColor: '#F59E0B',
          iconBg: 'rgba(245, 158, 11, 0.15)',
          action: () => openExternal('https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx'),
        },
        {
          key: 'rec',
          title: 'Rec Center Hours',
          icon: Dumbbell,
          iconColor: '#10B981',
          iconBg: 'rgba(16,185,129,0.15)',
          action: () => navigation.navigate('RecreationFacilities'),
        },
      ].map((resource, index, array) => {
        const Icon = resource.icon;
        return (
          <Pressable
            key={resource.key}
            style={[styles.toolRow, index === array.length - 1 && styles.toolRowLast]}
            onPress={resource.action}
          >
            <View style={[styles.toolIconBg, { backgroundColor: resource.iconBg || 'rgba(243,241,237,0.12)' }]}>
              <Icon size={20} color={resource.iconColor || COLORS.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolTitle}>{resource.title}</Text>
            </View>
            {resource.internal ? (
              <ChevronRight size={18} color={COLORS.textTertiary} />
            ) : (
              <ExternalLink size={18} color={COLORS.textTertiary} />
            )}
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.toolRow, { marginTop: 12 }]}
        onPress={() => openExternal('https://www.termsfeed.com/live/2fc33440-a5a9-4943-a1da-d3c5d5abc1e5')}
      >
        <View style={[styles.toolIconBg, { backgroundColor: 'rgba(0, 122, 255, 0.15)' }]}>
          <Scale size={20} color="#007AFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toolTitle}>Terms of Service</Text>
        </View>
        <ExternalLink size={18} color={COLORS.textTertiary} />
      </Pressable>

      <Pressable
        style={[styles.toolRow, styles.toolRowLast, { marginTop: 4 }]}
        onPress={() => openExternal('https://www.termsfeed.com/live/4889a318-ae78-48e2-975d-2eddfe043866')}
      >
        <View style={[styles.toolIconBg, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
          <Shield size={20} color="#34C759" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toolTitle}>Privacy Policy</Text>
        </View>
        <ExternalLink size={18} color={COLORS.textTertiary} />
      </Pressable>

      <Pressable
        style={[styles.toolRow, styles.toolRowLast, { marginTop: 12 }]}
        onPress={() => openExternal(SUPPORT_CONTACT_URL)}
      >
        <View style={[styles.toolIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <LifeBuoy size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Support</Text>
        </View>
        <ExternalLink size={18} color={COLORS.textTertiary} />
      </Pressable>
    </View>
  );

  const renderGuestView = () => (
    <>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Guest Mode</Text>
            <Text style={styles.title}>Browse Campus Fast</Text>
          </View>
          <View style={styles.heroBadge}>
            <UserRound size={18} color={COLORS.textPrimary} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What You Can Do</Text>

        <View style={styles.toolRow}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(80,0,0,0.12)' }]}>
            <GraduationCap size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Browse campus events</Text>
          </View>
        </View>

        <View style={styles.toolRow}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Compass size={20} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Use Places and view Rec capacity</Text>
          </View>
        </View>

        <View style={[styles.toolRow, styles.toolRowLast]}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
            <ExternalLink size={20} color="#F97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Share events with other people</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Log In For More</Text>

        <Pressable style={styles.toolRow} onPress={openGuestRecCapacity}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(34,197,94,0.14)' }]}>
            <Dumbbell size={20} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Open Rec Capacity in Places</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable
          style={[styles.toolRow, styles.toolRowLast]}
          onPress={() => openExternal('https://www.termsfeed.com/live/4889a318-ae78-48e2-975d-2eddfe043866')}
        >
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
            <Shield size={20} color="#34C759" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Privacy Policy</Text>
          </View>
          <ExternalLink size={18} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable
          style={[styles.toolRow, styles.toolRowLast, { marginTop: 12 }]}
          onPress={() => openExternal(SUPPORT_CONTACT_URL)}
        >
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <LifeBuoy size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Support</Text>
          </View>
          <ExternalLink size={18} color={COLORS.textTertiary} />
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogin}>
        <LogIn size={18} color={COLORS.textPrimary} />
        <Text style={styles.logoutText}>Log In</Text>
      </Pressable>
    </>
  );

  return (
    <View style={[styles.container, useWallpaper && styles.transparentContainer]}>
      {useWallpaper ? (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.18)' },
            ]}
          />
        </ImageBackground>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={[styles.container, useWallpaper && styles.transparentContainer]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      >
        {isGuest ? (
          renderGuestView()
        ) : (
          <>
            <View style={styles.tabShell}>
              <PillTabs
                items={SETTINGS_TABS.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon }))}
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as SettingsTabKey)}
                floating={false}
                compact={false}
                activeTextMode="always"
                layout="stacked"
              />
            </View>

            {activeTab === 'personal' ? renderPersonalTab() : null}
            {activeTab === 'layout' ? renderLayoutTab() : null}
            {activeTab === 'resources' ? renderResourcesTab() : null}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean, accentColor: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    transparentContainer: {
      backgroundColor: 'transparent',
    },
    contentContainer: {
      padding: 16,
      paddingTop: 54,
      gap: 16,
    },
    heroCard: {
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.86)',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      padding: 20,
      gap: 16,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: COLORS.textSecondary,
      marginBottom: 8,
    },
    title: {
      fontSize: 31,
      fontWeight: '900',
      letterSpacing: -0.9,
      color: COLORS.textPrimary,
      marginBottom: 6,
    },
    heroBadge: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(12,12,14,0.9)' : 'rgba(80,0,0,0.06)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
    },
    quickActionRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    quickActionCard: {
      flex: 1,
      minHeight: 92,
      borderRadius: 24,
      borderWidth: 1.5,
      backgroundColor: isDark ? COLORS.surface : '#F8FAFC',
      paddingHorizontal: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    quickActionIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    tabShell: {
      marginTop: 2,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.03)',
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatar: {
      width: 74,
      height: 74,
      borderRadius: 37,
      backgroundColor: isDark ? 'rgba(12,12,14,0.9)' : 'rgba(80,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      fontSize: 26,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    cameraBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(12,12,14,0.95)' : 'rgba(255,255,255,0.9)',
      borderWidth: 2,
      borderColor: COLORS.background,
    },
    name: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    email: {
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    section: {
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.86)',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      padding: 18,
      gap: 14,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.4,
    },
    sectionSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: COLORS.textSecondary,
    },
    preferenceBlock: {
      gap: 10,
    },
    preferenceLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.accentText || COLORS.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'nowrap',
    },
    segmentButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: COLORS.surfaceElevated,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    segmentButtonStretch: {
      flex: 1,
      justifyContent: 'center',
    },
    segmentButtonActive: {
      backgroundColor: 'rgba(12,12,14,0.92)',
      borderColor: accentColor,
      borderWidth: 2,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    toolRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    toolRowExpanded: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    toolIconBg: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    toolSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.textSecondary,
    },
    inlinePanel: {
      marginTop: 12,
    },
    accentSliderCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      padding: 14,
      gap: 14,
    },
    accentSliderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    accentPreview: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    accentSliderTrack: {
      height: 34,
      borderRadius: 17,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    accentSliderGradient: {
      flexDirection: 'row',
      width: '100%',
      height: 18,
      borderRadius: 999,
      overflow: 'hidden',
    },
    accentSliderSegment: {
      flex: 1,
      height: '100%',
    },
    accentSliderThumb: {
      position: 'absolute',
      top: 4,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#FFFFFF',
      borderWidth: 2,
      borderColor: 'rgba(12,12,14,0.74)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 4,
    },
    accentScaleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    accentScaleLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    accentResetButton: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    accentResetText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    inlineSwitchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      padding: 14,
    },
    inlineSwitchTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    wallpaperCard: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
    },
    wallpaperPreview: {
      width: '100%',
      height: 160,
    },
    wallpaperPlaceholder: {
      height: 160,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(80,0,0,0.03)',
    },
    wallpaperPlaceholderText: {
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    wallpaperActions: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
    },
    wallpaperButton: {
      flex: 1,
      borderRadius: 14,
      backgroundColor: 'rgba(12,12,14,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    wallpaperSecondaryButton: {
      backgroundColor: 'transparent',
      borderColor: COLORS.border,
    },
    wallpaperButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    wallpaperSecondaryButtonText: {
      color: COLORS.textPrimary,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.86)',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      paddingVertical: 16,
    },
    logoutText: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
