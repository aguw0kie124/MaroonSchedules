import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Platform,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { 
  GestureHandlerRootView, 
  PanGestureHandler, 
  State,
  Gesture,
  GestureDetector
} from 'react-native-gesture-handler';
import AnimatedReanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import {
  BadgeCheck,
  BellOff,
  CircleAlert,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  ChevronLeft,
  Funnel,
  Filter,
  GraduationCap,
  Heart,
  HeartPulse,
  Inbox,
  Layers,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Pizza,
  Search,
  Share2,

  Ticket,
  Trash2,
  Trophy,
  Users,
  UserX,
  X as XIcon,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';


import { API_URL } from '../config';
import { fetchUserProfile, requestJson, saveCampusEventRsvp } from '../api/client';
import { normalizeImageUrl } from '../services/url';
import { TourTarget, useTour } from './onboarding/TourProvider';
import { triggerNativeShare } from '../utils/share';
import { useEventStore } from '../store/eventStore';
import type { MajorOption, ScheduledEvent } from '../store/eventStore';
import { useTheme, WallpaperWrapper } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { useSessionStore } from '../store/sessionStore';
import { scheduleAdminEventReviewNotification, scheduleEventNotification } from '../services/notificationService';
import { promptGuestLogin } from '../utils/guestAccess';
import { blockUser, reportContent, getPingFeed } from '../services/socialFeedService';
import { TagChips } from './common/TagChips';
import { getEventImage } from './events/EventImages';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_CARD_WIDTH = SCREEN_WIDTH - 40;
const HERO_CARD_HEIGHT = 440;
const HERO_CARD_GAP = 14;
const HERO_CARD_SNAP_INTERVAL = HERO_CARD_WIDTH + HERO_CARD_GAP;

interface CampusEventResponse {
  event_id: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  start_time: string;
  end_time?: string | null;
  link?: string | null;
  source_url?: string | null;
  host_name?: string | null;
  source_name?: string | null;
  tags?: string[] | null;
  access_tags?: string[] | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  image_url?: string | null;
  is_admin_event?: boolean;
  google_review_url?: string | null;
  admin_clerk_id?: string | null;
  organization_name?: string | null;
  campus_interest_score?: number | null;
  campus_interest_label?: 'low' | 'medium' | 'high' | null;
  campus_interest_reasons?: string[] | null;
}

interface TAMUEvent {
  id: string | number;
  title: string;
  date_ts: number;
  date_iso: string;
  date2_ts?: number | null;
  location?: string | null;
  location_title?: string | null;
  description?: string | null;
  url?: string;
  tags?: string[] | null;
  access_tags?: string[] | null;
  event_types?: string[] | null;
  group_title?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  imageUrl?: string | null;
  is_admin_event?: boolean;
  google_review_url?: string | null;
  admin_clerk_id?: string | null;
  campus_interest_score?: number | null;
  campus_interest_label?: 'low' | 'medium' | 'high' | null;
  campus_interest_reasons?: string[] | null;
  _searchBlob?: string;
  _category?: ExploreCategory;
  _forYouScore?: number;
  _forYouMatched?: boolean;
  _forYouReasons?: string[];
}

type ExploreCategory =
  | 'Featured'
  | 'For U'
  | 'Food'
  | 'Sports'
  | 'Social'
  | 'Miscellaneous'
  | 'Advocacy'
  | 'Academic'
  | 'Entertainment'
  | 'Health & Wellness';
type StandardExploreCategory = Exclude<ExploreCategory, 'For U' | 'Featured'>;

type PreferredTimeOption = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime' | null;

interface UserEventPreferences {
  major: MajorOption | null;
  preferredTime: PreferredTimeOption;
  avoidFriday: boolean;
  preferredCategories: ExploreCategory[];
  preferredInterests: string[];
}

const ALL_CATEGORIES: ExploreCategory[] = [
  'Featured',
  'For U',
  'Sports',
  'Academic',
  'Food',
  'Social',
  'Health & Wellness',
  'Entertainment',
  'Advocacy',
  'Miscellaneous',
];

const ALL_STANDARD_CATEGORIES = ALL_CATEGORIES.filter(
  (category): category is StandardExploreCategory => category !== 'Featured' && category !== 'For U',
);
const DEFAULT_SELECTED_CATEGORIES: ExploreCategory[] = ['Featured', 'For U'];
const FALLBACK_BROWSE_CATEGORIES: ExploreCategory[] = ['Featured', ...ALL_STANDARD_CATEGORIES];

const INTEREST_SIGNAL_CONFIG: Record<string, { categories: StandardExploreCategory[]; keywords: string[] }> = {
  fitness: {
    categories: ['Sports', 'Health & Wellness'],
    keywords: ['fitness', 'gym', 'workout', 'training', 'run', 'running', 'yoga', 'pilates'],
  },
  sports: {
    categories: ['Sports'],
    keywords: ['sports', 'game', 'match', 'tournament', 'athletic', 'intramural'],
  },
  music: {
    categories: ['Entertainment'],
    keywords: ['music', 'concert', 'band', 'dj', 'karaoke', 'choir'],
  },
  gaming: {
    categories: ['Entertainment', 'Social'],
    keywords: ['gaming', 'esports', 'game night', 'smash', 'nintendo', 'valorant'],
  },
  tech: {
    categories: ['Academic'],
    keywords: ['tech', 'coding', 'developer', 'software', 'hackathon', 'robotics', 'ai'],
  },
  art: {
    categories: ['Entertainment'],
    keywords: ['art', 'gallery', 'paint', 'design', 'creative', 'craft'],
  },
  volunteering: {
    categories: ['Advocacy', 'Social'],
    keywords: ['volunteer', 'service', 'charity', 'donation', 'community service'],
  },
  startups: {
    categories: ['Academic', 'Social'],
    keywords: ['startup', 'entrepreneur', 'founder', 'pitch', 'venture', 'innovation'],
  },
  food: {
    categories: ['Food'],
    keywords: ['food', 'free food', 'pizza', 'snacks', 'refreshments', 'lunch', 'dinner'],
  },
  outdoors: {
    categories: ['Sports', 'Social'],
    keywords: ['outdoor', 'hike', 'camp', 'nature', 'trail', 'park'],
  },
  culture: {
    categories: ['Entertainment', 'Social'],
    keywords: ['culture', 'cultural', 'international', 'heritage', 'language', 'multicultural'],
  },
  faith: {
    categories: ['Miscellaneous', 'Social'],
    keywords: ['faith', 'church', 'worship', 'prayer', 'religious', 'bible'],
  },
  social: {
    categories: ['Social'],
    keywords: ['social', 'mixer', 'meetup', 'hangout', 'party', 'friends'],
  },
  wellness: {
    categories: ['Health & Wellness'],
    keywords: ['wellness', 'mental health', 'mindfulness', 'meditation', 'self care', 'therapy'],
  },
};

const MAJOR_OPTIONS: MajorOption[] = [
  'Engineering',
  'Business',
  'Liberal Arts',
  'Agriculture',
  'Science',
  'Architecture',
  'Education',
  'Public Health',
  'Law',
  'Medicine',
];

function isExploreCategory(value: string): value is ExploreCategory {
  return ALL_CATEGORIES.includes(value as ExploreCategory);
}

function selectedCategoriesFromDeselects(deselected: string[]): Set<ExploreCategory> {
  const next = new Set(DEFAULT_SELECTED_CATEGORIES);
  deselected.forEach((cat) => {
    if (isExploreCategory(cat)) {
      next.delete(cat as ExploreCategory);
    }
  });
  return next.size ? next : new Set(DEFAULT_SELECTED_CATEGORIES);
}

function normalizePreferredCategories(categories: string[] | undefined) {
  return Array.from(new Set((categories || []).filter(isExploreCategory)));
}

function buildRecommendedSelectedCategories(
  preferredCategories: ExploreCategory[],
  hasForYouPrefs: boolean,
  deselectedCategories: string[],
) {
  const deselected = new Set(deselectedCategories.filter(isExploreCategory));
  const next = new Set<ExploreCategory>();

  if (!deselected.has('Featured')) {
    next.add('Featured');
  }
  if (hasForYouPrefs && !deselected.has('For U')) {
    next.add('For U');
  }

  preferredCategories.forEach((category) => {
    if (category !== 'For U' && !deselected.has(category)) {
      next.add(category);
    }
  });

  const hasBrowsableCategory = Array.from(next).some(
    (category) => category !== 'Featured' && category !== 'For U',
  );

  if (!hasBrowsableCategory) {
    ALL_STANDARD_CATEGORIES.forEach((category) => {
      if (!deselected.has(category)) {
        next.add(category);
      }
    });
  }

  return next.size ? next : new Set(FALLBACK_BROWSE_CATEGORIES);
}

function getMatchedInterestIds(event: TAMUEvent, preferredInterests: string[]) {
  if (!preferredInterests.length) {
    return [] as string[];
  }

  const category = event._category || classifyCategory(event);
  const blob = normalizeMajorBlob(event._searchBlob || getSearchBlob(event));

  return preferredInterests.filter((interestId) => {
    const config = INTEREST_SIGNAL_CONFIG[interestId];
    if (!config) {
      return false;
    }

    if (config.categories.includes(category as StandardExploreCategory)) {
      return true;
    }

    return config.keywords.some((keyword) => blob.includes(` ${keyword.toLowerCase().trim()} `));
  });
}

function getTimePreferenceScore(event: TAMUEvent, preference: PreferredTimeOption) {
  if (!preference || preference === 'Anytime') return 0;
  const hour = new Date(event.date_ts * 1000).getHours();
  if (preference === 'Morning') {
    return hour >= 5 && hour < 12 ? 14 : hour >= 12 && hour < 17 ? 4 : 0;
  }
  if (preference === 'Afternoon') {
    return hour >= 12 && hour < 17 ? 14 : hour >= 17 && hour < 22 ? 4 : 0;
  }
  if (preference === 'Evening') {
    return hour >= 17 && hour < 24 ? 14 : hour >= 12 && hour < 17 ? 4 : 0;
  }
  return 0;
}

function getPersonalizationScore(
  event: TAMUEvent,
  preferredCategories: ExploreCategory[],
  preferredInterests: string[],
  preferredSocialMode: SocialMode | null,
  preferredTime: PreferredTimeOption,
  preferredMajor: MajorOption | null,
) {
  let score = 0;
  const category = event._category || classifyCategory(event);
  const categoryIndex = preferredCategories.indexOf(category);
  if (categoryIndex >= 0) {
    score += 34 - categoryIndex * 6;
  }
  const interestMatches = getMatchedInterestIds(event, preferredInterests);
  if (interestMatches.length > 0) {
    score += 12 + Math.min(10, (interestMatches.length - 1) * 3);
  }
  if (category === 'Social' && preferredSocialMode) {
    if ((event._socialMode || getSocialMode(event)) === preferredSocialMode) {
      score += 16;
    }
  }
  if (preferredMajor && matchesMajor(event, preferredMajor)) {
    score += 10;
  }
  score += getTimePreferenceScore(event, preferredTime);
  if (event.is_admin_event || category === 'For U') {
    score += 6;
  }
  const hoursAway = Math.max(0, (event.date_ts - Math.floor(Date.now() / 1000)) / 3600);
  score += Math.max(0, 10 - Math.min(hoursAway / 12, 10));
  return score;
}



/** Returns true if a host/source name looks like an internal feed identifier. */
function isInternalSourceName(name: string | undefined | null): boolean {
  if (!name) return true;
  return /^(feeds?|transport_rss|rss_directory)[:\-_]/.test(name) ||
    /^[a-z_]+:feed_\d+$/i.test(name) ||
    name === 'legacy_tracker' ||
    name === 'admin_portal';
}

export const CATEGORY_META: Record<
  ExploreCategory,
  {
    accent: string;
    chipBg: string;
    chipText: string;
    cardTint: string;
    icon: React.ComponentType<any>;
  }
> = {
  Featured: {
    accent: '#FFD700',
    chipBg: '#FFF4CC',
    chipText: '#6B4F00',
    cardTint: '#D4A017',
    icon: BadgeCheck,
  },
  'For U': {
    accent: '#F6A4B2',
    chipBg: '#FFE3E8',
    chipText: '#8C2746',
    cardTint: '#F28BA1',
    icon: Heart,
  },
  Sports: {
    accent: '#71B7FF',
    chipBg: '#CFE7FF',
    chipText: '#173A66',
    cardTint: '#74A9F7',
    icon: Trophy,
  },
  Academic: {
    accent: '#FFC47A',
    chipBg: '#FFE0B9',
    chipText: '#5B3710',
    cardTint: '#F8B66A',
    icon: GraduationCap,
  },
  Food: {
    accent: '#BCE8C5',
    chipBg: '#DDF5E2',
    chipText: '#274E30',
    cardTint: '#6EBF7E',
    icon: Pizza,
  },
  Social: {
    accent: '#F7B4B8',
    chipBg: '#FFD7DA',
    chipText: '#6A2331',
    cardTint: '#E37E89',
    icon: Users,
  },
  'Health & Wellness': {
    accent: '#F8C5D4',
    chipBg: '#FFE0E8',
    chipText: '#6D2741',
    cardTint: '#E483A8',
    icon: HeartPulse,
  },
  Entertainment: {
    accent: '#D7C7FF',
    chipBg: '#E9DFFF',
    chipText: '#442A7C',
    cardTint: '#8C73E8',
    icon: Ticket,
  },
  Advocacy: {
    accent: '#BDE5D3',
    chipBg: '#D6F2E4',
    chipText: '#214E40',
    cardTint: '#6EB59A',
    icon: Megaphone,
  },
  Miscellaneous: {
    accent: '#D7DCE8',
    chipBg: '#ECEFF5',
    chipText: '#3A4458',
    cardTint: '#8A97B0',
    icon: CalendarDays,
  },
};

const DEFAULT_USER_EVENT_PREFERENCES: UserEventPreferences = {
  major: null,
  preferredTime: null,
  avoidFriday: false,
  preferredCategories: [],
  preferredInterests: [],
};

function normalizePreferredTime(value?: string | null): PreferredTimeOption {
  if (!value) return null;
  if (value === 'No Preference') {
    return 'Anytime';
  }
  if (value === 'Morning' || value === 'Afternoon' || value === 'Evening' || value === 'Anytime') {
    return value;
  }
  return null;
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function getSearchBlob(event: TAMUEvent) {
  return [
    event.title,
    event.description,
    event.location,
    event.location_title,
    event.group_title,
    ...(event.tags || []),
    ...(event.access_tags || []),
    ...(event.event_types || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function resolveEventImageUrl(value?: string | null) {
  return normalizeImageUrl(value);
}

function classifyCategory(event: TAMUEvent): ExploreCategory {
  if (event.is_admin_event) return 'Featured';
  if (event.categories) {
    if (event.categories.featured) return 'Featured';
    if (event.categories.food) return 'Food';
    if (event.categories.sports) return 'Sports';
    if (event.categories.entertainment) return 'Entertainment';
    if (event.categories.advocacy) return 'Advocacy';
    if (event.categories.academic) return 'Academic';
    if (event.categories.health_wellness) return 'Health & Wellness';
    if (event.categories.social) return 'Social';
    if (event.categories.miscellaneous || event.categories.religion) return 'Miscellaneous';
  }

  const blob = getSearchBlob(event);
  if (event.has_food || /\bfood\b|\bmeal\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bpizza\b|\brefreshments\b/.test(blob)) return 'Food';
  if (/\bsport\b|\bgame\b|\bmatch\b|\btournament\b|\bathletic\b|\bworkout\b/.test(blob)) return 'Sports';
  if (/\bconcert\b|\bshow\b|\bmovie\b|\bcomedy\b|\bmusic\b|\bperformance\b|\bfestival\b/.test(blob)) return 'Entertainment';
  if (/\badvocacy\b|\bactivism\b|\bawareness\b|\bvolunteer\b|\bjustice\b/.test(blob)) return 'Advocacy';
  if (/\blecture\b|\bseminar\b|\bstudy\b|\bresearch\b|\bacademic\b|\btutoring\b|\bscholar/i.test(blob)) return 'Academic';
  if (/\byoga\b|\bmental health\b|\bwellness\b|\bself.care\b|\btherapy\b|\bhealth fair/i.test(blob)) return 'Health & Wellness';
  if (/\bsocial\b|\bmixer\b|\bmeet\b|\bfriends\b|\bhangout\b|\bparty\b/i.test(blob)) return 'Social';
  return 'Miscellaneous';
}

function getSocialMode(event: TAMUEvent): SocialMode {
  const blob = event._searchBlob || getSearchBlob(event);
  if (/\bcareer\b|\bnetworking\b|\bprofessional\b|\bresume\b|\binterview\b|\bcompany\b|\brecruit\b|\bworkshop\b|\bpanel\b/.test(blob)) {
    return 'professional';
  }
  return 'casual';
}

const MAJOR_KEYWORDS: Record<MajorOption, string[]> = {
  Engineering: [
    'engineering',
    'engineer',
    'engr',
    'mechanical',
    'electrical',
    'civil',
    'industrial',
    'biomedical',
    'petroleum',
    'aerospace',
    'csce',
    'computer science',
    'coding',
    'hackathon',
    'robotics',
  ],
  Business: [
    'business',
    'mays',
    'finance',
    'accounting',
    'marketing',
    'consulting',
    'entrepreneur',
    'entrepreneurship',
    'management',
    'supply chain',
    'economics',
  ],
  'Liberal Arts': [
    'liberal arts',
    'history',
    'english',
    'philosophy',
    'communication',
    'political science',
    'polisci',
    'journalism',
    'writing',
    'humanities',
    'language',
    'sociology',
  ],
  Agriculture: [
    'agriculture',
    'ag ',
    'agriculture',
    'animal science',
    'horticulture',
    'agronomy',
    'ranch',
    'livestock',
    'soil',
    'plant science',
    'agribusiness',
  ],
  Science: [
    'science',
    'biology',
    'biochem',
    'chemistry',
    'physics',
    'math',
    'mathematics',
    'laboratory',
    'lab',
    'research',
    'statistics',
    'geology',
  ],
  Architecture: [
    'architecture',
    'arch ',
    'arch.',
    'urban planning',
    'construction science',
    'design studio',
    'landscape',
    'environment design',
  ],
  Education: [
    'education',
    'teaching',
    'teacher',
    'curriculum',
    'classroom',
    'pedagogy',
    'educator',
  ],
  'Public Health': [
    'public health',
    'health policy',
    'community health',
    'epidemiology',
    'global health',
    'wellbeing',
    'wellness',
  ],
  Law: [
    'law',
    'legal',
    'pre-law',
    'prelaw',
    'attorney',
    'mock trial',
    'lsat',
  ],
  Medicine: [
    'medicine',
    'medical',
    'premed',
    'pre-med',
    'nursing',
    'clinical',
    'healthcare',
    'physician',
    'patient care',
    'dental',
  ],
};

function normalizeMajorBlob(blob: string) {
  return ` ${blob.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
}

function matchesMajor(event: TAMUEvent, major: MajorOption) {
  const blob = normalizeMajorBlob(event._searchBlob || getSearchBlob(event));
  return MAJOR_KEYWORDS[major]?.some((term) => blob.includes(` ${term.toLowerCase().trim()} `)) ?? false;
}

function matchesPreferredTime(event: TAMUEvent, preferredTime: PreferredTimeOption) {
  if (!preferredTime || preferredTime === 'Anytime') return true;
  const hour = new Date(event.date_ts * 1000).getHours();
  if (preferredTime === 'Morning') return hour >= 5 && hour < 11;
  if (preferredTime === 'Afternoon') return hour >= 11 && hour < 17;
  return hour >= 17 || hour < 1;
}

function isFridayEvent(event: TAMUEvent) {
  return new Date(event.date_ts * 1000).getDay() === 5;
}

function hasUserEventPreferences(preferences: UserEventPreferences) {
  return Boolean(
    preferences.major ||
    (preferences.preferredTime && preferences.preferredTime !== 'Anytime') ||
    preferences.avoidFriday ||
    preferences.preferredCategories.length > 0 ||
    preferences.preferredInterests.length > 0,
  );
}

function getForYouMeta(event: TAMUEvent, preferences: UserEventPreferences) {
  if (!hasUserEventPreferences(preferences)) {
    return { matched: false, score: 0, reasons: [] as string[] };
  }

  const reasons: string[] = [];
  let score = event.campus_interest_score ?? 42;
  const category = event._category || classifyCategory(event);
  const categoryMatch = preferences.preferredCategories.includes(category);
  const interestMatches = getMatchedInterestIds(event, preferences.preferredInterests);
  const majorMatch = preferences.major ? matchesMajor(event, preferences.major) : false;

  if (categoryMatch) {
    score += 26;
    reasons.push('category_match');
  }

  if (interestMatches.length > 0) {
    score += 18 + Math.min(12, (interestMatches.length - 1) * 4);
    reasons.push('interest_match');
  }

  if (majorMatch) {
    score += 20;
    reasons.push('major_match');
  }

  if (preferences.preferredTime && preferences.preferredTime !== 'Anytime') {
    if (matchesPreferredTime(event, preferences.preferredTime)) {
      score += 14;
      reasons.push('time_match');
    } else {
      score -= 6;
    }
  }

  if (preferences.avoidFriday) {
    if (isFridayEvent(event)) {
      score -= 18;
      reasons.push('friday_filtered');
    } else {
      score += 4;
      reasons.push('weekday_match');
    }
  }

  if (event.campus_interest_label === 'high') {
    score += 6;
    reasons.push('high_interest');
  } else if (event.campus_interest_label === 'medium') {
    score += 2;
    reasons.push('medium_interest');
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const matched =
    (!preferences.avoidFriday || !isFridayEvent(event)) &&
    (categoryMatch || interestMatches.length > 0 || majorMatch || normalizedScore >= 54);

  return {
    matched,
    score: normalizedScore,
    reasons,
  };
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatCalendarDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function shortDescription(text?: string | null) {
  if (!text) return null;
  const clean = stripHtml(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157).trim()}...`;
}

function EventRewardToast({
  visible,
  title,
  body,
}: {
  visible: boolean;
  title: string;
  body: string;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const confetti = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        id: index,
        left: 24 + index * 20,
        color: ['#F9C74F', '#43AA8B', '#F94144', '#577590'][index % 4],
      })),
    [],
  );

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 950,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={stylesStatic.rewardToastWrap}>
      {confetti.map((piece, index) => (
        <Animated.View
          key={`${piece.id}-${title}`}
          style={[
            stylesStatic.rewardConfetti,
            {
              left: piece.left,
              backgroundColor: piece.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.8, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 120 + (index % 3) * 14],
                  }),
                },
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, ((index % 5) - 2) * 12],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${150 + index * 15}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          stylesStatic.rewardToastCard,
          {
            opacity: progress.interpolate({
              inputRange: [0, 0.1, 0.86, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 0.12, 1],
                  outputRange: [12, 0, -8],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={stylesStatic.rewardToastEyebrow}>Yay</Text>
        <Text style={stylesStatic.rewardToastTitle}>{title}</Text>
        <Text style={stylesStatic.rewardToastBody}>{body}</Text>
      </Animated.View>
    </View>
  );
}

function StaggeredReveal({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    const delay = Math.min(index * 70, 420);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
        delay,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
        delay,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
        delay,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [index, opacity, scale, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      {children}
    </Animated.View>
  );
}

export function EventsCalendarScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const s = useMemo(() => getStyles(COLORS, isDark, embedded), [COLORS, isDark, embedded]);
  const isGuest = useSessionStore((state) => state.isGuest);
  const queryClient = useQueryClient();

  const { advanceStep, activeTargetName } = useTour();

  const [selectedCategories, setSelectedCategories] = useState<Set<ExploreCategory>>(
    () => new Set(['For U']),
  );
  const hasSelectedCategory = selectedCategories.size > 0;
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [detailEvent, setDetailEvent] = useState<TAMUEvent | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [profilePreferences, setProfilePreferences] = useState<UserEventPreferences>(DEFAULT_USER_EVENT_PREFERENCES);
  const [layoutMode, setLayoutMode] = useState<'discover' | 'list'>('discover');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const {
    isMajorSpecific,
    selectedMajor,
    setMajorSpecific,
    setSelectedMajor,
    scheduledEvents: persistedScheduledEvents,
    scheduleEvent,
    savedEventIds: persistedSavedEventIds,
    removeScheduledEvent,
    saveEvent,
    unsaveEvent,
    dislikedEventIds: persistedDislikedEventIds,
    dislikeEvent: storeDislikeEvent,
    removeIdsFromDisliked,
    clearDisliked,
    receivedInvites: persistedReceivedInvites,
    acceptInvite,
    rejectInvite,
    deselectedCategories,
    toggleCategoryDeselection,
  } = useEventStore();
  const scheduledEvents = persistedScheduledEvents || [];
  const savedEventIds = persistedSavedEventIds || [];
  const dislikedEventIds = persistedDislikedEventIds || [];
  const receivedInvites = persistedReceivedInvites || [];

  const [rewardToast, setRewardToast] = useState<{ title: string; body: string } | null>(null);
  const rewardToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedPreferenceLandingSignature = useRef<string | null>(null);

  const { viewedStoryIds, addViewedStory } = useAppShellStore();

  const { data: allFeedPings = [] } = useQuery({
    queryKey: ['campus-pings', API_URL],
    queryFn: async () => {
      const feed = await getPingFeed(100);
      return feed.map((act: any) => ({
        id: act.id,
        userId: (act.actor?.id || '').replace('SU:', ''),
        userName: act.actor?.name || 'Aggie User',
        userImage: act.actor?.image || null,
        title: act.text || '',
        body: act.custom?.ping_body || '',
        imageUrl: normalizeImageUrl(act.custom?.image_url || act.attachments?.[0]?.original),
        createdAt: act.time || new Date().toISOString(),
      }));
    },
    staleTime: 1000 * 60 * 5,
  });


  const nowTs = Math.floor(Date.now() / 1000);

  // New store integration for performance
  const preferredEventCategories = useAppShellStore((state) => state.preferredEventCategories);
  const preferredEventInterests = useAppShellStore((state) => state.preferredEventInterests);
  const preferredSocialMode = useAppShellStore((state) => state.preferredSocialMode);
  const storedPreferredTime = useAppShellStore((state) => state.preferredTime);
  const isEventPreferencesCompleted = useAppShellStore((state) => state.isEventPreferencesCompleted);

  const {
    data: events = [],
    isLoading: loading,
    refetch: fetchEvents,
    isRefetching: refreshing,
  } = useQuery({
    queryKey: ['campus-events', user?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '1000',
        student_relevant_only: 'false',
      });
      if (user?.id) {
        params.set('clerk_id', user.id);
      }
      const payload = (await requestJson(
        `/campus/events?${params.toString()}`,
      )) as { events?: CampusEventResponse[] } | CampusEventResponse[];
      const raw = Array.isArray(payload) ? payload : payload.events || [];
      return raw
        .filter((event) => event && event.event_id && event.title && event.start_time)
        .map((event) => {
          const startTs = Math.floor(new Date(event.start_time).getTime() / 1000);
          const endTs = event.end_time ? Math.floor(new Date(event.end_time).getTime() / 1000) : null;
          return {
            id: event.event_id,
            title: stripHtml(event.title),
            date_ts: Number.isFinite(startTs) ? startTs : 0,
            date_iso: event.start_time,
            date2_ts: Number.isFinite(endTs as number) ? endTs : null,
            location: event.location ? stripHtml(event.location) : null,
            location_title: event.location ? stripHtml(event.location) : null,
            description: event.description || event.summary || null,
            url: event.link || event.source_url || '',
            tags: event.tags || null,
            access_tags: event.access_tags || null,
            event_types: event.has_food ? ['Free Food'] : null,
            group_title: event.organization_name || (isInternalSourceName(event.host_name) ? '' : event.host_name) || '',
            location_lat: event.location_lat ?? null,
            location_lng: event.location_lng ?? null,
            has_food: !!event.has_food,
            food_confidence: event.food_confidence ?? 0,
            food_type: event.food_type ?? null,
            categories: event.categories || {},
            imageUrl: event.image_url || null,
            is_admin_event: !!event.is_admin_event,
            google_review_url: event.google_review_url || null,
            admin_clerk_id: event.admin_clerk_id || null,
            campus_interest_score: event.campus_interest_score || 0,
            campus_interest_label: event.campus_interest_label || null,
            campus_interest_reasons: event.campus_interest_reasons || [],
          };
        }) as TAMUEvent[];
    },
  });

  const normalizedPreferenceCategories = useMemo(
    () => normalizePreferredCategories(preferredEventCategories),
    [preferredEventCategories],
  );

  const effectiveProfilePreferences = useMemo(
    () => ({
      ...profilePreferences,
      preferredTime: normalizePreferredTime(storedPreferredTime ?? (user ? null : profilePreferences.preferredTime)),
      preferredCategories: normalizedPreferenceCategories,
      preferredInterests: preferredEventInterests.filter((entry): entry is string => typeof entry === 'string'),
    }),
    [normalizedPreferenceCategories, preferredEventInterests, profilePreferences, storedPreferredTime, user],
  );

  const personalizedEvents = useMemo(
    () =>
      events.map((event) => {
        const meta = getForYouMeta(event, effectiveProfilePreferences);
        return {
          ...event,
          _forYouMatched: meta.matched,
          _forYouScore: meta.score,
          _forYouReasons: meta.reasons,
        };
      }),
    [effectiveProfilePreferences, events],
  );

  const hasForYouPrefs = useMemo(
    () => hasUserEventPreferences(effectiveProfilePreferences),
    [effectiveProfilePreferences],
  );
  const profileMajor = effectiveProfilePreferences.major;
  const personalizationMajor = isMajorSpecific ? selectedMajor : profileMajor;
  const preferenceLandingSignature = useMemo(
    () =>
      JSON.stringify({
        completed: isEventPreferencesCompleted,
        categories: normalizedPreferenceCategories,
        interests: effectiveProfilePreferences.preferredInterests,
        hasForYouPrefs,
      }),
    [
      effectiveProfilePreferences.preferredInterests,
      hasForYouPrefs,
      isEventPreferencesCompleted,
      normalizedPreferenceCategories,
    ],
  );

  const handleRefresh = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  const triggerRewardToast = useCallback((title: string, body: string) => {
    if (rewardToastTimerRef.current) {
      clearTimeout(rewardToastTimerRef.current);
    }
    setRewardToast({ title, body });
    rewardToastTimerRef.current = setTimeout(() => setRewardToast(null), 980);
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<ExploreCategory, number> = {
      Featured: 0,
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
      const isOngoing = (event.date2_ts != null && event.date2_ts > nowTs) || (event.date_ts >= nowTs - 7200);
      if (!isOngoing) return;
      if (isMajorSpecific && !matchesMajor(event, selectedMajor)) return;
      if (event._forYouMatched) {
        counts['For U'] += 1;
      }
      const category = event._category || classifyCategory(event);
      counts[category] += 1;
    });

    return counts;
  }, [isMajorSpecific, nowTs, personalizedEvents, selectedMajor]);

  const standardSelectedCategories = useMemo(
    () =>
      Array.from(selectedCategories).filter(
        (category): category is StandardExploreCategory => category !== 'For U' && category !== 'Featured',
      ),
    [selectedCategories],
  );

  const isForYouSelected = selectedCategories.has('For U');
  const isFeaturedSelected = selectedCategories.has('Featured');

  const filteredUpcomingEvents = useMemo(() => {
    let next = personalizedEvents.filter((event) => {
      return (event.date2_ts != null && event.date2_ts > nowTs) || (event.date_ts >= nowTs - 7200);
    });

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      next = next.filter((event) => (event._searchBlob || getSearchBlob(event)).includes(q));
    }

    if (isMajorSpecific) {
      next = next.filter((event) => matchesMajor(event, selectedMajor) || (isFeaturedSelected && event.is_admin_event));
    }

    const hasNonFeaturedFilters = isForYouSelected || standardSelectedCategories.length > 0;

    if (hasNonFeaturedFilters) {
      next = next.filter((event) => {
        if (isFeaturedSelected && event.is_admin_event) return true;
        const category = event._category || classifyCategory(event);
        if (isForYouSelected && event._forYouMatched) return true;
        if (standardSelectedCategories.length > 0) {
          return category !== 'For U' && category !== 'Featured' && (standardSelectedCategories as ExploreCategory[]).includes(category);
        }
        return false;
      });
    } else if (isFeaturedSelected) {
      next = next.filter((event) => event.is_admin_event);
    }


    next = next.filter((event) => !dislikedEventIds.includes(String(event.id)));
    next = next.filter((event) => !scheduledEvents.some((s) => String(s.id) === String(event.id)));

    if (isForYouSelected) {
      next = [...next].sort((a, b) => {
        const scoreDiff = (b._forYouScore ?? 0) - (a._forYouScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.date_ts - b.date_ts;
      });
    } else {
      next = [...next].sort((left, right) => {
        if (isFeaturedSelected) {
          const leftAdmin = left.is_admin_event ? 1 : 0;
          const rightAdmin = right.is_admin_event ? 1 : 0;
          if (leftAdmin !== rightAdmin) return rightAdmin - leftAdmin;
        }
        const leftScore = getPersonalizationScore(
          left,
          normalizedPreferenceCategories,
          effectiveProfilePreferences.preferredInterests,
          preferredSocialMode,
          effectiveProfilePreferences.preferredTime,
          personalizationMajor,
        );
        const rightScore = getPersonalizationScore(
          right,
          normalizedPreferenceCategories,
          effectiveProfilePreferences.preferredInterests,
          preferredSocialMode,
          effectiveProfilePreferences.preferredTime,
          personalizationMajor,
        );
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return left.date_ts - right.date_ts;
      });
    }

    return next;
  }, [
    dislikedEventIds,
    personalizedEvents,
    isFeaturedSelected,
    isMajorSpecific,
    isForYouSelected,
    nowTs,
    normalizedPreferenceCategories,
    effectiveProfilePreferences.preferredInterests,
    effectiveProfilePreferences.preferredTime,
    deferredSearchQuery,
    preferredSocialMode,
    selectedCategories,
    selectedMajor,
    standardSelectedCategories,
    scheduledEvents,
    personalizationMajor,
  ]);

  const discoverEvents = useMemo(() => filteredUpcomingEvents, [filteredUpcomingEvents]);

  const swipeDeck = useMemo(() => {
    if (standardSelectedCategories.length === 0) return filteredUpcomingEvents;
    return filteredUpcomingEvents.filter((event) => {
      const category = event._category || classifyCategory(event);
      return category !== 'For U' && (standardSelectedCategories as ExploreCategory[]).includes(category);
    });
  }, [filteredUpcomingEvents, standardSelectedCategories]);

  const activeSwipeEvent = swipeDeck[swipeIndex] ?? null;

  useEffect(() => {
    setSwipeIndex(0);
  }, [selectedCategories, deferredSearchQuery, isMajorSpecific, selectedMajor, profileMajor, effectiveProfilePreferences.avoidFriday, effectiveProfilePreferences.preferredTime, effectiveProfilePreferences.preferredCategories, effectiveProfilePreferences.preferredInterests]);

  useEffect(() => {
    if (!isEventPreferencesCompleted) {
      return;
    }
    if (appliedPreferenceLandingSignature.current === preferenceLandingSignature) {
      return;
    }
    appliedPreferenceLandingSignature.current = preferenceLandingSignature;
    setSelectedCategories(
      buildRecommendedSelectedCategories(
        normalizedPreferenceCategories,
        hasForYouPrefs,
        deselectedCategories,
      ),
    );
  }, [deselectedCategories, embedded, hasForYouPrefs, isEventPreferencesCompleted, normalizedPreferenceCategories, preferenceLandingSignature, preferredSocialMode]);


  const toggleCategory = useCallback(
    (category: ExploreCategory) => {
      setSelectedCategories((prev) => {
        if (prev.has(category)) return new Set();
        return new Set([category]);
      });
    },
    [],
  );

  const handleSchedule = useCallback(
    async (event: TAMUEvent) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (!user) {
        promptGuestLogin(navigation, 'Scheduling requires an account.');
        return;
      }
      const eventId = String(event.id);
      const isScheduled = scheduledEvents.some((s) => String(s.id) === eventId);

      if (isScheduled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        removeScheduledEvent(eventId);
        try {
          await saveCampusEventRsvp({ clerk_id: user.id, event_id: eventId, response: 'none' });
        } catch (e) {}
        return;
      }
      
      const scheduled: ScheduledEvent = {
        id: eventId,
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const leadTime = useAppShellStore.getState().notificationLeadTime;
      if (useAppShellStore.getState().eventNotifications) {
        scheduleEventNotification(event.title, `Starts in ${leadTime} min at ${event.location || 'Campus'}`, new Date(event.date_ts * 1000), leadTime);
      }
      try {
        await saveCampusEventRsvp({ clerk_id: user.id, event_id: eventId, response: 'going' });
      } catch (e) {}
    },
    [user, scheduledEvents, removeScheduledEvent, scheduleEvent, navigation],
  );

  const handleShare = useCallback((event: TAMUEvent) => {
    triggerNativeShare({
      title: event.title,
      message: `${event.title} at ${event.location || 'TAMU'} on ${formatDate(event.date_ts)}`,
      url: event.url || undefined,
    });
  }, []);

  const handleMapOpen = useCallback((event: TAMUEvent) => {
    navigation.navigate('Main', {
      screen: 'Places',
      params: {
        initialLayer: 'Academic',
        eventFocus: {
          eventId: String(event.id),
          title: event.title,
          location: event.location,
          latitude: event.location_lat,
          longitude: event.location_lng,
          startTime: event.date_iso,
          link: event.url,
          hasFood: event.has_food,
        },
      },
    });
  }, [navigation]);

  const removeOrganizerEvents = useCallback((adminClerkId: string) => {
    queryClient.setQueryData(['campus-events', user?.id], (current: TAMUEvent[] | undefined) => {
      if (!current) return current;
      return current.filter((event) => event.admin_clerk_id !== adminClerkId);
    });
    setDetailEvent((current) => (current?.admin_clerk_id === adminClerkId ? null : current));
  }, [queryClient, user?.id]);

  const handleBlockOrganizer = useCallback(
    (event: TAMUEvent) => {
      if (!user?.id || !event.admin_clerk_id) {
        Alert.alert('Sign in required', 'Sign in to block organizers.');
        return;
      }

      const organizerName = event.group_title || 'this organizer';
      Alert.alert(
        'Block organizer?',
        `You will stop seeing events and social content from ${organizerName}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block organizer',
            style: 'destructive',
            onPress: async () => {
              try {
                await blockUser(event.admin_clerk_id as string, user.id);
                removeOrganizerEvents(event.admin_clerk_id as string);
                Alert.alert('Organizer blocked', `${organizerName} has been blocked.`);
              } catch (error) {
                console.warn('[Events] Block organizer error:', error);
                Alert.alert('Unable to block', 'We could not block this organizer right now.');
              }
            },
          },
        ],
      );
    },
    [removeOrganizerEvents, user?.id],
  );

  const handleReportOrganizer = useCallback((event: TAMUEvent) => {
    if (!user?.id || !event.admin_clerk_id) {
      Alert.alert('Sign in required', 'Sign in to report events.');
      return;
    }

    const submitReport = async (reason: string) => {
      try {
        await reportContent({
          reporteeId: event.admin_clerk_id as string,
          postType: 'post',
          postId: String(event.id),
          reason,
        });
        Alert.alert('Report received', 'Thank you for helping keep the community safe.');
      } catch (error) {
        console.warn('[Events] Report organizer error:', error);
        Alert.alert('Unable to submit report', 'We could not send that report right now.');
      }
    };

    Alert.alert('Report event', 'What is the issue with this event?', [
      { text: 'Spam', onPress: () => submitReport('spam') },
      { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
      { text: 'Harassment', onPress: () => submitReport('harassment') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [user?.id]);

  const handleUnsubscribeOrganizer = useCallback(
    (event: TAMUEvent) => {
      if (!user?.id || !event.admin_clerk_id) {
        Alert.alert('Sign in required', 'Sign in to manage organizer preferences.');
        return;
      }

      const organizerName = event.group_title || 'this organizer';
      Alert.alert(
        'Unsubscribe from organizer?',
        `You will stop seeing future featured events from ${organizerName}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unsubscribe',
            style: 'destructive',
            onPress: async () => {
              try {
                await requestJson(`/admin/admins/${event.admin_clerk_id}/unsubscribe`, {
                  method: 'POST',
                  body: JSON.stringify({ clerk_id: user.id }),
                });
                removeOrganizerEvents(event.admin_clerk_id as string);
                Alert.alert('Organizer muted', `You will no longer see events from ${organizerName}.`);
              } catch (error) {
                console.warn('[Events] Unsubscribe organizer error:', error);
                Alert.alert('Unable to update', 'We could not unsubscribe you from this organizer right now.');
              }
            },
          },
        ],
      );
    },
    [removeOrganizerEvents, user?.id],
  );

  const handleSaveToggle = useCallback((event: TAMUEvent) => {
    const id = String(event.id);
    if (savedEventIds.includes(id)) {
      unsaveEvent(id);
    } else {
      saveEvent(id);
    }
  }, [savedEventIds, saveEvent, unsaveEvent]);

  const handleRestoreCategory = useCallback((category?: ExploreCategory) => {
    if (category) {
      const ids = personalizedEvents
        .filter(ev => classifyCategory(ev) === category)
        .map(ev => String(ev.id));
      removeIdsFromDisliked(ids);
    } else {
      clearDisliked();
    }
  }, [personalizedEvents, removeIdsFromDisliked, clearDisliked]);

  const renderHeader = () => (
    <View style={[s.header, { height: 10 }]} />
  );

  const renderVerticalDiscovery = () => (
    <View style={s.discoverLayout}>
      <View style={s.discoverHeaderSection}>
        <View style={s.categoryWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20 }}>
            {!isSearching && (
              <Pressable 
                onPress={() => setSettingsVisible(true)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Filter size={18} color={COLORS.textPrimary} />
              </Pressable>
            )}
            {!isSearching ? (
              <Pressable 
                onPress={() => setIsSearching(true)}
                style={{ 
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Search size={18} color={COLORS.textSecondary} />
              </Pressable>
            ) : (
              <View style={{ 
                flex: 1, 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                borderRadius: 20,
                paddingHorizontal: 16,
                marginRight: 20,
                height: 40
              }}>
                <Search size={16} color={COLORS.textTertiary} />
                <TextInput
                  autoFocus
                  placeholder="Search events..."
                  placeholderTextColor={COLORS.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ 
                    flex: 1, 
                    marginLeft: 8, 
                    color: COLORS.textPrimary,
                    fontSize: 14,
                    fontWeight: '600',
                    padding: 0,
                  }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                    <XIcon size={16} color={COLORS.textTertiary} />
                  </Pressable>
                )}
                <Pressable 
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsSearching(false);
                    setSearchQuery('');
                  }}
                  style={{ marginLeft: 10 }}
                >
                  <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 13 }}>Cancel</Text>
                </Pressable>
              </View>
            )}

            {!isSearching && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[s.categoryCollapsedRow, { paddingHorizontal: 0, paddingLeft: 0 }]}
              >
                {ALL_CATEGORIES.map((category) => (
                  <CategoryChip
                    key={category}
                    category={category}
                    count={categoryCounts[category] || 0}
                    active={selectedCategories.has(category)}
                    dimmed={hasSelectedCategory && !selectedCategories.has(category)}
                    onPress={() => toggleCategory(category)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        <View style={s.inlineControls}>
        </View>

        <FlatList
          data={discoverEvents || []}
          keyExtractor={(item) => String(item?.id || Math.random())}
          renderItem={({ item, index }) => {
            if (!item) return null;
            return layoutMode === 'discover' ? (
              <View style={{ height: HERO_CARD_HEIGHT + 20, justifyContent: 'center' }}>
                <StaggeredReveal index={index}>
                  <SwipeableHeroCard
                    event={item}
                    scheduled={(scheduledEvents || []).some((scheduled) => String(scheduled.id) === String(item.id))}
                    onSchedule={() => handleSchedule(item)}
                    onPress={() => setDetailEvent(item)}
                    onMap={() => handleMapOpen(item)}
                    onDislike={() => storeDislikeEvent(String(item.id))}
                  />
                </StaggeredReveal>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 20 }}>
                <StaggeredReveal index={index}>
                  <ListEventRow
                    event={item}
                    isGuest={isGuest}
                    saved={savedEventIds.includes(String(item.id))}
                    scheduled={scheduledEvents.some((scheduled) => String(scheduled.id) === String(item.id))}
                    onPress={() => setDetailEvent(item)}
                    onDelete={() => storeDislikeEvent(String(item.id))}
                    onShare={() => handleShare(item)}
                    onSchedule={() => handleSchedule(item)}
                  />
                </StaggeredReveal>
              </View>
            );
          }}
          scrollEnabled={!loading}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        />
      </View>
    </View>
  );

  const renderSwipeFeed = () => (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.swipeWrap}>
        {swipeDeck.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No discovery events</Text>
            <Text style={s.emptySubtitle}>Try clearing your filters or hidden events</Text>
          </View>
        ) : (
          <SwipeableHeroCard
            key={activeSwipeEvent?.id}
            event={activeSwipeEvent!}
            onSwipeLeft={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              storeDislikeEvent(String(activeSwipeEvent!.id));
              setSwipeIndex((prev) => (prev + 1) % swipeDeck.length);
            }}
            onSwipeRight={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              handleSchedule(activeSwipeEvent!);
              setSwipeIndex((prev) => (prev + 1) % swipeDeck.length);
            }}
            onPress={() => setDetailEvent(activeSwipeEvent)}
          />
        )}

        <View style={s.swipeIndicators}>
          <Text style={s.swipeHint}>Swipe left to skip · Right to RSVP</Text>
          <div style={s.swipeDots}>
            {swipeDeck.slice(0, 10).map((_, i) => (
              <View
                key={i}
                style={[
                  s.swipeDot,
                  i === swipeIndex % 10 && { backgroundColor: COLORS.primary, width: 14 }
                ]}
              />
            ))}
          </div>
        </View>
      </View>
    </GestureHandlerRootView>
  );

  return (
    <View style={s.container}>
      <WallpaperWrapper>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {renderHeader()}
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Loading campus events...</Text>
            </View>
          ) : (
            renderVerticalDiscovery()
          )}

          <SettingsModal
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            isMajorSpecific={isMajorSpecific}
            selectedMajor={selectedMajor}
            setMajorSpecific={setMajorSpecific}
            setSelectedMajor={setSelectedMajor}
            selectedCategories={selectedCategories}
            dislikedEventIds={dislikedEventIds}
            events={personalizedEvents}
            onRestoreCategory={handleRestoreCategory}
            layoutMode={layoutMode}
            setLayoutMode={setLayoutMode}
            scheduledEvents={(scheduledEvents || []).map(se => (personalizedEvents || []).find(e => String(e.id) === String(se.id))!).filter(Boolean)}
            onSchedule={handleSchedule}
            onPressEvent={(e) => {
               setSettingsVisible(false);
               setDetailEvent(e);
            }}
          />

          <DetailModal
            event={detailEvent}
            onClose={() => setDetailEvent(null)}
            onSaveToggle={handleSaveToggle}
            onSchedule={handleSchedule}
            onShare={handleShare}
            onMap={handleMapOpen}
            onUnsubscribeOrganizer={handleUnsubscribeOrganizer}
            onBlockOrganizer={handleBlockOrganizer}
            onReportOrganizer={handleReportOrganizer}

            saved={detailEvent ? savedEventIds.includes(String(detailEvent.id)) : false}
            scheduled={detailEvent ? scheduledEvents.some((scheduled) => String(scheduled.id) === String(detailEvent.id)) : false}
            isGuest={isGuest}
          />
        </GestureHandlerRootView>
      </WallpaperWrapper>
      <EventRewardToast visible={!!rewardToast} title={rewardToast?.title || ''} body={rewardToast?.body || ''} />
    </View>
  );
}

function CategoryChip({
  category,
  count,
  active,
  dimmed = false,
  onPress,
}: {
  category: ExploreCategory;
  count: number;
  active: boolean;
  dimmed?: boolean;
  onPress: () => void;
}) {
  const { accent, chipBg, chipText, icon: Icon } = CATEGORY_META[category];
  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.categoryChip,
        {
          backgroundColor: active ? accent : chipBg,
          opacity: dimmed ? 0.42 : 1,
          borderWidth: active ? 2 : 1,
          borderColor: active ? '#FFFFFF' : `${chipText}26`,
          shadowOpacity: active ? 0.1 : 0.04,
        },
      ]}
    >
      <Icon size={15} color={active ? '#FFFFFF' : chipText} />
      <Text style={[stylesStatic.categoryChipText, { color: active ? '#FFFFFF' : chipText }]}>
        {category}
      </Text>
      <Text
        style={[
          stylesStatic.categoryChipCount,
          { color: active ? 'rgba(255,255,255,0.82)' : `${chipText}CC` },
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function SwipeableHeroCard({
  event,
  scheduled,
  onSchedule,
  onPress,
  onMap,
  onDislike,
  onSwipeLeft,
  onSwipeRight,
}: {
  event: TAMUEvent;
  scheduled: boolean;
  onSchedule: () => void;
  onPress: () => void;
  onMap: () => void;
  onDislike?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > 120) {
        runOnJS(LayoutAnimation.configureNext)(LayoutAnimation.Presets.easeInEaseOut);
        translateX.value = withSpring(SCREEN_WIDTH);
        opacity.value = withSpring(0);
        if (onSwipeRight) {
           runOnJS(onSwipeRight)();
        } else {
           runOnJS(onSchedule)();
        }
      } else if (e.translationX < -120) {
        runOnJS(LayoutAnimation.configureNext)(LayoutAnimation.Presets.easeInEaseOut);
        translateX.value = withSpring(-SCREEN_WIDTH);
        opacity.value = withSpring(0);
        if (onSwipeLeft) {
           runOnJS(onSwipeLeft)();
        } else if (onDislike) {
           runOnJS(onDislike)();
        }
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const leftIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 80], [0, 1], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [20, 80], [0.6, 1], Extrapolate.CLAMP) }],
  }));

  const rightIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, -20], [1, 0], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [-80, -20], [1, 0.6], Extrapolate.CLAMP) }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <AnimatedReanimated.View style={[animatedStyle, { position: 'relative', width: HERO_CARD_WIDTH, alignSelf: 'center' }]}>
        <AnimatedReanimated.View 
          style={[
            {
              position: 'absolute',
              left: -70,
              top: '50%',
              marginTop: -35,
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: '#3CCB6C',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            },
            leftIndicatorStyle
          ]}
        >
          <Check size={36} color="#FFFFFF" strokeWidth={3} />
        </AnimatedReanimated.View>

        <AnimatedReanimated.View 
          style={[
            {
              position: 'absolute',
              right: -70,
              top: '50%',
              marginTop: -35,
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: '#FF4D6D',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            },
            rightIndicatorStyle
          ]}
        >
          <XIcon size={36} color="#FFFFFF" strokeWidth={3} />
        </AnimatedReanimated.View>

        <HeroEventCard 
          event={event} 
          scheduled={scheduled} 
          onSchedule={onSchedule} 
          onPress={onPress} 
          onMap={onMap} 
        />
      </AnimatedReanimated.View>
    </GestureDetector>
  );
}

function HeroEventCard({
  event,
  scheduled,
  onSchedule,
  onPress,
  onMap,
}: {
  event: TAMUEvent;
  scheduled: boolean;
  onSchedule: () => void;
  onPress: () => void;
  onMap: () => void;
}) {
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const eventImage = getEventImage(event as any);

  return (
    <Pressable
      onPress={onPress}
      style={[stylesStatic.heroCard, { backgroundColor: meta.cardTint }]}
    >
      {eventImage ? (
        <View style={StyleSheet.absoluteFill}>
          <Image source={eventImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.84)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
      ) : (
        <>
          <View style={[stylesStatic.heroGlow, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
          <View style={[stylesStatic.heroGlowSmall, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
          <View style={[stylesStatic.heroIconHalo]}>
            <Icon size={96} color="rgba(255,255,255,0.12)" />
          </View>
        </>
      )}

      <View style={stylesStatic.heroTopRow}>
        <View style={stylesStatic.heroCategoryPill}>
          <Text style={stylesStatic.heroCategoryText}>{category}</Text>
        </View>
        {event.group_title ? (
          <View style={stylesStatic.verifiedPill}>
            <BadgeCheck size={14} color="#FFFFFF" />
            <Text style={stylesStatic.verifiedText}>Verified</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={stylesStatic.heroBottom}
        contentContainerStyle={stylesStatic.heroBottomContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled
      >
        <Text style={stylesStatic.heroTitle} numberOfLines={3} ellipsizeMode="tail">{event.title}</Text>

        {event.group_title ? (
          <View style={stylesStatic.heroOrganizerPill}>
            <BadgeCheck size={13} color="#FFFFFF" />
            <Text style={stylesStatic.heroOrganizerText} numberOfLines={1}>
              {event.group_title}
            </Text>
          </View>
        ) : null}
        <View style={stylesStatic.heroMetaRow}>
          <CalendarIcon size={17} color="#FFFFFF" />
          <Text style={stylesStatic.heroMetaText}>
            {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
          </Text>
        </View>
        <View style={stylesStatic.heroMetaRow}>
          <MapPin size={17} color="#FFFFFF" />
          <Text style={stylesStatic.heroMetaText}>{event.location || 'Campus'}</Text>
        </View>
      </ScrollView>

      <View style={stylesStatic.heroActionRow}>
        <Pressable
          style={[
            stylesStatic.heroActionButton,
            scheduled ? stylesStatic.heroActionSelected : stylesStatic.heroActionPrimary,
          ]}
          onPress={onSchedule}
        >
          {scheduled ? <Check size={15} color="#174F2E" /> : <CalendarDays size={15} color="#174F2E" />}
          <Text style={[stylesStatic.heroActionText, stylesStatic.heroActionPrimaryText]}>
            {scheduled ? 'Added' : 'Add to Plan'}
          </Text>
        </Pressable>

        {event.location_lat != null && event.location_lng != null ? (
          <Pressable style={stylesStatic.heroInlineMapButton} onPress={onMap}>
            <View style={stylesStatic.mapIconCircle}>
              <MapIcon size={14} color="#FFFFFF" />
            </View>
            <Text style={stylesStatic.heroInlineMapText}>Map</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function ListEventRow({
  event,
  isGuest,
  saved,
  scheduled,
  onPress,
  onDelete,
  onShare,
  onSchedule,
}: {
  event: TAMUEvent;
  isGuest: boolean;
  saved: boolean;
  scheduled: boolean;
  onPress: () => void;
  onDelete: () => void;
  onShare: () => void;
  onSchedule: () => void;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.listRow,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, paddingVertical: 12 },
      ]}
    >
      <View style={[stylesStatic.listThumb, { backgroundColor: meta.cardTint, width: 52, height: 52, borderRadius: 12 }]}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={[stylesStatic.listThumbImage, { borderRadius: 12 }]} resizeMode="cover" />
        ) : (
          <View style={stylesStatic.listThumbFallback}>
            <Icon size={22} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={stylesStatic.listContent}>
        <View style={stylesStatic.listTitleRow}>
          <Text style={[stylesStatic.listTitle, { color: COLORS.textPrimary, fontSize: 15 }]} numberOfLines={1}>
            {event.title}
          </Text>
          {event.group_title ? <BadgeCheck size={14} color="#2F80ED" /> : null}
        </View>
        {event.group_title ? (
          <Text style={[stylesStatic.listMeta, { color: COLORS.primary, fontSize: 13 }]} numberOfLines={1}>
            {event.group_title}
          </Text>
        ) : null}
        <Text style={[stylesStatic.listMeta, { color: COLORS.textSecondary, fontSize: 13 }]} numberOfLines={1}>
          {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
        </Text>
      </View>
      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Pressable
          onPress={onSchedule}
          style={[
            stylesStatic.listActionButton,
            {
              width: 36, height: 36,
              backgroundColor: scheduled ? '#FFE3E8' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
            },
          ]}
        >
          {scheduled ? <XIcon size={16} color="#FF4D6D" /> : <Check size={16} color="#3CCB6C" />}
        </Pressable>
      </View>
    </Pressable>
  );
}

function ActionButton({
  color,
  onPress,
  children,
  small = false,
}: {
  color: string;
  onPress: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.actionButton,
        small ? stylesStatic.actionButtonSmall : null,
        { backgroundColor: color },
      ]}
    >
      {children}
    </Pressable>
  );
}

function RSVPEventChip({ 
  event, 
  onRemove, 
  onPress 
}: { 
  event: TAMUEvent; 
  onRemove: () => void; 
  onPress: () => void;
}) {
  const { COLORS } = useTheme();
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: meta.cardTint + '20',
        borderRadius: 22,
        paddingLeft: 12,
        paddingRight: 8,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: meta.cardTint + '40',
        marginRight: 10,
        height: 44,
      }}
    >
      <meta.icon size={14} color={meta.cardTint} />
      <Text 
        style={{ 
          color: COLORS.textPrimary, 
          fontSize: 13, 
          fontWeight: '700', 
          marginLeft: 8,
          marginRight: 4,
          maxWidth: 140 
        }} 
        numberOfLines={1}
      >
        {event.title}
      </Text>
      <Pressable 
        onPress={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          padding: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.05)',
        }}
      >
        <XIcon size={14} color={COLORS.textTertiary} />
      </Pressable>
    </Pressable>
  );
}

function SettingsModal({
  visible,
  onClose,
  isMajorSpecific,
  selectedMajor,
  setMajorSpecific,
  setSelectedMajor,
  selectedCategories,
  dislikedEventIds,
  events,
  onRestoreCategory,
  layoutMode,
  setLayoutMode,
  scheduledEvents,
  onSchedule,
  onPressEvent,
}: {
  visible: boolean;
  onClose: () => void;
  isMajorSpecific: boolean;
  selectedMajor: MajorOption;
  setMajorSpecific: (val: boolean) => void;
  setSelectedMajor: (major: MajorOption) => void;
  selectedCategories: Set<ExploreCategory>;
  dislikedEventIds: string[];
  events: TAMUEvent[];
  onRestoreCategory: (category?: ExploreCategory) => void;
  layoutMode: 'discover' | 'list';
  setLayoutMode: (mode: 'discover' | 'list') => void;
  scheduledEvents: TAMUEvent[];
  onSchedule: (event: TAMUEvent) => void;
  onPressEvent: (event: TAMUEvent) => void;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={stylesStatic.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            stylesStatic.modalSheet,
            { backgroundColor: COLORS.surface, borderColor: COLORS.border },
          ]}
          onPress={() => { }}
        >
          <View style={stylesStatic.modalHeader}>
             <Text style={[stylesStatic.modalTitle, { color: COLORS.textPrimary }]}>Filters</Text>
             <Pressable onPress={onClose} style={stylesStatic.modalClose}>
                <XIcon size={22} color={COLORS.textPrimary} />
             </Pressable>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false}>
             {scheduledEvents && scheduledEvents.length > 0 && (
               <View style={{ marginBottom: 24 }}>
                 <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary, marginTop: 4, marginBottom: 12 }]}>
                   RSVP'd Events
                 </Text>
                 <ScrollView 
                   horizontal 
                   showsHorizontalScrollIndicator={false}
                   contentContainerStyle={{ paddingRight: 20 }}
                 >
                   {scheduledEvents.map((event) => (
                     <RSVPEventChip 
                       key={event.id} 
                       event={event} 
                       onRemove={() => onSchedule(event)}
                       onPress={() => onPressEvent(event)}
                     />
                   ))}
                 </ScrollView>
               </View>
             )}

             <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary, marginTop: scheduledEvents.length > 0 ? 0 : 4 }]}>
               Display Layout
             </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {(['discover', 'list'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setLayoutMode(mode);
                  }}
                  style={[
                    stylesStatic.layoutTabPill,
                    {
                      backgroundColor: layoutMode === mode ? COLORS.primary : isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                      borderColor: layoutMode === mode ? COLORS.primary : COLORS.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: layoutMode === mode ? '#FFFFFF' : COLORS.textSecondary,
                    }}
                  >
                    {mode === 'discover' ? 'Discover' : 'List'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Major filter
            </Text>
            <Pressable
              style={stylesStatic.modalOption}
              onPress={() => setMajorSpecific(!isMajorSpecific)}
            >
              <View>
                <Text style={[stylesStatic.modalOptionText, { color: COLORS.textPrimary }]}>
                  Major specific events only
                </Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Only show events relevant to your program
                </Text>
              </View>
              <View
                style={[
                  { width: 44, height: 24, borderRadius: 12, padding: 3 },
                  { backgroundColor: isMajorSpecific ? COLORS.primary : COLORS.border },
                ]}
              >
                <View
                  style={[
                    { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' },
                    isMajorSpecific && { alignSelf: 'flex-end' },
                  ]}
                />
              </View>
            </Pressable>

            {isMajorSpecific && (
              <View style={stylesStatic.majorSelectorList}>
                {MAJOR_OPTIONS.map((major) => (
                  <Pressable
                    key={major}
                    style={stylesStatic.majorOptionItem}
                    onPress={() => setSelectedMajor(major)}
                  >
                    <Text
                      style={[
                        stylesStatic.majorOptionText,
                        { color: selectedMajor === major ? COLORS.primary : COLORS.textSecondary },
                      ]}
                    >
                      {major}
                    </Text>
                    {selectedMajor === major && <Check size={16} color={COLORS.primary} />}
                  </Pressable>
                ))}
              </View>
            )}

            <View style={stylesStatic.modalDivider} />

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary, marginTop: 12 }]}>
              Recovery
            </Text>
            <Pressable style={stylesStatic.modalOption} onPress={() => onRestoreCategory()}>
              <Text style={[stylesStatic.modalOptionText, { color: '#FF4D6D' }]}>
                Restore all hidden events
              </Text>
            </Pressable>
            {(ALL_CATEGORIES || []).map((category) => {
              const count = (dislikedEventIds || []).filter((id) => {
                const event = (events || []).find((candidate) => String(candidate?.id) === id);
                return event && classifyCategory(event) === category;
              }).length;
              if (!count) return null;
              return (
                <Pressable
                  key={category}
                  style={stylesStatic.modalOption}
                  onPress={() => onRestoreCategory(category)}
                >
                  <Text style={[stylesStatic.modalOptionText, { color: COLORS.textPrimary }]}>
                    Restore {category}
                  </Text>
                  <Text style={[stylesStatic.modalMetaText, { color: COLORS.textSecondary }]}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailModal({
  event,
  onClose,
  onSaveToggle,
  onSchedule,
  onShare,
  onMap,
  onUnsubscribeOrganizer,
  onBlockOrganizer,
  onReportOrganizer,
  saved,
  scheduled,
  isGuest,
}: {
  event: TAMUEvent | null;
  onClose: () => void;
  onSaveToggle: (event: TAMUEvent) => void;
  onSchedule: (event: TAMUEvent) => void;
  onShare: (event: TAMUEvent) => void;
  onMap: (event: TAMUEvent) => void;
  onUnsubscribeOrganizer: (event: TAMUEvent) => void;
  onBlockOrganizer: (event: TAMUEvent) => void;
  onReportOrganizer: (event: TAMUEvent) => void;
  saved: boolean;
  scheduled: boolean;
  isGuest: boolean;
}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (event) {
      translateY.value = 0;
    }
  }, [event]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 150 || e.velocityY > 1000) {
        translateY.value = withSpring(800, { damping: 50, stiffness: 300 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, 400], [1, 0], Extrapolate.CLAMP),
  }));

  if (!event) return null;

  return (
    <Modal visible={!!event} transparent animationType="slide" onRequestClose={onClose}>
      <AnimatedReanimated.View style={[{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <GestureDetector gesture={panGesture}>
          <AnimatedReanimated.View
            style={[
              stylesStatic.detailSheet,
              { backgroundColor: COLORS.surface, borderColor: COLORS.border, maxHeight: '92%' },
              animatedStyle
            ]}
          >
            <View style={stylesStatic.handleBar} />
            
            <Pressable 
              onPress={onClose}
              style={{
                position: 'absolute',
                right: 20,
                top: 20,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <XIcon size={20} color={COLORS.textPrimary} />
            </Pressable>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingBottom: 60 }}
              bounces={false}
            >
              {event.imageUrl ? (
                <View style={[stylesStatic.detailImageWrap, { marginTop: 10 }]}>
                  <Image source={{ uri: event.imageUrl }} style={stylesStatic.detailImage} resizeMode="cover" />
                </View>
              ) : null}
              
              <View style={{ gap: 8, marginBottom: 20, paddingRight: 40 }}>
                 <Text style={[stylesStatic.detailTitle, { color: COLORS.textPrimary }]}>{event.title}</Text>
                 {event.group_title ? (
                   <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 16 }}>{event.group_title}</Text>
                 ) : null}
              </View>

              <View style={stylesStatic.detailMetaBlock}>
                <View style={stylesStatic.detailMetaRow}>
                  <CalendarIcon size={18} color={COLORS.textSecondary} />
                  <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                    {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
                  </Text>
                </View>
                {event.location ? (
                  <View style={stylesStatic.detailMetaRow}>
                    <MapPin size={18} color={COLORS.textSecondary} />
                    <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>{event.location}</Text>
                  </View>
                ) : null}
              </View>

              <View style={stylesStatic.modalDivider} />

              <Text style={[stylesStatic.detailDescription, { color: COLORS.textPrimary }]}>
                {stripHtml(event.description || 'No description provided.')}
              </Text>

              <View style={stylesStatic.detailActionGrid}>
                 <Pressable
                  style={[stylesStatic.primaryDetailButton, { backgroundColor: scheduled ? (isDark ? '#4A1D24' : '#FFE3E8') : COLORS.primary, flex: 1.5 }]}
                  onPress={() => onSchedule(event)}
                >
                  <Text style={[stylesStatic.primaryDetailButtonText, { color: scheduled ? '#FF4D6D' : '#FFFFFF' }]}>
                    {scheduled ? 'Remove from Plan' : 'Add to Plan'}
                  </Text>
                </Pressable>
                
                <Pressable 
                  onPress={() => onShare(event)}
                  style={[stylesStatic.detailSubAction, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
                >
                  <Share2 size={22} color={COLORS.textPrimary} />
                </Pressable>
              </View>

              {event.location_lat != null && (
                 <Pressable 
                  onPress={() => onMap(event)}
                  style={stylesStatic.detailMapPreview}
                 >
                    <MapIcon size={20} color={COLORS.primary} />
                    <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 15 }}>View on Campus Map</Text>
                 </Pressable>
              )}

              <View style={stylesStatic.detailFooterActions}>
                 <Pressable onPress={() => onBlockOrganizer(event)} style={stylesStatic.footerActionItem}>
                    <UserX size={16} color={COLORS.textTertiary} />
                    <Text style={{ color: COLORS.textTertiary, fontSize: 13, fontWeight: '600' }}>Block Organizer</Text>
                 </Pressable>
                 <Pressable onPress={() => onReportOrganizer(event)} style={stylesStatic.footerActionItem}>
                    <CircleAlert size={16} color={COLORS.textTertiary} />
                    <Text style={{ color: COLORS.textTertiary, fontSize: 13, fontWeight: '600' }}>Report Event</Text>
                 </Pressable>
              </View>
            </ScrollView>
          </AnimatedReanimated.View>
        </GestureDetector>
      </AnimatedReanimated.View>
    </Modal>
  );
}

const getStyles = (COLORS: any, isDark: boolean, embedded: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    header: {
      paddingTop: embedded ? 4 : 54,
      paddingHorizontal: 20,
      paddingBottom: 0,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTitle: {
      fontSize: 34,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -1.4,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    },
    modeTabs: {
      flexDirection: 'row',
      gap: 20,
    },
    modeTab: {
      paddingVertical: 4,
      position: 'relative',
    },
    modeTabText: {
      color: COLORS.textSecondary,
      fontSize: 15,
      fontWeight: '800',
    },
    modeTabTextActive: {
      color: COLORS.textPrimary,
      fontWeight: '900',
    },
    modeTabUnderline: {
      position: 'absolute',
      bottom: -4,
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    discoverLayout: {
      flex: 1,
    },
    discoverHeaderSection: {
      paddingBottom: 4,
    },
    categoryWrap: {
      gap: 10,
      marginTop: 4,
    },
    categoryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 20,
    },
    categorySectionLabel: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    categoryToggleText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    categoryCollapsedRow: {
      paddingHorizontal: 20,
      gap: 10,
    },
    categoryExpandedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    inlineControls: {
      marginTop: 2,
      gap: 10,
      paddingHorizontal: 20,
    },
    listSearchRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      marginTop: 6,
      marginBottom: 10,
    },
    searchShell: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 10,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    searchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    listScroll: {
      paddingHorizontal: 20,
      paddingBottom: 130,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    loadingText: {
      color: COLORS.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
      paddingTop: 80,
      gap: 12,
    },
    emptyTitle: {
      color: COLORS.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptySubtitle: {
      color: COLORS.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    swipeWrap: {
      flex: 1,
      paddingTop: 20,
    },
    swipeIndicators: {
      marginTop: 20,
      alignItems: 'center',
    },
    swipeHint: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 14,
    },
    swipeDots: {
      flexDirection: 'row',
      gap: 8,
    },
    swipeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.border,
    },
    swipeHeader: {
      paddingTop: embedded ? 10 : 54,
      paddingHorizontal: 20,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    swipeProgress: {
      color: COLORS.textPrimary,
      fontSize: 20,
      fontWeight: '900',
    },
    swipeHeaderSpacer: {
      width: 44,
      height: 44,
    },
    inboxScroll: {
      paddingHorizontal: 20,
      paddingBottom: 120,
      gap: 14,
    },
    inviteCard: {
      borderRadius: 28,
      padding: 20,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
    },
    inviteEyebrow: {
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    inviteTitle: {
      color: COLORS.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 26,
      marginBottom: 6,
    },
    inviteMeta: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    inviteLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    inviteLocation: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    inviteActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
  });

const stylesStatic = StyleSheet.create({
  rewardToastWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 100,
    alignItems: 'center',
    zIndex: 999,
    pointerEvents: 'none',
  },
  rewardToastCard: {
    minWidth: 240,
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: 'rgba(20,20,24,0.96)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 15,
  },
  rewardToastEyebrow: {
    color: '#F9C74F',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  rewardToastTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  rewardToastBody: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  rewardConfetti: {
    position: 'absolute',
    top: 8,
    width: 6,
    height: 12,
    borderRadius: 2,
  },
  heroCard: {
    width: HERO_CARD_WIDTH,
    height: HERO_CARD_HEIGHT,
    borderRadius: 36,
    overflow: 'hidden',
    padding: 26,
    justifyContent: 'space-between',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
  },
  heroGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  heroGlowSmall: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  heroIconHalo: {
    position: 'absolute',
    top: 30,
    right: 30,
    opacity: 0.18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCategoryPill: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroCategoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  heroBottom: {
    flex: 1,
    marginTop: 24,
  },
  heroBottomContent: {
    paddingBottom: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  heroOrganizerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  heroOrganizerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 240,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  heroMetaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  heroActionPrimary: {
    backgroundColor: '#FFFFFF',
  },
  heroActionSelected: {
    backgroundColor: '#FFE3E8',
  },
  heroActionPrimaryText: {
    color: '#174F2E',
    fontSize: 14,
    fontWeight: '900',
  },
  heroActionText: {
    fontSize: 14,
    fontWeight: '900',
  },
  heroInlineMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
  },
  heroInlineMapText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  listThumb: {
    width: 68,
    height: 68,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listThumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  listThumbFallback: {
    opacity: 0.7,
  },
  listContent: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  listMeta: {
    fontSize: 14,
    fontWeight: '600',
  },
  listActions: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  categoryChipCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSheet: {
    borderRadius: 36,
    width: SCREEN_WIDTH - 40,
    maxHeight: '80%',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  modalClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  modalOptionText: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalDivider: {
      height: 1.5,
      backgroundColor: 'rgba(0,0,0,0.05)',
      marginVertical: 10,
  },
  layoutTabPill: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 999,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
  },
  majorSelectorList: {
      marginTop: 4,
      marginBottom: 16,
      gap: 4,
  },
  majorOptionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 2,
  },
  majorOptionText: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
      marginRight: 12,
  },
  detailSheet: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 26,
    paddingTop: 12,
  },
  handleBar: {
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.12)',
      alignSelf: 'center',
      marginBottom: 24,
  },
  detailImageWrap: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 22,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 33,
    letterSpacing: -1,
  },
  detailMetaBlock: {
    gap: 10,
    marginBottom: 20,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailMetaText: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailDescription: {
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 26,
    fontWeight: '500',
  },
  detailActionGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
  },
  primaryDetailButton: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  detailSubAction: {
      width: 60,
      height: 60,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
  },
  primaryDetailButtonText: {
    fontSize: 17,
    fontWeight: '900',
  },
  detailMapPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 18,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: 'rgba(122,11,28,0.1)',
      backgroundColor: 'rgba(122,11,28,0.03)',
      marginBottom: 30,
  },
  detailFooterActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerActionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 8,
  },
  actionButton: {
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSmall: {
      flex: 1,
      padding: 10,
  },
});
