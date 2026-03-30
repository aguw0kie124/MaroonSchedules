import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import { useTheme } from './SharedUI';
import { useEventStore } from '../store/eventStore';
import type { ScheduledEvent, MajorOption } from '../store/eventStore';
import { API_URL } from '../config';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Check,
  X as XIcon,
  MapPin,
  Bookmark,
  Send,
  Calendar as CalendarIcon,
  Inbox,
  Heart,
  ThumbsDown,
  Settings,
  Map,
  List,
  Search,
  MapPin as MapPinIcon,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const TAMU_EVENTS_API = `${API_URL}/campus/events?limit=1000`;

/* ───── Types ───── */
interface CampusEventResponse {
  event_id: string; title: string; summary?: string | null; description?: string | null;
  location?: string | null; location_lat?: number | null; location_lng?: number | null;
  start_time: string; end_time?: string | null; link?: string | null; source_url?: string | null;
  host_name?: string | null; source_name?: string | null; tags?: string[] | null;
  has_food?: boolean; food_confidence?: number; food_type?: string | null;
  categories?: Record<string, number>;
}

interface TAMUEvent {
  id: string | number; title: string; date_ts: number; date_iso: string;
  date?: string; date2_ts?: number | null; is_all_day?: number | null;
  location?: string | null; location_title?: string | null; description?: string | null;
  cost?: string | null; url?: string; tags?: string[] | null;
  event_types?: string[] | null; group_title?: string;
  location_lat?: number | null; location_lng?: number | null;
  has_food?: boolean; food_confidence?: number; food_type?: string | null;
  categories?: Record<string, number>;
}

type ExploreCategory = 'Food' | 'Sports' | 'Social' | 'Miscellaneous' | 'Advocacy' | 'Academic' | 'Entertainment' | 'Health & Wellness';
type SocialMode = 'casual' | 'professional';
type EventsView = 'grid' | 'flashcards' | 'inbox';

const ALL_CATEGORIES: ExploreCategory[] = ['Food', 'Sports', 'Social', 'Miscellaneous', 'Advocacy', 'Academic', 'Entertainment', 'Health & Wellness'];

export const CATEGORY_META: Record<string, { color: string }> = {
  Food: { color: '#FF9500' },
  Sports: { color: '#007AFF' },
  Social: { color: '#FF2D55' },
  Miscellaneous: { color: '#5856D6' },
  Advocacy: { color: '#34C759' },
  Academic: { color: '#5AC8FA' },
  Entertainment: { color: '#AF52DE' },
  'Health & Wellness': { color: '#FFCC00' },
};

const MAJOR_OPTIONS: MajorOption[] = [
  'Engineering','Business','Liberal Arts','Agriculture','Science','Architecture','Education','Public Health','Law','Medicine',
];

/* ───── Helpers ───── */
function stripHtml(html: string) {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

function getSearchBlob(event: TAMUEvent) {
  return [event.title, event.description, event.location, event.location_title, event.group_title,
    ...(event.tags || []), ...(event.event_types || [])].filter(Boolean).join(' ').toLowerCase();
}

function classifyCategory(event: TAMUEvent): ExploreCategory {
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

  const b = getSearchBlob(event);
  if (event.has_food || /\bfood\b|\bmeal\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bfree pizza\b|\brefreshments\b/.test(b)) return 'Food';
  if (/\bsport\b|\bgame\b|\bmatch\b|\btournament\b|\bfitness\b|\brec\b|\bathletic\b|\bworkout\b/.test(b)) return 'Sports';
  if (/\bconcert\b|\bshow\b|\bmovie\b|\bcomedy\b|\bmusic\b|\bperformance\b|\bfestival\b|\bkaraoke\b|\bgame night\b/.test(b)) return 'Entertainment';
  if (/\badvocacy\b|\bactivism\b|\bpolicy\b|\bawareness\b|\bcommunity service\b|\bvolunteer\b|\bjustice\b|\bsustainability\b/.test(b)) return 'Advocacy';
  if (/\blecture\b|\bseminar\b|\bstudy\b|\bresearch\b|\bacademic\b|\blab\b|\btutoring\b|\bscholar/i.test(b)) return 'Academic';
  if (/\byoga\b|\bmeditat\b|\bmental health\b|\bwellness\b|\bself.care\b|\bmindful\b|\btherapy\b|\bhealth fair/i.test(b)) return 'Health & Wellness';
  return 'Miscellaneous'; // Fallback
}

function handleGoogleCalendar(event: TAMUEvent) {
  const formatGCalDate = (ts: number) => {
    return new Date(ts * 1000).toISOString().replace(/-|:|\.\d\d\d/g, '');
  };

  const start = formatGCalDate(event.date_ts);
  const end = event.date2_ts ? formatGCalDate(event.date2_ts) : formatGCalDate(event.date_ts + 3600); // Default 1hr
  
  const title = encodeURIComponent(event.title);
  const desc = encodeURIComponent(stripHtml(event.description || ''));
  const loc = encodeURIComponent(event.location || '');
  
  const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${desc}&location=${loc}`;
  Linking.openURL(url).catch(err => console.error('Error opening Google Calendar', err));
}

function getSocialMode(event: TAMUEvent): SocialMode {
  const b = getSearchBlob(event);
  if (/\bcareer\b|\bnetworking\b|\bprofessional\b|\bresume\b|\binterview\b|\bcompany\b|\brecruit\b|\bworkshop\b|\bpanel\b/.test(b)) return 'professional';
  return 'casual';
}

function matchesMajor(event: TAMUEvent, major: MajorOption) {
  const b = getSearchBlob(event);
  const aliases: Record<MajorOption, string[]> = {
    Engineering: ['engineering','engr','mechanical','electrical','csce','computer science'],
    Business: ['business','mays','finance','accounting','marketing'],
    'Liberal Arts': ['liberal arts','history','english','philosophy','communication'],
    Agriculture: ['agriculture','ag','animal science','horticulture'],
    Science: ['science','biology','chemistry','physics','math'],
    Architecture: ['architecture','arch','urban planning','construction science'],
    Education: ['education','teaching','curriculum'],
    'Public Health': ['public health','health','epidemiology'],
    Law: ['law','legal','pre-law'],
    Medicine: ['medicine','medical','premed','nursing','clinical'],
  };
  return aliases[major].some((t) => b.includes(t));
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function openMaps(lat: number, lng: number, label?: string) {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url = Platform.OS === 'ios'
    ? `maps:0,0?q=${q}&ll=${lat},${lng}`
    : `geo:${lat},${lng}?q=${q}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export function EventsCalendarScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const navigation = useNavigation<any>();
  const { user } = useUser();

  const [events, setEvents] = useState<TAMUEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<EventsView>('grid');
  const [selectedCategories, setSelectedCategories] = useState<Set<ExploreCategory>>(new Set());
  const [socialMode, setSocialMode] = useState<SocialMode>('casual');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareEvent, setShareEvent] = useState<TAMUEvent | null>(null);
  const [friendsList, setFriendsList] = useState<Array<{ id: string; name: string; email: string; profile_image_url?: string }>>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isListView, setIsListView] = useState(false);
  const [detailEvent, setDetailEvent] = useState<TAMUEvent | null>(null);

  const {
    isMajorSpecific, selectedMajor, setMajorSpecific, setSelectedMajor,
    scheduledEvents, scheduleEvent, savedEventIds, saveEvent, unsaveEvent,
    dislikedEventIds, dislikeEvent, removeIdsFromDisliked, clearDisliked,
    receivedInvites, acceptInvite, rejectInvite,
  } = useEventStore();

  /* Animation state lifted for full-screen sync */
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const backgroundColor = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.7, 0, SCREEN_WIDTH * 0.7],
    outputRange: ['#800000', 'rgba(0,0,0,0)', '#2E7D32'],
    extrapolate: 'clamp',
  });

  /* Fetch events */
  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(TAMU_EVENTS_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as CampusEventResponse[];
      const parsed: TAMUEvent[] = raw
        .filter((e) => e && e.event_id && e.title && e.start_time)
        .map((e) => {
          const startTs = Math.floor(new Date(e.start_time).getTime() / 1000);
          const endTs = e.end_time ? Math.floor(new Date(e.end_time).getTime() / 1000) : null;
          return {
            id: e.event_id, title: stripHtml(e.title), date: e.start_time,
            date_ts: Number.isFinite(startTs) ? startTs : 0, date_iso: e.start_time,
            date2_ts: Number.isFinite(endTs as number) ? endTs : null, is_all_day: 0,
            location: e.location ? stripHtml(e.location) : null,
            location_title: e.location ? stripHtml(e.location) : null,
            description: e.description || e.summary || null, cost: null,
            url: e.link || e.source_url || '', tags: e.tags || null,
            event_types: e.has_food ? ['Free Food'] : null,
            group_title: e.host_name || e.source_name || '',
            location_lat: e.location_lat ?? null, location_lng: e.location_lng ?? null,
            has_food: !!e.has_food, food_confidence: e.food_confidence ?? 0,
            food_type: e.food_type ?? null,
            categories: e.categories || undefined,
          };
        })
        .sort((a, b) => a.date_ts - b.date_ts);
      setEvents(parsed);
    } catch (err) {
      console.error('[Events] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* Categorized event counts */
  const nowTs = useMemo(() => Math.floor(Date.now() / 1000), []);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_CATEGORIES.forEach((c) => { counts[c] = 0; });
    events.forEach((e) => {
      if (e.date_ts < nowTs) return;
      if (isMajorSpecific && !matchesMajor(e, selectedMajor)) return;
      const cat = classifyCategory(e);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [events, isMajorSpecific, selectedMajor, nowTs]);

  /* Filtered events base */
  const filteredEventsBase = useMemo(() => {
    let base = events.filter(e => e.date_ts >= nowTs);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(e => {
        const blob = getSearchBlob(e);
        return blob.includes(q);
      });
    }

    if (isMajorSpecific) {
      base = base.filter(e => matchesMajor(e, selectedMajor));
    }

    return base;
  }, [events, searchQuery, isMajorSpecific, selectedMajor, nowTs]);

  /* Flashcard stack */
  const flashcardStack = useMemo(() => {
    if (selectedCategories.size === 0) return [];
    return filteredEventsBase.filter((e) => {
      if (dislikedEventIds.includes(String(e.id))) return false;
      const cat = classifyCategory(e);
      if (!selectedCategories.has(cat)) return false;
      if (cat === 'Social' && getSocialMode(e) !== socialMode) return false;
      return true;
    });
  }, [filteredEventsBase, selectedCategories, dislikedEventIds, socialMode]);

  const toggleCategory = useCallback((cat: ExploreCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const openFlashcards = useCallback(() => {
    setFlashcardIndex(0);
    setView('flashcards');
  }, []);

  const handleSchedule = useCallback(async (event: TAMUEvent) => {
    const se: ScheduledEvent = {
      id: String(event.id), title: event.title, location: event.location,
      description: event.description, date_ts: event.date_ts, date_iso: event.date_iso,
      endDate_ts: event.date2_ts, location_lat: event.location_lat,
      location_lng: event.location_lng, category: classifyCategory(event),
    };
    scheduleEvent(se);

    if (user?.id) {
       try {
         await fetch(`${API_URL}/campus/events/rsvp`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             clerk_id: user.id,
             event_id: String(event.id),
             response: 'going'
           })
         });
       } catch (err) {
         console.error('[Events] RSVP error:', err);
       }
    }
  }, [scheduleEvent, user]);

  const handleSwipeRight = useCallback((event: TAMUEvent) => {
    /* Add to schedule on swipe right (to show in Places) */
    handleSchedule(event);
    pan.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
  }, [handleSchedule, pan, opacity]);

  const handleSwipeLeft = useCallback((event: TAMUEvent) => {
    dislikeEvent(String(event.id));
    pan.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
  }, [dislikeEvent, pan, opacity]);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat/users`);
      if (res.ok) { setFriendsList(await res.json()); }
    } catch {} finally { setFriendsLoading(false); }
  }, []);

  const handleShare = useCallback((event: TAMUEvent) => {
    setShareEvent(event);
    setFriendSearch('');
    setSelectedFriends(new Set());
    loadFriends();
    setShareModalVisible(true);
  }, [loadFriends]);

  const toggleFriendSelection = useCallback((id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return friendsList;
    const q = friendSearch.toLowerCase();
    return friendsList.filter((f) => f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q));
  }, [friendsList, friendSearch]);

  const sendToSelectedFriends = useCallback(() => {
    if (!shareEvent || selectedFriends.size === 0) return;
    setShareModalVisible(false);
    const eventPayload = {
      event_id: String(shareEvent.id),
      title: shareEvent.title,
      location: shareEvent.location || shareEvent.location_title || null,
      description: shareEvent.description || null,
      date_ts: shareEvent.date_ts,
      date_iso: shareEvent.date_iso,
      location_lat: shareEvent.location_lat ?? null,
      location_lng: shareEvent.location_lng ?? null,
      category: classifyCategory(shareEvent),
    };
    const ids = Array.from(selectedFriends);
    if (ids.length === 1) {
      const friend = friendsList.find((f) => f.id === ids[0]);
      if (friend) {
        navigation.navigate('ChatScreen', {
          otherUserClerkId: friend.id,
          otherUserName: friend.name,
          otherUserImageUrl: friend.profile_image_url,
          prefillEvent: eventPayload,
        });
      }
    } else {
      navigation.navigate('ChatScreen', {
        memberIds: ids,
        groupName: `Event: ${shareEvent.title.slice(0, 30)}`,
        isGroup: true,
        prefillEvent: eventPayload,
      });
    }
  }, [shareEvent, selectedFriends, friendsList, navigation]);

  const handleMapOpen = useCallback((event: TAMUEvent) => {
    if (event.location_lat != null && event.location_lng != null) {
      navigation.navigate('Main', {
        screen: 'Places',
        params: {
          initialLayer: 'Academic',
          focusToken: `event:${event.id}:${event.date_ts}`,
          eventFocus: {
            eventId: String(event.id), title: event.title,
            location: event.location || null, latitude: event.location_lat,
            longitude: event.location_lng, startTime: event.date_iso,
            link: event.url || null, hasFood: !!event.has_food,
          },
        }
      });
    }
  }, [navigation]);

  const handleMapNav = useCallback((event: TAMUEvent) => {
    if (event.location_lat != null && event.location_lng != null) {
      navigation.navigate('Main', {
        screen: 'Places',
        params: {
          initialLayer: 'Academic', focusToken: `event:${event.id}:${event.date_ts}`,
          eventFocus: {
            eventId: String(event.id), title: event.title,
            location: event.location || null, latitude: event.location_lat,
            longitude: event.location_lng, startTime: event.date_iso,
            link: event.url || null, hasFood: !!event.has_food,
          },
        }
      });
    }
  }, [navigation]);

  const handleRestoreCategory = useCallback((category?: ExploreCategory) => {
    if (!category) {
      clearDisliked();
      setSettingsModalVisible(false);
      return;
    }
    const idsToRestore = dislikedEventIds.filter((id) => {
      const ev = events.find((e) => String(e.id) === id);
      return ev && classifyCategory(ev) === category;
    });
    if (idsToRestore.length > 0) {
      removeIdsFromDisliked(idsToRestore);
    }
    setSettingsModalVisible(false);
  }, [dislikedEventIds, events, clearDisliked, removeIdsFromDisliked]);

  const s = getStyles(COLORS, isDark, embedded);

  /* ── Share Modal (rendered in all views) ── */
  const renderShareModal = () => (
    <Modal visible={shareModalVisible} transparent animationType="slide" onRequestClose={() => setShareModalVisible(false)}>
      <Pressable style={s.modalOverlay} onPress={() => setShareModalVisible(false)}>
        <Pressable style={s.shareSheet} onPress={() => {}}>
          <Text style={s.modalSheetTitle}>Send to Friend</Text>
          <View style={s.searchBar}>
            <TextInput
              style={s.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor={COLORS.textTertiary}
              value={friendSearch}
              onChangeText={setFriendSearch}
              autoCorrect={false}
            />
          </View>
          {friendsLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={COLORS.primary} /></View>
          ) : filteredFriends.length === 0 ? (
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 32 }}>No friends found.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {filteredFriends.map((f) => {
                const isSelected = selectedFriends.has(f.id);
                return (
                  <Pressable key={f.id} style={[s.friendRow, isSelected && s.friendRowSelected]} onPress={() => toggleFriendSelection(f.id)}>
                    <View style={[s.friendAvatar, isSelected && { backgroundColor: '#30D158' }]}>
                      {isSelected ? <Check size={16} color="#FFF" /> : <Text style={s.friendAvatarText}>{f.name?.slice(0, 2).toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{f.name}</Text>
                      <Text style={s.friendEmail}>{f.email}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {selectedFriends.size > 0 && (
            <Pressable style={s.sendFab} onPress={sendToSelectedFriends}>
              <Send size={18} color="#FFF" />
              <Text style={s.sendFabText}>
                {selectedFriends.size === 1 ? 'Send Message' : `Send to ${selectedFriends.size} as Group`}
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  /* ══════ VIEW: GRID ══════ */
  if (view === 'grid') {
    return (
      <View style={s.container}>
        <View style={s.gridHeader}>
          <View style={s.gridHeaderTop}>
            <CalendarDays size={22} color={COLORS.textPrimary} />
            <Text style={s.gridTitle}>Events</Text>
            <View style={{ flex: 1 }} />
            <Pressable style={s.inboxBtn} onPress={() => setView('inbox')}>
              <Inbox size={18} color={COLORS.textPrimary} />
              {receivedInvites.length > 0 && <View style={s.inboxBadge}><Text style={s.inboxBadgeText}>{receivedInvites.length}</Text></View>}
            </Pressable>
            <Pressable style={s.savedBtn} onPress={() => setSettingsModalVisible(true)}>
              <Settings size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          {/* Major Specific Toggle */}
          <View style={s.majorRow}>
            <Text style={s.majorLabel}>Major Specific</Text>
            <Pressable style={[s.toggle, isMajorSpecific && s.toggleOn]} onPress={() => setMajorSpecific(!isMajorSpecific)}>
              <View style={[s.toggleKnob, isMajorSpecific && s.toggleKnobOn]} />
            </Pressable>
          </View>
          {isMajorSpecific && (
            <Pressable style={s.majorPicker} onPress={() => setSettingsModalVisible(true)}>
              <Text style={s.majorPickerText}>{selectedMajor}</Text>
              <ChevronDown size={16} color={COLORS.textPrimary} />
            </Pressable>
          )}

        </View>

        {loading ? (
          <View style={s.loadWrap}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={s.loadText}>Loading events...</Text></View>
        ) : (
          <ScrollView contentContainerStyle={s.gridScroll} showsVerticalScrollIndicator={false}>
            <View style={s.grid}>
              {((([...ALL_CATEGORIES] as ExploreCategory[])
                .filter(c => c !== 'Miscellaneous')) as ExploreCategory[])
                .sort((a, b) => (categoryCounts[b] || 0) - (categoryCounts[a] || 0))
                .concat(['Miscellaneous' as ExploreCategory])
                .map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const selected = selectedCategories.has(cat);
                  const count = categoryCounts[cat] || 0;
                  const isEmpty = count === 0;
                  return (
                    <Pressable key={cat} style={[s.tile, { backgroundColor: meta.color }, isEmpty && s.tileEmpty]} onPress={() => { if (!isEmpty) toggleCategory(cat); }}>
                      <View style={[s.selectCircle, selected && s.selectCircleOn]}>
                        {selected && <Check size={14} color="#FFFFFF" />}
                      </View>
                      <Text style={s.tileName}>{cat}</Text>
                      <Text style={s.tileCount}>{count} events</Text>
                    </Pressable>
                  );
                })}
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
        )}

        {selectedCategories.size > 0 && (
          <Pressable style={s.exploreFab} onPress={openFlashcards}>
            <Text style={s.exploreFabText}>Explore {flashcardStack.length} Events</Text>
          </Pressable>
        )}

        {/* Settings / Major Picker Modal */}
        <Modal visible={settingsModalVisible} transparent animationType="fade" onRequestClose={() => setSettingsModalVisible(false)}>
          <Pressable style={s.modalOverlay} onPress={() => setSettingsModalVisible(false)}>
            <Pressable style={s.modalSheet} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.modalSheetTitle}>Settings</Text>
                
                <Text style={s.modalSectionLabel}>MAJOR FILTER</Text>
                {MAJOR_OPTIONS.map((m) => (
                  <Pressable key={m} style={s.modalOption} onPress={() => { setSelectedMajor(m); setSettingsModalVisible(false); }}>
                    <Text style={[s.modalOptionText, selectedMajor === m && { color: COLORS.primary, fontWeight: '900' }]}>{m}</Text>
                    {selectedMajor === m && <Check size={16} color={COLORS.primary} />}
                  </Pressable>
                ))}

                <View style={{ height: 20 }} />
                <Text style={s.modalSectionLabel}>RESTORE HIDDEN EVENTS</Text>
                <Pressable style={s.modalOption} onPress={() => handleRestoreCategory()}>
                  <Text style={[s.modalOptionText, { color: '#FF453A' }]}>Restore All</Text>
                </Pressable>
                {ALL_CATEGORIES.map((cat) => {
                  const count = dislikedEventIds.filter(id => {
                    const ev = events.find(e => String(e.id) === id);
                    return ev && classifyCategory(ev) === cat;
                  }).length;
                  if (count === 0) return null;
                  return (
                    <Pressable key={`restore-${cat}`} style={s.modalOption} onPress={() => handleRestoreCategory(cat)}>
                      <Text style={s.modalOptionText}>Restore {cat} ({count})</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {renderShareModal()}
      </View>
    );
  }

  /* ══════ VIEW: FLASHCARDS ══════ */
  if (view === 'flashcards') {
    const currentEvent = flashcardStack[flashcardIndex];
    const hasSocial = selectedCategories.has('Social');
    const isFinished = !currentEvent;
    return (
      <Animated.View style={[s.container, { backgroundColor }]}>
        <View style={s.fcHeader}>
          <Pressable style={s.fcBack} onPress={() => setView('grid')}>
            <ChevronLeft size={20} color={COLORS.textPrimary} />
          </Pressable>
          {isListView && !isFinished ? (
              <View style={[s.searchBarContainer, { flex: 1, marginTop: 0, height: 42, marginHorizontal: 8 }]}>
                <Search size={16} color={COLORS.textTertiary} />
                <TextInput
                  style={[s.searchBarInput, { fontSize: 13 }]}
                  placeholder="Search events..."
                  placeholderTextColor={COLORS.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
              </View>
          ) : (
            <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={s.fcProgress}>{isFinished ? 'Done!' : `${flashcardIndex + 1} of ${flashcardStack.length}`}</Text>
            </View>
          )}
          <View style={s.fcMajorToggleWrap}>
            <View style={s.fcMajorToggle}>
                <Text style={s.fcMajorLabel}>Major Only</Text>
                <Pressable style={[s.toggleSmall, isMajorSpecific && s.toggleSmallOn]} onPress={() => setMajorSpecific(!isMajorSpecific)}>
                    <View style={[s.toggleKnobSmall, isMajorSpecific && s.toggleKnobSmallOn]} />
                </Pressable>
            </View>
            <View style={s.fcMajorToggle}>
                <Text style={s.fcMajorLabel}>List View</Text>
                <Pressable style={[s.toggleSmall, isListView && s.toggleSmallOn]} onPress={() => setIsListView(!isListView)}>
                    <View style={[s.toggleKnobSmall, isListView && s.toggleKnobSmallOn]} />
                </Pressable>
            </View>
          </View>
        </View>

        {hasSocial && (
          <View style={s.socialFilter}>
            {(['casual', 'professional'] as SocialMode[]).map((mode) => (
              <Pressable key={mode} style={[s.socialPill, socialMode === mode && s.socialPillOn]} onPress={() => setSocialMode(mode)}>
                <Text style={[s.socialPillText, socialMode === mode && s.socialPillTextOn]}>{mode === 'casual' ? 'Casual' : 'Professional'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {isFinished ? (
          <View style={s.finishedWrap}>
            <Text style={s.finishedTitle}>All Caught Up!</Text>
            <Text style={s.finishedSub}>You've seen all events in your selected categories.</Text>
            <Pressable style={s.finishedBtn} onPress={() => setView('grid')}>
              <Text style={s.finishedBtnText}>Back to Categories</Text>
            </Pressable>
          </View>
        ) : isListView ? (
          <ScrollView contentContainerStyle={s.listScroll} showsVerticalScrollIndicator={false}>
            {flashcardStack.map((e) => (
              <Pressable key={String(e.id)} style={s.listRow} onPress={() => setDetailEvent(e)}>
                <View style={[s.listDot, { backgroundColor: CATEGORY_META[classifyCategory(e)]?.color || COLORS.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listRowName} numberOfLines={1}>{e.title}</Text>
                  <Text style={s.listRowSub}>{formatDate(e.date_ts)} · {formatTime(e.date_ts)}</Text>
                </View>
              </Pressable>
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>
        ) : (
          <FlashcardView
            key={`fc-${currentEvent.id}`}
            event={currentEvent}
            COLORS={COLORS}
            isDark={isDark}
            pan={pan}
            opacity={opacity}
            isSaved={savedEventIds.includes(String(currentEvent.id))}
            isScheduled={scheduledEvents.some((se) => se.id === String(currentEvent.id))}
            onSwipeRight={() => { handleSwipeRight(currentEvent); setFlashcardIndex((i) => i + 1); }}
            onSwipeLeft={() => { handleSwipeLeft(currentEvent); setFlashcardIndex((i) => i + 1); }}
            onSchedule={() => handleSchedule(currentEvent)}
            onShare={() => handleShare(currentEvent)}
            onMap={() => handleMapOpen(currentEvent)}
          />
        )}
      {renderShareModal()}
      {detailEvent && (
        <Modal visible={!!detailEvent} transparent animationType="fade">
            <Pressable style={s.modalOverlay} onPress={() => setDetailEvent(null)}>
                <View style={s.detailSheet}>
                    <Text style={s.detailTitle}>{detailEvent.title}</Text>
                    <View style={s.detailMeta}>
                        <View style={s.locRow}>
                            <MapPinIcon size={14} color={COLORS.textSecondary} />
                            <Text style={s.detailMetaText}>{detailEvent.location || 'College Station'}</Text>
                        </View>
                        <View style={s.locRow}>
                            <CalendarIcon size={14} color={COLORS.textSecondary} />
                            <Text style={s.detailMetaText}>{formatDate(detailEvent.date_ts)} at {formatTime(detailEvent.date_ts)}</Text>
                        </View>
                    </View>
                    
                    {detailEvent.description && (
                        <ScrollView style={s.detailDescScroll}>
                             <Text style={s.detailDesc}>{stripHtml(detailEvent.description)}</Text>
                        </ScrollView>
                    )}

                    <View style={s.detailActions}>
                        <Pressable style={[s.detailBtn, { backgroundColor: COLORS.primary }]} onPress={() => { handleSchedule(detailEvent); handleGoogleCalendar(detailEvent); }}>
                            <CalendarIcon size={18} color="#FFF" />
                            <Text style={s.detailBtnText}>Add to Calendar</Text>
                        </Pressable>
                        <View style={s.detailRow}>
                            <Pressable style={s.detailSubBtn} onPress={() => handleShare(detailEvent)}>
                                <Send size={18} color={COLORS.textPrimary} />
                                <Text style={s.detailSubText}>Share</Text>
                            </Pressable>
                            <Pressable style={s.detailSubBtn} onPress={() => handleMapNav(detailEvent)}>
                                <Map size={18} color={COLORS.textPrimary} />
                                <Text style={s.detailSubText}>Map</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Pressable>
        </Modal>
      )}
      </Animated.View>
    );
  }

  /* ══════ VIEW: INBOX ══════ */
  return (
    <View style={s.container}>
      <View style={s.fcHeader}>
        <Pressable style={s.fcBack} onPress={() => setView('grid')}>
          <ChevronLeft size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={s.inboxTitle}>Event Invites</Text>
        <View style={{ flex: 1 }} />
        <View style={s.fcMajorToggle}>
          <Text style={s.fcMajorLabel}>Major</Text>
          <Pressable style={[s.toggleSmall, isMajorSpecific && s.toggleSmallOn]} onPress={() => setMajorSpecific(!isMajorSpecific)}>
            <View style={[s.toggleKnobSmall, isMajorSpecific && s.toggleKnobSmallOn]} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.inboxScroll} showsVerticalScrollIndicator={false}>
        {receivedInvites.length === 0 ? (
          <View style={s.emptyInbox}>
            <Inbox size={48} color={COLORS.textTertiary} />
            <Text style={s.emptyTitle}>No Invites Yet</Text>
            <Text style={s.emptySub}>When friends share events with you, they'll appear here.</Text>
          </View>
        ) : (
          receivedInvites.map((inv) => (
            <View key={inv.id} style={s.inviteCard}>
              <Text style={s.inviteFrom}>From {inv.senderName}</Text>
              <Text style={s.inviteName}>{inv.title}</Text>
              {inv.location && <View style={s.inviteLocRow}><MapPin size={13} color={COLORS.textSecondary} /><Text style={s.inviteLoc}>{inv.location}</Text></View>}
              <Text style={s.inviteTime}>{formatDate(inv.date_ts)} · {formatTime(inv.date_ts)}</Text>
              <View style={s.inviteActions}>
                <Pressable style={[s.inviteActionBtn, { backgroundColor: '#30D158' }]} onPress={() => acceptInvite(inv.id)}>
                  <Check size={18} color="#FFF" />
                </Pressable>
                <Pressable style={[s.inviteActionBtn, { backgroundColor: '#FF453A' }]} onPress={() => rejectInvite(inv.id)}>
                  <XIcon size={18} color="#FFF" />
                </Pressable>
                {inv.location_lat != null && inv.location_lng != null && (
                  <Pressable style={[s.inviteActionBtn, { backgroundColor: '#007AFF' }]} onPress={() => navigation.navigate('Main', {
                    screen: 'Places',
                    params: {
                      initialLayer: 'Academic',
                      eventFocus: { eventId: inv.eventId, title: inv.title, location: inv.location || null, latitude: inv.location_lat, longitude: inv.location_lng, startTime: inv.date_iso, link: null, hasFood: false },
                    }
                  })}>
                    <Map size={18} color="#FFF" />
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      {renderShareModal()}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   FLASHCARD VIEW (swipeable card)
   ═══════════════════════════════════════════════════════════ */
function FlashcardView({
  event, COLORS, isDark, isSaved, isScheduled,
  pan, opacity, onSwipeRight, onSwipeLeft, onSchedule, onShare, onMap,
}: {
  event: TAMUEvent; COLORS: any; isDark: boolean; isSaved: boolean; isScheduled: boolean;
  pan: Animated.ValueXY; opacity: Animated.Value;
  onSwipeRight: () => void; onSwipeLeft: () => void;
  onSchedule: () => void; onShare: () => void; onMap: () => void;
}) {

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(pan.x, { toValue: SCREEN_WIDTH + 100, duration: 250, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
          ]).start(onSwipeRight);
        } else if (g.dx < -SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(pan.x, { toValue: -(SCREEN_WIDTH + 100), duration: 250, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
          ]).start(onSwipeLeft);
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  const rotate = pan.x.interpolate({ inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH], outputRange: ['-12deg', '0deg', '12deg'] });

  const desc = event.description ? stripHtml(event.description) : null;
  const loc = event.location || event.location_title || null;
  const catColor = CATEGORY_META[classifyCategory(event)]?.color || '#6D5EF7';
  const hasCoords = event.location_lat != null && event.location_lng != null;

  const s = fcStyles(COLORS, isDark);

  return (
    <View style={s.wrap}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[s.card, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }], opacity }]}
      >

        <View style={[s.catStrip, { backgroundColor: catColor }]}>
          <Text style={s.catLabel}>{classifyCategory(event)}</Text>
        </View>

        <ScrollView style={s.cardBody} contentContainerStyle={s.cardBodyContent} showsVerticalScrollIndicator={false}>
          <Text style={s.eventName}>{event.title}</Text>
          {loc && (
            <View style={s.locRow}>
              <MapPin size={15} color={COLORS.textSecondary} />
              <Text style={s.locText}>{loc}</Text>
            </View>
          )}
          <View style={s.timeRow}>
            <CalendarIcon size={15} color={COLORS.textSecondary} />
            <Text style={s.timeText}>{formatDate(event.date_ts)} · {formatTime(event.date_ts)}</Text>
          </View>
          {desc && <Text style={s.desc}>{desc}</Text>}
        </ScrollView>

        {/* Map button */}
        {hasCoords && (
          <Pressable style={s.mapBtn} onPress={onMap}>
            <MapPin size={20} color="#FFFFFF" />
            <Text style={s.mapBtnText}>View on Map</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Action buttons below card */}
      <View style={s.actions}>
        <Pressable style={[s.actionBtn, { backgroundColor: isScheduled ? '#30D158' : '#007AFF' }]} onPress={onSchedule}>
          <CalendarIcon size={20} color="#FFF" />
        </Pressable>
        <Pressable style={[s.actionBtn, { backgroundColor: '#FF9500' }]} onPress={onShare}>
          <Send size={20} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES — Grid / Inbox
   ═══════════════════════════════════════════════════════════ */
const getStyles = (COLORS: any, isDark: boolean, embedded: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    /* Grid header */
    gridHeader: { paddingTop: embedded ? 8 : 58, paddingHorizontal: 18, paddingBottom: 12, gap: 10 },
    gridHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    gridTitle: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -1 },
    inboxBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.05)', borderWidth: 1, borderColor: COLORS.border },
    inboxBadge: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF453A', alignItems: 'center', justifyContent: 'center' },
    inboxBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
    savedBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.05)', borderWidth: 1, borderColor: COLORS.border },
    /* Major toggle */
    majorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    majorLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
    toggle: { width: 52, height: 32, borderRadius: 16, padding: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.12)', justifyContent: 'center' },
    toggleOn: { backgroundColor: COLORS.primary },
    toggleKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
    toggleKnobOn: { alignSelf: 'flex-end' as const },
    majorPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)' },
    majorPickerText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
    /* Grid */
    gridScroll: { paddingHorizontal: 16, paddingTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: { width: (SCREEN_WIDTH - 44) / 2, aspectRatio: 1.1, borderRadius: 22, padding: 16, justifyContent: 'flex-end', overflow: 'hidden' },
    selectCircle: { position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
    selectCircleOn: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#FFFFFF' },

    tileName: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.4 },
    tileCount: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    /* Explore FAB */
    exploreFab: { position: 'absolute', bottom: 90, left: 24, right: 24, backgroundColor: isDark ? '#FFFFFF' : '#121214', borderRadius: 22, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 12 },
    exploreFabText: { fontSize: 17, fontWeight: '900', color: isDark ? '#121214' : '#FFFFFF', letterSpacing: -0.3 },
    /* Loading */
    loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadText: { color: COLORS.textSecondary, fontSize: 15 },
    /* Search Bar */
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 14, paddingHorizontal: 12, height: 46, marginTop: 4, borderWidth: 1, borderColor: COLORS.border },
    searchIconWrap: { marginRight: 8 },
    searchBarInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
    /* Flashcard header */
    fcHeader: { paddingTop: embedded ? 8 : 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
    fcBack: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.05)', borderWidth: 1, borderColor: COLORS.border },
    fcProgress: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary },
    fcMajorToggleWrap: { flexDirection: 'column', gap: 4 },
    fcMajorToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
    fcMajorLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
    toggleSmall: { width: 40, height: 24, borderRadius: 12, padding: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.12)', justifyContent: 'center' },
    toggleSmallOn: { backgroundColor: COLORS.primary },
    toggleKnobSmall: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
    toggleKnobSmallOn: { alignSelf: 'flex-end' as const },
    /* Social filter */
    socialFilter: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 8 },
    socialPill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)' },
    socialPillOn: { backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(12,12,14,0.92)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(12,12,14,0.92)' },
    socialPillText: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
    socialPillTextOn: { color: '#FFFFFF' },
    /* Finished */
    finishedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
    finishedEmoji: { fontSize: 56 },
    finishedTitle: { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.6 },
    finishedSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
    finishedBtn: { marginTop: 16, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
    finishedBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    /* Modal */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
    modalSheet: { borderRadius: 24, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', overflow: 'hidden', paddingBottom: 12 },
    modalSheetTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, padding: 22, paddingBottom: 12, letterSpacing: -0.5 },
    modalSectionLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textTertiary, paddingHorizontal: 22, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    modalOptionText: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
    /* Inbox */
    inboxTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, marginLeft: 4 },
    inboxScroll: { paddingHorizontal: 18, paddingTop: 12, gap: 12 },
    emptyInbox: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
    emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
    inviteCard: { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.04)', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: COLORS.border, gap: 6, marginBottom: 4 },
    inviteFrom: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    inviteName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
    inviteLocRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    inviteLoc: { fontSize: 13, color: COLORS.textSecondary },
    inviteTime: { fontSize: 13, color: COLORS.textTertiary },
    inviteActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    inviteActionBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    /* Tile empty */
    tileEmpty: { opacity: 0.4 },
    /* Share sheet */
    shareSheet: { borderRadius: 24, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', overflow: 'hidden', paddingBottom: 20, maxHeight: '60%' },
    friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    friendAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    friendName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
    friendEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
    friendRowSelected: { backgroundColor: isDark ? 'rgba(48,209,88,0.08)' : 'rgba(48,209,88,0.06)' },
    /* Search */
    searchBar: { marginHorizontal: 18, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)' },
    searchInput: { paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.textPrimary },
    /* Send FAB */
    sendFab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 18, marginTop: 12, backgroundColor: isDark ? '#FFFFFF' : '#121214', paddingVertical: 14, borderRadius: 16 },
    sendFabText: { fontSize: 15, fontWeight: '900', color: isDark ? '#121214' : '#FFFFFF' },
    /* List View */
    listScroll: { paddingHorizontal: 16, paddingTop: 10 },
    listRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
    listDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    listRowName: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2 },
    listRowSub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
    listActions: { flexDirection: 'row', gap: 8, marginLeft: 10 },
    listIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
    /* Detail Sheet */
    detailSheet: { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 32, padding: 24, width: '100%', maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },
    detailTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.5, marginBottom: 12 },
    detailMeta: { gap: 8, marginBottom: 20 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailMetaText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
    detailDescScroll: { maxHeight: 200, marginBottom: 24 },
    detailDesc: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
    detailActions: { gap: 12 },
    detailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 18 },
    detailBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    detailRow: { flexDirection: 'row', gap: 12 },
    detailSubBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
    detailSubText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  });

/* ═══════════════════════════════════════════════════════════
   STYLES — Flashcard
   ═══════════════════════════════════════════════════════════ */
const fcStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: { width: SCREEN_WIDTH - 32, height: SCREEN_HEIGHT * 0.58, borderRadius: 28, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 18, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)' },
    indicator: { position: 'absolute', top: 30, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 2.5 },
    likeInd: { right: 20, borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.12)' },
    nopeInd: { left: 20, borderColor: '#FF453A', backgroundColor: 'rgba(255,69,58,0.12)' },
    indText: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    catStrip: { paddingVertical: 10, paddingHorizontal: 18, width: '100%' },
    catLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    cardBody: { flex: 1 },
    cardBodyContent: { padding: 20, gap: 10 },
    eventName: { fontSize: 24, fontWeight: '900', color: isDark ? '#FFFFFF' : '#121214', letterSpacing: -0.6, lineHeight: 30 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: 14, color: COLORS.textSecondary },
    desc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21, marginTop: 4 },
    mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 16, backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 16 },
    mapBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    actions: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingTop: 20, paddingBottom: 16 },
    actionBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  });
