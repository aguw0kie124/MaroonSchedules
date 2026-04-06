/**
 * Texas A&M Campus Data
 * Buildings, landmarks, amenities synced from the Master SQLite Registry
 */
import {
  Coffee,
  Dumbbell,
  GraduationCap,
  Home,
  Library as LibraryIcon,
  MapPin,
  Star,
  Utensils,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import REGISTRY_SNAPSHOT_JSON from './osm_places_tamu_10mi.json';
import type { LocationType } from '../components/places/types';

export interface CampusBuilding {
  id: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  type: LocationType;
}

export interface CampusAmenity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'restroom' | 'coffee' | 'dining' | 'study' | 'parking';
}

export interface CampusRegistryPlaceRecord {
  place_id: string;
  name: string;
  short_name?: string | null;
  type: string;
  lat: number;
  lng: number;
  aliases?: string[];
  description?: string | null;
  hours?: string | null;
  features?: string[] | string | null;
  address?: string | null;
  search_only?: boolean;
  source?: string | null;
}

type CampusRegistrySnapshot = {
  generated_at?: string;
  count?: number;
  attribution?: string;
  places?: CampusRegistryPlaceRecord[];
};

export const TAMU_CENTER = {
  latitude: 30.6153,
  longitude: -96.3410,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export const TAMU_BBOX = {
  south: 30.600,
  west: -96.360,
  north: 30.630,
  east: -96.320,
};

// --- Helper to map string types to union types ---
const mapBuildingType = (t: string): CampusBuilding['type'] => {
  const mapping: Record<string, CampusBuilding['type']> = {
    'academic': 'Academic',
    'athletics': 'Athletics',
    'library': 'Library',
    'dining': 'Dining',
    'recreation': 'Rec',
    'rec': 'Rec',
    'landmark': 'Landmark',
    'housing': 'Housing',
    'hub': 'Dining', // MSC is a hub/dining
  };
  return mapping[t.toLowerCase()] || 'Academic' as any;
};

const mapAmenityType = (t: string): CampusAmenity['type'] => {
  const normalized = t.toLowerCase();
  if (normalized === 'restroom') return 'restroom';
  if (normalized === 'coffee') return 'coffee';
  if (normalized === 'dining') return 'dining';
  if (normalized === 'study') return 'study';
  if (normalized === 'parking') return 'parking';
  return 'dining';
};

export const CAMPUS_REGISTRY_SNAPSHOT = REGISTRY_SNAPSHOT_JSON as CampusRegistrySnapshot;

export const CAMPUS_REGISTRY_PLACES: CampusRegistryPlaceRecord[] = Array.isArray(CAMPUS_REGISTRY_SNAPSHOT?.places)
  ? CAMPUS_REGISTRY_SNAPSHOT.places.filter(
      (place): place is CampusRegistryPlaceRecord =>
        !!place &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lng) &&
        typeof place.name === 'string' &&
        typeof place.place_id === 'string',
    )
  : [];

// ─── Buildings (Filtered from DB-synced registry snapshot) ───
export const BUILDINGS: CampusBuilding[] = CAMPUS_REGISTRY_PLACES
  .filter(p => ['academic', 'athletics', 'library', 'dining', 'recreation', 'rec', 'landmark', 'housing', 'hub'].includes(p.type.toLowerCase()))
  .map(p => ({
    id: p.place_id,
    name: p.name,
    shortName: p.short_name || '',
    latitude: p.lat,
    longitude: p.lng,
    type: mapBuildingType(p.type)
  }));

// ─── Amenities (Filtered from DB-synced registry snapshot) ───
export const AMENITIES: CampusAmenity[] = CAMPUS_REGISTRY_PLACES
  .filter(p => ['restroom', 'coffee', 'dining', 'study', 'parking'].includes(p.type.toLowerCase()))
  .map(p => ({
    id: p.place_id,
    name: p.name,
    latitude: p.lat,
    longitude: p.lng,
    type: mapAmenityType(p.type)
  }));

// Default user location (MSC area)
export const DEFAULT_USER_LOCATION = {
  buildingId: 'msc',
  name: 'Memorial Student Center',
  latitude: 30.612309,
  longitude: -96.341378,
};

export function getBuildingIcon(type: CampusBuilding['type']): ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  switch (type) {
    case 'Academic': return GraduationCap;
    case 'Athletics': return Star;
    case 'Library': return LibraryIcon;
    case 'Dining': return Utensils;
    case 'Rec': return Dumbbell;
    case 'Landmark': return Star;
    case 'Housing': return Home;
    default: return MapPin;
  }
}

export function getAmenityIcon(type: CampusAmenity['type']): ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  switch (type) {
    case 'coffee': return Coffee;
    case 'dining': return Utensils;
    case 'study': return LibraryIcon;
    case 'restroom': return MapPin;
    case 'parking': return MapPin;
    default: return MapPin;
  }
}
