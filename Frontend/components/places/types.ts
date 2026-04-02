import { Dimensions } from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Snap points for bottom sheet ──────────────────────────────
export const SNAP_PEEK = SCREEN_HEIGHT * 0.45;
export const SNAP_FULL = SCREEN_HEIGHT * 0.08;
export const SNAP_HIDDEN = SCREEN_HEIGHT;
export const SHEET_BOTTOM_OFFSET = 0;
export const FLOATING_CARD_BOTTOM_OFFSET = 124;
export { SCREEN_HEIGHT };

// ── Sentinel values ───────────────────────────────────────────
export const ALL_BUS_ROUTES_KEY = "__all__";

// ── External links ────────────────────────────────────────────
export const ROOM_RESERVATION_URL = "https://tamu.libcal.com/reserve";
export const PARKING_INFO_URL = "https://transport.tamu.edu/Parking";
export const EVENTS_URL = "https://stuactonline.tamu.edu/app/events";

// ── Map center ────────────────────────────────────────────────
export const TAMU_CENTER = {
  latitude: 30.6153,
  longitude: -96.341,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

// ── Domain types ──────────────────────────────────────────────
export type LocationType =
  | "Rec"
  | "Library"
  | "Study"
  | "Dining"
  | "Hub"
  | "General"
  | "Academic"
  | "Parking"
  | "Landmark"
  | "Housing"
  | "Athletics";

export type ParkingPermit = "visitor" | "garage" | "any_valid" | "west_campus" | "resident";

export interface ScheduleMeetingEntry {
  id: string;
  code: string;
  name: string;
  building: string;
  room?: string;
  days: string[];
  timeLabel: string;
  locationLabel: string;
  scheduleLabel: string;
  sequenceIndex?: number;
  date_ts?: number;
  type?: "class" | "event";
  category?: string;
  lat?: number;
  lng?: number;
}

export interface ScheduleMapOption {
  id: string;
  label: string;
  source: "uploaded" | "saved" | "personal";
  entries: ScheduleMeetingEntry[];
}

export interface CampusLocation {
  placeId?: string;
  location: string;
  percent_full: number;
  type: LocationType;
  is_live: boolean;
  available_seats: number | null;
  coord: { lat: number; lng: number };
  current_event?: string;
  hours?: string;
  reviews?: Array<{ user: string; rating: number; comment: string }>;
  traffic_history?: number[];
  restaurants?: string[];
  menu_snippet?: string[] | null;
  shortName?: string;
  description?: string;
  features?: string[];
  source?: "traffic" | "directory" | "schedule" | "snapshot";
  classMeetings?: ScheduleMeetingEntry[];
  scheduleLabel?: string;
  sequenceIndex?: number;
}
