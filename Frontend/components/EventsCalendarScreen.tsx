import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import {
  ArrowRight,
  BadgeCheck,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  ChevronLeft,
  Filter,
  GraduationCap,
  Heart,
  HeartPulse,
  Inbox,
  Map,
  MapPin,
  Megaphone,
  Pizza,
  Search,
  Settings,
  Share2,
  Ticket,
  Trash2,
  Trophy,
  Users,
  X as XIcon,
} from 'lucide-react-native';


import { API_URL } from '../config';
import { TourTarget, useTour } from './onboarding/TourProvider';
import { useShareStore } from '../store/shareStore';
import { useEventStore } from '../store/eventStore';
import type { MajorOption, ScheduledEvent } from '../store/eventStore';
import { useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { scheduleEventNotification } from '../services/notificationService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.24;
const TAMU_EVENTS_API = `${API_URL}/campus/events?limit=1000`;

interface CampusEventResponse {
  event_id: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  start_time: string;
  end_time?: string | null;
  link?: string | null;
  source_url?: string | null;
  host_name?: string | null;
  source_name?: string | null;
  tags?: string[] | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  image_url?: string | null;
  is_admin_event?: boolean;
}

interface TAMUEvent {
  id: string | number;
  title: string;
  date_ts: number;
  date_iso: string;
  date2_ts?: number | null;
  location?: string | null;
  location_title?: string | null;
  description?: string | null;
  url?: string;
  tags?: string[] | null;
  event_types?: string[] | null;
  group_title?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  imageUrl?: string | null;
  is_admin_event?: boolean;
  _searchBlob?: string;
  _category?: ExploreCategory;
  _socialMode?: SocialMode;
}

type ExploreCategory =
  | 'Featured'
  | 'Food'
  | 'Sports'
  | 'Social'
  | 'Miscellaneous'
  | 'Advocacy'
  | 'Academic'
  | 'Entertainment'
  | 'Health & Wellness';

type SocialMode = 'casual' | 'professional';
type EventsView = 'discover' | 'list' | 'swipe' | 'inbox';

const ALL_CATEGORIES: ExploreCategory[] = [
  'Featured',
  'Sports',
  'Academic',
  'Food',
  'Social',
  'Health & Wellness',
  'Entertainment',
  'Advocacy',
  'Miscellaneous',
];

const MAJOR_OPTIONS: MajorOption[] = [
  'Engineering',
  'Business',
  'Liberal Arts',
  'Agriculture',
  'Science',
  'Architecture',
  'Education',
  'Public Health',
  'Law',
  'Medicine',
];

export const CATEGORY_META: Record<
  ExploreCategory,
  {
    accent: string;
    chipBg: string;
    chipText: string;
    cardTint: string;
    icon: React.ComponentType<any>;
  }
> = {
  Featured: {
    accent: '#FFD700',
    chipBg: '#FFF9C4',
    chipText: '#F57F17',
    cardTint: '#FBC02D',
    icon: BadgeCheck,
  },
  Sports: {
    accent: '#71B7FF',
    chipBg: '#CFE7FF',
    chipText: '#173A66',
    cardTint: '#74A9F7',
    icon: Trophy,
  },
  Academic: {
    accent: '#FFC47A',
    chipBg: '#FFE0B9',
    chipText: '#5B3710',
    cardTint: '#F8B66A',
    icon: GraduationCap,
  },
  Food: {
    accent: '#BCE8C5',
    chipBg: '#DDF5E2',
    chipText: '#274E30',
    cardTint: '#6EBF7E',
    icon: Pizza,
  },
  Social: {
    accent: '#F7B4B8',
    chipBg: '#FFD7DA',
    chipText: '#6A2331',
    cardTint: '#E37E89',
    icon: Users,
  },
  'Health & Wellness': {
    accent: '#F8C5D4',
    chipBg: '#FFE0E8',
    chipText: '#6D2741',
    cardTint: '#E483A8',
    icon: HeartPulse,
  },
  Entertainment: {
    accent: '#D7C7FF',
    chipBg: '#E9DFFF',
    chipText: '#442A7C',
    cardTint: '#8C73E8',
    icon: Ticket,
  },
  Advocacy: {
    accent: '#BDE5D3',
    chipBg: '#D6F2E4',
    chipText: '#214E40',
    cardTint: '#6EB59A',
    icon: Megaphone,
  },
  Miscellaneous: {
    accent: '#D7DCE8',
    chipBg: '#ECEFF5',
    chipText: '#3A4458',
    cardTint: '#8A97B0',
    icon: CalendarDays,
  },
};

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function getSearchBlob(event: TAMUEvent) {
  return [
    event.title,
    event.description,
    event.location,
    event.location_title,
    event.group_title,
    ...(event.tags || []),
    ...(event.event_types || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function resolveEventImageUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `${API_URL}${value}`;
  return value;
}

function classifyCategory(event: TAMUEvent): ExploreCategory {
  if (event.is_admin_event || event.categories?.featured) return 'Featured';

  if (event.categories) {
    if (event.categories.food) return 'Food';
    if (event.categories.sports) return 'Sports';
    if (event.categories.entertainment) return 'Entertainment';
    if (event.categories.advocacy) return 'Advocacy';
    if (event.categories.academic) return 'Academic';
    if (event.categories.health_wellness) return 'Health & Wellness';
    if (event.categories.social) return 'Social';
    if (event.categories.miscellaneous || event.categories.religion) return 'Miscellaneous';
  }

  const blob = getSearchBlob(event);
  if (event.has_food || /\bfood\b|\bmeal\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bpizza\b|\brefreshments\b/.test(blob)) return 'Food';
  if (/\bsport\b|\bgame\b|\bmatch\b|\btournament\b|\bathletic\b|\bworkout\b/.test(blob)) return 'Sports';
  if (/\bconcert\b|\bshow\b|\bmovie\b|\bcomedy\b|\bmusic\b|\bperformance\b|\bfestival\b/.test(blob)) return 'Entertainment';
  if (/\badvocacy\b|\bactivism\b|\bawareness\b|\bvolunteer\b|\bjustice\b/.test(blob)) return 'Advocacy';
  if (/\blecture\b|\bseminar\b|\bstudy\b|\bresearch\b|\bacademic\b|\btutoring\b|\bscholar/i.test(blob)) return 'Academic';
  if (/\byoga\b|\bmental health\b|\bwellness\b|\bself.care\b|\btherapy\b|\bhealth fair/i.test(blob)) return 'Health & Wellness';
  if (/\bsocial\b|\bmixer\b|\bmeet\b|\bfriends\b|\bhangout\b|\bparty\b/i.test(blob)) return 'Social';
  return 'Miscellaneous';
}

function getSocialMode(event: TAMUEvent): SocialMode {
  const blob = event._searchBlob || getSearchBlob(event);
  if (/\bcareer\b|\bnetworking\b|\bprofessional\b|\bresume\b|\binterview\b|\bcompany\b|\brecruit\b|\bworkshop\b|\bpanel\b/.test(blob)) {
    return 'professional';
  }
  return 'casual';
}

function matchesMajor(event: TAMUEvent, major: MajorOption) {
  const blob = event._searchBlob || getSearchBlob(event);
  const aliases: Record<MajorOption, string[]> = {
    Engineering: ['engineering', 'engr', 'mechanical', 'electrical', 'csce', 'computer science'],
    Business: ['business', 'mays', 'finance', 'accounting', 'marketing'],
    'Liberal Arts': ['liberal arts', 'history', 'english', 'philosophy', 'communication'],
    Agriculture: ['agriculture', 'ag', 'animal science', 'horticulture'],
    Science: ['science', 'biology', 'chemistry', 'physics', 'math'],
    Architecture: ['architecture', 'arch', 'urban planning', 'construction science'],
    Education: ['education', 'teaching', 'curriculum'],
    'Public Health': ['public health', 'health', 'epidemiology'],
    Law: ['law', 'legal', 'pre-law'],
    Medicine: ['medicine', 'medical', 'premed', 'nursing', 'clinical'],
  };
  return aliases[major].some((term) => blob.includes(term));
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatCalendarDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function shortDescription(text?: string | null) {
  if (!text) return null;
  const clean = stripHtml(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157).trim()}...`;
}

function handleGoogleCalendar(event: TAMUEvent) {
  const formatGCalDate = (ts: number) =>
    new Date(ts * 1000).toISOString().replace(/-|:|\.\d\d\d/g, '');

  const start = formatGCalDate(event.date_ts);
  const end = event.date2_ts
    ? formatGCalDate(event.date2_ts)
    : formatGCalDate(event.date_ts + 3600);
  const title = encodeURIComponent(event.title);
  const desc = encodeURIComponent(stripHtml(event.description || ''));
  const loc = encodeURIComponent(event.location || '');
  const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${desc}&location=${loc}`;
  Linking.openURL(url).catch((err) => console.error('Error opening Google Calendar', err));
}

function openNativeMaps(lat: number, lng: number, label?: string | null) {
  const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${query}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${query}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}

export function EventsCalendarScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const s = useMemo(() => getStyles(COLORS, isDark, embedded), [COLORS, isDark, embedded]);

  const { advanceStep, activeTargetName } = useTour();

  const [events, setEvents] = useState<TAMUEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<EventsView>('discover');

  const [selectedCategories, setSelectedCategories] = useState<Set<ExploreCategory>>(new Set());
  const [socialMode, setSocialMode] = useState<SocialMode>('casual');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailEvent, setDetailEvent] = useState<TAMUEvent | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const {
    isMajorSpecific,
    selectedMajor,
    setMajorSpecific,
    setSelectedMajor,
    scheduledEvents,
    scheduleEvent,
    savedEventIds,
    saveEvent,
    unsaveEvent,
    dislikedEventIds,
    dislikeEvent,
    removeIdsFromDisliked,
    clearDisliked,
    receivedInvites,
    acceptInvite,
    rejectInvite,
  } = useEventStore();

  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const nowTs = Math.floor(Date.now() / 1000);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await fetch(TAMU_EVENTS_API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as { events?: CampusEventResponse[] } | CampusEventResponse[];
        const raw = Array.isArray(payload) ? payload : payload.events || [];
        const parsed: TAMUEvent[] = raw
          .filter((event) => event && event.event_id && event.title && event.start_time)
          .map((event) => {
            const startTs = Math.floor(new Date(event.start_time).getTime() / 1000);
            const endTs = event.end_time ? Math.floor(new Date(event.end_time).getTime() / 1000) : null;
            return {
              id: event.event_id,
              title: stripHtml(event.title),
              date_ts: Number.isFinite(startTs) ? startTs : 0,
              date_iso: event.start_time,
              date2_ts: Number.isFinite(endTs as number) ? endTs : null,
              location: event.location ? stripHtml(event.location) : null,
              location_title: event.location ? stripHtml(event.location) : null,
              description: event.description || event.summary || null,
              url: event.link || event.source_url || '',
              tags: event.tags || null,
              event_types: event.has_food ? ['Free Food'] : null,
              group_title: event.host_name || event.source_name || '',
              location_lat: event.location_lat ?? null,
              location_lng: event.location_lng ?? null,
              has_food: !!event.has_food,
              food_confidence: event.food_confidence ?? 0,
              food_type: event.food_type ?? null,
              categories: event.categories || undefined,
              imageUrl: resolveEventImageUrl(event.image_url ?? null),
              is_admin_event: !!event.is_admin_event,
            };
          })
          .map((event) => {
            const searchBlob = getSearchBlob(event);
            return {
              ...event,
              _searchBlob: searchBlob,
              _category: classifyCategory(event),
              _socialMode: getSocialMode({ ...event, _searchBlob: searchBlob }),
            };
          })
          .sort((a, b) => a.date_ts - b.date_ts);
        setEvents(parsed);
      } catch (error) {
        console.error('[Events] Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<ExploreCategory, number> = {
      Featured: 0,
      Sports: 0,
      Academic: 0,
      Food: 0,
      Social: 0,
      'Health & Wellness': 0,
      Entertainment: 0,
      Advocacy: 0,
      Miscellaneous: 0,
    };

    events.forEach((event) => {
      const isOngoing = (event.date2_ts != null && event.date2_ts > nowTs) || (event.date_ts >= nowTs - 7200);
      if (!isOngoing) return;
      if (isMajorSpecific && !matchesMajor(event, selectedMajor)) return;
      const category = event._category || classifyCategory(event);
      counts[category] += 1;
    });

    return counts;
  }, [events, isMajorSpecific, nowTs, selectedMajor]);

  const filteredUpcomingEvents = useMemo(() => {
    let next = events.filter((event) => {
      return (event.date2_ts != null && event.date2_ts > nowTs) || (event.date_ts >= nowTs - 7200);
    });

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      next = next.filter((event) => (event._searchBlob || getSearchBlob(event)).includes(q));
    }

    if (isMajorSpecific) {
      next = next.filter((event) => matchesMajor(event, selectedMajor));
    }

    if (selectedCategories.size > 0) {
      next = next.filter((event) => selectedCategories.has(event._category || classifyCategory(event)));
    }

    if (selectedCategories.has('Social')) {
      next = next.filter((event) => {
        const category = event._category || classifyCategory(event);
        return category !== 'Social' || (event._socialMode || getSocialMode(event)) === socialMode;
      });
    }

    next = next.filter((event) => !dislikedEventIds.includes(String(event.id)));
    return next;
  }, [
    dislikedEventIds,
    events,
    isMajorSpecific,
    nowTs,
    deferredSearchQuery,
    selectedCategories,
    selectedMajor,
    socialMode,
  ]);

  const discoverEvents = useMemo(() => filteredUpcomingEvents.slice(0, 8), [filteredUpcomingEvents]);
  const collapsedCategories = useMemo(() => ALL_CATEGORIES.slice(0, 5), []);

  const swipeDeck = useMemo(() => {
    if (selectedCategories.size === 0) return filteredUpcomingEvents;
    return filteredUpcomingEvents.filter((event) => selectedCategories.has(event._category || classifyCategory(event)));
  }, [filteredUpcomingEvents, selectedCategories]);

  const activeSwipeEvent = swipeDeck[swipeIndex] ?? null;

  useEffect(() => {
    setSwipeIndex(0);
  }, [selectedCategories, socialMode, deferredSearchQuery, isMajorSpecific, selectedMajor]);

  const changeView = useCallback((nextView: EventsView) => {
    startTransition(() => {
      setView(nextView);
    });
  }, []);

  const toggleCategory = useCallback((category: ExploreCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleSchedule = useCallback(
    async (event: TAMUEvent) => {
      const scheduled: ScheduledEvent = {
        id: String(event.id),
        title: event.title,
        location: event.location,
        description: event.description,
        date_ts: event.date_ts,
        date_iso: event.date_iso,
        endDate_ts: event.date2_ts,
        location_lat: event.location_lat,
        location_lng: event.location_lng,
        category: classifyCategory(event),
        categories: event.categories,
      };
      scheduleEvent(scheduled);

      // Notification logic
      const prefs = useAppShellStore.getState();
      const leadTime = prefs.notificationLeadTime;
      if (prefs.eventNotifications) {
        scheduleEventNotification(
          event.title,
          `Starting at ${event.location || 'TAMU'} in ${leadTime} minutes.`,
          new Date(event.date_ts * 1000),
          leadTime
        );
      }

      if (user?.id) {
        try {
          await fetch(`${API_URL}/campus/events/rsvp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clerk_id: user.id,
              event_id: String(event.id),
              response: 'going',
            }),
          });
          
          // Onboarding: The tour now requires the user to manually navigate to the Places tab
          if (activeTargetName === 'event-rsvp') {
            // Optimistic update for local store so it shows up in TodayTimeline instantly
            scheduleEvent(event as any);
            advanceStep('event-rsvp');
          }
        } catch (error) {
          console.error('[Events] RSVP error:', error);
        }
      }
    },
    [scheduleEvent, user, activeTargetName, advanceStep, navigation],
  );

  const handleShare = useCallback((event: TAMUEvent) => {
    useShareStore.getState().openShare({
      title: event.title,
      message: `Check out this event: ${event.title} at ${event.location || 'TAMU'}!`,
      url: event.url || 'https://maroonschedules.tamu.edu',
    });

    if (event.is_admin_event) {
      fetch(`${API_URL}/admin/events/${event.id}/share`, { method: 'POST' }).catch(e => console.error(e));
    }
  }, []);

  const handleMapOpen = useCallback(
    (event: TAMUEvent) => {
      if (event.location_lat != null && event.location_lng != null) {
        navigation.navigate('Main', {
          screen: 'Places',
          params: {
            initialLayer: 'Academic',
            focusToken: `event:${event.id}:${event.date_ts}`,
            eventFocus: {
              eventId: String(event.id),
              title: event.title,
              location: event.location || null,
              latitude: event.location_lat,
              longitude: event.location_lng,
              startTime: event.date_iso,
              link: event.url || null,
              hasFood: !!event.has_food,
            },
          },
        });
      }
    },
    [navigation],
  );

  const handleSaveToggle = useCallback(
    (event: TAMUEvent) => {
      const id = String(event.id);
      if (savedEventIds.includes(id)) unsaveEvent(id);
      else saveEvent(id);
    },
    [savedEventIds, saveEvent, unsaveEvent],
  );

  const handleSwipeAdvance = useCallback(() => {
    pan.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
    setSwipeIndex((prev) => prev + 1);
  }, [opacity, pan]);

  const handleSwipeLeft = useCallback(
    (event: TAMUEvent) => {
      dislikeEvent(String(event.id));
      handleSwipeAdvance();
    },
    [dislikeEvent, handleSwipeAdvance],
  );

  const handleSwipeRight = useCallback(
    (event: TAMUEvent) => {
      handleSchedule(event);
      handleSwipeAdvance();
    },
    [handleSchedule, handleSwipeAdvance],
  );

  const handleRestoreCategory = useCallback(
    (category?: ExploreCategory) => {
      if (!category) {
        clearDisliked();
        setSettingsVisible(false);
        return;
      }

      const idsToRestore = dislikedEventIds.filter((id) => {
        const event = events.find((candidate) => String(candidate.id) === id);
        return event && classifyCategory(event) === category;
      });
      if (idsToRestore.length > 0) {
        removeIdsFromDisliked(idsToRestore);
      }
      setSettingsVisible(false);
    },
    [clearDisliked, dislikedEventIds, events, removeIdsFromDisliked],
  );

  const renderHeader = (title: string) => (

      <View style={s.headerBlock}>
        <View style={s.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>{title}</Text>

        </View>
        <Pressable style={s.headerIconButton} onPress={() => setView('inbox')}>
          <Inbox size={18} color={COLORS.textPrimary} />
          {receivedInvites.length > 0 ? (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{receivedInvites.length}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable style={s.headerIconButton} onPress={() => setSettingsVisible(true)}>
          <Settings size={18} color={COLORS.textPrimary} />
        </Pressable>
      </View>

      <View style={s.modeTabs}>
        {([
          { id: 'discover', label: 'Discover' },
          { id: 'list', label: 'List' },
          { id: 'swipe', label: 'Swipe' },
        ] as const).map((tab) => {
          const active = view === tab.id;
          const tabItem = (
            <Pressable
              key={tab.id}
              style={[s.modeTab, active && s.modeTabActive]}
              onPress={() => {
                changeView(tab.id);
                if (tab.id === 'list' && activeTargetName === 'switch-to-list') {
                  advanceStep('switch-to-list');
                }
              }}
            >
              <Text style={[s.modeTabText, active && s.modeTabTextActive]}>{tab.label}</Text>
              {active ? <View style={s.modeTabUnderline} /> : null}
            </Pressable>
          );

          if (tab.id === 'list') {
            return (
              <TourTarget key={tab.id} name="switch-to-list">
                {tabItem}
              </TourTarget>
            );
          }
          return tabItem;
        })}
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      {view === 'discover' && (
        <>
          {renderHeader('Events')}


          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Loading campus events...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={s.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={s.categoryWrap}>
                {categoriesExpanded ? (
                  <>
                    <View style={s.categoryHeaderRow}>
                      <Text style={s.categorySectionLabel}>Filters</Text>
                      <Pressable onPress={() => setCategoriesExpanded(false)}>
                        <Text style={s.categoryToggleText}>Less</Text>
                      </Pressable>
                    </View>
                    <View style={s.categoryExpandedGrid}>
                      {ALL_CATEGORIES.map((category) => (
                        <CategoryChip
                          key={category}
                          category={category}
                          count={categoryCounts[category] || 0}
                          active={selectedCategories.has(category)}
                          onPress={() => toggleCategory(category)}
                        />
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={s.categoryHeaderRow}>
                      <Text style={s.categorySectionLabel}>Filters</Text>
                      <Pressable onPress={() => setCategoriesExpanded(true)}>
                        <Text style={s.categoryToggleText}>More</Text>
                      </Pressable>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.categoryCollapsedRow}
                    >
                      {collapsedCategories.map((category) => (
                        <CategoryChip
                          key={category}
                          category={category}
                          count={categoryCounts[category] || 0}
                          active={selectedCategories.has(category)}
                          onPress={() => toggleCategory(category)}
                        />
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>

              <View style={s.inlineControls}>
                <Pressable
                  style={s.inlineControl}
                  onPress={() => setMajorSpecific(!isMajorSpecific)}
                >
                  <Text
                    style={[
                      s.inlineControlTitle,
                      isMajorSpecific && s.inlineControlTitleActive,
                    ]}
                  >
                    Major specific
                  </Text>
                  <Text style={s.inlineControlValue}>
                    {isMajorSpecific ? selectedMajor : 'Off'}
                  </Text>
                </Pressable>

                {selectedCategories.has('Social') ? (
                  <View style={s.socialModeWrap}>
                    {(['casual', 'professional'] as SocialMode[]).map((mode) => (
                      <Pressable
                        key={mode}
                        style={[s.socialModePill, socialMode === mode && s.socialModePillActive]}
                        onPress={() => setSocialMode(mode)}
                      >
                        <Text
                          style={[
                            s.socialModeText,
                            socialMode === mode && s.socialModeTextActive,
                          ]}
                        >
                          {mode === 'casual' ? 'Casual' : 'Professional'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.heroRail}
                snapToInterval={SCREEN_WIDTH - 52}
                decelerationRate="fast"
              >
                {discoverEvents.map((event, i) => {
                  const card = (
                    <HeroEventCard
                      key={String(event.id)}
                      event={event}
                      onPress={() => setDetailEvent(event)}
                      onMap={() => handleMapOpen(event)}
                    />
                  );
                  return card;
                })}
              </ScrollView>

              <Pressable
                style={s.swipeCta}
                onPress={() => {
                  setSwipeIndex(0);
                  changeView('swipe');
                }}
              >
                <ArrowRight size={18} color={COLORS.textPrimary} />
                <Text style={s.swipeCtaText}>Swipe to explore</Text>
              </Pressable>
            </ScrollView>
          )}
        </>
      )}

      {view === 'list' && (
        <>
          {renderHeader('Events')}

          <View style={s.listSearchRow}>
            <View style={s.searchShell}>
              <Search size={18} color={COLORS.textTertiary} />
              <TextInput
                style={s.searchInput}
                placeholder="Search campus events..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>
            <Pressable style={s.filterButton} onPress={() => setSettingsVisible(true)}>
              <Filter size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={[s.categoryWrap, { marginBottom: 16, marginTop: 4 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.categoryCollapsedRow}
            >
              {ALL_CATEGORIES.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  count={categoryCounts[category] || 0}
                  active={selectedCategories.has(category)}
                  onPress={() => toggleCategory(category)}
                />
              ))}
            </ScrollView>
          </View>


          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Loading campus events...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUpcomingEvents}
              keyExtractor={(event) => String(event.id)}
              contentContainerStyle={s.listScroll}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item, index }) => {
                const row = (
                  <ListEventRow
                    event={item}
                    saved={savedEventIds.includes(String(item.id))}
                    scheduled={scheduledEvents.some((scheduled) => String(scheduled.id) === String(item.id))}
                    onPress={() => {
                      if (index === 0 && activeTargetName === 'first-event-card') {
                        advanceStep('first-event-card');
                      }
                      setDetailEvent(item);
                    }}
                    onDelete={() => dislikeEvent(String(item.id))}
                    onShare={() => handleShare(item)}
                    onSchedule={() => handleSchedule(item)}

                  />
                );
                return index === 0 ? (
                  <TourTarget key={String(item.id)} name="first-event-card" style={{ width: '100%' }}>
                    {row}
                  </TourTarget>
                ) : row;
              }}
              ListEmptyComponent={
                <View style={s.emptyState}>
                  <Text style={s.emptyTitle}>Nothing matches right now</Text>
                  <Text style={s.emptySubtitle}>
                    Try another category, turn off major-specific filtering, or clear hidden events.
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {view === 'swipe' && (
        <>
          <View style={s.swipeHeader}>
            <Pressable style={s.headerIconButton} onPress={() => changeView('discover')}>
              <ChevronLeft size={18} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={s.swipeProgress}>
              {activeSwipeEvent ? `${Math.min(swipeIndex + 1, swipeDeck.length)} of ${swipeDeck.length}` : 'Done'}
            </Text>
            <View style={s.swipeHeaderSpacer} />
          </View>

          {selectedCategories.has('Social') ? (
            <View style={s.swipeSocialModeWrap}>
              {(['casual', 'professional'] as SocialMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  style={[s.socialModePill, socialMode === mode && s.socialModePillActive]}
                  onPress={() => setSocialMode(mode)}
                >
                  <Text
                    style={[s.socialModeText, socialMode === mode && s.socialModeTextActive]}
                  >
                    {mode === 'casual' ? 'Casual' : 'Professional'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {activeSwipeEvent ? (
            <SwipeEventCard
              event={activeSwipeEvent}
              pan={pan}
              opacity={opacity}
              onSwipeLeft={() => handleSwipeLeft(activeSwipeEvent)}
              onSwipeRight={() => handleSwipeRight(activeSwipeEvent)}
              onOpen={() => setDetailEvent(activeSwipeEvent)}
            />
          ) : (
            <View style={s.finishedWrap}>
              <Text style={s.finishedTitle}>All caught up</Text>
              <Text style={s.finishedSubtitle}>
                You have worked through every event in this deck.
              </Text>
              <Pressable
                style={s.finishedButton}
                onPress={() => {
                  setSwipeIndex(0);
                  changeView('discover');
                }}
              >
                <Text style={s.finishedButtonText}>Back to discover</Text>
              </Pressable>
            </View>
          )}

          {activeSwipeEvent ? (
            <View style={s.swipeActions}>
              <ActionButton color="#FF4D6D" onPress={() => handleSwipeLeft(activeSwipeEvent)}>
                <XIcon size={28} color="#FFFFFF" />
              </ActionButton>
              <ActionButton
                color="#2F80ED"
                onPress={() => {
                  handleSchedule(activeSwipeEvent);
                  handleGoogleCalendar(activeSwipeEvent);
                }}
              >
                <CalendarIcon size={24} color="#FFFFFF" />
              </ActionButton>
              <ActionButton color="#3CCB6C" onPress={() => handleSwipeRight(activeSwipeEvent)}>
                <Check size={28} color="#FFFFFF" />
              </ActionButton>
              <ActionButton color="#FF9F0A" onPress={() => handleShare(activeSwipeEvent)}>
                <Share2 size={24} color="#FFFFFF" />
              </ActionButton>
            </View>
          ) : null}
        </>
      )}

      {view === 'inbox' && (
        <>
          <View style={s.swipeHeader}>
            <Pressable style={s.headerIconButton} onPress={() => changeView('discover')}>
              <ChevronLeft size={18} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={s.swipeProgress}>Event inbox</Text>
            <View style={s.swipeHeaderSpacer} />
          </View>

          <ScrollView contentContainerStyle={s.inboxScroll} showsVerticalScrollIndicator={false}>
            {receivedInvites.length === 0 ? (
              <View style={s.emptyState}>
                <Inbox size={42} color={COLORS.textTertiary} />
                <Text style={s.emptyTitle}>No invites yet</Text>
                <Text style={s.emptySubtitle}>
                  When friends send you events, they will land here.
                </Text>
              </View>
            ) : (
              receivedInvites.map((invite) => (
                <View key={invite.id} style={s.inviteCard}>
                  <Text style={s.inviteEyebrow}>From {invite.senderName}</Text>
                  <Text style={s.inviteTitle}>{invite.title}</Text>
                  <Text style={s.inviteMeta}>
                    {formatDate(invite.date_ts)} · {formatTime(invite.date_ts)}
                  </Text>
                  {invite.location ? (
                    <View style={s.inviteLocationRow}>
                      <MapPin size={14} color={COLORS.textSecondary} />
                      <Text style={s.inviteLocation}>{invite.location}</Text>
                    </View>
                  ) : null}
                  <View style={s.inviteActions}>
                    <ActionButton color="#3CCB6C" small onPress={() => acceptInvite(invite.id)}>
                      <Check size={20} color="#FFFFFF" />
                    </ActionButton>
                    <ActionButton color="#FF4D6D" small onPress={() => rejectInvite(invite.id)}>
                      <XIcon size={20} color="#FFFFFF" />
                    </ActionButton>
                    {invite.location_lat != null && invite.location_lng != null ? (
                      <ActionButton
                        color="#2F80ED"
                        small
                        onPress={() =>
                          navigation.navigate('Main', {
                            screen: 'Places',
                            params: {
                              initialLayer: 'Academic',
                              eventFocus: {
                                eventId: invite.eventId,
                                title: invite.title,
                                location: invite.location || null,
                                latitude: invite.location_lat,
                                longitude: invite.location_lng,
                                startTime: invite.date_iso,
                                link: null,
                                hasFood: false,
                              },
                            },
                          })
                        }
                      >
                        <Map size={18} color="#FFFFFF" />
                      </ActionButton>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        isMajorSpecific={isMajorSpecific}
        selectedMajor={selectedMajor}
        setMajorSpecific={setMajorSpecific}
        setSelectedMajor={setSelectedMajor}
        socialMode={socialMode}
        setSocialMode={setSocialMode}
        selectedCategories={selectedCategories}
        dislikedEventIds={dislikedEventIds}
        events={events}
        onRestoreCategory={handleRestoreCategory}
      />

        <DetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onSaveToggle={handleSaveToggle}
          onSchedule={handleSchedule}
          onShare={handleShare}
          onMap={handleMapOpen}
          saved={detailEvent ? savedEventIds.includes(String(detailEvent.id)) : false}
          scheduled={detailEvent ? scheduledEvents.some((scheduled) => String(scheduled.id) === String(detailEvent.id)) : false}
        />
    </View>
  );
}

function CategoryChip({
  category,
  count,
  active,
  onPress,
}: {
  category: ExploreCategory;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { accent, chipBg, chipText, icon: Icon } = CATEGORY_META[category];
  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.categoryChip,
        { backgroundColor: active ? accent : chipBg, opacity: count ? 1 : 0.48 },
      ]}
    >
      <Icon size={17} color={active ? '#FFFFFF' : chipText} />
      <Text style={[stylesStatic.categoryChipText, { color: active ? '#FFFFFF' : chipText }]}>
        {category}
      </Text>
      <Text
        style={[
          stylesStatic.categoryChipCount,
          { color: active ? 'rgba(255,255,255,0.82)' : `${chipText}CC` },
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function HeroEventCard({
  event,
  onPress,
  onMap,
}: {
  event: TAMUEvent;
  onPress: () => void;
  onMap: () => void;
}) {
  const { COLORS } = useTheme();
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <Pressable
      onPress={onPress}
      style={[stylesStatic.heroCard, { backgroundColor: meta.cardTint }]}
    >
      {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={stylesStatic.heroImage} resizeMode="cover" /> : null}
      {event.imageUrl ? <View style={stylesStatic.heroImageOverlay} /> : null}
      <View style={[stylesStatic.heroGlow, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
      <View style={[stylesStatic.heroGlowSmall, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <View style={[stylesStatic.heroIconHalo, event.imageUrl ? stylesStatic.heroIconHaloWithImage : null]}>
        <Icon size={88} color="rgba(255,255,255,0.12)" />
      </View>

      <View style={stylesStatic.heroTopRow}>
        <View style={stylesStatic.heroCategoryPill}>
          <Text style={stylesStatic.heroCategoryText}>{category}</Text>
        </View>
        {event.group_title ? (
          <View style={stylesStatic.verifiedPill}>
            <BadgeCheck size={14} color="#FFFFFF" />
            <Text style={stylesStatic.verifiedText}>Verified</Text>
          </View>
        ) : null}
      </View>

      <View style={stylesStatic.heroBottom}>
        <Text style={stylesStatic.heroTitle}>{event.title}</Text>
        <View style={stylesStatic.heroMetaRow}>
          <CalendarIcon size={17} color="#FFFFFF" />
          <Text style={stylesStatic.heroMetaText}>
            {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
          </Text>
        </View>
        <View style={stylesStatic.heroMetaRow}>
          <MapPin size={17} color="#FFFFFF" />
          <Text style={stylesStatic.heroMetaText}>{event.location || 'Campus'}</Text>
        </View>
        {event.location_lat != null && event.location_lng != null ? (
          <Pressable style={stylesStatic.heroMapButton} onPress={onMap}>
            <Map size={15} color={COLORS.textPrimary} />
            <Text style={[stylesStatic.heroMapButtonText, { color: COLORS.textPrimary }]}>
              Open in Places
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function ListEventRow({
  event,
  saved,
  scheduled,
  onPress,
  onDelete,
  onShare,
  onSchedule,
}: {

  event: TAMUEvent;
  saved: boolean;
  scheduled: boolean;
  onPress: () => void;
  onDelete: () => void;
  onShare: () => void;
  onSchedule: () => void;

}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.listRow,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
      ]}
      >
      <View style={[stylesStatic.listThumb, { backgroundColor: meta.cardTint }]}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={stylesStatic.listThumbImage} resizeMode="cover" />
        ) : (
          <View style={stylesStatic.listThumbFallback}>
            <Icon size={28} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={stylesStatic.listContent}>
        <View style={stylesStatic.listTitleRow}>
          <Text style={[stylesStatic.listTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
            {event.title}
          </Text>
          {event.group_title ? <BadgeCheck size={16} color="#2F80ED" /> : null}
        </View>
        <Text style={[stylesStatic.listMeta, { color: COLORS.textSecondary }]}>
          {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
        </Text>
        <Text style={[stylesStatic.listMeta, { color: COLORS.textTertiary }]} numberOfLines={1}>
          {event.location || 'Campus'}
        </Text>
      </View>
      <View style={stylesStatic.listActions}>
        <Pressable onPress={onDelete} style={stylesStatic.listActionButton}>
          <Trash2 size={20} color={COLORS.textSecondary} />
        </Pressable>

        <Pressable onPress={onShare} style={stylesStatic.listActionButton}>
          <Share2 size={20} color={COLORS.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onSchedule}
          style={[
            stylesStatic.listActionButton,
            {
              backgroundColor: scheduled
                ? '#3CCB6C'
                : isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(15,23,42,0.06)',
            },
          ]}
        >
          <Check size={20} color={scheduled ? '#FFFFFF' : '#3CCB6C'} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function SwipeEventCard({
  event,
  pan,
  opacity,
  onSwipeLeft,
  onSwipeRight,
  onOpen,
}: {
  event: TAMUEvent;
  pan: Animated.ValueXY;
  opacity: Animated.Value;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onOpen: () => void;
}) {
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue: SCREEN_WIDTH + 80,
              duration: 220,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 220,
              useNativeDriver: false,
            }),
          ]).start(onSwipeRight);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue: -(SCREEN_WIDTH + 80),
              duration: 220,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 220,
              useNativeDriver: false,
            }),
          ]).start(onSwipeLeft);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <View style={stylesStatic.swipeWrap}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          stylesStatic.swipeCard,
          {
            backgroundColor: meta.cardTint,
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
            opacity,
          },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onOpen}>
          {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={stylesStatic.swipeImage} resizeMode="cover" /> : null}
          {event.imageUrl ? <View style={stylesStatic.swipeImageOverlay} /> : null}
          <View style={stylesStatic.swipeGlow} />
          <View style={[stylesStatic.swipeWatermark, event.imageUrl ? stylesStatic.swipeWatermarkWithImage : null]}>
            <Icon size={108} color="rgba(255,255,255,0.13)" />
          </View>
          <View style={stylesStatic.swipeTopLabel}>
            <Text style={stylesStatic.swipeTopLabelText}>{category}</Text>
          </View>
          <View style={stylesStatic.swipeBody}>
            <Text style={stylesStatic.swipeTitle}>{event.title}</Text>
            <Text style={stylesStatic.swipeMeta}>
              {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
            </Text>
            <Text style={stylesStatic.swipeMeta}>{event.location || 'Campus'}</Text>
            {shortDescription(event.description) ? (
              <Text style={stylesStatic.swipeDescription}>{shortDescription(event.description)}</Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ActionButton({
  color,
  onPress,
  children,
  small = false,
}: {
  color: string;
  onPress: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.actionButton,
        small ? stylesStatic.actionButtonSmall : null,
        { backgroundColor: color },
      ]}
    >
      {children}
    </Pressable>
  );
}

function SettingsModal({
  visible,
  onClose,
  isMajorSpecific,
  selectedMajor,
  setMajorSpecific,
  setSelectedMajor,
  socialMode,
  setSocialMode,
  selectedCategories,
  dislikedEventIds,
  events,
  onRestoreCategory,
}: {
  visible: boolean;
  onClose: () => void;
  isMajorSpecific: boolean;
  selectedMajor: MajorOption;
  setMajorSpecific: (val: boolean) => void;
  setSelectedMajor: (major: MajorOption) => void;
  socialMode: SocialMode;
  setSocialMode: (mode: SocialMode) => void;
  selectedCategories: Set<ExploreCategory>;
  dislikedEventIds: string[];
  events: TAMUEvent[];
  onRestoreCategory: (category?: ExploreCategory) => void;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={stylesStatic.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            stylesStatic.modalSheet,
            { backgroundColor: COLORS.surface, borderColor: COLORS.border },
          ]}
          onPress={() => {}}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[stylesStatic.modalTitle, { color: COLORS.textPrimary }]}>Filters</Text>

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Major
            </Text>
            <Pressable
              style={[
                stylesStatic.modalToggleRow,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' },
              ]}
              onPress={() => setMajorSpecific(!isMajorSpecific)}
            >
              <Text style={[stylesStatic.modalOptionText, { color: COLORS.textPrimary }]}>
                Major specific
              </Text>
              <Text style={[stylesStatic.modalMetaText, { color: COLORS.primary }]}>
                {isMajorSpecific ? 'On' : 'Off'}
              </Text>
            </Pressable>
            {MAJOR_OPTIONS.map((major) => (
              <Pressable
                key={major}
                style={stylesStatic.modalOption}
                onPress={() => setSelectedMajor(major)}
              >
                <Text
                  style={[
                    stylesStatic.modalOptionText,
                    { color: selectedMajor === major ? COLORS.primary : COLORS.textPrimary },
                  ]}
                >
                  {major}
                </Text>
                {selectedMajor === major ? <Check size={16} color={COLORS.primary} /> : null}
              </Pressable>
            ))}

            {selectedCategories.has('Social') ? (
              <>
                <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
                  Social mode
                </Text>
                {(['casual', 'professional'] as SocialMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    style={stylesStatic.modalOption}
                    onPress={() => setSocialMode(mode)}
                  >
                    <Text
                      style={[
                        stylesStatic.modalOptionText,
                        { color: socialMode === mode ? COLORS.primary : COLORS.textPrimary },
                      ]}
                    >
                      {mode === 'casual' ? 'Casual' : 'Professional'}
                    </Text>
                    {socialMode === mode ? <Check size={16} color={COLORS.primary} /> : null}
                  </Pressable>
                ))}
              </>
            ) : null}

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Hidden events
            </Text>
            <Pressable style={stylesStatic.modalOption} onPress={() => onRestoreCategory()}>
              <Text style={[stylesStatic.modalOptionText, { color: '#FF4D6D' }]}>
                Restore all hidden events
              </Text>
            </Pressable>
            {ALL_CATEGORIES.map((category) => {
              const count = dislikedEventIds.filter((id) => {
                const event = events.find((candidate) => String(candidate.id) === id);
                return event && classifyCategory(event) === category;
              }).length;
              if (!count) return null;
              return (
                <Pressable
                  key={category}
                  style={stylesStatic.modalOption}
                  onPress={() => onRestoreCategory(category)}
                >
                  <Text style={[stylesStatic.modalOptionText, { color: COLORS.textPrimary }]}>
                    Restore {category}
                  </Text>
                  <Text style={[stylesStatic.modalMetaText, { color: COLORS.textSecondary }]}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailModal({
  event,
  onClose,
  onSaveToggle,
  onSchedule,
  onShare,
  onMap,
  saved,
  scheduled,
}: {
  event: TAMUEvent | null;
  onClose: () => void;
  onSaveToggle: (event: TAMUEvent) => void;
  onSchedule: (event: TAMUEvent) => void;
  onShare: (event: TAMUEvent) => void;
  onMap: (event: TAMUEvent) => void;
  saved: boolean;
  scheduled: boolean;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const tour = useTour();
  const navigation = useNavigation<any>();

  if (!event) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100, justifyContent: 'flex-end' }]} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onClose} />
      <View
        style={[
          stylesStatic.detailSheet,
          { backgroundColor: COLORS.surface, borderColor: COLORS.border, maxHeight: '85%' },
        ]}
      >
          <ScrollView showsVerticalScrollIndicator={false}>
            {event.imageUrl ? (
              <View style={stylesStatic.detailImageWrap}>
                <Image source={{ uri: event.imageUrl }} style={stylesStatic.detailImage} resizeMode="cover" />
              </View>
            ) : null}
            <View style={stylesStatic.detailHeader}>
              <View
                style={[
                  stylesStatic.detailCategoryPill,
                  { backgroundColor: CATEGORY_META[classifyCategory(event)].chipBg },
                ]}
              >
                <Text
                  style={[
                    stylesStatic.detailCategoryText,
                    { color: CATEGORY_META[classifyCategory(event)].chipText },
                  ]}
                >
                  {classifyCategory(event)}
                </Text>
              </View>
              <Pressable onPress={() => onSaveToggle(event)} style={stylesStatic.detailSaveButton}>
                <Heart size={18} color={saved ? '#FF4D6D' : COLORS.textSecondary} fill={saved ? '#FF4D6D' : 'none'} />
              </Pressable>
            </View>

            <Text style={[stylesStatic.detailTitle, { color: COLORS.textPrimary }]}>{event.title}</Text>

            <View style={stylesStatic.detailMetaBlock}>
              <View style={stylesStatic.detailMetaRow}>
                <CalendarIcon size={15} color={COLORS.textSecondary} />
                <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                  {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
                </Text>
              </View>
              <View style={stylesStatic.detailMetaRow}>
                <MapPin size={15} color={COLORS.textSecondary} />
                <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                  {event.location || 'Campus'}
                </Text>
              </View>
              {event.group_title ? (
                <View style={stylesStatic.detailMetaRow}>
                  <BadgeCheck size={15} color="#2F80ED" />
                  <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                    {event.group_title}
                  </Text>
                </View>
              ) : null}
            </View>

            {event.description ? (
              <Text style={[stylesStatic.detailDescription, { color: COLORS.textSecondary }]}>
                {stripHtml(event.description)}
              </Text>
            ) : null}

            <TourTarget name="event-rsvp">
              <Pressable
                style={[stylesStatic.primaryDetailButton, { backgroundColor: '#3CCB6C' }]}
                onPress={() => {
                  onSchedule(event);
                  onClose();
                }}
              >
                <Check size={18} color="#FFFFFF" strokeWidth={3} />
                <Text style={stylesStatic.primaryDetailButtonText}>
                  {event.is_admin_event
                    ? (scheduled ? 'RSVP Saved' : 'RSVP to Featured Event')
                    : 'Add to current schedule'}
                </Text>
              </Pressable>
            </TourTarget>

            <View style={stylesStatic.detailActionRow}>
              <Pressable
                style={[
                  stylesStatic.secondaryDetailButton,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                  },
                ]}
                onPress={() => onShare(event)}
              >
                <Share2 size={18} color={COLORS.textPrimary} />
                <Text style={[stylesStatic.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                  Share
                </Text>
              </Pressable>
              {event.location_lat != null && event.location_lng != null ? (
                <Pressable
                  style={[
                    stylesStatic.secondaryDetailButton,
                    {
                      borderColor: COLORS.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                    },
                  ]}
                  onPress={() => onMap(event)}
                >
                  <Map size={18} color={COLORS.textPrimary} />
                  <Text style={[stylesStatic.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                    Places
                  </Text>
                </Pressable>
              ) : event.location_lat != null && event.location_lng != null ? null : (
                <Pressable
                  style={[
                    stylesStatic.secondaryDetailButton,
                    {
                      borderColor: COLORS.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                    },
                  ]}
                  onPress={() => {
                    if (event.location_lat != null && event.location_lng != null) {
                      openNativeMaps(event.location_lat, event.location_lng, event.location || event.title);
                    }
                  }}
                >
                  <MapPin size={18} color={COLORS.textPrimary} />
                  <Text style={[stylesStatic.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                    Map
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
    </Animated.View>
  );
}

const getStyles = (COLORS: any, isDark: boolean, embedded: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    headerBlock: {
      paddingTop: embedded ? 10 : 56,
      paddingHorizontal: 20,
      paddingBottom: 8,
      gap: 10,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    pageTitle: {
      color: COLORS.textPrimary,
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: -1.05,
    },
    pageSubtitle: {
      marginTop: 2,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    headerIconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    headerBadge: {
      position: 'absolute',
      right: -2,
      top: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: '#FF4D6D',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
    },
    modeTabs: {
      flexDirection: 'row',
      gap: 18,
      paddingTop: 2,
    },
    modeTab: {
      paddingVertical: 4,
      position: 'relative',
    },
    modeTabActive: {
      backgroundColor: 'transparent',
    },
    modeTabText: {
      color: COLORS.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
    modeTabTextActive: {
      color: COLORS.textPrimary,
      fontWeight: '800',
    },
    modeTabUnderline: {
      marginTop: 6,
      height: 2.5,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 118,
    },
    categoryWrap: {
      gap: 12,
    },
    categoryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    categorySectionLabel: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    categoryToggleText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    categoryCollapsedRow: {
      gap: 8,
      paddingRight: 8,
    },
    categoryExpandedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    inlineControls: {
      marginTop: 14,
      gap: 10,
    },
    inlineControl: {
      borderRadius: 16,
      paddingHorizontal: 0,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: 'transparent',
    },
    inlineControlActive: {
      borderBottomColor: COLORS.primary,
    },
    inlineControlTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
    inlineControlTitleActive: {
      color: COLORS.primary,
    },
    inlineControlValue: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    socialModeWrap: {
      flexDirection: 'row',
      gap: 8,
    },
    socialModePill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)',
    },
    socialModePillActive: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    socialModeText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    socialModeTextActive: {
      color: COLORS.textPrimary,
    },
    heroRail: {
      paddingTop: 18,
      paddingRight: 20,
      gap: 14,
    },
    swipeCta: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
      alignSelf: 'center',
    },
    swipeCtaText: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    listSearchRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    searchShell: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    searchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    filterButton: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: 'transparent',
    },
    listScroll: {
      paddingHorizontal: 18,
      paddingBottom: 126,
      gap: 0,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: COLORS.textSecondary,
      fontSize: 15,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 64,
      gap: 10,
    },
    emptyTitle: {
      color: COLORS.textPrimary,
      fontSize: 22,
      fontWeight: '900',
    },
    emptySubtitle: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    swipeHeader: {
      paddingTop: embedded ? 10 : 52,
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    swipeProgress: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    swipeHeaderSpacer: {
      width: 42,
      height: 42,
    },
    swipeSocialModeWrap: {
      paddingHorizontal: 20,
      paddingBottom: 10,
      flexDirection: 'row',
      gap: 8,
    },
    swipeActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      paddingBottom: 30,
      paddingHorizontal: 20,
    },
    finishedWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 12,
    },
    finishedTitle: {
      color: COLORS.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
    finishedSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    finishedButton: {
      marginTop: 12,
      borderRadius: 18,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 22,
      paddingVertical: 14,
    },
    finishedButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    inboxScroll: {
      paddingHorizontal: 20,
      paddingBottom: 120,
      gap: 12,
    },
    inviteCard: {
      marginTop: 8,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    inviteEyebrow: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    inviteTitle: {
      color: COLORS.textPrimary,
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 4,
    },
    inviteMeta: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    inviteLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    inviteLocation: {
      color: COLORS.textSecondary,
      fontSize: 14,
      flex: 1,
    },
    inviteActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
  });

const stylesStatic = StyleSheet.create({
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  categoryChipCount: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
  heroCard: {
    width: SCREEN_WIDTH - 52,
    height: 372,
    borderRadius: 34,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'space-between',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,24,40,0.28)',
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.55,
  },
  heroGlowSmall: {
    position: 'absolute',
    bottom: 70,
    left: -35,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.4,
  },
  heroIconHalo: {
    position: 'absolute',
    right: 18,
    bottom: 118,
    opacity: 0.55,
  },
  heroIconHaloWithImage: {
    opacity: 0.28,
  },
  heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
  },
  heroCategoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroCategoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroBottom: {
    gap: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    maxWidth: '92%',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  heroMapButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroMapButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 0,
    borderWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  listThumb: {
    width: 104,
    height: 76,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listThumbImage: {
    width: '100%',
    height: '100%',
  },
  listThumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flex: 1,
    minWidth: 0,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  listTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  listMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  listActions: {
    justifyContent: 'center',
    gap: 8,
  },
  listActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  swipeCard: {
    width: SCREEN_WIDTH - 44,
    height: SCREEN_HEIGHT * 0.6,
    borderRadius: 34,
    overflow: 'hidden',
  },
  swipeImage: {
    ...StyleSheet.absoluteFillObject,
  },
  swipeImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,18,31,0.34)',
  },
  swipeGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.16)',
    opacity: 0.5,
  },
  swipeWatermark: {
    position: 'absolute',
    bottom: 140,
    left: 18,
    opacity: 0.5,
  },
  swipeWatermarkWithImage: {
    opacity: 0.22,
  },
  swipeTopLabel: {
    marginTop: 16,
    marginLeft: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  swipeTopLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  swipeBody: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  swipeTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.85,
  },
  swipeMeta: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  swipeDescription: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  actionButtonSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    maxHeight: '78%',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,128,0.25)',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalMetaText: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailSheet: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    maxHeight: '84%',
  },
  detailImageWrap: {
    height: 194,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailCategoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailCategoryText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  detailSaveButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  detailMetaBlock: {
    gap: 8,
    marginBottom: 18,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailMetaText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  detailDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryDetailButton: {
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryDetailButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryDetailButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryDetailButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
