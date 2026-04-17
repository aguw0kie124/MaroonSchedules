import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { 
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowUp,
  Bookmark,
  CalendarDays,
  Clock,
  EyeOff,
  ExternalLink,
  Flame,
  LocateFixed,
  MapPin,
  Megaphone,
  MessageCircle,
  Pizza,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
  Image as ImageIcon,
} from 'lucide-react-native';

import { FocusMotionView, ScalePressable } from './common/Motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '../config';
import { useTheme, WallpaperWrapper } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { useEventStore } from '../store/eventStore';
import { TourTarget, useTour } from './onboarding/TourProvider';
import { PingCommentsModal } from './pings/PingCommentsModal';
import {
  addFriend,
  addComment,
  addPing,
  blockUser,
  initializeFeedUser,
  deletePing,
  getComments,
  getFriends,
  getPingFeed,
  reportContent,
  toggleLike,
  toggleVote,
  uploadMediaImage,
} from '../services/socialFeedService';
import { buildCampusDirectory, getCanonicalLocationName } from './places/campusData';
import { useSessionStore } from '../store/sessionStore';
import { resolveDisplayName } from '../utils/userUtils';

type PingCategory =
  | 'Free Food'
  | 'Hangout'
  | 'Study'
  | 'Show'
  | 'Sports'
  | 'Popup'
  | 'Heads Up';

type FeedFilter = 'All' | 'Friends' | PingCategory;

type TimePreset = 'now' | 'soon' | 'tonight' | 'tomorrow';

interface FeaturedEvent {
  id: string;
  placeId?: string | null;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime?: string | null;
  link?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  categories?: Record<string, number>;
  isAdminEvent?: boolean;
  rsvpStatus?: string;
}

type PingAnchorType = 'place' | 'geo';

interface PingCard {
  id: string;
  source: 'user' | 'official';
  anchorType: PingAnchorType;
  placeId?: string | null;
  title: string;
  body: string;
  category: string;
  locationTag: string;
  startAt: string;
  endAt?: string | null;
  createdAt: string;
  userId?: string;
  userName: string;
  userImage?: string | null;
  score: number;
  userVote: number;
  commentCount: number;
  activityId?: string;
  isAnonymous: boolean;
  sourceUrl?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  imageUrl?: string | null;
}

interface ComposerGeoLocation {
  latitude: number;
  longitude: number;
  label: string;
}

const PING_CATEGORIES: Array<{ id: PingCategory; accent: string; Icon: any }> = [
  { id: 'Free Food', accent: '#E48B3D', Icon: Pizza },
  { id: 'Hangout', accent: '#D85F8D', Icon: Users },
  { id: 'Study', accent: '#6888E8', Icon: Sparkles },
  { id: 'Show', accent: '#855FF0', Icon: Flame },
  { id: 'Sports', accent: '#3CA86E', Icon: Flame },
  { id: 'Popup', accent: '#4B8AC9', Icon: Megaphone },
  { id: 'Heads Up', accent: '#CC5454', Icon: Megaphone },
];

const TIME_PRESETS: Array<{ id: TimePreset; label: string }> = [
  { id: 'now', label: 'Now' },
  { id: 'soon', label: 'In 1h' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'tomorrow', label: 'Tomorrow' },
];

function categoryMeta(category: string) {
  return (
    PING_CATEGORIES.find((entry) => entry.id === category) || {
      id: category,
      accent: '#7A889B',
      Icon: Sparkles,
    }
  );
}

function buildPresetWindow(preset: TimePreset, durationHours: number = 3) {
  const now = new Date();
  const start = new Date(now);

  if (preset === 'soon') {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  } else if (preset === 'tonight') {
    start.setHours(19, 0, 0, 0);
    if (start <= now) {
      start.setDate(start.getDate() + 1);
    }
  } else if (preset === 'tomorrow') {
    start.setDate(start.getDate() + 1);
    start.setHours(12, 0, 0, 0);
  }

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + Math.round(durationHours * 60));

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function formatStartLabel(startAt: string) {
  const start = new Date(startAt);
  const now = new Date();
  const startDay = start.toDateString();
  const today = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (Math.abs(start.getTime() - now.getTime()) < 45 * 60 * 1000) return 'Happening now';
  if (startDay === today) return `Today · ${time}`;
  if (startDay === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

function formatRelativeAge(isoValue: string) {
  const value = new Date(isoValue);
  if (!Number.isFinite(value.getTime())) return 'Just now';
  const diffMs = Date.now() - value.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / (1000 * 60)));
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function coerceNumber(value: unknown) {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : null;
}

function haversineDistanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) *
      Math.cos(toRad(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (!parts.length) return 'A';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
}

/**
 * Heuristic to check if a string looks like an AES-encrypted base64 payload
 * from our backend (typically length > 40 and not human-readable).
 */

function isPingActiveNow(startAt: string, endAt?: string | null) {
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : start + 2 * 60 * 60 * 1000;
  const now = Date.now();
  return Number.isFinite(start) && now >= start - 30 * 60 * 1000 && now <= end;
}

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return `${API_URL}${url}`;
  if ((url.includes('127.0.0.1') || url.includes('localhost')) && url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    return `${API_URL}/uploads/${parts[1]}`;
  }
  return url;
}

function mapOfficialEventCategory(event: FeaturedEvent): PingCategory {
  if (event.categories?.food) return 'Free Food';
  if (event.categories?.sports) return 'Sports';
  if (event.categories?.academic) return 'Study';
  if (event.categories?.entertainment) return 'Show';
  if (event.categories?.social) return 'Hangout';
  return 'Popup';
}

function mapActivityToPing(activity: any, currentUser: any, userMap: Map<string, string>): PingCard {
  const custom = activity.custom || {};
  const actor = activity.actor || {};
  const userId = (actor.id || activity.actor || '').replace('SU:', '');
  const rawName = actor.name || actor.data?.name || custom.user_name || 'Aggie User';
  const isAnonymous = Boolean(custom.is_anonymous);

  // Resolve name: Current User match > User Directory match > Raw Name (if not encrypted) > 'Aggie User'
  const resolvedName = resolveDisplayName(userId, rawName, currentUser, userMap);

  const attachments = activity.attachments || [];
  const media = attachments[0] || {};
  const imageUrl = resolveMediaUrl(custom.image_url || custom.imageUrl || media.original || media.image_url);

  const locationLat =
    coerceNumber(custom.lat) ??
    coerceNumber(custom.place_lat) ??
    coerceNumber(activity.place?.coord?.lat) ??
    null;
  const locationLng =
    coerceNumber(custom.lng) ??
    coerceNumber(custom.place_lng) ??
    coerceNumber(activity.place?.coord?.lng) ??
    null;

  return {
    id: activity.id || `${Date.now()}`,
    source: 'user',
    anchorType: custom.anchor_type === 'geo' ? 'geo' : 'place',
    title: custom.ping_title || 'Campus Ping',
    body: activity.text || '',
    category: custom.ping_category || 'Popup',
    placeId: custom.place_id || activity.place?.place_id || null,
    locationTag: custom.location_label || custom.location_tag || 'Campus',
    startAt: custom.start_at || activity.time || new Date().toISOString(),
    endAt: custom.end_at || null,
    createdAt: activity.time || activity.created_at || new Date().toISOString(),
    userId,
    userName: isAnonymous ? 'Anonymous' : resolvedName,
    userImage: isAnonymous ? null : actor.image || actor.data?.image || custom.user_image || null,
    score: activity.reaction_counts?.score ?? activity.reaction_counts?.upvote ?? 0,
    userVote: activity.own_reactions?.upvote ? 1 : (activity.own_reactions?.downvote ? -1 : 0),
    commentCount: activity.reaction_counts?.comment || 0,
    activityId: activity.id,
    isAnonymous,
    imageUrl: imageUrl,
    locationLat: locationLat,
    locationLng: locationLng,
  };
}

export function CampusPingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { scheduleEvent, saveEvent } = useEventStore();
  const theme = useTheme();
  const styles = getStyles(theme);
  const COLORS = theme.COLORS;
  const navigation = useNavigation<any>();
  const isDark = theme.theme === 'dark';
  const { activeTargetName, advanceStep } = useTour();

  const directory = useMemo(() => buildCampusDirectory(), []);
  const locationLookup = useMemo(
    () => new Map(directory.map((item) => [getCanonicalLocationName(item.location), item])),
    [directory],
  );

  const resetComposer = useCallback(() => {
    setComposerTitle('');
    setComposerBody('');
    setComposerCategory('Popup');
    setComposerTimePreset('now');
    setComposerDurationHours(3);
    setLocationQuery('');
    setSelectedLocation(null);
    setComposerGeoLocation(null);
    setComposerImageUri(null);
    setComposerAnonymous(false);
    setUseCurrentLocation(true);
  }, []);

  const openComposer = useCallback(() => {
    setUseCurrentLocation(true);
    setComposerVisible(true);
  }, []);
  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    resetComposer();
  }, [resetComposer]);

  const {
    data: featuredEvents = [],
    isLoading: loadingFeatured,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ['campus-featured', API_URL],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/campus/events?limit=12`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data || []).map((event: any) => ({
        id: String(event.event_id),
        placeId: event.place_id ?? event.place?.place_id ?? null,
        title: event.title || 'Campus Event',
        description: event.summary || event.description || '',
        location: event.location || 'Campus',
        startTime: event.start_time,
        endTime: event.end_time,
        link: event.link || event.source_url || null,
        locationLat: event.location_lat ?? null,
        locationLng: event.location_lng ?? null,
        categories: event.categories || undefined,
      }));
    },
    staleTime: 1000 * 60 * 10,
  });

  const {
    data: userProfiles = [],
  } = useQuery({
    queryKey: ['campus-chat-directory', API_URL],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_URL}/chat/users`);
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 30, // 30 mins
  });

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    userProfiles.forEach((u: any) => {
      if (u.id && u.name) m.set(u.id, u.name);
    });
    return m;
  }, [userProfiles]);

  const {
    data: userPings = [],
    isLoading: loadingPings,
    refetch: refetchPings,
    isRefetching: refreshingPings,
  } = useQuery({
    queryKey: ['campus-pings', API_URL],
    queryFn: async () => {
      const activities = await getPingFeed(60);
      return (activities || []).map((a: any) => mapActivityToPing(a, user, userMap));
    },
    refetchInterval: 15000,
    staleTime: 1000 * 30,
  });

  const [feedConnected, setFeedConnected] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<FeedFilter>('All');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pingsListRef = useRef<FlatList<PingCard> | null>(null);

  const [composerVisible, setComposerVisible] = useState(false);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<PingCategory>('Popup');
  const [composerTimePreset, setComposerTimePreset] = useState<TimePreset>('now');
  const [composerDurationHours, setComposerDurationHours] = useState<number>(3);
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [composerGeoLocation, setComposerGeoLocation] = useState<ComposerGeoLocation | null>(null);
  const [composerImageUri, setComposerImageUri] = useState<string | null>(null);
  const [composerAnonymous, setComposerAnonymous] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);

  const [activeFeaturedEvent, setActiveFeaturedEvent] = useState<FeaturedEvent | null>(null);
  const [activeCommentsPing, setActiveCommentsPing] = useState<PingCard | null>(null);

  const { data: friends = [] } = useQuery({
    queryKey: ['campus-ping-friends', API_URL, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await getFriends(user.id);
    },
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60,
  });

  const friendIds = useMemo(() => {
    return new Set(
      friends
        .map((friend: any) => String(friend?.id || '').trim())
        .filter(Boolean),
    );
  }, [friends]);

  const locationSuggestions = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return directory.slice(0, 8);
    return directory
      .filter((item) => {
        const name = item.location.toLowerCase();
        const short = item.shortName?.toLowerCase() || '';
        return name.includes(query) || short.includes(query);
      })
      .slice(0, 8);
  }, [directory, locationQuery]);

  const featuredCards = useMemo(() => {
    if (categoryFilter === 'Friends') {
      return [];
    }
    return featuredEvents
      .filter((event) => categoryFilter === 'All' || mapOfficialEventCategory(event) === categoryFilter)
      .map((event) => {
        const canonicalLocation = getCanonicalLocationName(event.location);
        const location = locationLookup.get(canonicalLocation);
        return {
          ...event,
          category: mapOfficialEventCategory(event),
          location: canonicalLocation,
          locationLat: event.locationLat ?? location?.coord.lat ?? null,
          locationLng: event.locationLng ?? location?.coord.lng ?? null,
        };
      })
      .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  }, [categoryFilter, featuredEvents, locationLookup]);

  const feedPings = useMemo(
    () =>
      userPings
        .map((ping) => {
          const location = locationLookup.get(getCanonicalLocationName(ping.locationTag));
          return {
            ...ping,
            locationLat: location?.coord.lat ?? ping.locationLat ?? null,
            locationLng: location?.coord.lng ?? ping.locationLng ?? null,
          };
        })
        .sort((left, right) => {
          const leftActive = isPingActiveNow(left.startAt, left.endAt) ? 1 : 0;
          const rightActive = isPingActiveNow(right.startAt, right.endAt) ? 1 : 0;
          if (leftActive !== rightActive) return rightActive - leftActive;
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }),
    [locationLookup, userPings],
  );

  const filteredFeed = useMemo(() => {
    return feedPings.filter((ping) => {
      if (categoryFilter === 'All') {
        return true;
      }
      if (categoryFilter === 'Friends') {
        if (!ping.userId || ping.source !== 'user') {
          return false;
        }
        return friendIds.has(String(ping.userId));
      }
      return ping.category === categoryFilter;
    });
  }, [categoryFilter, feedPings, friendIds]);

  const isInitialPingsLoading = loadingPings && userPings.length === 0;
  const isManuallyRefreshing = refreshing && !isInitialPingsLoading;

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user) {
        initializeFeedUser(user);
        setFeedConnected(true);
      }
      await Promise.all([refetchFeatured(), refetchPings()]);
    } catch (error) {
      console.warn('[Pings] Refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchFeatured, refetchPings, user]);

  useEffect(() => {
    if (user && !feedConnected) {
      try {
        initializeFeedUser(user);
        setFeedConnected(true);
      } catch (e) {
        setFeedError('Live pings are unavailable.');
      }
    }
  }, [user, feedConnected]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = useCallback(() => {
    loadAll();
  }, [loadAll]);

  const handleSelectLocation = useCallback((locationName: string) => {
    setUseCurrentLocation(false);
    setSelectedLocation(locationName);
    setComposerGeoLocation(null);
    setLocationQuery(locationName);
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setUseCurrentLocation(true);
    setIsResolvingCurrentLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location unavailable', 'Allow location access to pin your current spot.');
        return null;
      }

      let current;
      try {
        current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (_error) {
        current = await Location.getLastKnownPositionAsync();
      }
      if (!current) {
        throw new Error('Could not determine your location.');
      }
      const latitude = current.coords.latitude;
      const longitude = current.coords.longitude;

      const nearest = directory.reduce(
        (best, item) => {
          const distanceMeters = haversineDistanceMeters(
            latitude,
            longitude,
            item.coord.lat,
            item.coord.lng,
          );
          if (!best || distanceMeters < best.distanceMeters) {
            return { item, distanceMeters };
          }
          return best;
        },
        null as { item: (typeof directory)[number]; distanceMeters: number } | null,
      );

      const label =
        nearest && nearest.distanceMeters <= 220
          ? `Near ${nearest.item.location}`
          : 'Pinned location';

      const nextLocation = {
        latitude,
        longitude,
        label,
      };
      setComposerGeoLocation(nextLocation);
      setSelectedLocation(null);
      setLocationQuery('');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return nextLocation;
    } catch (error) {
      console.warn('[Pings] current location failed', error);
      Alert.alert('Could not pin location', 'Try again in a moment.');
      return null;
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  }, [directory]);

  useEffect(() => {
    if (!composerVisible || !useCurrentLocation || composerGeoLocation || isResolvingCurrentLocation) return;
    if (selectedLocation || locationQuery.trim().length > 0) return;
    handleUseCurrentLocation();
  }, [
    composerVisible,
    useCurrentLocation,
    composerGeoLocation,
    isResolvingCurrentLocation,
    selectedLocation,
    locationQuery,
    handleUseCurrentLocation,
  ]);

  const handlePickPingImage = useCallback(async () => {
    const launchCamera = async () => {
      try {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          Alert.alert('Camera unavailable', 'Allow camera access to take a photo for your ping.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.82,
          aspect: [4, 3],
        });

        if (!result.canceled && result.assets[0]) {
          setComposerImageUri(result.assets[0].uri);
        }
      } catch (error) {
        console.warn('[Pings] camera capture failed', error);
        Alert.alert('Capture failed', 'Could not open your camera.');
      }
    };

    const launchLibrary = async () => {
      try {
        const existingPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        const permission =
          existingPermission.granted || !existingPermission.canAskAgain
            ? existingPermission
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          if (permission.canAskAgain) {
            Alert.alert('Photos unavailable', 'Allow photo access to attach an image to your ping.');
          } else {
            Alert.alert(
              'Photos unavailable',
              'Photo access is turned off for MaroonLife. Open Settings to allow image uploads.',
              [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    Linking.openSettings().catch((settingsError) => {
                      console.warn('[Pings] could not open settings', settingsError);
                    });
                  },
                },
              ],
            );
          }
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.82,
          aspect: [4, 3],
        });

        if (!result.canceled && result.assets[0]) {
          setComposerImageUri(result.assets[0].uri);
        }
      } catch (error) {
        console.warn('[Pings] image library pick failed', error);
        Alert.alert('Selection failed', 'Could not open your photo library.');
      }
    };

    Alert.alert(
      'Attach Image',
      'Choose a source for your photo',
      [
        { text: 'Take Photo', onPress: launchCamera },
        { text: 'Choose from Library', onPress: launchLibrary },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, []);

  const handleCreatePing = useCallback(async () => {
    if (!user || !feedConnected) {
      Alert.alert('Live pings unavailable', 'Feed connection is required before posting a ping.');
      return;
    }
    if (!composerTitle.trim()) {
      Alert.alert('Missing details', 'Add a title so people know what is happening.');
      return;
    }

    let finalLocation = selectedLocation;
    let finalLat: number | undefined;
    let finalLng: number | undefined;
    let anchorType: PingAnchorType = 'place';

    if (useCurrentLocation) {
      if (composerGeoLocation) {
        finalLocation = composerGeoLocation.label;
        finalLat = composerGeoLocation.latitude;
        finalLng = composerGeoLocation.longitude;
        anchorType = 'geo';
      } else {
        const resolvedLocation = await handleUseCurrentLocation();
        if (!resolvedLocation) {
          Alert.alert('Location unavailable', 'We could not lock onto your current location yet.');
          return;
        }
        finalLocation = resolvedLocation.label;
        finalLat = resolvedLocation.latitude;
        finalLng = resolvedLocation.longitude;
        anchorType = 'geo';
      }
    } else {
      const lookup = locationLookup.get(getCanonicalLocationName(finalLocation));
      if (lookup && lookup.coord) {
        finalLat = lookup.coord.lat;
        finalLng = lookup.coord.lng;
      }
    }

    if (!finalLocation) {
      Alert.alert('Pick a location', 'Tag a campus location so this ping can connect back into the map.');
      return;
    }

    const displayName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`.trim()
        : user.firstName || user.fullName || user.username || 'Aggie';
    const selectedPlace = selectedLocation
      ? locationLookup.get(getCanonicalLocationName(selectedLocation))
      : null;
    const locationTag = finalLocation || 'Pinned location';
    const latitude = finalLat;
    const longitude = finalLng;

    const { startAt, endAt } = buildPresetWindow(composerTimePreset, composerDurationHours);
    setIsPosting(true);
    try {
      let uploadedImageUrl: string | undefined;
      if (composerImageUri) {
        uploadedImageUrl = await uploadMediaImage(composerImageUri);
      }

      const createdPing = await addPing({
        userId: user.id,
        userName: displayName,
        userImage: user.imageUrl,
        title: composerTitle.trim(),
        body: composerBody.trim(),
        category: composerCategory,
        locationTag,
        placeId: selectedPlace?.placeId || undefined,
        latitude,
        longitude,
        anchorType,
        startAt,
        endAt,
        isAnonymous: composerAnonymous,
        mediaUrl: uploadedImageUrl,
      });

      const createdActivity = createdPing?.activity;
      if (createdActivity) {
        const optimisticPing = mapActivityToPing(createdActivity, user, userMap);
        queryClient.setQueryData(['campus-pings', API_URL], (current: PingCard[] | undefined) => {
          const existing = current || [];
          return [optimisticPing, ...existing.filter((entry) => entry.id !== optimisticPing.id)];
        });
      }

      setComposerVisible(false);
      resetComposer();
      queryClient.invalidateQueries({ queryKey: ['campus-pings', API_URL] });
      queryClient.invalidateQueries({ queryKey: ['campus-pulse', user?.id, API_URL] });
    } catch (error: any) {
      console.warn('[Pings] create failed', error);
      Alert.alert('Could not post ping', error?.message || 'Something went wrong.');
    } finally {
      setIsPosting(false);
    }
  }, [
    composerBody,
    composerCategory,
    composerTitle,
    composerDurationHours,
    composerTimePreset,
    composerImageUri,
    composerAnonymous,
    composerGeoLocation,
    selectedLocation,
    feedConnected,
    queryClient,
    handleUseCurrentLocation,
    resetComposer,
    user,
    userMap,
    locationLookup,
    useCurrentLocation,
  ]);

  const handleVotePing = useCallback(
    async (ping: PingCard, direction: number) => {
      if (!ping.activityId) return;

      const currentVote = ping.userVote || 0;
      const targetKind = direction === 1 ? 'upvote' : 'downvote';
      const nextUserVote = currentVote === direction ? 0 : direction;

      // Optimistic Update
      const previousPings = queryClient.getQueryData<PingCard[]>(['campus-pings', API_URL]);
      if (previousPings) {
        const newPings = previousPings.map(p => {
          if (p.id !== ping.id) return p;
          
          let scoreAdjustment = 0;
          if (nextUserVote === 0) {
            scoreAdjustment = -currentVote; // Remove old vote
          } else if (currentVote === 0) {
            scoreAdjustment = direction; // Add new vote
          } else {
            scoreAdjustment = direction * 2; // Flip vote (e.g. -1 to +1 is +2)
          }

          return {
            ...p,
            userVote: nextUserVote,
            score: (p.score || 0) + scoreAdjustment
          };
        });
        queryClient.setQueryData(['campus-pings', API_URL], newPings);
      }

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await toggleVote(ping.activityId, targetKind);
        // We don't invalidate here to keep the optimistic speed, 
        // rely on background refetch or next intentional refresh
      } catch (error) {
        console.warn('[Pings] vote failed', error);
        // Rollback
        if (previousPings) {
          queryClient.setQueryData(['campus-pings', API_URL], previousPings);
        }
        if (error instanceof Error && /blocked/i.test(error.message)) {
          Alert.alert(
            'Interaction unavailable',
            'You cannot interact with a user you have blocked or who has blocked you.',
          );
        } else if (error instanceof Error && /rate limit/i.test(error.message)) {
          Alert.alert(
            'Slow down!',
            'You are voting too fast. Please wait a minute before trying again.',
          );
        }
      }
    },
    [navigation, queryClient],
  );

  const handleDeletePing = useCallback(
    (ping: PingCard) => {
      if (ping.source !== 'user' || !ping.activityId) return;
      Alert.alert('Delete ping', 'Remove this ping from the live feed?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePing(ping.activityId!);
              queryClient.setQueryData(['campus-pings', API_URL], (current: PingCard[] | undefined) => {
                if (!current) return current;
                return current.filter((entry) => entry.id !== ping.id);
              });
            } catch (error) {
              console.warn('[Pings] delete failed (silent)', error);
            }
          },
        },
      ]);
    },
    [],
  );

  const removeBlockedUserFromVisibleFeed = useCallback((blockedUserId: string) => {
    queryClient.setQueryData(['campus-pings', API_URL], (current: PingCard[] | undefined) => {
      if (!current) return current;
      return current.filter((entry) => entry.userId !== blockedUserId);
    });
  }, [queryClient]);

  const handleReportPing = useCallback((ping: PingCard) => {
    if (!user?.id || !ping.userId) {
      Alert.alert('Sign in required', 'Please sign in to report this post.');
      return;
    }

    const submitReport = async (reason: string) => {
      try {
        await reportContent({
          reporteeId: ping.userId!,
          postType: 'crowdping',
          postId: ping.activityId || ping.id,
          reason,
        });
        Alert.alert('Report received', 'Thanks for helping keep Campus Pulse safe.');
      } catch (error) {
        console.warn('[Pings] report failed', error);
        Alert.alert('Unable to submit report', 'We could not send that report right now.');
      }
    };

    Alert.alert('Report post', 'What is the issue with this post?', [
      { text: 'Spam', onPress: () => submitReport('spam') },
      { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
      { text: 'Harassment', onPress: () => submitReport('harassment') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [user?.id]);

  const handleBlockPingAuthor = useCallback((ping: PingCard) => {
    if (!user?.id || !ping.userId) {
      Alert.alert('Sign in required', 'Please sign in to block this user.');
      return;
    }

    const displayName = ping.userName;
    Alert.alert(
      'Block user?',
      `You will stop seeing posts from ${displayName}, and you will no longer be able to interact with each other until you unblock them in Blocked Users.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(ping.userId!, user.id);
              removeBlockedUserFromVisibleFeed(ping.userId!);
              Alert.alert('User blocked', `${displayName} has been blocked.`);
            } catch (error) {
              console.warn('[Pings] block failed', error);
              Alert.alert('Unable to block user', 'We could not block this user right now.');
            }
          },
        },
      ],
    );
  }, [removeBlockedUserFromVisibleFeed, user?.id]);

  const handleOpenComments = useCallback((ping: PingCard) => {
    setActiveCommentsPing(ping);
  }, []);

  const handleCommentPosted = useCallback(() => {
    if (!activeCommentsPing) return;
    queryClient.setQueryData(['campus-pings', API_URL], (current: PingCard[] | undefined) => {
      if (!current) return current;
      return current.map((entry) =>
        entry.id === activeCommentsPing.id
          ? { ...entry, commentCount: (entry.commentCount || 0) + 1 }
          : entry,
      );
    });
  }, [activeCommentsPing, queryClient]);

  const handleAddPingAuthorAsFriend = useCallback((ping: PingCard) => {
    if (!user?.id || !ping.userId) {
      Alert.alert('Sign in required', 'Please sign in to add a friend.');
      return;
    }
    if (ping.userId === user.id) {
      Alert.alert('Your post', 'You cannot add yourself as a friend.');
      return;
    }

    const displayName = ping.userName;
    Alert.alert(
      'Add friend?',
      `Add ${displayName} to your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Friend',
          onPress: async () => {
            try {
              await addFriend(ping.userId!, user.id);
              Alert.alert('Friend added', `${displayName} has been added to your friends.`);
            } catch (error) {
              console.warn('[Pings] add friend failed', error);
              Alert.alert('Unable to add friend', 'We could not add this user right now.');
            }
          },
        },
      ],
    );
  }, [user?.id]);

  const handleOpenPingMenu = useCallback((ping: PingCard) => {
    const displayName = ping.userName;
    const actions: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
    if (ping.userId && ping.userId !== user?.id) {
      actions.push({ text: 'Add Friend', onPress: () => handleAddPingAuthorAsFriend(ping) });
    }
    actions.push({ text: 'Report', onPress: () => handleReportPing(ping) });
    actions.push({ text: 'Block User', style: 'destructive', onPress: () => handleBlockPingAuthor(ping) });
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(displayName, 'Choose an action for this post.', actions);
  }, [handleAddPingAuthorAsFriend, handleBlockPingAuthor, handleReportPing, user?.id]);



  const openPingOnMap = useCallback(
    (ping: PingCard) => {
      navigation.navigate('Main', {
        screen: 'Places',
        params: {
          initialLayer: 'Pulse',
          initialLocation: ping.locationTag,
          focusToken: `ping:${ping.id}:${ping.startAt}`,
        },
      });
    },
    [navigation],
  );

  const savePingToPlans = useCallback(
    (ping: PingCard) => {
      const canonicalLocation = getCanonicalLocationName(ping.locationTag);
      const location = locationLookup.get(canonicalLocation);
      scheduleEvent({
        id: `${ping.source}-${ping.id}`,
        title: ping.title,
        location: canonicalLocation,
        description: ping.body,
        date_ts: Math.floor(new Date(ping.startAt).getTime() / 1000),
        date_iso: ping.startAt,
        endDate_ts: ping.endAt ? Math.floor(new Date(ping.endAt).getTime() / 1000) : undefined,
        location_lat: ping.locationLat ?? location?.coord.lat ?? null,
        location_lng: ping.locationLng ?? location?.coord.lng ?? null,
        category: ping.category,
      });
      saveEvent(`${ping.source}-${ping.id}`);
      Alert.alert('Saved to plans', `${ping.title} is now in your plans.`);
    },
    [locationLookup, saveEvent, scheduleEvent],
  );

  const openFeaturedEventOnMap = useCallback(
    (event: FeaturedEvent) => {
      navigation.navigate('Main', {
        screen: 'Places',
        params: {
          initialLayer: 'Pulse',
          initialLocation: event.location,
          focusToken: `featured:${event.id}:${event.startTime}`,
        },
      });
    },
    [navigation],
  );

  const saveFeaturedEventToPlans = useCallback(
    (event: FeaturedEvent) => {
      const canonicalLocation = getCanonicalLocationName(event.location);
      const location = locationLookup.get(canonicalLocation);
      scheduleEvent({
        id: `featured-${event.id}`,
        title: event.title,
        location: canonicalLocation,
        description: event.description,
        date_ts: Math.floor(new Date(event.startTime).getTime() / 1000),
        date_iso: event.startTime,
        endDate_ts: event.endTime ? Math.floor(new Date(event.endTime).getTime() / 1000) : undefined,
        location_lat: event.locationLat ?? location?.coord.lat ?? null,
        location_lng: event.locationLng ?? location?.coord.lng ?? null,
        category: mapOfficialEventCategory(event),
      });
      saveEvent(`featured-${event.id}`);
      Alert.alert('Saved to plans', `${event.title} is now in your plans.`);
    },
    [locationLookup, saveEvent, scheduleEvent],
  );

  const openFeaturedEventLink = useCallback(async (event: FeaturedEvent) => {
    if (!event.link) return;
    try {
      await Linking.openURL(event.link);
    } catch (error) {
      console.warn('[Pings] Failed to open featured event link', error);
    }
  }, []);

  const renderFeaturedEvent = ({ item }: { item: FeaturedEvent }) => {
    const meta = categoryMeta(mapOfficialEventCategory(item));
    const FeaturedIcon = meta.Icon;
    return (
      <Pressable
        style={[styles.featuredCard, { borderColor: `${meta.accent}22` }]}
        onPress={() => setActiveFeaturedEvent(item)}
      >
        <View style={styles.featuredCardInner}>
          <LinearGradient
            colors={[`${meta.accent}E6`, `${meta.accent}A8`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featuredAvatar}
          >
            <FeaturedIcon size={20} color="#FFFFFF" />
          </LinearGradient>

          <View style={styles.featuredContent}>
            <Text style={styles.featuredTitle} numberOfLines={1}>
              {item.location}
            </Text>
            <Text style={styles.featuredMeta} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderPingCard = ({ item }: { item: PingCard }) => {
    const canDelete = item.userId === user?.id;
    const canModerateAuthor = !!user?.id && !!item.userId && item.userId !== user.id;
    const CategoryData = PING_CATEGORIES.find((c) => c.id === item.category) || PING_CATEGORIES[PING_CATEGORIES.length - 1];
    const { Icon, accent } = CategoryData;
    const hasImage = !!item.imageUrl;
    const isActive = isPingActiveNow(item.startAt, item.endAt);

    return (
      <View style={styles.pingCard}>
        <View style={styles.pingCardHeader}>
          {item.userImage ? (
            <Image source={{ uri: item.userImage }} style={styles.pingAvatarImage} />
          ) : (
            <View style={[styles.pingAvatar, { backgroundColor: `${accent}15` }]}>
              <Text style={[styles.pingAvatarInitials, { color: accent }]}>{getInitials(item.userName)}</Text>
            </View>
          )}
          <View style={styles.pingAuthorBlock}>
            <Text style={styles.pingAuthorName}>{item.userName}</Text>
            <Text style={styles.pingAuthorMeta} numberOfLines={1}>
              {item.isAnonymous ? `Anonymous · ${item.locationTag}` : item.locationTag}
            </Text>
          </View>
          <View style={styles.pingHeaderActions}>
            {item.anchorType === 'geo' && (
              <View style={styles.geoIndicator}>
                <LocateFixed size={12} color={COLORS.textTertiary} />
              </View>
            )}
            {canModerateAuthor ? (
              <ScalePressable
                style={styles.pingMenuButton}
                onPress={() => handleOpenPingMenu(item)}
              >
                <MoreVertical size={16} color={COLORS.textSecondary} />
              </ScalePressable>
            ) : null}
          </View>
        </View>

        <View style={styles.pingMetaRow}>
          <View style={[styles.pingCategoryBadge, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
            <Icon size={12} color={accent} />
            <Text style={[styles.pingCategoryBadgeText, { color: accent }]}>{item.category}</Text>
          </View>
          <Text style={styles.pingTimestamp}>{formatRelativeAge(item.createdAt)}</Text>
        </View>

        {hasImage ? (
          <Image source={{ uri: item.imageUrl! }} style={styles.pingMedia} resizeMode="cover" />
        ) : (
          <View style={styles.pingTextPostBlock}>
            <Text style={styles.pingTitle}>{item.title}</Text>
            {item.body ? <Text style={styles.pingBody}>{item.body}</Text> : null}
          </View>
        )}

        <View style={styles.pingFooterRow}>
          <View style={styles.pingActionCluster}>
            <View style={styles.pingVoteRow}>
              <ScalePressable
                onPress={() => item.activityId && handleVotePing(item, 1)}
                style={styles.pingIconAction}
              >
                <ArrowBigUp
                  size={24}
                  color={item.userVote === 1 ? '#3FA86A' : COLORS.textPrimary}
                  fill={item.userVote === 1 ? '#3FA86A' : 'transparent'}
                />
              </ScalePressable>

              <Text
                style={[
                  styles.pingVoteRowCount,
                  item.userVote === 1 && styles.pingStatLinePositive,
                  item.userVote === -1 && styles.pingStatLineNegative,
                ]}
              >
                {item.score || 0}
              </Text>

              <ScalePressable
                onPress={() => item.activityId && handleVotePing(item, -1)}
                style={styles.pingIconAction}
              >
                <ArrowBigDown
                  size={24}
                  color={item.userVote === -1 ? '#D8616E' : COLORS.textPrimary}
                  fill={item.userVote === -1 ? '#D8616E' : 'transparent'}
                />
              </ScalePressable>
            </View>

            <ScalePressable
              style={styles.pingIconAction}
              onPress={() => handleOpenComments(item)}
            >
                <View style={styles.pingActionGroup}>
                  <MessageCircle size={21} color={COLORS.textPrimary} />
                  <Text style={styles.pingActionLabel}>
                    {item.commentCount || 0}
                  </Text>
                </View>
            </ScalePressable>

            <ScalePressable
              style={styles.pingIconAction}
              onPress={() => openPingOnMap(item)}
            >
              <MapPin size={21} color={COLORS.textPrimary} />
            </ScalePressable>
          </View>

          <ScalePressable
            style={styles.pingIconAction}
            onPress={() => savePingToPlans(item)}
          >
            <Bookmark size={20} color={COLORS.textPrimary} />
          </ScalePressable>
        </View>

        <View style={styles.pingContent}>
          {hasImage ? (
            <>
              <Text style={styles.pingTitle}>{item.title}</Text>
              {item.body ? <Text style={styles.pingBody}>{item.body}</Text> : null}
            </>
          ) : null}
          <Pressable
            style={[
              styles.pingLocationChip,
              isActive && styles.pingLocationChipActive,
            ]}
            onPress={() => openPingOnMap(item)}
            hitSlop={6}
          >
            <MapPin size={13} color={isActive ? COLORS.primary : COLORS.textSecondary} />
            <Text
              style={[
                styles.pingMetaSummary,
                isActive && styles.pingMetaSummaryActive,
              ]}
              numberOfLines={1}
            >
              {item.locationTag}
            </Text>
          </Pressable>
        </View>

        {canDelete ? (
          <ScalePressable style={styles.pingDeleteAction} onPress={() => handleDeletePing(item)}>
            <Trash2 size={15} color={COLORS.danger} />
            <Text style={styles.pingDeleteActionText}>Delete</Text>
          </ScalePressable>
        ) : null}
      </View>
    );
  };

  const header = (
    <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top + 8, 18) }]}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroTitleRow}>
          <View style={styles.heroBrandBadge}>
            <Megaphone size={14} color={COLORS.textPrimary} />
          </View>
          <Text style={styles.heroTitle}>Campus Pulse</Text>
        </View>
        <TourTarget
          name="crowdping-cta"
          assistAction={() => {
            advanceStep('crowdping-cta');
          }}
        >
          <Pressable
            style={styles.composeFab}
            onPress={() => {
              if (activeTargetName === 'crowdping-cta') {
                advanceStep('crowdping-cta');
                return;
              }
              openComposer();
            }}
          >
            <Plus size={18} color={COLORS.textPrimary} />
          </Pressable>
        </TourTarget>
      </View>

      {isManuallyRefreshing ? (
        <View style={styles.refreshWheelWrap}>
          <ActivityIndicator size="small" color={COLORS.textPrimary} />
        </View>
      ) : null}

      {featuredCards.length > 0 ? (
        <View style={styles.featuredSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
          >
            {featuredCards.slice(0, 10).map((item) => (
              <View key={item.id}>{renderFeaturedEvent({ item })}</View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {(['All', 'Friends', ...PING_CATEGORIES.map((entry) => entry.id)] as FeedFilter[]).map((option) => {
          const active = categoryFilter === option;
          const meta =
            option === 'All'
              ? {
                  id: 'All',
                  accent: COLORS.primary,
                }
              : option === 'Friends'
                ? {
                    id: 'Friends',
                    accent: '#D85F8D',
                    Icon: Users,
                }
              : categoryMeta(option);
          const Icon = 'Icon' in meta ? meta.Icon : null;
          return (
            <Pressable
              key={option}
              style={[
                styles.categoryChip,
                { borderColor: active ? `${meta.accent}24` : COLORS.border },
                active && { backgroundColor: COLORS.surface },
              ]}
              onPress={() => setCategoryFilter(option)}
            >
              {Icon ? <Icon size={14} color={active ? meta.accent : COLORS.textTertiary} /> : null}
              <Text
                style={[
                  styles.categoryChipText,
                  active && { color: COLORS.textPrimary },
                  !active && styles.categoryChipTextMuted,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

    </View>
  );

  const composerHasLocation = Boolean(selectedLocation || composerGeoLocation || useCurrentLocation);
  const canSubmitComposer =
    Boolean(composerTitle.trim()) && composerHasLocation && !isResolvingCurrentLocation;

  if (isInitialPingsLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading campus pulse...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WallpaperWrapper>
        <FlatList
        ref={pingsListRef}
        data={filteredFeed}
        keyExtractor={(item, index) => item?.id || `ping-idx-${index}`}
        renderItem={renderPingCard}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconRow}>
              <Pizza size={20} color="#FF7A3E" />
              <Flame size={20} color="#A462F4" />
              <Megaphone size={20} color="#FF8B52" />
            </View>
            <Text style={styles.emptyTitle}>No crowd pings yet</Text>
            <Text style={styles.emptyQuote}>Be the first to post what is happening.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const nextShow = event.nativeEvent.contentOffset.y > 360;
          setShowScrollTop((current) => (current === nextShow ? current : nextShow));
        }}
        scrollEventThrottle={16}
      />

      {showScrollTop ? (
        <ScalePressable
          style={[styles.scrollTopButton, { bottom: Math.max(insets.bottom + 88, 104) }]}
          onPress={() => pingsListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <ArrowUp size={18} color={COLORS.textPrimary} />
        </ScalePressable>
      ) : null}

      <Modal visible={composerVisible} animationType="fade" transparent statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.composerOverlay}>
          <Animated.View entering={SlideInDown.duration(220)} exiting={SlideOutDown.duration(180)} style={styles.composerSheet}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.composerKeyboardWrap}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.composerScreen, { paddingTop: Math.max(insets.top + 8, 20) }]}>
                  <View style={styles.composerTopBar}>
                    <TourTarget
                      name="crowdping-close"
                      assistAction={() => {
                        closeComposer();
                        setTimeout(() => advanceStep('crowdping-close'), 250);
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          closeComposer();
                          if (activeTargetName === 'crowdping-close') {
                            setTimeout(() => advanceStep('crowdping-close'), 150);
                          }
                        }}
                        style={styles.composerTopIconButton}
                      >
                        <X size={20} color={COLORS.textPrimary} />
                      </Pressable>
                    </TourTarget>

                    <Text style={styles.composerTopTitle}>Create</Text>

                    <Pressable
                      onPress={handleCreatePing}
                      disabled={!canSubmitComposer || isPosting}
                      style={styles.composerTopPostButton}
                    >
                      {isPosting ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <Text
                          style={[
                            styles.composerTopPostLabel,
                            (!canSubmitComposer || isPosting) && styles.composerTopPostLabelDisabled,
                          ]}
                        >
                          Post
                        </Text>
                      )}
                    </Pressable>
                  </View>

                  <ScrollView
                    style={styles.composerScroll}
                    contentContainerStyle={[
                      styles.composerScrollContent,
                      { paddingBottom: Math.max(insets.bottom + 44, 44) },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                  >
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.composerCategoryRow}
                    >
                      {PING_CATEGORIES.map((cat) => {
                        const active = composerCategory === cat.id;
                        const Icon = cat.Icon;
                        return (
                          <Pressable
                            key={cat.id}
                            style={[styles.composerCategoryPill, active && styles.composerCategoryPillActive]}
                            onPress={() => setComposerCategory(cat.id)}
                          >
                            <Icon size={14} color={active ? '#FFFFFF' : cat.accent} />
                            <Text
                              style={[
                                styles.composerCategoryLabel,
                                active && styles.composerCategoryLabelActive,
                              ]}
                              numberOfLines={1}
                            >
                              {cat.id}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.composerTextStack}>
                      <TextInput
                        value={composerTitle}
                        onChangeText={setComposerTitle}
                        placeholder="Title your ping..."
                        placeholderTextColor={COLORS.textTertiary}
                        style={styles.composerTitleInput}
                      />
                      <TextInput
                        value={composerBody}
                        onChangeText={setComposerBody}
                        placeholder="What's happening?"
                        placeholderTextColor={COLORS.textTertiary}
                        style={styles.composerPromptInput}
                        multiline
                      />
                    </View>

                    <View style={styles.composerMediaCard}>
                      {composerImageUri ? (
                        <View style={styles.composerMediaStage}>
                          <Image source={{ uri: composerImageUri }} style={styles.composerMediaStagePreview} />
                          <Pressable style={styles.composerMediaStageOverlay} onPress={handlePickPingImage}>
                            <Text style={styles.composerMediaStageOverlayText}>Tap to replace</Text>
                          </Pressable>
                          <Pressable style={styles.composerMediaRemoveButton} onPress={() => setComposerImageUri(null)}>
                            <X size={14} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.composerMediaStage, styles.composerMediaStageEmpty]}
                          onPress={handlePickPingImage}
                        >
                          <View style={styles.composerMediaStageIconWrap}>
                            <ImageIcon size={24} color={COLORS.primary} />
                          </View>
                          <Text style={styles.composerMediaStageTitle}>Add Photo (Optional)</Text>
                          <Text style={styles.composerMediaStageSubtitle}>
                            Share a flyer, food spread, or what people should look for.
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    <View style={styles.composerSectionBlock}>
                      <Text style={styles.composerSectionLabel}>Location</Text>
                      <View style={styles.composerSearchWrap}>
                        <Search size={16} color={COLORS.textSecondary} />
                        <TextInput
                          value={locationQuery}
                          onChangeText={(text) => {
                            setUseCurrentLocation(false);
                            setLocationQuery(text);
                            setSelectedLocation(null);
                            setComposerGeoLocation(null);
                          }}
                          placeholder="Search for a building or spot..."
                          placeholderTextColor={COLORS.textTertiary}
                          style={styles.searchInput}
                        />
                        <Pressable
                          style={[
                            styles.composerSearchAction,
                            (composerGeoLocation || isResolvingCurrentLocation) &&
                              styles.composerSearchActionActive,
                          ]}
                          onPress={handleUseCurrentLocation}
                          disabled={isResolvingCurrentLocation}
                        >
                          {isResolvingCurrentLocation ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <LocateFixed
                              size={16}
                              color={composerGeoLocation ? '#FFFFFF' : COLORS.primary}
                            />
                          )}
                        </Pressable>
                      </View>

                      {locationQuery.trim().length > 0 && !selectedLocation && !composerGeoLocation && (
                        <ScrollView
                          style={styles.suggestionsWrap}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                        >
                          {locationSuggestions.map((loc) => (
                            <Pressable
                              key={`${loc.placeId || loc.location}-${loc.coord.lat}-${loc.coord.lng}`}
                              style={styles.suggestionItem}
                              onPress={() => handleSelectLocation(loc.location)}
                            >
                              <MapPin size={14} color={COLORS.textSecondary} />
                              <Text style={styles.suggestionText}>{loc.location}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}

                      {selectedLocation && (
                        <View style={styles.selectedLocationBadge}>
                          <MapPin size={14} color={COLORS.primary} />
                          <View style={styles.selectedLocationCopy}>
                            <Text style={styles.selectedLocationText}>{selectedLocation}</Text>
                            <Text style={styles.selectedLocationSubtext}>Campus Landmark</Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setUseCurrentLocation(false);
                              setSelectedLocation(null);
                              setLocationQuery('');
                            }}
                          >
                            <X size={14} color={COLORS.textSecondary} />
                          </Pressable>
                        </View>
                      )}

                      {composerGeoLocation && (
                        <View style={styles.selectedLocationBadge}>
                          <LocateFixed size={14} color={COLORS.primary} />
                          <View style={styles.selectedLocationCopy}>
                            <Text style={styles.selectedLocationText}>{composerGeoLocation.label}</Text>
                            <Text style={styles.selectedLocationSubtext}>Auto-selected from your current location</Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setUseCurrentLocation(false);
                              setComposerGeoLocation(null);
                            }}
                          >
                            <X size={14} color={COLORS.textSecondary} />
                          </Pressable>
                        </View>
                      )}

                    </View>

                    <View style={styles.composerSectionBlock}>
                      <Text style={styles.composerSectionLabel}>Details</Text>
                      <Pressable
                        style={[
                          styles.anonymousCard,
                          composerAnonymous && styles.anonymousCardActive,
                        ]}
                        onPress={() => setComposerAnonymous((current) => !current)}
                      >
                        <View
                          style={[
                            styles.anonymousIconWrap,
                            composerAnonymous && styles.anonymousIconWrapActive,
                          ]}
                        >
                          <EyeOff
                            size={18}
                            color={composerAnonymous ? COLORS.success : COLORS.primary}
                          />
                        </View>
                        <View style={styles.anonymousCopy}>
                          <Text style={styles.anonymousTitle}>Post anonymously</Text>
                          <Text style={styles.anonymousSubtitle}>
                            Your ping will show as Anonymous in the feed while still staying tied to your account for moderation.
                          </Text>
                        </View>
                      </Pressable>
                      <View style={styles.composerPreferenceCard}>
                        <View style={styles.compactPreferenceRow}>
                          <Clock size={18} color={COLORS.textSecondary} />
                          <Text style={styles.compactPreferenceLabel}>Active for</Text>
                          <View style={styles.durationStepper}>
                            <ScalePressable
                              onPress={() => setComposerDurationHours(Math.max(0.5, composerDurationHours - 0.5))}
                              style={styles.stepperButton}
                            >
                              <Text style={styles.stepperButtonText}>-</Text>
                            </ScalePressable>
                            <View style={styles.stepperValueContainer}>
                              <Text style={styles.stepperValueText}>
                                {composerDurationHours === 0.5 ? '30m' : `${composerDurationHours}h`}
                              </Text>
                            </View>
                            <ScalePressable
                              onPress={() => setComposerDurationHours(Math.min(24, composerDurationHours + 0.5))}
                              style={styles.stepperButton}
                            >
                              <Text style={styles.stepperButtonText}>+</Text>
                            </ScalePressable>
                          </View>
                        </View>
                      </View>
                    </View>

                    <Pressable
                      style={[
                        styles.sharePingButton,
                        (!canSubmitComposer || isPosting) && styles.sharePingButtonDisabled,
                      ]}
                      onPress={handleCreatePing}
                      disabled={!canSubmitComposer || isPosting}
                    >
                      {isPosting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.sharePingButtonText}>Share Ping</Text>
                      )}
                    </Pressable>

                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal visible={!!activeFeaturedEvent} animationType="fade" transparent>
        <TouchableWithoutFeedback onPress={() => setActiveFeaturedEvent(null)}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboardWrap}
            >
              <TouchableWithoutFeedback>
                <View style={styles.featuredModalCard}>
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{activeFeaturedEvent?.title}</Text>
                      <Text style={styles.commentModalSubtitle}>
                        {activeFeaturedEvent
                          ? `${formatStartLabel(activeFeaturedEvent.startTime)} · ${getCanonicalLocationName(activeFeaturedEvent.location)}`
                          : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => setActiveFeaturedEvent(null)}>
                      <X size={20} color={COLORS.textPrimary} />
                    </Pressable>
                  </View>

                  <Text style={styles.featuredModalBody}>
                    {activeFeaturedEvent?.description || 'No extra details yet.'}
                  </Text>

                  <View style={styles.featuredModalActions}>
                    <Pressable
                      style={styles.primaryActionButton}
                      onPress={() => activeFeaturedEvent && openFeaturedEventOnMap(activeFeaturedEvent)}
                    >
                      <MapPin size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionLabel}>Open on map</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => activeFeaturedEvent && saveFeaturedEventToPlans(activeFeaturedEvent)}
                    >
                      <CalendarDays size={16} color={COLORS.textPrimary} />
                      <Text style={styles.actionLabel}>Save</Text>
                    </Pressable>
                    {activeFeaturedEvent?.link ? (
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => activeFeaturedEvent && openFeaturedEventLink(activeFeaturedEvent)}
                      >
                        <ExternalLink size={16} color={COLORS.textPrimary} />
                        <Text style={styles.actionLabel}>Details</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <PingCommentsModal
        visible={!!activeCommentsPing}
        target={
          activeCommentsPing?.activityId
            ? {
                activityId: activeCommentsPing.activityId,
                title: activeCommentsPing.title,
                subtitle: activeCommentsPing.locationTag,
                commentCount: activeCommentsPing.commentCount,
              }
            : null
        }
        onClose={() => setActiveCommentsPing(null)}
        onCommentPosted={handleCommentPosted}
      />
      </WallpaperWrapper>
    </View>
  );
}

const getStyles = (theme: any) => {
  const COLORS = theme.COLORS;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.background,
    },
    loadingText: {
      marginTop: 12,
      color: COLORS.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    refreshWheelWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 5,
      paddingBottom: 20,
    },
    listContent: {
      paddingBottom: 120,
    },
    headerWrap: {
      paddingTop: 18,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    heroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    heroBrandBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.8,
    },
    heroBody: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    composeFab: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryRow: {
      marginTop: 12,
      paddingBottom: 4,
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    categoryChipActive: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    categoryChipText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    categoryChipTextActive: {
      color: COLORS.textPrimary,
    },
    categoryChipTextMuted: {
      color: COLORS.textSecondary,
    },
    featuredSection: {
      marginTop: 4,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    featuredList: {
      gap: 12,
      paddingBottom: 8,
    },
    featuredCard: {
      width: 86,
      borderRadius: 22,
      backgroundColor: 'transparent',
      borderWidth: 0,
      overflow: 'visible',
    },
    featuredCardInner: {
      alignItems: 'center',
      gap: 8,
    },
    featuredAvatar: {
      width: 72,
      height: 72,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: COLORS.surface,
    },
    featuredVisual: {
      height: 120,
      padding: 16,
      justifyContent: 'space-between',
    },
    featuredCardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    featuredVisualChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    featuredVisualChipText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    featuredContent: {
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    featuredTitle: {
      color: COLORS.textPrimary,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      textAlign: 'center',
    },
    featuredMeta: {
      marginTop: 2,
      color: COLORS.textSecondary,
      fontSize: 10,
      fontWeight: '500',
      textAlign: 'center',
    },
    pingCard: {
      marginHorizontal: 0,
      marginBottom: 18,
      padding: 0,
      backgroundColor: COLORS.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
      overflow: 'visible',
    },
    pingCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    pingAvatar: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${COLORS.primary}12`,
    },
    pingAvatarImage: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: COLORS.surfaceElevated,
    },
    pingAvatarInitials: {
      fontSize: 14,
      fontWeight: '800',
    },
    pingAuthorBlock: {
      flex: 1,
      marginLeft: 12,
    },
    pingAuthorMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
    },
    pingHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pingAuthorName: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    pingMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
    },
    pingTimestamp: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    pingCategoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
    },
    pingCategoryBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    geoIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pingMenuButton: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    pingContent: {
      paddingHorizontal: 14,
      paddingTop: 0,
      paddingBottom: 16,
    },
    pingTextPostBlock: {
      paddingHorizontal: 14,
      paddingTop: 18,
      paddingBottom: 12,
    },
    pingTitle: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
      letterSpacing: -0.2,
    },
    pingBody: {
      marginTop: 6,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    pingMedia: {
      width: '100%',
      height: 320,
      backgroundColor: COLORS.surfaceElevated,
    },
    pingFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
      gap: 10,
    },
    pingActionCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    pingVoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      marginRight: 2,
    },
    pingActionGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pingActionLabel: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    pingIconAction: {
      minWidth: 24,
      minHeight: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pingVoteRowCount: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      minWidth: 24,
      textAlign: 'center',
    },
    pingStatLinePositive: {
      color: '#3FA86A',
    },
    pingStatLineNegative: {
      color: '#D8616E',
    },
    pingMetaSummary: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    pingMetaSummaryActive: {
      color: COLORS.primary,
      fontWeight: '700',
    },
    pingLocationChip: {
      marginTop: 10,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      maxWidth: '100%',
    },
    pingLocationChipActive: {
      backgroundColor: `${COLORS.primary}10`,
      borderColor: `${COLORS.primary}26`,
    },
    pingDeleteAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingBottom: 16,
    },
    pingDeleteActionText: {
      color: COLORS.danger,
      fontSize: 12,
      fontWeight: '700',
    },
    scrollTopButton: {
      position: 'absolute',
      right: 16,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 5,
    },

    // Composer Styles
    composerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.background,
      zIndex: 20,
    },
    composerSheet: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    composerKeyboardWrap: {
      flex: 1,
    },
    composerScreen: {
      flex: 1,
      backgroundColor: COLORS.background,
      paddingHorizontal: 18,
    },
    composerTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 10,
      marginBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    composerTopIconButton: {
      width: 52,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerTopTitle: {
      flex: 1,
      textAlign: 'center',
      color: COLORS.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    composerTopPostButton: {
      width: 52,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerTopPostLabel: {
      color: COLORS.primary,
      fontSize: 18,
      fontWeight: '800',
    },
    composerTopPostLabelDisabled: {
      opacity: 0.38,
    },
    composerScroll: {
      flex: 1,
    },
    composerScrollContent: {
      paddingTop: 2,
    },
    composerCategoryRow: {
      gap: 6,
      paddingRight: 18,
      paddingBottom: 10,
    },
    composerCategoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    composerCategoryPillActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 4,
    },
    composerCategoryLabel: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    composerCategoryLabelActive: {
      color: '#FFFFFF',
    },
    composerTextStack: {
      gap: 10,
      paddingTop: 2,
      paddingBottom: 12,
    },
    composerTitleInput: {
      color: COLORS.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      paddingVertical: 0,
    },
    composerPromptInput: {
      minHeight: 72,
      color: COLORS.textPrimary,
      fontSize: 16,
      lineHeight: 24,
      paddingVertical: 0,
      textAlignVertical: 'top',
    },
    composerMediaCard: {
      gap: 10,
      marginBottom: 18,
    },
    composerMediaStage: {
      height: 170,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    composerMediaStageEmpty: {
      paddingVertical: 18,
    },
    composerMediaStagePreview: {
      width: '100%',
      height: '100%',
    },
    composerMediaStageOverlay: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 16,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.42)',
      paddingVertical: 8,
      alignItems: 'center',
    },
    composerMediaStageOverlayText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    composerMediaRemoveButton: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.62)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerMediaStageIconWrap: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    composerMediaStageTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    composerMediaStageSubtitle: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      maxWidth: 248,
    },
    composerMediaActionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    composerMediaActionButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 18,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    composerMediaActionLabel: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    composerSectionBlock: {
      marginBottom: 16,
    },
    composerSectionLabel: {
      color: COLORS.textTertiary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    composerSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      paddingHorizontal: 16,
      marginTop: 6,
    },
    searchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      paddingVertical: 13,
      fontSize: 16,
    },
    composerSearchAction: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${COLORS.primary}10`,
      borderWidth: 1,
      borderColor: `${COLORS.primary}20`,
    },
    composerSearchActionActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    composerPreferenceCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    compactPreferenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
    },
    preferenceDivider: {
      height: 1,
      backgroundColor: COLORS.border,
      marginVertical: 8,
    },
    anonymousInlineLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    compactPreferenceLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginLeft: 10,
      flex: 1,
    },
    durationStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stepperButton: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    stepperButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    stepperValueContainer: {
      minWidth: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValueText: {
      fontSize: 16,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.5,
    },
    sharePingButton: {
      height: 54,
      borderRadius: 33,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 0,
      marginBottom: 10,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    sharePingButtonDisabled: {
      opacity: 0.56,
    },
    sharePingButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    anonymousTitle: {
      color: COLORS.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    anonymousSubtitle: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    suggestionsWrap: {
      maxHeight: 210,
      marginTop: 10,
      borderRadius: 18,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    suggestionText: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    selectedLocationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      alignSelf: 'stretch',
      backgroundColor: `${COLORS.primary}10`,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 16,
      marginTop: 10,
      borderWidth: 1,
      borderColor: `${COLORS.primary}20`,
    },
    selectedLocationCopy: {
      flex: 1,
    },
    selectedLocationText: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    selectedLocationSubtext: {
      marginTop: 3,
      color: COLORS.textSecondary,
      fontSize: 12,
    },
    anonymousCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 28,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 18,
      paddingVertical: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.04,
      shadowRadius: 16,
      elevation: 2,
      marginBottom: 14,
    },
    anonymousCardActive: {
      borderColor: `${COLORS.success}40`,
      backgroundColor: `${COLORS.success}08`,
    },
    anonymousIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${COLORS.primary}12`,
    },
    anonymousIconWrapActive: {
      backgroundColor: `${COLORS.success}18`,
    },
    anonymousCopy: {
      flex: 1,
    },
    emptyState: {
      marginTop: 60,
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: COLORS.textPrimary,
      marginTop: 20,
      textAlign: 'center',
    },
    emptyQuote: {
      fontSize: 16,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 24,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalKeyboardWrap: {
      width: '100%',
    },
    commentModalCard: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 30,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    commentModalSubtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    commentList: {
      marginTop: 16,
    },
    commentRow: {
      marginBottom: 20,
    },
    commentName: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    commentBody: {
      fontSize: 15,
      color: COLORS.textSecondary,
      lineHeight: 22,
    },
    commentComposer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
    },
    commentInput: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      backgroundColor: COLORS.surfaceElevated,
      paddingHorizontal: 16,
      color: COLORS.textPrimary,
      fontSize: 15,
    },
    commentSendButton: {
      width: 64,
      height: 48,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Adding missing legacy modal styles used in Featured sections
    featuredModalCard: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 30,
      maxHeight: '85%',
    },
    featuredModalBody: {
      color: COLORS.textSecondary,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 6,
    },
    featuredModalActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 18,
    },
    primaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
    },
    primaryActionLabel: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 8,
    },
    actionLabel: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    commentsLoadingWrap: {
      flex: 1,
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCommentsWrap: {
      paddingVertical: 28,
      alignItems: 'center',
    },
    emptyCommentsText: {
      color: COLORS.textSecondary,
    },
  });
};
