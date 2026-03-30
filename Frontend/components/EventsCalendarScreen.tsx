import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, Card } from './SharedUI';
import { useEventStore } from '../store/eventStore';
import type { PersonalEvent } from '../store/eventStore';
import { formatLocalDate, getLocalDateString } from '../services/dateUtils';
import { API_URL } from '../config';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Plus,
  Search,
  Filter,
  Trash2,
  X as CloseIcon,
} from 'lucide-react-native';

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
}

interface TAMUEvent {
  id: string | number;
  title: string;
  date_ts: number;
  date_iso: string;
  date?: string;
  date2_ts?: number | null;
  is_all_day?: number | null;
  location?: string | null;
  location_title?: string | null;
  description?: string | null;
  cost?: string | null;
  url?: string;
  thumbnail?: string | null;
  thumbnail_alt?: string | null;
  tags?: string[] | null;
  event_types?: string[] | null;
  event_types_audience?: string[] | null;
  group_title?: string;
  is_canceled?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
}

type EventsViewMode = 'calendar' | 'categories';
type ExploreCategory = 'Food' | 'Entertainment' | 'Advocacy' | 'Sports' | 'Religion' | 'Social';
type SocialMode = 'casual' | 'professional';
type MajorOption =
  | 'Engineering'
  | 'Business'
  | 'Liberal Arts'
  | 'Agriculture'
  | 'Science'
  | 'Architecture'
  | 'Education'
  | 'Public Health'
  | 'Law'
  | 'Medicine';

const CATEGORY_COLORS: Record<ExploreCategory, string> = {
  Food: '#FF7A00',
  Entertainment: '#6D5EF7',
  Advocacy: '#00A86B',
  Sports: '#007AFF',
  Religion: '#8C52FF',
  Social: '#FF4F7B',
};

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

function formatDateFromTS(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeFromTS(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function buildWeek(dateKey: string) {
  const start = startOfWeek(dateKey);
  return Array.from({ length: 7 }).map((_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return {
      key: formatDateKey(current),
      label: current.toLocaleDateString('en-US', { weekday: 'short' }),
      day: current.getDate(),
    };
  });
}

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

function generateGoogleCalendarLink(event: TAMUEvent) {
  const toGCalDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startDate = toGCalDate(event.date_ts);
  const endDate = event.date2_ts ? toGCalDate(event.date2_ts) : toGCalDate(event.date_ts + 3600);
  const params = new URLSearchParams({
    text: event.title,
    dates: `${startDate}/${endDate}`,
    details: event.description ? stripHtml(event.description).slice(0, 500) : '',
    location: event.location || event.location_title || '',
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

function getEventSearchBlob(event: TAMUEvent) {
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

function classifyEventCategory(event: TAMUEvent): ExploreCategory {
  const blob = getEventSearchBlob(event);
  if (event.has_food || /\bfood\b|\bmeal\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bfree pizza\b|\brefreshments\b/.test(blob)) {
    return 'Food';
  }
  if (/\bconcert\b|\bshow\b|\bmovie\b|\bcomedy\b|\bmusic\b|\bperformance\b|\bfestival\b|\bkaraoke\b|\bgame night\b/.test(blob)) {
    return 'Entertainment';
  }
  if (/\badvocacy\b|\bactivism\b|\bpolicy\b|\bawareness\b|\bcommunity service\b|\bvolunteer\b|\bjustice\b|\bsustainability\b/.test(blob)) {
    return 'Advocacy';
  }
  if (/\bsport\b|\bgame\b|\bmatch\b|\btournament\b|\bfitness\b|\brec\b|\bathletic\b|\bworkout\b/.test(blob)) {
    return 'Sports';
  }
  if (/\bchurch\b|\bfaith\b|\bprayer\b|\bbible\b|\bworship\b|\bministry\b|\bmosque\b|\btemple\b|\brelig/i.test(blob)) {
    return 'Religion';
  }
  return 'Social';
}

function getSocialMode(event: TAMUEvent): SocialMode {
  const blob = getEventSearchBlob(event);
  if (/\bcareer\b|\bnetworking\b|\bprofessional\b|\bresume\b|\binterview\b|\bcompany\b|\brecruit\b|\bworkshop\b|\bpanel\b/.test(blob)) {
    return 'professional';
  }
  return 'casual';
}

function matchesMajor(event: TAMUEvent, major: MajorOption) {
  const blob = getEventSearchBlob(event);
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

export function EventsCalendarScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark, embedded);
  const navigation = useNavigation<any>();
  const [events, setEvents] = useState<TAMUEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventsViewMode, setEventsViewMode] = useState<EventsViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'free_food' | 'has_map' | 'personal'>('all');
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const [isMajorSpecific, setIsMajorSpecific] = useState(false);
  const [selectedMajor, setSelectedMajor] = useState<MajorOption>('Engineering');
  const [isMajorMenuVisible, setIsMajorMenuVisible] = useState(false);
  const [socialMode, setSocialMode] = useState<SocialMode>('casual');
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', location: '', time: '12:00 PM' });

  const { events: personalEvents, addEvent, removeEvent } = useEventStore();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(TAMU_EVENTS_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as CampusEventResponse[];

      const parsed: TAMUEvent[] = raw
        .filter((event) => event && event.event_id && event.title && event.start_time)
        .map((event) => {
          const startTs = Math.floor(new Date(event.start_time).getTime() / 1000);
          const endTs = event.end_time ? Math.floor(new Date(event.end_time).getTime() / 1000) : null;
          return {
            id: event.event_id,
            title: stripHtml(event.title || ''),
            date: event.start_time,
            date_ts: Number.isFinite(startTs) ? startTs : 0,
            date_iso: event.start_time,
            date2_ts: Number.isFinite(endTs as number) ? endTs : null,
            is_all_day: 0,
            location: event.location ? stripHtml(event.location) : null,
            location_title: event.location ? stripHtml(event.location) : null,
            description: event.description || event.summary || null,
            cost: null,
            url: event.link || event.source_url || '',
            thumbnail: null,
            thumbnail_alt: null,
            tags: event.tags || null,
            event_types: event.has_food ? ['Free Food'] : null,
            event_types_audience: null,
            group_title: event.host_name || event.source_name || '',
            is_canceled: null,
            location_lat: event.location_lat ?? null,
            location_lng: event.location_lng ?? null,
            has_food: !!event.has_food,
            food_confidence: event.food_confidence ?? 0,
            food_type: event.food_type ?? null,
          };
        })
        .sort((left, right) => left.date_ts - right.date_ts);

      setEvents(parsed);
    } catch (fetchError: any) {
      console.error('[EventsCal] Error:', fetchError);
      setError('Failed to load events. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const allEvents = [...events, ...personalEvents];
    const groups: Record<string, (TAMUEvent | any)[]> = {};
    for (const event of allEvents) {
      const dateKey = event.date_iso ? event.date_iso.split('T')[0] : formatDateFromTS(event.date_ts);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    }
    return groups;
  }, [events, personalEvents]);

  const dayEvents = useMemo(() => {
    const list = grouped[selectedDate] || [];
    const filteredByType = list.filter((event) => {
      if (eventFilter === 'free_food') return !!event.has_food;
      if (eventFilter === 'has_map') return event.location_lat != null && event.location_lng != null;
      if (eventFilter === 'personal') return !!event.tags?.includes('Personal');
      return true;
    });
    if (!searchQuery.trim()) return filteredByType;
    const query = searchQuery.toLowerCase();
    return filteredByType.filter((event) =>
      event.title.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query)) ||
      (event.location && event.location.toLowerCase().includes(query)) ||
      (event.group_title && event.group_title.toLowerCase().includes(query))
    );
  }, [eventFilter, grouped, searchQuery, selectedDate]);
  const discoverEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      if (query && !getEventSearchBlob(event).includes(query)) return false;
      if (isMajorSpecific && !matchesMajor(event, selectedMajor)) return false;
      const category = classifyEventCategory(event);
      if (category === 'Social' && getSocialMode(event) !== socialMode) return false;
      return true;
    });
  }, [events, isMajorSpecific, searchQuery, selectedMajor, socialMode]);
  const categorizedEvents = useMemo(() => {
    return (['Food', 'Entertainment', 'Advocacy', 'Sports', 'Religion', 'Social'] as ExploreCategory[]).map((category) => ({
      category,
      events: discoverEvents.filter((event) => classifyEventCategory(event) === category).slice(0, 8),
    }));
  }, [discoverEvents]);
  const weekDays = useMemo(() => buildWeek(selectedDate), [selectedDate]);
  const weekLabel = useMemo(
    () => new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [selectedDate],
  );

  const handleAddPersonalEvent = () => {
    if (!newEvent.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    const event: PersonalEvent = {
      id: Date.now(),
      title: newEvent.title,
      description: newEvent.description,
      location: newEvent.location,
      date_ts: Math.floor(new Date(`${selectedDate}T${newEvent.time.includes(':') ? newEvent.time : '12:00'}`).getTime() / 1000),
      date_iso: selectedDate,
      time: newEvent.time,
    };

    addEvent(event);
    setNewEvent({ title: '', description: '', location: '', time: '12:00 PM' });
    setIsModalVisible(false);
  };

  const handleAddToCalendar = (event: TAMUEvent) => {
    const url = generateGoogleCalendarLink(event);
    Linking.openURL(url).catch((err) => console.error('Failed to open calendar link:', err));
  };

  const handleOpenOnMap = (event: TAMUEvent) => {
    if (event.location_lat == null || event.location_lng == null) return;
    navigation.navigate('Places', {
      initialLayer: event.has_food ? 'Dining' : 'Academic',
      focusToken: `event:${event.id}:${event.date_ts}`,
      eventFocus: {
        eventId: String(event.id),
        title: event.title,
        location: event.location || event.location_title || null,
        latitude: event.location_lat,
        longitude: event.location_lng,
        startTime: event.date_iso,
        link: event.url || null,
        hasFood: !!event.has_food,
      },
    });
  };

  const panelHeight = isPanelExpanded ? (embedded ? '97%' : '94%') : '64%';

  return (
    <View style={styles.container}>
      {!embedded ? (
        <View style={styles.topBarWrap}>
          {navigation.canGoBack?.() ? (
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={18} color={COLORS.textPrimary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.topSectionCard}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.titleRow}>
              <CalendarDays size={22} color={COLORS.textPrimary} />
              <Text style={styles.title}>Campus Events</Text>
            </View>
            <Text style={styles.subtitle}>
              {events.length + personalEvents.length} total events tracked
            </Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setIsModalVisible(true)}>
            <Plus color={COLORS.textPrimary} size={22} />
          </Pressable>
        </View>

        <View style={styles.eventsModeRow}>
          {([
            { key: 'calendar', label: 'Calendar' },
            { key: 'categories', label: 'Categories' },
          ] as Array<{ key: EventsViewMode; label: string }>).map((item) => {
            const selected = eventsViewMode === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.eventsModePill, selected && styles.eventsModePillActive]}
                onPress={() => setEventsViewMode(item.key)}
              >
                <Text style={[styles.eventsModePillText, selected && styles.eventsModePillTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {eventsViewMode === 'calendar' ? (
        <View style={styles.calendarContainer}>
          <View style={styles.weekHeaderRow}>
            <Pressable style={styles.weekNavButton} onPress={() => setSelectedDate((current) => shiftDateKey(current, -7))}>
              <ChevronLeft size={18} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
            <Pressable style={styles.weekNavButton} onPress={() => setSelectedDate((current) => shiftDateKey(current, 7))}>
              <ChevronRight size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {weekDays.map((day) => {
              const isSelected = day.key === selectedDate;
              return (
                <Pressable
                  key={day.key}
                  style={[styles.weekDayPill, isSelected && styles.weekDayPillActive]}
                  onPress={() => setSelectedDate(day.key)}
                >
                  <Text style={[styles.weekDayLabel, isSelected && styles.weekDayLabelActive]}>{day.label}</Text>
                  <Text style={[styles.weekDayNumber, isSelected && styles.weekDayNumberActive]}>{day.day}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        ) : (
          <View style={styles.categoriesToolbar}>
            <View style={styles.majorSpecificRow}>
              <Text style={styles.majorSpecificLabel}>Major specific</Text>
              <Pressable
                style={[styles.majorToggle, isMajorSpecific && styles.majorToggleActive]}
                onPress={() => setIsMajorSpecific((current) => !current)}
              >
                <View style={[styles.majorToggleKnob, isMajorSpecific && styles.majorToggleKnobActive]} />
              </Pressable>
            </View>
            {isMajorSpecific ? (
              <Pressable style={styles.majorPicker} onPress={() => setIsMajorMenuVisible(true)}>
                <Text style={styles.majorPickerLabel}>{selectedMajor}</Text>
                <ChevronDown size={16} color={COLORS.textPrimary} />
              </Pressable>
            ) : null}
            <View style={styles.socialModeRow}>
              <Text style={styles.socialModeLabel}>Social</Text>
              <View style={styles.socialModeToggle}>
                {([
                  { key: 'casual', label: 'Casual' },
                  { key: 'professional', label: 'Professional' },
                ] as Array<{ key: SocialMode; label: string }>).map((item) => {
                  const selected = socialMode === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.socialModePill, selected && styles.socialModePillActive]}
                      onPress={() => setSocialMode(item.key)}
                    >
                      <Text style={[styles.socialModePillText, selected && styles.socialModePillTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchEvents} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.eventsPanel, { height: panelHeight }]}>
        <View style={styles.panelHandle} />
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateHeaderText}>
              {eventsViewMode === 'calendar'
                ? dayEvents.length > 0
                  ? formatLocalDate(selectedDate)
                  : `No events for ${formatLocalDate(selectedDate)}`
                : 'Explore by Category'}
            </Text>
            <Text style={styles.panelSubtitle}>
              {eventsViewMode === 'calendar'
                ? dayEvents.length > 0
                  ? `${dayEvents.length} events for this day`
                  : 'Add a personal event or switch dates'
                : `${discoverEvents.length} events matched across your category feed`}
            </Text>
          </View>
          <View style={styles.panelActions}>
            <Pressable style={styles.panelToggleButton} onPress={() => setIsPanelExpanded((current) => !current)}>
              {isPanelExpanded ? (
                <ChevronDown size={18} color={COLORS.textPrimary} />
              ) : (
                <ChevronUp size={18} color={COLORS.textPrimary} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Pressable style={styles.searchIconButton} onPress={() => setIsFilterMenuVisible(true)}>
              <Search size={18} color={COLORS.textSecondary} />
            </Pressable>
            <TextInput
              style={styles.searchInput}
              placeholder={eventsViewMode === 'calendar' ? 'Filter events for this day...' : 'Search all event categories...'}
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {eventsViewMode === 'calendar' ? (
            <Pressable style={styles.searchFilterButton} onPress={() => setIsFilterMenuVisible(true)}>
              <Filter size={15} color={COLORS.textPrimary} />
              <Text style={styles.searchFilterButtonText}>
                {eventFilter === 'all'
                  ? 'All'
                  : eventFilter === 'free_food'
                    ? 'Free Food'
                    : eventFilter === 'has_map'
                      ? 'Map Pins'
                      : 'Personal'}
              </Text>
            </Pressable>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading campus events...</Text>
          </View>
        ) : (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {eventsViewMode === 'calendar' ? dayEvents.map((event) => {
              const isExpanded = expandedId === event.id;
              const isPersonal = event.tags?.includes('Personal');
              const desc = event.description ? stripHtml(event.description) : null;
              const locationDisplay = event.location || event.location_title || null;

              return (
                <Pressable
                  key={event.id}
                  onPress={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  <Card style={styles.eventCard}>
                    <View style={styles.eventRow}>
                      <View style={[styles.timeBadge, isPersonal && styles.personalTimeBadge]}>
                        <Text style={styles.timeText}>
                          {event.is_all_day ? 'All Day' : formatTimeFromTS(event.date_ts)}
                        </Text>
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle} numberOfLines={isExpanded ? undefined : 2}>
                          {event.title}
                        </Text>
                        {locationDisplay ? (
                          <View style={styles.eventLocationRow}>
                            <MapPin size={13} color={COLORS.textSecondary} />
                            <Text style={styles.eventLocation}>{locationDisplay}</Text>
                          </View>
                        ) : null}
                        {event.has_food ? (
                          <View style={styles.freeFoodBadge}>
                            <Text style={styles.freeFoodBadgeText}>
                              {event.food_type ? `Free Food • ${event.food_type}` : 'Free Food'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.eventSideActions}>
                        {event.location_lat != null && event.location_lng != null ? (
                          <Pressable onPress={() => handleOpenOnMap(event)} style={styles.mapActionButton}>
                            <MapPin size={16} color="#FFFFFF" />
                          </Pressable>
                        ) : null}
                        {isPersonal ? (
                          <Pressable onPress={() => removeEvent(event.id as number)} style={styles.deleteBtn}>
                            <Trash2 size={18} color={COLORS.textPrimary} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    {isExpanded ? (
                      <View style={styles.expandedSection}>
                        {desc ? <Text style={styles.descText}>{desc}</Text> : null}
                        <View style={styles.actionRow}>
                          <Pressable style={styles.addCalBtn} onPress={() => handleAddToCalendar(event)}>
                            <View style={styles.addCalContent}>
                              <CalendarIcon size={14} color={isDark ? '#FFFFFF' : COLORS.textPrimary} />
                              <Text style={styles.addCalText}>Add to Calendar</Text>
                            </View>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            }) : categorizedEvents.map((section) => (
              <View key={section.category} style={styles.categorySection}>
                <View style={[styles.categorySectionHeader, { backgroundColor: CATEGORY_COLORS[section.category] }]}>
                  <Text style={styles.categorySectionTitle}>{section.category}</Text>
                  <Text style={styles.categorySectionCount}>{section.events.length} events</Text>
                </View>
                {section.category === 'Social' ? (
                  <Text style={styles.categorySectionHint}>
                    Showing {socialMode === 'casual' ? 'casual' : 'professional'} social events.
                  </Text>
                ) : null}
                {section.events.length === 0 ? (
                  <View style={styles.categoryEmptyCard}>
                    <Text style={styles.categoryEmptyText}>No {section.category.toLowerCase()} events match right now.</Text>
                  </View>
                ) : (
                  section.events.map((event) => {
                    const isExpanded = expandedId === `category:${section.category}:${event.id}`;
                    const desc = event.description ? stripHtml(event.description) : null;
                    const locationDisplay = event.location || event.location_title || null;
                    return (
                      <Pressable
                        key={`category:${section.category}:${event.id}`}
                        onPress={() => setExpandedId(isExpanded ? null : `category:${section.category}:${event.id}`)}
                      >
                        <Card style={styles.eventCard}>
                          <View style={styles.eventRow}>
                            <View style={[styles.timeBadge, { backgroundColor: CATEGORY_COLORS[section.category] }]}>
                              <Text style={[styles.timeText, { color: '#FFFFFF' }]}>
                                {event.is_all_day ? 'All Day' : formatTimeFromTS(event.date_ts)}
                              </Text>
                            </View>
                            <View style={styles.eventInfo}>
                              <Text style={styles.eventTitle} numberOfLines={isExpanded ? undefined : 2}>
                                {event.title}
                              </Text>
                              {locationDisplay ? (
                                <View style={styles.eventLocationRow}>
                                  <MapPin size={13} color={COLORS.textSecondary} />
                                  <Text style={styles.eventLocation}>{locationDisplay}</Text>
                                </View>
                              ) : null}
                              {event.group_title ? (
                                <Text style={styles.categoryHostText}>{event.group_title}</Text>
                              ) : null}
                            </View>
                            {event.location_lat != null && event.location_lng != null ? (
                              <Pressable onPress={() => handleOpenOnMap(event)} style={styles.mapActionButton}>
                                <MapPin size={16} color="#FFFFFF" />
                              </Pressable>
                            ) : null}
                          </View>
                          {isExpanded ? (
                            <View style={styles.expandedSection}>
                              {desc ? <Text style={styles.descText}>{desc}</Text> : null}
                              <View style={styles.actionRow}>
                                <Pressable style={styles.addCalBtn} onPress={() => handleAddToCalendar(event)}>
                                  <View style={styles.addCalContent}>
                                    <CalendarIcon size={14} color={isDark ? '#FFFFFF' : COLORS.textPrimary} />
                                    <Text style={styles.addCalText}>Add to Calendar</Text>
                                  </View>
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                        </Card>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ))}

            {eventsViewMode === 'calendar' && dayEvents.length === 0 && !loading ? (
              <View style={styles.emptyState}>
                <CalendarIcon size={40} color={COLORS.textSecondary} />
                <Text style={styles.emptyTitle}>Clear Schedule</Text>
                <Text style={styles.emptySubtitle}>No events found for {selectedDate}.</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <CloseIcon color={COLORS.textPrimary} size={24} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Event name..."
                placeholderTextColor="#666"
                value={newEvent.title}
                onChangeText={(value) => setNewEvent({ ...newEvent, title: value })}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Time</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 2:00 PM"
                  placeholderTextColor="#666"
                  value={newEvent.time}
                  onChangeText={(value) => setNewEvent({ ...newEvent, time: value })}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 2, marginLeft: 12 }]}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="MSC, Room 101..."
                  placeholderTextColor="#666"
                  value={newEvent.location}
                  onChangeText={(value) => setNewEvent({ ...newEvent, location: value })}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Optional details..."
                placeholderTextColor="#666"
                multiline
                value={newEvent.description}
                onChangeText={(value) => setNewEvent({ ...newEvent, description: value })}
              />
            </View>

            <Pressable style={styles.saveBtn} onPress={handleAddPersonalEvent}>
              <Text style={styles.saveBtnText}>Save Event</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isFilterMenuVisible && eventsViewMode === 'calendar'}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterMenuVisible(false)}
      >
        <Pressable style={styles.filterOverlay} onPress={() => setIsFilterMenuVisible(false)}>
          <Pressable style={styles.filterSheet} onPress={() => {}}>
            {[
              { key: 'all', label: 'All Events' },
              { key: 'free_food', label: 'Free Food' },
              { key: 'has_map', label: 'Map Pins' },
              { key: 'personal', label: 'Personal' },
            ].map((filter) => {
              const selected = eventFilter === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  style={styles.filterSheetOption}
                  onPress={() => {
                    setEventFilter(filter.key as typeof eventFilter);
                    setIsFilterMenuVisible(false);
                  }}
                >
                  <Text style={[styles.filterSheetOptionText, selected && styles.filterSheetOptionTextActive]}>
                    {filter.label}
                  </Text>
                  {selected ? <Text style={styles.filterSheetSelectedMark}>Done</Text> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={isMajorMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMajorMenuVisible(false)}
      >
        <Pressable style={styles.filterOverlay} onPress={() => setIsMajorMenuVisible(false)}>
          <Pressable style={styles.filterSheet} onPress={() => {}}>
            {MAJOR_OPTIONS.map((major) => {
              const selected = selectedMajor === major;
              return (
                <Pressable
                  key={major}
                  style={styles.filterSheetOption}
                  onPress={() => {
                    setSelectedMajor(major);
                    setIsMajorMenuVisible(false);
                  }}
                >
                  <Text style={[styles.filterSheetOptionText, selected && styles.filterSheetOptionTextActive]}>
                    {major}
                  </Text>
                  {selected ? <Text style={styles.filterSheetSelectedMark}>Done</Text> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean, embedded: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBarRow: {
    flex: 1,
  },
  topBarWrap: {
    paddingTop: 54,
    paddingHorizontal: 16,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(16,16,18,0.74)' : 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
  },
  header: {
    paddingTop: embedded ? 0 : 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  topSectionCard: {
    marginHorizontal: 16,
    marginBottom: 2,
    borderRadius: 32,
    backgroundColor: isDark ? 'rgba(12,12,14,0.54)' : 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    overflow: 'hidden',
  },
  headerCopy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    marginBottom: 4,
  },
  eventsModeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  eventsModePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
  },
  eventsModePillActive: {
    backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(12,12,14,0.92)',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(12,12,14,0.92)',
  },
  eventsModePillText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  eventsModePillTextActive: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 18,
  },
  categoriesToolbar: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 12,
  },
  majorSpecificRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  majorSpecificLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  majorToggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 3,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.12)',
    justifyContent: 'center',
  },
  majorToggleActive: {
    backgroundColor: COLORS.primary,
  },
  majorToggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  majorToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  majorPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
  },
  majorPickerLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  socialModeRow: {
    gap: 8,
  },
  socialModeLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  socialModeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  socialModePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
    paddingVertical: 10,
  },
  socialModePillActive: {
    backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(12,12,14,0.92)',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(12,12,14,0.92)',
  },
  socialModePillText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  socialModePillTextActive: {
    color: '#FFFFFF',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  weekNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
  weekDayPill: {
    flex: 1,
    minHeight: 68,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weekDayPillActive: {
    backgroundColor: 'rgba(12,12,14,0.92)',
    borderColor: 'rgba(12,12,14,0.92)',
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  weekDayLabelActive: {
    color: '#FFFFFF',
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  weekDayNumberActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorText: {
    color: COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
  },
  retryBtn: {
    marginLeft: 12,
    backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : COLORS.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  eventsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(12,12,14,0.96)' : 'rgba(255,255,255,0.94)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 18,
  },
  panelHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(12,12,14,0.16)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  panelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  panelSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  panelToggleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#111111' : 'rgba(12,12,14,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  searchFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    marginLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  searchFilterButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-start',
    paddingTop: embedded ? 180 : 210,
    paddingHorizontal: 22,
  },
  filterSheet: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: isDark ? 'rgba(12,12,14,0.98)' : 'rgba(255,255,255,0.98)',
  },
  filterSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterSheetOptionText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  filterSheetOptionTextActive: {
    color: COLORS.primary,
  },
  filterSheetSelectedMark: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 40,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  listScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  categorySection: {
    marginBottom: 18,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  categorySectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  categorySectionCount: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '800',
  },
  categorySectionHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  categoryEmptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(12,12,14,0.03)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  categoryEmptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  eventCard: {
    marginBottom: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: isDark ? 'rgba(243,241,237,0.42)' : 'rgba(12,12,14,0.2)',
    backgroundColor: isDark ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.98)',
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  timeBadge: {
    backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : COLORS.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 68,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personalTimeBadge: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.12)',
  },
  timeText: {
    color: isDark ? '#FFFFFF' : COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#121214',
  },
  eventLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventLocation: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  categoryHostText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontWeight: '700',
  },
  freeFoodBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FF7A00',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  freeFoodBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  eventSideActions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(12,12,14,0.92)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
  },
  deleteBtn: {
    padding: 8,
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  descText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addCalBtn: {
    backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : COLORS.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addCalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addCalText: {
    color: isDark ? '#FFFFFF' : COLORS.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C8C8CF',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalInput: {
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#222222',
  },
  saveBtn: {
    backgroundColor: 'rgba(12,12,14,0.92)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
