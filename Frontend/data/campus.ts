/**
 * Texas A&M Campus Data
 * Buildings, landmarks, amenities with real lat/lng coordinates
 */
import type { ComponentType } from 'react';
import {
  Coffee,
  Dumbbell,
  GraduationCap,
  Home,
  Library,
  MapPin,
  Star,
  Utensils,
} from 'lucide-react-native';

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

import ALL_BUILDINGS from './all_buildings.json';

// ─── Buildings ──────────────────────────────────────────────
const HARDCODED_BUILDINGS: CampusBuilding[] = [
  // Academic
  { id: 'zach', name: 'Zachry Engineering Education Complex', shortName: 'ZACH', latitude: 30.621252, longitude: -96.340241, type: 'academic' },
  { id: 'bloc', name: 'Blocker Building', shortName: 'BLOC', latitude: 30.619539, longitude: -96.342120, type: 'academic' },
  { id: 'hrbb', name: 'Harrington Tower', shortName: 'HRBB', latitude: 30.616554, longitude: -96.340897, type: 'academic' },
  { id: 'etb', name: 'Engineering Technology Building', shortName: 'ETB', latitude: 30.622698, longitude: -96.339186, type: 'academic' },
  { id: 'wisn', name: 'Wisenbaker Engineering Research Center', shortName: 'WERC', latitude: 30.620765, longitude: -96.338940, type: 'academic' },
  { id: 'lang', name: 'Langford Architecture Center', shortName: 'LANG', latitude: 30.618798, longitude: -96.337631, type: 'academic' },
  { id: 'held', name: 'Heldenfels Hall', shortName: 'HELD', latitude: 30.615123, longitude: -96.338690, type: 'academic' },
  { id: 'mphy', name: 'Mitchell Physics Building', shortName: 'MPHY', latitude: 30.620257, longitude: -96.342438, type: 'academic' },
  { id: 'acad', name: 'Academic Building', shortName: 'ACAD', latitude: 30.615774, longitude: -96.340765, type: 'academic' },
  { id: 'wehner', name: 'Mays Business School (Wehner)', shortName: 'WEHNER', latitude: 30.610607, longitude: -96.350805, type: 'academic' },
  { id: 'oam', name: 'Oceanography & Meteorology Building', shortName: 'O&M', latitude: 30.617721, longitude: -96.336654, type: 'academic' },
  { id: 'bsbe', name: 'Biological Sciences Building East', shortName: 'BSBE', latitude: 30.615807, longitude: -96.339324, type: 'academic' },
  { id: 'hecl', name: 'Harrington Education Center', shortName: 'HECC', latitude: 30.616879, longitude: -96.340422, type: 'academic' },
  { id: 'petr', name: 'Peterson Building', shortName: 'PETR', latitude: 30.615977, longitude: -96.338580, type: 'academic' },
  { id: 'rich', name: 'Richardson Building', shortName: 'RICH', latitude: 30.619482, longitude: -96.339362, type: 'academic' },
  { id: 'thom', name: 'Thompson Hall', shortName: 'THOM', latitude: 30.617234, longitude: -96.341263, type: 'academic' },
  { id: 'bright', name: 'Bright Building', shortName: 'BRGT', latitude: 30.618997, longitude: -96.338799, type: 'academic' },
  { id: 'kleb', name: 'Kleberg Center', shortName: 'KLEB', latitude: 30.610608, longitude: -96.347359, type: 'academic' },
  { id: 'coke', name: 'Coke Building', shortName: 'COKE', latitude: 30.614612, longitude: -96.341710, type: 'academic' },
  { id: 'chem', name: 'Chemistry Building', shortName: 'CHEM', latitude: 30.617993, longitude: -96.339923, type: 'academic' },
  { id: 'butler', name: 'Butler Hall', shortName: 'BLHR', latitude: 30.614837, longitude: -96.338930, type: 'academic' },
  { id: 'scc', name: 'Student Computing Center', shortName: 'SCC', latitude: 30.615940, longitude: -96.338020, type: 'academic' },
  { id: 'ilcb', name: 'Interdisciplinary Life Sciences Building', shortName: 'ILSB', latitude: 30.614294, longitude: -96.343648, type: 'academic' },
  { id: 'lassb', name: 'Liberal Arts and Social Sciences Building', shortName: 'LASB', latitude: 30.617678, longitude: -96.337963, type: 'academic' },
  { id: 'john-koldus', name: 'John J. Koldus Building', shortName: 'KOLDUS', latitude: 30.612192, longitude: -96.339285, type: 'academic' },

  // Libraries
  { id: 'evans', name: 'Sterling C. Evans Library', shortName: 'EVANS', latitude: 30.616607, longitude: -96.339047, type: 'library' },
  { id: 'annex', name: 'Evans Library Annex', shortName: 'ANNEX', latitude: 30.616300, longitude: -96.338340, type: 'library' },
  { id: 'wcl', name: 'West Campus Library', shortName: 'WCL', latitude: 30.611570, longitude: -96.350164, type: 'library' },
  { id: 'cush', name: 'Cushing Memorial Library', shortName: 'CUSH', latitude: 30.616360, longitude: -96.339900, type: 'library' },
  { id: 'bush-lib', name: 'George H.W. Bush Presidential Library', shortName: 'BUSH', latitude: 30.596584, longitude: -96.353922, type: 'library' },

  // Landmarks
  { id: 'msc', name: 'Memorial Student Center', shortName: 'MSC', latitude: 30.612309, longitude: -96.341378, type: 'landmark' },
  { id: 'rudder', name: 'Rudder Tower', shortName: 'RUDDER', latitude: 30.613251, longitude: -96.339957, type: 'landmark' },
  { id: 'century', name: 'Century Tree', shortName: 'CENTURY', latitude: 30.615915, longitude: -96.341415, type: 'landmark' },
  { id: 'bonfire', name: 'Bonfire Memorial', shortName: 'BONFIRE', latitude: 30.622430, longitude: -96.334618, type: 'landmark' },
  { id: 'sdf', name: 'Simpson Drill Field', shortName: 'SDF', latitude: 30.613446, longitude: -96.342869, type: 'landmark' },
  { id: 'albritton', name: 'Albritton Bell Tower', shortName: 'ALBRITTON', latitude: 30.613110, longitude: -96.344661, type: 'landmark' },
  { id: 'aggie-park', name: 'Aggie Park', shortName: 'AGGIE PARK', latitude: 30.610474, longitude: -96.337630, type: 'landmark' },
  { id: 'academic-plaza', name: 'Academic Plaza', shortName: 'PLAZA', latitude: 30.6154, longitude: -96.3409, type: 'landmark' },

  // Athletics
  { id: 'kyle', name: 'Kyle Field', shortName: 'KYLE', latitude: 30.609936, longitude: -96.340453, type: 'athletics' },
  { id: 'reed', name: 'Reed Arena', shortName: 'REED', latitude: 30.605848, longitude: -96.346208, type: 'athletics' },
  { id: 'olsen', name: 'Olsen Field (Blue Bell Park)', shortName: 'OLSEN', latitude: 30.605389, longitude: -96.341526, type: 'athletics' },
  { id: 'rec', name: 'Student Recreation Center', shortName: 'REC', latitude: 30.607120, longitude: -96.345403, type: 'recreation' },
  { id: 'southside-rec', name: 'Southside Recreation Center', shortName: 'SSRC', latitude: 30.615185, longitude: -96.334412, type: 'recreation' },
  { id: 'polo-rec', name: 'Polo Road Recreation Center', shortName: 'POLO REC', latitude: 30.622968, longitude: -96.340926, type: 'recreation' },
  { id: 'polo', name: 'Polo Road Rec Fields', shortName: 'POLO', latitude: 30.624960, longitude: -96.335857, type: 'recreation' },

  // Housing
  { id: 'hulla', name: 'Hullabaloo Hall', shortName: 'HULLA', latitude: 30.616460, longitude: -96.346322, type: 'housing' },
  { id: 'corps', name: 'Corps of Cadets Quad', shortName: 'CORPS', latitude: 30.618159, longitude: -96.337195, type: 'housing' },
  { id: 'white', name: 'White Creek Apartments', shortName: 'WCREEK', latitude: 30.607633, longitude: -96.356167, type: 'housing' },
  { id: 'neeley', name: 'Neeley Hall', shortName: 'NEELEY', latitude: 30.617973, longitude: -96.344396, type: 'housing' },
  { id: 'mosher', name: 'Mosher Hall', shortName: 'MOSHER', latitude: 30.615450, longitude: -96.335169, type: 'housing' },
  { id: 'aston', name: 'Aston Hall', shortName: 'ASTON', latitude: 30.614675, longitude: -96.336307, type: 'housing' },
  { id: 'krueger', name: 'Krueger Hall', shortName: 'KRUEGER', latitude: 30.615948, longitude: -96.335541, type: 'housing' },
  { id: 'davis-gary', name: 'Davis-Gary Hall', shortName: 'DAVIS-GARY', latitude: 30.615533, longitude: -96.346435, type: 'housing' },
];

const hardcodedIds = new Set(HARDCODED_BUILDINGS.map(b => b.shortName.toLowerCase()));

export const BUILDINGS: CampusBuilding[] = [
  ...HARDCODED_BUILDINGS,
  ...ALL_BUILDINGS.filter(b => !hardcodedIds.has(b.shortName.toLowerCase())).map(b => ({
    id: b.id,
    name: b.name,
    shortName: b.shortName,
    latitude: b.latitude,
    longitude: b.longitude,
    type: b.type as any
  }))
];

// ─── Amenities ──────────────────────────────────────────────
export const AMENITIES: CampusAmenity[] = [
  // Coffee
  { id: 'revs-msc', name: "Rev's Coffee (MSC)", latitude: 30.612206, longitude: -96.341130, type: 'coffee' },
  { id: 'starbucks-msc', name: 'Starbucks (MSC)', latitude: 30.612309, longitude: -96.341378, type: 'coffee' },
  { id: 'revs-zach', name: "Rev's Coffee (Zachry)", latitude: 30.620956, longitude: -96.340564, type: 'coffee' },
  { id: 'sweet-eugene', name: "Sweet Eugene's Coffee", latitude: 30.6273, longitude: -96.3345, type: 'coffee' },

  // Dining
  { id: 'sbisa', name: 'Sbisa Dining Hall', latitude: 30.617135, longitude: -96.343777, type: 'dining' },
  { id: 'commons', name: 'The Commons Dining Hall', latitude: 30.610450, longitude: -96.334950, type: 'dining' },
  { id: 'duncan', name: 'Duncan Dining Hall', latitude: 30.612072, longitude: -96.335505, type: 'dining' },
  { id: 'hulla-dining', name: 'Hullabaloo Food Court', latitude: 30.616460, longitude: -96.346322, type: 'dining' },
  { id: 'underground-food', name: 'Underground Food Court', latitude: 30.617020, longitude: -96.343250, type: 'dining' },
  { id: 'cfa', name: 'Chick-fil-A (MSC)', latitude: 30.611881, longitude: -96.341541, type: 'dining' },
  { id: 'panda-msc', name: 'Panda Express (MSC)', latitude: 30.612020, longitude: -96.341180, type: 'dining' },
  { id: 'revs-msc-food', name: "Rev's American Grill (MSC)", latitude: 30.612180, longitude: -96.341020, type: 'dining' },
  { id: 'houston-msc', name: 'Houston Street Subs (MSC)', latitude: 30.612110, longitude: -96.341240, type: 'dining' },
  { id: 'abu-omar-msc', name: 'Abu Omar Halal (MSC)', latitude: 30.612310, longitude: -96.341060, type: 'dining' },
  { id: 'polo-garage-food', name: 'Polo Road Garage Dining', latitude: 30.622723, longitude: -96.337939, type: 'dining' },
  { id: 'panda-polo', name: 'Panda Express (Polo)', latitude: 30.622780, longitude: -96.337860, type: 'dining' },
  { id: 'salata-polo', name: 'Salata (Polo)', latitude: 30.622640, longitude: -96.337820, type: 'dining' },
  { id: 'shake-polo', name: 'Shake Smart (Polo)', latitude: 30.622590, longitude: -96.337980, type: 'dining' },

  // Restrooms (major accessible restrooms)
  { id: 'rr-msc', name: 'Restroom (MSC 1st Floor)', latitude: 30.612309, longitude: -96.341378, type: 'restroom' },
  { id: 'rr-evans', name: 'Restroom (Evans Library)', latitude: 30.616607, longitude: -96.339047, type: 'restroom' },
  { id: 'rr-blocker', name: 'Restroom (Blocker 1st Floor)', latitude: 30.619539, longitude: -96.342120, type: 'restroom' },
  { id: 'rr-zach', name: 'Restroom (Zachry 1st Floor)', latitude: 30.621252, longitude: -96.340241, type: 'restroom' },
  { id: 'rr-rudder', name: 'Restroom (Rudder Tower)', latitude: 30.613251, longitude: -96.339957, type: 'restroom' },
  { id: 'rr-rec', name: 'Restroom (Rec Center)', latitude: 30.607120, longitude: -96.345403, type: 'restroom' },

  // Study spots
  { id: 'study-annex', name: 'Study Room (Annex)', latitude: 30.616300, longitude: -96.338340, type: 'study' },
  { id: 'study-wcl', name: 'Study Room (West Campus Library)', latitude: 30.611570, longitude: -96.350164, type: 'study' },
  { id: 'study-bloc', name: 'Study Lounge (Blocker)', latitude: 30.619539, longitude: -96.342120, type: 'study' },
  { id: 'study-zach', name: 'Study Area (Zachry)', latitude: 30.621252, longitude: -96.340241, type: 'study' },

  // Parking
  { id: 'lot30', name: 'Parking Lot 30', latitude: 30.6190, longitude: -96.3360, type: 'parking' },
  { id: 'lot50', name: 'Parking Lot 50', latitude: 30.624159, longitude: -96.336872, type: 'parking' },
  { id: 'garage-cain', name: 'Cain Parking Garage', latitude: 30.616487, longitude: -96.337744, type: 'parking' },
  { id: 'garage-polo', name: 'Polo Road Garage', latitude: 30.623512, longitude: -96.338044, type: 'parking' },
  { id: 'garage-west-campus', name: 'West Campus Garage', latitude: 30.608453, longitude: -96.344415, type: 'parking' },
  { id: 'garage-university-center', name: 'University Center Garage', latitude: 30.612052, longitude: -96.338745, type: 'parking' },
  { id: 'lot100', name: 'Parking Lot 100', latitude: 30.604888, longitude: -96.341547, type: 'parking' },
  { id: 'lot61', name: 'Parking Lot 61', latitude: 30.6088, longitude: -96.3348, type: 'parking' },
  { id: 'lot74', name: 'Parking Lot 74', latitude: 30.608658, longitude: -96.347988, type: 'parking' },
];

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
    case 'library': return Library;
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
    case 'study': return Library;
    case 'restroom': return MapPin;
    case 'parking': return MapPin;
    default: return MapPin;
  }
}
