import { useState, useMemo, useCallback } from 'react';
import {
  TAMUEvent,
  ExploreCategory,
  SocialMode,
  classifyCategory,
  getForYouMeta,
  getSocialMode,
  getSearchBlob,
  matchesMajor,
  StandardExploreCategory,
  UserEventPreferences,
} from '../components/events/EventUtils';

export function useEventFilters(
  events: TAMUEvent[],
  dislikedEventIds: string[],
  isMajorSpecific: boolean,
  selectedMajor: string,
  preferences: UserEventPreferences = { major: null, preferredTime: null, avoidFriday: false },
) {
  const [selectedCategories, setSelectedCategories] = useState<Set<ExploreCategory>>(new Set());
  const [socialMode, setSocialMode] = useState<SocialMode>('casual');
  const [searchQuery, setSearchQuery] = useState('');
  
  const nowTs = Math.floor(Date.now() / 1000);
  const personalizedEvents = useMemo(
    () =>
      events.map((event) => {
        const meta = getForYouMeta(event, preferences);
        return {
          ...event,
          _forYouMatched: meta.matched,
          _forYouScore: meta.score,
          _forYouReasons: meta.reasons,
        };
      }),
    [events, preferences],
  );
  const standardSelectedCategories = useMemo(
    () =>
      Array.from(selectedCategories).filter(
        (category): category is StandardExploreCategory => category !== 'For U',
      ),
    [selectedCategories],
  );
  const isForYouSelected = selectedCategories.has('For U');

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'For U': 0,
      Sports: 0,
      Academic: 0,
      Food: 0,
      Social: 0,
      'Health & Wellness': 0,
      Entertainment: 0,
      Advocacy: 0,
      Miscellaneous: 0,
    };

    personalizedEvents.forEach((event) => {
      if (event.date_ts < nowTs) return;
      if (isMajorSpecific && !matchesMajor(event, selectedMajor)) return;
      if (event._forYouMatched) {
        counts['For U'] += 1;
      }
      const category = event._category || classifyCategory(event);
      counts[category as string] += 1;
    });

    return counts;
  }, [isMajorSpecific, nowTs, personalizedEvents, selectedMajor]);

  const filteredUpcomingEvents = useMemo(() => {
    let next = personalizedEvents.filter((event) => event.date_ts >= nowTs);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      next = next.filter((event) => (event._searchBlob || getSearchBlob(event)).includes(q));
    }

    if (isMajorSpecific) {
      next = next.filter((event) => matchesMajor(event, selectedMajor));
    }

    if (isForYouSelected) {
      next = next.filter((event) => event._forYouMatched);
    }

    if (standardSelectedCategories.length > 0) {
      next = next.filter((event) => {
        const category = event._category || classifyCategory(event);
        return category !== 'For U' && standardSelectedCategories.includes(category);
      });
    }

    if (standardSelectedCategories.includes('Social')) {
      next = next.filter((event) => {
        const category = event._category || classifyCategory(event);
        return category !== 'Social' || (event._socialMode || getSocialMode(event)) === socialMode;
      });
    }

    next = next.filter((event) => !dislikedEventIds.includes(String(event.id)));
    if (isForYouSelected) {
      next = [...next].sort((a, b) => {
        const scoreDiff = (b._forYouScore ?? 0) - (a._forYouScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.date_ts - b.date_ts;
      });
    }
    return next;
  }, [
    dislikedEventIds,
    personalizedEvents,
    isMajorSpecific,
    isForYouSelected,
    nowTs,
    preferences,
    searchQuery,
    selectedMajor,
    socialMode,
    standardSelectedCategories,
  ]);

  const discoverEvents = useMemo(() => filteredUpcomingEvents.slice(0, 8), [filteredUpcomingEvents]);

  const swipeDeck = useMemo(() => {
    if (standardSelectedCategories.length === 0) return filteredUpcomingEvents;
    return filteredUpcomingEvents.filter((event) => {
      const category = event._category || classifyCategory(event);
      return category !== 'For U' && standardSelectedCategories.includes(category);
    });
  }, [filteredUpcomingEvents, standardSelectedCategories]);

  const toggleCategory = useCallback((category: ExploreCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    socialMode,
    setSocialMode,
    categoryCounts,
    filteredUpcomingEvents,
    discoverEvents,
    swipeDeck,
    toggleCategory,
  };
}
