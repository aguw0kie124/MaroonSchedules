import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import {
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Cog,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { Card, useTheme } from './SharedUI';
import { PageModuleEditor } from './PageModuleEditor';
import { useCampusHubStore } from '../store/campusHubStore';
import {
  HomeSectionId,
  UIDensity,
  getOrderedItems,
  getOrderedVisibleItems,
  useAppShellStore,
} from '../store/appShellStore';
import { BUILDINGS, TAMU_CENTER } from '../data/campus';
import { haversineDistanceMeters } from './places/utils';
import {
  fetchDiningFullMenuCached,
  getCurrentMealPeriod,
} from '../services/diningMenuCache';

const WEEK_DAYS = [
  { label: 'Mon', value: 'M' },
  { label: 'Tue', value: 'T' },
  { label: 'Wed', value: 'W' },
  { label: 'Thu', value: 'R' },
  { label: 'Fri', value: 'F' },
];

const HOME_TODO_KEY = 'home_todo_items';
const HOME_DINING_HALLS = ['Sbisa Dining Hall', 'The Commons Dining Hall', 'Duncan Dining Hall'];

function getDefaultDay() {
  return ['U', 'M', 'T', 'W', 'R', 'F', 'S'][new Date().getDay()];
}

function getDensityLimit(
  density: UIDensity,
  values: { minimal: number; standard: number; full: number },
) {
  if (density === 'minimal') return values.minimal;
  if (density === 'full') return values.full;
  return values.standard;
}

function getContextBoost(sectionId: HomeSectionId) {
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
  const homeSections = useAppShellStore((state) => state.homeSections);
  const moveHomeSection = useAppShellStore((state) => state.moveHomeSection);
  const toggleHomeSection = useAppShellStore((state) => state.toggleHomeSection);
  const density = useAppShellStore((state) => state.density);

  const orderedHomeSections = useMemo(
    () => getOrderedItems(homeSections).filter((item) => item.id === 'schedule' || item.id === 'alerts'),
    [homeSections],
  );
  const visibleHomeSections = useMemo(
    () => getOrderedVisibleItems(homeSections).filter((item) => item.id === 'schedule' || item.id === 'alerts'),
    [homeSections],
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
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [todoInput, setTodoInput] = useState('');
  const [todoItems, setTodoItems] = useState<Array<{ id: string; text: string; done: boolean }>>([]);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [diningMenuPreview, setDiningMenuPreview] = useState<any | null>(null);
  const [isDiningLoading, setIsDiningLoading] = useState(false);
  const [isAlertsExpanded, setIsAlertsExpanded] = useState(false);

  useEffect(() => {
    if (isFocused && user?.id) {
      hydrate(user.id).catch(() => {});
    }
  }, [hydrate, isFocused, user?.id]);

  useEffect(() => {
    AsyncStorage.getItem(HOME_TODO_KEY)
      .then((value) => {
        if (value) {
          setTodoItems(JSON.parse(value));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(HOME_TODO_KEY, JSON.stringify(todoItems)).catch(() => {});
  }, [todoItems]);

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
  const notificationLimit = getDensityLimit(density, { minimal: 2, standard: 3, full: 5 });
  const courseLimit = getDensityLimit(density, { minimal: 2, standard: 3, full: 5 });
  const priorityNotifications = notifications.slice(0, notificationLimit);
  const visibleTodoItems = todoItems.slice(0, 3);
  const spotlightEvents = useMemo(() => (snapshot?.events || []).slice(0, 6), [snapshot?.events]);
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

  const addTodoItem = () => {
    const trimmed = todoInput.trim();
    if (!trimmed) return;
    setTodoItems((current) => [{ id: `${Date.now()}`, text: trimmed, done: false }, ...current]);
    setTodoInput('');
  };

  const toggleTodoItem = (id: string) => {
    setTodoItems((current) =>
      current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  };

  const deleteTodoItem = (id: string) => {
    setTodoItems((current) => current.filter((item) => item.id !== id));
  };

  const openRootScreen = (screen: string, params?: Record<string, unknown>) => {
    const rootNavigation = navigation.getParent?.('RootStack') || navigation.getParent?.();
    if (rootNavigation?.navigate) {
      rootNavigation.navigate(screen, params);
      return;
    }
    navigation.navigate(screen, params);
  };

  const openCurrentClassMap = () => {
    if (!currentCourse?.location) return;
    openRootScreen('Places', {
      initialLayer: 'Schedule',
      initialLocation: currentCourse.location,
      focusToken: Date.now(),
    });
  };

  const openDayMap = () => {
    openRootScreen('Places', {
      initialLayer: 'Schedule',
      focusToken: Date.now(),
    });
  };

  const renderSectionCard = (sectionId: HomeSectionId) => {
    if (sectionId === 'schedule') {
      return (
        <Card key={sectionId} style={styles.scheduleCard}>
          <View style={styles.scheduleHeaderBlock}>
            <View>
              <Text style={styles.moduleTitle}>Today&apos;s Schedule</Text>
            </View>
          </View>

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
              <Text style={styles.scheduleMapActionLabel}>Map</Text>
              <Text style={styles.scheduleMapActionText}>Day map</Text>
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
              visibleCourses.slice(0, courseLimit).map((course, index) => (
                <View key={course.id} style={styles.scheduleRow}>
                  <View style={styles.scheduleTimeRail}>
                    <Text style={styles.scheduleTime}>{course.time}</Text>
                    {index !== Math.min(visibleCourses.length, courseLimit) - 1 ? (
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
        </Card>
      );
    }

    if (sectionId === 'alerts') {
      const leadNotification = priorityNotifications[0] || null;
      return (
        <Card key={sectionId} style={styles.compactCard}>
          <View style={styles.alertsHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.moduleEyebrow}>Notifications</Text>
              <Text style={styles.moduleTitle}>What needs attention</Text>
            </View>
            <Pressable
              style={styles.alertsToggle}
              onPress={() => setIsAlertsExpanded((current) => !current)}
            >
              {isAlertsExpanded ? (
                <ChevronUp size={16} color={COLORS.textPrimary} />
              ) : (
                <ChevronDown size={16} color={COLORS.textPrimary} />
              )}
            </Pressable>
          </View>
          <View style={styles.listBlock}>
            {leadNotification ? (
              <>
                <View style={styles.alertRow}>
                  <View
                    style={[
                      styles.alertDot,
                      { backgroundColor: getUrgencyColor(leadNotification.urgency, COLORS) },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{leadNotification.title}</Text>
                    <Text
                      style={styles.timelineBody}
                      numberOfLines={isAlertsExpanded ? undefined : 2}
                    >
                      {leadNotification.detail}
                    </Text>
                  </View>
                </View>
                {isAlertsExpanded && priorityNotifications.slice(1).map((notification) => (
                  <View key={notification.id} style={styles.alertRow}>
                    <View
                      style={[
                        styles.alertDot,
                        { backgroundColor: getUrgencyColor(notification.urgency, COLORS) },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineTitle}>{notification.title}</Text>
                      <Text style={styles.timelineBody}>{notification.detail}</Text>
                    </View>
                  </View>
                ))}
                {priorityNotifications.length > 1 && !isAlertsExpanded ? (
                  <Text style={styles.compactMeta}>
                    {`${priorityNotifications.length - 1} more notification${priorityNotifications.length - 1 === 1 ? '' : 's'}`}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptyState}>No urgent alerts right now.</Text>
            )}
          </View>
        </Card>
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
            <Pressable style={styles.avatar} onPress={() => navigation.navigate('Settings')}>
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
              ) : (
                <Cog size={18} color="#FFFFFF" />
              )}
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
            {rankedHomeSections.find((section) => section.id === 'schedule')
              ? renderSectionCard('schedule')
              : null}

            <Card style={styles.compactCard}>
              <View style={styles.moduleHeader}>
                <View>
                  <Text style={styles.moduleEyebrow}>Spotlight</Text>
                  <Text style={styles.moduleTitle}>Campus events for today</Text>
                </View>
                <Pressable style={styles.inlineActionMuted} onPress={() => openRootScreen('EventsCalendar')}>
                  <Text style={styles.inlineActionMutedText}>All events</Text>
                </Pressable>
              </View>
              {spotlightEvents.length > 0 ? (
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
                </ScrollView>
              ) : (
                <Text style={styles.emptyState}>No campus events surfaced for today yet.</Text>
              )}
            </Card>

            {rankedHomeSections.find((section) => section.id === 'alerts')
              ? renderSectionCard('alerts')
              : null}
          </>
        )}

        <Card style={styles.compactCard}>
          <View style={styles.moduleHeader}>
            <View>
              <Text style={styles.moduleEyebrow}>Quick tasks</Text>
              <Text style={styles.moduleTitle}>Keep the day moving</Text>
            </View>
            <Check size={18} color={COLORS.primary} />
          </View>
          <View style={styles.todoComposer}>
            <TextInput
              value={todoInput}
              onChangeText={setTodoInput}
              placeholder="Add a task..."
              placeholderTextColor={COLORS.textTertiary}
              style={styles.todoInput}
              onSubmitEditing={addTodoItem}
              returnKeyType="done"
            />
            <Pressable style={styles.todoAddButton} onPress={addTodoItem}>
              <Plus size={16} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.listBlock}>
            {visibleTodoItems.length ? (
              visibleTodoItems.map((item) => (
                <View key={item.id} style={styles.todoRow}>
                  <Pressable style={styles.todoMain} onPress={() => toggleTodoItem(item.id)}>
                    <View style={[styles.todoCheck, item.done && styles.todoCheckActive]}>
                      {item.done ? <Check size={13} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={[styles.todoText, item.done && styles.todoTextDone]}>{item.text}</Text>
                  </Pressable>
                  <Pressable style={styles.todoDeleteButton} onPress={() => deleteTodoItem(item.id)}>
                    <Trash2 size={15} color={COLORS.textSecondary} />
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={styles.emptyState}>No quick tasks yet.</Text>
            )}
            {todoItems.length > visibleTodoItems.length ? (
              <Text style={styles.compactMeta}>{`${todoItems.length - visibleTodoItems.length} more task${todoItems.length - visibleTodoItems.length === 1 ? '' : 's'}`}</Text>
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <PageModuleEditor
        visible={isEditorVisible}
        onClose={() => setIsEditorVisible(false)}
        title="Home"
        items={orderedHomeSections}
        onToggle={toggleHomeSection}
        onMove={moveHomeSection}
      />
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
      borderRadius: 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
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
    compactCard: {
      gap: 12,
      borderRadius: 16,
      paddingVertical: 14,
    },
    scheduleCard: {
      gap: 14,
      borderRadius: 18,
      paddingVertical: 16,
      backgroundColor: isDark ? 'rgba(16,16,20,0.92)' : 'rgba(255,255,255,0.96)',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(80,0,0,0.1)',
    },
    scheduleHeaderBlock: {
      gap: 4,
    },
    scheduleSummaryRow: {
      flexDirection: 'row',
      gap: 8,
    },
    scheduleSummaryCard: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: COLORS.surfaceElevated,
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
    moduleHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    },
    alertsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    moduleEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: COLORS.textSecondary,
      marginBottom: 6,
    },
    alertsToggle: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    moduleTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.4,
      lineHeight: 24,
    },
    scheduleMapAction: {
      width: 84,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      backgroundColor: COLORS.primary,
    },
    scheduleMapActionLabel: {
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: 'rgba(255,255,255,0.8)',
    },
    scheduleMapActionText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 14,
      marginTop: 6,
    },
    moduleBody: {
      fontSize: 14,
      lineHeight: 21,
      color: COLORS.textSecondary,
    },
    inlineActionMuted: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.surfaceElevated,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    inlineActionMutedText: {
      color: COLORS.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    weekStrip: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'space-between',
      paddingTop: 4,
      paddingBottom: 2,
    },
    dayButton: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
    },
    dayButtonActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    dayText: {
      fontSize: 12,
      fontWeight: '800',
      color: COLORS.textPrimary,
      textAlign: 'center',
    },
    dayTextActive: {
      color: '#FFFFFF',
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
    todoComposer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    todoInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      paddingHorizontal: 14,
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    todoAddButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
    },
    todoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 2,
    },
    todoMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    todoCheck: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todoCheckActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    todoDeleteButton: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(12,12,14,0.04)',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    todoText: {
      flex: 1,
      fontSize: 14,
      color: COLORS.textPrimary,
      fontWeight: '600',
    },
    todoTextDone: {
      color: COLORS.textSecondary,
      textDecorationLine: 'line-through',
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
    compactMeta: {
      fontSize: 12,
      color: COLORS.textTertiary,
      fontWeight: '600',
    },
    spotlightEventsRow: {
      gap: 10,
      paddingRight: 4,
    },
    spotlightEventCard: {
      width: 184,
      minHeight: 122,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: COLORS.surfaceElevated,
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
  });
