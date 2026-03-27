import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Linking,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme, Card } from './SharedUI';
import { useEventStore } from '../store/eventStore';
import { getLocalDateString, formatLocalDate } from '../services/dateUtils';
import { Plus, Trash2, X as CloseIcon, Calendar as CalendarIcon, MapPin, Clock, Tag, Search } from 'lucide-react-native';

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

function stripHtml(html: string): string {
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

function generateGoogleCalendarLink(event: TAMUEvent): string {
  const toGCalDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startDate = toGCalDate(event.date_ts);
  // If no end time, default to 1 hour after start
  const endDate = event.date2_ts ? toGCalDate(event.date2_ts) : toGCalDate(event.date_ts + 3600);

  const params = new URLSearchParams({
    text: event.title,
    dates: `${startDate}/${endDate}`,
    details: event.description ? stripHtml(event.description).slice(0, 500) : '',
    location: event.location || event.location_title || '',
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

export function EventsCalendarScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
  const [events, setEvents] = useState<TAMUEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  
  const { events: personalEvents, addEvent, removeEvent } = useEventStore();
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', location: '', time: '12:00 PM' });

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

      // The API returns an array of event objects
      let eventList: any[] = [];
      if (Array.isArray(raw)) {
        eventList = raw;
      } else if (raw && typeof raw === 'object') {
        // Sometimes the API nests events under a key
        for (const key of Object.keys(raw)) {
          const val = raw[key];
          if (Array.isArray(val)) {
            eventList = val;
            break;
          }
        }
      }

      const parsed: TAMUEvent[] = eventList
        .filter((e: any) => e && e.id && e.title)
        .map((e: any) => ({
          id: e.id,
          title: stripHtml(e.title || ''),
          date: e.date || '',
          date_ts: e.date_ts || 0,
          date_iso: e.date_iso || '',
          date2_ts: e.date2_ts || null,
          is_all_day: e.is_all_day,
          location: e.location ? stripHtml(e.location) : null,
          location_title: e.location_title || null,
          description: e.description || null,
          cost: e.cost || null,
          url: e.url || '',
          thumbnail: e.thumbnail || null,
          thumbnail_alt: e.thumbnail_alt || null,
          tags: e.tags || null,
          event_types: e.event_types || null,
          event_types_audience: e.event_types_audience || null,
          group_title: e.group_title ? stripHtml(e.group_title) : '',
          is_canceled: e.is_canceled,
        }))
        .filter((e) => !e.is_canceled)
        .sort((a, b) => a.date_ts - b.date_ts);

      setEvents(parsed);
    } catch (e: any) {
      console.error('[EventsCal] Error:', e);
      setError('Failed to load events. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPersonalEvent = () => {
    if (!newEvent.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    const id = Date.now();
    const event: TAMUEvent = {
        id,
        title: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        date: selectedDate,
        date_ts: Math.floor(new Date(selectedDate + 'T' + (newEvent.time.includes(':') ? newEvent.time : '12:00')).getTime() / 1000),
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

  const handleRemoveEvent = (id: number) => {
    removeEvent(id);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.group_title && e.group_title.toLowerCase().includes(q)) ||
        (e.tags && e.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [events, searchQuery]);

  // Group by date string
  const grouped = useMemo(() => {
    const all = [...events, ...personalEvents];
    const groups: Record<string, (TAMUEvent | any)[]> = {};
    for (const e of all) {
      const dateKey = e.date_iso ? e.date_iso.split('T')[0] : formatDateFromTS(e.date_ts);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    }
    return groups;
  }, [events, personalEvents]);

  const markedDates = useMemo(() => {
    const marks: any = {};
    Object.keys(grouped).forEach(date => {
        marks[date] = { marked: true, dotColor: COLORS.primary };
    });
    marks[selectedDate] = { 
        ...(marks[selectedDate] || {}), 
        selected: true, 
        selectedColor: COLORS.primary 
    };
    return marks;
  }, [grouped, selectedDate]);

  const dayEvents = useMemo(() => {
    const list = grouped[selectedDate] || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(e => 
        e.title.toLowerCase().includes(q) || 
        (e.description && e.description.toLowerCase().includes(q))
    );
  }, [grouped, selectedDate, searchQuery]);

  const handleAddToCalendar = (event: TAMUEvent) => {
    const url = generateGoogleCalendarLink(event);
    Linking.openURL(url).catch((err) => console.error('Failed to open calendar link:', err));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading campus events…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🗓 Campus Events</Text>
          <Text style={styles.subtitle}>
            {events.length + personalEvents.length} total events tracked
          </Text>
        </View>
        <Pressable 
          style={styles.addBtn}
          onPress={() => setIsModalVisible(true)}
        >
          <Plus color="#FFFFFF" size={24} />
        </Pressable>
      </View>

      <View style={styles.calendarContainer}>
        <Calendar
          theme={{
            backgroundColor: '#000',
            calendarBackground: '#000',
            textSectionTitleColor: '#FF8A8A',
            selectedDayBackgroundColor: COLORS.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: COLORS.primary,
            dayTextColor: '#d9e1e8',
            textDisabledColor: '#444',
            dotColor: COLORS.primary,
            selectedDotColor: '#ffffff',
            arrowColor: COLORS.primary,
            monthTextColor: '#FFFFFF',
            indicatorColor: COLORS.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: '800',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 14,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 12
          }}
          markedDates={markedDates}
          onDayPress={(day: any) => setSelectedDate(day.dateString)}
        />
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

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchEvents} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>
            {dayEvents.length > 0 ? formatLocalDate(selectedDate) : `No events for ${formatLocalDate(selectedDate)}`}
          </Text>
        </View>
        
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
                  <View style={[styles.timeBadge, isPersonal && { backgroundColor: '#FF8A8A' }]}>
                    <Text style={styles.timeText}>
                      {event.is_all_day ? 'All Day' : formatTimeFromTS(event.date_ts)}
                    </Text>
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={isExpanded ? undefined : 2}>
                        {event.title}
                    </Text>
                    {locationDisplay && <Text style={styles.eventLocation}>📍 {locationDisplay}</Text>}
                  </View>
                  {isPersonal && (
                    <Pressable onPress={() => handleRemoveEvent(event.id)} style={styles.deleteBtn}>
                        <Trash2 size={18} color="#FF4444" />
                    </Pressable>
                  )}
                </View>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {desc && <Text style={styles.descText}>{desc}</Text>}
                    <View style={styles.actionRow}>
                        <Pressable style={styles.addCalBtn} onPress={() => handleAddToCalendar(event)}>
                            <Text style={styles.addCalText}>📅 Add to Calendar</Text>
                        </Pressable>
                    </View>
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}

        {dayEvents.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🍃</Text>
            <Text style={styles.emptyTitle}>Clear Schedule</Text>
            <Text style={styles.emptySubtitle}>No events found for {selectedDate}.</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Add Event Modal ── */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <Pressable onPress={() => setIsModalVisible(false)}><CloseIcon color="#FFF" size={24} /></Pressable>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Event name..." 
                placeholderTextColor="#666"
                value={newEvent.title}
                onChangeText={t => setNewEvent({...newEvent, title: t})}
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
                  onChangeText={t => setNewEvent({...newEvent, time: t})}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 2, marginLeft: 12 }]}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput 
                  style={styles.modalInput} 
                  placeholder="MSC, Room 101..." 
                  placeholderTextColor="#666"
                  value={newEvent.location}
                  onChangeText={t => setNewEvent({...newEvent, location: t})}
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
                onChangeText={t => setNewEvent({...newEvent, description: t})}
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

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#000',
  },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2, fontWeight: '600' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowRadius: 10, shadowOpacity: 0.4 },
  calendarContainer: { backgroundColor: '#000', paddingBottom: 10 },
  searchContainer: { paddingHorizontal: 20, paddingBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#222' },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF', marginLeft: 10 },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 15 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, padding: 12, backgroundColor: '#2A0808', borderRadius: 12, marginBottom: 4, borderWidth: 1, borderColor: '#3A1515' },
  errorText: { color: COLORS.danger, flex: 1, fontSize: 14 },
  retryBtn: { marginLeft: 12, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  dateHeader: { paddingVertical: 12 },
  dateHeaderText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  eventCard: { marginBottom: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  eventRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  timeBadge: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 65, alignItems: 'center' },
  timeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  eventLocation: { fontSize: 13, color: '#666', marginTop: 2 },
  deleteBtn: { padding: 8 },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#222' },
  descText: { fontSize: 14, color: '#AAA', lineHeight: 20, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  addCalBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addCalText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#555', marginTop: 4, textAlign: 'center' },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  inputGroup: { marginBottom: 16 },
  inputRow: { flexDirection: 'row' },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#FF8A8A', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  modalInput: { backgroundColor: '#000', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#222' },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});
