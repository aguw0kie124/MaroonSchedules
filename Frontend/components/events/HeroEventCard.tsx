import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Image } from 'react-native';
import { BadgeCheck, Calendar as CalendarIcon, MapPin, Map as MapIcon, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TAMUEvent, CATEGORY_META, classifyCategory, formatDate, formatTime } from './EventUtils';
import { resolveEventImage } from './EventImages';
import { useTheme } from '../SharedUI';
import { triggerNativeShare } from '../../utils/share';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  heroCard: {
    width: SCREEN_WIDTH - 52,
    height: 360,
    borderRadius: 34,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'space-between',
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
    bottom: 135,
    opacity: 0.55,
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
    gap: 12,
    paddingTop: 10,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.0,
    maxWidth: '92%',
    marginBottom: 4,
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
    marginTop: 14,
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
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  rsvpButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  rsvpButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  shareCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});

export function HeroEventCard({
  event,
  scheduled,
  onSchedule,
  onPress,
  onMap,
}: {
  event: TAMUEvent;
  scheduled: boolean;
  onSchedule: () => void;
  onPress: () => void;
  onMap: () => void;
}) {
  const { COLORS } = useTheme();
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  const handleSchedule = (e: any) => {
    e.stopPropagation();
    onSchedule();
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.heroCard, { backgroundColor: meta.cardTint }]}
    >
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={resolveEventImage(event)}
          style={[StyleSheet.absoluteFill, { borderRadius: 34 }]}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={[StyleSheet.absoluteFill, { borderRadius: 34 }]}
        />
      </View>
      <View style={styles.heroIconHalo}>
        <Icon size={88} color="rgba(255,255,255,0.18)" />
      </View>

      <View style={styles.heroTopRow}>
        <View style={styles.heroCategoryPill}>
          <Text style={styles.heroCategoryText}>{category}</Text>
        </View>
        {event.group_title ? (
          <View style={styles.verifiedPill}>
            <BadgeCheck size={14} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.heroBottom}>
        <Text style={styles.heroTitle} numberOfLines={3} ellipsizeMode="tail">{event.title}</Text>
        <View style={styles.heroMetaRow}>
          <CalendarIcon size={17} color="#FFFFFF" />
          <Text style={styles.heroMetaText}>
            {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
          </Text>
        </View>
        {event.location ? (
          <View style={styles.heroMetaRow}>
            <MapPin size={17} color="#FFFFFF" />
            <Text style={styles.heroMetaText} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}
        <View style={styles.heroActionRow}>
          {event.location_lat != null && event.location_lng != null ? (
            <Pressable style={styles.heroMapButton} onPress={onMap}>
              <MapIcon size={15} color={COLORS.textPrimary} />
              <Text style={[styles.heroMapButtonText, { color: COLORS.textPrimary }]}>
                Map
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.rsvpButton, scheduled && styles.rsvpButtonActive]}
            onPress={handleSchedule}
          >
            <CalendarIcon size={15} color={scheduled ? '#FFFFFF' : COLORS.textPrimary} />
            <Text style={[styles.rsvpButtonText, { color: scheduled ? '#FFFFFF' : COLORS.textPrimary }]}>
              {scheduled ? 'RSVPed' : 'RSVP'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
