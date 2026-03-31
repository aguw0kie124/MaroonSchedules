import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Bus, ChevronRight, Clock3, Footprints, MapPin, Repeat2, Route } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../SharedUI';
import {
  buildTransitPlanOptions,
  CampusTransitPlan,
  TransitTripPreference,
} from '../../services/campusTransitRouting';

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

function formatClockTime(value: Date) {
  return value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTripWindow(plan: CampusTransitPlan, plannedTimestamp: number, timingMode: TimingMode) {
  const anchor = new Date(plannedTimestamp);
  if (timingMode === 'arrive_by') {
    const depart = new Date(anchor.getTime() - plan.estimatedTimeMinutes * 60_000);
    return {
      depart,
      arrive: anchor,
    };
  }

  const arrive = new Date(anchor.getTime() + plan.estimatedTimeMinutes * 60_000);
  return {
    depart: anchor,
    arrive,
  };
}

export function TransitTripResultsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { COLORS, theme, useWallpaper, wallpaperUri, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : isDark
      ? require('../../assets/black_marble.jpg')
      : require('../../assets/white_marble.jpg');

  const origin = route.params?.origin as PlannerLocation | undefined;
  const destination = route.params?.destination as PlannerLocation | undefined;
  const preference = (route.params?.preference || 'best') as TransitTripPreference;
  const timingMode = (route.params?.timingMode || 'leave_at') as TimingMode;
  const plannedTimestamp = route.params?.plannedTimestamp as number;
  const preferredRouteKey = route.params?.preferredRouteKey as string | null;
  const preferredRouteName = route.params?.preferredRouteName as string | null;

  const [options, setOptions] = useState<CampusTransitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!origin || !destination) {
      setError('Select both a starting point and a destination to plan a trip.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    buildTransitPlanOptions(
      origin.coordinate,
      destination.coordinate,
      origin.name,
      destination.name,
      {
        preference,
        preferredRouteKey,
        limit: 5,
      },
    )
      .then((plans) => {
        if (!mounted) return;
        if (!plans.length) {
          setError('No campus bus options were available for that trip.');
          setOptions([]);
          return;
        }
        setOptions(plans);
      })
      .catch((plannerError) => {
        console.error('[TripResults] Failed to build trip options:', plannerError);
        if (mounted) {
          setError('Trip planning is temporarily unavailable.');
          setOptions([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [destination, origin, preference, preferredRouteKey]);

  const summaryText = useMemo(() => {
    if (!origin || !destination) return null;
    const preferenceLabel =
      preference === 'less_walking'
        ? 'Less walking'
        : preference === 'fewer_transfers'
          ? 'Fewer transfers'
          : 'Best route';
    return `${origin.name} to ${destination.name} · ${preferenceLabel}`;
  }, [destination, origin, preference]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {useWallpaper ? (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover">
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.52)' : 'rgba(255,255,255,0.24)' },
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
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIcon, { backgroundColor: accentColor }]}>
              <Route size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Trip Options</Text>
              {summaryText ? <Text style={styles.subtitle}>{summaryText}</Text> : null}
            </View>
          </View>
          {preferredRouteName ? (
            <View style={styles.focusChip}>
              <Bus size={14} color={COLORS.textPrimary} />
              <Text style={styles.focusChipText}>Focused on {preferredRouteName}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={accentColor} />
            <Text style={styles.stateText}>Finding the best bus options...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.optionStack}>
            {options.map((plan, index) => {
              const tripWindow = getTripWindow(plan, plannedTimestamp, timingMode);
              return (
                <Pressable
                  key={`${plan.routeKey}-${index}`}
                  style={styles.optionCard}
                  onPress={() =>
                    navigation.navigate('CampusNavigation', {
                      ...(origin.id === 'current-location' ? {} : { initialOrigin: origin }),
                      initialDestination: {
                        id: destination.id,
                        name: destination.name,
                        shortName: destination.subtitle || destination.name,
                        latitude: destination.coordinate.latitude,
                        longitude: destination.coordinate.longitude,
                        type: destination.type,
                      },
                      initialTravelMode: 'bus',
                      preferredRouteKey: plan.routeKey,
                      tripTimingMode: timingMode,
                      tripPreference: preference,
                      plannedTimestamp,
                    })
                  }
                >
                  <View style={styles.optionHeader}>
                    <View style={[styles.routeBadge, { backgroundColor: plan.routeColor || accentColor }]}>
                      <Text style={styles.routeBadgeText}>{plan.routeShortName || 'BUS'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{plan.routeName || 'Campus Route'}</Text>
                      <Text style={styles.optionMeta}>
                        {formatClockTime(tripWindow.depart)} to {formatClockTime(tripWindow.arrive)}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={COLORS.textTertiary} />
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metricPill}>
                      <Clock3 size={14} color={COLORS.textPrimary} />
                      <Text style={styles.metricPillText}>{plan.estimatedTimeMinutes} min total</Text>
                    </View>
                    <View style={styles.metricPill}>
                      <Repeat2 size={14} color={COLORS.textPrimary} />
                      <Text style={styles.metricPillText}>{plan.transferCount} transfers</Text>
                    </View>
                    <View style={styles.metricPill}>
                      <Footprints size={14} color={COLORS.textPrimary} />
                      <Text style={styles.metricPillText}>
                        {Math.round((plan.walkingToStopMeters + plan.walkingFromStopMeters) / 160.934)} mi walk
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailBlock}>
                    <View style={styles.detailRow}>
                      <MapPin size={13} color={COLORS.textSecondary} />
                      <Text style={styles.detailText}>
                        Board at {plan.originStop?.Name} and exit at {plan.destinationStop?.Name}
                      </Text>
                    </View>
                    {plan.nearestVehicleLabel ? (
                      <View style={styles.detailRow}>
                        <Bus size={13} color={COLORS.textSecondary} />
                        <Text style={styles.detailText}>{plan.nearestVehicleLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
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
      paddingHorizontal: 14,
      paddingVertical: 10,
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
      borderRadius: 28,
      padding: 18,
      gap: 14,
      backgroundColor: isDark ? 'rgba(12,12,14,0.88)' : 'rgba(255,255,255,0.96)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
    },
    focusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    focusChipText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    stateCard: {
      borderRadius: 24,
      padding: 22,
      gap: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(12,12,14,0.88)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    stateText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    optionStack: {
      gap: 14,
    },
    optionCard: {
      borderRadius: 24,
      padding: 18,
      gap: 14,
      backgroundColor: isDark ? 'rgba(12,12,14,0.90)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    routeBadge: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routeBadgeText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    optionTitle: {
      color: COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    optionMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    metricPillText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    detailBlock: {
      gap: 8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      flex: 1,
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
