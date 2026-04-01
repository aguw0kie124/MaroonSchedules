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
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import {
  BellRing,
  Bus,
  Clock,
  CalendarDays,
  GraduationCap,
  Cog,
  Check,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { Card, useTheme } from './SharedUI';
import { PageModuleEditor } from './PageModuleEditor';
import { useCampusHubStore } from '../store/campusHubStore';
import { useEventStore } from '../store/eventStore';
import {
  HomeSectionId,
  UIDensity,
  getOrderedItems,
  getOrderedVisibleItems,
  isNavItemVisible,
  useAppShellStore,
} from '../store/appShellStore';

const WEEK_DAYS = [
  { label: 'Mon', value: 'M' },
  { label: 'Tue', value: 'T' },
  { label: 'Wed', value: 'W' },
  { label: 'Thu', value: 'R' },
  { label: 'Fri', value: 'F' },
];
const HOME_TODO_KEY = 'home_todo_items';

function getDefaultDay() {
  return ['U', 'M', 'T', 'W', 'R', 'F', 'S'][new Date().getDay()];
}

function getDensityLimit(density: UIDensity, values: { minimal: number; standard: number; full: number }) {
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
  const scheduledEvents = useEventStore((state) => state.scheduledEvents);
  const homeSections = useAppShellStore((state) => state.homeSections);
  const navItems = useAppShellStore((state) => state.navItems);
  const moveHomeSection = useAppShellStore((state) => state.moveHomeSection);
  const toggleHomeSection = useAppShellStore((state) => state.toggleHomeSection);
  const density = useAppShellStore((state) => state.density);
  const orderedHomeSections = useMemo(
    () => getOrderedItems(homeSections).filter((item) => item.id === 'schedule' || item.id === 'alerts'),
    [homeSections],
  );
  const hasStandaloneBus = useMemo(() => isNavItemVisible(navItems, 'BusRoutes'), [navItems]);

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

  const academic = snapshot?.academic;
  const notifications = (snapshot?.notifications || []).filter((notification) => notification.id !== 'registration-state');
  const visibleCourses = useMemo(
    () => (academic?.courses || []).filter((course) => course.days.includes(selectedDay)),
    [academic?.courses, selectedDay],
  );
  const notificationLimit = getDensityLimit(density, { minimal: 2, standard: 3, full: 5 });
  const courseLimit = getDensityLimit(density, { minimal: 2, standard: 3, full: 5 });
  const priorityNotifications = notifications.slice(0, notificationLimit);
  const wallpaperSource = wallpaperUri
    ? { uri: wallpaperUri }
    : isDark
      ? require('../assets/black_marble.jpg')
      : require('../assets/white_marble.jpg');

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

  const renderSectionCard = (sectionId: HomeSectionId) => {
    if (sectionId === 'schedule') {
      return (
        <Card key={sectionId} style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.moduleEyebrow}>Current Schedule</Text>
              {academic?.nextCourse ? (
                <Text style={styles.moduleTitle}>
                  {`${academic.nextCourse.code} is coming up`}
                </Text>
              ) : null}
            </View>
          </View>

          {academic?.nextCourse ? (
            <Text style={styles.moduleBody}>
              {`${academic.nextCourse.name} · ${academic.nextCourse.time} · ${academic.nextCourse.location}`}
            </Text>
          ) : null}

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
              visibleCourses.slice(0, courseLimit).map((course) => (
                <View key={course.id} style={styles.timelineRow}>
                  <View style={styles.timelineBadge}>
                    <Clock size={13} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{course.code}</Text>
                    <Text style={styles.timelineBody}>{course.name}</Text>
                    <Text style={styles.timelineMeta}>{course.time} · {course.location}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View />
            )}
            {scheduledEvents.length > 0 && scheduledEvents.map((se) => (
              <View key={`se-${se.id}`} style={styles.timelineRow}>
                <View style={[styles.timelineBadge, { backgroundColor: 'rgba(255,122,0,0.12)', borderColor: 'rgba(255,122,0,0.2)' }]}>
                  <CalendarDays size={13} color="#FF7A00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>{se.title}</Text>
                  {se.location ? <Text style={styles.timelineBody}>{se.location}</Text> : null}
                  <Text style={styles.timelineMeta}>
                    {new Date(se.date_ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {se.category ? ` · ${se.category}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.primaryAction}
              onPress={() =>
                hasStandaloneBus
                  ? navigation.navigate('BusRoutes')
                  : navigation.navigate('Main', {
                      screen: 'Places',
                      params: { initialLayer: 'Bus', focusToken: Date.now() }
                    })
              }
            >
              <Text style={styles.primaryActionText}>Transit</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryAction}
              onPress={() => openRootScreen('EventsCalendar')}
            >
              <Text style={styles.secondaryActionText}>Events</Text>
            </Pressable>
          </View>
        </Card>
      );
    }

    if (sectionId === 'alerts') {
      return (
        <Card key={sectionId} style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <View>
              <Text style={styles.moduleEyebrow}>Notifications</Text>
            </View>
            <BellRing size={18} color={COLORS.primary} />
          </View>
          <View style={styles.listBlock}>
            {priorityNotifications.length > 0 ? (
              priorityNotifications.map((notification) => (
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
              ))
            ) : (
              <View />
            )}
          </View>
        </Card>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {useWallpaper ? (
        <ImageBackground source={wallpaperSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTitlePill}>
            <Text style={styles.headerTitleText}>{`Howdy, ${user?.firstName || 'Aggie'}`}</Text>
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

        <Card style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <View>
              <Text style={styles.moduleEyebrow}>To Do</Text>
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
            {todoItems.length ? (
              todoItems.map((item) => (
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
              <View />
            )}
          </View>
        </Card>

        {loading && !snapshot ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </Card>
        ) : (
          rankedHomeSections.map((section) => renderSectionCard(section.id)).filter(Boolean)
        )}
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
      paddingTop: 54,
      paddingBottom: 132,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    },
    topBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    headerTitlePill: {
      flex: 1,
      minHeight: 54,
      borderRadius: 27,
      paddingHorizontal: 20,
      alignItems: 'flex-start',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(16,16,18,0.74)' : 'rgba(255,255,255,0.84)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(12,12,14,0.08)',
    },
    headerTitleText: {
      fontSize: 26,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -0.8,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
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
    avatarText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
    },
    heroCard: {
      gap: 14,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    heroEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: COLORS.accentText || COLORS.textSecondary,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.textPrimary,
      lineHeight: 34,
      letterSpacing: -0.8,
    },
    heroDetail: {
      fontSize: 15,
      lineHeight: 22,
      color: COLORS.textSecondary,
    },
    heroChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.04)',
    },
    heroChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textPrimary,
      textTransform: 'capitalize',
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
    moduleCard: {
      gap: 14,
    },
    moduleHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    },
    moduleEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: COLORS.accentText || COLORS.textSecondary,
      marginBottom: 6,
    },
    moduleTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.4,
      lineHeight: 26,
    },
    moduleBody: {
      fontSize: 14,
      lineHeight: 21,
      color: COLORS.textSecondary,
    },
    weekStrip: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
    },
    dayButton: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 0,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
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
    listBlock: {
      gap: 10,
    },
    todoComposer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    todoInput: {
      flex: 1,
      minHeight: 44,
      borderRadius: 16,
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
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
    },
    todoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
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
      borderRadius: 11,
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
      borderRadius: 15,
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
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 4,
    },
    timelineBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(80,0,0,0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
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
    timelineMeta: {
      fontSize: 12,
      marginTop: 4,
      color: COLORS.textTertiary,
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
    infoChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(80,0,0,0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.08)',
    },
    infoChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
    },
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: COLORS.primary,
    },
    primaryActionText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    secondaryAction: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceElevated,
    },
    secondaryActionText: {
      color: isDark ? '#F3F1ED' : COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyState: {
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.textSecondary,
    },
  });
