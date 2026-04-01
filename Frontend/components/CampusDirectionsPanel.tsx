import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { Bus, MapPin, Navigation, Volume2, VolumeX, X as XIcon } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { DirectionStep } from '../services/campusDirections';
import { stopSpeech } from '../services/campusTTS';

interface CampusDirectionsPanelProps {
  destinationName: string;
  distanceLabel: string;
  etaLabel: string;
  steps: DirectionStep[];
  modeLabel: string;
  routeNote?: string | null;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onEnd: () => void;
}

export function CampusDirectionsPanel({
  destinationName,
  distanceLabel,
  etaLabel,
  steps,
  modeLabel,
  routeNote,
  voiceEnabled,
  onToggleVoice,
  onEnd,
}: CampusDirectionsPanelProps) {
    const { COLORS, theme } = useTheme();
    const styles = getStyles(COLORS, theme === 'dark');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleEnd = async () => {
    await stopSpeech();
    onEnd();
  };

  const renderStepIcon = (iconLabel: string) => {
    if (iconLabel === '🚌') return <Bus size={16} color="#FFFFFF" />;
    if (iconLabel === '📍') return <MapPin size={16} color="#FFFFFF" />;
    return <Navigation size={16} color="#FFFFFF" />;
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.handleBar} />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {modeLabel} to {destinationName}
          </Text>
          <Text style={styles.headerSub}>
            {distanceLabel} • {etaLabel}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>{modeLabel}</Text>
          </View>
          {routeNote ? (
            <Text style={styles.routeNote} numberOfLines={2}>
              {routeNote}
            </Text>
          ) : null}
        </View>
        <View style={styles.metaActions}>
          <Pressable
            style={({ pressed }) => [styles.voiceBtn, pressed && styles.voiceBtnPressed]}
            onPress={onToggleVoice}
          >
            {voiceEnabled ? <Volume2 color={COLORS.primary} size={16} /> : <VolumeX color={COLORS.textSecondary} size={16} />}
            <Text style={[styles.voiceBtnText, !voiceEnabled && styles.voiceBtnTextMuted]}>
              {voiceEnabled ? 'Voice On' : 'Voice Off'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]}
            onPress={handleEnd}
          >
            <XIcon color="#FFF" size={16} />
            <Text style={styles.endBtnText}>End</Text>
          </Pressable>
        </View>
      </View>

      {/* Steps */}
      <ScrollView
        style={styles.stepsList}
        contentContainerStyle={styles.stepsContent}
        showsVerticalScrollIndicator={false}
      >
        {steps.map((step, idx) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
              {renderStepIcon(step.icon)}
              {idx < steps.length - 1 && <View style={styles.stepLine} />}
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepInstruction}>{step.instruction}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(8,8,8,0.96)' : 'rgba(255,255,255,0.98)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.28 : 0.10,
    shadowRadius: 24,
    elevation: 14,
  },
  handleBar: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(12,12,14,0.14)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
  },
  metaLeft: {
    flex: 1,
    gap: 8,
    paddingRight: 6,
  },
  metaActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(0,0,0,0.42)' : 'rgba(12,12,14,0.05)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(12,12,14,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  routeNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(0,0,0,0.42)' : 'rgba(12,12,14,0.05)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(12,12,14,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voiceBtnPressed: {
    opacity: 0.8,
  },
  voiceBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  voiceBtnTextMuted: {
    color: COLORS.textSecondary,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  endBtnPressed: {
    opacity: 0.8,
  },
  endBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  stepsList: {
    flex: 1,
  },
  stepsContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  stepIconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 36,
    marginRight: 12,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    minHeight: 20,
  },
  stepBody: {
    flex: 1,
    paddingBottom: 20,
  },
  stepInstruction: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
});
