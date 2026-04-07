import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Calendar as CalendarIcon, MapPin, BadgeCheck, Heart, Share2, Map } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TAMUEvent, CATEGORY_META, classifyCategory, formatDate, formatTime, stripHtml, handleGoogleCalendar, openNativeMaps } from './EventUtils';
import { useTheme } from '../SharedUI';
import { TagChips } from '../common/TagChips';

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  detailSheet: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    maxHeight: '84%',
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

export function EventDetailModal({
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

  if (!event) return null;

  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)} 
      style={[StyleSheet.absoluteFill, { zIndex: 9900 }]}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.detailSheet,
            { backgroundColor: COLORS.surface, borderColor: COLORS.border },
          ]}
          onPress={() => {}}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeader}>
              <View
                style={[
                  styles.detailCategoryPill,
                  { backgroundColor: CATEGORY_META[classifyCategory(event)].chipBg },
                ]}
              >
                <Text
                  style={[
                    styles.detailCategoryText,
                    { color: CATEGORY_META[classifyCategory(event)].chipText },
                  ]}
                >
                  {classifyCategory(event)}
                </Text>
              </View>
              <Pressable onPress={() => onSaveToggle(event)} style={styles.detailSaveButton}>
                <Heart size={18} color={saved ? '#FF4D6D' : COLORS.textSecondary} fill={saved ? '#FF4D6D' : 'none'} />
              </Pressable>
            </View>

            <Text style={[styles.detailTitle, { color: COLORS.textPrimary }]}>{event.title}</Text>

            <View style={styles.detailMetaBlock}>
              <View style={styles.detailMetaRow}>
                <CalendarIcon size={15} color={COLORS.textSecondary} />
                <Text style={[styles.detailMetaText, { color: COLORS.textSecondary }]}>
                  {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
                </Text>
              </View>
              <View style={styles.detailMetaRow}>
                <MapPin size={15} color={COLORS.textSecondary} />
                <Text style={[styles.detailMetaText, { color: COLORS.textSecondary }]}>
                  {event.location || 'Campus'}
                </Text>
              </View>
              {event.group_title ? (
                <View style={styles.detailMetaRow}>
                  <BadgeCheck size={15} color="#2F80ED" />
                  <Text style={[styles.detailMetaText, { color: COLORS.textSecondary }]}>
                    {event.group_title}
                  </Text>
                </View>
              ) : null}
            </View>

            {event.description ? (
              <Text style={[styles.detailDescription, { color: COLORS.textSecondary }]}>
                {stripHtml(event.description)}
              </Text>
            ) : null}
            <TagChips tags={event.access_tags} label="Audience tags" />

            <Pressable
              style={[styles.primaryDetailButton, { backgroundColor: COLORS.primary }]}
              onPress={() => {
                onSchedule(event);
                handleGoogleCalendar(event);
              }}
            >
              <CalendarIcon size={18} color="#FFFFFF" />
              <Text style={styles.primaryDetailButtonText}>Add to calendar</Text>
            </Pressable>

            {event.is_admin_event ? (
              <Pressable
                style={[
                  styles.primaryDetailButton,
                  { backgroundColor: '#2F80ED', marginTop: 12 },
                ]}
                onPress={() => {
                  onSchedule(event);
                }}
              >
                <BadgeCheck size={18} color="#FFFFFF" />
                <Text style={styles.primaryDetailButtonText}>
                  {scheduled ? 'RSVP Saved' : 'RSVP to Featured Event'}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.detailActionRow}>
              <Pressable
                style={[
                  styles.secondaryDetailButton,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                  },
                ]}
                onPress={() => onShare(event)}
              >
                <Share2 size={18} color={COLORS.textPrimary} />
                <Text style={[styles.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                  Share
                </Text>
              </Pressable>
              {event.location_lat != null && event.location_lng != null ? (
                <Pressable
                  style={[
                    styles.secondaryDetailButton,
                    {
                      borderColor: COLORS.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                    },
                  ]}
                  onPress={() => onMap(event)}
                >
                  <Map size={18} color={COLORS.textPrimary} />
                  <Text style={[styles.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                    Places
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[
                    styles.secondaryDetailButton,
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
                  <Text style={[styles.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                    Map
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
