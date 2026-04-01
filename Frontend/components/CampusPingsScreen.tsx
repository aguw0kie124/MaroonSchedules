import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
} from 'lucide-react-native';

import { API_URL } from '../config';
import { useTheme } from './SharedUI';
import { useShareStore } from '../store/shareStore';
import { useEventStore } from '../store/eventStore';
import {
  addComment,
  addPing,
  connectFeedsUser,
  deletePing,
  getComments,
  getPingFeed,
  toggleLike,
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

const FEATURED_EVENT_LIMIT = 6;

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

  return {
    id: activity.id || `${Date.now()}`,
    source: 'user',
    title: custom.ping_title || 'Campus Ping',
    body: activity.text || '',
    category: custom.ping_category || 'Popup',
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
  };
}

function mapFeaturedEventToPing(event: FeaturedEvent): PingCard {
  return {
    id: `official-${event.id}`,
    source: 'official',
    title: event.title,
    body: event.description,
    category: mapOfficialEventCategory(event),
    locationTag: event.location || 'Campus',
    startAt: event.startTime,
    endAt: event.endTime || null,
    createdAt: event.startTime,
    userName: 'Texas A&M Events',
    userImage: null,
    likeCount: 0,
    commentCount: 0,
    boostedByCurrentUser: false,
    sourceUrl: event.link || null,
    locationLat: event.locationLat ?? null,
    locationLng: event.locationLng ?? null,
  };
}

export function CampusPingsScreen() {
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const openShare = useShareStore((state) => state.openShare);
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
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const [composerVisible, setComposerVisible] = useState(false);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerCategory, setComposerCategory] = useState<PingCategory>('Popup');
  const [composerTimePreset, setComposerTimePreset] = useState<TimePreset>('now');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activeCommentPing, setActiveCommentPing] = useState<PingCard | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

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

  const featuredPings = useMemo(
    () =>
      featuredEvents.map((event) => {
        const mapped = mapFeaturedEventToPing(event);
        const location = locationLookup.get(getCanonicalLocationName(mapped.locationTag));
        return {
          ...mapped,
          locationLat: mapped.locationLat ?? location?.coord.lat ?? null,
          locationLng: mapped.locationLng ?? location?.coord.lng ?? null,
        };
      }),
    [featuredEvents, locationLookup],
  );

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
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [locationLookup, userPings],
  );

  const filteredFeed = useMemo(() => {
    if (categoryFilter === 'All') return feedPings;
    return feedPings.filter((ping) => ping.category === categoryFilter);
  }, [categoryFilter, feedPings]);

  const loadFeaturedEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/campus/events?limit=${FEATURED_EVENT_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const nextEvents = (data || []).map((event: any) => ({
        id: String(event.event_id),
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
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const handleSelectLocation = useCallback((locationName: string) => {
    setSelectedLocation(locationName);
    setLocationQuery(locationName);
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
      await addPing({
        userId: user.id,
        userName: displayName,
        userImage: user.imageUrl,
        title: composerTitle.trim(),
        body: composerBody.trim(),
        category: composerCategory,
        locationTag: selectedLocation,
        startAt,
        endAt,
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
          initialLayer: 'Today',
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

  const sharePing = useCallback(
    (ping: PingCard) => {
      openShare({
        title: ping.title,
        message: `${ping.title} at ${ping.locationTag}. ${ping.body}`,
        url: ping.sourceUrl || 'https://maroonschedules.tamu.edu',
      });
    },
    [openShare],
  );

  const renderFeaturedEvent = ({ item }: { item: PingCard }) => {
    const meta = categoryMeta(item.category);
    return (
      <View style={[styles.featuredCard, { borderColor: `${meta.accent}44` }]}>
        <View style={[styles.featuredBadge, { backgroundColor: `${meta.accent}22` }]}>
          <Text style={[styles.featuredBadgeText, { color: meta.accent }]}>Featured</Text>
        </View>
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.featuredMeta}>{formatStartLabel(item.startAt)}</Text>
        <Text style={styles.featuredMeta} numberOfLines={1}>
          {item.locationTag}
        </Text>
        <Text style={styles.featuredBody} numberOfLines={3}>
          {item.body || 'High-energy campus event'}
        </Text>
        <View style={styles.featuredActions}>
          <Pressable style={styles.secondaryChipButton} onPress={() => openPingOnMap(item)}>
            <MapPin size={14} color={COLORS.textPrimary} />
            <Text style={styles.secondaryChipLabel}>Map</Text>
          </Pressable>
          <Pressable style={styles.secondaryChipButton} onPress={() => savePingToPlans(item)}>
            <CalendarDays size={14} color={COLORS.textPrimary} />
            <Text style={styles.secondaryChipLabel}>Save</Text>
          </Pressable>
          {item.sourceUrl ? (
            <Pressable
              style={styles.secondaryChipButton}
              onPress={() => Linking.openURL(item.sourceUrl!).catch(() => sharePing(item))}
            >
              <ExternalLink size={14} color={COLORS.textPrimary} />
              <Text style={styles.secondaryChipLabel}>Details</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const renderPingCard = ({ item }: { item: PingCard }) => {
    const meta = categoryMeta(item.category);
    const canDelete = item.source === 'user' && user?.id && item.userId === user.id;

    return (
      <View style={styles.pingCard}>
        <View style={styles.pingCardTopRow}>
          <View style={[styles.categoryBadge, { backgroundColor: `${meta.accent}20` }]}>
            <meta.Icon size={14} color={meta.accent} />
            <Text style={[styles.categoryBadgeText, { color: meta.accent }]}>{item.category}</Text>
          </View>
          <Text style={styles.pingTimeLabel}>{formatStartLabel(item.startAt)}</Text>
        </View>

        <Text style={styles.pingTitle}>{item.title}</Text>
        <Text style={styles.pingBody}>{item.body}</Text>

        <View style={styles.pingMetaRow}>
          <View style={styles.metaRowItem}>
            <MapPin size={14} color={COLORS.textSecondary} />
            <Text style={styles.pingMetaText}>{item.locationTag}</Text>
          </View>
          <View style={styles.metaRowItem}>
            <Users size={14} color={COLORS.textSecondary} />
            <Text style={styles.pingMetaText}>{item.userName}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
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

          <Pressable style={styles.actionButton} onPress={() => openComments(item)}>
            <MessageCircle size={16} color={COLORS.textPrimary} />
            <Text style={styles.actionLabel}>{item.commentCount}</Text>
          </Pressable>

          <Pressable style={styles.primaryActionButton} onPress={() => openPingOnMap(item)}>
            <MapPin size={16} color="#FFFFFF" />
            <Text style={styles.primaryActionLabel}>Open on map</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => savePingToPlans(item)}>
            <CalendarDays size={16} color={COLORS.textPrimary} />
            <Text style={styles.actionLabel}>Save</Text>
          </Pressable>

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
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>Campus Pulse</Text>
            <Text style={styles.heroTitle}>Pings</Text>
          </View>
          <Pressable style={styles.composeButton} onPress={() => setComposerVisible(true)}>
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.composeButtonLabel}>New ping</Text>
          </Pressable>
        </View>
        <Text style={styles.heroBody}>
          Fast, location-tagged campus updates for popups, free food, meetups, shows, and anything people should know before they head somewhere.
        </Text>
      </View>

      {streamError ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Live feed notice</Text>
          <Text style={styles.noticeText}>{streamError}</Text>
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Featured campus events</Text>
        <Text style={styles.sectionMeta}>Official events with map-ready context</Text>
      </View>

      <FlatList
        horizontal
        data={featuredPings}
        keyExtractor={(item) => item.id}
        renderItem={renderFeaturedEvent}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuredList}
      />

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Live pings</Text>
        <Text style={styles.sectionMeta}>Student-posted activity around campus</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {['All', ...PING_CATEGORIES.map((entry) => entry.id)].map((category) => {
          const active = categoryFilter === category;
          return (
            <Pressable
              key={category}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setCategoryFilter(category)}
            >
              <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>{category}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
            <Text style={styles.emptyTitle}>No live pings yet</Text>
            <Text style={styles.emptyBody}>
              Start the layer by posting the first popup, meetup, or free-food alert.
            </Text>
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
      paddingTop: 56,
      paddingHorizontal: 16,
    },
    heroCard: {
      padding: 20,
      borderRadius: 28,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
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
      letterSpacing: -0.8,
    },
    heroBody: {
      marginTop: 12,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    composeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
    },
    composeButtonLabel: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    noticeCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 18,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    noticeTitle: {
      color: COLORS.textPrimary,
      fontWeight: '800',
      marginBottom: 4,
    },
    noticeText: {
      color: COLORS.textSecondary,
      lineHeight: 19,
    },
    sectionRow: {
      marginTop: 24,
      marginBottom: 10,
    },
    sectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    sectionMeta: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 13,
    },
    featuredList: {
      paddingRight: 16,
      gap: 12,
    },
    featuredCard: {
      width: 250,
      padding: 16,
      borderRadius: 22,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
    },
    featuredBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      marginBottom: 12,
    },
    featuredBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    featuredTitle: {
      color: COLORS.textPrimary,
      fontWeight: '800',
      fontSize: 18,
      lineHeight: 22,
    },
    featuredMeta: {
      marginTop: 6,
      color: COLORS.textSecondary,
      fontSize: 13,
    },
    featuredBody: {
      marginTop: 10,
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      minHeight: 54,
    },
    featuredActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    secondaryChipButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: COLORS.surfaceElevated,
    },
    secondaryChipLabel: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    filterRow: {
      paddingVertical: 6,
      paddingRight: 16,
      gap: 10,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    filterChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    filterChipLabel: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    filterChipLabelActive: {
      color: '#FFFFFF',
    },
    pingCard: {
      marginTop: 14,
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 24,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    pingCardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
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
    pingTitle: {
      marginTop: 14,
      color: COLORS.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24,
    },
    pingBody: {
      marginTop: 8,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    pingMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 14,
    },
    metaRowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pingMetaText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    actionRow: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: COLORS.surfaceElevated,
    },
    actionButtonActive: {
      backgroundColor: 'rgba(255,100,127,0.12)',
    },
    actionLabel: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    primaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
    },
    primaryActionLabel: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
    emptyState: {
      marginTop: 18,
      marginHorizontal: 16,
      padding: 24,
      borderRadius: 24,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
    },
    emptyTitle: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    emptyBody: {
      marginTop: 8,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
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
      paddingBottom: 28,
      maxHeight: '88%',
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
      maxHeight: 220,
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
    submitButton: {
      marginTop: 16,
      height: 52,
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
