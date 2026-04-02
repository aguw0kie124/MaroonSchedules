import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { BadgeCheck, Calendar as CalendarIcon, MapPin, Map } from 'lucide-react-native';
import { TAMUEvent, CATEGORY_META, classifyCategory, formatDate, formatTime } from './EventUtils';
import { useTheme } from '../SharedUI';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  heroCard: {
    width: SCREEN_WIDTH - 52,
    height: 372,
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
    bottom: 118,
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
});

export function HeroEventCard({
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
      style={[styles.heroCard, { backgroundColor: meta.cardTint }]}
    >
      <View style={[styles.heroGlow, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
      <View style={[styles.heroGlowSmall, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <View style={styles.heroIconHalo}>
        <Icon size={88} color="rgba(255,255,255,0.12)" />
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
        <Text style={styles.heroTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.heroMetaRow}>
          <CalendarIcon size={17} color="#FFFFFF" />
          <Text style={styles.heroMetaText}>
            {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
          </Text>
        </View>
        <View style={styles.heroMetaRow}>
          <MapPin size={17} color="#FFFFFF" />
          <Text style={styles.heroMetaText} numberOfLines={1}>{event.location || 'Campus'}</Text>
        </View>
        {event.location_lat != null && event.location_lng != null ? (
          <Pressable style={styles.heroMapButton} onPress={onMap}>
            <Map size={15} color={COLORS.textPrimary} />
            <Text style={[styles.heroMapButtonText, { color: COLORS.textPrimary }]}>
              Open in Places
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
