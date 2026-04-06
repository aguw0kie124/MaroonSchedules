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
import LOCAL_OSM_PLACES_PAYLOAD from './osm_places_tamu_10mi.json';

export interface CampusBuilding {
  id: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  type: 'academic' | 'athletics' | 'library' | 'dining' | 'recreation' | 'landmark' | 'housing';
}

export interface CampusAmenity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'restroom' | 'coffee' | 'dining' | 'study' | 'parking';
}

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
    'academic': 'academic',
    'athletics': 'athletics',
    'library': 'library',
    'dining': 'dining',
    'recreation': 'recreation',
    'rec': 'recreation',
    'landmark': 'landmark',
    'housing': 'housing',
    'hub': 'dining', // MSC is a hub/dining
  };
  return mapping[t.toLowerCase()] || 'academic';
};

const mapAmenityType = (t: string): CampusAmenity['type'] => {
  const mapping: Record<string, CampusAmenity['type']> = {
    'restroom': 'restroom',
    'coffee': 'coffee',
    'dining': 'dining',
    'study': 'study',
    'parking': 'parking',
  };
  return mapping[t.toLowerCase()] || 'dining';
};

// ─── Buildings (Filtered from Master JSON) ───────────────────
export const BUILDINGS: CampusBuilding[] = LOCAL_OSM_PLACES_PAYLOAD.places
  .filter(p => ['academic', 'athletics', 'library', 'dining', 'recreation', 'rec', 'landmark', 'housing', 'hub'].includes(p.type.toLowerCase()))
  .map(p => ({
    id: p.place_id,
    name: p.name,
    shortName: p.short_name || '',
    latitude: p.lat,
    longitude: p.lng,
    type: mapBuildingType(p.type)
  }));

// ─── Amenities (Filtered from Master JSON) ───────────────────
export const AMENITIES: CampusAmenity[] = LOCAL_OSM_PLACES_PAYLOAD.places
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
    case 'academic': return GraduationCap;
    case 'athletics': return Star;
    case 'library': return LibraryIcon;
    case 'dining': return Utensils;
    case 'recreation': return Dumbbell;
    case 'landmark': return Star;
    case 'housing': return Home;
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
