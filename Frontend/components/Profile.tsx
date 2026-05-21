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
import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import {
  BriefcaseBusiness,
  Building2,
  Camera,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  Flame,
  GraduationCap,
  Instagram,
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
  LifeBuoy,
  CalendarDays,
  CalendarCheck2,
  X,
  LayoutGrid,
  Bookmark as BookmarkIcon,
  Heart,
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
  Pizza,
  Megaphone,
  Utensils,
} from 'lucide-react-native';
import { useClerk, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Plus } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchCampusOverview, fetchSchedules, fetchUserProfile } from '../api/client';
import { SUPPORT_CONTACT_URL } from '../config';
import { PARKING_PERMIT_OPTIONS, useAppShellStore } from '../store/appShellStore';
import { useSessionStore } from '../store/sessionStore';
import { useEventStore } from '../store/eventStore';
import {
  addFriend,
  deleteAccount,
  getBlockedUsers,
  getFriendRequests,
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
import { CATEGORY_META, classifyCategory } from './events/EventUtils';
import { Calendar } from 'react-native-calendars';

const PROFILE_TABS = [
  { key: 'pings', icon: LayoutGrid },
  { key: 'saved', icon: Heart },
  { key: 'schedules', icon: CalendarCheck2 },
  { key: 'nutrition', icon: Utensils },
  { key: 'resources', icon: LibraryBig },
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

function splitDisplayName(name: string | null | undefined) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export function Profile() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { scheduleEvent, saveEvent, scheduledEvents } = useEventStore();
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
  const {
    data: friendRequests = { incoming: [], outgoing: [] },
    refetch: refetchFriendRequests,
    isLoading: loadingFriendRequests,
  } = useQuery({
    queryKey: ['campus-ping-friend-requests', API_URL, user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { incoming: [], outgoing: [] };
      }
      return await getFriendRequests(user.id);
    },
    enabled: !!user?.id,
  });

  const userDisplayName = useAppShellStore((state) => state.userDisplayName);
  const userBio = useAppShellStore((state) => state.userBio);
  const userGender = useAppShellStore((state) => state.userGender);
  const showPingsOnProfile = useAppShellStore((state) => state.showPingsOnProfile);
  const setUserProfile = useAppShellStore((state) => state.setUserProfile);
  const resolvedDisplayName = userDisplayName || user?.fullName || '';

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

  const { data: academicSchedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['profile-academic-schedules', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const result = await fetchSchedules(user.id);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
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
        name: uid === user?.id ? (resolvedDisplayName || user?.username || user?.firstName || 'Me') : first.userName,
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
  }, [allFeedPings, user, viewedStoryIds, resolvedDisplayName]);

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
  const profileTabUnderlineLeft = useSharedValue(0);
  const profileTabUnderlineWidth = useSharedValue(0);
  const profileTabUnderlineAnimatedStyle = useAnimatedStyle(() => ({
    left: profileTabUnderlineLeft.value,
    width: profileTabUnderlineWidth.value,
  }));

  const [academicStatus, setAcademicStatus] = useState<any | null>(null);
  const [loadingAcademicStatus, setLoadingAcademicStatus] = useState(true);
  const [accentSliderWidth, setAccentSliderWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('pings');
  const [profileTabLayouts, setProfileTabLayouts] = useState<Record<ProfileTabKey, { x: number; width: number } | undefined>>({
    pings: undefined,
    saved: undefined,
    schedules: undefined,
    nutrition: undefined,
    resources: undefined,
  });
  const {
    eventNotifications,
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
  const [composerVisible, setComposerVisible] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.openComposer) {
      setComposerVisible(true);
      navigation.setParams({ openComposer: undefined });
    }
  }, [route.params?.openComposer]);

  const initialNameParts = useMemo(() => splitDisplayName(resolvedDisplayName), [resolvedDisplayName]);
  const [firstName, setFirstName] = useState(initialNameParts.firstName);
  const [lastName, setLastName] = useState(initialNameParts.lastName);
  const editedDisplayName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const [bio, setBio] = useState(userBio);
  const [gender, setGender] = useState(userGender);

  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const scrollRef = React.useRef<ScrollView | null>(null);

  const [activeCommentsPing, setActiveCommentsPing] = useState<any | null>(null);
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  useEffect(() => {
    const targetLayout = profileTabLayouts[activeTab];
    if (!targetLayout) return;

    profileTabUnderlineLeft.value = withSpring(targetLayout.x, {
      damping: 26,
      stiffness: 240,
      mass: 0.9,
    });
    profileTabUnderlineWidth.value = withSpring(targetLayout.width, {
      damping: 26,
      stiffness: 240,
      mass: 0.9,
    });
  }, [activeTab, profileTabLayouts, profileTabUnderlineLeft, profileTabUnderlineWidth]);

  useEffect(() => {
    setFirstName(initialNameParts.firstName);
    setLastName(initialNameParts.lastName);
  }, [initialNameParts]);

  useEffect(() => {
    if (!isFocused || !route.params?.openEditProfile) return;
    setShowEditProfile(true);
    navigation.setParams({ openEditProfile: false });
  }, [isFocused, navigation, route.params?.openEditProfile]);

  useEffect(() => {
    if (!isFocused || !route.params?.openFriendsManager) return;
    setShowFriendsModal(true);
    navigation.setParams({ openFriendsManager: false });
  }, [isFocused, navigation, route.params?.openFriendsManager]);

  useEffect(() => {
    if (showFriendsModal) return;
    setFriendSearchQuery('');
    setFriendSearchResults([]);
    setSearchingFriends(false);
  }, [showFriendsModal]);

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

  const openEventsTab = useCallback((params?: Record<string, any>) => {
    navigation.navigate('Main', {
      screen: 'Dashboard',
      params,
    });
  }, [navigation]);

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
        full_name: editedDisplayName,
        bio: bio,
      });

      setUserProfile({ bio, gender, displayName: editedDisplayName });
      setShowEditProfile(false);
      
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ['user-pings', API_URL, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['campus-pings', API_URL] });
      
      Alert.alert('Profile Saved', 'Your changes have been updated and synced.');
    } catch (err) {
      console.warn('Failed to save profile:', err);
      // Still update locally for responsiveness
      setUserProfile({ bio, gender, displayName: editedDisplayName });
      setShowEditProfile(false);
      Alert.alert('Sync Error', 'Your changes were saved locally but could not sync with the server. Please try again later.');
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
    if (!user?.id || !showFriendsModal) {
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
  }, [friendSearchQuery, showFriendsModal, user?.id]);

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
    await Promise.all([refetchFriends(), refetchFriendRequests()]);
    queryClient.invalidateQueries({ queryKey: ['campus-ping-friends'] });
  };

  const incomingFriendRequests = friendRequests?.incoming || [];
  const outgoingFriendRequests = friendRequests?.outgoing || [];

  const getConnectionStatus = useCallback((entry: any) => {
    if (entry?.relationship_status) return entry.relationship_status;
    if (entry?.is_friend) return 'accepted';
    if (entry?.request_received) return 'incoming_pending';
    if (entry?.request_sent) return 'outgoing_pending';
    return 'none';
  }, []);

  const updateSearchRelationshipState = useCallback((targetId: string, relationshipStatus: string) => {
    setFriendSearchResults((current) =>
      current.map((item) =>
        item.id === targetId
          ? {
              ...item,
              relationship_status: relationshipStatus,
              is_friend: relationshipStatus === 'accepted',
              request_sent: relationshipStatus === 'outgoing_pending',
              request_received: relationshipStatus === 'incoming_pending',
            }
          : item,
      ),
    );
  }, []);

  const getConnectionActionLabel = useCallback((entry: any) => {
    const relationshipStatus = getConnectionStatus(entry);
    if (relationshipStatus === 'accepted') return 'Remove';
    if (relationshipStatus === 'incoming_pending') return 'Accept';
    if (relationshipStatus === 'outgoing_pending') return 'Pending';
    return 'Connect';
  }, [getConnectionStatus]);

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

  const handleConnectionAction = async (targetId: string, name?: string, relationshipStatus = 'none') => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be signed in to manage connections.');
      return;
    }
    try {
      if (relationshipStatus === 'accepted') {
        await removeFriend(targetId, user.id);
        updateSearchRelationshipState(targetId, 'none');
        await loadFriends();
        Alert.alert('Friend removed', `${name || 'User'} has been removed from your friends.`);
        return;
      }

      if (relationshipStatus === 'outgoing_pending') {
        await removeFriend(targetId, user.id);
        updateSearchRelationshipState(targetId, 'none');
        await loadFriends();
        Alert.alert('Request canceled', `Your friend request to ${name || 'this user'} was canceled.`);
        return;
      }

      const result = await addFriend(targetId, user.id);
      const action = result?.friendship?.action;
      if (action === 'accepted' || relationshipStatus === 'incoming_pending') {
        updateSearchRelationshipState(targetId, 'accepted');
        await loadFriends();
        Alert.alert('Now Friends!', `${name || 'User'} is now your friend.`);
        return;
      }
      if (action === 'already_connected') {
        updateSearchRelationshipState(targetId, 'accepted');
        await loadFriends();
        Alert.alert('Already Friends', `${name || 'User'} is already in your friends list.`);
        return;
      }
      updateSearchRelationshipState(targetId, 'outgoing_pending');
      await loadFriends();
      Alert.alert(
        action === 'request_pending' ? 'Already Sent' : 'Request Sent',
        action === 'request_pending'
          ? `Your friend request to ${name || 'this user'} is still pending.`
          : `${name || 'User'} will be notified of your friend request.`,
      );
    } catch (err) {
      console.warn('Failed to update connection', err);
      Alert.alert('Error', 'Failed to update connection.');
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
                  {editedDisplayName || resolvedDisplayName || user?.username || user?.firstName}
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
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>FIRST NAME</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First name"
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>LAST NAME</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last name"
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
       <View style={styles.modernHeaderTopRow}>
         <View style={styles.profileHeaderTitleWrap}>
           <View style={styles.profileHeaderTitleRow}>
             <View style={styles.profileHeaderBadge}>
               <UserRound size={14} color={COLORS.textPrimary} />
             </View>
             <Text style={styles.profileHeaderTitle}>Profile</Text>
           </View>
         </View>
         <Pressable
           onPress={() => navigation.navigate('ProfileSettings')}
           style={styles.profileSettingsButton}
           accessibilityRole="button"
           accessibilityLabel="Open settings"
         >
           <Settings size={18} color={COLORS.textPrimary} />
         </Pressable>
       </View>

       <View style={styles.profileIdentityBlock}>
         <View style={styles.profileTopRow}>
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
             style={styles.modernAvatarWrapper}
           >
             <View style={styles.modernAvatarInner}>
               {user?.imageUrl ? (
                 <Image source={{ uri: user.imageUrl }} style={styles.modernAvatarImage} />
               ) : (
                 <View style={[styles.modernAvatarPlaceholder, { backgroundColor: COLORS.surfaceElevated }]}>
                   <Text style={[styles.modernAvatarText, { fontSize: 40 }]}>{user?.firstName?.[0] || 'U'}</Text>
                 </View>
               )}
             </View>
             <View style={styles.avatarCameraBadge}>
               <Camera size={14} color={COLORS.textPrimary} />
             </View>
           </ScalePressable>

           <View style={styles.profileStatsRow}>
             <ScalePressable 
               containerStyle={styles.profileStatContainer}
               style={styles.profileStatButton}
               onPress={() => setShowFriendsModal(true)}
             >
               <Text style={styles.modernStatValue}>{friends.length || 0}</Text>
               <Text style={styles.modernStatLabel}>Friends</Text>
             </ScalePressable>
             <ScalePressable 
               containerStyle={styles.profileStatContainer}
               style={styles.profileStatButton}
             >
               <Text style={styles.modernStatValue}>{userPings.length || 0}</Text>
               <Text style={styles.modernStatLabel}>Pings</Text>
             </ScalePressable>
           </View>
         </View>

        <View style={styles.profileIdentityText}>
          <View style={styles.profileNameRow}>
            <Text style={styles.modernName}>{resolvedDisplayName || user?.fullName || 'Aggie User'}</Text>
            <Pressable
              onPress={() => setShowEditProfile(true)}
              style={styles.profileEditButton}
            >
              <Text style={styles.profileEditButtonText}>Edit profile</Text>
            </Pressable>
          </View>
          {bio?.trim() ? (
            <Text style={styles.modernBio} numberOfLines={3}>
              {bio.trim()}
            </Text>
          ) : null}
        </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <Pizza size={20} color="#FF7A3E" />
            <Flame size={20} color="#A462F4" />
            <Megaphone size={20} color="#FF8B52" />
          </View>
          <Text style={{ color: COLORS.textTertiary, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            No pings yet.
          </Text>
          <Text style={{ color: COLORS.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
            Make your mark on the world.
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
      <View style={styles.postsGrid}>
        {sortedPings.map((post, idx) => {
          return (
            <ScalePressable 
              key={post.id || idx} 
              style={[styles.postSquare, {
                width: Math.floor((Dimensions.get('window').width - 44) / 3),
                height: Math.floor((Dimensions.get('window').width - 44) / 3) * 1.33
              }]}
              onPress={() => setSelectedPing(post)}
            >
              {post.imageUrl ? (
                <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
              ) : (
                <View style={styles.postFallback}>
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
                        pressNudgeY={-10}
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
                        pressNudgeY={10}
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

  const renderConnectionRow = (item: any) => {
    const displayName = item.full_name || item.name || 'Aggie User';
    const subtitle = item.username ? `@${item.username}` : item.major || null;
    return (
    <Pressable
      key={item.id}
      style={styles.modalFriendRow}
      onPress={() => {
        setShowFriendsModal(false);
        navigation.navigate('PublicProfile', {
          targetUserId: item.id,
          targetUserName: displayName,
          targetUserImage: item.profile_image_url || null,
          isAnonymous: false,
        });
      }}
    >
      <View style={styles.listAvatar}>
        {item.profile_image_url ? (
          <Image source={{ uri: item.profile_image_url }} style={styles.listAvatarImage} />
        ) : (
          <View style={[styles.listAvatarImage, { backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{displayName?.[0] || 'U'}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>{displayName}</Text>
        {subtitle ? (
          <Text style={{ color: COLORS.textTertiary, fontSize: 13 }} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      <Pressable
        style={[
          styles.friendCardActionButton,
          { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
        ]}
        onPress={(e) => {
          e.stopPropagation();
          handleConnectionAction(item.id, item.name, getConnectionStatus(item));
        }}
      >
        <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 13 }}>
          {getConnectionActionLabel(item)}
        </Text>
      </Pressable>
    </Pressable>
    );
  };
  
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
              <Text style={[styles.modalCardTitle, { color: COLORS.textPrimary }]}>Connections</Text>
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
                    friendSearchResults.map((item) => renderConnectionRow(item))
                  ) : (
                    <View style={styles.modalEmptyState}>
                      <Text style={{ color: COLORS.textTertiary }}>No users found.</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  {loadingFriends || loadingFriendRequests ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                  ) : incomingFriendRequests.length > 0 || outgoingFriendRequests.length > 0 || friends.length > 0 ? (
                    <View>
                      {incomingFriendRequests.length > 0 ? (
                        <View style={{ marginBottom: 20 }}>
                          <Text style={{ color: COLORS.textTertiary, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                            Requests To Review
                          </Text>
                          {incomingFriendRequests.map((item) => renderConnectionRow(item))}
                        </View>
                      ) : null}
                      {outgoingFriendRequests.length > 0 ? (
                        <View style={{ marginBottom: 20 }}>
                          <Text style={{ color: COLORS.textTertiary, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                            Pending Requests
                          </Text>
                          {outgoingFriendRequests.map((item) => renderConnectionRow(item))}
                        </View>
                      ) : null}
                      {friends.length > 0 ? (
                        <View>
                          <Text style={{ color: COLORS.textTertiary, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                            Friends
                          </Text>
                          {friends.map((item) => renderConnectionRow(item))}
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.modalEmptyState}>
                      <UserRound size={48} color={COLORS.textTertiary} strokeWidth={1} />
                      <Text style={{ color: COLORS.textTertiary, marginTop: 12 }}>No connections yet</Text>
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

  const formatEventDate = (value: string | number | null | undefined) => {
    if (!value) return 'TBA';
    const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBA';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTermName = (code: string) => {
    if (!code) return 'Unknown term';
    const year = code.substring(0, 4);
    const suffix = code.substring(4);
    const seasonMap: Record<string, string> = {
      '11': 'Spring',
      '21': 'Summer',
      '22': 'Summer I',
      '23': 'Summer II',
      '31': 'Fall',
      '32': 'Fall (2)',
      '41': 'Winter',
    };
    const season = seasonMap[suffix] || `Term ${suffix}`;
    return `${season} ${year}`;
  };

  const renderSavedEventsTab = () => {
    // Build markedDates from scheduledEvents
    const markedDates: Record<string, any> = {};
    scheduledEvents.forEach((event) => {
      const dateStr = event.date_iso
        ? event.date_iso.slice(0, 10)
        : event.date_ts
        ? new Date(event.date_ts * 1000).toISOString().slice(0, 10)
        : null;
      if (!dateStr) return;
      const eventCategory = classifyCategory(event as any);
      const eventMeta = CATEGORY_META[eventCategory];
      const dot = { key: event.id, color: eventMeta?.cardTint || COLORS.primary };
      if (!markedDates[dateStr]) {
        markedDates[dateStr] = { dots: [dot] };
      } else {
        markedDates[dateStr].dots = [...(markedDates[dateStr].dots || []), dot];
      }
    });

    // Highlight selected date
    if (selectedCalendarDate) {
      markedDates[selectedCalendarDate] = {
        ...(markedDates[selectedCalendarDate] || {}),
        selected: true,
        selectedColor: COLORS.primary,
        selectedTextColor: '#FFFFFF',
        dots: markedDates[selectedCalendarDate]?.dots || [],
      };
    }

    // Events for the selected date
    const selectedDayEvents = selectedCalendarDate
      ? scheduledEvents.filter((event) => {
          const dateStr = event.date_iso
            ? event.date_iso.slice(0, 10)
            : event.date_ts
            ? new Date(event.date_ts * 1000).toISOString().slice(0, 10)
            : null;
          return dateStr === selectedCalendarDate;
        })
      : [];

    const todayStr = new Date().toISOString().slice(0, 10);

    return (
      <View style={{ paddingBottom: 32 }}>
        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          current={selectedCalendarDate || todayStr}
          onDayPress={(day: any) => {
            setSelectedCalendarDate((prev) => (prev === day.dateString ? null : day.dateString));
          }}
          theme={{
            backgroundColor: COLORS.background,
            calendarBackground: COLORS.background,
            textSectionTitleColor: COLORS.textTertiary,
            selectedDayBackgroundColor: COLORS.primary,
            selectedDayTextColor: '#FFFFFF',
            todayTextColor: COLORS.primary,
            dayTextColor: COLORS.textPrimary,
            textDisabledColor: COLORS.textTertiary,
            dotColor: COLORS.primary,
            selectedDotColor: '#FFFFFF',
            arrowColor: COLORS.primary,
            monthTextColor: COLORS.textPrimary,
            indicatorColor: COLORS.primary,
            textDayFontWeight: '600',
            textMonthFontWeight: '800',
            textDayHeaderFontWeight: '700',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12,
          }}
          style={{
            borderRadius: 20,
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 4,
            overflow: 'hidden',
          }}
        />

        {/* Selected date event list */}
        {selectedCalendarDate ? (
          <View style={{ marginTop: 16 }}>
            <Text style={[
              styles.resourceListTitle,
              { paddingHorizontal: 20, marginBottom: 10, fontSize: 13, color: COLORS.textTertiary, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }
            ]}>
              {new Date(selectedCalendarDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            {selectedDayEvents.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, opacity: 0.6 }}>
                <CalendarDays size={28} color={COLORS.textTertiary} strokeWidth={1.5} />
                <Text style={{ color: COLORS.textTertiary, marginTop: 8, fontSize: 13, fontWeight: '500' }}>No events on this day</Text>
              </View>
            ) : (
              <View style={styles.resourceList}>
                {selectedDayEvents.map((event) => {
                  const eventCategory = classifyCategory(event as any);
                  const eventMeta = CATEGORY_META[eventCategory];
                  const EventIcon = eventMeta.icon;
                  return (
                    <Pressable
                      key={event.id}
                      style={styles.resourceListRow}
                      onPress={() => openEventsTab({ openEventDetail: event })}
                    >
                      <View style={[styles.resourceListIconWrap, { backgroundColor: eventMeta.cardTint }]}>
                        <EventIcon size={19} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resourceListTitle} numberOfLines={2}>{event.title}</Text>
                        <Text style={styles.resourceListMeta} numberOfLines={1}>
                          {formatEventDate(event.date_iso || event.date_ts)}{event.location ? ` • ${event.location}` : ''}
                        </Text>
                      </View>
                      <ChevronRight size={17} color={COLORS.textTertiary} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          /* No date selected — show all upcoming or empty state */
          scheduledEvents.length === 0 ? (
            <View style={styles.emptyTabState}>
              <Heart size={34} color={COLORS.textTertiary} strokeWidth={1.8} />
              <Text style={styles.emptyTabTitle}>No saved events yet</Text>
              <Text style={styles.emptyTabSubtitle}>Events you add to your calendar will show up here.</Text>
              <Pressable style={styles.emptyTabButton} onPress={() => openEventsTab()}>
                <Text style={styles.emptyTabButtonText}>Browse Events</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 20, opacity: 0.5 }}>
              <Text style={{ color: COLORS.textTertiary, fontSize: 13, fontWeight: '600' }}>Tap a date to see events</Text>
            </View>
          )
        )}
      </View>
    );
  };


  const renderSchedulesTab = () => {
    if (isLoadingSchedules) {
      return (
        <View style={styles.emptyTabState}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.emptyTabTitle}>Loading schedules...</Text>
        </View>
      );
    }

    if (!academicSchedules.length) {
      return (
        <View style={styles.emptyTabState}>
          <CalendarCheck2 size={34} color={COLORS.textTertiary} strokeWidth={1.8} />
          <Text style={styles.emptyTabTitle}>No schedules yet</Text>
          <Text style={styles.emptyTabSubtitle}>Create or edit an academic schedule builder plan and it will show up here.</Text>
          <Pressable style={styles.emptyTabButton} onPress={() => navigation.navigate('ScheduleList')}>
            <Text style={styles.emptyTabButtonText}>Open Schedules</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.tabSection}>
        {academicSchedules.map((schedule: any) => (
          <Pressable
            key={schedule.schedule_id}
            style={styles.listCard}
            onPress={() =>
              navigation.navigate('ScheduleDetail', {
                scheduleId: schedule.schedule_id,
                scheduleObj: schedule,
              })
            }
          >
            <View style={styles.listCardIconWrap}>
              <CalendarDays size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listCardTitle} numberOfLines={2}>{schedule.name}</Text>
              <Text style={styles.listCardMeta} numberOfLines={1}>
                {formatTermName(schedule.term_code)} • {schedule.section_ids?.length || 0} classes
              </Text>
            </View>
            <ChevronRight size={18} color={COLORS.textTertiary} />
          </Pressable>
        ))}
      </View>
    );
  };

  const renderResourcesTab = () => (
    <View style={styles.resourceSections}>
      <View style={styles.resourceList}>
        {[
          {
            key: 'instagram',
            title: 'Follow our Instagram!',
            icon: Instagram,
            iconColor: '#E1306C',
            iconBg: '#E1306C15',
            action: () => openExternal('https://www.instagram.com/tamumaroonlife/'),
          },
          {
            key: 'support',
            title: 'Support',
            subtitle: 'Get help or contact us with feedback.',
            icon: LifeBuoy,
            iconColor: '#0EA5E9',
            iconBg: '#0EA5E915',
            action: () => openExternal(SUPPORT_CONTACT_URL),
          },
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => item.action()}
            style={styles.resourceListRow}
          >
            <View style={[styles.resourceListIconWrap, { backgroundColor: item.iconBg }]}>
              <item.icon size={19} color={item.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resourceListTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.resourceListMeta}>{item.subtitle}</Text> : null}
            </View>
            <ChevronRight size={17} color={COLORS.textTertiary} />
          </Pressable>
        ))}
      </View>

      <View style={styles.resourceList}>
        <Text style={styles.resourceListHeading}>Academic & Campus</Text>

        {[
          {
            key: 'annex',
            title: 'Library Services',
            icon: LibraryBig,
            iconColor: '#00CFC7',
            iconBg: '#00CFC715',
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
          },
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => item.action()}
            style={styles.resourceListRow}
          >
            <View style={[styles.resourceListIconWrap, { backgroundColor: item.iconBg }]}>
              <item.icon size={19} color={item.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resourceListTitle}>{item.title}</Text>
            </View>
            <ChevronRight size={17} color={COLORS.textTertiary} />
          </Pressable>
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
                {profileTabLayouts[activeTab] ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.profileTabUnderline,
                      profileTabUnderlineAnimatedStyle,
                    ]}
                  />
                ) : null}
                {PROFILE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      style={[styles.profileTabButton, isActive && styles.profileTabButtonActive]}
                      onLayout={(event) => {
                        const { x, width } = event.nativeEvent.layout;
                        setProfileTabLayouts((current) => {
                          const previous = current[tab.key];
                          if (previous && previous.x === x && previous.width === width) {
                            return current;
                          }
                          return {
                            ...current,
                            [tab.key]: { x, width },
                          };
                        });
                      }}
                    >
                      <Icon size={24} color={isActive ? COLORS.textPrimary : COLORS.textTertiary} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Animated.View
              key={activeTab}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              style={{ flex: 1 }}
            >
              {activeTab === 'pings' && renderContentGrid(userPings)}
              {activeTab === 'nutrition' && (
                <View style={{ flex: 1, backgroundColor: COLORS.background }}>
                   <DiningDashboard navigation={navigation} />
                </View>
              )}
              {activeTab === 'saved' && (
                <View style={{ padding: 16 }}>
                  {renderSavedEventsTab()}
                </View>
              )}
              {activeTab === 'schedules' && (
                <View style={{ padding: 16 }}>
                  {renderSchedulesTab()}
                </View>
              )}
              {activeTab === 'resources' && (
                <View style={{ padding: 16 }}>
                  {renderResourcesTab()}
                </View>
              )}
            </Animated.View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
      <View
        pointerEvents="none"
        style={[
          styles.topSafeHeader,
          { height: Math.max(insets.top, 12) },
        ]}
      />

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

      {renderEditProfileModal()}
      {renderFriendsModal()}
      {renderSavedPingsModal()}
      {renderEnlargedPostModal()}

      <PingCommentsModal 
        visible={!!activeCommentsPing}
        target={activeCommentsPing ? {
          activityId: activeCommentsPing.activityId || activeCommentsPing.id,
          title: activeCommentsPing.title,
          subtitle: activeCommentsPing.category || undefined
        } : null}
        onClose={() => setActiveCommentsPing(null)}
        onCommentPosted={() => {
          queryClient.invalidateQueries({ queryKey: ['user-pings'] });
          queryClient.invalidateQueries({ queryKey: ['campus-pings'] });
        }}
      />
      <PingComposerModal
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        user={user}
        onSuccess={() => {
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
    topSafeHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 25,
      backgroundColor: COLORS.background,
    },
    contentContainer: {
      padding: 16,
      paddingTop: 54,
      gap: 16,
    },
    // Modern Profile Header Styles
    modernProfileHeader: {
      marginBottom: 2,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    modernHeaderTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    profileHeaderTitleWrap: {
      flex: 1,
      alignItems: 'flex-start',
      paddingLeft: 2,
    },
    profileHeaderTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    profileHeaderBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    profileHeaderTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.8,
    },
    modernHeaderSpacer: {
      width: 38,
      height: 38,
    },
    profileSettingsButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileIdentityBlock: {
      marginTop: 0,
      marginBottom: 14,
      paddingHorizontal: 2,
      gap: 10,
    },
    profileTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 28,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    modernAvatarWrapper: {
      width: 100,
      height: 100,
      borderRadius: 50,
      padding: 0,
      backgroundColor: 'transparent',
      position: 'relative',
    },
    modernAvatarInner: {
      width: '100%',
      height: '100%',
      borderRadius: 50,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
    },
    modernAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 50,
    },
    modernAvatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCameraBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: COLORS.background,
      backgroundColor: isDark ? 'rgba(22,22,24,0.96)' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 3,
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
    profileIdentityText: {
      gap: 3,
      paddingLeft: 0,
    },
    profileNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    profileEditButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    },
    profileEditButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textPrimary,
      letterSpacing: -0.1,
    },
    profileStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 28,
      flexShrink: 1,
      paddingTop: 0,
      marginLeft: 6,
    },
    profileStatContainer: {
      flex: 0,
    },
    profileStatButton: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      minWidth: 62,
      paddingVertical: 0,
      gap: 2,
      backgroundColor: 'transparent',
    },
    profileStatDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: COLORS.border,
      marginHorizontal: 2,
    },
    modernStatValue: {
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.textPrimary,
      letterSpacing: -0.1,
    },
    modernStatLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: COLORS.textTertiary,
      letterSpacing: 0.1,
    },
    bioSection: {
      marginBottom: 16,
    },
    modernName: {
      fontSize: 19,
      fontWeight: '600',
      color: COLORS.textPrimary,
      letterSpacing: -0.1,
      flex: 1,
    },
    modernBio: {
      fontSize: 13,
      color: COLORS.textSecondary,
      lineHeight: 19,
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
      gap: 6,
      width: '100%',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    postSquare: {
      aspectRatio: 3 / 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      overflow: 'hidden',
      position: 'relative',
      borderRadius: 18,
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
      borderRadius: 18,
    },
    postFallback: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
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
      gap: 0,
      marginTop: 10,
      marginBottom: 2,
      paddingHorizontal: 0,
      width: '100%',
      position: 'relative',
    },
    profileTabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    profileTabButtonActive: {
      backgroundColor: 'transparent',
    },
    profileTabUnderline: {
      position: 'absolute',
      bottom: 0,
      height: 3,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    tabSection: {
      gap: 10,
      paddingBottom: 20,
    },
    listCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    },
    listCardIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    },
    listCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 3,
    },
    listCardMeta: {
      fontSize: 12,
      color: COLORS.textTertiary,
    },
    resourceList: {
      gap: 2,
      paddingTop: 2,
      paddingBottom: 12,
    },
    resourceSections: {
      gap: 18,
      paddingTop: 2,
      paddingBottom: 12,
    },
    resourceListHeading: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 6,
    },
    resourceListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    resourceListIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    resourceListTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
      letterSpacing: -0.1,
    },
    resourceListMeta: {
      fontSize: 12,
      color: COLORS.textTertiary,
      marginTop: 2,
    },
    emptyTabState: {
      minHeight: 280,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 10,
    },
    emptyTabTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textPrimary,
      textAlign: 'center',
    },
    emptyTabSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: COLORS.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
    },
    emptyTabButton: {
      marginTop: 8,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: COLORS.primary,
    },
    emptyTabButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFF',
    },
    settingsSheet: {
      width: '100%',
      maxHeight: '88%',
      marginTop: 'auto',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    settingsSheetHandleWrap: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    settingsSheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: COLORS.border,
    },
    settingsSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 6,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    settingsSheetTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    settingsSheetClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    },
    settingsSheetContent: {
      padding: 16,
      gap: 20,
      paddingBottom: 44,
    },
    profileTabText: {
      color: COLORS.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
    profileTabTextActive: {
      color: COLORS.textPrimary,
      fontWeight: '800',
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
    modalEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 28,
    },
  });
