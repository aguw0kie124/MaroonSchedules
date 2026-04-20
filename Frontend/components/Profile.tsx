import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Dimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path, Circle as SvgCircle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import {
  BriefcaseBusiness,
  Building2,
  Camera,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  Flame,
  GraduationCap,
  LibraryBig,
  LogIn,
  LogOut,
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
  X,
  LayoutGrid,
  Bookmark as BookmarkIcon,
  RotateCw,
  UserCheck,
  Repeat,
  MapPin as MapPinIcon,
  Link,
  Info,
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Settings,
  MoreVertical,
  Utensils,
  Palette,
  Sun,
  Moon,
  Ban,
} from 'lucide-react-native';
import { useClerk, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Plus } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { fetchCampusOverview, fetchUserProfile } from '../api/client';
import { SUPPORT_CONTACT_URL } from '../config';
import { PARKING_PERMIT_OPTIONS, useAppShellStore } from '../store/appShellStore';
import { useSessionStore } from '../store/sessionStore';
import { useEventStore } from '../store/eventStore';
import {
  addFriend,
  deleteAccount,
  getBlockedUsers,
  getFriends,
  removeFriend,
  searchUsers,
  unblockUser,
} from '../services/socialFeedService';
import { PillTabs } from './PillTabs';
import { getDefaultAccentColor, useTheme, useThemeStore, WallpaperWrapper } from './SharedUI';

import { TagChips } from './common/TagChips';
import { ScalePressable } from './common/Motion';
import { PING_CATEGORIES, PingComposerModal } from './pings/PingComposerModal';
import { PingCommentsModal } from './pings/PingCommentsModal';
import { API_URL } from '../config';
import { PingCard, mapActivityToPing } from './CampusPingsScreen';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StoryViewer } from './pings/StoryViewer';
import DiningDashboard from './dining/DiningDashboard';
import { ClubAccessScreen } from './ClubAccessScreen';
import { Users } from 'lucide-react-native';


const PROFILE_TABS = [
  { key: 'pings', icon: LayoutGrid },
  { key: 'nutrition', icon: Utensils },
  { key: 'clubs', icon: Users },
  { key: 'resources', icon: LibraryBig },
  { key: 'personal', icon: Settings },
] as const;

type ProfileTabKey = typeof PROFILE_TABS[number]['key'];

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

function formatRelativeAge(isoValue: string) {
  const value = new Date(isoValue);
  if (!Number.isFinite(value.getTime())) return 'Just now';
  const diffMs = Date.now() - value.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / (1000 * 60)));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function Profile() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { user } = useUser();
  const { scheduleEvent, saveEvent } = useEventStore();
  const queryClient = useQueryClient();
  const { data: userPings = [], isLoading: isLoadingPings } = useQuery({
    queryKey: ['user-pings', API_URL, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { getUserPingFeed, getPingFeed } = await import('../services/socialFeedService');
      
      // Combine both for maximum discovery reliability
      const [uFeed, gFeed] = await Promise.all([
        getUserPingFeed(user.id, 50).catch(() => []),
        getPingFeed(150).catch(() => [])
      ]);
      
      const combined = [...uFeed, ...gFeed];
      const seenIds = new Set();
      const unique = combined.filter(p => {
        const id = p.id || p.activityId;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });

      const userActivities = unique.filter((p: any) => {
        const pId = p.user_id || p.actor?.id?.replace('SU:', '') || p.actor?.replace('SU:', '');
        return pId === user.id;
      });
      return userActivities.map((act: any) => mapActivityToPing(act, user, new Map()));
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  });
  const refetchUserPings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['user-pings', API_URL, user?.id] });
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (isFocused && user?.id) {
      refetchUserPings();
    }
  }, [isFocused, user?.id, refetchUserPings]);

  const { data: friends = [], refetch: refetchFriends, isLoading: loadingFriends } = useQuery({
    queryKey: ['campus-ping-friends', API_URL, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { getFriends } = await import('../services/socialFeedService');
      return await getFriends(user.id);
    },
    enabled: !!user?.id,
  });

  const { viewedStoryIds, addViewedStory } = useAppShellStore();
  const [selectedStoryUserIndex, setSelectedStoryUserIndex] = useState(0);
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);

  const { data: allFeedPings = [] } = useQuery({
    queryKey: ['campus-pings', API_URL],
    queryFn: async () => {
      const { getPingFeed } = await import('../services/socialFeedService');
      const feed = await getPingFeed(100);
      return feed.map((act: any) => mapActivityToPing(act, user, new Map()));
    },
  });

  const groupedStories = useMemo(() => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPings = allFeedPings.filter((p: any) => new Date(p.createdAt) > twentyFourHoursAgo);
    
    const storyGroupsMap = new global.Map<string, any[]>();
    recentPings.forEach(p => {
      const g = storyGroupsMap.get(p.userId) || [];
      g.push(p);
      storyGroupsMap.set(p.userId, g);
    });

    const storyUsers = Array.from(storyGroupsMap.entries()).map(([uid, pings]) => {
      const first = pings[0];
      const allSeen = pings.every(p => viewedStoryIds.includes(p.id));
      return {
        id: uid,
        name: uid === user?.id ? (userDisplayName || fullName || user?.username || user?.firstName || 'Me') : first.userName,
        image: uid === user?.id ? user?.imageUrl : first.userImage,
        pings: pings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        hasMedia: pings.some(p => p.imageUrl),
        allSeen,
      };
    });

    // Move "Me" to the front
    const meIndex = storyUsers.findIndex(u => u.id === user?.id);
    if (meIndex > -1) {
      const [me] = storyUsers.splice(meIndex, 1);
      storyUsers.unshift(me);
    }

    return storyUsers;
  }, [allFeedPings, user, viewedStoryIds, userDisplayName, fullName]);

  const activeStoryUser = groupedStories[selectedStoryUserIndex];

  const handleStoryPress = () => {
    const meIndex = groupedStories.findIndex(u => u.id === user?.id);
    if (meIndex > -1) {
      setSelectedStoryUserIndex(meIndex);
      setStoryViewerVisible(true);
    }
  };

  const handleCloseStoryViewer = () => {
    if (activeStoryUser) {
      activeStoryUser.pings.forEach((p: any) => addViewedStory(p.id));
    }
    setStoryViewerVisible(false);
  };

  const handleNextStoryUser = useCallback(() => {
    if (activeStoryUser) {
      activeStoryUser.pings.forEach((p: any) => addViewedStory(p.id));
    }
    if (selectedStoryUserIndex < groupedStories.length - 1) {
      setSelectedStoryUserIndex(selectedStoryUserIndex + 1);
    } else {
      setStoryViewerVisible(false);
    }
  }, [activeStoryUser, selectedStoryUserIndex, groupedStories.length, addViewedStory]);

  const handlePrevStoryUser = useCallback(() => {
    if (selectedStoryUserIndex > 0) {
      setSelectedStoryUserIndex(selectedStoryUserIndex - 1);
    }
  }, [selectedStoryUserIndex]);

  const [composerVisible, setComposerVisible] = useState(false);
  const [selectedPing, setSelectedPing] = useState<any | null>(null);
  const { signOut } = useClerk();
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  const isGuest = useSessionStore((state) => state.isGuest);
  const {
    COLORS,
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    applyAccentToText,
    setApplyAccentToText,
    tabBarMode,
    setTabBarMode,
  } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark, accentColor);

  const [academicStatus, setAcademicStatus] = useState<any | null>(null);
  const [loadingAcademicStatus, setLoadingAcademicStatus] = useState(true);
  const [accentSliderWidth, setAccentSliderWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('pings');
  const {
    eventNotifications,
    placeNotifications,
    pingNotifications,
    setNotificationPreference,
    notificationLeadTime,
    setNotificationLeadTime
  } = useAppShellStore();
  
  const pickerPos = useThemeStore((state: any) => state.pickerPos);
  const huePos = useThemeStore((state: any) => state.huePos);
  const setPickerPos = useThemeStore((state: any) => state.setPickerPos);
  const setHuePos = useThemeStore((state: any) => state.setHuePos);
  
  const [showBlockedPanel, setShowBlockedPanel] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showSavedPingsModal, setShowSavedPingsModal] = useState(false);
  
  const userDisplayName = useAppShellStore((state) => state.userDisplayName);
  const userBio = useAppShellStore((state) => state.userBio);
  const userGender = useAppShellStore((state) => state.userGender);
  const showPingsOnProfile = useAppShellStore((state) => state.showPingsOnProfile);
  
  const setUserProfile = useAppShellStore((state) => state.setUserProfile);

  const [fullName, setFullName] = useState(userDisplayName || user?.fullName || '');
  const [bio, setBio] = useState(userBio);
  const [gender, setGender] = useState(userGender);

  const [showFriendSearchPanel, setShowFriendSearchPanel] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const scrollRef = React.useRef<ScrollView | null>(null);

  const [activeCommentsPing, setActiveCommentsPing] = useState<any | null>(null);
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const handleVotePing = async (ping: any, direction: number) => {
    if (!ping) return;
    const { toggleVote } = await import('../services/socialFeedService');
    
    // Optimistic UI Update matches CampusPingsScreen logic
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
    
    setSelectedPing(prev => prev ? {
      ...prev,
      userVote: nextUserVote,
      score: (prev.score || 0) + scoreAdjustment
    } : null);

    try {
      await import('expo-haptics').then(H => H.impactAsync());
      await toggleVote(ping.id || ping.activityId, direction === 1 ? 'upvote' : 'downvote');
      queryClient.invalidateQueries({ queryKey: ['user-pings'] });
      queryClient.invalidateQueries({ queryKey: ['campus-pings'] });
    } catch (e) {
      console.warn('Vote failed', e);
      setSelectedPing(ping);
    }
  };

  const handleOpenComments = (ping: any) => {
    setActiveCommentsPing(ping);
  };

  const openPingOnMap = useCallback(
    (ping: any) => {
      navigation.navigate('Main', {
        screen: 'Places',
        params: {
          initialLayer: 'Pulse',
          initialLocation: ping.locationTag,
          focusToken: `ping:${ping.id}:${ping.startAt}`,
        },
      });
      setSelectedPing(null);
    },
    [navigation],
  );

  const savePingToPlans = useCallback(
    (ping: any) => {
      const { 
        getCanonicalLocationName, 
        buildCampusDirectory 
      } = require('./places/campusData');
      const directory = buildCampusDirectory();
      const canonicalLocation = getCanonicalLocationName(ping.locationTag);
      const directoryItem = directory.find((item: any) => 
        getCanonicalLocationName(item.location) === canonicalLocation
      );

      scheduleEvent({
        id: `${ping.source || 'user'}-${ping.id}`,
        title: ping.title,
        location: canonicalLocation,
        description: ping.body,
        date_ts: Math.floor(new Date(ping.startAt).getTime() / 1000),
        date_iso: ping.startAt,
        endDate_ts: ping.endAt ? Math.floor(new Date(ping.endAt).getTime() / 1000) : undefined,
        location_lat: ping.locationLat ?? directoryItem?.coord.lat ?? null,
        location_lng: ping.locationLng ?? directoryItem?.coord.lng ?? null,
        category: ping.category,
      });
      saveEvent(`${ping.source || 'user'}-${ping.id}`);
      Alert.alert('Saved to plans', `${ping.title} is now in your plans.`);
    },
    [scheduleEvent, saveEvent],
  );

  const recentPosts = useMemo(() => {
    return userPings.slice(0, 3);
  }, [userPings]);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const { updateUserProfile } = await import('../services/socialFeedService');
      await updateUserProfile(user.id, {
        full_name: fullName,
        bio: bio,
        website: website,
        graduation_year: '', // placeholder if needed
        major: '' // placeholder if needed
      });

      setUserProfile({ bio, website, gender, displayName: fullName });
      setShowEditProfile(false);
      
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ['user-pings', API_URL, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['campus-pings', API_URL] });
      
      Alert.alert('Profile Saved', 'Your changes have been updated and synced.');
    } catch (err) {
      console.warn('Failed to save profile:', err);
      Alert.alert('Sync Error', 'Your changes were saved locally but could not sync with the server.');
      // Still update locally for responsiveness
      setUserProfile({ bio, website, gender, displayName: fullName });
      setShowEditProfile(false);
    }
  };

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
    if (isFocused) {
      setActiveTab('pings');
    }
  }, [isFocused, setActiveTab]);

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
        loadFriends();
        loadBlockedUsers();
    }
  }, [activeTab, isGuest, user]);

  useEffect(() => {
    if (!user?.id || !showFriendSearchPanel) {
      setFriendSearchResults([]);
      setSearchingFriends(false);
      return;
    }

    const query = friendSearchQuery.trim();
    if (!query) {
      setFriendSearchResults([]);
      setSearchingFriends(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearchingFriends(true);
      searchUsers(query, user.id, 8)
        .then((results) => {
          if (!cancelled) {
            setFriendSearchResults(results.filter((entry) => entry.id !== user.id));
          }
        })
        .catch((error) => console.warn('Failed to search users', error))
        .finally(() => {
          if (!cancelled) {
            setSearchingFriends(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [friendSearchQuery, showFriendSearchPanel, user?.id]);

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

  const loadFriends = async () => {
    refetchFriends();
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

  const handleAddFriend = async (targetId: string, name?: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be signed in to add a friend.');
      return;
    }
    try {
      await addFriend(targetId, user.id);
      await loadFriends();
      setFriendSearchResults((current) =>
        current.map((item) => (item.id === targetId ? { ...item, is_friend: true } : item)),
      );
      Alert.alert('Friend added', `${name || 'User'} has been added to your friends.`);
    } catch (err) {
      console.warn('Failed to add friend', err);
      Alert.alert('Error', 'Failed to add friend.');
    }
  };

  const handleRemoveFriend = async (targetId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be signed in to remove a friend.');
      return;
    }
    try {
      await removeFriend(targetId, user.id);
      await loadFriends();
      Alert.alert('Friend removed', 'User removed from your friends.');
    } catch (err) {
      console.warn('Failed to remove friend', err);
      Alert.alert('Error', 'Failed to remove friend.');
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
        await loadFriends();
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

  const categoryMeta = (categoryId: string) => {
    return PING_CATEGORIES.find(c => c.id === categoryId) || PING_CATEGORIES[PING_CATEGORIES.length - 1];
  };

  const renderEditProfileModal = () => (
    <Modal
      visible={showEditProfile}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setShowEditProfile(false)}
    >
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => setShowEditProfile(false)} style={styles.modalCloseButton}>
            <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Edit profile</Text>
          <Pressable 
            onPress={handleSaveProfile} 
            style={[styles.modalSubmitButton, { backgroundColor: COLORS.primary }]}
          >
            <Text style={{ color: '#FFF', fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>

        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Photo Card */}
          <View style={[styles.editProfileCard, { flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
              <Image 
                source={{ uri: user?.imageUrl }} 
                style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: COLORS.border }} 
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.textPrimary }} numberOfLines={1}>
                  {userDisplayName || fullName || user?.username || user?.firstName}
                </Text>
                <Text style={{ color: COLORS.textTertiary, fontSize: 13 }}>{user?.primaryEmailAddress?.emailAddress}</Text>
              </View>
            </View>
              <Pressable 
                onPress={handleAvatarPress}
                style={[
                  styles.changePhotoButton, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }
                ]}
              >
                <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 13 }}>Edit</Text>
              </Pressable>
          </View>

          {/* Personality Card */}
          <View style={[styles.editProfileCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={{ gap: 16, width: '100%' }}>
              <View>
                <Text style={styles.inputLabel}>DISPLAY NAME</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your Name"
                  placeholderTextColor={COLORS.textTertiary}
                  style={[
                    styles.modalInput, 
                    { 
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', 
                      borderRadius: 14, 
                      height: 48, 
                      paddingHorizontal: 16,
                      color: COLORS.textPrimary,
                      fontWeight: '600',
                    }
                  ]}
                />
              </View>
              <View>
                <Text style={styles.inputLabel}>BIO</Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell people about yourself..."
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  maxLength={150}
                  style={[styles.modalInput, { backgroundColor: COLORS.surfaceElevated, borderRadius: 12, height: 100, paddingHorizontal: 16, paddingTop: 12 }]}
                />
                <Text style={{ alignSelf: 'flex-end', fontSize: 11, color: COLORS.textTertiary, marginTop: 4 }}>{bio.length}/150</Text>
              </View>
            </View>
          </View>



          <View style={{ gap: 12 }}>
            <Text style={[styles.inputLabel, { marginLeft: 4 }]}>Preferences</Text>
            
            <View style={[styles.toggleCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: 16, padding: 16 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>Show Pings on Profile</Text>
                <Text style={{ fontSize: 12, color: COLORS.textTertiary }}>Display text comments in your grid</Text>
              </View>
              <Switch 
                value={showPingsOnProfile} 
                onValueChange={(val) => setUserProfile({ showPings: val })}
                trackColor={{ true: COLORS.primary }}
              />
            </View>

            <Pressable 
              onPress={handleLogout}
              style={{ marginTop: 20, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: COLORS.textTertiary, fontWeight: '700' }}>Log Out</Text>
            </Pressable>

            <Pressable 
              onPress={handleDeleteAccount}
              style={{ padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: COLORS.danger, fontWeight: '700' }}>Delete Account</Text>
            </Pressable>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  const myStoryData = useMemo(() => {
    return groupedStories.find(u => u.id === user?.id) || { hasActiveStory: false, allSeen: true };
  }, [groupedStories, user?.id]);

   const renderProfileHeader = () => (
     <View style={styles.modernProfileHeader}>
       <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 10 }}>
         <ScalePressable 
           onPress={() => {
             if (myStoryData.pings?.length) {
               Alert.alert(
                 'Profile Photo',
                 'Would you like to view your story or update your profile photo?',
                 [
                   { text: 'View Story', onPress: handleStoryPress },
                   { text: 'Update Photo', onPress: handleAvatarPress },
                   { text: 'Cancel', style: 'cancel' }
                 ]
               );
             } else {
               handleAvatarPress();
             }
           }}
           style={[
             styles.modernAvatarWrapper,
             { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: COLORS.primary, padding: 5 }
           ]}
         >
           <View style={{ 
             backgroundColor: COLORS.background, 
             borderRadius: 50, 
             padding: 2,
             width: '100%',
             height: '100%',
             overflow: 'hidden'
           }}>
             {user?.imageUrl ? (
               <Image source={{ uri: user.imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 50 }} />
             ) : (
               <View style={[styles.modernAvatarPlaceholder, { backgroundColor: COLORS.surfaceElevated }]}>
                 <Text style={[styles.modernAvatarText, { fontSize: 40 }]}>{user?.firstName?.[0] || 'U'}</Text>
               </View>
             )}
           </View>
         </ScalePressable>
         
         <View style={{ alignItems: 'center', marginTop: 18 }}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
             <Text style={[styles.modernName, { fontSize: 24, fontWeight: '900' }]}>{userDisplayName || fullName || user?.fullName || 'Aggie User'}</Text>
           </View>
         </View>
       </View>

       <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12, paddingHorizontal: 16 }}>
          <ScalePressable 
            containerStyle={{ flex: 1 }}
            style={styles.modernStatCard}
            onPress={() => setShowFriendsModal(true)}
          >
             <Text style={styles.modernStatValue}>{friends.length || 0}</Text>
             <Text style={styles.modernStatLabel}>Friends</Text>
          </ScalePressable>
          <ScalePressable 
            containerStyle={{ flex: 1 }}
            style={styles.modernStatCard}
          >
             <Text style={styles.modernStatValue}>{userPings.length || 0}</Text>
             <Text style={styles.modernStatLabel}>Pings</Text>
          </ScalePressable>
       </View>


     </View>
   );

  const renderContentGrid = (pings: any[]) => {
    if (isLoadingPings) {
      return (
        <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textTertiary, fontWeight: '600' }}>Refreshing Feed...</Text>
        </View>
      );
    }

    // Filter by visibility toggle: if off, hide pings that move (reels/images usually stay, "comments" i.e. text-only pings go)
    const filteredByToggle = showPingsOnProfile 
      ? pings 
      : pings.filter(p => p.imageUrl || p.mediaUrls?.length > 0);

    if (filteredByToggle.length === 0) {
      return (
        <View style={{ padding: 60, alignItems: 'center', justifyContent: 'center' }}>
          <LayoutGrid size={48} color={COLORS.textTertiary} style={{ opacity: 0.3, marginBottom: 16 }} />
          <Text style={{ color: COLORS.textTertiary, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            No pings yet.
          </Text>
          <Text style={{ color: COLORS.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
            Your shared moments will appear here.
          </Text>
        </View>
      );
    }

    // Sort logic for pinning
    const sortedPings = [...filteredByToggle].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return (
      <View style={[styles.postsGrid, { gap: 10, paddingHorizontal: 4 }]}>
        {sortedPings.map((post, idx) => {
          return (
            <ScalePressable 
              key={post.id || idx} 
              style={[styles.postSquare, { 
                width: (Dimensions.get('window').width - 60) / 3,
                borderRadius: 24,
                height: ((Dimensions.get('window').width - 60) / 3) * 1.33 
              }]}
              onPress={() => setSelectedPing(post)}
            >
              {post.imageUrl ? (
                <Image source={{ uri: post.imageUrl }} style={[styles.postImage, { borderRadius: 24 }]} />
              ) : (
                <View style={[styles.postFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 24 }]}>
                  <Text style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', lineHeight: 16 }} numberOfLines={5}>
                    {post.title}
                  </Text>
                </View>
              )}
            </ScalePressable>
          );
        })}
      </View>
    );
  };

  const renderEnlargedPostModal = () => {
    if (!selectedPing) return null;
    const cat = categoryMeta(selectedPing.category);

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
              width: Dimensions.get('window').width * 0.88,
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
            <View style={styles.listAvatar}>
              {item.profile_image_url ? (
                <Image source={{ uri: item.profile_image_url }} style={styles.listAvatarImage} />
              ) : (
                <Text style={styles.listAvatarText}>{item.name?.[0] || 'U'}</Text>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.toolTitle}>{item.name}</Text>
                {item.major ? (
                  <Text style={styles.email} numberOfLines={1}>{item.major}</Text>
                ) : null}
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
  }
  
  const renderFriendsModal = () => (
    <Modal
      visible={showFriendsModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowFriendsModal(false)}
    >
      <Pressable 
        style={styles.modalOverlay} 
        onPress={() => setShowFriendsModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalCardWrapper}
        >
          <Pressable 
            style={[
              styles.modalCard, 
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                marginHorizontal: 20,
                marginBottom: 40,
                borderRadius: 28,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 10,
              }
            ]} 
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.modalCardHeader}>
              <View style={{ width: 40 }} />
              <Text style={[styles.modalCardTitle, { color: COLORS.textPrimary }]}>Friends</Text>
              <Pressable onPress={() => setShowFriendsModal(false)} style={styles.modalCardClose}>
                <X size={22} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            {/* Search Bar */}
            <View style={styles.cardSearchContainer}>
              <View style={[styles.cardSearchInputWrap, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                <Search size={16} color={COLORS.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  value={friendSearchQuery}
                  onChangeText={setFriendSearchQuery}
                  placeholder="Search"
                  placeholderTextColor={COLORS.textTertiary}
                  style={[styles.cardSearchInput, { color: COLORS.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {friendSearchQuery.trim().length > 0 ? (
                <View>
                  {searchingFriends ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                  ) : friendSearchResults.length > 0 ? (
                    friendSearchResults.map((item) => (
                      <View key={item.id} style={styles.modalFriendRow}>
                        <View style={styles.listAvatar}>
                          {item.profile_image_url ? (
                            <Image source={{ uri: item.profile_image_url }} style={styles.listAvatarImage} />
                          ) : (
                            <View style={[styles.listAvatarImage, { backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{item.name?.[0] || 'U'}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>{item.username || item.name}</Text>
                          <Text style={{ color: COLORS.textTertiary, fontSize: 13 }} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <Pressable
                          style={[
                            styles.friendCardActionButton,
                            { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
                          ]}
                          onPress={() => item.is_friend ? handleRemoveFriend(item.id) : handleAddFriend(item.id, item.name)}
                        >
                          <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
                            {item.is_friend ? 'Remove' : 'Add'}
                          </Text>
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <View style={styles.modalEmptyState}>
                      <Text style={{ color: COLORS.textTertiary }}>No users found.</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  {loadingFriends ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                  ) : friends.length > 0 ? (
                    friends.map((item) => (
                      <View key={item.id} style={styles.modalFriendRow}>
                        <View style={styles.listAvatar}>
                          {item.profile_image_url ? (
                            <Image source={{ uri: item.profile_image_url }} style={styles.listAvatarImage} />
                          ) : (
                            <View style={[styles.listAvatarImage, { backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{item.name?.[0] || 'U'}</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>{item.username || item.name}</Text>
                          <Text style={{ color: COLORS.textTertiary, fontSize: 13 }} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <Pressable 
                          style={[
                            styles.friendCardActionButton, 
                            { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
                          ]} 
                          onPress={() => handleRemoveFriend(item.id)}
                        >
                          <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>Remove</Text>
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <View style={styles.modalEmptyState}>
                      <UserRound size={48} color={COLORS.textTertiary} strokeWidth={1} />
                      <Text style={{ color: COLORS.textTertiary, marginTop: 12 }}>No friends yet</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );

  const renderSavedPingsModal = () => (
    <Modal
      visible={showSavedPingsModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowSavedPingsModal(false)}
    >
      <Pressable 
        style={styles.modalOverlay} 
        onPress={() => setShowSavedPingsModal(false)}
      >
        <View style={styles.modalCardWrapper}>
          <Pressable style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCardHeader}>
              <View style={{ width: 40 }} />
              <Text style={[styles.modalCardTitle, { color: COLORS.textPrimary }]}>Saved Pings</Text>
              <Pressable onPress={() => setShowSavedPingsModal(false)} style={styles.modalCardClose}>
                <X size={22} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 40, alignItems: 'center' }}
            >
              <BookmarkIcon size={48} color={COLORS.textTertiary} strokeWidth={1} style={{ opacity: 0.5 }} />
              <Text style={{ color: COLORS.textTertiary, marginTop: 12, textAlign: 'center' }}>No saved pings yet</Text>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  const renderResourcesTab = () => (
    <View style={{ gap: 16 }}>
      <Text style={[styles.sectionHeading, { marginLeft: 4 }]}>Academic & Campus</Text>

      <View style={styles.heroCard}>
        {[
          {
            key: 'schedules',
            title: 'Manage Schedules',
            icon: CalendarDays,
            iconColor: COLORS.primary,
            iconBg: COLORS.primary + '15',
            action: () => navigation.navigate('ScheduleList'),
          },
          {
            key: 'grades',
            title: 'Grades & Distributions',
            icon: GraduationCap,
            iconColor: '#10B981',
            iconBg: '#10B981' + '15',
            action: () => navigation.navigate('GradesScreen'),
          },
          {
            key: 'annex',
            title: 'Library Services',
            icon: LibraryBig,
            iconColor: '#00CFC7',
            iconBg: '#00CFC7' + '15',
            action: () => navigation.navigate('AnnexHub'),
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
            key: 'transact',
            title: 'Transact eAccounts',
            icon: Wallet,
            iconColor: '#F59E0B',
            iconBg: 'rgba(245, 158, 11, 0.15)',
            action: () => openExternal('https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx'),
          }
        ].map((item, idx, arr) => (
          <React.Fragment key={item.key}>
            <Pressable 
              onPress={() => item.action()}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16 }}
            >
              <View style={[styles.toolIconBg, { backgroundColor: item.iconBg, width: 44, height: 44 }]}>
                <item.icon size={22} color={item.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.textPrimary }}>{item.title}</Text>
              </View>
              <ChevronRight size={18} color={COLORS.textTertiary} />
            </Pressable>
            {idx < arr.length - 1 && <View style={{ height: 1, backgroundColor: COLORS.border, marginLeft: 60 }} />}
          </React.Fragment>
        ))}
      </View>
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
    <View style={styles.container}>
      <WallpaperWrapper>
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        >
        {isGuest ? (
          renderGuestView()
        ) : (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              {renderProfileHeader()}
              
              <View style={styles.profileTabsWrapper}>
                {PROFILE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      style={[styles.profileTabButton, isActive && styles.profileTabButtonActive]}
                    >
                      <Icon size={24} color={isActive ? COLORS.textPrimary : COLORS.textTertiary} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ flex: 1 }}>
              {activeTab === 'pings' && renderContentGrid(userPings)}
              {activeTab === 'nutrition' && (
                <View style={{ flex: 1, backgroundColor: COLORS.background }}>
                   <DiningDashboard navigation={navigation} />
                </View>
              )}
              {activeTab === 'clubs' && (
                <View style={{ flex: 1, backgroundColor: COLORS.background }}>
                  <ClubAccessScreen navigation={navigation} />
                </View>
              )}
              {activeTab === 'resources' && (
                <View style={{ padding: 16 }}>
                  {renderResourcesTab()}
                </View>
              )}
              {activeTab === 'personal' && (
                <View style={{ padding: 16, gap: 24, paddingBottom: 60 }}>
                  
                  {/* Visuals Group */}
                  <View style={styles.heroCard}>
                    <View style={styles.heroHeader}>
                      <View style={[styles.toolIconBg, { backgroundColor: COLORS.primary + '15' }]}>
                        <Palette size={20} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eyebrow}>Visuals</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.textPrimary }}>Appearance</Text>
                      </View>
                    </View>

                    <View style={{ gap: 16 }}>
                      {/* Theme Selector */}
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Theme Mode</Text>
                        <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)', borderRadius: 14, padding: 4 }}>
                          {['light', 'dark'].map((mode) => {
                            const selected = theme === mode;
                            return (
                              <Pressable
                                key={mode}
                                onPress={() => setTheme(mode)}
                                style={{
                                  flex: 1,
                                  height: 36,
                                  borderRadius: 10,
                                  backgroundColor: selected ? (isDark ? 'rgba(255,255,255,0.1)' : '#FFF') : 'transparent',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexDirection: 'row',
                                  gap: 6,
                                  ...(selected && { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 })
                                }}
                              >
                                {mode === 'light' ? <Sun size={14} color={selected ? COLORS.primary : COLORS.textTertiary} /> : <Moon size={14} color={selected ? COLORS.primary : COLORS.textTertiary} />}
                                <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? COLORS.textPrimary : COLORS.textTertiary }}>
                                  {mode === 'light' ? 'Light' : 'Dark'}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* Accent Picker */}
                      <View>
                         <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Accent Color</Text>
                         <Pressable 
                           onPress={() => setShowColorPicker(true)}
                           style={{ 
                             flexDirection: 'row', 
                             alignItems: 'center', 
                             backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                             borderRadius: 16,
                             padding: 12,
                             borderWidth: 1,
                             borderColor: COLORS.border
                           }}
                         >
                           <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: accentColor, marginRight: 12, borderWidth: 2, borderColor: '#FFF' }} />
                           <View style={{ flex: 1 }}>
                             <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textPrimary }}>Custom Tint</Text>
                             <Text style={{ fontSize: 12, color: COLORS.textTertiary }}>{accentColor?.toUpperCase()}</Text>
                           </View>
                           <View style={{ backgroundColor: COLORS.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
                             <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary }}>Change</Text>
                           </View>
                         </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Notifications Group */}
                  <View style={styles.heroCard}>
                    <View style={styles.heroHeader}>
                      <View style={[styles.toolIconBg, { backgroundColor: '#F59E0B' + '15' }]}>
                        <Bell size={20} color="#F59E0B" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eyebrow}>Experience</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.textPrimary }}>Notifications</Text>
                      </View>
                      <Switch 
                        value={eventNotifications && placeNotifications && pingNotifications}
                        onValueChange={(v) => {
                          setNotificationPreference('event', v);
                          setNotificationPreference('place', v);
                          setNotificationPreference('ping', v);
                        }}
                        trackColor={{ false: COLORS.border, true: COLORS.primary }}
                        thumbColor="#FFF"
                      />
                    </View>

                    <View style={{ gap: 4 }}>
                      {[
                        { label: 'Event Reminders', val: eventNotifications, key: 'event' as const },
                        { label: 'Transit Alerts', val: placeNotifications, key: 'place' as const },
                        { label: 'Social Pings', val: pingNotifications, key: 'ping' as const },
                      ].map((item, idx) => (
                        <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                           <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>{item.label}</Text>
                           <Switch 
                             value={item.val}
                             onValueChange={(v) => setNotificationPreference(item.key, v)}
                             scaleX={0.8} scaleY={0.8}
                             trackColor={{ false: COLORS.border, true: COLORS.primary }}
                             thumbColor="#FFF"
                           />
                        </View>
                      ))}

                      <View style={{ marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                         <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Lead Time</Text>
                         <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4 }}>
                            {[
                              { id: 5, label: '5m' },
                              { id: 10, label: '10m' },
                              { id: 15, label: '15m' },
                              { id: 30, label: '30m' },
                              { id: 60, label: '1h' },
                            ].map((opt) => {
                              const selected = notificationLeadTime === opt.id;
                              return (
                                <Pressable
                                  key={opt.id}
                                  onPress={() => setNotificationLeadTime(opt.id)}
                                  style={{
                                    flex: 1,
                                    height: 32,
                                    borderRadius: 8,
                                    backgroundColor: selected ? (isDark ? 'rgba(255,255,255,0.1)' : '#FFF') : 'transparent',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    ...(selected && { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 })
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? COLORS.textPrimary : COLORS.textTertiary }}>{opt.label}</Text>
                                </Pressable>
                              );
                            })}
                         </View>
                      </View>
                    </View>
                  </View>

                  {/* Settings Utility Section */}
                  <View style={{ gap: 12 }}>
                    <Text style={[styles.sectionHeading, { marginLeft: 4 }]}>Account & Activity</Text>
                    
                    <View style={styles.heroCard}>
                      <Pressable onPress={() => setShowSavedPingsModal(true)}>
                        <View style={styles.modernSettingRow}>
                          <View style={[styles.toolIconBg, { backgroundColor: '#3B82F6' + '15' }]}>
                            <BookmarkIcon size={20} color="#3B82F6" />
                          </View>
                          <Text style={styles.modernSettingLabel}>Saved Pings</Text>
                          <ChevronRight size={20} color={COLORS.textTertiary} />
                        </View>
                      </Pressable>

                      <View style={{ height: 1, backgroundColor: COLORS.border }} />

                      <Pressable onPress={() => setShowBlockedPanel(prev => !prev)}>
                        <View style={styles.modernSettingRow}>
                          <View style={[styles.toolIconBg, { backgroundColor: '#EF4444' + '15' }]}>
                            <Ban size={20} color="#EF4444" />
                          </View>
                          <Text style={styles.modernSettingLabel}>Blocked Users</Text>
                          <ChevronRight 
                            size={20} 
                            color={COLORS.textTertiary} 
                            style={{ transform: [{ rotate: showBlockedPanel ? '90deg' : '0deg' }] }}
                          />
                        </View>
                      </Pressable>

                      {showBlockedPanel && (
                        <View style={{ paddingBottom: 12 }}>
                          {renderBlockedTab && renderBlockedTab(true, true)}
                        </View>
                      )}

                      <View style={{ height: 1, backgroundColor: COLORS.border }} />

                      <Pressable
                        onPress={() => {
                          useAppShellStore.setState({
                            isNameOnboardingCompleted: false,
                            showNameOnboarding: true,
                            isEventPreferencesCompleted: false,
                            showEventPreferencesOnboarding: true,
                          });
                        }}
                      >
                        <View style={styles.modernSettingRow}>
                          <View style={[styles.toolIconBg, { backgroundColor: '#2F80ED' + '15' }]}>
                            <Sparkles size={20} color="#2F80ED" />
                          </View>
                          <Text style={styles.modernSettingLabel}>Retake Onboarding</Text>
                          <ChevronRight size={20} color={COLORS.textTertiary} />
                        </View>
                      </Pressable>
                    </View>

                    <View style={styles.heroCard}>
                       <Pressable style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }} onPress={() => openExternal('https://www.termsfeed.com/live/2fc33440-a5a9-4943-a1da-d3c5d5abc1e5')}>
                          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>Terms of Service</Text>
                          <ExternalLink size={16} color={COLORS.textTertiary} />
                       </Pressable>
                       <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 8 }} />
                       <Pressable style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }} onPress={() => openExternal('https://www.termsfeed.com/live/4889a318-ae78-48e2-975d-2eddfe043866')}>
                          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>Privacy Policy</Text>
                          <ExternalLink size={16} color={COLORS.textTertiary} />
                       </Pressable>
                       <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 8 }} />
                       <Pressable style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }} onPress={() => openExternal(SUPPORT_CONTACT_URL)}>
                          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>Support Help Center</Text>
                          <LifeBuoy size={16} color={COLORS.textTertiary} />
                       </Pressable>
                    </View>
                  </View>
                
                <Pressable onPress={handleLogout} style={{ marginTop: 20, padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.textTertiary, fontWeight: '700' }}>Log Out</Text>
                </Pressable>

                <Pressable 
                  onPress={handleDeleteAccount}
                  style={{ marginTop: 4, padding: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.danger, fontWeight: '700' }}>Delete Account</Text>
                </Pressable>
              </View>
            )}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB for Creating Ping */}
      {activeTab === 'pings' && (
        <ScalePressable 
          style={{
            position: 'absolute',
            bottom: 20, 
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            zIndex: 999
          }} 
          onPress={() => setComposerVisible(true)}
        >
          <Plus size={30} color="#FFF" />
        </ScalePressable>
      )}
      {storyViewerVisible && activeStoryUser && (
        <StoryViewer 
          visible={storyViewerVisible}
          onClose={handleCloseStoryViewer}
          pings={activeStoryUser.pings}
          userName={activeStoryUser.name}
          userImage={activeStoryUser.image}
          onNextUser={handleNextStoryUser}
          onPrevUser={handlePrevStoryUser}
        />
      )}

      {renderFriendsModal()}
      {renderSavedPingsModal()}
      {renderEnlargedPostModal()}

      <PingCommentsModal 
        visible={!!activeCommentsPing}
        target={activeCommentsPing ? {
          activityId: activeCommentsPing.activityId || activeCommentsPing.id,
          title: activeCommentsPing.title,
          subtitle: activeCommentsPing.category
        } : null}
        onClose={() => setActiveCommentsPing(null)}
        onCommentPosted={() => {
          queryClient.invalidateQueries({ queryKey: ['user-pings'] });
          queryClient.invalidateQueries({ queryKey: ['campus-pings'] });
        }}
      />
      <Modal
        visible={showColorPicker}
        transparent
        animationType="slide"
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: COLORS.surface, 
            borderTopLeftRadius: 32, 
            borderTopRightRadius: 32, 
            padding: 24,
            paddingBottom: 40,
            minHeight: 520,
            alignItems: 'center'
          }}>
            <View style={{ width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginBottom: 20 }} />
            <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 30 }}>Personalize Accent</Text>
            
            <View style={{ flexDirection: 'row', width: '100%', height: 280, gap: 16 }}>
              {/* SV Square */}
              <View 
                style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: `hsl(${accentColor.match(/hsl\((\d+)/)?.[1] || 0}, 100%, 50%)` }}
                onStartShouldSetResponderCapture={() => true}
                onMoveShouldSetResponderCapture={() => true}
                onResponderGrant={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  const h = parseInt(accentColor.match(/hsl\((\d+)/)?.[1] || '0', 10);
                  const s = Math.max(0, Math.min(100, (locationX / 180) * 100));
                  const v = Math.max(0, Math.min(100, 100 - (locationY / 280) * 100));
                  
                  // Correct HSV to HSL conversion 
                  const l = (v / 100) * (1 - (s / 100) / 2) * 100;
                  const sl = (l === 0 || l === 100) ? 0 : ((v / 100 - l / 100) / Math.min(l / 100, 1 - l / 100)) * 100;
                  
                  setAccentColor(`hsl(${h}, ${Math.round(sl)}%, ${Math.round(l)}%)`);
                  setPickerPos({ x: locationX, y: locationY });
                }}
                onResponderMove={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  const h = parseInt(accentColor.match(/hsl\((\d+)/)?.[1] || '0', 10);
                  const s = Math.max(0, Math.min(100, (locationX / 180) * 100));
                  const v = Math.max(0, Math.min(100, 100 - (locationY / 280) * 100));
                  
                  const l = (v / 100) * (1 - (s / 100) / 2) * 100;
                  const sl = (l === 0 || l === 100) ? 0 : ((v / 100 - l / 100) / Math.min(l / 100, 1 - l / 100)) * 100;
                  
                  setAccentColor(`hsl(${h}, ${Math.round(sl)}%, ${Math.round(l)}%)`);
                  setPickerPos({ x: locationX, y: locationY });
                }}
              >
                <LinearGradient 
                  colors={['#FFF', 'transparent']} 
                  start={{ x: 0, y: 0.5 }} 
                  end={{ x: 1, y: 0.5 }} 
                  style={StyleSheet.absoluteFill} 
                />
                <LinearGradient 
                  colors={['transparent', '#000']} 
                  style={StyleSheet.absoluteFill} 
                />
                {/* Visual Selector Circle */}
                <View style={{ 
                  position: 'absolute', 
                  width: 24, 
                  height: 24, 
                  borderRadius: 12, 
                  borderWidth: 3, 
                  borderColor: '#FFF', 
                  left: pickerPos.x - 12,
                  top: pickerPos.y - 12,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4
                }} />
              </View>

              {/* Hue Slider */}
              <View 
                style={{ width: 40, borderRadius: 20, overflow: 'hidden' }}
                onStartShouldSetResponderCapture={() => true}
                onMoveShouldSetResponderCapture={() => true}
                onResponderGrant={(e) => {
                  const { locationY } = e.nativeEvent;
                  const h = Math.round((Math.max(0, Math.min(280, locationY)) / 280) * 360);
                  const matches = accentColor.match(/hsl\(\d+,\s*(\d+)%,\s*(\d+)%\)/);
                  const s = matches ? matches[1] : 100;
                  const l = matches ? matches[2] : 50;
                  setAccentColor(`hsl(${h}, ${s}%, ${l}%)`);
                  setHuePos(locationY);
                }}
                onResponderMove={(e) => {
                  const { locationY } = e.nativeEvent;
                  const h = Math.round((Math.max(0, Math.min(280, locationY)) / 280) * 360);
                  const matches = accentColor.match(/hsl\(\d+,\s*(\d+)%,\s*(\d+)%\)/);
                  const s = matches ? matches[1] : 100;
                  const l = matches ? matches[2] : 50;
                  setAccentColor(`hsl(${h}, ${s}%, ${l}%)`);
                  setHuePos(locationY);
                }}
              >
                <LinearGradient
                  colors={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']}
                  style={StyleSheet.absoluteFill}
                />
                {/* Visual Selector Bar */}
                <View style={{ 
                  position: 'absolute', 
                  width: '100%', 
                  height: 8, 
                  backgroundColor: '#FFF', 
                  top: huePos - 4,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.2)',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 4
                }} />
              </View>
            </View>

            <View style={{ width: '100%', flexDirection: 'row', gap: 12, marginTop: 40 }}>
              <Pressable 
                onPress={() => {
                  setAccentColor(getDefaultAccentColor(theme));
                  setShowColorPicker(false);
                }}
                style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}
              >
                <Text style={{ fontWeight: '700', color: COLORS.textTertiary }}>Reset</Text>
              </Pressable>
              
              <Pressable 
                onPress={() => setShowColorPicker(false)}
                style={{ flex: 2, height: 56, borderRadius: 16, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontWeight: '700', color: '#FFF' }}>Confirm Choice</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PingComposerModal
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        user={user}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['campus-pings', API_URL] });
          queryClient.invalidateQueries({ queryKey: ['user-pings', API_URL, user?.id] });
          setTimeout(() => {
            queryClient.refetchQueries({ queryKey: ['user-pings', API_URL, user?.id] });
          }, 1500);
        }}
      />
    </WallpaperWrapper>
  </View>
);
}

const getStyles = (COLORS: any, isDark: boolean, accentColor: string) =>
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
    // Modern Profile Header Styles
    modernProfileHeader: {
      marginBottom: 0,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    modernAvatarWrapper: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 1.5,
      borderColor: COLORS.textPrimary,
      padding: 2,
    },
    modernAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 40,
    },
    modernAvatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modernAvatarText: {
      fontSize: 32,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    headerStatsRow: {
      flexDirection: 'row',
      flex: 1,
      justifyContent: 'space-around',
      marginLeft: 20,
    },
    modernStatCard: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 20,
      paddingVertical: 10,
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
    bioSection: {
      marginBottom: 16,
    },
    modernName: {
      fontSize: 16,
      fontWeight: '900',
      color: COLORS.textPrimary,
    },
    modernBio: {
      fontSize: 14,
      color: COLORS.textPrimary,
      marginTop: 2,
      lineHeight: 20,
    },
    headerActionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    editProfileButton: {
      flex: 1,
      height: 50,
      borderRadius: 25,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editProfileText: {
      fontSize: 16,
      fontWeight: '900',
      color: '#FFF',
    },
    shareProfileButton: {
      flex: 1,
      height: 36,
      borderRadius: 8,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    shareProfileText: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    // Recent Posts Grid Styles
    recentPostsSection: {
      marginBottom: 24,
    },
    sectionHeading: {
      fontSize: 14,
      fontWeight: '900',
      color: COLORS.textPrimary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    postsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 1,
      paddingHorizontal: 0,
    },
    postSquare: {
      width: '33.33%',
      aspectRatio: 3 / 4,
      backgroundColor: COLORS.surfaceElevated,
      overflow: 'hidden',
      position: 'relative',
    },
    pinOverlay: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 4,
      padding: 4,
    },
    multiMediaIcon: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 4,
      padding: 4,
    },
    postImage: {
      width: '100%',
      height: '100%',
    },
    postFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    // Modern Settings Row
    settingsSection: {
      backgroundColor: isDark ? 'rgba(18,18,20,0.82)' : 'rgba(255,255,255,0.86)',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      marginBottom: 16,
    },
    modernSettingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 12,
    },
    modernSettingLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.textPrimary,
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
      width: 40,
      height: 40,
      borderRadius: 14,
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
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: isDark ? 'rgba(12,12,14,0.9)' : 'rgba(80,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    listAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(12,12,14,0.9)' : 'rgba(80,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    listAvatarImage: {
      width: '100%',
      height: '100%',
    },
    listAvatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    avatarText: {
      fontSize: 22,
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
      paddingVertical: 10,
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
      width: 38,
      height: 38,
      borderRadius: 12,
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
    friendSearchToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    friendSearchToggleText: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    friendSearchCard: {
      marginTop: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      padding: 12,
    },
    friendSearchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
    },
    friendSearchInput: {
      flex: 1,
      minHeight: 44,
      color: COLORS.textPrimary,
      fontSize: 14,
    },
    friendSearchEmpty: {
      marginTop: 12,
      color: COLORS.textSecondary,
      fontSize: 14,
    },
    friendActionButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    friendActionButtonDisabled: {
      opacity: 0.65,
    },
    friendActionButtonText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    friendActionButtonTextDisabled: {
      color: COLORS.textSecondary,
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
    // Redesign Styles
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
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    profileTabButtonActive: {
      borderBottomColor: COLORS.textPrimary,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalSubmitButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    modalInput: {
      fontSize: 15,
      color: COLORS.textPrimary,
    },
    editProfileCard: {
      padding: 16,
      borderRadius: 16,
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    changePhotoButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 99,
      alignSelf: 'center',
      minWidth: 60,
      alignItems: 'center',
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      height: 48,
    },
    textInput: {
      flex: 1,
      paddingHorizontal: 12,
      color: COLORS.textPrimary,
      fontSize: 15,
    },
    inputHint: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: 8,
      lineHeight: 18,
    },
    charCount: {
      position: 'absolute',
      bottom: 8,
      right: 12,
      fontSize: 12,
      color: COLORS.textTertiary,
    },
    toggleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
    },
    secondaryLogoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCardWrapper: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCard: {
      width: '90%',
      height: '75%',
      borderRadius: 28,
      overflow: 'hidden',
      elevation: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
    },
    modalCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 16,
    },
    modalCardTitle: {
      fontSize: 17,
      fontWeight: '800',
    },
    modalCardClose: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardSearchContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    cardSearchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    cardSearchInput: {
      flex: 1,
      fontSize: 16,
      height: '100%',
    },
    modalFriendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    friendCardActionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
  });
