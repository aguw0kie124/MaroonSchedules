import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import {
  BellRing,
  ChevronDown,
  ExternalLink,
  MapPin,
  X,
} from 'lucide-react-native';
import { Card, useTheme } from './SharedUI';
import { useCampusHubStore } from '../store/campusHubStore';
import { BUILDINGS, TAMU_CENTER } from '../data/campus';
import { haversineDistanceMeters } from './places/utils';
import { fetchDiningFullMenuCached, getCurrentMealPeriod } from '../services/diningMenuCache';

const WEEK_DAYS = [
  { label: 'Mon', value: 'M' },
  { label: 'Tue', value: 'T' },
  { label: 'Wed', value: 'W' },
  { label: 'Thu', value: 'R' },
  { label: 'Fri', value: 'F' },
];

const HOME_DINING_HALLS = ['Sbisa Dining Hall', 'The Commons Dining Hall', 'Duncan Dining Hall'];
const HOME_SECTIONS = [{ id: 'schedule', order: 0 }, { id: 'alerts', order: 1 }] as const;
const NOTIFICATION_LIMIT = 3;
const COURSE_LIMIT = 3;

function getDefaultDay() {
  return ['U', 'M', 'T', 'W', 'R', 'F', 'S'][new Date().getDay()];
}

function getContextBoost(sectionId: 'schedule' | 'alerts') {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (sectionId === 'schedule' && minutes >= 420 && minutes <= 1020) return 18;
  if (sectionId === 'alerts') return 8;
  return 0;
}

function getUrgencyColor(level: 'high' | 'medium' | 'low', colors: any) {
  if (level === 'high') return colors.danger;
  if (level === 'medium') return colors.warning;
  return colors.success;
}

export function Dashboard() {
  const { COLORS, theme, useWallpaper, wallpaperUri } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(COLORS, isDark);
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { user } = useUser();
  const { snapshot, loading, hydrate } = useCampusHubStore();

  const visibleHomeSections = useMemo(
    () => HOME_SECTIONS,
    [],
  );
  const rankedHomeSections = useMemo(
    () =>
      [...visibleHomeSections].sort((left, right) => {
        const leftScore = 100 - left.order * 8 + getContextBoost(left.id);
        const rightScore = 100 - right.order * 8 + getContextBoost(right.id);
        return rightScore - leftScore;
      }),
    [visibleHomeSections],
  );

  const [selectedDay, setSelectedDay] = useState(getDefaultDay());
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isScheduleMenuOpen, setIsScheduleMenuOpen] = useState(false);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);
  const [isDiningLoading, setIsDiningLoading] = useState(false);

  useEffect(() => {
    if (isFocused && user?.id) {
      hydrate(user.id).catch(() => {});
    }
  }, [hydrate, isFocused, user?.id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!mounted) return;
        if (permission.status !== 'granted') {
          setUserCoord(TAMU_CENTER);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;
        setUserCoord({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      } catch {
        if (mounted) {
          setUserCoord(TAMU_CENTER);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const academic = snapshot?.academic;
  const notifications = (snapshot?.notifications || []).filter(
    (notification) => notification.id !== 'registration-state',
  );
  const visibleCourses = useMemo(
    () => (academic?.courses || []).filter((course) => course.days.includes(selectedDay)),
    [academic?.courses, selectedDay],
  );
  const currentCourse = academic?.nextCourse || visibleCourses[0] || null;
  const priorityNotifications = notifications.slice(0, NOTIFICATION_LIMIT);
  const spotlightEvents = useMemo(() => (snapshot?.events || []).slice(0, 6), [snapshot?.events]);
  const campusServices = useMemo(() => (snapshot?.services || []).slice(0, 4), [snapshot?.services]);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date()),
    [],
  );
  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : isDark
      ? require('../assets/black_marble.jpg')
      : require('../assets/white_marble.jpg');

  const diningHalls = useMemo(
    () => BUILDINGS.filter((building) => HOME_DINING_HALLS.includes(building.name)),
    [],
  );

  const nearestDiningHall = useMemo(() => {
    const origin = userCoord || TAMU_CENTER;
    if (!diningHalls.length) return null;
    return diningHalls.reduce((best, hall) => {
      if (!best) return hall;
      const bestDistance = haversineDistanceMeters(
        origin.latitude,
        origin.longitude,
        best.latitude,
        best.longitude,
      );
      const nextDistance = haversineDistanceMeters(
        origin.latitude,
        origin.longitude,
        hall.latitude,
        hall.longitude,
      );
      return nextDistance < bestDistance ? hall : best;
    }, diningHalls[0]);
  }, [diningHalls, userCoord]);

  useEffect(() => {
    let cancelled = false;
    if (!nearestDiningHall?.name) {
      setDiningMenuPreview(null);
      return;
    }

    setIsDiningLoading(true);
    fetchDiningFullMenuCached({
      location: nearestDiningHall.name,
      mealPeriod: getCurrentMealPeriod(),
    })
      .then((data) => {
        if (!cancelled) {
          setDiningMenuPreview(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiningMenuPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDiningLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nearestDiningHall?.name]);

  const openRootScreen = (screen: string, params?: Record<string, unknown>) => {
    const rootNavigation = navigation.getParent?.('RootStack') || navigation.getParent?.();
    if (rootNavigation?.navigate) {
      rootNavigation.navigate(screen, params);
      return;
    }
    navigation.navigate(screen, params);
  };

  const openDayMap = () => {
    openRootScreen('Places', {
      initialLayer: 'Schedule',
      focusToken: Date.now(),
    });
  };

  const openScheduleManager = () => {
    openRootScreen('ScheduleList');
  };

  const openExternalUrl = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  const renderSectionCard = (sectionId: 'schedule' | 'alerts') => {
    if (sectionId === 'schedule') {
      return (
        <View key={sectionId} style={styles.scheduleSection}>
          <View style={styles.scheduleSectionTopRow}>
            <View style={styles.scheduleHeaderBlock}>
              <Text style={styles.moduleTitle}>Today&apos;s Schedule</Text>
            </View>
            <Pressable
              style={styles.scheduleSelectButton}
              onPress={() => setIsScheduleMenuOpen((current) => !current)}
            >
              <Text style={styles.scheduleSelectText}>Select</Text>
              <ChevronDown size={14} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          {isScheduleMenuOpen ? (
            <View style={styles.scheduleDropdownMenu}>
              <Pressable
                style={styles.scheduleDropdownItem}
                onPress={() => {
                  setIsScheduleMenuOpen(false);
                  openScheduleManager();
                }}
              >
                <Text style={styles.scheduleDropdownTitle}>Manage schedules</Text>
                <Text style={styles.scheduleDropdownMeta}>
                  {academic?.scheduleName || 'Choose a saved schedule'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.scheduleDropdownItem}
                onPress={() => {
                  setIsScheduleMenuOpen(false);
                  openDayMap();
                }}
              >
                <Text style={styles.scheduleDropdownTitle}>Open day map</Text>
                <Text style={styles.scheduleDropdownMeta}>See class locations in Places</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.scheduleSummaryRow}>
            <View style={styles.scheduleSummaryCard}>
              <Text style={styles.scheduleSummaryLabel}>Next class</Text>
              <Text style={styles.scheduleSummaryValue}>
                {currentCourse ? currentCourse.code : 'Free'}
              </Text>
            </View>
            <View style={styles.scheduleSummaryCard}>
              <Text style={styles.scheduleSummaryLabel}>Building</Text>
              <Text style={styles.scheduleSummaryValue}>
                {currentCourse?.location || 'No location'}
              </Text>
            </View>
            <Pressable
              style={styles.scheduleMapAction}
              onPress={openDayMap}
            >
              <MapPin size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.weekStrip}>
            {WEEK_DAYS.map((day) => (
              <Pressable
                key={day.value}
                style={[styles.dayButton, selectedDay === day.value && styles.dayButtonActive]}
                onPress={() => setSelectedDay(day.value)}
              >
              <Text style={[styles.dayText, selectedDay === day.value && styles.dayTextActive]}>
                  {day.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.listBlock}>
            {visibleCourses.length > 0 ? (
              visibleCourses.slice(0, COURSE_LIMIT).map((course, index) => (
                <View key={course.id} style={styles.scheduleRow}>
                  <View style={styles.scheduleTimeRail}>
                    <Text style={styles.scheduleTime}>{course.time}</Text>
                    {index !== Math.min(visibleCourses.length, COURSE_LIMIT) - 1 ? (
                      <View style={styles.scheduleLine} />
                    ) : null}
                  </View>
                  <View style={styles.scheduleContent}>
                    <Text style={styles.scheduleCode}>{course.code}</Text>
                    <Text style={styles.scheduleName}>{course.name}</Text>
                    <View style={styles.scheduleMetaRow}>
                      <MapPin size={12} color={COLORS.textTertiary} />
                      <Text style={styles.scheduleMetaText}>{course.location}</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyState}>No classes for this day.</Text>
            )}
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {useWallpaper ? (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitleText}>{`Howdy, ${user?.firstName || 'Aggie'}`}</Text>
            <Text style={styles.headerSubtitle}>{todayLabel}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.avatar}
              onPress={() => setIsNotificationDrawerOpen((current) => !current)}
            >
              <BellRing size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {loading && !snapshot ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </Card>
        ) : (
          <>
            <View style={styles.feedSection}>
              <View style={styles.feedSectionHeader}>
                <Text style={styles.moduleEyebrow}>Spotlight</Text>
                <Pressable onPress={() => openRootScreen('EventsCalendar')}>
                  <Text style={styles.feedSectionAction}>All events</Text>
                </Pressable>
              </View>
              {spotlightEvents.length > 0 || nearestDiningHall?.name ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.spotlightEventsRow}
                >
                  {spotlightEvents.map((event) => (
                    <Pressable
                      key={event.event_id}
                      style={styles.spotlightEventCard}
                      onPress={() => openRootScreen('EventsCalendar')}
                    >
                      <Text style={styles.spotlightEventEyebrow}>
                        {event.start_time || 'Today'}
                      </Text>
                      <Text style={styles.spotlightEventTitle} numberOfLines={2}>
                        {event.title}
                      </Text>
                      <Text style={styles.spotlightEventMeta} numberOfLines={2}>
                        {event.location || 'Texas A&M University'}
                      </Text>
                    </Pressable>
                  ))}
                  {nearestDiningHall?.name ? (
                    <Pressable
                      style={styles.spotlightEventCard}
                      onPress={() =>
                        openRootScreen('Places', {
                          initialLayer: 'Dining',
                          initialLocation: nearestDiningHall.name,
                          focusToken: Date.now(),
                        })
                      }
                    >
                      <Text style={styles.spotlightEventEyebrow}>Dining</Text>
                      <Text style={styles.spotlightEventTitle} numberOfLines={2}>
                        {nearestDiningHall.name}
                      </Text>
                      <Text style={styles.spotlightEventMeta} numberOfLines={3}>
                        {isDiningLoading
                          ? 'Loading nearby menu...'
                          : diningMenuPreview?.categories?.[0]?.items?.length
                            ? diningMenuPreview.categories[0].items
                                .slice(0, 2)
                                .map((item: any) => item.name)
                                .join(' · ')
                            : 'Open dining view'}
                      </Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              ) : (
                <Text style={styles.emptyState}>No campus events surfaced for today yet.</Text>
              )}
            </View>

            {rankedHomeSections.find((section) => section.id === 'schedule')
              ? renderSectionCard('schedule')
              : null}

            {campusServices.length > 0 ? (
              <View style={styles.feedSection}>
                <View style={styles.feedSectionHeader}>
                  <Text style={styles.moduleEyebrow}>Campus Essentials</Text>
                </View>
                <View style={styles.listBlock}>
                  {campusServices.map((service) => (
                    <Pressable
                      key={service.id}
                      style={styles.essentialRow}
                      onPress={() => openExternalUrl(service.url)}
                    >
                      <View style={styles.essentialIconWrap}>
                        <BellRing size={18} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.essentialTitle}>{service.title}</Text>
                        <Text style={styles.essentialBody} numberOfLines={2}>
                          {service.summary}
                        </Text>
                      </View>
                      <ExternalLink size={18} color={COLORS.primary} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={isNotificationDrawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNotificationDrawerOpen(false)}
      >
        <View style={styles.notificationModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsNotificationDrawerOpen(false)}
          />
          <View style={styles.notificationModalShell}>
            <View style={styles.notificationModalHeader}>
              <Text style={styles.notificationDrawerTitle}>Notifications</Text>
              <Pressable
                style={styles.notificationCloseButton}
                onPress={() => setIsNotificationDrawerOpen(false)}
              >
                <X size={16} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            {priorityNotifications.length > 0 ? (
              priorityNotifications.map((notification) => (
                <View key={notification.id} style={styles.notificationDrawerItem}>
                  <View
                    style={[
                      styles.alertDot,
                      { backgroundColor: getUrgencyColor(notification.urgency, COLORS) },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{notification.title}</Text>
                    <Text style={styles.timelineBody} numberOfLines={2}>
                      {notification.detail}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyState}>No urgent notifications right now.</Text>
            )}
            <Pressable
              style={styles.notificationDrawerAction}
              onPress={() => {
                setIsNotificationDrawerOpen(false);
                openRootScreen('CampusFeed');
              }}
            >
              <Text style={styles.feedSectionAction}>Open social hub</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 132,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    headerTitleText: {
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.9,
    },
    headerSubtitle: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textSecondary,
      letterSpacing: -0.1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 18,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
    },
    loadingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    spotlightHeroCard: {
      gap: 14,
      borderRadius: 24,
      paddingVertical: 18,
      backgroundColor: isDark ? 'rgba(18,18,20,0.94)' : 'rgba(255,255,255,0.96)',
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    spotlightHeroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    spotlightWeatherPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      overflow: 'hidden',
      color: COLORS.textPrimary,
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(12,12,14,0.05)',
      fontSize: 12,
      fontWeight: '800',
    },
    spotlightHeroTitle: {
      fontSize: 19,
      lineHeight: 25,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.4,
    },
    spotlightHeroBody: {
      fontSize: 14,
      lineHeight: 21,
      color: COLORS.textSecondary,
    },
    spotlightActionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryHeroAction: {
      flex: 1,
      minHeight: 50,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    primaryHeroActionText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryHeroAction: {
      minWidth: 138,
      minHeight: 50,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.04)',
      borderWidth: 1,
      borderColor: COLORS.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 14,
    },
    secondaryHeroActionText: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    scheduleSection: {
      paddingTop: 12,
      paddingBottom: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
      gap: 14,
    },
    scheduleSectionTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    scheduleHeaderBlock: {
      gap: 4,
    },
    scheduleSelectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 30,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: 'transparent',
    },
    scheduleSelectText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    scheduleDropdownMenu: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(18,18,20,0.98)' : 'rgba(255,255,255,0.98)',
      overflow: 'hidden',
    },
    scheduleDropdownItem: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
      gap: 3,
    },
    scheduleDropdownTitle: {
      color: COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    scheduleDropdownMeta: {
      color: COLORS.textSecondary,
      fontSize: 11,
      lineHeight: 15,
    },
    scheduleSummaryRow: {
      flexDirection: 'row',
      gap: 8,
    },
    scheduleSummaryCard: {
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    scheduleSummaryLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: COLORS.textTertiary,
    },
    scheduleSummaryValue: {
      fontSize: 12,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginTop: 2,
    },
    moduleEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: COLORS.textSecondary,
      marginBottom: 6,
    },
    moduleTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.4,
      lineHeight: 24,
    },
    scheduleMapAction: {
      width: 36,
      minHeight: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
    },
    weekStrip: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'space-between',
      paddingTop: 2,
      paddingBottom: 2,
    },
    dayButton: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: 'transparent',
    },
    dayButtonActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    dayText: {
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.textPrimary,
      textAlign: 'center',
    },
    dayTextActive: {
      color: '#FFFFFF',
    },
    notificationModalBackdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.34)' : 'rgba(12,12,14,0.18)',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingTop: 92,
      paddingHorizontal: 16,
    },
    notificationModalShell: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: isDark ? 'rgba(18,18,20,0.92)' : 'rgba(255,255,255,0.92)',
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 12,
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.28 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
      gap: 10,
    },
    notificationModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    notificationDrawerTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    notificationDrawerItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    notificationCloseButton: {
      width: 30,
      height: 30,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(12,12,14,0.05)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    notificationDrawerAction: {
      paddingTop: 6,
      alignItems: 'flex-start',
    },
    listBlock: {
      gap: 10,
    },
    scheduleRow: {
      flexDirection: 'row',
      gap: 14,
    },
    scheduleTimeRail: {
      width: 72,
      alignItems: 'flex-start',
    },
    scheduleTime: {
      fontSize: 12,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    scheduleLine: {
      width: 1,
      flex: 1,
      marginTop: 8,
      marginLeft: 4,
      backgroundColor: COLORS.border,
    },
    scheduleContent: {
      flex: 1,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    scheduleCode: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 2,
    },
    scheduleName: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.textSecondary,
      marginBottom: 5,
    },
    scheduleMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    scheduleMetaText: {
      flex: 1,
      fontSize: 12,
      color: COLORS.textTertiary,
    },
    feedSection: {
      gap: 10,
      paddingTop: 8,
      paddingBottom: 6,
    },
    feedSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    feedSectionAction: {
      color: COLORS.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    timelineTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 2,
    },
    timelineBody: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.textSecondary,
    },
    alertRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 4,
    },
    alertDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
    },
    emptyState: {
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.textSecondary,
    },
    spotlightEventsRow: {
      gap: 10,
      paddingRight: 4,
    },
    spotlightEventCard: {
      width: 184,
      minHeight: 116,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.03)',
      borderWidth: 1,
      borderColor: COLORS.border,
      justifyContent: 'space-between',
    },
    spotlightEventEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: COLORS.primary,
    },
    spotlightEventTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      lineHeight: 20,
      marginTop: 8,
    },
    spotlightEventMeta: {
      fontSize: 12,
      lineHeight: 17,
      color: COLORS.textSecondary,
      marginTop: 10,
    },
    essentialRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    essentialIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    essentialTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 4,
    },
    essentialBody: {
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.textSecondary,
    },
  });
