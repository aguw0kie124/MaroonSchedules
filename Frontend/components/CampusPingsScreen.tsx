import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
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
  FadeOut,
  SlideInDown,
  SlideOutDown
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import {
  ArrowBigDown,
  ArrowBigUp,
  CalendarDays,
  ExternalLink,
  Flame,
  Heart,
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

import { API_URL } from '../config';
import { requestJson, saveCampusEventRsvp } from '../api/client';
import { useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { useShareStore } from '../store/shareStore';
import { useEventStore } from '../store/eventStore';
import {
  addComment,
  addPing,
  connectFeedsUser,
  deletePing,
  reportContent,
  blockUser,
  getComments,
  getPingFeed,
  toggleLike,
  toggleVote,
  uploadStreamImage,
} from '../services/streamFeeds';
import { buildCampusDirectory, getCanonicalLocationName } from './places/campusData';
import { TourTarget, useTour } from './onboarding/TourProvider';
import { getPremiumName, getPremiumImage } from '../utils/userUtils';
import { scheduleAdminEventReviewNotification } from '../services/notificationService';
import { normalizeExternalUrl, normalizeImageUrl } from '../services/url';
import { invalidateCampusPulseCache } from '../services/campusPulse';

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
  googleReviewUrl?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  categories?: Record<string, number>;
  isAdminEvent?: boolean;
  rsvpStatus?: string;
}

function parseFeaturedEventTime(value?: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isFeaturedEventUpcoming(event: FeaturedEvent): boolean {
  const relevantTime = parseFeaturedEventTime(event.endTime) ?? parseFeaturedEventTime(event.startTime);
  if (relevantTime == null) return true;
  return relevantTime >= Date.now();
}

interface PingCard {
  id: string;
  source: 'user' | 'official';
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
  ownVote: 'upvote' | 'downvote' | null;
  activityId?: string;
  isAnonymous: boolean;
  sourceUrl?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  imageUrl?: string | null;
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

function buildPresetWindow(preset: TimePreset) {
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
  end.setHours(end.getHours() + (preset === 'now' ? 2 : 3));

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

  return {
    id: activity.id || `${Date.now()}`,
    source: 'user',
    title: custom.ping_title || 'Campus Ping',
    body: activity.text || '',
    category: custom.ping_category || 'Popup',
    placeId: custom.place_id || activity.place?.place_id || null,
    locationTag: custom.location_tag || 'Campus',
    startAt: custom.start_at || activity.time || new Date().toISOString(),
    endAt: custom.end_at || null,
    createdAt: activity.time || activity.created_at || new Date().toISOString(),
    userId: (actor.id || activity.actor || '').replace('SU:', ''),
    userName: custom.is_anonymous ? 'Aggie User' : (actor.name || actor.data?.name || custom.user_name || 'Aggie User'),
    userImage: custom.is_anonymous ? null : (actor.image || actor.data?.image || custom.user_image || null),
    score: activity.reaction_counts?.score || 0,
    ownVote: (activity.own_reactions?.upvote || []).length > 0 ? 'upvote' : ((activity.own_reactions?.downvote || []).length > 0 ? 'downvote' : null),
    activityId: activity.id,
    isAnonymous: !!custom.is_anonymous,
    sourceUrl: null,
    imageUrl: normalizeImageUrl(media.image_url || media.asset_url || null),
  };
}

export function CampusPingsScreen() {
  const { COLORS } = useTheme();
  const { advanceStep, activeTargetName } = useTour();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const scheduleEvent = useEventStore((state) => state.scheduleEvent);
  const removeScheduledEvent = useEventStore((state) => state.removeScheduledEvent);
  const saveEvent = useEventStore((state) => state.saveEvent);
  const unsaveEvent = useEventStore((state) => state.unsaveEvent);

  const directory = useMemo(() => buildCampusDirectory(), []);
  const locationLookup = useMemo(
    () => new Map(directory.map((item) => [getCanonicalLocationName(item.location), item])),
    [directory],
  );

  const [featuredEvents, setFeaturedEvents] = useState<FeaturedEvent[]>([]);
  const [userPings, setUserPings] = useState<PingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedConnected, setFeedConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'All' | PingCategory>('All');

  const [composerVisible, setComposerVisible] = useState(false);

  // Onboarding logic: automatically advance if the tour is on the CTA step handled in the open composer call
  // We added a 1s delay so the instructions and highlight appear AFTER the animation finishes
  useEffect(() => {
    if (activeTargetName === 'crowdping-cta' && composerVisible) {
      const timer = setTimeout(() => {
        advanceStep('crowdping-cta');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTargetName, composerVisible, advanceStep]);

  // Removed onboarding idle timer that was auto-advancing the tour
  useEffect(() => {
    if (activeTargetName === 'crowdping-cta' && !composerVisible) {
      // Optional: Pulse or hint if they are just sitting there, but no forced advancement
    }
  }, [activeTargetName, composerVisible]);

  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<PingCategory>('Popup');
  const [composerTimePreset, setComposerTimePreset] = useState<TimePreset>('now');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [composerImageUri, setComposerImageUri] = useState<string | null>(null);
  const [composerAnonymous, setComposerAnonymous] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const [activeFeaturedEvent, setActiveFeaturedEvent] = useState<FeaturedEvent | null>(null);
  const [rsvpBanner, setRsvpBanner] = useState<string | null>(null);

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
      .filter((event) => isFeaturedEventUpcoming(event))
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

  const loadFeaturedEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '12' });
      if (user?.id) {
        params.set('clerk_id', user.id);
      }

      const data = await requestJson(`/campus/events?${params.toString()}`);
      const events = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
      const nextEvents = events.map((event: any) => ({
        id: String(event.event_id),
        placeId: event.place_id ?? event.place?.place_id ?? null,
        title: event.title || 'Campus Event',
        description: event.summary || event.description || '',
        location: event.location || 'Campus',
        startTime: event.start_time,
        endTime: event.end_time,
        link: event.link || event.source_url || null,
        googleReviewUrl: event.google_review_url || null,
        locationLat: event.location_lat ?? null,
        locationLng: event.location_lng ?? null,
        categories: event.categories || undefined,
        isAdminEvent: !!event.is_admin_event,
        rsvpStatus: event.rsvp_status ?? 'none',
      })).filter((event) => isFeaturedEventUpcoming(event));
      setFeaturedEvents(nextEvents);
    } catch (error) {
      console.warn('[Pings] Failed to load featured events', error);
      setFeaturedEvents([]);
    }
  }, [user?.id]);

  const loadUserPings = useCallback(async () => {
    try {
      const activities = await getPingFeed(60);
      setUserPings(activities.map(mapActivityToPing));
      setStreamError(null);
    } catch (error) {
      console.warn('[Pings] Failed to load user pings', error);
      setStreamError('Could not load live pings right now.');
      setUserPings([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await loadFeaturedEvents();
    if (!user) {
      setFeedConnected(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    connectFeedsUser(user);
    setFeedConnected(true);
    try {
      await loadUserPings();
    } catch (error) {
      console.warn('[Pings] Stream connection failed', error);
      setStreamError('Could not load live pings right now.');
      setUserPings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadFeaturedEvents, loadUserPings, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!feedConnected) return;
    const interval = setInterval(() => {
      loadUserPings();
    }, 15000);
    return () => clearInterval(interval);
  }, [feedConnected, loadUserPings]);

  const resetComposer = useCallback(() => {
    setComposerTitle('');
    setComposerBody('');
    setComposerCategory('Popup');
    setComposerTimePreset('now');
    setLocationQuery('');
    setSelectedLocation(null);
    setComposerImageUri(null);
    setComposerAnonymous(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const handleSelectLocation = useCallback((locationName: string) => {
    setSelectedLocation(locationName);
    setLocationQuery(locationName);
  }, []);

  const handlePickPingImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos unavailable', 'Allow photo access to attach an image to your ping.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.82,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setComposerImageUri(result.assets[0].uri);
    }
  }, []);

  const handleCapturePingImage = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera unavailable', 'Allow camera access to take a photo for your ping.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.82,
      aspect: [4, 3],
      cameraType: ImagePicker.CameraType.back,
    });

    if (!result.canceled && result.assets[0]) {
      setComposerImageUri(result.assets[0].uri);
    }
  }, []);

  const handleCreatePing = useCallback(async () => {
    if (!user || !feedConnected) {
      Alert.alert('Live pings unavailable', 'Feed connection is required before posting a ping.');
      return;
    }
    if (!composerTitle.trim() || !composerBody.trim()) {
      Alert.alert('Missing details', 'Add a title and a quick description so people know what is happening.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Pick a location', 'Tag a campus location so this ping can connect back into the map.');
      return;
    }

    const displayName = getPremiumName(user);

    const { startAt, endAt } = buildPresetWindow(composerTimePreset);
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
        locationTag: selectedLocation,
        placeId:
          locationLookup.get(getCanonicalLocationName(selectedLocation))?.placeId || undefined,
        startAt,
        endAt,
        mediaUrl: uploadedImageUrl,
        isAnonymous: composerAnonymous,
      });

      invalidateCampusPulseCache();
      setComposerVisible(false);
      resetComposer();
      await loadUserPings();

    } catch (error: any) {
      console.error('[Pings] create failed', error);
      Alert.alert('Could not post ping', error?.message || 'Something went wrong while posting your ping.');
    } finally {
      setIsPosting(false);
    }
  }, [
    composerBody,
    composerCategory,
    composerAnonymous,
    composerImageUri,
    composerTimePreset,
    composerTitle,
    feedConnected,
    loadUserPings,
    locationLookup,
    resetComposer,
    selectedLocation,
    user,
  ]);

  const handleVotePing = useCallback(
    async (ping: PingCard, kind: 'upvote' | 'downvote') => {
      if (!user || !feedConnected || !ping.activityId || ping.source !== 'user') return;

      // Optimistic update
      setUserPings((current) =>
        current.map((entry) => {
          if (entry.id !== ping.id) return entry;
          
          let newScore = entry.score;
          let newOwnVote: 'upvote' | 'downvote' | null = kind;

          if (entry.ownVote === kind) {
            // Toggle off
            newScore = kind === 'upvote' ? entry.score - 1 : entry.score + 1;
            newOwnVote = null;
          } else if (entry.ownVote === null) {
            // First time vote
            newScore = kind === 'upvote' ? entry.score + 1 : entry.score - 1;
          } else {
            // Switching votes
            newScore = kind === 'upvote' ? entry.score + 2 : entry.score - 2;
          }

          return { ...entry, score: newScore, ownVote: newOwnVote };
        }),
      );

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await toggleVote(ping.activityId, kind);
      } catch (error) {
        console.warn('[Pings] vote failed', error);
        loadUserPings();
      }
    },
    [feedConnected, loadUserPings, user],
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
              invalidateCampusPulseCache();
              setUserPings((current) => current.filter((entry) => entry.id !== ping.id));
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const openComments = useCallback(async (ping: PingCard) => {
    // Replies removed for pings
  }, []);

  // Replies removed from pings
  const handleSendComment = useCallback(async () => {
    // No-op for pings
  }, []);

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

  const removeFeaturedEventFromPlans = useCallback(
    (event: FeaturedEvent) => {
      removeScheduledEvent(`featured-${event.id}`);
      unsaveEvent(`featured-${event.id}`);
    },
    [removeScheduledEvent, unsaveEvent],
  );

  const handleFeaturedEventRsvp = useCallback(
    async (event: FeaturedEvent) => {
      if (!user?.id) {
        Alert.alert('Sign in required', 'Sign in to RSVP for featured events.');
        return;
      }

      try {
        const isRemoving = event.rsvpStatus === 'going';
        await saveCampusEventRsvp({
          clerk_id: user.id,
          event_id: event.id,
          response: isRemoving ? 'none' : 'going',
        });

        const prefs = useAppShellStore.getState();
        if (!isRemoving && prefs.notificationsEnabled && prefs.eventNotifications && event.isAdminEvent && event.endTime) {
          await scheduleAdminEventReviewNotification(
            event.title,
            event.location,
            new Date(event.endTime),
            event.googleReviewUrl,
            event.id,
          );
        }

        if (isRemoving) {
          removeFeaturedEventFromPlans(event);
        } else {
          saveFeaturedEventToPlans(event);
        }
        setFeaturedEvents((current) =>
          current.map((entry) =>
            entry.id === event.id ? { ...entry, rsvpStatus: isRemoving ? 'none' : 'going' } : entry,
          ),
        );
        setActiveFeaturedEvent((current) =>
          current?.id === event.id ? { ...current, rsvpStatus: isRemoving ? 'none' : 'going' } : current,
        );
        const successMessage = isRemoving
          ? `${event.title} was removed from your plans.`
          : `${event.title} is in your plans now.`;
        setRsvpBanner(successMessage);
        Alert.alert(isRemoving ? 'RSVP removed' : 'RSVP saved', successMessage);
      } catch (error) {
        console.warn('[Pings] Failed to RSVP for featured event', error);
        Alert.alert('RSVP failed', 'We could not update your RSVP right now.');
      }
    },
    [removeFeaturedEventFromPlans, saveFeaturedEventToPlans, user?.id],
  );

  const handleFeaturedEventShare = useCallback((event: FeaturedEvent) => {
    useShareStore.getState().openShare({
      title: event.title,
      message: `Check out this featured event: ${event.title} at ${getCanonicalLocationName(event.location)}!`,
      url: event.link || 'https://maroonschedules.tamu.edu',
    });

    if (event.isAdminEvent) {
      fetch(`${API_URL}/admin/events/${event.id}/share`, { method: 'POST' }).catch((error) =>
        console.error('[Pings] Failed to track featured event share', error),
      );
    }
  }, []);

  const openFeaturedEventLink = useCallback(async (event: FeaturedEvent) => {
    const normalizedUrl = normalizeExternalUrl(event.link);
    if (!normalizedUrl) return;
    try {
      await Linking.openURL(normalizedUrl);
    } catch (error) {
      console.warn('[Pings] Failed to open featured event link', error);
      Alert.alert('Link unavailable', 'We could not open the event link. Please ask the organizer to verify it.');
    }
  }, []);

  const renderFeaturedEvent = ({ item }: { item: FeaturedEvent }) => {
    const meta = categoryMeta(mapOfficialEventCategory(item));
    const FeaturedIcon = meta.Icon;
    const isRsvped = item.rsvpStatus === 'going';
    return (
      <View style={[styles.featuredCard, { borderColor: `${meta.accent}30` }]}>
        <Pressable onPress={() => setActiveFeaturedEvent(item)}>
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

        <View style={styles.featuredFooter}>
          <Pressable
            style={[styles.featuredRsvpButton, isRsvped && styles.featuredRsvpButtonSaved]}
            onPress={() => handleFeaturedEventRsvp(item)}
          >
            <CalendarDays size={14} color={isRsvped ? COLORS.textPrimary : '#FFFFFF'} />
            <Text
              style={[styles.featuredRsvpButtonText, isRsvped && styles.featuredRsvpButtonTextSaved]}
              numberOfLines={!item.isAdminEvent && !isRsvped ? 2 : 1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {item.isAdminEvent
                ? isRsvped
                  ? "You're in"
                  : 'RSVP'
                : isRsvped
                  ? 'Added'
                  : 'Add'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.featuredDetailsButton}
            onPress={() => setActiveFeaturedEvent(item)}
          >
            <Text style={styles.featuredDetailsButtonText}>Details</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  useEffect(() => {
    if (!rsvpBanner) return undefined;
    const timeout = setTimeout(() => setRsvpBanner(null), 2800);
    return () => clearTimeout(timeout);
  }, [rsvpBanner]);
  
  const handleReportPing = (item: any) => {
    Alert.alert(
      'Report Content',
      'Why are you reporting this ping?',
      [
        { text: 'Inappropriate', onPress: () => submitReport(item, 'inappropriate') },
        { text: 'Spam', onPress: () => submitReport(item, 'spam') },
        { text: 'Harassment', onPress: () => submitReport(item, 'harassment') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (item: any, reason: string) => {
    try {
      await reportContent({
        reporteeId: item.userId,
        postType: 'crowdping',
        postId: item.id,
        reason: reason
      });
      Alert.alert('Report Received', 'Thank you for keeping our community safe.');
    } catch (err) {
      Alert.alert('Error', 'Failed to submit report.');
    }
  };

  const handleBlockPingAuthor = (item: any) => {
    Alert.alert(
      'Block User',
      `Block ${item.userName}? You won't see their posts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block User', 
          style: 'destructive',
          onPress: async () => {
             try {
                await blockUser(item.userId);
                handleRefresh();
                Alert.alert('User Blocked');
             } catch (err) {
                Alert.alert('Error', 'Failed to block user.');
             }
          }
        },
      ]
    );
  };

  const renderPingCard = ({ item }: { item: PingCard }) => {
    const meta = categoryMeta(item.category);
    const canDelete = item.source === 'user' && user?.id && item.userId === user.id;
    const showCover =
      !item.imageUrl && (item.category === 'Study' || item.category === 'Show' || item.category === 'Sports');
    const isActive = isPingActiveNow(item.startAt, item.endAt);
    const initials = getInitials(item.userName);
    const AccentIcon = meta.Icon;
    const isOwnPing = item.userId === user?.id;

    return (
      <View style={styles.pingCard}>
        {item.imageUrl ? (
          <View style={styles.pingImageWrap}>
            <Image source={{ uri: item.imageUrl }} style={styles.pingImage} />
            <View style={styles.pingImageBadge}>
              <Text style={styles.pingImageBadgeText}>{item.category}</Text>
            </View>
          </View>
        ) : null}

        {showCover ? (
          <LinearGradient
            colors={[`${meta.accent}D9`, `${meta.accent}66`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pingCardCover}
          >
            <View style={styles.pingCardCoverBadge}>
              <Text style={styles.pingCardCoverBadgeText}>{item.category}</Text>
            </View>
            <View style={styles.pingCardCoverArt}>
              <AccentIcon size={38} color="#FFFFFF" />
            </View>
          </LinearGradient>
        ) : null}

        <View style={styles.pingAuthorRow}>
          <View style={styles.pingAuthorLeft}>
            {item.userImage ? (
              <Image source={{ uri: item.userImage }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: `${meta.accent}22` }]}>
                <Text style={[styles.avatarFallbackText, { color: meta.accent }]}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{item.userName}</Text>
              <Text style={styles.authorMeta}>{formatRelativeAge(item.createdAt)}</Text>
            </View>
          </View>

          {isActive ? (
            <View style={styles.liveNowPill}>
              <Text style={styles.liveNowText}>ACTIVE NOW</Text>
            </View>
          ) : (
            <Text style={styles.pingTimeLabel}>{formatStartLabel(item.startAt)}</Text>
          )}
        </View>

        {item.title.trim() ? <Text style={styles.pingTitle}>{item.title}</Text> : null}
        <Text style={styles.pingBody}>{item.body}</Text>

        <View style={styles.pingMetaRow}>
          <View style={styles.locationPill}>
            <MapPin size={14} color={COLORS.textPrimary} />
            <Text style={styles.locationPillText} numberOfLines={1}>
              {item.locationTag}
            </Text>
          </View>
          <Pressable style={styles.mapLinkButton} onPress={() => openPingOnMap(item)}>
            <Text style={styles.mapLinkLabel}>View map</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleVotePing(item, 'upvote')}
          >
            <ArrowBigUp
              size={22}
              color={item.ownVote === 'upvote' ? '#FF4500' : COLORS.textPrimary}
              fill={item.ownVote === 'upvote' ? '#FF4500' : 'none'}
            />
          </Pressable>

          <Text style={[
            styles.actionLabel, 
            { fontSize: 15, minWidth: 20, textAlign: 'center' },
            item.ownVote === 'upvote' && { color: '#FF4500' },
            item.ownVote === 'downvote' && { color: '#7193FF' }
          ]}>
            {item.score}
          </Text>

          <Pressable
            style={styles.actionButton}
            onPress={() => handleVotePing(item, 'downvote')}
          >
            <ArrowBigDown
              size={22}
              color={item.ownVote === 'downvote' ? '#7193FF' : COLORS.textPrimary}
              fill={item.ownVote === 'downvote' ? '#7193FF' : 'none'}
            />
          </Pressable>

          <Pressable style={[styles.actionButton, { marginLeft: 8 }]} onPress={() => savePingToPlans(item)}>
            <CalendarDays size={18} color={COLORS.textPrimary} />
          </Pressable>

          <View style={{ flex: 1 }} />

          {!isOwnPing ? (
            <>
              <Pressable style={styles.actionButton} onPress={() => handleReportPing(item)}>
                <Flag size={18} color={COLORS.textTertiary} />
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => handleBlockPingAuthor(item)}>
                <Shield size={18} color={COLORS.textTertiary} />
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.actionButton} onPress={() => handleDeletePing(item)}>
              <Trash2 size={18} color="#E56B6B" />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.heroTopRow}>
        <View>
          <Text style={styles.heroTitle}>CrowdPings</Text>
          <Text style={styles.heroBody}>What's happening around you</Text>
        </View>
      </View>

      <TourTarget
        name="crowdping-cta"
        assistAction={() => {
          setComposerVisible(true);
          setTimeout(() => advanceStep('crowdping-cta'), 900);
        }}
      >
        <View
          style={[
            activeTargetName === 'crowdping-cta' && {
              borderWidth: 2,
              borderColor: COLORS.primary,
              borderRadius: 16,
              padding: 2,
            },
          ]}
        >
          <Pressable 
            style={styles.quickPostBar} 
            onPress={() => {
              setComposerVisible(true);
              if (activeTargetName === 'crowdping-cta') {
                advanceStep('crowdping-cta');
              }
            }}
          >
            <View style={styles.quickPostIconWrap}>
              <Megaphone size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.quickPostText}>What's happening at...</Text>
          </Pressable>
        </View>
      </TourTarget>

      {streamError ? (
        <View style={styles.noticePill}>
          <Text style={styles.noticeText} numberOfLines={1}>{streamError}</Text>
        </View>
      ) : null}

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
            <Text style={styles.sectionTitle}>Featured</Text>
          </View>
          {rsvpBanner ? (
            <View style={styles.rsvpBanner}>
              <Text style={styles.rsvpBannerText}>{rsvpBanner}</Text>
            </View>
          ) : null}
          <FlatList
            horizontal
            data={featuredCards}
            keyExtractor={(item) => item.id}
            renderItem={renderFeaturedEvent}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
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

      {/* ── CUSTOM COMPOSER OVERLAY (Replaces Modal for Tour Compatibility) ── */}
      {composerVisible && (
        <Animated.View 
          entering={FadeIn} 
          exiting={FadeOut}
          style={StyleSheet.absoluteFill}
        >
          <TouchableWithoutFeedback
            onPress={() => {
              setComposerVisible(false);
              resetComposer();
            }}
          >
            <View style={styles.modalBackdrop}>
               <Animated.View
                entering={SlideInDown.duration(220)}
                exiting={SlideOutDown.duration(180)}
                 style={styles.modalKeyboardWrap}
              >
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={{ width: '100%' }}
                >
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalCard}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Create a ping</Text>
                        <TourTarget
                          name="crowdping-close"
                          assistAction={() => {
                            setComposerVisible(false);
                            resetComposer();
                            setTimeout(() => advanceStep('crowdping-close'), 250);
                          }}
                        >
                          <Pressable
                            onPress={() => {
                              setComposerVisible(false);
                              resetComposer();
                              if (activeTargetName === 'crowdping-close') {
                                advanceStep('crowdping-close');
                              }
                            }}
                            style={[
                              { padding: 12, borderRadius: 20 },
                              activeTargetName === 'crowdping-close' && { backgroundColor: `${COLORS.primary}15` }
                            ]}
                          >
                            <X size={20} color={activeTargetName === 'crowdping-close' ? COLORS.primary : COLORS.textPrimary} />
                          </Pressable>
                        </TourTarget>
                      </View>

                      <ScrollView
                        style={styles.modalScroll}
                        contentContainerStyle={styles.modalScrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                      >
                        <Text style={styles.modalLabel}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>
                          {PING_CATEGORIES.map((entry) => {
                            const active = composerCategory === entry.id;
                            return (
                              <Pressable
                                key={entry.id}
                                style={[styles.modalChip, active && styles.modalChipActive]}
                                onPress={() => setComposerCategory(entry.id)}
                              >
                                <Text style={[styles.modalChipLabel, active && styles.modalChipLabelActive]}>{entry.id}</Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>

                        <Text style={styles.modalLabel}>Title</Text>
                        <TextInput
                          value={composerTitle}
                          onChangeText={setComposerTitle}
                          placeholder="Free boba, pop-up market, pickup game..."
                          placeholderTextColor={COLORS.textTertiary}
                          style={styles.input}
                        />

                        <Text style={styles.modalLabel}>Details</Text>
                        <TextInput
                          value={composerBody}
                          onChangeText={setComposerBody}
                          placeholder="Give people the quick context they need before they head over."
                          placeholderTextColor={COLORS.textTertiary}
                          style={[styles.input, styles.inputMultiline]}
                          multiline
                        />

                        <Text style={styles.modalLabel}>Photo (Optional)</Text>
                        <View style={styles.imageComposerRow}>
                          <View style={styles.imagePickerActions}>
                            <Pressable style={styles.imagePickerButton} onPress={handlePickPingImage}>
                              <ImageIcon size={16} color={COLORS.textPrimary} />
                              <Text style={styles.imagePickerButtonText}>
                                {composerImageUri ? 'Choose another' : 'Choose photo'}
                              </Text>
                            </Pressable>
                            <Pressable style={styles.imagePickerButton} onPress={handleCapturePingImage}>
                              <Camera size={16} color={COLORS.textPrimary} />
                              <Text style={styles.imagePickerButtonText}>Take photo</Text>
                            </Pressable>
                          </View>
                          {composerImageUri ? (
                            <Pressable style={styles.imagePreviewWrap} onPress={handlePickPingImage}>
                              <Image source={{ uri: composerImageUri }} style={styles.imagePreview} />
                              <View style={styles.imagePreviewRemoveHint}>
                                <Text style={styles.imagePreviewRemoveHintText}>Tap to replace</Text>
                              </View>
                            </Pressable>
                          ) : (
                            <View style={styles.imageEmptyState}>
                              <Text style={styles.imageEmptyStateText}>No photo attached</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.optionalHelperText}>You can post a CrowdPing without adding an image.</Text>
                        {composerImageUri ? (
                          <Pressable style={styles.removeImageButton} onPress={() => setComposerImageUri(null)}>
                            <Text style={styles.removeImageButtonText}>Remove photo</Text>
                          </Pressable>
                        ) : null}

                        <Text style={styles.modalLabel}>When</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>
                          {TIME_PRESETS.map((entry) => {
                            const active = composerTimePreset === entry.id;
                            return (
                              <Pressable
                                key={entry.id}
                                style={[styles.modalChip, active && styles.modalChipActive]}
                                onPress={() => setComposerTimePreset(entry.id)}
                              >
                                <Text style={[styles.modalChipLabel, active && styles.modalChipLabelActive]}>{entry.label}</Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>

                        <Text style={styles.modalLabel}>Location</Text>
                        <View style={styles.searchInputWrap}>
                          <Search size={16} color={COLORS.textSecondary} />
                          <TextInput
                            value={locationQuery}
                            onChangeText={setLocationQuery}
                            placeholder="Search for a building or spot..."
                            placeholderTextColor={COLORS.textTertiary}
                            style={styles.searchInput}
                          />
                        </View>

                        {locationQuery.trim().length > 0 && !selectedLocation && (
                          <View style={styles.suggestionsWrap}>
                            {locationSuggestions.map((item) => (
                              <Pressable
                                key={item.location}
                                style={styles.suggestionItem}
                                onPress={() => handleSelectLocation(item.location)}
                              >
                                <MapPin size={14} color={COLORS.textSecondary} />
                                <Text style={styles.suggestionText}>{item.location}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}

                        {selectedLocation && (
                          <View style={styles.selectedLocationBadge}>
                            <MapPin size={14} color={COLORS.primary} />
                            <Text style={styles.selectedLocationText}>{selectedLocation}</Text>
                            <Pressable onPress={() => setSelectedLocation(null)}>
                              <X size={14} color={COLORS.textSecondary} />
                            </Pressable>
                          </View>
                        )}

                        <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View>
                            <Text style={styles.modalLabel}>Post Anonymously</Text>
                            <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Hides your name and profile photo</Text>
                          </View>
                          <Switch
                            value={composerAnonymous}
                            onValueChange={setComposerAnonymous}
                            trackColor={{ false: COLORS.border, true: COLORS.primary }}
                            thumbColor={Platform.OS === 'ios' ? undefined : (composerAnonymous ? COLORS.background : '#f4f3f4')}
                          />
                        </View>
                        
                        <View style={{ height: 160 }} />
                      </ScrollView>

                      <View style={styles.modalFooter}>
                        <Pressable
                          style={[styles.postButton, (!composerTitle.trim() || !composerBody.trim() || !selectedLocation) && styles.postButtonDisabled]}
                          onPress={handleCreatePing}
                          disabled={isPosting}
                        >
                          {isPosting ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.postButtonText}>Post CrowdPing</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      )}

      {/* ── Featured Event Modal ── */}
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
                      onPress={() =>
                        activeFeaturedEvent && handleFeaturedEventRsvp(activeFeaturedEvent)
                      }
                    >
                      <CalendarDays size={16} color="#FFFFFF" />
                      <Text
                        style={styles.primaryActionLabel}
                        numberOfLines={
                          activeFeaturedEvent?.isAdminEvent
                            ? 1
                            : activeFeaturedEvent?.rsvpStatus === 'going'
                              ? 1
                              : 2
                        }
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {activeFeaturedEvent?.isAdminEvent
                          ? activeFeaturedEvent?.rsvpStatus === 'going'
                            ? 'Remove RSVP'
                            : 'RSVP'
                          : activeFeaturedEvent?.rsvpStatus === 'going'
                            ? 'Remove from Schedule'
                            : 'Add'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() =>
                        activeFeaturedEvent && handleFeaturedEventShare(activeFeaturedEvent)
                      }
                    >
                      <Share2 size={16} color={COLORS.textPrimary} />
                      <Text style={styles.actionLabel}>Share</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() =>
                        activeFeaturedEvent && openFeaturedEventOnMap(activeFeaturedEvent)
                      }
                    >
                      <MapPin size={16} color={COLORS.textPrimary} />
                      <Text style={styles.actionLabel}>Open on map</Text>
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

const getStyles = (COLORS: any) =>
  StyleSheet.create({
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
    },
    listContent: {
      paddingBottom: 120,
    },
    headerWrap: {
      paddingTop: 48,
      paddingHorizontal: 18,
      paddingBottom: 8,
    },
    heroTopRow: {
      marginBottom: 14,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: COLORS.primary,
      marginBottom: 6,
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -1,
    },
    heroBody: {
      marginTop: 6,
      color: COLORS.textSecondary,
      fontSize: 15,
      fontWeight: '600',
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
      height: 72,
      borderRadius: 26,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 14,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 16,
      elevation: 3,
    },
    quickPostIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${COLORS.primary}14`,
    },
    quickPostText: {
      color: COLORS.textTertiary,
      fontSize: 17,
      fontWeight: '600',
    },
    noticePill: {
      marginTop: 14,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: '#FFF4EE',
      borderWidth: 1,
      borderColor: '#FFD7C7',
    },
    noticeText: {
      color: '#C25C32',
      fontSize: 12,
      fontWeight: '700',
    },
    sectionRow: {
      marginTop: 18,
      marginBottom: 10,
    },
    sectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    categoryRow: {
      gap: 8,
      paddingRight: 18,
      paddingTop: 10,
      paddingBottom: 2,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    categoryChipActive: {
      backgroundColor: COLORS.textPrimary,
      borderColor: COLORS.textPrimary,
    },
    categoryChipText: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    categoryChipTextActive: {
      color: COLORS.background,
    },
    featuredSection: {
      marginTop: 8,
    },
    featuredList: {
      paddingRight: 18,
      gap: 10,
    },
    featuredCard: {
      width: 188,
      borderRadius: 22,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 14,
      elevation: 3,
    },
    featuredVisual: {
      height: 92,
      padding: 12,
      justifyContent: 'space-between',
    },
    featuredCardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    featuredVisualChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.88)',
    },
    featuredVisualChipText: {
      color: '#2F2F34',
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    featuredBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    featuredBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    featuredTime: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right',
    },
    featuredContent: {
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    featuredFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 2,
    },
    featuredRsvpButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
    },
    featuredRsvpButtonSaved: {
      backgroundColor: `${COLORS.primary}14`,
      borderWidth: 1,
      borderColor: `${COLORS.primary}26`,
    },
    featuredRsvpButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    featuredRsvpButtonTextSaved: {
      color: COLORS.textPrimary,
    },
    featuredDetailsButton: {
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    featuredDetailsButtonText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    featuredTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 19,
    },
    featuredMeta: {
      marginTop: 6,
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    rsvpBanner: {
      marginLeft: 18,
      marginBottom: 10,
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: '#EAF8EE',
      borderWidth: 1,
      borderColor: '#B9E8C4',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rsvpBannerText: {
      color: '#17663A',
      fontSize: 12,
      fontWeight: '800',
    },
    pingCard: {
      marginTop: 16,
      marginHorizontal: 18,
      padding: 18,
      borderRadius: 28,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 18,
      elevation: 4,
    },
    pingCardCover: {
      height: 188,
      marginHorizontal: -18,
      marginTop: -18,
      marginBottom: 16,
      padding: 18,
      justifyContent: 'space-between',
    },
    pingImageWrap: {
      height: 208,
      marginHorizontal: -18,
      marginTop: -18,
      marginBottom: 16,
      position: 'relative',
      overflow: 'hidden',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    pingImage: {
      width: '100%',
      height: '100%',
    },
    pingImageBadge: {
      position: 'absolute',
      top: 16,
      right: 16,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    pingImageBadgeText: {
      color: '#202026',
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    pingCardCoverBadge: {
      alignSelf: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    pingCardCoverBadgeText: {
      color: '#202026',
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    pingCardCoverArt: {
      width: 86,
      height: 86,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
    },
    pingAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
    },
    pingAuthorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    avatarImage: {
      width: 46,
      height: 46,
      borderRadius: 23,
    },
    avatarFallback: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      fontSize: 15,
      fontWeight: '800',
    },
    authorName: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    authorMeta: {
      marginTop: 2,
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
    },
    categoryBadgeText: {
      fontSize: 12,
      fontWeight: '800',
    },
    pingTimeLabel: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    liveNowPill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: '#EEF9EF',
    },
    liveNowText: {
      color: '#198754',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    pingTitle: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 22,
    },
    pingBody: {
      marginTop: 10,
      color: COLORS.textPrimary,
      fontSize: 17,
      lineHeight: 28,
      letterSpacing: -0.2,
    },
    pingMetaRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    locationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    locationPillText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    mapLinkButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    mapLinkLabel: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    actionRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
    },
    actionButtonActive: {
      opacity: 0.95,
    },
    actionLabel: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
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
    emptyState: {
      marginTop: 18,
      marginHorizontal: 18,
      paddingHorizontal: 24,
      paddingVertical: 26,
      borderRadius: 28,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      overflow: 'hidden',
    },
    emptyIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
    },
    emptyTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyQuote: {
      marginTop: 10,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 260,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.48)',
      justifyContent: 'flex-end',
    },
    modalKeyboardWrap: {
      width: '100%',
      justifyContent: 'flex-end',
      height: '100%',
    },
    modalCard: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
      height: '88%',
      overflow: 'hidden',
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      paddingBottom: 12,
    },
    featuredModalCard: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
      minHeight: '38%',
    },
    commentModalCard: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 22,
      minHeight: '54%',
      maxHeight: '82%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
    },
    modalTitle: {
      color: COLORS.textPrimary,
      fontSize: 20,
      fontWeight: '800',
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
    modalLabel: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 8,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    modalChipRow: {
      gap: 10,
      paddingRight: 16,
    },
    modalChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    modalChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    modalChipLabel: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    modalChipLabelActive: {
      color: '#FFFFFF',
    },
    input: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: COLORS.textPrimary,
      fontSize: 15,
    },
    inputMultiline: {
      minHeight: 110,
      textAlignVertical: 'top',
    },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      paddingVertical: 12,
      fontSize: 15,
    },
    locationResults: {
      maxHeight: 210,
      marginTop: 10,
      borderRadius: 16,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    locationSuggestion: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    locationSuggestionActive: {
      backgroundColor: COLORS.surfaceElevated,
    },
    locationSuggestionTitle: {
      color: COLORS.textPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    locationSuggestionMeta: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 12,
    },
    imageComposerRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 12,
      marginBottom: 4,
    },
    imagePickerActions: {
      flex: 1,
      gap: 12,
    },
    imagePickerButton: {
      flex: 1,
      minHeight: 96,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 14,
    },
    imagePickerButtonText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    imagePreviewWrap: {
      width: 112,
      height: 96,
      borderRadius: 18,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: COLORS.surface,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
    },
    imagePreviewRemoveHint: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.58)',
      paddingVertical: 5,
      alignItems: 'center',
    },
    imagePreviewRemoveHintText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    imageEmptyState: {
      width: 112,
      height: 96,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    imageEmptyStateText: {
      color: COLORS.textTertiary,
      fontSize: 12,
      fontWeight: '700',
    },
    optionalHelperText: {
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 2,
    },
    removeImageButton: {
      alignSelf: 'flex-start',
      marginTop: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    removeImageButtonText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    modalFooter: {
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    submitButton: {
      marginTop: 8,
      height: 54,
      borderRadius: 18,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    submitButtonLabel: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    commentModalSubtitle: {
      marginTop: 4,
      color: COLORS.textSecondary,
      lineHeight: 19,
    },
    commentsLoadingWrap: {
      flex: 1,
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentList: {
      maxHeight: 320,
    },
    commentRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    commentName: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 4,
    },
    commentBody: {
      color: COLORS.textSecondary,
      lineHeight: 19,
    },
    emptyCommentsWrap: {
      paddingVertical: 28,
      alignItems: 'center',
    },
    emptyCommentsText: {
      color: COLORS.textSecondary,
    },
    commentComposer: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    commentInput: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: COLORS.textPrimary,
    },
    commentSendButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionsWrap: {
      maxHeight: 210,
      marginTop: 10,
      borderRadius: 16,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    suggestionText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    selectedLocationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: `${COLORS.primary}12`,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      marginTop: 12,
      borderWidth: 1,
      borderColor: `${COLORS.primary}25`,
    },
    selectedLocationText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    postButton: {
      height: 56,
      borderRadius: 18,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    postButtonDisabled: {
      opacity: 0.5,
    },
    postButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
  });
