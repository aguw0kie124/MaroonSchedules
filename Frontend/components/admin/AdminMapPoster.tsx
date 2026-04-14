import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TextInput, ScrollView, Alert, Platform, Image, Linking } from 'react-native';
import { Pressable } from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../SharedUI';
import { Button } from '../Button';
import { API_URL } from '../../config';
import { requestJson } from '../../api/client';
import { normalizeExternalUrl } from '../../services/url';
import { getAdminLocationSuggestions, resolveAdminEventLocation } from '../../services/adminEventLocation';
import { LogOut, PlusCircle, ImagePlus, Sparkles, MapPinned } from 'lucide-react-native';
import { uploadMediaImage } from '../../services/socialFeedService';
import { useSessionStore } from '../../store/sessionStore';
import { TagSelector } from './TagSelector';
import { TagChips } from '../common/TagChips';

function roundToNearestFiveMinutes(value: Date) {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const roundedMinutes = Math.round(next.getMinutes() / 5) * 5;
  next.setMinutes(roundedMinutes);
  return next;
}

export function AdminMapPoster() {
  const { COLORS, theme } = useTheme();
  const { user } = useUser();
  const { signOut } = useAuth();
  const resetSessionMode = useSessionStore((state) => state.resetSessionMode);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [postKind, setPostKind] = useState<'event' | 'ping'>('event');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(() => roundToNearestFiveMinutes(new Date()));
  const [endTime, setEndTime] = useState(() => {
    const initialStart = roundToNearestFiveMinutes(new Date());
    return new Date(initialStart.getTime() + 2 * 60 * 60 * 1000);
  });
  const [loading, setLoading] = useState(false);
  const locationSuggestions = getAdminLocationSuggestions(address);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (!user?.id) return;
    requestJson(`/admin/tags?clerk_id=${encodeURIComponent(user.id)}`, {}, 15000)
      .then((data) => setAvailableTags(data.tags || []))
      .catch((error) => console.error('Failed to load tag suggestions', error));
  }, [user?.id]);

  const updateDatePart = (nextValue: Date) => {
    const year = nextValue.getFullYear();
    const month = nextValue.getMonth();
    const date = nextValue.getDate();

    setStartTime((current) => {
      const next = new Date(current);
      next.setFullYear(year, month, date);
      return next;
    });

    setEndTime((current) => {
      const next = new Date(current);
      next.setFullYear(year, month, date);
      return next;
    });
  };

  const updateStartTimePart = (nextValue: Date) => {
    setStartTime((current) => {
      const next = new Date(current);
      next.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
      return next;
    });
  };

  const updateEndTimePart = (nextValue: Date) => {
    setEndTime((current) => {
      const next = new Date(current);
      next.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
      return next;
    });
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (!selectedValue) return;
    updateDatePart(selectedValue);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (!selectedValue) return;
    updateStartTimePart(selectedValue);
  };

  const handleEndTimeChange = (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (!selectedValue) return;
    updateEndTimePart(selectedValue);
  };

  const handlePickImage = async () => {
    const existingPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    const permission =
      existingPermission.granted || !existingPermission.canAskAgain
        ? existingPermission
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      if (permission.canAskAgain) {
        Alert.alert('Photos unavailable', 'Allow photo access to add an event image.');
      } else {
        Alert.alert(
          'Photos unavailable',
          'Photo access is turned off for MaroonLife. Open Settings to allow event image uploads.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings().catch((settingsError) => {
                  console.warn('Failed to open settings for image access', settingsError);
                });
              },
            },
          ],
        );
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.86,
      aspect: [4, 5],
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Incomplete', `Please provide a ${postKind} title.`);
      return;
    }
    if (!address.trim()) {
      Alert.alert('Location Required', 'Please provide a campus building, room, or general location.');
      return;
    }

    setLoading(true);
    try {
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Invalid date or time format');
      }
      if (endTime <= startTime) {
        throw new Error('End time must be after the start time');
      }
      const normalizedReviewUrl = normalizeExternalUrl(googleReviewUrl);
      const resolvedLocation = resolveAdminEventLocation(address);
      const uploadedImageUrl = imageUri ? await uploadMediaImage(imageUri) : null;

      if (postKind === 'event') {
        await requestJson('/admin/events', {
          method: 'POST',
          body: JSON.stringify({
            clerk_id: user?.id,
            title: title.trim(),
            description: description.trim(),
            lat: resolvedLocation.lat,
            lng: resolvedLocation.lng,
            location_name: resolvedLocation.location_name,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            google_review_url: normalizedReviewUrl,
            image_url: uploadedImageUrl,
            tags: selectedTags,
          }),
        }, 30000);
      } else {
        await requestJson('/chat/feeds/proxy/flat/campus_pings', {
          method: 'POST',
          body: JSON.stringify({
            activity: {
              actor: `SU:${user?.id}`,
              verb: 'ping',
              object: `admin-ping:${Date.now()}`,
              text: description.trim(),
              attachments: uploadedImageUrl
                ? [
                    {
                      type: 'image',
                      image_url: uploadedImageUrl,
                    },
                  ]
                : [],
              custom: {
                user_name: user?.fullName || user?.firstName || 'Campus organizer',
                user_image: user?.imageUrl || '',
                ping_title: title.trim(),
                ping_category: 'Popup',
                location_tag: resolvedLocation.location_name,
                place_lat: resolvedLocation.lat,
                place_lng: resolvedLocation.lng,
                start_at: startTime.toISOString(),
                end_at: endTime.toISOString(),
                content_type: 'ping',
                access_tags: selectedTags,
                is_anonymous: false,
              },
            },
          }),
        }, 30000);
      }

      Alert.alert('Success', postKind === 'event' ? 'Event posted to the featured tab!' : 'Ping posted to Pulse.');
      
      // Invalidate events to force immediate refresh when navigating back
      queryClient.invalidateQueries({ queryKey: ['campus-events'] });
      
      setTitle('');
      setDescription('');
      setAddress('');
      setGoogleReviewUrl('');
      setImageUri(null);
      setSelectedTags([]);
      const nextStart = roundToNearestFiveMinutes(new Date());
      setStartTime(nextStart);
      setEndTime(new Date(nextStart.getTime() + 2 * 60 * 60 * 1000));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create event.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background
    },
    formContainer: {
      flex: 1,
      padding: 24,
      paddingTop: 28
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 20,
    },
    topBarCopy: {
      flex: 1,
    },
    topEyebrow: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    subtitle: {
      marginTop: 6,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    signOutButton: {
      minHeight: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
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
    heroCard: {
      marginBottom: 14,
      minHeight: 196,
      borderRadius: 26,
      overflow: 'hidden',
      backgroundColor: '#7C2D12',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    heroImage: {
      ...StyleSheet.absoluteFillObject,
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(28,18,12,0.38)',
    },
    heroContent: {
      flex: 1,
      justifyContent: 'space-between',
      padding: 18,
    },
    heroEyebrow: {
      color: 'rgba(255,255,255,0.84)',
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    heroHeadline: {
      color: '#FFFFFF',
      fontSize: 28,
      lineHeight: 31,
      fontWeight: '800',
      maxWidth: '82%',
    },
    heroBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    heroBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    typeToggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    typeTogglePill: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    typeTogglePillActive: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary + '12',
    },
    typeToggleLabel: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '800',
    },
    typeToggleLabelActive: {
      color: COLORS.primary,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textPrimary,
      marginTop: 16,
      marginBottom: 6
    },
    helperCard: {
      marginTop: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    helperTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    helperText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 19,
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
      marginTop: 8,
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
    pickerWrap: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      overflow: 'hidden',
      minHeight: Platform.OS === 'ios' ? undefined : 56,
    },
    picker: {
      alignSelf: Platform.OS === 'ios' ? 'flex-start' : 'stretch',
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
    textArea: {
      height: 100,
      textAlignVertical: 'top'
    }
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.topBar}>
          <View style={styles.topBarCopy}>
            <Text style={styles.topEyebrow}>Admin Portal</Text>
            <Text style={styles.title}>{postKind === 'event' ? 'Post New Event' : 'Post New Ping'}</Text>
            <Text style={styles.subtitle}>
              {postKind === 'event'
                ? 'Create a featured event and set up the student review flow in one place.'
                : 'Publish a Pulse pin with optional audience tags so only the right members see it.'}
            </Text>
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

        <View style={styles.typeToggleRow}>
          {[
            { id: 'event', label: 'Event' },
            { id: 'ping', label: 'Ping' },
          ].map((option) => {
            const active = postKind === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.typeTogglePill, active && styles.typeTogglePillActive]}
                onPress={() => setPostKind(option.id as 'event' | 'ping')}
              >
                <Text style={[styles.typeToggleLabel, active && styles.typeToggleLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.heroCard}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.heroImage} resizeMode="cover" /> : null}
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View>
              <Text style={styles.heroEyebrow}>{postKind === 'event' ? 'Featured Event Studio' : 'Pulse Studio'}</Text>
              <Text style={styles.heroHeadline}>
                {title.trim() ||
                  (postKind === 'event'
                    ? 'Make your next event impossible to ignore.'
                    : 'Drop a members-only pulse exactly where it matters.')}
              </Text>
              <View style={{ marginTop: 12 }}>
                <TagChips tags={selectedTags} />
              </View>
            </View>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Sparkles size={14} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>{postKind === 'event' ? 'Discover ready' : 'Pulse ready'}</Text>
              </View>
              <View style={styles.heroBadge}>
                <MapPinned size={14} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>
                  {selectedTags.length ? 'Audience filtered' : 'Campus visible'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.helperCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <PlusCircle size={16} color={COLORS.primary} />
            <Text style={styles.helperTitle}>
              {postKind === 'event' ? 'Student review flow' : 'Audience targeting'}
            </Text>
          </View>
          <Text style={styles.helperText}>
            {postKind === 'event'
              ? 'Students get an in-app survey after the event ends, with both public and private review options still visible.'
              : 'Add audience tags to make this ping exclusive to matching users and club members.'}
          </Text>
        </View>
        
        <Text style={styles.label}>{postKind === 'event' ? 'Event Title' : 'Ping Title'}</Text>
        <TextInput 
          style={styles.input} 
          placeholder={postKind === 'event' ? 'e.g. Free Pizza at Rudder' : 'e.g. Officers meeting moved upstairs'} 
          placeholderTextColor={COLORS.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>{postKind === 'event' ? 'Event Image (Optional)' : 'Ping Image (Optional)'}</Text>
        <Pressable style={styles.imagePicker} onPress={handlePickImage}>
          <View style={styles.imagePickerRow}>
            <View style={styles.imagePickerCopy}>
              <Text style={styles.imagePickerTitle}>{imageUri ? 'Change cover image' : 'Add cover image'}</Text>
              <Text style={styles.imagePickerMeta}>
                {postKind === 'event'
                  ? 'Use a strong photo so the featured card feels polished in Discover.'
                  : 'Add a flyer or snapshot so the pulse pin is easy to recognize.'}
              </Text>
            </View>
            <ImagePlus size={18} color={COLORS.primary} />
          </View>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" /> : null}
        </Pressable>

        <Text style={styles.label}>Location / Address</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Campus place, custom address, or virtual"
          placeholderTextColor={COLORS.textTertiary}
          value={address}
          onChangeText={setAddress}
        />
        <View style={styles.quickActionRow}>
          <Pressable style={styles.quickActionChip} onPress={() => setAddress('Zachry Engineering Center')}>
            <Text style={styles.quickActionText}>Zachry</Text>
          </Pressable>
          <Pressable style={styles.quickActionChip} onPress={() => setAddress('Memorial Student Center')}>
            <Text style={styles.quickActionText}>MSC</Text>
          </Pressable>
          <Pressable style={styles.quickActionChip} onPress={() => setAddress('Virtual')}>
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
                onPress={() => setAddress(item.location)}
              >
                <Text style={styles.suggestionTitle}>{item.location}</Text>
                <Text style={styles.suggestionMeta}>{item.shortName || item.type}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={[styles.helperText, { marginTop: 6 }]}>
          Choose a campus place for map linking. Off-map or virtual posts anchor to MSC so they still appear in Places and Pulse.
        </Text>

        {postKind === 'event' ? (
          <>
            <Text style={styles.label}>Google Review URL (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://g.page/r/.../review"
              placeholderTextColor={COLORS.textTertiary}
              value={googleReviewUrl}
              onChangeText={setGoogleReviewUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={[styles.helperText, { marginTop: 6 }]}>
              Paste the full review URL. If you leave off `https://`, we’ll add it automatically.
            </Text>
          </>
        ) : null}

        <TagSelector
          label="Audience Tags"
          helperText={
            postKind === 'event'
              ? 'Students with matching user tags will see this event alongside public campus events.'
              : 'Students with matching user tags will see this ping on Pulse and in the feed.'
          }
          selectedTags={selectedTags}
          availableTags={availableTags}
          placeholder="Add audience tag"
          onChange={setSelectedTags}
        />

        <Text style={styles.label}>Date</Text>
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerValueMeta}>Selected date</Text>
          <Text style={styles.pickerValue}>
            {startTime.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <DateTimePicker
            value={startTime}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
            onChange={handleDateChange}
            minimumDate={today}
            themeVariant={Platform.OS === 'ios' ? theme : undefined}
            accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
            style={styles.picker}
          />
        </View>

        <Text style={styles.label}>Start Time</Text>
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerValueMeta}>Selected start time</Text>
          <Text style={styles.pickerValue}>
            {startTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
          <DateTimePicker
            value={startTime}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
            is24Hour={false}
            themeVariant={Platform.OS === 'ios' ? theme : undefined}
            textColor={Platform.OS === 'ios' ? COLORS.textPrimary : undefined}
            accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
            style={styles.picker}
          />
        </View>

        <Text style={styles.label}>End Time</Text>
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerValueMeta}>Selected end time</Text>
          <Text style={styles.pickerValue}>
            {endTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
          <DateTimePicker
            value={endTime}
            mode="time"
            display="spinner"
            onChange={handleEndTimeChange}
            is24Hour={false}
            themeVariant={Platform.OS === 'ios' ? theme : undefined}
            textColor={Platform.OS === 'ios' ? COLORS.textPrimary : undefined}
            accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
            style={styles.picker}
          />
        </View>

        <Text style={styles.label}>{postKind === 'event' ? 'Description' : 'What is happening?'}</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder={postKind === 'event' ? 'Stop by for free pizza!' : 'Share the important details people should know.'} 
          placeholderTextColor={COLORS.textTertiary}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <View style={{ marginTop: 32, marginBottom: 60 }}>
          <Button onPress={handleSubmit}>
            {loading ? "Posting..." : postKind === 'event' ? "Post Event" : "Post Ping"}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
