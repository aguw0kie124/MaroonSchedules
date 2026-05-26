import { Linking, Platform } from 'react-native';
import { Trophy, GraduationCap, Pizza, Users, Heart, HeartPulse, Ticket, Megaphone, CalendarDays, CircleAlert } from 'lucide-react-native';
import { API_URL } from '../../config';

export const TAMU_EVENTS_API = `${API_URL}/campus/events?limit=1000`;

export type ExploreCategory =
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

export type SocialMode = 'casual' | 'professional';
export type EventsView = 'discover' | 'list' | 'swipe';
export type StandardExploreCategory = Exclude<ExploreCategory, 'For U'>;
export type PreferredTimeOption = 'Morning' | 'Afternoon' | 'Evening' | 'No Preference' | null;

export interface UserEventPreferences {
  major: string | null;
  preferredTime: PreferredTimeOption;
  avoidFriday: boolean;
}

export interface CampusEventResponse {
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
  primary_category?: string | null;
  secondary_categories?: string[] | null;
  interest_tags?: string[] | null;
  audience_tags?: string[] | null;
  content_flags?: string[] | null;
  recommendation_score?: number | null;
  for_u_match?: boolean | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  is_admin_event?: boolean;
  campus_interest_score?: number | null;
  campus_interest_label?: 'low' | 'medium' | 'high' | null;
  campus_interest_reasons?: string[] | null;
  image_url?: string | null;
  organization_name?: string | null;
  event_scope?: string | null;
  area_label?: string | null;
  is_off_campus?: boolean;
  is_promotion?: boolean;
  city?: string | null;
  business_name?: string | null;
  discount_text?: string | null;
}

export interface TAMUEvent {
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
  primary_category?: string | null;
  secondary_categories?: string[] | null;
  interest_tags?: string[] | null;
  audience_tags?: string[] | null;
  content_flags?: string[] | null;
  recommendation_score?: number | null;
  for_u_match?: boolean | null;
  event_types?: string[] | null;
  group_title?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  imageUrl?: string | null;
  _searchBlob?: string;
  _category?: ExploreCategory;
  _socialMode?: SocialMode;
  is_admin_event?: boolean;
  campus_interest_score?: number | null;
  campus_interest_label?: 'low' | 'medium' | 'high' | null;
  campus_interest_reasons?: string[] | null;
  area_label?: string | null;
  city?: string | null;
  business_name?: string | null;
  is_off_campus?: boolean;
  is_promotion?: boolean;
  discount_text?: string | null;
  _forYouScore?: number;
  _forYouMatched?: boolean;
  _forYouReasons?: string[];
}

export const ALL_CATEGORIES: ExploreCategory[] = [
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

export const MAJOR_OPTIONS: string[] = [
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

export const CATEGORY_META: Record<
  ExploreCategory,
  {
    accent: string;
    chipBg: string;
    chipText: string;
    cardTint: string;
    icon: any;
  }
> = {
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
    icon: CircleAlert,
  },
  Miscellaneous: {
    accent: '#D7DCE8',
    chipBg: '#ECEFF5',
    chipText: '#3A4458',
    cardTint: '#8A97B0',
    icon: CalendarDays,
  },
};

export function stripHtml(html: string) {
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

export function getSearchBlob(event: TAMUEvent) {
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

export function classifyCategory(event: TAMUEvent): ExploreCategory {
  if (event.primary_category) {
    const normalized = event.primary_category.toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'sports') return 'Sports';
    if (normalized === 'academic') return 'Academic';
    if (normalized === 'food') return 'Food';
    if (normalized === 'social') return 'Social';
    if (normalized === 'health_wellness') return 'Health & Wellness';
    if (normalized === 'entertainment') return 'Entertainment';
    if (normalized === 'advocacy') return 'Advocacy';
    if (normalized === 'miscellaneous') return 'Miscellaneous';
  }
  if (event.categories) {
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

export function getSocialMode(event: TAMUEvent): SocialMode {
  const blob = event._searchBlob || getSearchBlob(event);
  if (/\bcareer\b|\bnetworking\b|\bprofessional\b|\bresume\b|\binterview\b|\bcompany\b|\brecruit\b|\bworkshop\b|\bpanel\b/.test(blob)) {
    return 'professional';
  }
  return 'casual';
}

export function matchesMajor(event: TAMUEvent, major: string) {
  const blob = event._searchBlob || getSearchBlob(event);
  const aliases: Record<string, string[]> = {
    Engineering: ['engineering', 'engr', 'mechanical', 'electrical', 'csce', 'computer science'],
    Business: ['business', 'mays', 'finance', 'accounting', 'marketing'],
    'Liberal Arts': ['liberal arts', 'history', 'english', 'philosophy', 'communication'],
    Agriculture: ['agriculture', 'ag', 'animal science', 'horticulture'],
    Science: ['science', 'biology', 'chemistry', 'physics', 'math'],
    Architecture: ['architecture', 'arch', 'urban planning', 'construction science'],
    Education: ['education', 'teaching', 'curriculum'],
    'Public Health': ['public health', 'health', 'epidemiology'],
    Law: ['law', 'legal', 'pre-law'],
    Medicine: ['medicine', 'medical', 'premed', 'nursing', 'clinical'],
  };
  return aliases[major]?.some((term) => blob.includes(term)) ?? false;
}

export function normalizePreferredTime(value?: string | null): PreferredTimeOption {
  if (!value) return null;
  if (value === 'Morning' || value === 'Afternoon' || value === 'Evening' || value === 'No Preference') {
    return value;
  }
  return null;
}

export function matchesPreferredTime(event: TAMUEvent, preferredTime: PreferredTimeOption) {
  if (!preferredTime || preferredTime === 'No Preference') return true;
  const hour = new Date(event.date_ts * 1000).getHours();
  if (preferredTime === 'Morning') return hour >= 5 && hour < 11;
  if (preferredTime === 'Afternoon') return hour >= 11 && hour < 17;
  return hour >= 17 || hour < 1;
}

export function isFridayEvent(event: TAMUEvent) {
  return new Date(event.date_ts * 1000).getDay() === 5;
}

export function hasUserEventPreferences(preferences: UserEventPreferences) {
  return Boolean(
    preferences.major ||
      (preferences.preferredTime && preferences.preferredTime !== 'No Preference') ||
      preferences.avoidFriday,
  );
}

export function getForYouMeta(event: TAMUEvent, preferences: UserEventPreferences) {
  if (!hasUserEventPreferences(preferences)) {
    return { matched: false, score: 0, reasons: [] as string[] };
  }

  const reasons: string[] = [];
  let score = event.campus_interest_score ?? 40;

  if (preferences.major) {
    if (matchesMajor(event, preferences.major)) {
      score += 30;
      reasons.push('major_match');
    } else {
      score -= 8;
    }
  }

  if (preferences.preferredTime && preferences.preferredTime !== 'No Preference') {
    if (matchesPreferredTime(event, preferences.preferredTime)) {
      score += 18;
      reasons.push('time_match');
    } else {
      score -= 12;
    }
  }

  if (preferences.avoidFriday) {
    if (isFridayEvent(event)) {
      score -= 22;
      reasons.push('friday_filtered');
    } else {
      score += 6;
      reasons.push('weekday_match');
    }
  }

  if (event.campus_interest_label === 'high') {
    reasons.push('high_interest');
  } else if (event.campus_interest_label === 'medium') {
    reasons.push('medium_interest');
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const matched =
    normalizedScore >= 55 &&
    (!preferences.avoidFriday || !isFridayEvent(event));

  return {
    matched,
    score: normalizedScore,
    reasons,
  };
}

export function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCalendarDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function shortDescription(text?: string | null) {
  if (!text) return null;
  const clean = stripHtml(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157).trim()}...`;
}

export function handleGoogleCalendar(event: TAMUEvent) {
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

export function openNativeMaps(lat: number, lng: number, label?: string | null) {
  const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${query}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${query}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}
