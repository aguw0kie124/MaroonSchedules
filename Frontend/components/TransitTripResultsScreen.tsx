import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Bus, ChevronRight, Clock3, Repeat2, Route } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import {
  buildTransitPlanOptions,
  CampusTransitPlan,
  TransitTripPreference,
} from '../services/campusTransitRouting';

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

function buildStepWindows(plan: CampusTransitPlan, depart: Date) {
  let cursor = depart.getTime();
  return plan.steps.map((step) => {
    const durationMinutes = Math.max(0, step.durationMinutes || 0);
    const start = new Date(cursor);
    const end = new Date(cursor + durationMinutes * 60_000);
    cursor = end.getTime();
    return {
      ...step,
      start,
      end,
    };
  });
}

function buildArrivalSummary(plan: CampusTransitPlan, depart: Date) {
  const walkToStopMin = Math.max(1, Math.round((plan.walkingToStopMeters || 0) / 84));
  const waitMin = plan.estimatedWaitMinutes || 5;
  const busArrivalMs = depart.getTime() + (walkToStopMin + waitMin) * 60_000;
  const busArrivalTime = new Date(busArrivalMs).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const stopName = plan.originStop?.Name || 'Stop';
  return {
    arrivalTime: busArrivalTime,
    stopName,
    walkMinutes: walkToStopMin,
    exitStop: plan.destinationStop?.Name || 'Destination',
  };
}

export function TransitTripResultsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { COLORS, theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);

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
        console.warn('[TripResults] Failed to build trip options:', plannerError);
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
    return `${origin.name} → ${destination.name}`;
  }, [destination, origin]);

  const preferenceLabel = useMemo(() => {
    if (preference === 'less_walking') return 'Less walking';
    if (preference === 'fewer_transfers') return 'Fewer transfers';
    return 'Best route';
  }, [preference]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header: back arrow + title inline */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={16} color={COLORS.textSecondary} />
          </Pressable>
          <Text style={styles.title}>Trip Options</Text>
        </View>

        {/* Summary line */}
        {summaryText ? (
          <Text style={styles.subtitle}>{summaryText} · {preferenceLabel}</Text>
        ) : null}

        {preferredRouteName ? (
          <View style={styles.focusChip}>
            <Bus size={13} color={COLORS.textPrimary} />
            <Text style={styles.focusChipText}>Focused on {preferredRouteName}</Text>
          </View>
        ) : null}

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
              const arrival = buildArrivalSummary(plan, tripWindow.depart);
              const hasTransfers = plan.transferCount > 0;
              return (
                <Pressable
                  key={`${plan.routeKey}-${index}`}
                  style={styles.optionCard}
                  onPress={() =>
                    navigation.navigate('CampusNavigation', {
                      ...(origin.id === 'current-location'
                        ? {}
                        : {
                            initialOrigin: {
                              id: origin.id,
                              name: origin.name,
                              shortName: origin.subtitle || origin.name,
                              latitude: origin.coordinate.latitude,
                              longitude: origin.coordinate.longitude,
                              type: origin.type,
                            },
                          }),
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
                  {/* Top row: badge + route name + time top-right */}
                  <View style={styles.optionHeader}>
                    <View style={[styles.routeBadge, { backgroundColor: plan.routeColor || accentColor }]}>
                      <Text style={styles.routeBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{plan.routeShortName || 'BUS'}</Text>
                    </View>
                    <View style={styles.optionHeaderText}>
                      <Text style={styles.optionTitle} numberOfLines={1}>
                        {plan.routeName || 'Campus Route'}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {formatClockTime(tripWindow.depart)} to {formatClockTime(tripWindow.arrive)}
                      </Text>
                    </View>
                    <View style={styles.optionTimeBadge}>
                      <Text style={styles.optionTimeText}>{plan.estimatedTimeMinutes}m</Text>
                    </View>
                  </View>

                  {/* Transfers — only show when > 0 */}
                  {hasTransfers ? (
                    <View style={styles.metricRow}>
                      <View style={styles.metricPill}>
                        <Repeat2 size={13} color={COLORS.textPrimary} />
                        <Text style={styles.metricPillText}>{plan.transferCount} transfer{plan.transferCount !== 1 ? 's' : ''}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Board / Exit row */}
                  <View style={styles.arrivalRow}>
                    <View style={styles.arrivalInfo}>
                      <Text style={styles.arrivalLabel}>Board</Text>
                      <Text style={styles.arrivalValue} numberOfLines={2}>
                        {arrival.arrivalTime} @ {arrival.stopName}
                      </Text>
                      <Text style={styles.arrivalWalk}>{arrival.walkMinutes} min walk</Text>
                    </View>
                    <View style={styles.arrivalDivider} />
                    <View style={styles.arrivalInfo}>
                      <Text style={styles.arrivalLabel}>Exit</Text>
                      <Text style={styles.arrivalValue} numberOfLines={2}>{arrival.exitStop}</Text>
                    </View>
                    <ChevronRight size={16} color={COLORS.textTertiary} style={{ alignSelf: 'center', marginRight: 8 }} />
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
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(12,12,14,0.10)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.04)',
    },
    title: {
      color: COLORS.textPrimary,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    subtitle: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: -4,
    },
    focusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    focusChipText: {
      color: COLORS.textPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    stateCard: {
      borderRadius: 22,
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
      gap: 12,
    },
    optionCard: {
      borderRadius: 22,
      padding: 16,
      gap: 12,
      backgroundColor: isDark ? 'rgba(12,12,14,0.90)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.10,
      shadowRadius: 14,
      elevation: 6,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    optionHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    routeBadge: {
      minWidth: 40,
      paddingHorizontal: 8,
      height: 40,
      borderRadius: 14,
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
      fontSize: 15,
      fontWeight: '800',
    },
    optionMeta: {
      color: COLORS.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    optionTimeBadge: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F5F7',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.06)',
    },
    optionTimeText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metricPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    metricPillText: {
      color: COLORS.textPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    arrivalRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 0,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F7F8FA',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(12,12,14,0.06)',
      overflow: 'hidden',
    },
    arrivalInfo: {
      flex: 1,
      padding: 10,
      gap: 2,
    },
    arrivalDivider: {
      width: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    arrivalLabel: {
      color: COLORS.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    arrivalValue: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
    arrivalWalk: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
  });
