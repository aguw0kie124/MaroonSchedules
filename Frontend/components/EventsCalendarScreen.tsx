import React, { startTransition, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import {
  ArrowRight,
  ChevronLeft,
  Filter,
  Inbox,
  Search,
  Settings,
  Calendar as CalendarIcon,
} from 'lucide-react-native';

import { useShareStore } from '../store/shareStore';
import { useEventStore } from '../store/eventStore';
import type { ScheduledEvent } from '../store/eventStore';
import { useTheme } from './SharedUI';

// Modular Imports
import {
  TAMUEvent,
  ExploreCategory,
  SocialMode,
  EventsView,
  ALL_CATEGORIES,
  classifyCategory,
  formatDate,
  formatTime,
  handleGoogleCalendar,
} from './events/EventUtils';
import { useEvents } from '../hooks/useEvents';
import { useEventFilters } from '../hooks/useEventFilters';

// Sub-components
import { CategoryChip } from './events/CategoryChip';
import { HeroEventCard } from './events/HeroEventCard';
import { ListEventRow } from './events/ListEventRow';
import { SwipeEventCard } from './events/SwipeEventCard';
import { ActionButton } from './events/ActionButton';
import { EventSettingsModal } from './events/EventSettingsModal';
import { EventDetailModal } from './events/EventDetailModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function EventsCalendarScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const s = useMemo(() => getStyles(COLORS, isDark, embedded), [COLORS, isDark, embedded]);

  // View State
  const [view, setView] = useState<EventsView>('discover');
  const [detailEvent, setDetailEvent] = useState<TAMUEvent | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  // Business Logic Hooks
  const { events, loading, reFetch } = useEvents();
  const {
    isMajorSpecific,
    selectedMajor,
    setMajorSpecific,
    setSelectedMajor,
    scheduledEvents,
    scheduleEvent,
    savedEventIds,
    saveEvent,
    unsaveEvent,
    dislikedEventIds,
    dislikeEvent,
    removeIdsFromDisliked,
    clearDisliked,
    receivedInvites,
    acceptInvite,
    rejectInvite,
  } = useEventStore();

  const {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    socialMode,
    setSocialMode,
    categoryCounts,
    filteredUpcomingEvents,
    discoverEvents,
    swipeDeck,
    toggleCategory,
  } = useEventFilters(events, dislikedEventIds, isMajorSpecific, selectedMajor);

  // Animation State
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Sync swipe index on filter change
  useEffect(() => {
    setSwipeIndex(0);
  }, [selectedCategories, socialMode, searchQuery, isMajorSpecific, selectedMajor]);

  const activeSwipeEvent = swipeDeck[swipeIndex] ?? null;

  const changeView = useCallback((nextView: EventsView) => {
    startTransition(() => {
      setView(nextView);
    });
  }, []);

  const handleSchedule = useCallback(
    async (event: TAMUEvent) => {
      const scheduled: ScheduledEvent = {
        id: String(event.id),
        title: event.title,
        location: event.location,
        description: event.description,
        date_ts: event.date_ts,
        date_iso: event.date_iso,
        endDate_ts: event.date2_ts,
        location_lat: event.location_lat,
        location_lng: event.location_lng,
        category: classifyCategory(event),
        categories: event.categories,
      };
      scheduleEvent(scheduled);
    },
    [scheduleEvent]
  );

  const handleShare = useCallback((event: TAMUEvent) => {
    useShareStore.getState().openShare({
      title: event.title,
      message: `Check out this event: ${event.title} at ${event.location || 'TAMU'}!`,
      url: event.url || 'https://maroonschedules.tamu.edu',
    });
  }, []);

  const handleMapOpen = useCallback(
    (event: TAMUEvent) => {
      if (event.location_lat != null && event.location_lng != null) {
        navigation.navigate('Main', {
          screen: 'Places',
          params: {
            initialLayer: 'Academic',
            focusToken: `event:${event.id}:${event.date_ts}`,
            eventFocus: {
              eventId: String(event.id),
              title: event.title,
              location: event.location || null,
              latitude: event.location_lat,
              longitude: event.location_lng,
              startTime: event.date_iso,
              link: event.url || null,
              hasFood: !!event.has_food,
            },
          },
        });
      }
    },
    [navigation]
  );

  const handleSaveToggle = useCallback(
    (event: TAMUEvent) => {
      const id = String(event.id);
      if (savedEventIds.includes(id)) unsaveEvent(id);
      else saveEvent(id);
    },
    [savedEventIds, saveEvent, unsaveEvent]
  );

  const handleSwipeAdvance = useCallback(() => {
    pan.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
    setSwipeIndex((prev) => prev + 1);
  }, [opacity, pan]);

  const handleSwipeLeft = useCallback(
    (event: TAMUEvent) => {
      dislikeEvent(String(event.id));
      handleSwipeAdvance();
    },
    [dislikeEvent, handleSwipeAdvance]
  );

  const handleSwipeRight = useCallback(
    (event: TAMUEvent) => {
      handleSchedule(event);
      handleSwipeAdvance();
    },
    [handleSchedule, handleSwipeAdvance]
  );

  const handleRestoreCategory = useCallback(
    (category?: ExploreCategory) => {
      if (!category) {
        clearDisliked();
        setSettingsVisible(false);
        return;
      }
      const idsToRestore = dislikedEventIds.filter((id) => {
        const event = events.find((candidate) => String(candidate.id) === id);
        return event && classifyCategory(event) === category;
      });
      if (idsToRestore.length > 0) {
        removeIdsFromDisliked(idsToRestore);
      }
      setSettingsVisible(false);
    },
    [clearDisliked, dislikedEventIds, events, removeIdsFromDisliked]
  );

  const renderHeader = (title: string, subtitle?: string) => (
    <View style={s.headerBlock}>
      <View style={s.headerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>{title}</Text>
          {!!subtitle && <Text style={s.pageSubtitle}>{subtitle}</Text>}
        </View>
        <Pressable style={s.headerIconButton} onPress={() => setView('inbox')}>
          <Inbox size={18} color={COLORS.textPrimary} />
          {receivedInvites.length > 0 ? (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{receivedInvites.length}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable style={s.headerIconButton} onPress={() => setSettingsVisible(true)}>
          <Settings size={18} color={COLORS.textPrimary} />
        </Pressable>
      </View>

      <View style={s.modeTabs}>
        {([
          { id: 'discover', label: 'Discover' },
          { id: 'list', label: 'List' },
          { id: 'swipe', label: 'Swipe' },
        ] as const).map((tab) => {
          const active = view === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[s.modeTab, active && s.modeTabActive]}
              onPress={() => changeView(tab.id)}
            >
              <Text style={[s.modeTabText, active && s.modeTabTextActive]}>{tab.label}</Text>
              {active ? <View style={s.modeTabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      {view === 'discover' && (
        <>
          {renderHeader('Events', 'Campus plans that are actually worth opening.')}
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Loading campus events...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={s.categoryWrap}>
                <View style={s.categoryHeaderRow}>
                  <Text style={s.categorySectionLabel}>Filters</Text>
                  <Pressable onPress={() => setCategoriesExpanded(!categoriesExpanded)}>
                    <Text style={s.categoryToggleText}>{categoriesExpanded ? 'Less' : 'More'}</Text>
                  </Pressable>
                </View>
                {categoriesExpanded ? (
                  <View style={s.categoryExpandedGrid}>
                    {ALL_CATEGORIES.map((category) => (
                      <CategoryChip
                        key={category}
                        category={category}
                        count={categoryCounts[category] || 0}
                        active={selectedCategories.has(category)}
                        onPress={() => toggleCategory(category)}
                      />
                    ))}
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryCollapsedRow}>
                    {ALL_CATEGORIES.slice(0, 5).map((category) => (
                      <CategoryChip
                        key={category}
                        category={category}
                        count={categoryCounts[category] || 0}
                        active={selectedCategories.has(category)}
                        onPress={() => toggleCategory(category)}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={s.inlineControls}>
                <Pressable style={s.inlineControl} onPress={() => setMajorSpecific(!isMajorSpecific)}>
                  <Text style={[s.inlineControlTitle, isMajorSpecific && s.inlineControlTitleActive]}>Major specific</Text>
                  <Text style={s.inlineControlValue}>{isMajorSpecific ? selectedMajor : 'Off'}</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.heroRail} snapToInterval={SCREEN_WIDTH - 52} decelerationRate="fast">
                {discoverEvents.map((event) => (
                  <HeroEventCard key={String(event.id)} event={event} onPress={() => setDetailEvent(event)} onMap={() => handleMapOpen(event)} />
                ))}
              </ScrollView>

              <Pressable style={s.swipeCta} onPress={() => changeView('swipe')}>
                <ArrowRight size={18} color={COLORS.textPrimary} />
                <Text style={s.swipeCtaText}>Swipe to explore</Text>
              </Pressable>
            </ScrollView>
          )}
        </>
      )}

      {view === 'list' && (
        <>
          {renderHeader('Events', 'Search, save, and share what is happening next.')}
          <View style={s.listSearchRow}>
            <View style={s.searchShell}>
              <Search size={18} color={COLORS.textTertiary} />
              <TextInput style={s.searchInput} placeholder="Search campus events..." placeholderTextColor={COLORS.textTertiary} value={searchQuery} onChangeText={setSearchQuery} clearButtonMode="while-editing" />
            </View>
            <Pressable style={s.filterButton} onPress={() => setSettingsVisible(true)}>
              <Filter size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>
          {loading ? (
            <View style={s.loadingWrap}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={s.loadingText}>Loading campus events...</Text></View>
          ) : (
            <FlatList
              data={filteredUpcomingEvents}
              keyExtractor={(event) => String(event.id)}
              contentContainerStyle={s.listScroll}
              renderItem={({ item }) => (
                <ListEventRow
                  event={item}
                  saved={savedEventIds.includes(String(item.id))}
                  scheduled={scheduledEvents.some((sObj) => String(sObj.id) === String(item.id))}
                  onPress={() => setDetailEvent(item)}
                  onSave={() => handleSaveToggle(item)}
                  onShare={() => handleShare(item)}
                  onSchedule={() => handleSchedule(item)}
                />
              )}
            />
          )}
        </>
      )}

      {view === 'swipe' && (
        <>
          <View style={s.swipeHeader}>
            <Pressable style={s.headerIconButton} onPress={() => changeView('discover')}>
              <ChevronLeft size={18} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={s.swipeProgress}>{activeSwipeEvent ? `${Math.min(swipeIndex + 1, swipeDeck.length)} of ${swipeDeck.length}` : 'Done'}</Text>
            <View style={s.swipeHeaderSpacer} />
          </View>
          {activeSwipeEvent ? (
            <SwipeEventCard event={activeSwipeEvent} pan={pan} opacity={opacity} onSwipeLeft={() => handleSwipeLeft(activeSwipeEvent)} onSwipeRight={() => handleSwipeRight(activeSwipeEvent)} onOpen={() => setDetailEvent(activeSwipeEvent)} />
          ) : (
            <View style={s.finishedWrap}>
              <Text style={s.finishedTitle}>All caught up</Text>
              <Text style={s.finishedSubtitle}>You have worked through every event in this deck.</Text>
              <Pressable style={s.finishedButton} onPress={() => changeView('discover')}><Text style={s.finishedButtonText}>Back to discover</Text></Pressable>
            </View>
          )}
          {activeSwipeEvent && (
            <View style={s.swipeActions}>
              <ActionButton color="#FF4D6D" onPress={() => handleSwipeLeft(activeSwipeEvent)}><ArrowRight size={28} color="#FFFFFF" style={{ transform: [{ rotate: '180deg' }] }} /></ActionButton>
              <ActionButton color="#2F80ED" onPress={() => { handleSchedule(activeSwipeEvent); handleGoogleCalendar(activeSwipeEvent); }}><CalendarIcon size={24} color="#FFFFFF" /></ActionButton>
              <ActionButton color="#3CCB6C" onPress={() => handleSwipeRight(activeSwipeEvent)}><ArrowRight size={28} color="#FFFFFF" /></ActionButton>
            </View>
          )}
        </>
      )}

      {view === 'inbox' && (
        <View style={{ flex: 1 }}>
          <View style={s.swipeHeader}>
            <Pressable style={s.headerIconButton} onPress={() => changeView('discover')}><ChevronLeft size={18} color={COLORS.textPrimary} /></Pressable>
            <Text style={s.swipeProgress}>Event inbox</Text>
            <View style={s.swipeHeaderSpacer} />
          </View>
          <ScrollView contentContainerStyle={s.inboxScroll}>
            {receivedInvites.length === 0 ? (
              <View style={s.emptyState}><Inbox size={42} color={COLORS.textTertiary} /><Text style={s.emptyTitle}>No invites yet</Text></View>
            ) : (
              receivedInvites.map((invite) => (
                <View key={invite.id} style={s.inviteCard}>
                  <Text style={s.inviteEyebrow}>From {invite.senderName}</Text>
                  <Text style={s.inviteTitle}>{invite.title}</Text>
                  <View style={s.inviteActions}>
                    <ActionButton color="#3CCB6C" small onPress={() => acceptInvite(invite.id)}><ArrowRight size={20} color="#FFFFFF" /></ActionButton>
                    <ActionButton color="#FF4D6D" small onPress={() => rejectInvite(invite.id)}><ArrowRight size={20} color="#FFFFFF" style={{ transform: [{ rotate: '180deg' }] }} /></ActionButton>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      <EventSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        isMajorSpecific={isMajorSpecific}
        selectedMajor={selectedMajor}
        setMajorSpecific={setMajorSpecific}
        setSelectedMajor={setSelectedMajor}
        socialMode={socialMode}
        setSocialMode={setSocialMode}
        selectedCategories={selectedCategories}
        dislikedEventIds={dislikedEventIds}
        events={events}
        onRestoreCategory={handleRestoreCategory}
      />

      <EventDetailModal
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onSaveToggle={handleSaveToggle}
        onSchedule={handleSchedule}
        onShare={handleShare}
        onMap={handleMapOpen}
        saved={detailEvent ? savedEventIds.includes(String(detailEvent.id)) : false}
      />
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean, embedded: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerBlock: { paddingTop: embedded ? 10 : 56, paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
    headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    pageTitle: { color: COLORS.textPrimary, fontSize: 36, fontWeight: '900', letterSpacing: -1.05 },
    pageSubtitle: { marginTop: 2, color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
    headerIconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    headerBadge: { position: 'absolute', right: -2, top: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#FF4D6D', alignItems: 'center', justifyContent: 'center' },
    headerBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
    modeTabs: { flexDirection: 'row', gap: 18, paddingTop: 2 },
    modeTab: { paddingVertical: 4, position: 'relative' },
    modeTabActive: { backgroundColor: 'transparent' },
    modeTabText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '700' },
    modeTabTextActive: { color: COLORS.textPrimary, fontWeight: '800' },
    modeTabUnderline: { marginTop: 6, height: 2.5, borderRadius: 999, backgroundColor: COLORS.primary },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 118 },
    categoryWrap: { gap: 12 },
    categoryHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    categorySectionLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
    categoryToggleText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
    categoryCollapsedRow: { gap: 8, paddingRight: 8 },
    categoryExpandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    inlineControls: { marginTop: 14, gap: 10 },
    inlineControl: { borderRadius: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 4 },
    inlineControlTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
    inlineControlTitleActive: { color: COLORS.primary },
    inlineControlValue: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
    heroRail: { paddingTop: 18, paddingRight: 20, gap: 14 },
    swipeCta: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    swipeCtaText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
    listSearchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 10 },
    searchShell: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
    searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
    filterButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
    listScroll: { paddingHorizontal: 18, paddingBottom: 126 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: COLORS.textSecondary, fontSize: 15 },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 64, gap: 10 },
    emptyTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900' },
    emptySubtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
    swipeHeader: { paddingTop: embedded ? 10 : 52, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    swipeProgress: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
    swipeHeaderSpacer: { width: 42, height: 42 },
    swipeActions: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 30 },
    finishedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    finishedTitle: { color: COLORS.textPrimary, fontSize: 30, fontWeight: '900' },
    finishedSubtitle: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center' },
    finishedButton: { marginTop: 12, borderRadius: 18, backgroundColor: COLORS.primary, paddingHorizontal: 22, paddingVertical: 14 },
    finishedButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    inboxScroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 12 },
    inviteCard: { marginTop: 8, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
    inviteEyebrow: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
    inviteTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 4 },
    inviteActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  });
