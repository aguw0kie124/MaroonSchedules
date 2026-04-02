import { useState, useMemo, useCallback } from 'react';
import { TAMUEvent, ExploreCategory, SocialMode, ALL_CATEGORIES, classifyCategory, getSocialMode, getSearchBlob, matchesMajor } from '../components/events/EventUtils';

export function useEventFilters(
  events: TAMUEvent[],
  dislikedEventIds: string[],
  isMajorSpecific: boolean,
  selectedMajor: string
) {
  const [selectedCategories, setSelectedCategories] = useState<Set<ExploreCategory>>(new Set());
  const [socialMode, setSocialMode] = useState<SocialMode>('casual');
  const [searchQuery, setSearchQuery] = useState('');
  
  const nowTs = Math.floor(Date.now() / 1000);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Sports: 0,
      Academic: 0,
      Food: 0,
      Social: 0,
      'Health & Wellness': 0,
      Entertainment: 0,
      Advocacy: 0,
      Miscellaneous: 0,
    };

    events.forEach((event) => {
      if (event.date_ts < nowTs) return;
      if (isMajorSpecific && !matchesMajor(event, selectedMajor)) return;
      const category = event._category || classifyCategory(event);
      counts[category as string] += 1;
    });

    return counts;
  }, [events, isMajorSpecific, nowTs, selectedMajor]);

  const filteredUpcomingEvents = useMemo(() => {
    let next = events.filter((event) => event.date_ts >= nowTs);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      next = next.filter((event) => (event._searchBlob || getSearchBlob(event)).includes(q));
    }

    if (isMajorSpecific) {
      next = next.filter((event) => matchesMajor(event, selectedMajor));
    }

    if (selectedCategories.size > 0) {
      next = next.filter((event) => selectedCategories.has(event._category || classifyCategory(event)));
    }

    if (selectedCategories.has('Social')) {
      next = next.filter((event) => {
        const category = event._category || classifyCategory(event);
        return category !== 'Social' || (event._socialMode || getSocialMode(event)) === socialMode;
      });
    }

    next = next.filter((event) => !dislikedEventIds.includes(String(event.id)));
    return next;
  }, [
    dislikedEventIds,
    events,
    isMajorSpecific,
    nowTs,
    searchQuery,
    selectedCategories,
    selectedMajor,
    socialMode,
  ]);

  const discoverEvents = useMemo(() => filteredUpcomingEvents.slice(0, 8), [filteredUpcomingEvents]);

  const swipeDeck = useMemo(() => {
    if (selectedCategories.size === 0) return filteredUpcomingEvents;
    return filteredUpcomingEvents.filter((event) => selectedCategories.has(event._category || classifyCategory(event)));
  }, [filteredUpcomingEvents, selectedCategories]);

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
