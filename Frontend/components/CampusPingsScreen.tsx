import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import {
  CalendarDays,
  ExternalLink,
  Flame,
  Heart,
  MapPin,
  Megaphone,
  MessageCircle,
  Pizza,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
  Image as ImageIcon,
} from 'lucide-react-native';

import { API_URL } from '../config';
import { useTheme } from './SharedUI';
import { useEventStore } from '../store/eventStore';
import {
  addComment,
  addPing,
  connectFeedsUser,
  deletePing,
  getComments,
  getPingFeed,
  toggleLike,
  uploadStreamImage,
} from '../services/streamFeeds';
import { buildCampusDirectory, getCanonicalLocationName } from './places/campusData';

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
  likeCount: number;
  commentCount: number;
  boostedByCurrentUser: boolean;
  activityId?: string;
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
    userId: actor.id || activity.actor || '',
    userName: actor.data?.name || custom.user_name || 'Aggie',
    userImage: actor.data?.image || custom.user_image || null,
    likeCount: activity.reaction_counts?.like || activity.reaction_count || 0,
    commentCount: activity.reaction_counts?.comment || 0,
    boostedByCurrentUser: (activity.own_reactions?.like || []).length > 0,
    activityId: activity.id,
    sourceUrl: null,
    imageUrl: media.image_url || media.asset_url || null,
  };
}

export function CampusPingsScreen() {
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const scheduleEvent = useEventStore((state) => state.scheduleEvent);
  const saveEvent = useEventStore((state) => state.saveEvent);

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
  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<PingCategory>('Popup');
  const [composerTimePreset, setComposerTimePreset] = useState<TimePreset>('now');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [composerImageUri, setComposerImageUri] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeCommentPing, setActiveCommentPing] = useState<PingCard | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
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

  const loadFeaturedEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/campus/events?limit=12`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
        locationLat: event.location_lat ?? null,
        locationLng: event.location_lng ?? null,
        categories: event.categories || undefined,
      }));
      setFeaturedEvents(nextEvents);
    } catch (error) {
      console.warn('[Pings] Failed to load featured events', error);
      setFeaturedEvents([]);
    }
  }, []);

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

    try {
      const displayName =
        user.username ||
        user.fullName ||
        user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
        'Aggie';
      await connectFeedsUser(user.id, displayName, user.imageUrl);
      setFeedConnected(true);
      await loadUserPings();
    } catch (error) {
      console.warn('[Pings] Stream connection failed', error);
      setFeedConnected(false);
      setStreamError('Live pings are unavailable until the feed connection is restored.');
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

    const displayName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`.trim()
        : user.firstName || user.fullName || user.username || 'Aggie';

    const { startAt, endAt } = buildPresetWindow(composerTimePreset);
    setIsPosting(true);
    try {
      let uploadedImageUrl: string | undefined;
      if (composerImageUri) {
        uploadedImageUrl = await uploadStreamImage(composerImageUri);
      }

      await addPing({
        userId: user.id,
        userName: displayName,
        userImage: user.imageUrl,
        title: composerTitle.trim(),
        body: composerBody.trim(),
        category: composerCategory,
        locationTag: selectedLocation,
        placeId:
          locationLookup.get(getCanonicalLocationName(selectedLocation))?.placeId || undefined,
        startAt,
        endAt,
        mediaUrl: uploadedImageUrl,
      });

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
    composerImageUri,
    composerTimePreset,
    composerTitle,
    feedConnected,
    loadUserPings,
    resetComposer,
    selectedLocation,
    user,
  ]);

  const handleBoostPing = useCallback(
    async (ping: PingCard) => {
      if (!user || !feedConnected || !ping.activityId || ping.source !== 'user') return;
      if (ping.boostedByCurrentUser) return;

      setUserPings((current) =>
        current.map((entry) =>
          entry.id === ping.id
            ? { ...entry, boostedByCurrentUser: true, likeCount: entry.likeCount + 1 }
            : entry,
        ),
      );

      try {
        await toggleLike(ping.activityId, user.id);
      } catch (error) {
        console.warn('[Pings] boost failed', error);
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
              setUserPings((current) => current.filter((entry) => entry.id !== ping.id));
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
    if (ping.source !== 'user' || !ping.activityId) return;
    setActiveCommentPing(ping);
    setCommentModalVisible(true);
    setLoadingComments(true);
    try {
      const nextComments = await getComments(ping.activityId);
      setComments(nextComments);
    } catch (error) {
      console.warn('[Pings] comment fetch failed', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const handleSendComment = useCallback(async () => {
    if (!user || !activeCommentPing?.activityId || !commentText.trim()) return;
    setSendingComment(true);
    try {
      await addComment(activeCommentPing.activityId, user, commentText.trim());
      const nextComments = await getComments(activeCommentPing.activityId);
      setComments(nextComments);
      setCommentText('');
      setUserPings((current) =>
        current.map((entry) =>
          entry.id === activeCommentPing.id
            ? { ...entry, commentCount: entry.commentCount + 1 }
            : entry,
        ),
      );
    } catch (error) {
      console.warn('[Pings] comment send failed', error);
      Alert.alert('Comment failed', 'Could not post this reply right now.');
    } finally {
      setSendingComment(false);
    }
  }, [activeCommentPing, commentText, user]);

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
    const meta = categoryMeta(item.category);
    const canDelete = item.source === 'user' && user?.id && item.userId === user.id;
    const showCover =
      !item.imageUrl && (item.category === 'Study' || item.category === 'Show' || item.category === 'Sports');
    const isActive = isPingActiveNow(item.startAt, item.endAt);
    const initials = getInitials(item.userName);
    const AccentIcon = meta.Icon;

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
          <Pressable style={styles.actionButton} onPress={() => openComments(item)}>
            <MessageCircle size={16} color={COLORS.textPrimary} />
            <Text style={styles.actionLabel}>{item.commentCount}</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, item.boostedByCurrentUser && styles.actionButtonActive]}
            onPress={() => handleBoostPing(item)}
          >
            <Heart
              size={16}
              color={item.boostedByCurrentUser ? '#FF647F' : COLORS.textPrimary}
              fill={item.boostedByCurrentUser ? '#FF647F' : 'none'}
            />
            <Text style={styles.actionLabel}>{item.likeCount}</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => savePingToPlans(item)}>
            <CalendarDays size={16} color={COLORS.textPrimary} />
          </Pressable>

          <View style={{ flex: 1 }} />

          {canDelete ? (
            <Pressable style={styles.actionButton} onPress={() => handleDeletePing(item)}>
              <Trash2 size={16} color="#E56B6B" />
            </Pressable>
          ) : null}
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

      <Pressable style={styles.quickPostBar} onPress={() => setComposerVisible(true)}>
        <View style={styles.quickPostIconWrap}>
          <Megaphone size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.quickPostText}>What's happening at...</Text>
      </Pressable>

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

      <Modal visible={composerVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback
          onPress={() => {
            setComposerVisible(false);
            resetComposer();
          }}
        >
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboardWrap}
            >
              <TouchableWithoutFeedback>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Create a ping</Text>
                    <Pressable
                      onPress={() => {
                        setComposerVisible(false);
                        resetComposer();
                      }}
                    >
                      <X size={20} color={COLORS.textPrimary} />
                    </Pressable>
                  </View>

                  <ScrollView
                    style={styles.modalScroll}
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
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

                    <Text style={styles.modalLabel}>Photo</Text>
                    <View style={styles.imageComposerRow}>
                      <Pressable style={styles.imagePickerButton} onPress={handlePickPingImage}>
                        <ImageIcon size={16} color={COLORS.textPrimary} />
                        <Text style={styles.imagePickerButtonText}>
                          {composerImageUri ? 'Change photo' : 'Add photo'}
                        </Text>
                      </Pressable>
                      {composerImageUri ? (
                        <Pressable style={styles.imagePreviewWrap} onPress={handlePickPingImage}>
                          <Image source={{ uri: composerImageUri }} style={styles.imagePreview} />
                          <View style={styles.imagePreviewRemoveHint}>
                            <Text style={styles.imagePreviewRemoveHintText}>Tap to edit</Text>
                          </View>
                        </Pressable>
                      ) : (
                        <View style={styles.imageEmptyState}>
                          <Text style={styles.imageEmptyStateText}>Optional</Text>
                        </View>
                      )}
                    </View>

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
                        onChangeText={(text) => {
                          setLocationQuery(text);
                          setSelectedLocation(null);
                        }}
                        placeholder="Search for a campus location"
                        placeholderTextColor={COLORS.textTertiary}
                        style={styles.searchInput}
                      />
                    </View>

                    <ScrollView style={styles.locationResults} keyboardShouldPersistTaps="handled">
                      {locationSuggestions.map((location) => {
                        const active = selectedLocation === location.location;
                        return (
                          <Pressable
                            key={location.location}
                            style={[styles.locationSuggestion, active && styles.locationSuggestionActive]}
                            onPress={() => handleSelectLocation(location.location)}
                          >
                            <Text style={styles.locationSuggestionTitle}>{location.location}</Text>
                            <Text style={styles.locationSuggestionMeta}>
                              {location.type}
                              {location.shortName ? ` · ${location.shortName}` : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </ScrollView>

                  <View style={styles.modalFooter}>
                    <Pressable style={styles.submitButton} onPress={handleCreatePing} disabled={isPosting}>
                      {isPosting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Plus size={18} color="#FFFFFF" />
                          <Text style={styles.submitButtonLabel}>Post ping</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
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

      <Modal visible={commentModalVisible} animationType="fade" transparent>
        <TouchableWithoutFeedback
          onPress={() => {
            setCommentModalVisible(false);
            setActiveCommentPing(null);
            setCommentText('');
          }}
        >
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboardWrap}
            >
              <TouchableWithoutFeedback>
                <View style={styles.commentModalCard}>
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>Replies</Text>
                      <Text style={styles.commentModalSubtitle} numberOfLines={2}>
                        {activeCommentPing?.title}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setCommentModalVisible(false);
                        setActiveCommentPing(null);
                        setCommentText('');
                      }}
                    >
                      <X size={20} color={COLORS.textPrimary} />
                    </Pressable>
                  </View>

                  {loadingComments ? (
                    <View style={styles.commentsLoadingWrap}>
                      <ActivityIndicator color={COLORS.primary} />
                    </View>
                  ) : (
                    <ScrollView style={styles.commentList} showsVerticalScrollIndicator={false}>
                      {comments.length ? (
                        comments.map((comment: any, index: number) => (
                          <View key={`${comment.id || index}`} style={styles.commentRow}>
                            <Text style={styles.commentName}>
                              {comment.data?.name || comment.user?.data?.name || 'Aggie'}
                            </Text>
                            <Text style={styles.commentBody}>
                              {comment.data?.text || comment.data?.comment || ''}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.emptyCommentsWrap}>
                          <Text style={styles.emptyCommentsText}>No replies yet.</Text>
                        </View>
                      )}
                    </ScrollView>
                  )}

                  <View style={styles.commentComposer}>
                    <TextInput
                      value={commentText}
                      onChangeText={setCommentText}
                      placeholder="Add a quick reply"
                      placeholderTextColor={COLORS.textTertiary}
                      style={styles.commentInput}
                    />
                    <Pressable style={styles.commentSendButton} onPress={handleSendComment} disabled={sendingComment}>
                      {sendingComment ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <MessageCircle size={16} color="#FFFFFF" />
                      )}
                    </Pressable>
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
    },
    modalCard: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
      maxHeight: '88%',
    },
    modalScroll: {
      flexGrow: 0,
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
  });
