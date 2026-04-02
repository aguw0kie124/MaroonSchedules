import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { ChevronLeft, Clock3, MapPin, Navigation, Repeat2 } from 'lucide-react-native';

import { DEFAULT_USER_LOCATION } from '../data/campus';
import { CampusSearchBar } from './CampusSearchBar';
import { useTheme } from './SharedUI';
import { CampusSearchResult } from '../services/campusSearch';
import { TransitTripPreference } from '../services/campusTransitRouting';

type PlannerLocation = {
  id: string;
  name: string;
  subtitle?: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  type: string;
};

type TimingMode = 'leave_at' | 'arrive_by';

function formatPlannerDate(value: Date) {
  return value.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatPlannerTime(value: Date) {
  return value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toPlannerLocation(result: CampusSearchResult): PlannerLocation | null {
  if (result.building) {
    return {
      id: `building:${result.building.id}`,
      name: result.building.name,
      subtitle: result.building.shortName,
      coordinate: {
        latitude: result.building.latitude,
        longitude: result.building.longitude,
      },
      type: 'building',
    };
  }

  if (result.amenity) {
    return {
      id: `amenity:${result.amenity.id}`,
      name: result.amenity.name,
      subtitle: result.amenity.type,
      coordinate: {
        latitude: result.amenity.latitude,
        longitude: result.amenity.longitude,
      },
      type: 'amenity',
    };
  }

  return null;
}

export default function TransitTripPlannerScreen({ navigation }: any) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = useMemo(() => getStyles(COLORS, isDark), [COLORS, isDark]);

  const [currentLocation, setCurrentLocation] = useState<PlannerLocation>({
    id: 'current-location',
    name: 'Current Location',
    subtitle: DEFAULT_USER_LOCATION.name,
    coordinate: {
      latitude: DEFAULT_USER_LOCATION.latitude,
      longitude: DEFAULT_USER_LOCATION.longitude,
    },
    type: 'current-location',
  });
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [origin, setOrigin] = useState<PlannerLocation | null>(null);
  const [destination, setDestination] = useState<PlannerLocation | null>(null);
  const [timingMode, setTimingMode] = useState<TimingMode>('leave_at');
  const [preference, setPreference] = useState<TransitTripPreference>('best');
  const [plannedAt, setPlannedAt] = useState(() => {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 5);
    next.setSeconds(0, 0);
    return next;
  });
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const result = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setCurrentLocation({
          id: 'current-location',
          name: 'Current Location',
          subtitle: 'Live GPS',
          coordinate: {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          },
          type: 'current-location',
        });
      } catch (error) {
        console.warn('[TransitTripPlanner] Failed to resolve current location:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOrigin = useCurrentLocation ? currentLocation : origin;

  const handleOriginSelect = (result: CampusSearchResult) => {
    const next = toPlannerLocation(result);
    if (!next) return;
    setUseCurrentLocation(false);
    setOrigin(next);
  };

  const handleDestinationSelect = (result: CampusSearchResult) => {
    const next = toPlannerLocation(result);
    if (!next) return;
    setDestination(next);
  };

  const openPicker = (mode: 'date' | 'time') => {
    setPickerMode(mode);
  };

  const closePicker = () => {
    setPickerMode(null);
  };

  const handlePickerChange = (event: any, value?: Date) => {
    const activeMode = pickerMode;
    if (!activeMode) return;

    if (Platform.OS !== 'ios') {
      if (event.type === 'dismissed') {
        closePicker();
        return;
      }
      closePicker();
    }
    if (!value) return;

    setPlannedAt((current) => {
      const next = new Date(current);
      if (activeMode === 'date') {
        next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      } else {
        next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      }
      return next;
    });
  };

  const handlePlanTrip = () => {
    if (!selectedOrigin || !destination) return;

    navigation.navigate('TransitTripResults', {
      origin: selectedOrigin,
      destination,
      preference,
      timingMode,
      plannedTimestamp: plannedAt.getTime(),
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={18} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Plan a Trip</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>From</Text>
          <View style={styles.originModeRow}>
            <Pressable
              style={[styles.modeChip, useCurrentLocation && styles.modeChipActive]}
              onPress={() => setUseCurrentLocation(true)}
            >
              <Navigation size={15} color={useCurrentLocation ? '#FFFFFF' : COLORS.textPrimary} />
              <Text style={[styles.modeChipText, useCurrentLocation && styles.modeChipTextActive]}>
                Current
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, !useCurrentLocation && styles.modeChipActive]}
              onPress={() => setUseCurrentLocation(false)}
            >
              <MapPin size={15} color={!useCurrentLocation ? '#FFFFFF' : COLORS.textPrimary} />
              <Text style={[styles.modeChipText, !useCurrentLocation && styles.modeChipTextActive]}>
                Custom
              </Text>
            </Pressable>
          </View>

          {useCurrentLocation ? (
            <View style={styles.selectionCard}>
              <Text style={styles.selectionTitle}>{currentLocation.name}</Text>
              <Text style={styles.selectionSubtitle}>{currentLocation.subtitle}</Text>
            </View>
          ) : (
            <>
              <CampusSearchBar
                userCoord={currentLocation.coordinate}
                onSelect={handleOriginSelect}
                placeholder="Choose a starting point"
                showPinnedItems={false}
                displayValue={origin?.name}
              />
              {origin ? (
                <View style={styles.selectionCard}>
                  <Text style={styles.selectionTitle}>{origin.name}</Text>
                  <Text style={styles.selectionSubtitle}>{origin.subtitle || 'Selected origin'}</Text>
                </View>
              ) : null}
            </>
          )}

          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>To</Text>
          <CampusSearchBar
            userCoord={selectedOrigin?.coordinate || currentLocation.coordinate}
            onSelect={handleDestinationSelect}
            placeholder="Choose a destination"
            showPinnedItems={false}
            displayValue={destination?.name}
          />
          {destination ? (
            <View style={styles.selectionCard}>
              <Text style={styles.selectionTitle}>{destination.name}</Text>
              <Text style={styles.selectionSubtitle}>{destination.subtitle || 'Selected destination'}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Trip Time</Text>
          <View style={styles.segmentedRow}>
            {[
              { key: 'leave_at', label: 'Leave At' },
              { key: 'arrive_by', label: 'Arrive By' },
            ].map((option) => {
              const active = timingMode === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => setTimingMode(option.key as TimingMode)}
                >
                  <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dateTimeRow}>
            <Pressable style={styles.dateTimeButton} onPress={() => openPicker('date')}>
              <Text style={styles.dateTimeValue}>{formatPlannerDate(plannedAt)}</Text>
            </Pressable>
            <Pressable style={styles.dateTimeButton} onPress={() => openPicker('time')}>
              <Clock3 size={16} color={COLORS.textSecondary} />
              <Text style={styles.dateTimeValue}>{formatPlannerTime(plannedAt)}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Preference</Text>
          <View style={styles.preferenceStack}>
            {[
              { key: 'best', label: 'Best Route', icon: MapPin },
              { key: 'fewer_transfers', label: 'Fewer Transfers', icon: Repeat2 },
              { key: 'less_walking', label: 'Less Walking', icon: Navigation },
            ].map((option) => {
              const active = preference === option.key;
              const Icon = option.icon;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.preferenceCard, active && styles.preferenceCardActive]}
                  onPress={() => setPreference(option.key as TransitTripPreference)}
                >
                  <View style={[styles.preferenceIconWrap, active && styles.preferenceIconWrapActive]}>
                    <Icon size={16} color={active ? '#FFFFFF' : COLORS.primary} />
                  </View>
                  <Text style={styles.preferenceText}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[
            styles.submitButton,
            (!selectedOrigin || !destination) && styles.submitButtonDisabled,
          ]}
          onPress={handlePlanTrip}
          disabled={!selectedOrigin || !destination}
        >
          <Text style={styles.submitButtonText}>Show Trips</Text>
        </Pressable>
      </ScrollView>

      {pickerMode && Platform.OS === 'ios' ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closePicker}
        >
          <View style={styles.modalScrim}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {pickerMode === 'date' ? 'Choose Date' : 'Choose Time'}
                </Text>
                <Pressable style={styles.modalDoneButton} onPress={closePicker}>
                  <Text style={styles.modalDoneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode={pickerMode}
                display={pickerMode === 'date' ? 'inline' : 'spinner'}
                value={plannedAt}
                onChange={handlePickerChange}
                minimumDate={pickerMode === 'date' ? new Date() : undefined}
                themeVariant={isDark ? 'dark' : 'light'}
                accentColor={COLORS.primary}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {pickerMode && Platform.OS !== 'ios' ? (
        <DateTimePicker
          mode={pickerMode}
          display="default"
          value={plannedAt}
          onChange={handlePickerChange}
          minimumDate={pickerMode === 'date' ? new Date() : undefined}
          is24Hour={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.background,
      paddingTop: 44,
    },
    content: {
      padding: 18,
      paddingBottom: 36,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 4,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.04)',
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.9,
    },
    card: {
      backgroundColor: isDark ? 'rgba(18,18,20,0.84)' : 'rgba(255,255,255,0.94)',
      borderRadius: 26,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 18,
      gap: 12,
    },
    fieldLabel: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    fieldLabelSpaced: {
      marginTop: 8,
    },
    originModeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
    },
    modeChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    modeChipText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    modeChipTextActive: {
      color: '#FFFFFF',
    },
    selectionCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    selectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    selectionSubtitle: {
      marginTop: 3,
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 10,
    },
    segmentButton: {
      flex: 1,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
    },
    segmentButtonActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    segmentButtonText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    segmentButtonTextActive: {
      color: '#FFFFFF',
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    dateTimeButton: {
      flex: 1,
      minHeight: 54,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    dateTimeValue: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    preferenceStack: {
      gap: 10,
    },
    preferenceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    preferenceCardActive: {
      borderColor: COLORS.primary,
      backgroundColor: isDark ? 'rgba(17,120,154,0.18)' : 'rgba(17,120,154,0.10)',
    },
    preferenceIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(17,120,154,0.16)' : 'rgba(17,120,154,0.10)',
    },
    preferenceIconWrapActive: {
      backgroundColor: COLORS.primary,
    },
    preferenceText: {
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    submitButton: {
      borderRadius: 22,
      backgroundColor: COLORS.primary,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.45,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    modalScrim: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.42)',
      justifyContent: 'flex-end',
      padding: 16,
    },
    modalCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      padding: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    modalTitle: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    modalDoneButton: {
      borderRadius: 999,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    modalDoneText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
  });
