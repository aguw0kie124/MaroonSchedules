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
import { formatLocalDate, getLocalDateString } from '../services/dateUtils';
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
  Trash2,
  X as CloseIcon,
} from 'lucide-react-native';

const TAMU_EVENTS_API = 'https://calendar.tamu.edu/live/json/events';

interface TAMUEvent {
  id: number;
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
}

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

export function EventsCalendarScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark, embedded);
  const navigation = useNavigation<any>();
  const [events, setEvents] = useState<TAMUEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
      const raw = await res.json();

      let eventList: any[] = [];
      if (Array.isArray(raw)) {
        eventList = raw;
      } else if (raw && typeof raw === 'object') {
        for (const key of Object.keys(raw)) {
          const value = raw[key];
          if (Array.isArray(value)) {
            eventList = value;
            break;
          }
        }
      }

      const parsed: TAMUEvent[] = eventList
        .filter((event: any) => event && event.id && event.title)
        .map((event: any) => ({
          id: event.id,
          title: stripHtml(event.title || ''),
          date: event.date || '',
          date_ts: event.date_ts || 0,
          date_iso: event.date_iso || '',
          date2_ts: event.date2_ts || null,
          is_all_day: event.is_all_day,
          location: event.location ? stripHtml(event.location) : null,
          location_title: event.location_title || null,
          description: event.description || null,
          cost: event.cost || null,
          url: event.url || '',
          thumbnail: event.thumbnail || null,
          thumbnail_alt: event.thumbnail_alt || null,
          tags: event.tags || null,
          event_types: event.event_types || null,
          event_types_audience: event.event_types_audience || null,
          group_title: event.group_title ? stripHtml(event.group_title) : '',
          is_canceled: event.is_canceled,
        }))
        .filter((event) => !event.is_canceled)
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
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter((event) =>
      event.title.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query)) ||
      (event.location && event.location.toLowerCase().includes(query)) ||
      (event.group_title && event.group_title.toLowerCase().includes(query))
    );
  }, [grouped, searchQuery, selectedDate]);
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

    const event: TAMUEvent = {
      id: Date.now(),
      title: newEvent.title,
      description: newEvent.description,
      location: newEvent.location,
      date: selectedDate,
      date_ts: Math.floor(new Date(`${selectedDate}T${newEvent.time.includes(':') ? newEvent.time : '12:00'}`).getTime() / 1000),
      date_iso: selectedDate,
      date2_ts: null,
      is_all_day: 0,
      location_title: null,
      cost: null,
      url: '',
      thumbnail: null,
      thumbnail_alt: null,
      tags: ['Personal'],
      event_types: ['Personal'],
      event_types_audience: null,
      group_title: 'My Event',
      is_canceled: null,
    };

    addEvent(event);
    setNewEvent({ title: '', description: '', location: '', time: '12:00 PM' });
    setIsModalVisible(false);
  };

  const handleAddToCalendar = (event: TAMUEvent) => {
    const url = generateGoogleCalendarLink(event);
    Linking.openURL(url).catch((err) => console.error('Failed to open calendar link:', err));
  };

  const panelHeight = isPanelExpanded ? (embedded ? '96%' : '92%') : '60%';

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
              {dayEvents.length > 0 ? formatLocalDate(selectedDate) : `No events for ${formatLocalDate(selectedDate)}`}
            </Text>
            <Text style={styles.panelSubtitle}>
              {dayEvents.length > 0 ? `${dayEvents.length} events for this day` : 'Add a personal event or switch dates'}
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
            <Search size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Filter events for this day..."
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading campus events...</Text>
          </View>
        ) : (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {dayEvents.map((event) => {
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
                      </View>
                      {isPersonal ? (
                        <Pressable onPress={() => removeEvent(event.id)} style={styles.deleteBtn}>
                          <Trash2 size={18} color={COLORS.textPrimary} />
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
            })}

            {dayEvents.length === 0 && !loading ? (
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
  calendarContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 18,
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 10,
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
