import { Linking, Platform } from 'react-native';
import { Trophy, GraduationCap, Pizza, Users, HeartPulse, Ticket, Megaphone, CalendarDays } from 'lucide-react-native';
import { API_URL } from '../../config';

export const TAMU_EVENTS_API = `${API_URL}/campus/events?limit=1000`;

export type ExploreCategory =
  | 'Food'
  | 'Sports'
  | 'Social'
  | 'Miscellaneous'
  | 'Advocacy'
  | 'Academic'
  | 'Entertainment'
  | 'Health & Wellness';

export type SocialMode = 'casual' | 'professional';
export type EventsView = 'discover' | 'list' | 'swipe' | 'inbox';

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
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  is_admin_event?: boolean;
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
  event_types?: string[] | null;
  group_title?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  has_food?: boolean;
  food_confidence?: number;
  food_type?: string | null;
  categories?: Record<string, number>;
  _searchBlob?: string;
  _category?: ExploreCategory;
  _socialMode?: SocialMode;
  is_admin_event?: boolean;
}

export const ALL_CATEGORIES: ExploreCategory[] = [
  'Sports',
  'Academic',
  'Food',
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
    ...(event.tags || []),
    ...(event.event_types || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function classifyCategory(event: TAMUEvent): ExploreCategory {
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
  Linking.openURL(url).catch((err) => console.error('Error opening Google Calendar', err));
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
