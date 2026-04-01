import { fetchCampusOverview } from '../api/client';

export type CampusDataStatus = 'live' | 'preview' | 'link' | 'unavailable';

export interface CampusResourceLink {
  label: string;
  url?: string;
  path?: string;
}

export interface UnifiedCourse {
  id: string;
  code: string;
  name: string;
  time: string;
  beginTime?: string;
  endTime?: string;
  days: string[];
  location: string;
  instructor: string;
  credits: number;
  resources?: CampusResourceLink[];
}

export interface AcademicSnapshot {
  status: CampusDataStatus;
  sourceLabel: string;
  scheduleName: string;
  courses: UnifiedCourse[];
  totalCredits: number;
  nextCourse: UnifiedCourse | null;
  gpa: string;
  registrationReady: boolean;
  activeHolds: string[];
  resources: CampusResourceLink[];
}

export interface CampusNotification {
  id: string;
  title: string;
  detail: string;
  category: 'academic' | 'administrative' | 'social' | 'career';
  urgency: 'high' | 'medium' | 'low';
}

export interface DiningSnapshot {
  status: CampusDataStatus;
  planName: string;
  balanceLabel: string;
  recentActivityLabel: string;
  resources: CampusResourceLink[];
}

export interface CareerSnapshot {
  status: CampusDataStatus;
  summary: string;
  resources: CampusResourceLink[];
  alumniPreviewCount?: number;
}

export interface TransitSnapshot {
  status: CampusDataStatus;
  summary: string;
  resources: CampusResourceLink[];
}

export interface NetworkSuggestion {
  clerk_id: string;
  name: string;
  major: string;
  graduation_year: string;
  image_url?: string | null;
  relationship: 'peer' | 'alumni';
}

export interface NetworkSnapshot {
  status: CampusDataStatus;
  summary: string;
  pendingRequests: number;
  suggestions: NetworkSuggestion[];
  resources: CampusResourceLink[];
}

export interface CampusEvent {
  event_id: string;
  title: string;
  location: string;
  start_time?: string;
  end_time?: string;
  summary?: string;
  link?: string;
  rsvp_status?: string;
}

export interface RecreationFacility {
  id: string;
  name: string;
  source_url: string;
  hours_hint: string;
  today_hours?: string;
  weekly_hours?: Array<{ day: string; hours: string }>;
  hours_source?: string;
  notices?: Array<{ window?: string; detail?: string }>;
  summary?: string | null;
  amenities?: string[];
  percent_full?: number | null;
  current_count?: number | null;
  capacity?: number | null;
}

export interface RecreationSnapshot {
  status: CampusDataStatus;
  summary: string;
  facilities: RecreationFacility[];
}

export interface ServiceModule {
  id: string;
  title: string;
  summary: string;
  url: string;
}

export interface CampusConnector {
  system_id: string;
  label: string;
  status: string;
  login_url?: string | null;
  data_scope?: string | null;
  source_url?: string | null;
  page_title?: string | null;
  cookie_names?: string[];
  captured_at?: string | null;
  updated_at?: string | null;
}

export interface AuthSnapshot {
  status: string;
  primary_auth: string;
  institution_sso: {
    provider: string;
    status: string;
    note: string;
    resource_url: string;
  };
  user_id: string;
}

export interface CampusHubSnapshot {
  auth: AuthSnapshot;
  academic: AcademicSnapshot;
  notifications: CampusNotification[];
  dining: DiningSnapshot;
  career: CareerSnapshot;
  network: NetworkSnapshot;
  events: CampusEvent[];
  transit: TransitSnapshot;
  recreation: RecreationSnapshot;
  services: ServiceModule[];
  connectors: CampusConnector[];
  generatedAt: string;
}

function buildFallbackSnapshot(userId: string): CampusHubSnapshot {
  return {
    auth: {
      status: 'app_authenticated',
      primary_auth: 'Clerk',
      institution_sso: {
        provider: 'Howdy / NetID',
        status: 'connector_required',
        note: 'External institutional systems are not reachable right now, so the dashboard is using local fallback data.',
        resource_url: 'https://howdy.tamu.edu/main/home/card-view',
      },
      user_id: userId,
    },
    academic: {
      status: 'preview',
      sourceLabel: 'Campus hub fallback',
      scheduleName: 'Schedule unavailable',
      courses: [],
      totalCredits: 0,
      nextCourse: null,
      gpa: 'Connect Howdy',
      registrationReady: true,
      activeHolds: [],
      resources: [{ label: 'Howdy Portal', url: 'https://howdy.tamu.edu/main/home/card-view' }],
    },
    notifications: [],
    dining: {
      status: 'link',
      planName: 'Dining module ready to connect',
      balanceLabel: 'Transact eAccounts required for live balances',
      recentActivityLabel: 'Using fallback state.',
      resources: [{ label: 'Transact eAccounts', url: 'https://eacct-tamu-sp.transactcampus.com/eAccounts/BoardTransaction.aspx' }],
    },
    career: {
      status: 'link',
      summary: 'Hire Aggies connector required for live jobs and employers.',
      resources: [{ label: 'Hire Aggies', url: 'https://tamu-csm.symplicity.com/students/index.php?signin_tab=0' }],
    },
    network: {
      status: 'preview',
      summary: 'Networking suggestions are temporarily unavailable.',
      pendingRequests: 0,
      suggestions: [],
      resources: [],
    },
    events: [],
    transit: {
      status: 'live',
      summary: 'Transit map remains available.',
      resources: [{ label: 'AggieSpirit Route Map', url: 'https://aggiespirit.ts.tamu.edu/RouteMap' }],
    },
    recreation: {
      status: 'preview',
      summary: 'Recreation data is temporarily unavailable.',
      facilities: [],
    },
    services: [],
    connectors: [],
    generatedAt: new Date().toISOString(),
  };
}

export async function buildCampusHubSnapshot(userId: string): Promise<CampusHubSnapshot> {
  try {
    return await fetchCampusOverview(userId);
  } catch (error) {
    console.warn('[CampusHub] Falling back to local placeholder snapshot', error);
    return buildFallbackSnapshot(userId);
  }
}
