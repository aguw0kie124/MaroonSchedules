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
  Pressable,
  RefreshControl,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  Map,
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
import { useTheme } from './SharedUI';
import { useAppShellStore } from '../store/appShellStore';
import { useSessionStore } from '../store/sessionStore';
import { scheduleAdminEventReviewNotification, scheduleEventNotification } from '../services/notificationService';
import { promptGuestLogin } from '../utils/guestAccess';
import { blockUser, reportContent } from '../services/socialFeedService';
import { TagChips } from './common/TagChips';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_CARD_WIDTH = SCREEN_WIDTH - 40;
const HERO_CARD_HEIGHT = 380;
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
  _socialMode?: SocialMode;
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

type SocialMode = 'casual' | 'professional';
type EventsView = 'discover' | 'list' | 'swipe' | 'inbox';
type PreferredTimeOption = 'Morning' | 'Afternoon' | 'Evening' | 'No Preference' | null;

interface UserEventPreferences {
  major: MajorOption | null;
  preferredTime: PreferredTimeOption;
  avoidFriday: boolean;
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

const PERSONALIZATION_CATEGORY_LIMIT = 3;

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

const EVENTS_PREF_CHIP_SNAPSHOT_KEY = 'events:preference-chip-snapshot:v1';

function selectedCategoriesFromDeselects(deselected: string[]): Set<ExploreCategory> {
  const next = new Set(ALL_CATEGORIES);
  deselected.forEach((cat) => {
    if (isExploreCategory(cat)) {
      next.delete(cat as ExploreCategory);
    }
  });
  return next;
}

function normalizePreferredCategories(categories: string[] | undefined) {
  return (categories || []).filter(isExploreCategory).slice(0, PERSONALIZATION_CATEGORY_LIMIT);
}

function getTimePreferenceScore(event: TAMUEvent, preference: string | null) {
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
  preferredSocialMode: SocialMode | null,
  preferredTime: string | null,
  selectedMajor: MajorOption,
  useMajorSignal: boolean,
) {
  let score = 0;
  const category = event._category || classifyCategory(event);
  const categoryIndex = preferredCategories.indexOf(category);
  if (categoryIndex >= 0) {
    score += 34 - categoryIndex * 6;
  }
  if (category === 'Social' && preferredSocialMode) {
    if ((event._socialMode || getSocialMode(event)) === preferredSocialMode) {
      score += 16;
    }
  }
  if (useMajorSignal && matchesMajor(event, selectedMajor)) {
    score += 10;
  }
  score += getTimePreferenceScore(event, preferredTime);
  if (isFeaturedContent(event)) {
    score += 40; // Significant boost for featured/admin content
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
};

function normalizePreferredTime(value?: string | null): PreferredTimeOption {
  if (!value) return null;
  if (value === 'Morning' || value === 'Afternoon' || value === 'Evening' || value === 'No Preference') {
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

/** Featured chip / filter: admin posts or feeds explicitly marked featured (crawler/API). */
function isFeaturedContent(event: TAMUEvent): boolean {
  if (event.is_admin_event) return true;
  const f = event.categories?.featured;
  return f !== undefined && f !== null && Number(f) !== 0;
}

function classifyCategory(event: TAMUEvent): ExploreCategory {
  if (event.categories) {
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

/** Title/tags/description hints for each explore chip (used to tighten For U vs generic campus scores). */
const PREF_CATEGORY_KEYWORDS: Record<StandardExploreCategory, readonly string[]> = {
  Sports: ['sport', 'game', 'match', 'tournament', 'athletic', 'gym', 'football', 'basketball', 'volleyball', 'soccer', 'baseball', 'softball', 'track', 'swim', 'tennis', 'golf', 'intramural', 'ncaa', 'aggie'],
  Academic: ['lecture', 'seminar', 'research', 'study', 'symposium', 'department', 'faculty', 'dissertation', 'thesis', 'tutor', 'workshop', 'colloquium'],
  Food: ['food', 'meal', 'dining', 'breakfast', 'lunch', 'dinner', 'brunch', 'pizza', 'catering', 'refreshment', 'potluck', 'bbq', 'barbecue'],
  Social: ['social', 'mixer', 'meetup', 'meet ', ' hangout', 'party', 'networking social', 'student org', 'organization fair'],
  'Health & Wellness': ['wellness', 'mental health', 'yoga', 'meditation', 'therapy', 'counseling', 'self-care', 'fitness class', 'rec sports', 'nutrition'],
  Entertainment: ['concert', 'show', 'comedy', 'music', 'performance', 'festival', 'film', 'movie', 'theatre', 'theater', 'dance', 'talent'],
  Advocacy: ['advocacy', 'activism', 'awareness', 'march', 'rally', 'volunteer', 'community service', 'fundraiser', 'nonprofit'],
  Miscellaneous: ['career fair', 'transfer student', 'orientation', 'graduation', 'commencement'],
};

function eventAlignsWithPreferredCategoryBlob(event: TAMUEvent, stdPrefs: StandardExploreCategory[]): boolean {
  const blob = (event._searchBlob || getSearchBlob(event)).toLowerCase();
  return stdPrefs.some((pref) => {
    const words = PREF_CATEGORY_KEYWORDS[pref];
    return words.some((w) => blob.includes(w));
  });
}

function normalizeMajorBlob(blob: string) {
  return ` ${blob.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
}

function matchesMajor(event: TAMUEvent, major: MajorOption) {
  const blob = normalizeMajorBlob(event._searchBlob || getSearchBlob(event));
  return MAJOR_KEYWORDS[major]?.some((term) => blob.includes(` ${term.toLowerCase().trim()} `)) ?? false;
}

function matchesPreferredTime(event: TAMUEvent, preferredTime: PreferredTimeOption) {
  if (!preferredTime || preferredTime === 'No Preference') return true;
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
    (preferences.preferredTime && preferences.preferredTime !== 'No Preference') ||
    preferences.avoidFriday,
  );
}

/** True when we can run preference-based For U (onboarding + planner fields or category picks). */
function hasForYouPersonalizationInput(
  preferences: UserEventPreferences,
  preferredExploreCategories: ExploreCategory[],
): boolean {
  return hasUserEventPreferences(preferences) || preferredExploreCategories.length > 0;
}

function getForYouMeta(
  event: TAMUEvent,
  preferences: UserEventPreferences,
  preferredExploreCategories: ExploreCategory[],
  ctx: { isSignedIn: boolean },
) {
  const category = event._category || classifyCategory(event);
  const stdPrefs = preferredExploreCategories.filter(
    (c): c is StandardExploreCategory => c !== 'Featured' && c !== 'For U',
  );

  if (hasUserEventPreferences(preferences) || stdPrefs.length > 0) {
    const reasons: string[] = [];
    let score = 45;

    if (stdPrefs.length > 0) {
      const idx =
        category !== 'Featured' && category !== 'For U' ? stdPrefs.indexOf(category) : -1;
      if (idx >= 0) {
        score += 38 - idx * 7;
        reasons.push('category_preference');
      }
      if (eventAlignsWithPreferredCategoryBlob(event, stdPrefs)) {
        score += 20;
        reasons.push('topic_keywords');
      }
    }

    if (preferences.major) {
      if (matchesMajor(event, preferences.major)) {
        score += 28;
        reasons.push('major_match');
      } else {
        score -= 10;
        reasons.push('major_mismatch');
      }
    }

    if (preferences.preferredTime && preferences.preferredTime !== 'No Preference') {
      if (matchesPreferredTime(event, preferences.preferredTime)) {
        score += 18;
        reasons.push('time_match');
      } else {
        score -= 12;
        reasons.push('time_mismatch');
      }
    }

    if (preferences.avoidFriday) {
      if (isFridayEvent(event)) {
        score -= 24;
        reasons.push('friday_filtered');
      } else {
        score += 8;
        reasons.push('weekday_match');
      }
    }

    const normalizedScore = Math.max(0, Math.min(100, score));

    let matched: boolean;
    if (stdPrefs.length > 0) {
      const inPreferredCategory =
        category !== 'Featured' && category !== 'For U' && stdPrefs.includes(category);
      const keywordAligned = eventAlignsWithPreferredCategoryBlob(event, stdPrefs);
      matched =
        inPreferredCategory ||
        keywordAligned ||
        (reasons.includes('major_match') && normalizedScore >= 52);
    } else {
      matched = normalizedScore >= 60;
    }

    if (preferences.avoidFriday && isFridayEvent(event)) {
      matched = false;
    }

    return {
      matched,
      score: normalizedScore,
      reasons,
    };
  }

  if (ctx.isSignedIn) {
    const label = event.campus_interest_label;
    const raw = event.campus_interest_score;
    const scoreNum = typeof raw === 'number' && Number.isFinite(raw) ? raw : 45;
    const matched =
      label === 'high' ||
      (label === 'medium' && scoreNum >= 56) ||
      (label == null && scoreNum >= 68);
    const score = Math.max(0, Math.min(100, scoreNum));
    return {
      matched,
      score,
      reasons: matched ? (['campus_fit'] as string[]) : [],
    };
  }

  return { matched: false, score: 0, reasons: [] as string[] };
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
  Linking.openURL(url).catch((err) => console.error('Error opening Google Calendar', err));
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
  const { user } = useUser();
  const s = useMemo(() => getStyles(COLORS, isDark, embedded), [COLORS, isDark, embedded]);
  const isGuest = useSessionStore((state) => state.isGuest);

  const { advanceStep, activeTargetName } = useTour();

  const [view, setView] = useState<EventsView>('discover');

  const [selectedCategories, setSelectedCategories] = useState<Set<ExploreCategory>>(
    () => new Set(ALL_CATEGORIES),
  );
  const [socialMode, setSocialMode] = useState<SocialMode>('casual');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailEvent, setDetailEvent] = useState<TAMUEvent | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [swipeIndex, setSwipeIndex] = useState(0);
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
    dislikeEvent,
    removeIdsFromDisliked,
    clearDisliked,
    receivedInvites: persistedReceivedInvites,
    acceptInvite,
    rejectInvite,
    deselectedCategories,
    toggleCategoryDeselection,
  } = useEventStore();
  const scheduledEvents = persistedScheduledEvents;
  const savedEventIds = persistedSavedEventIds;
  const dislikedEventIds = persistedDislikedEventIds;
  const receivedInvites = persistedReceivedInvites;

  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const hydratedProfileMajorForUser = useRef<string | null>(null);
  const nowTs = Math.floor(Date.now() / 1000);

  const [eventStoreHydrated, setEventStoreHydrated] = useState(() => useEventStore.persist.hasHydrated());

  useEffect(() => {
    if (useEventStore.persist.hasHydrated()) {
      setEventStoreHydrated(true);
    }
    const unsub = useEventStore.persist.onFinishHydration(() => {
      setEventStoreHydrated(true);
    });
    return unsub;
  }, []);

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
            categories: event.categories || undefined,
            imageUrl: resolveEventImageUrl(event.image_url ?? null),
            is_admin_event: !!event.is_admin_event,
            google_review_url: event.google_review_url ?? null,
            admin_clerk_id: event.admin_clerk_id ?? null,
            campus_interest_score: event.campus_interest_score ?? null,
            campus_interest_label: event.campus_interest_label ?? null,
            campus_interest_reasons: event.campus_interest_reasons ?? null,
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
    staleTime: 1000 * 60 * 5, // 5 mins
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const [rewardToast, setRewardToast] = useState<{ title: string; body: string } | null>(null);
  const rewardToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const profileMajor = profilePreferences.major;

  const {
    data: preferredEventCategories,
  } = useQuery({
    queryKey: ['user-event-categories', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const profile = await fetchUserProfile(user!.id);
      return profile?.preferred_event_categories || [];
    },
  });

  const {
    data: preferredSocialMode,
  } = useQuery({
    queryKey: ['user-social-mode', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const profile = await fetchUserProfile(user!.id);
      return profile?.social_mode as SocialMode || null;
    },
  });

  const {
    data: preferredTime,
  } = useQuery({
    queryKey: ['user-preferred-time', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const profile = await fetchUserProfile(user!.id);
      return profile?.preferred_time || null;
    },
  });

  const normalizedPreferenceCategories = useMemo(
    () => normalizePreferredCategories(preferredEventCategories),
    [preferredEventCategories],
  );

  const personalizedEvents = useMemo(
    () =>
      events.map((event) => {
        const meta = getForYouMeta(event, profilePreferences, normalizedPreferenceCategories, {
          isSignedIn: Boolean(user?.id) && !isGuest,
        });
        return {
          ...event,
          _forYouMatched: meta.matched,
          _forYouScore: meta.score,
          _forYouReasons: meta.reasons,
        };
      }),
    [events, profilePreferences, normalizedPreferenceCategories, user?.id, isGuest],
  );

  const hasForYouPrefs = useMemo(
    () =>
      hasForYouPersonalizationInput(profilePreferences, normalizedPreferenceCategories) ||
      (Boolean(user?.id) && !isGuest),
    [profilePreferences, normalizedPreferenceCategories, user?.id, isGuest],
  );

  const isEventPreferencesCompleted = !!preferredEventCategories && preferredEventCategories.length > 0;

  const preferenceDataReady = useMemo(
    () =>
      isEventPreferencesCompleted &&
      preferredSocialMode !== undefined &&
      preferredTime !== undefined,
    [isEventPreferencesCompleted, preferredSocialMode, preferredTime],
  );

  // After zustand rehydrates, mirror persisted deselections into chip UI (avoids flashing wrong state before hydration).
  useEffect(() => {
    if (!eventStoreHydrated) {
      return;
    }
    setSelectedCategories(selectedCategoriesFromDeselects(deselectedCategories));
  }, [eventStoreHydrated, deselectedCategories]);

  // When event preferences (onboarding / settings) change vs last session snapshot, reset chips to all on and clear explore deselects.
  useEffect(() => {
    if (!eventStoreHydrated || !preferenceDataReady) {
      return;
    }
    let cancelled = false;

    const preferenceKey = JSON.stringify({
      categories: normalizedPreferenceCategories,
      socialMode: preferredSocialMode,
      preferredTime,
    });

    (async () => {
      try {
        if (!user?.id) {
          return;
        }
        const snapshotStorageKey = `${EVENTS_PREF_CHIP_SNAPSHOT_KEY}:${user.id}`;
        const stored = await AsyncStorage.getItem(snapshotStorageKey);
        if (cancelled) {
          return;
        }
        if (stored === preferenceKey) {
          return;
        }

        const exploreDeselects = useEventStore
          .getState()
          .deselectedCategories.filter((c) => isExploreCategory(c));

        // App update / first snapshot: keep persisted chip deselects; only record current prefs for next comparison.
        if (stored === null && exploreDeselects.length > 0) {
          await AsyncStorage.setItem(snapshotStorageKey, preferenceKey);
          return;
        }

        await AsyncStorage.setItem(snapshotStorageKey, preferenceKey);
        if (cancelled) {
          return;
        }

        exploreDeselects.forEach((cat) => {
          toggleCategoryDeselection(cat, false);
        });
        setSelectedCategories(new Set(ALL_CATEGORIES));
        if (preferredSocialMode) {
          setSocialMode(preferredSocialMode);
        }
        if (!embedded) {
          setView('discover');
        }
      } catch {
        // ignore storage failures; chip state still follows deselection sync effect
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    embedded,
    eventStoreHydrated,
    normalizedPreferenceCategories,
    preferenceDataReady,
    preferredSocialMode,
    preferredTime,
    toggleCategoryDeselection,
    user?.id,
  ]);

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
      const inTimeWindow =
        (event.date2_ts != null && event.date2_ts > nowTs) ||
        (event.date_ts >= nowTs - 7200) ||
        (isFeaturedContent(event) && event.date_ts >= nowTs - 86400);
      if (!inTimeWindow) return;

      // Admin / featured-tagged events bypass major-matching for counts
      if (
        isMajorSpecific &&
        !matchesMajor(event, selectedMajor) &&
        !event.is_admin_event &&
        !event.categories?.featured
      ) {
        return;
      }
      if (event._forYouMatched) {
        counts['For U'] += 1;
      }
      const category = event._category || classifyCategory(event);
      if (isFeaturedContent(event)) {
        counts.Featured += 1;
      }
      if (category !== 'Featured') {
        counts[category] += 1;
      } else if (!isFeaturedContent(event)) {
        // Fallback for safety, though classifyCategory should not return Featured now
        counts.Miscellaneous += 1;
      }
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
      const inTimeWindow =
        (event.date2_ts != null && event.date2_ts > nowTs) ||
        (event.date_ts >= nowTs - 7200) ||
        (isFeaturedContent(event) && event.date_ts >= nowTs - 172800);
      return inTimeWindow;
    });

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      next = next.filter((event) => {
        // "Steel Curtain" for admin/featured events: they bypass search if Featured tab is selected
        if (isFeaturedSelected && isFeaturedContent(event)) return true;
        return (event._searchBlob || getSearchBlob(event)).includes(q);
      });
    }

    if (isMajorSpecific) {
      next = next.filter(
        (event) =>
          matchesMajor(event, selectedMajor) || event.is_admin_event || !!event.categories?.featured,
      );
    }

    // Apply category filters with Featured union semantics:
    // When Featured is active, admin events always pass through regardless of other filters
    const hasNonFeaturedFilters = isForYouSelected || standardSelectedCategories.length > 0;

    if (hasNonFeaturedFilters) {
      next = next.filter((event) => {
        if (isFeaturedSelected && isFeaturedContent(event)) return true;

        const category = event._category || classifyCategory(event);

        if (isForYouSelected && event._forYouMatched) return true;

        if (standardSelectedCategories.length > 0) {
          return category !== 'For U' && category !== 'Featured' && standardSelectedCategories.includes(category);
        }

        return false;
      });
    } else if (isFeaturedSelected) {
      next = next.filter((event) => isFeaturedContent(event));
    }

    if (standardSelectedCategories.includes('Social')) {
      next = next.filter((event) => {
        const category = event._category || classifyCategory(event);
        return category !== 'Social' || (event._socialMode || getSocialMode(event)) === socialMode;
      });
    }

    next = next.filter((event) => !dislikedEventIds.includes(String(event.id)));

    next = [...next].sort((left, right) => {
      // 1. Priority to Featured content if Featured tab is selected
      if (isFeaturedSelected) {
        const leftF = isFeaturedContent(left) ? 1 : 0;
        const rightF = isFeaturedContent(right) ? 1 : 0;
        if (leftF !== rightF) return rightF - leftF;
      }

      // 2. Personalization score priority if For U is selected
      if (isForYouSelected) {
        const leftScore =
          left._forYouScore ??
          getPersonalizationScore(
            left,
            normalizedPreferenceCategories,
            preferredSocialMode,
            preferredTime,
            selectedMajor,
            isMajorSpecific,
          );
        const rightScore =
          right._forYouScore ??
          getPersonalizationScore(
            right,
            normalizedPreferenceCategories,
            preferredSocialMode,
            preferredTime,
            selectedMajor,
            isMajorSpecific,
          );
        const scoreDiff = rightScore - leftScore;
        if (Math.abs(scoreDiff) > 1) return scoreDiff;
      }

      // 3. Chronological tie-breaker
      return left.date_ts - right.date_ts;
    });

    return next;
  }, [
    dislikedEventIds,
    personalizedEvents,
    isFeaturedSelected,
    isMajorSpecific,
    isForYouSelected,
    nowTs,
    normalizedPreferenceCategories,
    deferredSearchQuery,
    preferredSocialMode,
    preferredTime,
    selectedCategories,
    selectedMajor,
    socialMode,
    standardSelectedCategories,
  ]);

  const discoverEvents = useMemo(() => filteredUpcomingEvents.slice(0, 8), [filteredUpcomingEvents]);
  const collapsedCategories = useMemo(() => ALL_CATEGORIES.slice(0, 5), []);

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
  }, [selectedCategories, socialMode, deferredSearchQuery, isMajorSpecific, selectedMajor, profileMajor, profilePreferences.avoidFriday, profilePreferences.preferredTime]);

  const changeView = useCallback((nextView: EventsView) => {
    startTransition(() => {
      setView(nextView);
    });
  }, []);

  const toggleCategory = useCallback(
    (category: ExploreCategory) => {
      const wasSelected = selectedCategories.has(category);
      if (wasSelected && selectedCategories.size <= 1) {
        return;
      }
      setSelectedCategories((prev) => {
        const next = new Set(prev);
        if (wasSelected) {
          next.delete(category);
        } else {
          next.add(category);
        }
        return next;
      });
      queueMicrotask(() => {
        toggleCategoryDeselection(category, wasSelected);
      });
    },
    [selectedCategories, toggleCategoryDeselection],
  );

  const handleSchedule = useCallback(
    async (event: TAMUEvent) => {
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
            console.error('[Events] RSVP remove error:', error);
          }
        }
        triggerRewardToast('Removed from your plans', 'No problem. You can always add it back later.');
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
        scheduleEventNotification(
          event.title,
          `Starting at ${event.location || 'TAMU'} in ${leadTime} minutes.`,
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
          console.error('[Events] RSVP error:', error);
        }
      }
      triggerRewardToast('Added to your schedule', 'Nice. We will keep this one easy to come back to.');
      Alert.alert('Successfully RSVPed', `${event.title} is now in your schedule.`);
    },
    [activeTargetName, advanceStep, navigation, removeScheduledEvent, scheduleEvent, scheduledEvents, triggerRewardToast, user],
  );

  const handleShare = useCallback((event: TAMUEvent) => {
    triggerNativeShare({
      title: event.title,
      message: `Check out this event: ${event.title} at ${event.location || 'TAMU'}!`,
      url: event.url || 'https://maroonschedules.tamu.edu',
      id: event.id,
      type: 'event',
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
        triggerRewardToast('Saved event removed', 'Your shortlist just got a little cleaner.');
      } else {
        saveEvent(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        triggerRewardToast('Saved for later', 'Good pick. This one is waiting for you.');
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
                console.error('[Events] Unsubscribe organizer error:', error);
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
                console.error('[Events] Block organizer error:', error);
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
        console.error('[Events] Report organizer error:', error);
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

  const renderHeader = (title: string) => (
    <View style={s.headerBlock}>
      <View style={s.headerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle}>{title}</Text>
        </View>
        <Pressable style={s.headerIconButton} onPress={() => setSettingsVisible(true)}>
          <Funnel size={24} color={COLORS.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={s.modeTabs}>
        {([
          { id: 'discover', label: 'Discover' },
          { id: 'list', label: 'List' },
        ] as const).map((tab) => {
          const active = view === tab.id;
          const tabItem = (
            <Pressable
              key={tab.id}
              style={[s.modeTab, active && s.modeTabActive]}
              onPress={() => {
                changeView(tab.id);
                if (tab.id === 'list' && activeTargetName === 'switch-to-list') {
                  advanceStep('switch-to-list');
                }
              }}
            >
              <Text style={[s.modeTabText, active && s.modeTabTextActive]}>{tab.label}</Text>
              {active ? <View style={s.modeTabUnderline} /> : null}
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

  return (
    <View style={s.container}>
      <EventRewardToast
        visible={!!rewardToast}
        title={rewardToast?.title || ''}
        body={rewardToast?.body || ''}
      />
      {view === 'discover' && (
        <>
          {renderHeader('Events')}


          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Loading campus events...</Text>
            </View>
          ) : (
            <View style={s.discoverLayout}>
              <ScrollView
                style={s.discoverScroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
              >


                <View style={s.categoryWrap}>
                  {categoriesExpanded ? (
                    <>
                      <View style={s.categoryHeaderRow}>
                        <Text style={s.categorySectionLabel}>Filters</Text>
                        <Pressable onPress={() => setCategoriesExpanded(false)}>
                          <Text style={s.categoryToggleText}>Less</Text>
                        </Pressable>
                      </View>
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
                    </>
                  ) : (
                    <>
                      <View style={s.categoryHeaderRow}>
                        <Text style={s.categorySectionLabel}>Filters</Text>
                        <Pressable onPress={() => setCategoriesExpanded(true)}>
                          <Text style={s.categoryToggleText}>More</Text>
                        </Pressable>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.categoryCollapsedRow}
                      >
                        {collapsedCategories.map((category) => (
                          <CategoryChip
                            key={category}
                            category={category}
                            count={categoryCounts[category] || 0}
                            active={selectedCategories.has(category)}
                            onPress={() => toggleCategory(category)}
                          />
                        ))}
                      </ScrollView>
                    </>
                  )}
                </View>

                <View style={s.inlineControls}>
                  {selectedCategories.has('Social') ? (
                    <View style={s.socialModeWrap}>
                      {(['casual', 'professional'] as SocialMode[]).map((mode) => (
                        <Pressable
                          key={mode}
                          style={[s.socialModePill, socialMode === mode && s.socialModePillActive]}
                          onPress={() => setSocialMode(mode)}
                        >
                          <Text
                            style={[
                              s.socialModeText,
                              socialMode === mode && s.socialModeTextActive,
                            ]}
                          >
                            {mode === 'casual' ? 'Casual' : 'Professional'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  directionalLockEnabled
                  contentContainerStyle={s.heroRail}
                  snapToOffsets={discoverEvents.map((_, index) => index * HERO_CARD_SNAP_INTERVAL)}
                  snapToAlignment="start"
                  disableIntervalMomentum
                  decelerationRate="fast"
                >
                  {discoverEvents.map((event, i) => {
                    const card = (
                      <StaggeredReveal key={String(event.id)} index={i}>
                        <View
                          style={{ marginRight: i === discoverEvents.length - 1 ? 0 : HERO_CARD_GAP }}
                        >
                          <HeroEventCard
                            event={event}

                            scheduled={scheduledEvents.some((scheduled) => String(scheduled.id) === String(event.id))}
                            onSchedule={() => handleSchedule(event)}
                            onPress={() => setDetailEvent(event)}
                            onMap={() => handleMapOpen(event)}
                          />
                        </View>
                      </StaggeredReveal>
                    );
                    return card;
                  })}
                </ScrollView>
              </ScrollView>
            </View>
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
                placeholder="Search campus events..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>
            <Pressable style={s.filterButton} onPress={() => setSettingsVisible(true)}>
              <Filter size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={[s.categoryWrap, { marginBottom: 16, marginTop: 4 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.categoryCollapsedRow}
            >
              {ALL_CATEGORIES.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  count={categoryCounts[category] || 0}
                  active={selectedCategories.has(category)}
                  onPress={() => toggleCategory(category)}
                />
              ))}
            </ScrollView>
          </View>


          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Loading campus events...</Text>
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
        dislikedEventIds={dislikedEventIds}
        events={personalizedEvents}
        onRestoreCategory={handleRestoreCategory}
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
    </View>
  );
}

function CategoryChip({
  category,
  count,
  active,
  onPress,
}: {
  category: ExploreCategory;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const { accent, chipBg, chipText, icon: Icon } = CATEGORY_META[category];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${category} filter, ${active ? 'on' : 'off'}, ${count} events`}
      onPress={onPress}
      style={[
        stylesStatic.categoryChip,
        {
          backgroundColor: active ? accent : chipBg,
          opacity: active || count > 0 ? 1 : 0.48,
          borderWidth: active ? 2.5 : 1.5,
          borderColor: active ? '#FFFFFF' : `${chipText}4D`,
          shadowOpacity: active ? 0.14 : 0.05,
        },
      ]}
    >
      <Icon size={15} color={active ? '#FFFFFF' : chipText} />
      <Text style={[stylesStatic.categoryChipText, { color: active ? '#FFFFFF' : chipText }]}>
        {category}
      </Text>
      <View
        style={[
          stylesStatic.categoryChipToggle,
          active ? stylesStatic.categoryChipToggleOn : stylesStatic.categoryChipToggleOff,
        ]}
      >
        {active ? (
          <Check size={12} color="#FFFFFF" strokeWidth={3} />
        ) : (
          <View style={[stylesStatic.categoryChipToggleRing, { borderColor: `${chipText}55` }]} />
        )}
      </View>
      <Text
        style={[
          stylesStatic.categoryChipCount,
          { color: active ? 'rgba(255,255,255,0.88)' : `${chipText}CC` },
        ]}
      >
        {count}
      </Text>
    </Pressable>
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

  return (
    <Pressable
      onPress={onPress}
      style={[stylesStatic.heroCard, { backgroundColor: meta.cardTint }]}
    >
      {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={stylesStatic.heroImage} resizeMode="cover" /> : null}
      {event.imageUrl ? <View style={stylesStatic.heroImageOverlay} /> : null}
      <View style={[stylesStatic.heroGlow, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
      <View style={[stylesStatic.heroGlowSmall, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <View style={[stylesStatic.heroIconHalo, event.imageUrl ? stylesStatic.heroIconHaloWithImage : null]}>
        <Icon size={88} color="rgba(255,255,255,0.12)" />
      </View>

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
            stylesStatic.heroActionPrimary,
            scheduled && stylesStatic.heroActionDisabled,
          ]}
          onPress={() => {
            if (!scheduled) onSchedule();
          }}
        >
          <CalendarDays size={15} color="#174F2E" />
          <Text style={[stylesStatic.heroActionText, stylesStatic.heroActionPrimaryText]}>
            Add
          </Text>
        </Pressable>
        <Pressable
          style={[
            stylesStatic.heroActionButton,
            stylesStatic.heroActionSecondary,
            !scheduled && stylesStatic.heroActionDisabled,
          ]}
          onPress={() => {
            if (scheduled) onSchedule();
          }}
        >
          <XIcon size={15} color="#FFFFFF" />
          <Text style={[stylesStatic.heroActionText, stylesStatic.heroActionSecondaryText]}>
            Remove
          </Text>
        </Pressable>

        {event.location_lat != null && event.location_lng != null ? (
          <Pressable style={stylesStatic.heroInlineMapButton} onPress={onMap}>
            <Map size={14} color="rgba(255,255,255,0.92)" />
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
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
      ]}
    >
      <View style={[stylesStatic.listThumb, { backgroundColor: meta.cardTint }]}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={stylesStatic.listThumbImage} resizeMode="cover" />
        ) : (
          <View style={stylesStatic.listThumbFallback}>
            <Icon size={28} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={stylesStatic.listContent}>
        <View style={stylesStatic.listTitleRow}>
          <Text style={[stylesStatic.listTitle, { color: COLORS.textPrimary }]} numberOfLines={2}>
            {event.title}
          </Text>
          {event.group_title ? <BadgeCheck size={16} color="#2F80ED" /> : null}
        </View>
        <Text style={[stylesStatic.listMeta, { color: COLORS.textSecondary }]}>
          {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
        </Text>
        {event.group_title ? (
          <Text style={[stylesStatic.listMeta, stylesStatic.listOrganizer, { color: COLORS.primary }]} numberOfLines={1}>
            {event.group_title}
          </Text>
        ) : null}

        <Text style={[stylesStatic.listMeta, { color: COLORS.textTertiary }]} numberOfLines={1}>
          {event.location || 'Campus'}
        </Text>
      </View>
      <View style={stylesStatic.listActions}>
        {!isGuest ? (
          <Pressable onPress={onDelete} style={stylesStatic.listActionButton}>
            <Trash2 size={20} color={COLORS.textSecondary} />
          </Pressable>
        ) : null}

        <Pressable onPress={onShare} style={stylesStatic.listActionButton}>
          <Share2 size={20} color={COLORS.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onSchedule}
          style={[
            stylesStatic.listActionButton,
            {
              backgroundColor: scheduled
                ? '#FFEEE5'
                : isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(15,23,42,0.06)',
            },
          ]}
        >
          {scheduled ? <XIcon size={20} color="#E06A3E" /> : <Check size={20} color="#3CCB6C" />}
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
  dislikedEventIds,
  events,
  onRestoreCategory,
}: {
  visible: boolean;
  onClose: () => void;
  isMajorSpecific: boolean;
  selectedMajor: MajorOption;
  setMajorSpecific: (val: boolean) => void;
  setSelectedMajor: (major: MajorOption) => void;
  socialMode: SocialMode;
  setSocialMode: (mode: SocialMode) => void;
  selectedCategories: Set<ExploreCategory>;
  dislikedEventIds: string[];
  events: TAMUEvent[];
  onRestoreCategory: (category?: ExploreCategory) => void;
}) {
  const { COLORS } = useTheme();

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
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[stylesStatic.modalTitle, { color: COLORS.textPrimary }]}>Filters</Text>

            {selectedCategories.has('Social') ? (
              <>
                <Text style={[stylesStatic.modalSectionLabel, { color: COLORS.textTertiary, marginTop: 12 }]}>
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
              Hidden events
            </Text>
            <Pressable style={stylesStatic.modalOption} onPress={() => onRestoreCategory()}>
              <Text style={[stylesStatic.modalOptionText, { color: '#FF4D6D' }]}>
                Restore all hidden events
              </Text>
            </Pressable>
            {ALL_CATEGORIES.map((category) => {
              const count = dislikedEventIds.filter((id) => {
                const event = events.find((candidate) => String(candidate.id) === id);
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
                {formatDate(event.date_ts)} · {formatTime(event.date_ts)}
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
            {event.group_title ? (
              <View style={stylesStatic.detailMetaRow}>
                <BadgeCheck size={15} color="#2F80ED" />
                <Text style={[stylesStatic.detailMetaText, { color: COLORS.textSecondary }]}>
                  {event.group_title}
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
                  Places
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
    pageTitle: {
      color: COLORS.textPrimary,
      fontSize: 34,
      fontWeight: '900',
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
      borderRadius: 22,
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
      fontWeight: '800',
    },
    modeTabTextActive: {
      color: COLORS.textPrimary,
      fontWeight: '900',
    },
    modeTabUnderline: {
      position: 'absolute',
      bottom: -5,
      left: 0,
      right: 0,
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
    forYouHero: {
      borderRadius: 28,
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
      justifyContent: 'space-between',
    },
    categorySectionLabel: {
      color: COLORS.textSecondary,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    categoryToggleText: {
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '900',
    },
    categoryCollapsedRow: {
      gap: 10,
      paddingRight: 10,
    },
    categoryExpandedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    inlineControls: {
      marginTop: 10,
      gap: 10,
    },
    inlineControl: {
      borderRadius: 16,
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
      paddingBottom: 10,
    },
    searchShell: {
      flex: 1,
      height: 46,
      borderRadius: 14,
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
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: 'transparent',
    },
    listScroll: {
      paddingHorizontal: 18,
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
      borderRadius: 18,
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
      borderRadius: 24,
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
    borderRadius: 22,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.25,
    shadowColor: '#000000',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  categoryChipToggle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 1,
  },
  categoryChipToggleOn: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  categoryChipToggleOff: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  categoryChipToggleRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.75,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  categoryChipCount: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 2,
  },
  heroCard: {
    width: HERO_CARD_WIDTH,
    height: HERO_CARD_HEIGHT,
    borderRadius: 40,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingVertical: 28,
    shadowColor: '#8392B0',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
    top: -24,
    right: -14,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.34,
  },
  heroGlowSmall: {
    position: 'absolute',
    bottom: 54,
    left: -28,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.18,
  },
  heroIconHalo: {
    position: 'absolute',
    right: 30,
    bottom: 100,
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
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroCategoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  heroBottom: {
    flex: 1,
    marginTop: 'auto',
    minHeight: 0,
  },
  heroBottomContent: {
    gap: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.0,
    maxWidth: '88%',
  },
  heroOrganizerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroOrganizerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 240,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  heroActionPrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.36)',
  },
  heroActionSecondary: {
    backgroundColor: 'rgba(93,108,141,0.66)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroActionDisabled: {
    opacity: 0.44,
  },
  heroActionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  heroActionPrimaryText: {
    color: '#174F2E',
  },
  heroActionSecondaryText: {
    color: '#FFFFFF',
  },
  heroInlineMapButton: {
    marginTop: 2,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroInlineMapText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '800',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  listThumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
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
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  listMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  listOrganizer: {
    fontWeight: '700',
  },
  listActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderRadius: 28,
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
    borderRadius: 18,
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
    borderRadius: 22,
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
    borderRadius: 18,
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
    borderRadius: 16,
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
    borderRadius: 14,
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
