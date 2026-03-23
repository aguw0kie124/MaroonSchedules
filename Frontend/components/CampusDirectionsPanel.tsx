import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { Volume2, X as XIcon } from 'lucide-react-native';
import { useTheme } from './SharedUI';
import { DirectionStep } from '../services/campusDirections';
import { speakStep, stopSpeech } from '../services/campusTTS';

interface CampusDirectionsPanelProps {
  destinationName: string;
  distanceLabel: string;
  etaLabel: string;
  steps: DirectionStep[];
  onEnd: () => void;
}

export function CampusDirectionsPanel({
  destinationName,
  distanceLabel,
  etaLabel,
  steps,
  onEnd,
}: CampusDirectionsPanelProps) {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSpeak = async (instruction: string) => {
    await speakStep(instruction);
  };

  const handleEnd = async () => {
    await stopSpeech();
    onEnd();
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Directions to {destinationName}
          </Text>
          <Text style={styles.headerSub}>
            {distanceLabel} • {etaLabel}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]}
          onPress={handleEnd}
        >
          <XIcon color="#FFF" size={16} />
          <Text style={styles.endBtnText}>End</Text>
        </Pressable>
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
              <Text style={styles.stepIcon}>{step.icon}</Text>
              {idx < steps.length - 1 && <View style={styles.stepLine} />}
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepInstruction}>{step.instruction}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.speakBtn, pressed && styles.speakBtnPressed]}
              onPress={() => handleSpeak(step.instruction)}
            >
              <Volume2 color={COLORS.primary} size={16} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
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
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
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
    width: 36,
    marginRight: 12,
  },
  stepIcon: {
    fontSize: 20,
    marginBottom: 4,
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
  speakBtn: {
    padding: 8,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  speakBtnPressed: {
    opacity: 0.6,
  },
});
