import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  BriefcaseBusiness,
  Building2,
  Camera,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  GraduationCap,
  LayoutGrid,
  LibraryBig,
  LogOut,
  Palette,
  Search,
  Settings2,
  Trophy,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { useClerk, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';

import { fetchCampusOverview } from '../api/client';
import { PillTabs } from './PillTabs';
import { getDefaultAccentColor, useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';

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
  const styles = getStyles(COLORS, isDark);

  const [academicStatus, setAcademicStatus] = useState<any | null>(null);
  const [loadingAcademicStatus, setLoadingAcademicStatus] = useState(true);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [accentSliderWidth, setAccentSliderWidth] = useState(0);
  const activeTab = useAppShellStore((state) => state.settingsTab) as SettingsTabKey;
  const setActiveTab = useAppShellStore((state) => state.setSettingsTab);
  const tabBarMode = useAppShellStore((state) => state.tabBarMode);
  const setTabBarMode = useAppShellStore((state) => state.setTabBarMode);

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
        console.error('Failed to set wallpaper:', error);
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
    await signOut();
  };

  const renderPersonalTab = () => (
    <>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Identity</Text>
            <Text style={styles.title}>Personal</Text>
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
        <Text style={styles.sectionTitle}>Academics</Text>

        <Pressable style={styles.toolRow} onPress={() => navigation.navigate('Leaderboard')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
            <Trophy size={20} color="#D4AF37" />
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
            <Settings2 size={20} color="#F3F1ED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>Manage Academic Schedules</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>

        <Pressable style={[styles.toolRow, styles.toolRowLast]} onPress={() => navigation.navigate('GPACalculator')}>
          <View style={[styles.toolIconBg, { backgroundColor: 'rgba(243,241,237,0.12)' }]}>
            <GraduationCap size={20} color="#F3F1ED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolTitle}>GPA Calculator</Text>
          </View>
          <ChevronRight size={20} color={COLORS.textTertiary} />
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={18} color="#F3F1ED" />
        <Text style={styles.logoutText}>Log Out</Text>
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

  const renderResourcesTab = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Campus Resources</Text>

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
          key: 'annex',
          title: 'The Annex',
          icon: Building2,
          action: () => navigation.navigate('AnnexHub'),
          internal: true,
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
          icon: Dumbbell,
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
            {resource.internal ? (
              <ChevronRight size={18} color={COLORS.textTertiary} />
            ) : (
              <ExternalLink size={18} color={COLORS.textTertiary} />
            )}
          </Pressable>
        );
      })}
    </View>
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
        style={[styles.container, useWallpaper && styles.transparentContainer]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
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

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
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
      backgroundColor: 'rgba(12,12,14,0.9)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
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
      backgroundColor: 'rgba(12,12,14,0.9)',
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
      color: '#FFFFFF',
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
      backgroundColor: 'rgba(12,12,14,0.95)',
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
      borderColor: 'rgba(243,241,237,0.26)',
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
