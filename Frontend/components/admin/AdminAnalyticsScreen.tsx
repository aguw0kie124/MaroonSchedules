import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../SharedUI';
import { Button } from '../Button';
import { requestJson } from '../../api/client';
import { Users, Share2, MapPin, Star, Pencil, Trash2, MessageSquare, LogOut, ImagePlus } from 'lucide-react-native';
import { normalizeExternalUrl, normalizeImageUrl } from '../../services/url';
import { getAdminLocationSuggestions, resolveAdminEventLocation } from '../../services/adminEventLocation';
import { uploadMediaImage } from '../../services/socialFeedService';
import { useSessionStore } from '../../store/sessionStore';
import { TagSelector } from './TagSelector';
import { TagChips } from '../common/TagChips';

interface AdminEvent {
  id: string;
  title: string;
  description: string;
  location_name: string;
  google_review_url?: string | null;
  image_url?: string | null;
  lat?: number;
  lng?: number;
  start_time: string;
  end_time: string;
  shares_count: number;
  rsvp_count: number;
  created_at: string;
  avg_rating?: number;
  private_feedbacks?: { rating: number; feedback: string; created_at: string }[];
  access_tags?: string[];
}

interface EventDraft {
  title: string;
  description: string;
  location_name: string;
  google_review_url: string;
  image_url: string;
  start_time: Date;
  end_time: Date;
  access_tags: string[];
}

function buildDraft(event: AdminEvent): EventDraft {
  return {
    title: event.title || '',
    description: event.description || '',
    location_name: event.location_name || '',
    google_review_url: event.google_review_url || '',
    image_url: normalizeImageUrl(event.image_url) || '',
    start_time: new Date(event.start_time),
    end_time: new Date(event.end_time),
    access_tags: event.access_tags || [],
  };
}

export function AdminAnalyticsScreen() {
  const { COLORS, theme } = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const summary = useMemo(() => {
    const now = Date.now();
    return {
      totalEvents: events.length,
      upcomingEvents: events.filter((event) => new Date(event.end_time || event.start_time).getTime() >= now).length,
      totalRsvps: events.reduce((sum, event) => sum + (event.rsvp_count || 0), 0),
    };
  }, [events]);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await requestJson(`/admin/events/me?clerk_id=${encodeURIComponent(user.id)}`);
      setEvents(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Could not load events', 'Please try again in a moment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const fetchTagLibrary = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await requestJson(`/admin/tags?clerk_id=${encodeURIComponent(user.id)}`);
      setAvailableTags(data.tags || []);
    } catch (error) {
      console.error(error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEvents();
    fetchTagLibrary();
  }, [fetchEvents, fetchTagLibrary]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
      fetchTagLibrary();
    }, [fetchEvents, fetchTagLibrary]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const openEditor = (event: AdminEvent) => {
    setEditingEvent(event);
    setDraft(buildDraft(event));
  };

  const closeEditor = () => {
    setEditingEvent(null);
    setDraft(null);
    setSaving(false);
  };

  const updateDraft = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateDatePart = (nextValue: Date) => {
    if (!draft) return;
    const nextStart = new Date(draft.start_time);
    const nextEnd = new Date(draft.end_time);
    nextStart.setFullYear(nextValue.getFullYear(), nextValue.getMonth(), nextValue.getDate());
    nextEnd.setFullYear(nextValue.getFullYear(), nextValue.getMonth(), nextValue.getDate());
    setDraft({ ...draft, start_time: nextStart, end_time: nextEnd });
  };

  const updateStartTimePart = (nextValue: Date) => {
    if (!draft) return;
    const nextStart = new Date(draft.start_time);
    nextStart.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
    setDraft({ ...draft, start_time: nextStart });
  };

  const updateEndTimePart = (nextValue: Date) => {
    if (!draft) return;
    const nextEnd = new Date(draft.end_time);
    nextEnd.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
    setDraft({ ...draft, end_time: nextEnd });
  };

  const handlePickDraftImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos unavailable', 'Allow photo access to add an event image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.86,
      aspect: [4, 5],
    });

    if (result.canceled || !result.assets[0] || !draft) return;

    setUploadingImage(true);
    try {
      const uploaded = await uploadMediaImage(result.assets[0].uri);
      setDraft({ ...draft, image_url: uploaded });
    } catch (error) {
      console.error(error);
      Alert.alert('Upload failed', 'We could not upload that image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id || !editingEvent || !draft) return;
    if (!draft.title.trim()) {
      Alert.alert('Missing details', 'Add a title before saving.');
      return;
    }
    if (draft.end_time <= draft.start_time) {
      Alert.alert('Invalid time', 'End time must be after the start time.');
      return;
    }
    const resolvedLocation = resolveAdminEventLocation(draft.location_name);

    setSaving(true);
    try {
      await requestJson(`/admin/events/${editingEvent.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          clerk_id: user.id,
          title: draft.title.trim(),
          description: draft.description.trim(),
          lat: resolvedLocation.lat,
          lng: resolvedLocation.lng,
          location_name: resolvedLocation.location_name,
          start_time: draft.start_time.toISOString(),
          end_time: draft.end_time.toISOString(),
          google_review_url: normalizeExternalUrl(draft.google_review_url),
          image_url: draft.image_url || null,
          tags: draft.access_tags,
        }),
      });

      await Promise.all([fetchEvents(), fetchTagLibrary()]);
      closeEditor();
      Alert.alert('Event updated', 'Your featured event is live with the new details.');
    } catch (error) {
      console.error(error);
      Alert.alert('Update failed', 'We could not save your changes.');
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!user?.id) return;

    setDeletingEventId(eventId);
    try {
      await requestJson(`/admin/events/${eventId}?clerk_id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });

      setEvents((current) => current.filter((event) => event.id !== eventId));
      if (editingEvent?.id === eventId) {
        closeEditor();
      }
      Alert.alert('Event deleted', 'The event has been removed.');
    } catch (error) {
      console.error(error);
      Alert.alert('Delete failed', 'We could not delete that event.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const confirmDelete = (event: AdminEvent) => {
    Alert.alert(
      'Delete event?',
      `This will remove "${event.title}" from the featured feed and clear its RSVPs and reviews.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDelete(event.id),
        },
      ],
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      padding: 24,
      paddingTop: 28,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
    },
    headerCopy: {
      flex: 1,
    },
    eyebrow: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    subtitle: {
      marginTop: 4,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    signOutButton: {
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.background,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    signOutText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    summaryCard: {
      flex: 1,
      borderRadius: 16,
      padding: 14,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    summaryLabel: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    summaryValue: {
      color: COLORS.textPrimary,
      fontSize: 24,
      fontWeight: '800',
    },
    card: {
      backgroundColor: COLORS.surface,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    cardImage: {
      width: '100%',
      height: 168,
      borderRadius: 14,
      marginBottom: 14,
      backgroundColor: COLORS.background,
    },
    eventTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 8,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    locationText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginLeft: 6,
      flex: 1,
    },
    eventMeta: {
      color: COLORS.textSecondary,
      fontSize: 13,
      marginBottom: 14,
    },
    adminActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    adminActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      paddingVertical: 12,
      borderWidth: 1,
    },
    adminActionText: {
      fontSize: 14,
      fontWeight: '700',
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 16,
    },
    metric: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.background,
      padding: 12,
      borderRadius: 12,
      flex: 1,
      justifyContent: 'center',
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginLeft: 8,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: COLORS.textSecondary,
      fontSize: 16,
      textAlign: 'center',
    },
    feedbackSection: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 16,
    },
    feedbackTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textSecondary,
      marginBottom: 8,
    },
    feedbackItem: {
      backgroundColor: COLORS.background,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    feedbackStars: {
      flexDirection: 'row',
      gap: 2,
      marginBottom: 6,
    },
    feedbackText: {
      fontSize: 14,
      color: COLORS.textPrimary,
    },
    feedbackDate: {
      marginTop: 6,
      fontSize: 12,
      color: COLORS.textTertiary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      maxHeight: '90%',
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    modalTitle: {
      color: COLORS.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    modalSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 18,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginTop: 14,
      marginBottom: 6,
    },
    input: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      padding: 12,
      color: COLORS.textPrimary,
      fontSize: 16,
    },
    suggestionBox: {
      marginTop: 8,
      borderRadius: 14,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },
    suggestionItem: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    suggestionTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    suggestionMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    quickActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    quickActionChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    quickActionText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    imagePicker: {
      marginTop: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      padding: 14,
    },
    imagePickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    imagePickerCopy: {
      flex: 1,
    },
    imagePickerTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 4,
    },
    imagePickerMeta: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    imagePreview: {
      marginTop: 12,
      width: '100%',
      height: 220,
      borderRadius: 16,
      backgroundColor: COLORS.background,
    },
    textArea: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    pickerWrap: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      overflow: 'hidden',
      minHeight: Platform.OS === 'ios' ? undefined : 56,
    },
    pickerValueMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    pickerValue: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 8,
      backgroundColor: COLORS.background,
    },
    helperRow: {
      marginTop: 10,
      borderRadius: 12,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 12,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    helperText: {
      flex: 1,
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
  });

  const renderItem = ({ item }: { item: AdminEvent }) => (
    <View style={styles.card}>
      {normalizeImageUrl(item.image_url) ? (
        <Image source={{ uri: normalizeImageUrl(item.image_url)! }} style={styles.cardImage} resizeMode="cover" />
      ) : null}
      <Text style={styles.eventTitle}>{item.title}</Text>
      <View style={styles.locationRow}>
        <MapPin size={14} color={COLORS.textTertiary} />
        <Text style={styles.locationText}>{item.location_name}</Text>
      </View>
      <Text style={styles.eventMeta}>
        {new Date(item.start_time).toLocaleString()} to {new Date(item.end_time).toLocaleString()}
      </Text>
      <TagChips tags={item.access_tags} label="Audience tags" />

      <View style={styles.adminActionRow}>
        <Pressable
          style={[
            styles.adminActionButton,
            { backgroundColor: COLORS.background, borderColor: COLORS.border },
          ]}
          onPress={() => openEditor(item)}
        >
          <Pencil size={16} color={COLORS.textPrimary} />
          <Text style={[styles.adminActionText, { color: COLORS.textPrimary }]}>Edit</Text>
        </Pressable>
        <Pressable
          style={[
            styles.adminActionButton,
            { backgroundColor: '#FFF4EE', borderColor: '#FFD2BE' },
          ]}
          onPress={() => confirmDelete(item)}
          disabled={deletingEventId === item.id}
        >
          <Trash2 size={16} color="#C65A28" />
          <Text style={[styles.adminActionText, { color: '#C65A28' }]}>
            {deletingEventId === item.id ? 'Deleting...' : 'Delete'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Star size={18} color="#FFD700" fill="#FFD700" />
          <Text style={styles.metricValue}>{Number(item.avg_rating || 0).toFixed(1)}</Text>
        </View>
        <View style={styles.metric}>
          <Users size={18} color={COLORS.primary} />
          <Text style={styles.metricValue}>{item.rsvp_count} RSVP</Text>
        </View>
        <View style={styles.metric}>
          <Share2 size={18} color={COLORS.primary} />
          <Text style={styles.metricValue}>{item.shares_count}</Text>
        </View>
      </View>
      {item.private_feedbacks && item.private_feedbacks.length > 0 ? (
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackTitle}>Private Feedback</Text>
          {item.private_feedbacks.map((fb, idx) => (
            <View key={`${item.id}-${idx}`} style={styles.feedbackItem}>
              <View style={styles.feedbackStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={12}
                    fill={star <= fb.rating ? '#FFD700' : 'transparent'}
                    color={star <= fb.rating ? '#FFD700' : COLORS.textTertiary}
                  />
                ))}
              </View>
              <Text style={styles.feedbackText}>{fb.feedback || 'No comment provided.'}</Text>
              <Text style={styles.feedbackDate}>{new Date(fb.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Admin Portal</Text>
          <Text style={styles.title}>Manage Events</Text>
          <Text style={styles.subtitle}>Edit, monitor, and remove the events you've posted.</Text>
        </View>
        <Pressable
          style={styles.signOutButton}
          onPress={() => {
            resetSessionMode();
            signOut();
          }}
        >
          <LogOut size={16} color={COLORS.textPrimary} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Events</Text>
                <Text style={styles.summaryValue}>{summary.totalEvents}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Upcoming</Text>
                <Text style={styles.summaryValue}>{summary.upcomingEvents}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>RSVPs</Text>
                <Text style={styles.summaryValue}>{summary.totalRsvps}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>You haven’t posted any events yet.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!editingEvent && !!draft} animationType="slide" transparent onRequestClose={closeEditor}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Event</Text>
              <Button variant="secondary" onPress={closeEditor}>
                Close
              </Button>
            </View>

            {draft ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const locationSuggestions = getAdminLocationSuggestions(draft.location_name);
                  return (
                    <>
                <Text style={styles.modalSubtitle}>
                  Update your featured event details below. Changes apply immediately for students.
                </Text>

                <View style={styles.helperRow}>
                  <MessageSquare size={16} color={COLORS.primary} />
                  <Text style={styles.helperText}>
                    Students will still see both review choices after the event ends. Keep the public Google review link accurate so the handoff works cleanly.
                  </Text>
                </View>

                <Text style={styles.label}>Event Title</Text>
                <TextInput
                  style={styles.input}
                  value={draft.title}
                  onChangeText={(value) => updateDraft('title', value)}
                  placeholder="Event title"
                  placeholderTextColor={COLORS.textTertiary}
                />

                <Pressable style={styles.imagePicker} onPress={handlePickDraftImage} disabled={uploadingImage}>
                  <View style={styles.imagePickerRow}>
                    <View style={styles.imagePickerCopy}>
                      <Text style={styles.imagePickerTitle}>
                        {draft.image_url ? 'Change cover image' : 'Add cover image'}
                      </Text>
                      <Text style={styles.imagePickerMeta}>
                        {uploadingImage ? 'Uploading image...' : 'This image will appear on featured event cards for students.'}
                      </Text>
                    </View>
                    <ImagePlus size={18} color={COLORS.primary} />
                  </View>
                  {draft.image_url ? <Image source={{ uri: draft.image_url }} style={styles.imagePreview} resizeMode="cover" /> : null}
                </Pressable>

                <Text style={styles.label}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={draft.location_name}
                  onChangeText={(value) => updateDraft('location_name', value)}
                  placeholder="Campus place, custom address, or virtual"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <View style={styles.quickActionRow}>
                  <Pressable style={styles.quickActionChip} onPress={() => updateDraft('location_name', 'Zachry Engineering Center')}>
                    <Text style={styles.quickActionText}>Zachry</Text>
                  </Pressable>
                  <Pressable style={styles.quickActionChip} onPress={() => updateDraft('location_name', 'Memorial Student Center')}>
                    <Text style={styles.quickActionText}>MSC</Text>
                  </Pressable>
                  <Pressable style={styles.quickActionChip} onPress={() => updateDraft('location_name', 'Virtual')}>
                    <Text style={styles.quickActionText}>Virtual</Text>
                  </Pressable>
                </View>
                {locationSuggestions.length ? (
                  <View style={styles.suggestionBox}>
                    {locationSuggestions.map((item, index) => (
                      <Pressable
                        key={item.placeId || item.location}
                        style={[
                          styles.suggestionItem,
                          index === locationSuggestions.length - 1 ? { borderBottomWidth: 0 } : null,
                        ]}
                        onPress={() => updateDraft('location_name', item.location)}
                      >
                        <Text style={styles.suggestionTitle}>{item.location}</Text>
                        <Text style={styles.suggestionMeta}>{item.shortName || item.type}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={[styles.helperText, { marginTop: 6 }]}>
                  Off-map or virtual locations anchor to MSC so students still see a clean map pin and Pulse hotspot.
                </Text>

                <Text style={styles.label}>Google Review URL</Text>
                <TextInput
                  style={styles.input}
                  value={draft.google_review_url}
                  onChangeText={(value) => updateDraft('google_review_url', value)}
                  placeholder="https://g.page/r/.../review"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <TagSelector
                  label="Audience Tags"
                  helperText="Students with at least one matching user tag can see this event even when access filtering is on."
                  selectedTags={draft.access_tags}
                  availableTags={availableTags}
                  placeholder="Add audience tag"
                  onChange={(value) => updateDraft('access_tags', value)}
                />

                <Text style={styles.label}>Date</Text>
                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerValueMeta}>Selected date</Text>
                  <Text style={styles.pickerValue}>
                    {draft.start_time.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <DateTimePicker
                    value={draft.start_time}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
                    onChange={(_event: DateTimePickerEvent, selectedValue?: Date) => {
                      if (selectedValue) updateDatePart(selectedValue);
                    }}
                    minimumDate={today}
                    themeVariant={Platform.OS === 'ios' ? theme : undefined}
                    accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
                  />
                </View>

                <Text style={styles.label}>Start Time</Text>
                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerValueMeta}>Selected start time</Text>
                  <Text style={styles.pickerValue}>
                    {draft.start_time.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  <DateTimePicker
                    value={draft.start_time}
                    mode="time"
                    display="spinner"
                    onChange={(_event: DateTimePickerEvent, selectedValue?: Date) => {
                      if (selectedValue) updateStartTimePart(selectedValue);
                    }}
                    is24Hour={false}
                    themeVariant={Platform.OS === 'ios' ? theme : undefined}
                    textColor={Platform.OS === 'ios' ? COLORS.textPrimary : undefined}
                    accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
                  />
                </View>

                <Text style={styles.label}>End Time</Text>
                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerValueMeta}>Selected end time</Text>
                  <Text style={styles.pickerValue}>
                    {draft.end_time.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  <DateTimePicker
                    value={draft.end_time}
                    mode="time"
                    display="spinner"
                    onChange={(_event: DateTimePickerEvent, selectedValue?: Date) => {
                      if (selectedValue) updateEndTimePart(selectedValue);
                    }}
                    is24Hour={false}
                    themeVariant={Platform.OS === 'ios' ? theme : undefined}
                    textColor={Platform.OS === 'ios' ? COLORS.textPrimary : undefined}
                    accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
                  />
                </View>

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={draft.description}
                  onChangeText={(value) => updateDraft('description', value)}
                  placeholder="What should students know?"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                />

                <View style={{ marginTop: 24, gap: 12, marginBottom: 20 }}>
                  <Button onPress={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => editingEvent && confirmDelete(editingEvent)}
                    disabled={!!deletingEventId}
                  >
                    Delete Event
                  </Button>
                </View>
                    </>
                  );
                })()}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
