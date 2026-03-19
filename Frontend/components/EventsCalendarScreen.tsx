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
} from 'react-native';
import { COLORS, Card } from './SharedUI';

const TAMU_EVENTS_API = 'https://calendar.tamu.edu/live/json/events';

interface TAMUEvent {
  id: number;
  title: string;
  date: string;
  date_ts: number;
  date_iso: string;
  date2_ts: number | null;
  is_all_day: number | null;
  location: string | null;
  location_title: string | null;
  description: string | null;
  cost: string | null;
  url: string;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  tags: string[] | null;
  event_types: string[] | null;
  event_types_audience: string[] | null;
  group_title: string;
  is_canceled: number | null;
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
  const [events, setEvents] = useState<TAMUEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
    const groups: Record<string, TAMUEvent[]> = {};
    for (const e of filtered) {
      const dateKey = e.date || formatDateFromTS(e.date_ts);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    }
    return groups;
  }, [filtered]);

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
        <Text style={styles.title}>🗓 Campus Events</Text>
        <Text style={styles.subtitle}>
          {events.length} upcoming events at TAMU
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events, tags, locations…"
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
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
        {Object.entries(grouped).map(([dateKey, dateEvents]) => (
          <View key={dateKey}>
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>{dateKey}</Text>
              <Text style={styles.dateCount}>{dateEvents.length} event{dateEvents.length === 1 ? '' : 's'}</Text>
            </View>
            {dateEvents.map((event) => {
              const isExpanded = expandedId === event.id;
              const desc = event.description ? stripHtml(event.description) : null;
              const locationDisplay = event.location || event.location_title || null;

              return (
                <Pressable
                  key={event.id}
                  onPress={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  <Card style={styles.eventCard}>
                    <View style={styles.eventRow}>
                      <View style={styles.timeBadge}>
                        {event.is_all_day ? (
                          <Text style={styles.timeText}>All Day</Text>
                        ) : (
                          <Text style={styles.timeText}>{formatTimeFromTS(event.date_ts)}</Text>
                        )}
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle} numberOfLines={isExpanded ? undefined : 2}>
                          {event.title}
                        </Text>
                        {event.group_title ? (
                          <Text style={styles.groupLabel} numberOfLines={1}>{event.group_title}</Text>
                        ) : null}
                        {locationDisplay ? (
                          <Text style={styles.eventLocation} numberOfLines={1}>📍 {locationDisplay}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Tags */}
                    {event.tags && event.tags.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsRow} contentContainerStyle={styles.tagsContent}>
                        {event.tags.slice(0, 4).map((tag) => (
                          <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    )}

                    {/* Expanded section */}
                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        {desc ? (
                          <Text style={styles.descText} numberOfLines={6}>{desc}</Text>
                        ) : null}
                        {event.cost ? (
                          <Text style={styles.costText}>💰 {event.cost}</Text>
                        ) : null}
                        {event.event_types_audience && event.event_types_audience.length > 0 ? (
                          <Text style={styles.audienceText}>👥 {event.event_types_audience.join(', ')}</Text>
                        ) : null}
                        <View style={styles.actionRow}>
                          <Pressable
                            style={({ pressed }) => [styles.addCalBtn, pressed && { opacity: 0.8 }]}
                            onPress={() => handleAddToCalendar(event)}
                          >
                            <Text style={styles.addCalText}>📅 Add to Calendar</Text>
                          </Pressable>
                          {event.url ? (
                            <Pressable
                              style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.8 }]}
                              onPress={() => Linking.openURL(event.url)}
                            >
                              <Text style={styles.linkBtnText}>🔗 Details</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ))}

        {filtered.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No events found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? `Nothing matching "${searchQuery}"` : 'Check back later for upcoming events'}
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: COLORS.primary, borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 15 },
  searchContainer: { padding: 16, paddingBottom: 8 },
  searchInput: {
    height: 46, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 16,
    fontSize: 15, color: '#FFFFFF', borderWidth: 1, borderColor: '#2A2A2A',
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, padding: 12, backgroundColor: '#2A0808', borderRadius: 12, marginBottom: 4,
    borderWidth: 1, borderColor: '#3A1515',
  },
  errorText: { color: COLORS.danger, flex: 1, fontSize: 14 },
  retryBtn: { marginLeft: 12, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
  },
  dateHeaderText: { fontSize: 16, fontWeight: '800', color: '#FF8A8A', letterSpacing: -0.3 },
  dateCount: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  eventCard: { marginBottom: 10, padding: 14 },
  eventRow: { flexDirection: 'row', gap: 12 },
  timeBadge: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 10,
    paddingVertical: 7, alignSelf: 'flex-start', minWidth: 58, alignItems: 'center',
  },
  timeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  groupLabel: { fontSize: 12, color: '#FF8A8A', fontWeight: '600', marginBottom: 2 },
  eventLocation: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  tagsRow: { marginTop: 8, maxHeight: 28 },
  tagsContent: { gap: 6, flexDirection: 'row' },
  tag: {
    backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
  },
  tagText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  expandedSection: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E1E1E',
  },
  descText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 10 },
  costText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginBottom: 6 },
  audienceText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  addCalBtn: {
    flex: 1, backgroundColor: COLORS.primary, paddingVertical: 11,
    borderRadius: 12, alignItems: 'center',
  },
  addCalText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  linkBtn: {
    backgroundColor: '#1A1A1A', paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
  },
  linkBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
});
