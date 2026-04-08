import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { 
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
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
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  Heart,
  LocateFixed,
  MapPin,
  Megaphone,
  MessageCircle,
  Pizza,
  Flag,
  MoreVertical,
  Plus,
  Search,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
  Image as ImageIcon,
  Camera,
} from 'lucide-react-native';

import { FocusMotionView, ScalePressable } from './common/Motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '../config';
import { useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { useEventStore } from '../store/eventStore';
import { useTour } from './onboarding/TourProvider';
import {
  addComment,
  addPing,
  connectFeedsUser,
  deletePing,
  getComments,
  getPingFeed,
  toggleLike,
  toggleVote,
  uploadStreamImage,
} from '../services/streamFeeds';
import { buildCampusDirectory, getCanonicalLocationName } from './places/campusData';
import { useSessionStore } from '../store/sessionStore';
import { promptGuestLogin } from '../utils/guestAccess';

type PingCategory =
  | 'Free Food'
  | 'Hangout'
  | 'Study'
  | 'Show'
  | 'Sports'
  | 'Popup'
  | 'Market'
  | 'Heads Up';

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
  { id: 'Market', accent: '#C96B47', Icon: Sparkles },
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

function mapActivityToPing(activity: any): PingCard {
  const custom = activity.custom || {};
  const actor = activity.actor || {};
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
    userId: (actor.id || activity.actor || '').replace('SU:', ''),
    userName: custom.is_anonymous ? 'Aggie User' : (actor.name || actor.data?.name || custom.user_name || 'Aggie User'),
    userImage: custom.is_anonymous ? null : (actor.image || actor.data?.image || custom.user_image || null),
    score: activity.reaction_counts?.score || 0,
    userVote: custom.own_reaction === 'score' ? 1 : (custom.own_reaction === 'downvote' ? -1 : 0),
    commentCount: activity.reaction_counts?.comment || 0,
    activityId: activity.id,
    isAnonymous: !!custom.is_anonymous,
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
  const isGuest = useSessionStore((s) => s.isGuest);
  const isDark = theme.theme === 'dark';

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
    setComposerAnonymous(false);
    setLocationQuery('');
    setSelectedLocation(null);
    setComposerGeoLocation(null);
    setComposerImageUri(null);
    setUseCurrentLocation(true);
  }, []);

  const openComposer = useCallback(() => setComposerVisible(true), []);
  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    resetComposer();
  }, [resetComposer]);

  const {
    data: featuredEvents = [],
    isLoading: loadingFeatured,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ['campus-featured'],
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
    data: userPings = [],
    isLoading: loadingPings,
    refetch: refetchPings,
    isRefetching: refreshingPings,
  } = useQuery({
    queryKey: ['campus-pings'],
    queryFn: async () => {
      const activities = await getPingFeed(60);
      return activities.map(mapActivityToPing);
    },
    refetchInterval: 15000,
    staleTime: 1000 * 30,
  });

  const [feedConnected, setFeedConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'All' | PingCategory>('All');

  const [composerVisible, setComposerVisible] = useState(false);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<PingCategory>('Popup');
  const [composerTimePreset, setComposerTimePreset] = useState<TimePreset>('now');
  const [composerDurationHours, setComposerDurationHours] = useState<number>(3);
  const [composerAnonymous, setComposerAnonymous] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [composerGeoLocation, setComposerGeoLocation] = useState<ComposerGeoLocation | null>(null);
  const [composerImageUri, setComposerImageUri] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] = useState(false);

  const [activeFeaturedEvent, setActiveFeaturedEvent] = useState<FeaturedEvent | null>(null);

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
            locationLat: location?.coord.lat ?? null,
            locationLng: location?.coord.lng ?? null,
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
    return feedPings.filter((ping) => categoryFilter === 'All' || ping.category === categoryFilter);
  }, [categoryFilter, feedPings]);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user) {
        connectFeedsUser(user);
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
        connectFeedsUser(user);
        setFeedConnected(true);
      } catch (e) {
        setStreamError('Live pings are unavailable.');
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
    setSelectedLocation(locationName);
    setComposerGeoLocation(null);
    setLocationQuery(locationName);
    setUseCurrentLocation(false);
  }, []);

  const handlePickPingImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos unavailable', 'Allow photo access to attach an image to your ping.');
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
      console.warn('[Pings] image pick failed', error);
      Alert.alert('Selection failed', 'Could not open your photo library.');
    }
  }, []);

  const handleCapturePingImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera unavailable', 'Allow camera access to take a photo for your ping.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.82,
        aspect: [4, 3],
        cameraType: ImagePicker.CameraType.back,
      });

      if (!result.canceled && result.assets[0]) {
        setComposerImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn('[Pings] camera capture failed', error);
      Alert.alert('Camera failed', 'Could not open your camera.');
    }
  }, []);

  const handleCreatePing = useCallback(async () => {
    if (!user || !feedConnected) {
      Alert.alert('Live pings unavailable', 'Feed connection is required before posting a ping.');
      return;
    }
    if (!composerTitle.trim()) {
      Alert.alert('Missing details', 'Add a title and a quick description so people know what is happening.');
      return;
    }

    let finalLocation = selectedLocation;
    let finalLat: number | undefined;
    let finalLng: number | undefined;
    let anchorType: PingAnchorType = 'place';

    if (useCurrentLocation) {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const nearest = directory.reduce((best, item) => {
            const dist = haversineDistanceMeters(current.coords.latitude, current.coords.longitude, item.coord.lat, item.coord.lng);
            return (!best || dist < best.dist) ? { item, dist } : best;
          }, null as any);

          if (nearest && nearest.dist <= 220) {
            finalLocation = nearest.item.location;
            finalLat = nearest.item.coord.lat;
            finalLng = nearest.item.coord.lng;
          } else {
            finalLocation = 'Current Location';
            finalLat = current.coords.latitude;
            finalLng = current.coords.longitude;
            anchorType = 'geo';
          }
        } else {
          finalLocation = 'Current Location';
        }
      } catch (e) {
        finalLocation = 'Current Location';
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

    const { startAt, endAt } = buildPresetWindow(composerTimePreset, composerDurationHours);
    setIsPosting(true);
    try {
      let uploadedImageUrl: string | undefined;
      if (composerImageUri) {
        uploadedImageUrl = await uploadStreamImage(composerImageUri);
      }

      await addPing({
        userId: user.id,
        userName: composerAnonymous ? 'Aggie User' : displayName,
        userImage: composerAnonymous ? undefined : user.imageUrl,
        title: composerTitle.trim(),
        body: composerBody.trim(),
        category: composerCategory,
        locationTag: finalLocation,
        placeId:
          locationLookup.get(getCanonicalLocationName(finalLocation))?.placeId || undefined,
        latitude: finalLat,
        longitude: finalLng,
        anchorType,
        startAt,
        endAt,
        mediaUrl: uploadedImageUrl,
        isAnonymous: composerAnonymous,
      });

      setComposerVisible(false);
      resetComposer();
      handleRefresh();
    } catch (error: any) {
      console.error('[Pings] create failed', error);
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
    useCurrentLocation,
    selectedLocation,
    feedConnected,
    handleRefresh,
    resetComposer,
    user,
    directory,
    locationLookup,
  ]);

  const handleVotePing = useCallback(
    async (ping: PingCard, direction: number) => {
      if (isGuest) {
        promptGuestLogin(navigation);
        return;
      }
      if (!ping.activityId) return;

      const currentVote = ping.userVote || 0;
      const targetKind = direction === 1 ? 'upvote' : 'downvote';
      const finalKind = currentVote === direction ? 'none' : targetKind;

      try {
        await toggleVote(ping.activityId, finalKind);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        queryClient.invalidateQueries({ queryKey: ['campus-pings'] });
      } catch (error) {
        console.warn('[Pings] vote failed', error);
      }
    },
    [isGuest, navigation, queryClient],
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
              queryClient.setQueryData(['campus-pings'], (current: PingCard[] | undefined) => {
                if (!current) return current;
                return current.filter((entry) => entry.id !== ping.id);
              });
            } catch (error) {
              console.warn('[Pings] delete failed', error);
              Alert.alert('Delete failed', 'This ping could not be removed right now.');
            }
          },
        },
      ]);
    },
    [],
  );



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
        style={[styles.featuredCard, { borderColor: `${meta.accent}30` }]}
        onPress={() => setActiveFeaturedEvent(item)}
      >
        <LinearGradient
          colors={[`${meta.accent}F2`, `${meta.accent}99`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featuredVisual}
        >
          <View style={styles.featuredCardTopRow}>
            <View style={styles.featuredVisualChip}>
              <Text style={styles.featuredVisualChipText}>{mapOfficialEventCategory(item)}</Text>
            </View>
            <FeaturedIcon size={20} color="#FFFFFF" />
          </View>
        </LinearGradient>

        <View style={styles.featuredContent}>
          <Text style={styles.featuredTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.featuredMeta}>{formatStartLabel(item.startTime)}</Text>
          <Text style={styles.featuredMeta} numberOfLines={1}>
            {getCanonicalLocationName(item.location)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderPingCard = ({ item }: { item: PingCard }) => {
    const canDelete = item.userId === user?.id;
    const CategoryData = PING_CATEGORIES.find((c) => c.id === item.category) || PING_CATEGORIES[PING_CATEGORIES.length - 1];
    const { Icon, accent } = CategoryData;

    return (
      <View style={styles.pingCard}>
        <View style={styles.pingCardHeader}>
          <View style={[styles.pingAvatar, { backgroundColor: `${accent}15` }]}>
            <Icon size={18} color={accent} />
          </View>
          <View style={styles.pingAuthorBlock}>
            <Text style={styles.pingAuthorName}>
              {item.isAnonymous ? 'Anonymous' : item.userName}
            </Text>
            <Text style={styles.pingTimestamp}>
              {formatRelativeAge(item.createdAt)} · {item.locationTag}
            </Text>
          </View>
          {item.anchorType === 'geo' && (
            <View style={styles.geoIndicator}>
              <LocateFixed size={12} color={COLORS.textTertiary} />
            </View>
          )}
        </View>

        {item.imageUrl ? (
          <View style={styles.pingMediaContainer}>
            <Image source={{ uri: item.imageUrl }} style={styles.pingMedia} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.pingContent}>
          <Text style={styles.pingTitle}>{item.title}</Text>
          {item.body ? <Text style={styles.pingBody}>{item.body}</Text> : null}
        </View>

        <View style={styles.pingActions}>
          <View style={styles.pingVoteWrap}>
            <ScalePressable
              onPress={() => item.activityId && handleVotePing(item, 1)}
              style={[
                styles.pingVoteBtn,
                item.userVote === 1 && { backgroundColor: `${COLORS.success}15` }
              ]}
            >
              <ArrowBigUp 
                size={22} 
                color={item.userVote === 1 ? COLORS.success : COLORS.textTertiary} 
                fill={item.userVote === 1 ? COLORS.success : 'transparent'}
              />
            </ScalePressable>
            
            <Text style={[
              styles.pingVoteCount, 
              item.userVote !== 0 && { color: item.userVote === 1 ? COLORS.success : COLORS.danger, fontWeight: '800' }
            ]}>
              {item.score || 0}
            </Text>

            <ScalePressable
              onPress={() => item.activityId && handleVotePing(item, -1)}
              style={[
                styles.pingVoteBtn,
                item.userVote === -1 && { backgroundColor: `${COLORS.danger}15` }
              ]}
            >
              <ArrowBigDown 
                size={22} 
                color={item.userVote === -1 ? COLORS.danger : COLORS.textTertiary} 
                fill={item.userVote === -1 ? COLORS.danger : 'transparent'}
              />
            </ScalePressable>
          </View>

          <ScalePressable 
            style={styles.pingSecondaryAction}
            onPress={() => savePingToPlans(item)}
          >
            <CalendarDays size={18} color={COLORS.textTertiary} />
          </ScalePressable>

          {canDelete && (
            <ScalePressable 
              style={styles.pingSecondaryAction}
              onPress={() => handleDeletePing(item)}
            >
              <Trash2 size={18} color={COLORS.danger} opacity={0.6} />
            </ScalePressable>
          )}
        </View>
      </View>
    );
  };

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.heroTopRow}>
        <View>
          <Text style={[styles.heroBody, { color: COLORS.primary, fontWeight: '800', marginBottom: 4 }]}>FOR YOU</Text>
          <Text style={styles.heroTitle}>Campus Pulse</Text>
          <Text style={[styles.heroBody, { color: isDark ? COLORS.textSecondary : '#555555' }]}>Great for your morning updates</Text>
        </View>
      </View>

      <Pressable style={styles.quickPostBar} onPress={openComposer}>
        <View style={styles.quickPostIconWrap}>
          <Megaphone size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.quickPostText}>Post what's happening...</Text>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {(['All', ...PING_CATEGORIES.map((entry) => entry.id)] as Array<'All' | PingCategory>).map((option) => {
          const active = categoryFilter === option;
          return (
            <Pressable
              key={option}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setCategoryFilter(option)}
            >
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {featuredCards.length ? (
        <View style={styles.featuredSection}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Featured Events</Text>
          </View>
          <FlatList
            horizontal
            data={featuredCards}
            keyExtractor={(item) => item.id}
            renderItem={renderFeaturedEvent}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
            snapToInterval={280 + 16}
            decelerationRate="fast"
          />
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading campus pulse...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredFeed}
        keyExtractor={(item) => item.id}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={composerVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.composerOverlay}>
          <Animated.View 
            entering={FadeInDown.duration(400)} 
            exiting={FadeOutDown}
            style={[styles.composerSheet, { paddingTop: insets.top || 20 }]}
          >
            <View style={styles.composerHeader}>
              <ScalePressable onPress={closeComposer} style={styles.composerCloseButton}>
                <X size={22} color={COLORS.textPrimary} />
              </ScalePressable>
              <Text style={styles.composerHeaderTitle}>Create</Text>
              <Pressable 
                onPress={handleCreatePing} 
                disabled={isPosting || !composerTitle.trim()}
                style={({ pressed }) => [
                  styles.composerTopPostButton,
                  (isPosting || !composerTitle.trim()) && { opacity: 0.5 },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Text style={styles.composerTopPostLabel}>Post</Text>
              </Pressable>
            </View>

            <ScrollView 
              style={styles.composerScroll}
              contentContainerStyle={styles.composerScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Category Selection (Top) */}
              <View style={styles.composerCategoryRowWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerCategoryRow}>
                  {PING_CATEGORIES.map((cat) => {
                    const active = composerCategory === cat.id;
                    const Icon = cat.Icon;
                    return (
                      <ScalePressable 
                        key={cat.id} 
                        onPress={() => setComposerCategory(cat.id)}
                        style={[
                          styles.composerCategoryPill,
                          active && styles.composerCategoryPillActive
                        ]}
                      >
                        <Icon size={16} color={active ? '#FFFFFF' : cat.accent} />
                        <Text style={[styles.composerCategoryLabel, active && styles.composerCategoryLabelActive]}>
                          {cat.id}
                        </Text>
                      </ScalePressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Title Section */}
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
                  placeholder="What's happening? (Optional)"
                  placeholderTextColor={COLORS.textTertiary}
                  style={styles.composerPromptInput}
                  multiline
                />
              </View>

              {/* Media Section */}
              <View style={styles.composerMediaCard}>
                <Pressable 
                  onPress={!composerImageUri ? handlePickPingImage : undefined}
                  style={[styles.composerMediaStage, !composerImageUri && styles.composerMediaStageEmpty]}
                >
                  {composerImageUri ? (
                    <>
                      <Image source={{ uri: composerImageUri }} style={styles.composerMediaStagePreview} resizeMode="cover" />
                      <View style={styles.composerMediaStageOverlay}>
                        <ImageIcon size={32} color="#FFFFFF" />
                        <Text style={styles.composerMediaStageOverlayText}>Photo attached</Text>
                      </View>
                      <Pressable style={styles.composerMediaRemoveButton} onPress={() => setComposerImageUri(null)}>
                        <X size={16} color="#FFFFFF" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={styles.composerMediaStageIconWrap}>
                        <ImageIcon size={32} color={isDark ? COLORS.primary : '#500000'} />
                      </View>
                      <Text style={styles.composerMediaStageTitle}>Add Photo (Optional)</Text>
                      <Text style={styles.composerMediaStageSubtitle}>
                        Share a flyer, food spread, or what people should look for.
                      </Text>
                    </>
                  )}
                </Pressable>

                <View style={styles.composerMediaActionRow}>
                  <ScalePressable style={styles.composerMediaActionButton} onPress={handlePickPingImage}>
                    <ImageIcon size={18} color={COLORS.textPrimary} />
                    <Text style={styles.composerMediaActionLabel}>Choose photo</Text>
                  </ScalePressable>
                  <ScalePressable style={styles.composerMediaActionButton} onPress={handleCapturePingImage}>
                    <Camera size={18} color={COLORS.textPrimary} />
                    <Text style={styles.composerMediaActionLabel}>Take photo</Text>
                  </ScalePressable>
                </View>
              </View>

              {/* Location Section */}
              <View style={styles.composerSectionBlock}>
                <Text style={styles.composerSectionLabel}>LOCATION</Text>
                
                <ScalePressable 
                  onPress={() => setUseCurrentLocation(!useCurrentLocation)}
                  style={[
                    styles.locationModeButton,
                    useCurrentLocation && { backgroundColor: `${COLORS.primary}08`, borderColor: COLORS.primary }
                  ]}
                >
                  <LocateFixed size={20} color={COLORS.primary} />
                  <Text style={[styles.locationModeButtonText, { color: '#500000' }]}>Use current location</Text>
                  {useCurrentLocation && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: 'auto' }} />}
                </ScalePressable>

                <View style={styles.composerSearchWrap}>
                  <Search size={18} color={COLORS.textTertiary} />
                  <TextInput
                    value={locationQuery}
                    onChangeText={(text) => {
                      setLocationQuery(text);
                      setSelectedLocation(null);
                      setUseCurrentLocation(false);
                    }}
                    placeholder="Search for a building or spot..."
                    placeholderTextColor={COLORS.textTertiary}
                    style={styles.searchInput}
                  />
                </View>

                {locationQuery.length > 0 && !selectedLocation && (
                  <View style={styles.suggestionsWrap}>
                    {locationSuggestions.map((loc) => (
                      <Pressable 
                        key={loc.location} 
                        style={styles.suggestionItem}
                        onPress={() => handleSelectLocation(loc.location)}
                      >
                        <MapPin size={16} color={COLORS.textTertiary} />
                        <Text style={styles.suggestionText}>{loc.location}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {selectedLocation && (
                  <View style={styles.selectedLocationBadge}>
                    <MapPin size={18} color={COLORS.primary} />
                    <View style={styles.selectedLocationCopy}>
                      <Text style={styles.selectedLocationText}>{selectedLocation}</Text>
                      <Text style={styles.selectedLocationSubtext}>Campus Landmark</Text>
                    </View>
                    <Pressable onPress={() => { setSelectedLocation(null); setLocationQuery(''); }}>
                      <X size={18} color={COLORS.textTertiary} />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Duration Setting (Custom Feature) */}
              <View style={styles.composerSectionBlock}>
                <Text style={styles.composerSectionLabel}>PING DURATION</Text>
                <View style={styles.durationControlCard}>
                  <View style={styles.durationHeader}>
                    <Clock size={16} color={COLORS.textSecondary} />
                    <Text style={styles.durationLabel}>Active for</Text>
                  </View>

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

              {/* Main Action Button */}
              <ScalePressable 
                style={[styles.sharePingButton, (isPosting || !composerTitle.trim()) && styles.sharePingButtonDisabled]} 
                onPress={handleCreatePing}
                disabled={isPosting || !composerTitle.trim()}
              >
                {isPosting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sharePingButtonText}>Share Ping</Text>}
              </ScalePressable>

              {/* Identity Section (Bottom) */}
              <Pressable 
                onPress={() => setComposerAnonymous(!composerAnonymous)}
                style={styles.anonymousCard}
              >
                <View style={[styles.anonymousIconWrap, composerAnonymous && styles.anonymousIconWrapActive]}>
                  <Shield size={22} color={composerAnonymous ? COLORS.success : COLORS.textTertiary} />
                </View>
                <View style={styles.anonymousCopy}>
                  <Text style={styles.anonymousTitle}>Post Anonymously</Text>
                  <Text style={styles.anonymousSubtitle}>Hide your profile from others</Text>
                </View>
                <Switch 
                  value={composerAnonymous} 
                  onValueChange={setComposerAnonymous}
                  trackColor={{ false: COLORS.border, true: COLORS.success }}
                  thumbColor="#FFFFFF"
                />
              </Pressable>

              <View style={{ height: 60 }} />
            </ScrollView>
          </Animated.View>
        </View>
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
    listContent: {
      paddingBottom: 120,
    },
    headerWrap: {
      paddingTop: 54,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    heroTopRow: {
      marginBottom: 20,
    },
    heroTitle: {
      fontSize: 34,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -1.2,
    },
    heroBody: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    composeFab: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: '#FFF4EE',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF7B42',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 6,
    },
    quickPostBar: {
      height: 64,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      backgroundColor: COLORS.surface,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 2,
    },
    quickPostIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${COLORS.primary}12`,
      marginRight: 12,
    },
    quickPostText: {
      color: COLORS.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    categoryRow: {
      marginTop: 18,
      paddingBottom: 4,
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: COLORS.surface,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    categoryChipActive: {
      backgroundColor: COLORS.textPrimary,
      borderColor: COLORS.textPrimary,
    },
    categoryChipText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    categoryChipTextActive: {
      color: COLORS.background,
    },
    featuredSection: {
      marginTop: 24,
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
      gap: 16,
      paddingBottom: 8,
    },
    featuredCard: {
      width: 280,
      borderRadius: 24,
      backgroundColor: COLORS.surface,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      overflow: 'hidden',
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
      padding: 16,
    },
    featuredTitle: {
      color: COLORS.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
    },
    featuredMeta: {
      marginTop: 6,
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    pingCard: {
      marginHorizontal: 18,
      marginBottom: 18,
      padding: 16,
      borderRadius: 24,
      backgroundColor: COLORS.surface,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    pingCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    pingAvatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${COLORS.primary}12`,
    },
    pingAuthorBlock: {
      flex: 1,
      marginLeft: 12,
    },
    pingAuthorName: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    pingTimestamp: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 1,
    },
    geoIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pingContent: {
      marginBottom: 16,
    },
    pingTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
      letterSpacing: -0.3,
    },
    pingBody: {
      marginTop: 8,
      color: COLORS.textSecondary,
      fontSize: 16,
      lineHeight: 24,
    },
    pingMediaContainer: {
      width: '100%',
      height: 220,
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: COLORS.surfaceElevated,
    },
    pingMedia: {
      width: '100%',
      height: '100%',
    },
    pingActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    pingVoteWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    pingVoteBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pingVoteCount: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      minWidth: 28,
      textAlign: 'center',
    },
    pingSecondaryAction: {
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: COLORS.surfaceElevated,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    pingSecondaryActionText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },

    // Composer Styles
    composerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    composerSheet: {
      flex: 1,
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
    },
    composerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    composerHeaderTitle: {
      fontSize: 19,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.5,
    },
    composerCloseButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerTopPostButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    composerTopPostLabel: {
      color: '#A85D5D',
      fontSize: 17,
      fontWeight: '800',
    },
    composerScroll: {
      flex: 1,
    },
    composerScrollContent: {
      paddingBottom: 60,
    },
    composerCategoryRowWrap: {
      marginTop: 20,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      paddingBottom: 20,
    },
    composerCategoryRow: {
      paddingHorizontal: 20,
      gap: 10,
    },
    composerCategoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    composerCategoryPillActive: {
      backgroundColor: '#500000',
      borderColor: '#500000',
    },
    composerCategoryLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    composerCategoryLabelActive: {
      color: '#FFFFFF',
    },
    composerTextStack: {
      paddingHorizontal: 24,
      marginTop: 24,
      gap: 16,
    },
    composerTitleInput: {
      fontSize: 26,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.5,
    },
    composerPromptInput: {
      fontSize: 18,
      color: COLORS.textPrimary,
      minHeight: 100,
      fontWeight: '500',
      lineHeight: 24,
    },
    composerMediaCard: {
      paddingHorizontal: 20,
      marginTop: 32,
    },
    composerMediaStage: {
      width: '100%',
      height: 280,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerMediaStageEmpty: {
      backgroundColor: theme.theme === 'dark' ? `${COLORS.primary}05` : '#F8F9FB',
    },
    composerMediaStagePreview: {
      width: '100%',
      height: '100%',
    },
    composerMediaStageOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    composerMediaStageOverlayText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    composerMediaRemoveButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerMediaStageIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    composerMediaStageTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: COLORS.textPrimary,
      marginBottom: 8,
    },
    composerMediaStageSubtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 40,
      fontWeight: '500',
    },
    composerMediaActionRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 16,
    },
    composerMediaActionButton: {
      flex: 1,
      height: 54,
      borderRadius: 18,
      backgroundColor: COLORS.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    composerMediaActionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    composerSectionBlock: {
      paddingHorizontal: 20,
      marginTop: 40,
    },
    composerSectionLabel: {
      fontSize: 13,
      fontWeight: '900',
      color: COLORS.textTertiary,
      letterSpacing: 1,
      marginBottom: 16,
    },
    locationModeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      borderRadius: 24,
      backgroundColor: '#FFF5F5',
      borderWidth: 1.5,
      borderColor: '#FFE0E0',
      marginBottom: 14,
      gap: 12,
    },
    locationModeButtonText: {
      fontSize: 16,
      fontWeight: '800',
    },
    composerSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      height: 60,
      borderRadius: 20,
      backgroundColor: theme.theme === 'dark' ? COLORS.surfaceElevated : '#F2F3F7',
      gap: 14,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    durationControlCard: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    durationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20,
    },
    durationLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.textPrimary,
      flex: 1,
    },
    durationBadge: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    durationBadgeText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    durationStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    stepperButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    stepperButtonText: {
      fontSize: 22,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    stepperValueContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValueText: {
      fontSize: 24,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -1,
    },
    sharePingButton: {
      height: 64,
      borderRadius: 32,
      backgroundColor: '#9B6B6B',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 40,
      marginHorizontal: 20,
      shadowColor: '#9B6B6B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 6,
    },
    sharePingButtonDisabled: {
      opacity: 0.5,
      backgroundColor: COLORS.textTertiary,
    },
    sharePingButtonText: {
      fontSize: 19,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    anonymousCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      marginHorizontal: 20,
      marginTop: 20,
      borderRadius: 28,
      backgroundColor: COLORS.surface,
      borderWidth: 1.5,
      borderColor: COLORS.border,
    },
    anonymousIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${COLORS.primary}12`,
    },
    anonymousIconWrapActive: {
      backgroundColor: `${COLORS.success}12`,
    },
    anonymousCopy: {
      flex: 1,
      marginLeft: 14,
      marginRight: 8,
    },
    anonymousTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    anonymousSubtitle: {
      fontSize: 13,
      color: COLORS.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
    suggestionsWrap: {
      marginTop: 8,
      backgroundColor: COLORS.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: 12,
    },
    suggestionText: {
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    selectedLocationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 18,
      backgroundColor: `${COLORS.primary}08`,
      borderWidth: 1.5,
      borderColor: COLORS.primary,
      marginTop: 12,
      gap: 12,
    },
    selectedLocationCopy: {
      flex: 1,
    },
    selectedLocationText: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    selectedLocationSubtext: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginTop: 1,
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
