import React from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Clock3, Pause, Play, RotateCcw } from 'lucide-react-native';

import { Card, useTheme } from './SharedUI';

const FOCUS_DURATIONS = [5, 10, 25, 60] as const;

export function TimerScreen() {
  const { COLORS, theme, useWallpaper, wallpaperUri } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const [selectedDuration, setSelectedDuration] = React.useState<number | 'custom'>(25);
  const [selectedMinutes, setSelectedMinutes] = React.useState(25);
  const [secondsLeft, setSecondsLeft] = React.useState(25 * 60);
  const [isRunning, setIsRunning] = React.useState(false);
  const [customMinutes, setCustomMinutes] = React.useState('');

  React.useEffect(() => {
    if (isRunning && secondsLeft <= 0) {
      setIsRunning(false);
      setSecondsLeft(selectedMinutes * 60);
      return;
    }

    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, secondsLeft, selectedMinutes]);

  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : isDark
      ? require('../assets/black_marble.jpg')
      : require('../assets/white_marble.jpg');

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const applyDuration = (minutesValue: number, preset: number | 'custom') => {
    setSelectedDuration(preset);
    setSelectedMinutes(minutesValue);
    if (!isRunning) {
      setSecondsLeft(minutesValue * 60);
    }
  };

  const applyCustomDuration = () => {
    const parsed = Number(customMinutes);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    const minutesValue = Math.min(180, Math.max(1, Math.round(parsed)));
    applyDuration(minutesValue, 'custom');
    setCustomMinutes(String(minutesValue));
  };

  return (
    <View style={styles.container}>
      {useWallpaper ? (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.18)' },
            ]}
          />
        </ImageBackground>
      ) : null}

      <View style={styles.content}>
        <Card style={styles.timerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Pomodoro</Text>
            <Clock3 size={22} color={COLORS.primary} />
          </View>

          <View style={styles.timerCenter}>
            <Text style={styles.timerValue}>{formattedTime}</Text>
          </View>

          <View style={styles.durationRow}>
            {FOCUS_DURATIONS.map((duration) => {
              const selected = selectedDuration === duration;
              return (
                <Pressable
                  key={duration}
                  style={[styles.durationButton, styles.durationButtonPreset, selected && styles.durationButtonActive]}
                  onPress={() => applyDuration(duration, duration)}
                >
                  <Text style={[styles.durationText, selected && styles.durationTextActive]}>
                    {duration}m
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.durationButton, styles.durationButtonCustom, selectedDuration === 'custom' && styles.durationButtonActive]}
              onPress={() => setSelectedDuration('custom')}
            >
              <Text style={[styles.durationText, selectedDuration === 'custom' && styles.durationTextActive]}>
                Custom
              </Text>
            </Pressable>
          </View>

          {selectedDuration === 'custom' ? (
            <View style={styles.customRow}>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                placeholder="Minutes"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="number-pad"
                style={styles.customInput}
              />
              <Pressable style={styles.customApplyButton} onPress={applyCustomDuration}>
                <Text style={styles.customApplyText}>Apply</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryAction} onPress={() => setIsRunning((current) => !current)}>
              {isRunning ? <Pause size={16} color="#FFFFFF" /> : <Play size={16} color="#FFFFFF" />}
              <Text style={styles.primaryActionText}>{isRunning ? 'Pause' : 'Start'}</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryAction}
              onPress={() => {
                setIsRunning(false);
                setSecondsLeft(selectedMinutes * 60);
              }}
            >
              <RotateCcw size={16} color={COLORS.textPrimary} />
              <Text style={styles.secondaryActionText}>Reset</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      flex: 1,
      paddingTop: 54,
      paddingHorizontal: 16,
      paddingBottom: 132,
    },
    timerCard: {
      flex: 1,
      gap: 24,
      justifyContent: 'space-between',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.7,
    },
    timerCenter: {
      flex: 1,
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timerValue: {
      fontSize: 64,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -2.4,
    },
    durationRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    durationButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    durationButtonPreset: {
      minWidth: 54,
    },
    durationButtonCustom: {
      minWidth: 72,
    },
    durationButtonActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    durationText: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    durationTextActive: {
      color: '#FFFFFF',
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    customInput: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      paddingHorizontal: 14,
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    customApplyButton: {
      minWidth: 84,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 16,
    },
    customApplyText: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 18,
      minWidth: 132,
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: COLORS.primary,
    },
    primaryActionText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 18,
      minWidth: 132,
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.06)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    secondaryActionText: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
  });
