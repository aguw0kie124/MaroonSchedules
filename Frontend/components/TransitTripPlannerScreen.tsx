import React, { useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ArrowLeft, CalendarDays, Clock3, MapPin, Navigation, Route } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CampusSearchBar } from './CampusSearchBar';
import { useTheme } from './SharedUI';
import { DEFAULT_USER_LOCATION } from '../data/campus';
import { CampusSearchResult } from '../services/campusSearch';
import { Coordinate } from '../services/campusDirections';
import type { TransitTripPreference } from '../services/campusTransitRouting';

type PlannerLocation = {
  id: string;
  name: string;
  subtitle?: string;
  coordinate: Coordinate;
  type: string;
};

type TimingMode = 'leave_at' | 'arrive_by';

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
      type: result.building.type,
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
      type: result.amenity.type,
    };
  }

  return null;
}

function formatPlannerDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPlannerTime(value: Date) {
  return value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TransitTripPlannerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { COLORS, theme, useWallpaper, wallpaperUri, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const [origin, setOrigin] = useState<PlannerLocation | null>(null);
  const [destination, setDestination] = useState<PlannerLocation | null>(null);
  const [userCoord, setUserCoord] = useState<Coordinate>({
    latitude: DEFAULT_USER_LOCATION.latitude,
    longitude: DEFAULT_USER_LOCATION.longitude,
  });
  const [timingMode, setTimingMode] = useState<TimingMode>('leave_at');
  const [tripPreference, setTripPreference] = useState<TransitTripPreference>('best');
  const [plannedDateTime, setPlannedDateTime] = useState(() => new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  const preferredRouteKey = route.params?.preferredRouteKey || null;
  const preferredRouteName = route.params?.preferredRouteName || null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!mounted || permission.status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;
        setUserCoord({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      } catch (error) {
        console.warn('[TripPlanner] Failed to load current location:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const originLabel = origin?.name || 'Current Location';
  const canSearch = !!destination;

  const plannerSummary = useMemo(() => {
    if (!preferredRouteName || !preferredRouteKey) return null;
    return `Focused on ${preferredRouteName}`;
  }, [preferredRouteKey, preferredRouteName]);

  const handleOriginSelect = (result: CampusSearchResult) => {
    const next = toPlannerLocation(result);
    if (next) {
      setOrigin(next);
    }
  };

  const handleDestinationSelect = (result: CampusSearchResult) => {
    const next = toPlannerLocation(result);
    if (next) {
      setDestination(next);
    }
  };

  const handlePickerChange = (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (Platform.OS !== 'ios') {
      setPickerMode(null);
    }
    if (!selectedValue) return;
    setPlannedDateTime((current) => {
      const next = new Date(current);
      if (pickerMode === 'date') {
        next.setFullYear(selectedValue.getFullYear(), selectedValue.getMonth(), selectedValue.getDate());
      } else if (pickerMode === 'time') {
        next.setHours(selectedValue.getHours(), selectedValue.getMinutes(), 0, 0);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {useWallpaper && wallpaperUri ? (
        <ImageBackground source={{ uri: wallpaperUri }} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.52)' : 'rgba(255,255,255,0.28)' },
            ]}
          />
        </ImageBackground>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.title}>Plan a Trip</Text>
            {preferredRouteKey ? (
              <View style={[styles.routeFocusBadge, { backgroundColor: accentColor }]}>
                <Route size={13} color="#FFFFFF" />
                <Text style={styles.routeFocusBadgeText}>Route Focus</Text>
              </View>
            ) : null}
          </View>
          {plannerSummary ? <Text style={styles.subtitle}>{plannerSummary}</Text> : null}

          <View style={styles.searchStack}>
            <CampusSearchBar
              userCoord={userCoord}
              onSelect={handleOriginSelect}
              placeholder="Choose a starting point"
              showPinnedItems={false}
              displayValue={origin?.name}
            />
            <CampusSearchBar
              userCoord={origin?.coordinate || userCoord}
              onSelect={handleDestinationSelect}
              placeholder="Enter a destination"
              displayValue={destination?.name}
            />
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.currentLocationPill, !origin && styles.currentLocationPillActive]}
              onPress={() => setOrigin(null)}
            >
              <Navigation size={15} color="#FFFFFF" />
              <Text style={styles.currentLocationText}>
                {origin ? 'Use Current Location' : 'Using Current Location'}
              </Text>
            </Pressable>
            <View style={styles.originMetaPill}>
              <MapPin size={14} color={COLORS.textSecondary} />
              <Text style={styles.originMetaText} numberOfLines={1}>
                {originLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.panelLabel}>When</Text>
          <View style={styles.segmentRow}>
            <Pressable
              style={[styles.segmentButton, timingMode === 'leave_at' && styles.segmentButtonActive]}
              onPress={() => setTimingMode('leave_at')}
            >
              <Text style={[styles.segmentText, timingMode === 'leave_at' && styles.segmentTextActive]}>
                Leave At
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentButton, timingMode === 'arrive_by' && styles.segmentButtonActive]}
              onPress={() => setTimingMode('arrive_by')}
            >
              <Text style={[styles.segmentText, timingMode === 'arrive_by' && styles.segmentTextActive]}>
                Arrive By
              </Text>
            </Pressable>
          </View>

          <View style={styles.dateTimeRow}>
            <Pressable style={styles.dateTimeButton} onPress={() => setPickerMode('date')}>
              <CalendarDays size={16} color={COLORS.textPrimary} />
              <Text style={styles.dateTimeButtonText}>{formatPlannerDate(plannedDateTime)}</Text>
            </Pressable>
            <Pressable style={styles.dateTimeButton} onPress={() => setPickerMode('time')}>
              <Clock3 size={16} color={COLORS.textPrimary} />
              <Text style={styles.dateTimeButtonText}>{formatPlannerTime(plannedDateTime)}</Text>
            </Pressable>
          </View>

          {pickerMode ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={plannedDateTime}
                mode={pickerMode}
                display={Platform.OS === 'ios' ? (pickerMode === 'date' ? 'inline' : 'spinner') : 'default'}
                onChange={handlePickerChange}
                accentColor={accentColor}
                textColor={isDark ? '#FFFFFF' : '#000000'}
              />
              {Platform.OS === 'ios' ? (
                <Pressable style={styles.doneButton} onPress={() => setPickerMode(null)}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.panelLabel}>Route Preference</Text>
          <View style={styles.preferenceStack}>
            {[
              { id: 'best', label: 'Best Route' },
              { id: 'fewer_transfers', label: 'Fewer Transfers' },
              { id: 'less_walking', label: 'Less Walking' },
            ].map((option) => {
              const selected = tripPreference === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.preferenceRow, selected && styles.preferenceRowActive]}
                  onPress={() => setTripPreference(option.id as TransitTripPreference)}
                >
                  <View style={[styles.radioDot, selected && styles.radioDotActive]} />
                  <Text style={[styles.preferenceText, selected && styles.preferenceTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[styles.searchTripsButton, !canSearch && styles.searchTripsButtonDisabled]}
          disabled={!canSearch}
          onPress={() =>
            navigation.navigate('TransitTripResults', {
              origin: origin
                ? origin
                : {
                    id: 'current-location',
                    name: 'Current Location',
                    coordinate: userCoord,
                    type: 'current',
                  },
              destination,
              preference: tripPreference,
              timingMode,
              plannedTimestamp: plannedDateTime.getTime(),
              preferredRouteKey,
              preferredRouteName,
            })
          }
        >
          <Text style={styles.searchTripsButtonText}>Find Trips</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      padding: 18,
      paddingBottom: 44,
      gap: 16,
    },
    headerRow: {
      marginBottom: 4,
    },
    backButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: isDark ? 'rgba(12,12,14,0.82)' : 'rgba(255,255,255,0.96)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    backButtonText: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    heroCard: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: isDark ? 'rgba(12,12,14,0.88)' : 'rgba(255,255,255,0.96)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
      gap: 14,
    },
    heroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.8,
    },
    subtitle: {
      marginTop: -8,
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    routeFocusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    routeFocusBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    searchStack: {
      gap: 12,
    },
    controlsRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    currentLocationPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: COLORS.primary,
    },
    currentLocationPillActive: {
      opacity: 1,
    },
    currentLocationText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    originMetaPill: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    originMetaText: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    panelCard: {
      borderRadius: 18,
      padding: 16,
      gap: 12,
      backgroundColor: isDark ? 'rgba(12,12,14,0.88)' : 'rgba(255,255,255,0.96)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    panelLabel: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    segmentRow: {
      flexDirection: 'row',
      borderRadius: 999,
      padding: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
    },
    segmentButton: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
    },
    segmentButtonActive: {
      backgroundColor: COLORS.primary,
    },
    segmentText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    dateTimeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    dateTimeButtonText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    pickerWrap: {
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F9FB',
    },
    doneButton: {
      alignSelf: 'flex-end',
      marginTop: 8,
      marginRight: 12,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: COLORS.primary,
    },
    doneButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    preferenceStack: {
      gap: 10,
    },
    preferenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    preferenceRowActive: {
      borderColor: COLORS.primary,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    },
    radioDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: COLORS.textSecondary,
    },
    radioDotActive: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary,
    },
    preferenceText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    preferenceTextActive: {
      color: COLORS.textPrimary,
    },
    searchTripsButton: {
      borderRadius: 999,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      marginTop: 4,
    },
    searchTripsButtonDisabled: {
      opacity: 0.4,
    },
    searchTripsButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
  });
