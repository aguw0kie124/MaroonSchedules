import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  BriefcaseBusiness,
  Building2,
  Camera,
  ChevronRight,
  Flame,
  GraduationCap,
  LibraryBig,
  LogOut,
  Moon,
  Palette,
  Search,
  Sun,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useClerk, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';

import { getDefaultAccentColor, useTheme } from './SharedUI';
import { fetchCampusOverview } from '../api/client';
import { PARKING_PERMIT_OPTIONS, useAppShellStore } from '../store/appShellStore';

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
  const {
    COLORS,
    theme,
    accentColor,
    setTheme,
    setAccentColor,
  } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const parkingPermit = useAppShellStore((state) => state.parkingPermit);
  const setParkingPermit = useAppShellStore((state) => state.setParkingPermit);

  const [academicStatus, setAcademicStatus] = useState<any | null>(null);
  const [loadingAcademicStatus, setLoadingAcademicStatus] = useState(true);
  const [accentSliderWidth, setAccentSliderWidth] = useState(0);
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

    return () => {
      cancelled = true;
    };
  }, [isFocused, user]);

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
        console.error('Failed to upload image:', error);
        Alert.alert('Error', 'Unable to update your profile photo.');
      }
    }
  };

  const openRegistrationReadiness = () => {
    Alert.alert(
      academicStatus?.registrationReady ? 'Registration Ready' : 'Registration Needs Attention',
      academicStatus?.activeHolds?.length
        ? `Active holds: ${academicStatus.activeHolds.join(', ')}\n\nSource: ${academicStatus.sourceLabel || 'Unavailable'}`
        : `No active holds are visible right now.\n\nSource: ${academicStatus?.sourceLabel || 'Unavailable'}`,
    );
  };

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Unable to open URL', url, error);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Account</Text>
            <Text style={styles.title}>Settings</Text>
          </View>
          <View style={styles.heroBadge}>
            <UserRound size={18} color="#FFFFFF" />
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
              <Camera size={14} color="#FFFFFF" />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.fullName || 'Aggie User'}</Text>
            <Text style={styles.email}>
              {user?.primaryEmailAddress?.emailAddress || 'user@tamu.edu'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.preferenceBlock}>
          <Text style={styles.preferenceLabel}>Parking Permit</Text>
          <View style={styles.preferenceColumn}>
            {PARKING_PERMIT_OPTIONS.map((option) => {
              const selected = parkingPermit === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.preferenceRow, selected && styles.preferenceRowActive]}
                  onPress={() => setParkingPermit(option.id)}
                >
                  <Text style={[styles.preferenceRowTitle, selected && styles.preferenceRowTitleActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.preferenceBlock}>
          <Text style={styles.preferenceLabel}>Theme</Text>
          <View style={styles.themeChoiceRow}>
            {[
              { id: 'light', label: 'Light', Icon: Sun },
              { id: 'dark', label: 'Dark', Icon: Moon },
            ].map(({ id, label, Icon }) => {
              const selected = theme === id;
              return (
                <Pressable
                  key={id}
                  style={[styles.themeChoiceCard, selected && styles.themeChoiceCardActive]}
                  onPress={() => setTheme(id)}
                >
                  <View style={[styles.themeChoiceIcon, selected && styles.themeChoiceIconActive]}>
                    <Icon size={18} color={selected ? '#FFFFFF' : COLORS.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.themeChoiceTitle, selected && styles.themeChoiceTitleActive]}>
                      {label}
                    </Text>
                    <Text style={styles.themeChoiceSubtitle}>
                      {id === 'light' ? 'Bright, airy surfaces' : 'Low-glare dark surfaces'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
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
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Academics</Text>

        <Pressable style={styles.toolRow} onPress={() => navigation.navigate('Leaderboard')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
            <Palette size={20} color="#D4AF37" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Campus Rankings & Podium</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable style={styles.toolRow} onPress={() => navigation.navigate('NewCourseSearch')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(243,241,237,0.12)' }]}>
            <Search size={20} color="#F3F1ED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Major & Course Preferences</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable style={styles.toolRow} onPress={() => navigation.navigate('GradesScreen')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(243,241,237,0.12)' }]}>
            <GraduationCap size={20} color="#F3F1ED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Grades & Distributions</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable style={styles.toolRow} onPress={() => navigation.navigate('ScheduleList')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(243,241,237,0.12)' }]}>
            <LibraryBig size={20} color="#F3F1ED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>My Saved Schedules</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable style={[styles.toolRow, styles.toolRowLast]} onPress={openRegistrationReadiness}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(243,241,237,0.12)' }]}>
            <GraduationCap size={20} color="#F3F1ED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Registration Readiness</Text>
          </View>
          {loadingAcademicStatus ? (
            <ActivityIndicator size="small" color="#F3F1ED" />
          ) : (
            <ChevronRight size={20} color={COLORS.textTertiary} />
          )}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resources</Text>
        {[
          {
            key: 'howdy',
            title: 'Howdy Portal',
            icon: GraduationCap,
            action: () => openExternal('https://howdy.tamu.edu/main/home/card-view'),
          },
          {
            key: 'hire',
            title: 'Hire Aggies',
            icon: BriefcaseBusiness,
            action: () => openExternal('https://tamu-csm.symplicity.com/students/index.php?signin_tab=0'),
          },
          {
            key: 'transact',
            title: 'Transact eAccounts',
            icon: Wallet,
            action: () => openExternal('https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx'),
          },
          {
            key: 'rec',
            title: 'Rec Center Hours',
            icon: Building2,
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
              <View style={[styles.toolIconBg, { backgroundColor: 'rgba(243,241,237,0.12)' }]}>
                <Icon size={20} color="#F3F1ED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toolTitle}>{resource.title}</Text>
              </View>
              <ChevronRight size={18} color={COLORS.textTertiary} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced</Text>
        <Pressable
          style={styles.toolRow}
          onPress={() => navigation.navigate('DiningDashboard')}
        >
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(80,0,0,0.15)' }]}>
            <Flame size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Nutrition Dashboard</Text>
            <Text style={styles.toolSubtitle}>
              Old calorie tracker, meal tools, streaks, and database hub.
            </Text>
          </View>
          <ChevronRight size={18} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable
          style={[styles.toolRow, styles.toolRowLast]}
          onPress={() => navigation.navigate('DiningSettings')}
        >
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(80,0,0,0.15)' }]}>
            <Flame size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Nutrition Tracker Settings</Text>
            <Text style={styles.toolSubtitle}>
              Optional calorie and body-goal tools, tucked away from the main app.
            </Text>
          </View>
          <ChevronRight size={18} color={COLORS.textTertiary} />
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => signOut()}>
        <LogOut size={18} color="#F3F1ED" />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
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
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatar: {
      width: 78,
      height: 78,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      color: COLORS.textPrimary,
      fontSize: 26,
      fontWeight: '900',
    },
    cameraBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: COLORS.background,
    },
    name: {
      color: COLORS.textPrimary,
      fontSize: 23,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    email: {
      color: COLORS.textSecondary,
      fontSize: 14,
    },
    section: {
      gap: 0,
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.86)',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      padding: 20,
    },
    sectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 14,
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    toolRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    toolIconBg: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(243,241,237,0.12)',
    },
    toolTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    toolSubtitle: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    preferenceBlock: {
      marginBottom: 18,
    },
    preferenceLabel: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    preferenceColumn: {
      gap: 10,
    },
    themeChoiceRow: {
      gap: 10,
    },
    themeChoiceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(80,0,0,0.03)',
    },
    themeChoiceCardActive: {
      borderColor: COLORS.primary,
      backgroundColor: isDark ? 'rgba(80,0,0,0.22)' : 'rgba(80,0,0,0.08)',
    },
    themeChoiceIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(80,0,0,0.06)',
    },
    themeChoiceIconActive: {
      backgroundColor: COLORS.primary,
    },
    themeChoiceTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 2,
    },
    themeChoiceTitleActive: {
      color: COLORS.primary,
    },
    themeChoiceSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 12,
    },
    preferenceRow: {
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(80,0,0,0.03)',
    },
    preferenceRowActive: {
      borderColor: COLORS.primary,
      backgroundColor: isDark ? 'rgba(80,0,0,0.22)' : 'rgba(80,0,0,0.08)',
    },
    preferenceRowTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    preferenceRowTitleActive: {
      color: COLORS.primary,
    },
    accentSliderCard: {
      borderRadius: 22,
      padding: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.04)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    accentSliderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    accentPreview: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    inlineSwitchTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    accentSliderTrack: {
      height: 42,
      justifyContent: 'center',
      marginBottom: 12,
    },
    accentSliderGradient: {
      height: 14,
      borderRadius: 999,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    accentSliderSegment: {
      flex: 1,
    },
    accentSliderThumb: {
      position: 'absolute',
      top: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#FFFFFF',
      borderWidth: 2,
      borderColor: COLORS.primary,
    },
    accentScaleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    accentScaleLabel: {
      color: COLORS.textTertiary,
      fontSize: 12,
      fontWeight: '700',
    },
    accentResetButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    accentResetText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    logoutButton: {
      marginTop: 4,
      borderRadius: 22,
      backgroundColor: COLORS.primary,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    logoutText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
  });
