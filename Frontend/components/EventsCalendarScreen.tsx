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
import { useNavigation, useRoute } from '@react-navigation/native';
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
  ChevronRight,
  GraduationCap,
  Heart,
  HeartPulse,
  Inbox,
  Map,
  MapPin,
  Megaphone,
  Pizza,
  Search,
  Share2,
  SlidersHorizontal,

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
import { blockUser, reportContent } from '../services/socialFeedService';
import { TagChips } from './common/TagChips';
import { getEventImage } from './events/EventImages';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_CARD_WIDTH = SCREEN_WIDTH - 40;
const HERO_CARD_HEIGHT = 324;
const HERO_CARD_GAP = 14;
const HERO_CARD_SNAP_INTERVAL = HERO_CARD_WIDTH + HERO_CARD_GAP;
const HERO_DOT_SIZE = 6;
const HERO_DOT_GAP = 8;
const HERO_DOT_STEP = HERO_DOT_SIZE + HERO_DOT_GAP;
const DISCOVER_RAIL_CARD_WIDTH = Math.min(SCREEN_WIDTH - 112, 264);
const DISCOVER_HERO_LIMIT = 5;
const DISCOVER_SECTION_LIMIT = 6;

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
  event_scope?: string | null;
  area_label?: string | null;
  is_off_campus?: boolean;
  is_promotion?: boolean;
  city?: string | null;
  business_name?: string | null;
  discount_text?: string | null;
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
  event_scope?: string | null;
  area_label?: string | null;
  is_off_campus?: boolean;
  is_promotion?: boolean;
  city?: string | null;
  business_name?: string | null;
  discount_text?: string | null;
  _searchBlob?: string;
  _category?: ExploreCategory;
  _socialMode?: SocialMode;
  _forYouScore?: number;
  _forYouMatched?: boolean;
  _forYouReasons?: string[];
}

type ExploreCategory =
  | 'Featured'
  | 'For U'
  | 'Food'
  | 'Promotions'
  | 'Sports'
  | 'Social'
  | 'Miscellaneous'
  | 'Advocacy'
  | 'Academic'
  | 'Entertainment'
  | 'Health & Wellness';
type ListFilterOption = 'All' | ExploreCategory;
type StandardExploreCategory = Exclude<ExploreCategory, 'For U' | 'Featured'>;

type SocialMode = 'casual' | 'professional';
type EventsView = 'discover' | 'list' | 'swipe' | 'inbox';
type PreferredTimeOption = 'Morning' | 'Afternoon' | 'Evening' | 'Anytime' | null;
type DateFilterOption = 'Any Time' | 'Today' | 'This Week' | 'This Weekend' | 'Next 7 Days';

type DiscoverSection = {
  key: Exclude<ExploreCategory, 'Featured'>;
  title: string;
  events: TAMUEvent[];
};

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
  'Promotions',
  'Social',
  'Health & Wellness',
  'Entertainment',
  'Advocacy',
  'Miscellaneous',
];
const LIST_FILTER_OPTIONS: ListFilterOption[] = ['All', ...ALL_CATEGORIES];

const ALL_STANDARD_CATEGORIES = ALL_CATEGORIES.filter(
  (category): category is StandardExploreCategory => category !== 'Featured' && category !== 'For U',
);
const DEFAULT_SELECTED_CATEGORIES: ListFilterOption[] = ['All'];
const DISCOVER_SECTION_ORDER: StandardExploreCategory[] = [
  'Sports',
  'Academic',
  'Food',
  'Promotions',
  'Social',
  'Entertainment',
  'Health & Wellness',
  'Miscellaneous',
];
const DISCOVER_SECTION_TITLES: Record<Exclude<ExploreCategory, 'Featured'>, string> = {
  'For U': 'For You',
  Academic: 'Academic & Career',
  Sports: 'Sports',
  Food: 'Food',
  Promotions: 'Promotions',
  Social: 'Social',
  Entertainment: 'Entertainment',
  'Health & Wellness': 'Health & Wellness',
  Advocacy: 'Advocacy',
  Miscellaneous: 'More to Explore',
};
const DEFAULT_LOCATION_FILTER = 'Everywhere';
const DATE_FILTER_OPTIONS: DateFilterOption[] = ['Any Time', 'Today', 'This Week', 'This Weekend', 'Next 7 Days'];

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

function selectedCategoriesFromDeselects(_deselected: string[]): Set<ListFilterOption> {
  return new Set(DEFAULT_SELECTED_CATEGORIES);
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
    return new Set<ListFilterOption>(DEFAULT_SELECTED_CATEGORIES);
  }

  return next.size
    ? new Set<ListFilterOption>(next)
    : new Set<ListFilterOption>(DEFAULT_SELECTED_CATEGORIES);
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
  let score = Math.max(0, (event.campus_interest_score ?? 42) / 8);
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
  Promotions: {
    accent: '#FFD59E',
    chipBg: '#FFF0DB',
    chipText: '#7A4A11',
    cardTint: '#F2A75B',
    icon: Megaphone,
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
    event.area_label,
    event.city,
    event.business_name,
    event.discount_text,
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

function joinMetaParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part || '').trim())
    .filter((part, index, array) => part.length > 0 && array.indexOf(part) === index)
    .join(' • ');
}

function getEventAreaLabel(event: TAMUEvent) {
  return event.area_label || (event.is_off_campus ? event.city || 'Off Campus' : 'Campus');
}

function getEventScopeLabel(event: TAMUEvent) {
  if (event.is_admin_event) return 'Official Campus';
  if (event.is_promotion) return 'Promotion';
  if (event.is_off_campus) return 'Off Campus';
  return 'Campus';
}

function getEventBadgeLabel(event: TAMUEvent) {
  if (event.is_admin_event) return 'Official';
  if (event.is_off_campus) return getEventAreaLabel(event);
  return null;
}

function getEventContextLine(event: TAMUEvent) {
  return joinMetaParts(
    getEventScopeLabel(event),
    event.group_title || event.business_name || null,
    event.is_off_campus ? getEventAreaLabel(event) : null,
  );
}

function matchesDateFilter(event: TAMUEvent, filter: DateFilterOption, referenceTs: number) {
  if (filter === 'Any Time') return true;

  const eventDate = new Date(event.date_ts * 1000);
  const referenceDate = new Date(referenceTs * 1000);
  const startOfToday = new Date(referenceDate);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfEventDay = new Date(eventDate);
  startOfEventDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((startOfEventDay.getTime() - startOfToday.getTime()) / 86400000);

  if (filter === 'Today') {
    return diffDays === 0;
  }
  if (filter === 'Next 7 Days') {
    return diffDays >= 0 && diffDays <= 6;
  }
  if (filter === 'This Week') {
    return diffDays >= 0 && diffDays <= 7;
  }
  if (filter === 'This Weekend') {
    const day = eventDate.getDay();
    return diffDays >= 0 && diffDays <= 7 && (day === 5 || day === 6 || day === 0);
  }
  return true;
}

function matchesLocationFilter(event: TAMUEvent, filter: string) {
  if (!filter || filter === DEFAULT_LOCATION_FILTER) {
    return true;
  }
  if (filter === 'Campus') {
    return !event.is_off_campus;
  }
  const area = getEventAreaLabel(event).toLowerCase();
  const city = (event.city || '').toLowerCase();
  const location = (event.location || '').toLowerCase();
  const normalizedFilter = filter.toLowerCase();
  return (
    area === normalizedFilter ||
    city === normalizedFilter ||
    location.includes(normalizedFilter)
  );
}

function classifyCategory(event: TAMUEvent): ExploreCategory {
  if (event.is_admin_event) return 'Featured';
  if (event.categories) {
    if (event.categories.featured) return 'Featured';
    if (event.categories.promotions || event.is_promotion) return 'Promotions';
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
  if (event.is_promotion || /\bpromotion\b|\bspecial\b|\bdiscount\b|\bcoupon\b|\bhappy hour\b|\bstudent night\b/.test(blob)) return 'Promotions';
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

function formatDateBadge(ts: number, referenceTs = Date.now() / 1000) {
  const targetDate = new Date(ts * 1000);
  const referenceDate = new Date(referenceTs * 1000);
  targetDate.setHours(0, 0, 0, 0);
  referenceDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((targetDate.getTime() - referenceDate.getTime()) / 86400000);
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  return formatCalendarDate(ts).toUpperCase();
}

function sortDiscoverHeroEvents(left: TAMUEvent, right: TAMUEvent) {
  const adminDiff = Number(right.is_admin_event) - Number(left.is_admin_event);
  if (adminDiff !== 0) return adminDiff;

  const matchedDiff = Number(right._forYouMatched) - Number(left._forYouMatched);
  if (matchedDiff !== 0) return matchedDiff;

  const scoreDiff = (right._forYouScore ?? 0) - (left._forYouScore ?? 0);
  if (scoreDiff !== 0) return scoreDiff;

  const interestDiff = (right.campus_interest_score ?? 0) - (left.campus_interest_score ?? 0);
  if (interestDiff !== 0) return interestDiff;

  return left.date_ts - right.date_ts;
}

function sortDiscoverRailEvents(left: TAMUEvent, right: TAMUEvent) {
  const matchedDiff = Number(right._forYouMatched) - Number(left._forYouMatched);
  if (matchedDiff !== 0) return matchedDiff;

  const scoreDiff = (right._forYouScore ?? 0) - (left._forYouScore ?? 0);
  if (scoreDiff !== 0) return scoreDiff;

  const interestDiff = (right.campus_interest_score ?? 0) - (left.campus_interest_score ?? 0);
  if (interestDiff !== 0) return interestDiff;

  return left.date_ts - right.date_ts;
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
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(18)).current;
  const scale = React.useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    const delay = Math.min(index * 70, 420);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [index, opacity, scale, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}



function handleGoogleCalendar(event: TAMUEvent) {
  const formatGCalDate = (ts: number) =>
    new Date(ts * 1000).toISOString().replace(/-|:|\.\d\d\d/g, '');

  const start = formatGCalDate(event.date_ts);
  const end = event.date2_ts
    ? formatGCalDate(event.date2_ts)
    : formatGCalDate(event.date_ts + 3600);
  const title = encodeURIComponent(event.title);
  const desc = encodeURIComponent(stripHtml(event.description || ''));
  const loc = encodeURIComponent(event.location || '');
  const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${desc}&location=${loc}`;
  Linking.openURL(url).catch((err) => console.warn('Error opening Google Calendar', err));
}

function openNativeMaps(lat: number, lng: number, label?: string | null) {
  const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${query}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${query}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}

export function EventsCalendarScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { COLORS, theme } = useTheme();
  const isDark = theme === 'dark';
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useUser();
  const s = useMemo(() => getStyles(COLORS, isDark, embedded), [COLORS, isDark, embedded]);
  const isGuest = useSessionStore((state) => state.isGuest);

  const { advanceStep, activeTargetName } = useTour();

  const [view, setView] = useState<EventsView>('discover');

  const [selectedCategories, setSelectedCategories] = useState<Set<ListFilterOption>>(
    () => new Set(DEFAULT_SELECTED_CATEGORIES),
  );
  const [socialMode, setSocialMode] = useState<SocialMode>('casual');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterOption>('Any Time');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState(DEFAULT_LOCATION_FILTER);
  const [isSearching, setIsSearching] = useState(false);
  const [detailEvent, setDetailEvent] = useState<TAMUEvent | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [discoverHeroIndex, setDiscoverHeroIndex] = useState(0);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [profilePreferences, setProfilePreferences] = useState<UserEventPreferences>(DEFAULT_USER_EVENT_PREFERENCES);
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
  const scheduledEventIdSet = useMemo(
    () => new Set(scheduledEvents.map((event) => String(event.id))),
    [scheduledEvents],
  );
  const savedEventIds = persistedSavedEventIds || [];
  const dislikedEventIds = persistedDislikedEventIds || [];
  const receivedInvites = persistedReceivedInvites || [];

  useEffect(() => {
    const routeEvent = route.params?.openEventDetail;
    if (!routeEvent) return;

    setDetailEvent(routeEvent);
    navigation.setParams({ openEventDetail: undefined });
  }, [navigation, route.params?.openEventDetail]);

  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const discoverHeroScrollX = useRef(new Animated.Value(0)).current;
  const hydratedProfileMajorForUser = useRef<string | null>(null);
  const nowTs = Math.floor(Date.now() / 1000);

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
            group_title:
              event.organization_name ||
              event.business_name ||
              (isInternalSourceName(event.host_name) ? '' : event.host_name) ||
              '',
            location_lat: event.location_lat ?? null,
            location_lng: event.location_lng ?? null,
            has_food: !!event.has_food,
            food_confidence: event.food_confidence ?? 0,
            food_type: event.food_type ?? null,
            categories: event.categories || undefined,
            imageUrl: resolveEventImageUrl(event.image_url ?? null),
            is_admin_event: !!event.is_admin_event,
            google_review_url: event.google_review_url ?? null,
            admin_clerk_id: event.admin_clerk_id ?? null,
            campus_interest_score: event.campus_interest_score ?? null,
            campus_interest_label: event.campus_interest_label ?? null,
            campus_interest_reasons: event.campus_interest_reasons ?? null,
            event_scope: event.event_scope ?? null,
            area_label: event.area_label ?? null,
            is_off_campus: !!event.is_off_campus,
            is_promotion: !!event.is_promotion,
            city: event.city ?? null,
            business_name: event.business_name ?? null,
            discount_text: event.discount_text ?? null,
          };
        })
        .map((event) => {
          const searchBlob = getSearchBlob(event);
          return {
            ...event,
            _searchBlob: searchBlob,
            _category: classifyCategory(event),
            _socialMode: getSocialMode({ ...event, _searchBlob: searchBlob }),
          };
        })
        .sort((a, b) => a.date_ts - b.date_ts);
    },
    staleTime: 1000 * 60 * 15, // 15 mins for events
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const [rewardToast, setRewardToast] = useState<{ title: string; body: string } | null>(null);
  const rewardToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAppliedInitialCategorySync = useRef(false);
  const appliedPreferenceLandingSignature = useRef<string | null>(null);
  const modeTabUnderlineLeft = useSharedValue(0);
  const modeTabUnderlineWidth = useSharedValue(0);
  const preferredEventCategories = useAppShellStore((state) => state.preferredEventCategories);
  const preferredEventInterests = useAppShellStore((state) => state.preferredEventInterests);
  const preferredSocialMode = useAppShellStore((state) => state.preferredSocialMode);
  const storedPreferredTime = useAppShellStore((state) => state.preferredTime);
  const isEventPreferencesCompleted = useAppShellStore((state) => state.isEventPreferencesCompleted);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setProfilePreferences(DEFAULT_USER_EVENT_PREFERENCES);
      hydratedProfileMajorForUser.current = null;
      return;
    }

    fetchUserProfile(user.id)
      .then((profile) => {
        if (cancelled) return;
        const nextMajor = MAJOR_OPTIONS.find((major) => major === profile?.major) ?? null;
        setProfilePreferences({
          major: nextMajor,
          preferredTime: normalizePreferredTime(profile?.preferred_time),
          avoidFriday: Boolean(profile?.avoid_friday),
          preferredCategories: [],
          preferredInterests: [],
        });
        if (nextMajor && hydratedProfileMajorForUser.current !== user.id) {
          setSelectedMajor(nextMajor);
          hydratedProfileMajorForUser.current = user.id;
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[Events] Failed to load user profile for personalization:', error);
          setProfilePreferences(DEFAULT_USER_EVENT_PREFERENCES);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setSelectedMajor, user?.id]);

  const normalizedPreferenceCategories = useMemo(
    () => normalizePreferredCategories(preferredEventCategories),
    [preferredEventCategories],
  );

  const effectiveProfilePreferences = useMemo(
    () => ({
      ...profilePreferences,
      preferredTime: normalizePreferredTime(storedPreferredTime ?? profilePreferences.preferredTime),
      preferredCategories: normalizedPreferenceCategories,
      preferredInterests: preferredEventInterests.filter((entry): entry is string => typeof entry === 'string'),
    }),
    [normalizedPreferenceCategories, preferredEventInterests, profilePreferences, storedPreferredTime],
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

  useEffect(() => {
    if (hasAppliedInitialCategorySync.current) {
      return;
    }
    hasAppliedInitialCategorySync.current = true;
    setSelectedCategories(selectedCategoriesFromDeselects(deselectedCategories));
  }, [deselectedCategories]);

  // On mount, ensure we respect persistent deselections for the default set
  useEffect(() => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      deselectedCategories.forEach((cat) => {
        if (isExploreCategory(cat)) {
          next.delete(cat as ExploreCategory);
        }
      });
      return next;
    });
  }, []); // Only on mount to apply stored manual overrides to the default session state

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
      Promotions: 0,
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
      if (!matchesDateFilter(event, selectedDateFilter, nowTs)) return;
      if (!matchesLocationFilter(event, selectedLocationFilter)) return;
      if (event._forYouMatched) {
        counts['For U'] += 1;
      }
      const category = event._category || classifyCategory(event);
      counts[category] += 1;
    });

    return counts;
  }, [isMajorSpecific, nowTs, personalizedEvents, selectedDateFilter, selectedLocationFilter, selectedMajor]);

  const locationFilterOptions = useMemo(() => {
    const labels = new Set<string>(['Campus']);
    personalizedEvents.forEach((event) => {
      if (event.is_off_campus) {
        labels.add(getEventAreaLabel(event));
      }
    });
    return [DEFAULT_LOCATION_FILTER, ...Array.from(labels)];
  }, [personalizedEvents]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isMajorSpecific) count += 1;
    if (selectedDateFilter !== 'Any Time') count += 1;
    if (selectedLocationFilter !== DEFAULT_LOCATION_FILTER) count += 1;
    return count;
  }, [isMajorSpecific, selectedDateFilter, selectedLocationFilter]);

  const allFilterCount = useMemo(() => {
    let next = personalizedEvents.filter((event) => {
      return (event.date2_ts != null && event.date2_ts > nowTs) || (event.date_ts >= nowTs - 7200);
    });

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      next = next.filter((event) => (event._searchBlob || getSearchBlob(event)).includes(q));
    }

    if (isMajorSpecific) {
      next = next.filter((event) => matchesMajor(event, selectedMajor) || event.is_admin_event);
    }

    next = next.filter((event) => matchesDateFilter(event, selectedDateFilter, nowTs));
    next = next.filter((event) => matchesLocationFilter(event, selectedLocationFilter));

    next = next.filter((event) => !dislikedEventIds.includes(String(event.id)));

    return next.length;
  }, [
    deferredSearchQuery,
    dislikedEventIds,
    isMajorSpecific,
    nowTs,
    personalizedEvents,
    selectedDateFilter,
    selectedLocationFilter,
    selectedMajor,
  ]);

  const standardSelectedCategories = useMemo(
    () =>
      Array.from(selectedCategories).filter(
        (category): category is StandardExploreCategory =>
          category !== 'All' && category !== 'For U' && category !== 'Featured',
      ),
    [selectedCategories],
  );

  const isAllSelected = selectedCategories.has('All');
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

    next = next.filter((event) => matchesDateFilter(event, selectedDateFilter, nowTs));
    next = next.filter((event) => matchesLocationFilter(event, selectedLocationFilter));

    // Apply category filters with Featured union semantics:
    // When Featured is active, admin events always pass through regardless of other filters
    const hasNonFeaturedFilters = isForYouSelected || standardSelectedCategories.length > 0;

    if (!isAllSelected) {
      if (hasNonFeaturedFilters) {
        next = next.filter((event) => {
          // Featured events always pass when Featured is selected
          if (isFeaturedSelected && event.is_admin_event) return true;

          const category = event._category || classifyCategory(event);

          if (isForYouSelected && event._forYouMatched) return true;

          if (standardSelectedCategories.length > 0) {
            return category !== 'For U' && category !== 'Featured' && standardSelectedCategories.includes(category);
          }

          return false;
        });
      } else if (isFeaturedSelected) {
        // Only Featured is selected — show admin events only
        next = next.filter((event) => event.is_admin_event);
      }
    }

    if (!isAllSelected && standardSelectedCategories.includes('Social')) {
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
    } else {
      next = [...next].sort((left, right) => {
        // Pin admin events to top when Featured is selected
        if (!isAllSelected && isFeaturedSelected) {
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
    isAllSelected,
    selectedCategories,
    selectedDateFilter,
    selectedLocationFilter,
    socialMode,
    standardSelectedCategories,
    personalizationMajor,
  ]);

  const discoverSourceEvents = useMemo(() => {
    let next = personalizedEvents.filter((event) => {
      return (event.date2_ts != null && event.date2_ts > nowTs) || (event.date_ts >= nowTs - 7200);
    });

    if (isMajorSpecific) {
      next = next.filter((event) => matchesMajor(event, selectedMajor) || event.is_admin_event);
    }

    next = next.filter((event) => matchesDateFilter(event, selectedDateFilter, nowTs));
    next = next.filter((event) => matchesLocationFilter(event, selectedLocationFilter));

    next = next.filter((event) => !dislikedEventIds.includes(String(event.id)));

    return [...next].sort(sortDiscoverRailEvents);
  }, [dislikedEventIds, isMajorSpecific, nowTs, personalizedEvents, selectedDateFilter, selectedLocationFilter, selectedMajor]);

  const discoverHeroEvents = useMemo(
    () => [...discoverSourceEvents].sort(sortDiscoverHeroEvents).slice(0, DISCOVER_HERO_LIMIT),
    [discoverSourceEvents],
  );

  const discoverSections = useMemo<DiscoverSection[]>(() => {
    const heroEventIds = new Set(discoverHeroEvents.map((event) => String(event.id)));
    const remainingEvents = discoverSourceEvents.filter((event) => !heroEventIds.has(String(event.id)));
    const nextSections: DiscoverSection[] = [];

    const forYouEvents = [...remainingEvents]
      .filter((event) => event._forYouMatched)
      .sort((left, right) => {
        const scoreDiff = (right._forYouScore ?? 0) - (left._forYouScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return left.date_ts - right.date_ts;
      })
      .slice(0, DISCOVER_SECTION_LIMIT);

    if (forYouEvents.length > 0) {
      nextSections.push({
        key: 'For U',
        title: DISCOVER_SECTION_TITLES['For U'],
        events: forYouEvents,
      });
    }

    DISCOVER_SECTION_ORDER.forEach((category) => {
      const sectionEvents = remainingEvents
        .filter((event) => {
          const eventCategory = event._category || classifyCategory(event);
          if (category === 'Miscellaneous') {
            return eventCategory === 'Miscellaneous' || eventCategory === 'Advocacy';
          }
          return eventCategory === category;
        })
        .sort(sortDiscoverRailEvents)
        .slice(0, DISCOVER_SECTION_LIMIT);

      if (sectionEvents.length > 0) {
        nextSections.push({
          key: category,
          title: DISCOVER_SECTION_TITLES[category],
          events: sectionEvents,
        });
      }
    });

    return nextSections;
  }, [discoverHeroEvents, discoverSourceEvents]);

  const swipeDeck = useMemo(() => {
    if (standardSelectedCategories.length === 0) return filteredUpcomingEvents;
    return filteredUpcomingEvents.filter((event) => {
      const category = event._category || classifyCategory(event);
      return category !== 'For U' && (standardSelectedCategories as ExploreCategory[]).includes(category);
    });
  }, [filteredUpcomingEvents, standardSelectedCategories]);

  const activeSwipeEvent = swipeDeck[swipeIndex] ?? null;
  const [modeTabLayouts, setModeTabLayouts] = useState<Record<'discover' | 'list', { x: number; width: number } | undefined>>({
    discover: undefined,
    list: undefined,
  });
  const activeModeTabId = view === 'list' ? 'list' : 'discover';
  const modeTabUnderlineAnimatedStyle = useAnimatedStyle(() => ({
    left: modeTabUnderlineLeft.value,
    width: modeTabUnderlineWidth.value,
  }));

  useEffect(() => {
    const targetLayout = modeTabLayouts[activeModeTabId];
    if (!targetLayout) return;

    modeTabUnderlineLeft.value = withSpring(targetLayout.x, {
      damping: 26,
      stiffness: 240,
      mass: 0.9,
    });
    modeTabUnderlineWidth.value = withSpring(targetLayout.width, {
      damping: 26,
      stiffness: 240,
      mass: 0.9,
    });
  }, [activeModeTabId, modeTabLayouts, modeTabUnderlineLeft, modeTabUnderlineWidth]);

  useEffect(() => {
    setDiscoverHeroIndex(0);
  }, [discoverHeroEvents.length]);

  useEffect(() => {
    setSwipeIndex(0);
  }, [
    selectedCategories,
    socialMode,
    deferredSearchQuery,
    selectedDateFilter,
    selectedLocationFilter,
    isMajorSpecific,
    selectedMajor,
    profileMajor,
    effectiveProfilePreferences.avoidFriday,
    effectiveProfilePreferences.preferredTime,
    effectiveProfilePreferences.preferredCategories,
    effectiveProfilePreferences.preferredInterests,
  ]);

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
    if (preferredSocialMode) {
      setSocialMode(preferredSocialMode);
    }
    if (!embedded) {
      setView('discover');
    }
  }, [
    deselectedCategories,
    embedded,
    hasForYouPrefs,
    isEventPreferencesCompleted,
    normalizedPreferenceCategories,
    preferenceLandingSignature,
    preferredSocialMode,
  ]);



  const changeView = useCallback((nextView: EventsView) => {
    startTransition(() => {
      setView(nextView);
    });
  }, []);

  const handleDiscoverSeeAll = useCallback(
    (category: Exclude<ExploreCategory, 'Featured'>) => {
      setSearchQuery('');
      setSelectedCategories(new Set<ListFilterOption>([category]));
      changeView('list');
    },
    [changeView],
  );

  const handleClubAccessPress = useCallback(() => {
    if (!user) {
      promptGuestLogin(navigation, 'Club access requires a signed-in account.');
      return;
    }

    navigation.navigate('ClubAccess');
  }, [navigation, user]);

  const toggleCategory = useCallback(
    (category: ListFilterOption) => {
      if (category === 'All') {
        setSelectedCategories(new Set(DEFAULT_SELECTED_CATEGORIES));
        return;
      }

      const wasSelected = selectedCategories.has(category);
      setSelectedCategories(() => {
        if (wasSelected && selectedCategories.size <= 1) {
          queueMicrotask(() => {
            toggleCategoryDeselection(category, true);
          });
          return new Set<ListFilterOption>(DEFAULT_SELECTED_CATEGORIES);
        }

        queueMicrotask(() => {
          toggleCategoryDeselection(category, false);
        });
        return new Set<ListFilterOption>([category]);
      });
    },
    [selectedCategories, toggleCategoryDeselection],
  );

  const handleSchedule = useCallback(
    async (event: TAMUEvent) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (!user) {
        promptGuestLogin(
          navigation,
          event.is_admin_event
            ? 'RSVPs require a signed-in account.'
            : 'Saving events to your schedule requires a signed-in account.',
        );
        return;
      }
      const eventId = String(event.id);
      const isScheduled = scheduledEvents.some((scheduled) => String(scheduled.id) === eventId);

      if (isScheduled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        removeScheduledEvent(eventId);
        if (user?.id) {
          try {
            await saveCampusEventRsvp({
              clerk_id: user.id,
              event_id: eventId,
              response: 'none',
            });
          } catch (error) {
            console.warn('[Events] RSVP remove error:', error);
          }
        }
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });

      // Notification logic
      const prefs = useAppShellStore.getState();
      const leadTime = prefs.notificationLeadTime;
      if (prefs.eventNotifications) {
        const locationLabel = event.location || (event.is_off_campus ? 'off campus' : 'TAMU');
        scheduleEventNotification(
          event.title,
          `Starting at ${locationLabel} in ${leadTime} minutes.`,
          new Date(event.date_ts * 1000),
          leadTime
        );

        if (event.is_admin_event && event.date2_ts) {
          scheduleAdminEventReviewNotification(
            event.title,
            event.location,
            new Date(event.date2_ts * 1000),
            event.google_review_url,
            String(event.id),
          );
        }
      }

      if (user?.id) {
        try {
          await saveCampusEventRsvp({
            clerk_id: user.id,
            event_id: String(event.id),
            response: 'going',
          });

          // Onboarding: The tour now requires the user to manually navigate to the Places tab
          if (activeTargetName === 'event-rsvp') {
            // Optimistic update for local store so it shows up in TodayTimeline instantly
            scheduleEvent(event as any);
            advanceStep('event-rsvp');
          }
        } catch (error) {
          console.warn('[Events] RSVP error:', error);
        }
      }
    },
    [activeTargetName, advanceStep, navigation, removeScheduledEvent, scheduleEvent, scheduledEvents, triggerRewardToast, user],
  );

  const handleShare = useCallback((event: TAMUEvent) => {
    const itemLabel = event.is_promotion ? 'promotion' : 'event';
    triggerNativeShare({
      title: event.title,
      message: `Check out this ${itemLabel}: ${event.title} at ${event.location || (event.is_off_campus ? 'off campus' : 'TAMU')}!`,
      url: event.url || 'https://maroonschedules.tamu.edu',
      id: event.id,
      type: 'event',
    });
  }, []);

  const handleMapOpen = useCallback(
    (event: TAMUEvent) => {
      if (event.location_lat != null && event.location_lng != null) {
        if (event.is_off_campus) {
          openNativeMaps(event.location_lat, event.location_lng, event.location || event.title);
          return;
        }
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
            initialLocation: event.location || undefined,
          },
        });
      }
    },
    [navigation],
  );

  const handleSaveToggle = useCallback(
    (event: TAMUEvent) => {
      if (!user) {
        promptGuestLogin(
          navigation,
          'Saving events requires a signed-in account.',
        );
        return;
      }
      const id = String(event.id);
      if (savedEventIds.includes(id)) {
        unsaveEvent(id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      } else {
        saveEvent(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
    },
    [navigation, saveEvent, savedEventIds, triggerRewardToast, unsaveEvent, user],
  );

  const queryClient = useQueryClient();

  const removeOrganizerEvents = useCallback((adminClerkId: string) => {
    queryClient.setQueryData(['campus-events', user?.id], (current: TAMUEvent[] | undefined) => {
      if (!current) return current;
      return current.filter((event) => event.admin_clerk_id !== adminClerkId);
    });
    setDetailEvent((current) => (current?.admin_clerk_id === adminClerkId ? null : current));
  }, [queryClient, user?.id]);

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

  const handleRestoreCategory = useCallback(
    (category?: ExploreCategory) => {
      if (!category) {
        clearDisliked();
        setSettingsVisible(false);
        return;
      }

      const idsToRestore = dislikedEventIds.filter((id) => {
        const event = personalizedEvents.find((candidate) => String(candidate.id) === id);
        return event && classifyCategory(event) === category;
      });
      if (idsToRestore.length > 0) {
        removeIdsFromDisliked(idsToRestore);
      }
      setSettingsVisible(false);
    },
    [clearDisliked, dislikedEventIds, personalizedEvents, removeIdsFromDisliked],
  );

  const dislikeEvent = useCallback(
    (eventId: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      storeDislikeEvent(eventId);
    },
    [storeDislikeEvent],
  );

  const renderHeader = (title: string) => (
    <View style={s.headerBlock}>
      <View style={s.headerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>{title}</Text>
        </View>
        <View style={s.headerRightActions}>
          <Pressable style={s.headerIconButton} onPress={() => setSettingsVisible(true)}>
            <SlidersHorizontal size={18} color={COLORS.textPrimary} />
            {activeFilterCount > 0 ? (
              <View style={s.headerBadge}>
                <Text style={s.headerBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={s.modeTabs}>
        {modeTabLayouts[activeModeTabId] ? (
          <AnimatedReanimated.View
            pointerEvents="none"
            style={[
              s.modeTabUnderline,
              modeTabUnderlineAnimatedStyle,
            ]}
          />
        ) : null}
        {([
          { id: 'discover', label: 'Discover' },
          { id: 'list', label: 'List' },
        ] as const).map((tab) => {
          const active = view === tab.id || (tab.id === 'discover' && view === 'swipe');
          const tabItem = (
            <Pressable
              key={tab.id}
              style={[s.modeTab, active && s.modeTabActive]}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setModeTabLayouts((current) => {
                  const previous = current[tab.id];
                  if (previous && previous.x === x && previous.width === width) {
                    return current;
                  }
                  return {
                    ...current,
                    [tab.id]: { x, width },
                  };
                });
              }}
              onPress={() => {
                changeView(tab.id);
                if (tab.id === 'list' && activeTargetName === 'switch-to-list') {
                  advanceStep('switch-to-list');
                }
              }}
            >
              <Text style={[s.modeTabText, active && s.modeTabTextActive]}>{tab.label}</Text>
            </Pressable>
          );

          if (tab.id === 'list') {
            return (
              <TourTarget
                key={tab.id}
                name="switch-to-list"
                assistAction={() => {
                  changeView('list');
                  setTimeout(() => advanceStep('switch-to-list'), 250);
                }}
              >
                {tabItem}
              </TourTarget>
            );
          }
          return tabItem;
        })}
      </View>
    </View>
  );

  const renderHorizontalDiscover = () => (
    <View style={s.discoverLayout}>
      <ScrollView
        style={s.discoverScroll}
        contentContainerStyle={s.discoverScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      >
        {discoverHeroEvents.length > 0 ? (
          <View style={s.discoverHeroBlock}>
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              directionalLockEnabled
              contentContainerStyle={s.heroCarouselRail}
              snapToInterval={HERO_CARD_SNAP_INTERVAL}
              snapToAlignment="start"
              disableIntervalMomentum
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: discoverHeroScrollX } } }],
                { useNativeDriver: false },
              )}
              onMomentumScrollEnd={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const nextIndex = Math.round(offsetX / HERO_CARD_SNAP_INTERVAL);
                setDiscoverHeroIndex(Math.max(0, Math.min(nextIndex, discoverHeroEvents.length - 1)));
              }}
            >
              {discoverHeroEvents.map((event, index) => (
                <StaggeredReveal key={String(event.id)} index={index}>
                  <View
                    style={{ marginRight: index === discoverHeroEvents.length - 1 ? 0 : HERO_CARD_GAP }}
                  >
                    <HeroEventCard
                      event={event}
                      scheduled={scheduledEventIdSet.has(String(event.id))}
                      onSchedule={() => handleSchedule(event)}
                      onPress={() => setDetailEvent(event)}
                      onMap={() => handleMapOpen(event)}
                    />
                  </View>
                </StaggeredReveal>
              ))}
            </Animated.ScrollView>

            {discoverHeroEvents.length > 1 ? (
              <View style={s.heroDots}>
                <View style={s.heroDotsTrack}>
                  {discoverHeroEvents.map((event) => (
                    <View
                      key={String(event.id)}
                      style={s.heroDot}
                    />
                  ))}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.heroDotIndicator,
                      {
                        backgroundColor: COLORS.primary,
                        transform: [
                          {
                            translateX: discoverHeroScrollX.interpolate({
                              inputRange: discoverHeroEvents.map((_, index) => index * HERO_CARD_SNAP_INTERVAL),
                              outputRange: discoverHeroEvents.map((_, index) => index * HERO_DOT_STEP),
                              extrapolate: 'clamp',
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {discoverSections.length > 0 ? (
          <View style={s.discoverSectionsStack}>
            {discoverSections.map((section, sectionIndex) => (
              <View key={section.key} style={s.discoverSectionBlock}>
                <View style={s.discoverSectionHeader}>
                  <Text style={s.discoverSectionTitle}>{section.title}</Text>
                  <Pressable
                    style={s.discoverSectionLink}
                    onPress={() => handleDiscoverSeeAll(section.key)}
                  >
                    <Text style={s.discoverSectionLinkText}>See All</Text>
                    <ChevronRight size={16} color={COLORS.primary} />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  contentContainerStyle={s.discoverSectionRail}
                >
                  {section.events.map((event, cardIndex) => (
                    <StaggeredReveal
                      key={String(event.id)}
                      index={sectionIndex * 2 + cardIndex}
                    >
                      <DiscoverRailCard
                        event={event}
                        scheduled={scheduledEventIdSet.has(String(event.id))}
                        onPress={() => setDetailEvent(event)}
                        onSchedule={() => handleSchedule(event)}
                      />
                    </StaggeredReveal>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>Nothing new right now</Text>
            <Text style={s.emptySubtitle}>
              {isMajorSpecific
                ? 'Try turning off major-specific filtering or pull to refresh for more events.'
                : 'Pull to refresh or check back in a bit for more campus and nearby events.'}
            </Text>
            <Pressable
              style={[s.emptyActionButton, { backgroundColor: COLORS.primary }]}
              onPress={() => changeView('list')}
            >
              <Text style={s.emptyActionText}>Browse List View</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </View>
  );

  const renderVerticalFeed = () => (
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
            scheduled={scheduledEventIdSet.has(String(activeSwipeEvent!.id))}
            onSchedule={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              handleSchedule(activeSwipeEvent!);
              setSwipeIndex((prev) => (prev + 1) % swipeDeck.length);
            }}
            onPress={() => setDetailEvent(activeSwipeEvent)}
            onMap={() => handleMapOpen(activeSwipeEvent!)}
            onDislike={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              storeDislikeEvent(String(activeSwipeEvent!.id));
              setSwipeIndex((prev) => (prev + 1) % swipeDeck.length);
            }}
          />
        )}

        <View style={s.swipeIndicators}>
          <Text style={s.swipeHint}>Swipe left to skip · Right to RSVP</Text>
          <View style={s.swipeDots}>
            {swipeDeck.slice(0, 10).map((_, i) => (
              <View
                key={i}
                style={[
                  s.swipeDot,
                  i === swipeIndex % 10 && { backgroundColor: COLORS.primary, width: 14 }
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );

  return (
    <View style={s.container}>
      <WallpaperWrapper>
        {view === 'discover' && (
          <>
            {renderHeader('Events')}
            {loading ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={s.loadingText}>Loading campus and nearby events...</Text>
              </View>
            ) : (
              renderHorizontalDiscover()
            )}
          </>
        )}

        {view === 'swipe' && (
          <>
            {renderHeader('Events')}
            {loading ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={s.loadingText}>Loading campus and nearby events...</Text>
              </View>
            ) : (
              renderVerticalFeed()
            )}
          </>
        )}

      {view === 'list' && (
        <>
          {renderHeader('Events')}

          <View style={s.listSearchRow}>
            <View style={s.searchShell}>
              <Search size={18} color={COLORS.textTertiary} />
              <TextInput
                style={s.searchInput}
                placeholder="Search campus and nearby events..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>
            <Pressable style={s.filterButton} onPress={() => setSettingsVisible(true)}>
              <SlidersHorizontal size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          {(selectedDateFilter !== 'Any Time' || selectedLocationFilter !== DEFAULT_LOCATION_FILTER) ? (
            <Text style={[s.filterHintText, { paddingHorizontal: 20, marginTop: -2, marginBottom: 10 }]}>
              {joinMetaParts(selectedDateFilter !== 'Any Time' ? selectedDateFilter : null, selectedLocationFilter !== DEFAULT_LOCATION_FILTER ? selectedLocationFilter : null)}
            </Text>
          ) : null}

          <View style={[s.categoryWrap, { marginBottom: 16, marginTop: 4 }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[s.categoryCollapsedRow, { paddingLeft: 20 }]}
                >
              {LIST_FILTER_OPTIONS.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  count={category === 'All' ? allFilterCount : (categoryCounts[category] || 0)}
                  active={selectedCategories.has(category)}
                  onPress={() => toggleCategory(category)}
                />
              ))}
            </ScrollView>
          </View>


          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Loading campus and nearby events...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUpcomingEvents}
              keyExtractor={(event) => String(event.id)}
              contentContainerStyle={s.listScroll}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
              initialNumToRender={10}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item, index }) => {
                const row = (
                  <StaggeredReveal index={index}>
                    <ListEventRow
                      event={item}
                      isGuest={isGuest}
                      saved={savedEventIds.includes(String(item.id))}
                      scheduled={scheduledEvents.some((scheduled) => String(scheduled.id) === String(item.id))}
                      onPress={() => {
                        if (index === 0 && activeTargetName === 'first-event-card') {
                          advanceStep('first-event-card');
                        }
                        setDetailEvent(item);
                      }}
                      onDelete={() => dislikeEvent(String(item.id))}
                      onShare={() => handleShare(item)}
                      onSchedule={() => handleSchedule(item)}
                    />
                  </StaggeredReveal>
                );
                return index === 0 ? (
                  <TourTarget
                    key={String(item.id)}
                    name="first-event-card"
                    style={{ width: '100%' }}
                    assistAction={() => {
                      setDetailEvent(item);
                      setTimeout(() => advanceStep('first-event-card'), 220);
                    }}
                  >
                    {row}
                  </TourTarget>
                ) : row;
              }}
              ListEmptyComponent={
                <View style={s.emptyState}>
                  <Text style={s.emptyTitle}>Nothing matches right now</Text>
                  <Text style={s.emptySubtitle}>
                    {isForYouSelected && !hasForYouPrefs
                      ? 'Add your profile preferences in onboarding or planner settings, then try For U again.'
                      : 'Try another category, turn off major-specific filtering, or clear hidden events.'}
                  </Text>
                  {(searchQuery || isMajorSpecific || !isAllSelected || selectedDateFilter !== 'Any Time' || selectedLocationFilter !== DEFAULT_LOCATION_FILTER) && (
                    <Pressable
                      style={[s.emptyActionButton, { backgroundColor: COLORS.primary }]}
                      onPress={() => {
                        setSearchQuery('');
                        setMajorSpecific(false);
                        setSelectedDateFilter('Any Time');
                        setSelectedLocationFilter(DEFAULT_LOCATION_FILTER);
                        setSelectedCategories(new Set<ListFilterOption>(DEFAULT_SELECTED_CATEGORIES));
                      }}
                    >
                      <Text style={s.emptyActionText}>Clear All Filters</Text>
                    </Pressable>
                  )}
                </View>
              }
            />
          )}
        </>
      )}

      {view === 'inbox' && (
        <>
          <View style={s.swipeHeader}>
            <Pressable style={s.headerIconButton} onPress={() => changeView('discover')}>
              <ChevronLeft size={18} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={s.swipeProgress}>Event inbox</Text>
            <View style={s.swipeHeaderSpacer} />
          </View>

          <ScrollView contentContainerStyle={s.inboxScroll} showsVerticalScrollIndicator={false}>
            {receivedInvites.length === 0 ? (
              <View style={s.emptyState}>
                <Inbox size={42} color={COLORS.textTertiary} />
                <Text style={s.emptyTitle}>No invites yet</Text>
                <Text style={s.emptySubtitle}>
                  When friends send you events, they will land here.
                </Text>
              </View>
            ) : (
              receivedInvites.map((invite) => (
                <View key={invite.id} style={s.inviteCard}>
                  <Text style={s.inviteEyebrow}>From {invite.senderName}</Text>
                  <Text style={s.inviteTitle}>{invite.title}</Text>
                  <Text style={s.inviteMeta}>
                    {formatDate(invite.date_ts)} · {formatTime(invite.date_ts)}
                  </Text>
                  {invite.location ? (
                    <View style={s.inviteLocationRow}>
                      <MapPin size={14} color={COLORS.textSecondary} />
                      <Text style={s.inviteLocation}>{invite.location}</Text>
                    </View>
                  ) : null}
                  <View style={s.inviteActions}>
                    <ActionButton color="#3CCB6C" small onPress={() => acceptInvite(invite.id)}>
                      <Check size={20} color="#FFFFFF" />
                    </ActionButton>
                    <ActionButton color="#FF4D6D" small onPress={() => rejectInvite(invite.id)}>
                      <XIcon size={20} color="#FFFFFF" />
                    </ActionButton>
                    {invite.location_lat != null && invite.location_lng != null ? (
                      <ActionButton
                        color="#2F80ED"
                        small
                        onPress={() =>
                          navigation.navigate('Main', {
                            screen: 'Places',
                            params: {
                              initialLayer: 'Academic',
                              eventFocus: {
                                eventId: invite.eventId,
                                title: invite.title,
                                location: invite.location || null,
                                latitude: invite.location_lat,
                                longitude: invite.location_lng,
                                startTime: invite.date_iso,
                                link: null,
                                hasFood: false,
                              },
                            },
                          })
                        }
                      >
                        <Map size={18} color="#FFFFFF" />
                      </ActionButton>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        isMajorSpecific={isMajorSpecific}
        selectedMajor={selectedMajor}
        setMajorSpecific={setMajorSpecific}
        setSelectedMajor={setSelectedMajor}
        socialMode={socialMode}
        setSocialMode={setSocialMode}
        selectedCategories={selectedCategories}
        selectedDateFilter={selectedDateFilter}
        setSelectedDateFilter={setSelectedDateFilter}
        selectedLocationFilter={selectedLocationFilter}
        setSelectedLocationFilter={setSelectedLocationFilter}
        locationOptions={locationFilterOptions}
        dislikedEventIds={dislikedEventIds}
        events={personalizedEvents}
        onRestoreCategory={handleRestoreCategory}
        scheduledEvents={scheduledEvents}
        onPress={(ev) => setDetailEvent(ev)}
        onSchedule={handleSchedule}
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
      </WallpaperWrapper>
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
  category: ListFilterOption;
  count: number;
  active: boolean;
  dimmed?: boolean;
  onPress: () => void;
}) {
  const { COLORS } = useTheme();
  const isAllChip = category === 'All';
  const accent = isAllChip ? COLORS.primary : CATEGORY_META[category].accent;
  const Icon = isAllChip ? null : CATEGORY_META[category].icon;
  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.categoryChip,
        {
          backgroundColor: active ? accent : COLORS.background,
          opacity: dimmed ? 0.42 : 1,
          borderColor: active ? accent : `${accent}2E`,
        },
      ]}
    >
      {Icon ? <Icon size={14} color={active ? '#FFFFFF' : COLORS.textTertiary} /> : null}
      <Text
        style={[
          stylesStatic.categoryChipText,
          { color: active ? '#FFFFFF' : COLORS.textSecondary },
        ]}
      >
        {category}
      </Text>
      <Text
        style={[
          stylesStatic.categoryChipCount,
          { color: active ? 'rgba(255,255,255,0.82)' : COLORS.textTertiary },
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
}: {
  event: TAMUEvent;
  scheduled: boolean;
  onSchedule: () => void;
  onPress: () => void;
  onMap: () => void;
  onDislike: () => void;
}) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > 100) {
        runOnJS(LayoutAnimation.configureNext)(LayoutAnimation.Presets.easeInEaseOut);
        translateX.value = withSpring(SCREEN_WIDTH);
        opacity.value = withSpring(0);
        runOnJS(onSchedule)();
      } else if (e.translationX < -100) {
        runOnJS(LayoutAnimation.configureNext)(LayoutAnimation.Presets.easeInEaseOut);
        translateX.value = withSpring(-SCREEN_WIDTH);
        opacity.value = withSpring(0);
        runOnJS(onDislike)();
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
              left: -60,
              top: '50%',
              marginTop: -30,
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#3CCB6C',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            },
            leftIndicatorStyle
          ]}
        >
          <Check size={32} color="#FFFFFF" strokeWidth={3} />
        </AnimatedReanimated.View>

        <AnimatedReanimated.View 
          style={[
            {
              position: 'absolute',
              right: -60,
              top: '50%',
              marginTop: -30,
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#FF4D6D',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            },
            rightIndicatorStyle
          ]}
        >
          <XIcon size={32} color="#FFFFFF" strokeWidth={3} />
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
  const badgeLabel = getEventBadgeLabel(event);
  const handleSchedulePress = (e: any) => {
    e.stopPropagation();
    onSchedule();
  };
  const handleMapPress = (e: any) => {
    e.stopPropagation();
    onMap();
  };

  return (
    <Pressable
      onPress={onPress}
      style={[stylesStatic.heroCard, { backgroundColor: meta.cardTint }]}
    >
      {eventImage ? (
        <View style={StyleSheet.absoluteFill}>
          <Image source={eventImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.16)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.78)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
      ) : (
        <>
          <View style={[stylesStatic.heroGlow, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
          <View style={[stylesStatic.heroGlowSmall, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
          <View style={[stylesStatic.heroIconHalo]}>
            <Icon size={88} color="rgba(255,255,255,0.12)" />
          </View>
        </>
      )}

      <View style={stylesStatic.heroTopRow}>
        <View style={stylesStatic.heroCategoryPill}>
          <Text style={stylesStatic.heroCategoryText}>{category}</Text>
        </View>
        {badgeLabel ? (
          <View style={stylesStatic.verifiedPill}>
            <Text style={stylesStatic.verifiedText}>{badgeLabel}</Text>
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
        <Text style={stylesStatic.heroTitle} numberOfLines={2} ellipsizeMode="tail">{event.title}</Text>
        <View style={stylesStatic.heroMetaRow}>
          <CalendarIcon size={17} color="#FFFFFF" />
          <Text style={stylesStatic.heroMetaText}>
            {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
          </Text>
        </View>
        <View style={stylesStatic.heroMetaRow}>
          <MapPin size={17} color="#FFFFFF" />
          <Text style={stylesStatic.heroMetaText}>{event.location || getEventAreaLabel(event)}</Text>
        </View>
        {getEventContextLine(event) ? (
          <View style={stylesStatic.heroMetaRow}>
            <Users size={16} color="#FFFFFF" />
            <Text style={stylesStatic.heroMetaText}>{getEventContextLine(event)}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={stylesStatic.heroActionRow}>
        <Pressable
          style={[
            stylesStatic.heroActionButton,
            scheduled ? stylesStatic.heroActionSelected : stylesStatic.heroActionPrimary,
          ]}
          onPress={handleSchedulePress}
        >
          {scheduled ? <Check size={15} color="#174F2E" /> : <CalendarDays size={15} color="#174F2E" />}
          <Text style={[stylesStatic.heroActionText, stylesStatic.heroActionPrimaryText]}>
            {scheduled ? 'Added' : 'Add'}
          </Text>
        </Pressable>

        {event.location_lat != null && event.location_lng != null ? (
          <Pressable style={stylesStatic.heroInlineMapButton} onPress={handleMapPress}>
            <Map size={14} color="rgba(255,255,255,0.92)" />
            <Text style={stylesStatic.heroInlineMapText}>Map</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function DiscoverRailCard({
  event,
  scheduled,
  onPress,
  onSchedule,
}: {
  event: TAMUEvent;
  scheduled: boolean;
  onPress: () => void;
  onSchedule: () => void;
}) {
  const { COLORS } = useTheme();
  const category = classifyCategory(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const eventImage = getEventImage(event as any);
  const contextLine = getEventContextLine(event);

  return (
    <Pressable
      onPress={onPress}
      style={stylesStatic.discoverRailCard}
    >
      <View style={stylesStatic.discoverRailImageWrap}>
        {eventImage ? (
          <Image source={eventImage} style={stylesStatic.discoverRailImage} resizeMode="cover" />
        ) : (
          <View style={[stylesStatic.discoverRailImageFallback, { backgroundColor: meta.cardTint }]}>
            <Icon size={36} color="#FFFFFF" />
          </View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.16)']}
          style={stylesStatic.discoverRailImageOverlay}
          pointerEvents="none"
        />
      </View>

      <View style={stylesStatic.discoverRailBody}>
        <View style={stylesStatic.discoverRailTitleRow}>
          <Text style={[stylesStatic.discoverRailTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
            {event.title}
          </Text>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onSchedule();
            }}
            style={stylesStatic.discoverRailInlineAction}
          >
            {scheduled ? (
              <Check size={15} color={COLORS.primary} />
            ) : (
              <CalendarDays size={15} color={COLORS.primary} />
            )}
            <Text style={[stylesStatic.discoverRailInlineActionText, { color: COLORS.primary }]}>
              {scheduled ? 'Added' : 'Add'}
            </Text>
          </Pressable>
        </View>

        <View style={stylesStatic.discoverRailMetaBlock}>
          {contextLine ? (
            <View style={stylesStatic.discoverRailMetaRow}>
              <Megaphone size={14} color={COLORS.primary} />
              <Text style={[stylesStatic.discoverRailMetaText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                {contextLine}
              </Text>
            </View>
          ) : null}
          <View style={stylesStatic.discoverRailMetaRow}>
            <CalendarIcon size={14} color={COLORS.primary} />
            <Text style={[stylesStatic.discoverRailMetaText, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
            </Text>
          </View>
          <View style={stylesStatic.discoverRailMetaRow}>
            <MapPin size={14} color={COLORS.primary} />
            <Text style={[stylesStatic.discoverRailMetaText, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {event.location || getEventAreaLabel(event)}
            </Text>
          </View>
        </View>
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
  const contextLine = getEventContextLine(event);

  return (
    <Pressable
      onPress={onPress}
      style={[
        stylesStatic.listRow,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, paddingVertical: 12 },
      ]}
    >
      <View style={[stylesStatic.listThumb, { backgroundColor: meta.cardTint, width: 52, height: 52, borderRadius: 20 }]}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={[stylesStatic.listThumbImage, { borderRadius: 20 }]} resizeMode="cover" />
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
          {event.is_admin_event ? <BadgeCheck size={14} color="#2F80ED" /> : null}
        </View>
        {contextLine ? (
          <Text style={[stylesStatic.listMeta, { color: COLORS.primary, fontSize: 13 }]} numberOfLines={1}>
            {contextLine}
          </Text>
        ) : null}
        <Text style={[stylesStatic.listMeta, { color: COLORS.textSecondary, fontSize: 13 }]} numberOfLines={1}>
          {joinMetaParts(formatDate(event.date_ts), formatTime(event.date_ts), event.location || getEventAreaLabel(event))}
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

function SettingsModal({
  visible,
  onClose,
  isMajorSpecific,
  selectedMajor,
  setMajorSpecific,
  setSelectedMajor,
  socialMode,
  setSocialMode,
  selectedCategories,
  selectedDateFilter,
  setSelectedDateFilter,
  selectedLocationFilter,
  setSelectedLocationFilter,
  locationOptions,
  dislikedEventIds,
  events,
  onRestoreCategory,
  scheduledEvents,
  onPress,
  onSchedule,
}: {
  visible: boolean;
  onClose: () => void;
  isMajorSpecific: boolean;
  selectedMajor: MajorOption;
  setMajorSpecific: (val: boolean) => void;
  setSelectedMajor: (major: MajorOption) => void;
  socialMode: SocialMode;
  setSocialMode: (mode: SocialMode) => void;
  selectedCategories: Set<ListFilterOption>;
  selectedDateFilter: DateFilterOption;
  setSelectedDateFilter: (value: DateFilterOption) => void;
  selectedLocationFilter: string;
  setSelectedLocationFilter: (value: string) => void;
  locationOptions: string[];
  dislikedEventIds: string[];
  events: TAMUEvent[];
  onRestoreCategory: (category?: ExploreCategory) => void;
  scheduledEvents: TAMUEvent[];
  onPress: (event: TAMUEvent) => void;
  onSchedule: (event: TAMUEvent) => void;
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
          <Text style={[stylesStatic.modalTitle, { color: COLORS.textPrimary }]}>Filters</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {(scheduledEvents?.length || 0) > 0 && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary, marginTop: 0 }]}>
                    Saved Events ({scheduledEvents?.length || 0})
                  </Text>
                </View>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
                  contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
                >
                  {(scheduledEvents || []).map((event) => (
                    <Pressable
                      key={String(event?.id)}
                      onPress={() => {
                        onClose();
                        onPress(event);
                      }}
                      style={{
                        width: 240,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                        borderRadius: 36,
                        padding: 14,
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: COLORS.textPrimary, fontWeight: '800', fontSize: 13 }} numberOfLines={2}>
                        {event?.title}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>
                          {formatDate(event?.date_ts)}
                        </Text>
                        <Pressable 
                          onPress={(e) => {
                            e.stopPropagation();
                            onSchedule(event);
                          }}
                          style={{
                            padding: 6,
                            borderRadius: 10,
                            backgroundColor: 'rgba(255,77,109,0.1)',
                          }}
                        >
                          <Trash2 size={14} color="#FF4D6D" />
                        </Pressable>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary, marginTop: 12 }]}>
              Major filter
            </Text>
            <Pressable
              style={stylesStatic.modalOption}
              onPress={() => setMajorSpecific(!isMajorSpecific)}
            >
              <Text style={[stylesStatic.modalOptionText, { color: COLORS.textPrimary }]}>
                Major specific events only
              </Text>
              <View
                style={[
                  { width: 34, height: 20, borderRadius: 10, padding: 2 },
                  { backgroundColor: isMajorSpecific ? COLORS.primary : COLORS.border },
                ]}
              >
                <View
                  style={[
                    { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF' },
                    isMajorSpecific && { alignSelf: 'flex-end' },
                  ]}
                />
              </View>
            </Pressable>

            {isMajorSpecific ? (
              <View style={{ marginTop: 8 }}>
                {MAJOR_OPTIONS.map((major) => (
                  <Pressable
                    key={major}
                    style={stylesStatic.modalOption}
                    onPress={() => setSelectedMajor(major)}
                  >
                    <Text
                      style={[
                        stylesStatic.modalOptionText,
                        { color: selectedMajor === major ? COLORS.primary : COLORS.textPrimary },
                      ]}
                    >
                      {major}
                    </Text>
                    {selectedMajor === major ? <Check size={16} color={COLORS.primary} /> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Date window
            </Text>
            {DATE_FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={stylesStatic.modalOption}
                onPress={() => setSelectedDateFilter(option)}
              >
                <Text
                  style={[
                    stylesStatic.modalOptionText,
                    { color: selectedDateFilter === option ? COLORS.primary : COLORS.textPrimary },
                  ]}
                >
                  {option}
                </Text>
                {selectedDateFilter === option ? <Check size={16} color={COLORS.primary} /> : null}
              </Pressable>
            ))}

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Location
            </Text>
            {locationOptions.map((option) => (
              <Pressable
                key={option}
                style={stylesStatic.modalOption}
                onPress={() => setSelectedLocationFilter(option)}
              >
                <Text
                  style={[
                    stylesStatic.modalOptionText,
                    { color: selectedLocationFilter === option ? COLORS.primary : COLORS.textPrimary },
                  ]}
                >
                  {option}
                </Text>
                {selectedLocationFilter === option ? <Check size={16} color={COLORS.primary} /> : null}
              </Pressable>
            ))}

            {selectedCategories.has('Social') ? (
              <>
                <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
                  Social mode
                </Text>
                {(['casual', 'professional'] as SocialMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    style={stylesStatic.modalOption}
                    onPress={() => setSocialMode(mode)}
                  >
                    <Text
                      style={[
                        stylesStatic.modalOptionText,
                        { color: socialMode === mode ? COLORS.primary : COLORS.textPrimary },
                      ]}
                    >
                      {mode === 'casual' ? 'Casual' : 'Professional'}
                    </Text>
                    {socialMode === mode ? <Check size={16} color={COLORS.primary} /> : null}
                  </Pressable>
                ))}
              </>
            ) : null}

            <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary }]}>
              Hidden events
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

  if (!event) return null;
  const contextLine = getEventContextLine(event);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100, justifyContent: 'flex-end' }]} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={onClose} />
      <View
        style={[
          stylesStatic.detailSheet,
          { backgroundColor: COLORS.surface, borderColor: COLORS.border, maxHeight: '85%' },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {event.imageUrl ? (
            <View style={stylesStatic.detailImageWrap}>
              <Image source={{ uri: event.imageUrl }} style={stylesStatic.detailImage} resizeMode="cover" />
            </View>
          ) : null}
          <View style={stylesStatic.detailHeader}>
            <View
              style={[
                stylesStatic.detailCategoryPill,
                { backgroundColor: CATEGORY_META[classifyCategory(event)].chipBg },
              ]}
            >
              <Text
                style={[
                  stylesStatic.detailCategoryText,
                  { color: CATEGORY_META[classifyCategory(event)].chipText },
                ]}
              >
                {classifyCategory(event)}
              </Text>
            </View>
            {!isGuest ? (
              <Pressable onPress={() => onSaveToggle(event)} style={stylesStatic.detailSaveButton}>
                <Heart size={18} color={saved ? '#FF4D6D' : COLORS.textSecondary} fill={saved ? '#FF4D6D' : 'none'} />
              </Pressable>
            ) : null}
          </View>

          <Text style={[stylesStatic.detailTitle, { color: COLORS.textPrimary }]}>{event.title}</Text>


          <View style={stylesStatic.detailMetaBlock}>
            <View style={stylesStatic.detailMetaRow}>
              <CalendarIcon size={15} color={COLORS.textSecondary} />
              <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                {joinMetaParts(formatDate(event.date_ts), formatTime(event.date_ts), getEventAreaLabel(event))}
              </Text>
            </View>
            {event.location ? (
              <View style={stylesStatic.detailMetaRow}>
                <MapPin size={15} color={COLORS.textSecondary} />
                <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                  {event.location}
                </Text>
              </View>
            ) : null}
            {contextLine ? (
              <View style={stylesStatic.detailMetaRow}>
                {event.is_admin_event ? (
                  <BadgeCheck size={15} color="#2F80ED" />
                ) : (
                  <Megaphone size={15} color={COLORS.textSecondary} />
                )}
                <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                  {contextLine}
                </Text>
              </View>
            ) : null}
          </View>

          {event.description ? (
            <Text style={[stylesStatic.detailDescription, { color: COLORS.textSecondary }]}>
              {stripHtml(event.description)}
            </Text>
          ) : null}
          <TagChips tags={event.access_tags} label="Audience tags" />

          <TourTarget
            name="event-rsvp"
            assistAction={() => {
              onSchedule(event);
              onClose();
            }}
          >
            <Pressable
              style={[stylesStatic.primaryDetailButton, { backgroundColor: scheduled ? '#E06A3E' : '#3CCB6C' }]}
              onPress={() => {
                onSchedule(event);
                onClose();
              }}
            >
              {scheduled ? (
                <XIcon size={18} color="#FFFFFF" strokeWidth={3} />
              ) : (
                <Check size={18} color="#FFFFFF" strokeWidth={3} />
              )}
              <Text style={stylesStatic.primaryDetailButtonText}>
                {event.is_admin_event
                  ? (scheduled ? 'Remove RSVP' : 'RSVP to Featured Event')
                  : event.is_promotion
                    ? (scheduled ? 'Remove promotion reminder' : 'Save Promotion')
                    : (scheduled ? 'Remove from current schedule' : 'Add')}
              </Text>
            </Pressable>
          </TourTarget>

          <View style={stylesStatic.detailActionRow}>
            <Pressable
              style={[
                stylesStatic.secondaryDetailButton,
                {
                  borderColor: COLORS.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                },
              ]}
              onPress={() => onShare(event)}
            >
              <Share2 size={18} color={COLORS.textPrimary} />
              <Text style={[stylesStatic.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                Share
              </Text>
            </Pressable>
            {event.location_lat != null && event.location_lng != null ? (
              <Pressable
                style={[
                  stylesStatic.secondaryDetailButton,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                  },
                ]}
                onPress={() => onMap(event)}
              >
                <Map size={18} color={COLORS.textPrimary} />
                <Text style={[stylesStatic.secondaryDetailButtonText, { color: COLORS.textPrimary }]}>
                  {event.is_off_campus ? 'Maps' : 'Places'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                disabled={!event.location || event.location === 'TBA'}
                style={[
                  stylesStatic.secondaryDetailButton,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                    opacity: (!event.location || event.location === 'TBA') ? 0.35 : 1,
                  },
                ]}
                onPress={() => {
                  if (event.location && event.location !== 'TBA') {
                    const query = encodeURIComponent(event.location);
                    const url = Platform.OS === 'ios' ? `maps:0,0?q=${query}` : `geo:0,0?q=${query}`;
                    Linking.openURL(url).catch(() => {
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
                    });
                  }
                }}
              >
                <MapPin size={18} color={(!event.location || event.location === 'TBA') ? COLORS.textTertiary : COLORS.textPrimary} />
                <Text style={[stylesStatic.secondaryDetailButtonText, { color: (!event.location || event.location === 'TBA') ? COLORS.textTertiary : COLORS.textPrimary }]}>
                  Map
                </Text>
              </Pressable>
            )}
          </View>
          {event.is_admin_event && event.admin_clerk_id ? (
            <View
              style={[
                stylesStatic.organizerSafetyCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                  borderColor: COLORS.border,
                },
              ]}
            >
              <Text style={[stylesStatic.organizerSafetyTitle, { color: COLORS.textPrimary }]}>
                Organizer controls
              </Text>
              <Text style={[stylesStatic.organizerSafetyText, { color: COLORS.textSecondary }]}>
                Manage {event.group_title || 'this organizer'} directly from this event.
              </Text>
              <View style={stylesStatic.organizerSafetyActions}>
                <Pressable
                  style={[
                    stylesStatic.organizerSafetyButton,
                    { borderColor: COLORS.border, backgroundColor: COLORS.surface },
                  ]}
                  onPress={() => onUnsubscribeOrganizer(event)}
                >
                  <BellOff size={16} color={COLORS.textPrimary} />
                  <Text style={[stylesStatic.organizerSafetyButtonText, { color: COLORS.textPrimary }]}>
                    Unsubscribe
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    stylesStatic.organizerSafetyButton,
                    { borderColor: COLORS.border, backgroundColor: COLORS.surface },
                  ]}
                  onPress={() => onReportOrganizer(event)}
                >
                  <CircleAlert size={16} color={COLORS.textPrimary} />
                  <Text style={[stylesStatic.organizerSafetyButtonText, { color: COLORS.textPrimary }]}>
                    Report
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    stylesStatic.organizerSafetyButton,
                    { borderColor: '#FFD2BE', backgroundColor: '#FFF4EE' },
                  ]}
                  onPress={() => onBlockOrganizer(event)}
                >
                  <UserX size={16} color="#C65A28" />
                  <Text style={[stylesStatic.organizerSafetyButtonText, { color: '#C65A28' }]}>
                    Block
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const getStyles = (COLORS: any, isDark: boolean, embedded: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    headerBlock: {
      paddingTop: embedded ? 10 : 54,
      paddingHorizontal: 20,
      paddingBottom: 6,
      gap: 10,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pageTitle: {
      color: COLORS.textPrimary,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -1.2,
    },
    pageSubtitle: {
      marginTop: 2,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    headerBadge: {
      position: 'absolute',
      right: -2,
      top: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: '#FF4D6D',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
    },
    modeTabs: {
      flexDirection: 'row',
      gap: 16,
      paddingTop: 0,
      position: 'relative',
    },
    modeTab: {
      paddingVertical: 1,
      position: 'relative',
    },
    modeTabActive: {
      backgroundColor: 'transparent',
    },
    modeTabText: {
      color: COLORS.textSecondary,
      fontSize: 16,
      fontWeight: '700',
    },
    modeTabTextActive: {
      color: COLORS.textPrimary,
      fontWeight: '800',
    },
    modeTabUnderline: {
      position: 'absolute',
      bottom: -5,
      height: 3,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 38,
    },
    discoverLayout: {
      flex: 1,
    },
    discoverScroll: {
      flex: 1,
    },
    discoverScrollContent: {
      paddingBottom: embedded ? 48 : 120,
      gap: 20,
    },
    discoverHeroBlock: {
      marginTop: 14,
    },
    heroCarouselRail: {
      paddingLeft: 20,
      paddingRight: 20,
      paddingBottom: 4,
    },
    heroDots: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    heroDotsTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: HERO_DOT_GAP,
      position: 'relative',
    },
    heroDot: {
      width: HERO_DOT_SIZE,
      height: HERO_DOT_SIZE,
      borderRadius: HERO_DOT_SIZE / 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : '#D7DCE6',
    },
    heroDotIndicator: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: HERO_DOT_SIZE,
      height: HERO_DOT_SIZE,
      borderRadius: HERO_DOT_SIZE / 2,
    },
    discoverSectionsStack: {
      gap: 22,
    },
    discoverSectionBlock: {
      gap: 10,
    },
    discoverSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 20,
    },
    discoverSectionTitle: {
      color: COLORS.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.45,
      flex: 1,
    },
    discoverSectionLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    discoverSectionLinkText: {
      color: COLORS.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    discoverSectionRail: {
      paddingLeft: 20,
      paddingRight: 8,
      gap: 12,
    },
    clubCtaCard: {
      marginHorizontal: 20,
      borderRadius: 30,
      padding: 24,
      minHeight: 188,
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
      overflow: 'hidden',
    },
    clubCtaContent: {
      gap: 10,
      maxWidth: '76%',
    },
    clubCtaEyebrow: {
      color: 'rgba(255,255,255,0.74)',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    clubCtaTitle: {
      color: '#FFFFFF',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.75,
    },
    clubCtaBody: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 14,
      lineHeight: 20,
    },
    clubCtaButton: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
    },
    clubCtaButtonText: {
      color: COLORS.primary,
      fontSize: 14,
      fontWeight: '900',
    },
    clubCtaIcon: {
      position: 'absolute',
      right: -4,
      bottom: -10,
    },
    forYouHero: {
      borderRadius: 36,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginTop: 6,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(80,0,0,0.06)',
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    forYouHeroTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    forYouEyebrow: {
      color: isDark ? 'rgba(255,255,255,0.76)' : COLORS.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    forYouTitle: {
      color: isDark ? '#FFFFFF' : COLORS.textPrimary,
      fontSize: 21,
      lineHeight: 24,
      fontWeight: '900',
      letterSpacing: -0.7,
      maxWidth: 250,
    },
    forYouBody: {
      color: isDark ? 'rgba(255,255,255,0.82)' : COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    forYouSparkle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.72)',
    },
    forYouChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 10,
    },
    forYouChip: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.84)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)',
    },
    forYouChipText: {
      color: isDark ? '#FFFFFF' : COLORS.textPrimary,
      fontSize: 11,
      fontWeight: '800',
    },
    categoryWrap: {
      gap: 10,
      marginTop: 4,
    },
    categoryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 2,
      paddingHorizontal: 0,
    },
    categoryToggleText: {
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '900',
    },
    categoryCollapsedRow: {
      paddingHorizontal: 0,
      paddingBottom: 8,
      gap: 10,
    },
    categoryExpandedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 0,
    },
    inlineControls: {
      marginTop: 10,
      gap: 10,
      paddingHorizontal: 20,
    },
    inlineControl: {
      borderRadius: 36,
      paddingHorizontal: 0,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: 'transparent',
    },
    inlineControlActive: {
      borderBottomColor: COLORS.primary,
    },
    inlineControlTitle: {
      color: COLORS.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
    inlineControlTitleActive: {
      color: COLORS.primary,
    },
    inlineControlValue: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    socialModeWrap: {
      flexDirection: 'row',
      gap: 8,
    },
    socialModePill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)',
    },
    socialModePillActive: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    socialModeText: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    socialModeTextActive: {
      color: COLORS.textPrimary,
    },
    filterHintText: {
      marginTop: 6,
      color: COLORS.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },

    heroRail: {
      paddingTop: 14,
      paddingLeft: 0,
      paddingRight: 0,
      paddingBottom: 6,
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
      height: 46,
      borderRadius: 999,
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    searchInput: {
      flex: 1,
      color: COLORS.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    filterButton: {
      width: 46,
      height: 46,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: 'transparent',
    },
    listScroll: {
      paddingHorizontal: 20,
      paddingBottom: 126,
      gap: 0,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: COLORS.textSecondary,
      fontSize: 15,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 64,
      gap: 10,
    },
    emptyTitle: {
      color: COLORS.textPrimary,
      fontSize: 22,
      fontWeight: '900',
    },
    emptySubtitle: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    emptyActionButton: {
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 36,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 5,
    },
    emptyActionText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    swipeWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    swipeIndicators: {
      alignItems: 'center',
      gap: 10,
      marginTop: 18,
    },
    swipeHint: {
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    swipeDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    swipeDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.14)',
    },
    swipeHeader: {
      paddingTop: embedded ? 10 : 52,
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    swipeProgress: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    swipeHeaderSpacer: {
      width: 42,
      height: 42,
    },
    swipeSocialModeWrap: {
      paddingHorizontal: 20,
      paddingBottom: 10,
      flexDirection: 'row',
      gap: 8,
    },
    swipeActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      paddingBottom: 30,
      paddingHorizontal: 20,
    },
    finishedWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 12,
    },
    finishedTitle: {
      color: COLORS.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
    finishedSubtitle: {
      color: COLORS.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    finishedButton: {
      marginTop: 12,
      borderRadius: 36,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 22,
      paddingVertical: 14,
    },
    finishedButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    inboxScroll: {
      paddingHorizontal: 20,
      paddingBottom: 120,
      gap: 12,
    },
    inviteCard: {
      marginTop: 8,
      borderRadius: 36,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    inviteEyebrow: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    inviteTitle: {
      color: COLORS.textPrimary,
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 4,
    },
    inviteMeta: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    inviteLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    inviteLocation: {
      color: COLORS.textSecondary,
      fontSize: 14,
      flex: 1,
    },
    inviteActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
  });

const stylesStatic = StyleSheet.create({
  rewardToastWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 92,
    alignItems: 'center',
    zIndex: 200,
    pointerEvents: 'none',
  },
  rewardToastCard: {
    minWidth: 220,
    maxWidth: 310,
    borderRadius: 36,
    backgroundColor: 'rgba(20,20,24,0.94)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  rewardToastEyebrow: {
    color: '#F9C74F',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  rewardToastTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  rewardToastBody: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  rewardConfetti: {
    position: 'absolute',
    top: 6,
    width: 8,
    height: 14,
    borderRadius: 3,
  },
  reasonRow: {
    gap: 8,
    paddingTop: 10,
    paddingBottom: 2,
    paddingRight: 8,
  },
  reasonRowCompact: {
    gap: 6,
    paddingTop: 6,
    paddingBottom: 4,
    paddingRight: 8,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(122,11,28,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(122,11,28,0.12)',
  },
  reasonChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(122,11,28,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(122,11,28,0.12)',
  },
  reasonChipLight: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  reasonChipText: {
    color: '#7A0B1C',
    fontSize: 12,
    fontWeight: '800',
  },
  reasonChipTextCompact: {
    color: '#7A0B1C',
    fontSize: 11,
    fontWeight: '800',
  },
  reasonChipTextLight: {
    color: '#FFFFFF',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipCount: {
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 2,
  },
  discoverRailCard: {
    width: DISCOVER_RAIL_CARD_WIDTH,
    minHeight: 258,
  },
  discoverRailImageWrap: {
    height: 174,
    borderRadius: 20,
    overflow: 'hidden',
  },
  discoverRailImage: {
    width: '100%',
    height: '100%',
  },
  discoverRailImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverRailImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  discoverRailBody: {
    gap: 6,
    paddingTop: 10,
    paddingBottom: 6,
  },
  discoverRailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  discoverRailTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  discoverRailMetaBlock: {
    gap: 4,
  },
  discoverRailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  discoverRailMetaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  discoverRailInlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  discoverRailInlineActionText: {
    fontSize: 10,
    fontWeight: '900',
  },
  heroCard: {
    width: HERO_CARD_WIDTH,
    height: HERO_CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 20,
    shadowColor: '#8392B0',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,24,40,0.28)',
  },
  heroGlow: {
    position: 'absolute',
    top: -18,
    right: -10,
    width: 196,
    height: 196,
    borderRadius: 98,
    opacity: 0.34,
  },
  heroGlowSmall: {
    position: 'absolute',
    bottom: 48,
    left: -18,
    width: 116,
    height: 116,
    borderRadius: 58,
    opacity: 0.18,
  },
  heroIconHalo: {
    position: 'absolute',
    right: 24,
    bottom: 84,
    opacity: 0.2,
  },
  heroIconHaloWithImage: {
    opacity: 0.28,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCategoryPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroCategoryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroBottom: {
    flex: 1,
    marginTop: 'auto',
    minHeight: 0,
  },
  heroBottomContent: {
    gap: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    maxWidth: '92%',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroMetaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  heroActionPrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.36)',
  },
  heroActionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.48)',
  },
  heroActionText: {
    fontSize: 11,
    fontWeight: '900',
  },
  heroActionPrimaryText: {
    color: '#174F2E',
  },
  heroInlineMapButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroInlineMapText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontWeight: '800',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  listThumb: {
    width: 76,
    height: 76,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listThumbImage: {
    width: '100%',
    height: '100%',
  },
  listThumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flex: 1,
    minWidth: 0,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  listTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  listMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  listOrganizer: {
    fontWeight: '700',
  },
  listActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  listActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  swipeCard: {
    width: SCREEN_WIDTH - 44,
    height: SCREEN_HEIGHT * 0.76,
    borderRadius: 34,
    overflow: 'hidden',
  },
  swipeImage: {
    ...StyleSheet.absoluteFillObject,
  },
  swipeImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,18,31,0.34)',
  },
  swipeGlow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.16)',
    opacity: 0.5,
  },
  swipeWatermark: {
    position: 'absolute',
    bottom: 140,
    left: 18,
    opacity: 0.5,
  },
  swipeWatermarkWithImage: {
    opacity: 0.22,
  },
  swipeTopLabel: {
    marginTop: 16,
    marginLeft: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  swipeTopLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  swipeBody: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  swipeTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.85,
  },
  swipeMeta: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  swipeDescription: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  actionButtonSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    borderRadius: 36,
    borderWidth: 1,
    padding: 20,
    maxHeight: '78%',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 36,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,128,0.25)',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalMetaText: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailSheet: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 22,
    maxHeight: '84%',
  },
  detailImageWrap: {
    height: 194,
    borderRadius: 36,
    overflow: 'hidden',
    marginBottom: 16,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailCategoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailCategoryText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  detailSaveButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  detailMetaBlock: {
    gap: 8,
    marginBottom: 18,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailMetaText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  detailDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryDetailButton: {
    height: 54,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryDetailButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryDetailButton: {
    flex: 1,
    height: 50,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryDetailButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  organizerSafetyCard: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  organizerSafetyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  organizerSafetyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  organizerSafetyActions: {
    gap: 10,
  },
  organizerSafetyButton: {
    minHeight: 48,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  organizerSafetyButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
