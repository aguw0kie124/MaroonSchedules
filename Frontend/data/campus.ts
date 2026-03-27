/**
 * Texas A&M Campus Data
 * Buildings, landmarks, amenities with real lat/lng coordinates
 */

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

// ─── Buildings ──────────────────────────────────────────────
export const BUILDINGS: CampusBuilding[] = [
  // Academic
  { id: 'zach', name: 'Zachry Engineering Education Complex', shortName: 'ZACH', latitude: 30.6213, longitude: -96.3403, type: 'academic' },
  { id: 'bloc', name: 'Blocker Building', shortName: 'BLOC', latitude: 30.6157, longitude: -96.3398, type: 'academic' },
  { id: 'hrbb', name: 'Harrington Tower', shortName: 'HRBB', latitude: 30.6160, longitude: -96.3417, type: 'academic' },
  { id: 'etb', name: 'Engineering Technology Building', shortName: 'ETB', latitude: 30.6197, longitude: -96.3377, type: 'academic' },
  { id: 'wisn', name: 'Wisenbaker Engineering Research Center', shortName: 'WERC', latitude: 30.6202, longitude: -96.3400, type: 'academic' },
  { id: 'lang', name: 'Langford Architecture Center', shortName: 'LANG', latitude: 30.6186, longitude: -96.3381, type: 'academic' },
  { id: 'held', name: 'Heldenfels Hall', shortName: 'HELD', latitude: 30.6175, longitude: -96.3395, type: 'academic' },
  { id: 'mphy', name: 'Mitchell Physics Building', shortName: 'MPHY', latitude: 30.6180, longitude: -96.3392, type: 'academic' },
  { id: 'acad', name: 'Academic Building', shortName: 'ACAD', latitude: 30.6145, longitude: -96.3408, type: 'academic' },
  { id: 'wehner', name: 'Mays Business School (Wehner)', shortName: 'WEHNER', latitude: 30.6146, longitude: -96.3426, type: 'academic' },
  { id: 'oam', name: 'Oceanography & Meteorology Building', shortName: 'O&M', latitude: 30.6225, longitude: -96.3371, type: 'academic' },
  { id: 'bsbe', name: 'Biological Sciences Building East', shortName: 'BSBE', latitude: 30.6170, longitude: -96.3362, type: 'academic' },
  { id: 'hecl', name: 'Harrington Education Center', shortName: 'HECC', latitude: 30.6162, longitude: -96.3430, type: 'academic' },
  { id: 'petr', name: 'Peterson Building', shortName: 'PETR', latitude: 30.6190, longitude: -96.3410, type: 'academic' },
  { id: 'rich', name: 'Richardson Building', shortName: 'RICH', latitude: 30.6184, longitude: -96.3414, type: 'academic' },
  { id: 'thom', name: 'Thompson Hall', shortName: 'THOM', latitude: 30.6152, longitude: -96.3380, type: 'academic' },
  { id: 'bright', name: 'Bright Building', shortName: 'BRGT', latitude: 30.6168, longitude: -96.3397, type: 'academic' },
  { id: 'kleb', name: 'Kleberg Center', shortName: 'KLEB', latitude: 30.6161, longitude: -96.3394, type: 'academic' },
  { id: 'coke', name: 'Coke Building', shortName: 'COKE', latitude: 30.6175, longitude: -96.3406, type: 'academic' },
  { id: 'chem', name: 'Chemistry Building', shortName: 'CHEM', latitude: 30.6179, longitude: -96.3408, type: 'academic' },
  { id: 'butler', name: 'Butler Hall', shortName: 'BLHR', latitude: 30.6173, longitude: -96.3374, type: 'academic' },
  { id: 'scc', name: 'Student Computing Center', shortName: 'SCC', latitude: 30.6205, longitude: -96.3408, type: 'academic' },
  { id: 'ilcb', name: 'Interdisciplinary Life Sciences Building', shortName: 'ILSB', latitude: 30.6217, longitude: -96.3367, type: 'academic' },
  { id: 'lassb', name: 'Liberal Arts and Social Sciences Building', shortName: 'LASB', latitude: 30.6158, longitude: -96.3372, type: 'academic' },
  { id: 'john-koldus', name: 'John J. Koldus Building', shortName: 'KOLDUS', latitude: 30.6115, longitude: -96.3409, type: 'academic' },

  // Libraries
  { id: 'evans', name: 'Sterling C. Evans Library', shortName: 'EVANS', latitude: 30.6171, longitude: -96.3387, type: 'library' },
  { id: 'annex', name: 'Evans Library Annex', shortName: 'ANNEX', latitude: 30.6168, longitude: -96.3383, type: 'library' },
  { id: 'wcl', name: 'West Campus Library', shortName: 'WCL', latitude: 30.6146, longitude: -96.3440, type: 'library' },
  { id: 'cush', name: 'Cushing Memorial Library', shortName: 'CUSH', latitude: 30.6166, longitude: -96.3400, type: 'library' },
  { id: 'bush-lib', name: 'George H.W. Bush Presidential Library', shortName: 'BUSH', latitude: 30.6108, longitude: -96.3520, type: 'library' },

  // Landmarks
  { id: 'msc', name: 'Memorial Student Center', shortName: 'MSC', latitude: 30.6123, longitude: -96.3415, type: 'landmark' },
  { id: 'rudder', name: 'Rudder Tower', shortName: 'RUDDER', latitude: 30.6130, longitude: -96.3406, type: 'landmark' },
  { id: 'century', name: 'Century Tree', shortName: 'CENTURY', latitude: 30.6156, longitude: -96.3408, type: 'landmark' },
  { id: 'bonfire', name: 'Bonfire Memorial', shortName: 'BONFIRE', latitude: 30.6200, longitude: -96.3350, type: 'landmark' },
  { id: 'sdf', name: 'Simpson Drill Field', shortName: 'SDF', latitude: 30.6162, longitude: -96.3405, type: 'landmark' },
  { id: 'albritton', name: 'Albritton Bell Tower', shortName: 'ALBRITTON', latitude: 30.6135, longitude: -96.3400, type: 'landmark' },
  { id: 'aggie-park', name: 'Aggie Park', shortName: 'AGGIE PARK', latitude: 30.6074, longitude: -96.3372, type: 'landmark' },
  { id: 'academic-plaza', name: 'Academic Plaza', shortName: 'PLAZA', latitude: 30.6154, longitude: -96.3409, type: 'landmark' },

  // Athletics
  { id: 'kyle', name: 'Kyle Field', shortName: 'KYLE', latitude: 30.6083, longitude: -96.3390, type: 'athletics' },
  { id: 'reed', name: 'Reed Arena', shortName: 'REED', latitude: 30.6040, longitude: -96.3448, type: 'athletics' },
  { id: 'olsen', name: 'Olsen Field (Blue Bell Park)', shortName: 'OLSEN', latitude: 30.6048, longitude: -96.3395, type: 'athletics' },
  { id: 'rec', name: 'Student Recreation Center', shortName: 'REC', latitude: 30.6094, longitude: -96.3400, type: 'recreation' },
  { id: 'southside-rec', name: 'Southside Recreation Center', shortName: 'SSRC', latitude: 30.6093, longitude: -96.3390, type: 'recreation' },
  { id: 'polo-rec', name: 'Polo Road Recreation Center', shortName: 'POLO REC', latitude: 30.6237, longitude: -96.3395, type: 'recreation' },
  { id: 'polo', name: 'Polo Road Rec Fields', shortName: 'POLO', latitude: 30.6225, longitude: -96.3353, type: 'recreation' },

  // Housing
  { id: 'hulla', name: 'Hullabaloo Hall', shortName: 'HULLA', latitude: 30.6098, longitude: -96.3395, type: 'housing' },
  { id: 'corps', name: 'Corps of Cadets Quad', shortName: 'CORPS', latitude: 30.6144, longitude: -96.3378, type: 'housing' },
  { id: 'white', name: 'White Creek Apartments', shortName: 'WCREEK', latitude: 30.6010, longitude: -96.3470, type: 'housing' },
  { id: 'neeley', name: 'Neeley Hall', shortName: 'NEELEY', latitude: 30.6117, longitude: -96.3378, type: 'housing' },
  { id: 'mosher', name: 'Mosher Hall', shortName: 'MOSHER', latitude: 30.6113, longitude: -96.3372, type: 'housing' },
  { id: 'aston', name: 'Aston Hall', shortName: 'ASTON', latitude: 30.6109, longitude: -96.3387, type: 'housing' },
  { id: 'krueger', name: 'Krueger Hall', shortName: 'KRUEGER', latitude: 30.6112, longitude: -96.3385, type: 'housing' },
  { id: 'davis-gary', name: 'Davis-Gary Hall', shortName: 'DAVIS-GARY', latitude: 30.6131, longitude: -96.3417, type: 'housing' },
];

// ─── Amenities ──────────────────────────────────────────────
export const AMENITIES: CampusAmenity[] = [
  // Coffee
  { id: 'revs-msc', name: "Rev's Coffee (MSC)", latitude: 30.6125, longitude: -96.3417, type: 'coffee' },
  { id: 'starbucks-msc', name: 'Starbucks (MSC)', latitude: 30.6121, longitude: -96.3413, type: 'coffee' },
  { id: 'revs-zach', name: "Rev's Coffee (Zachry)", latitude: 30.6211, longitude: -96.3401, type: 'coffee' },
  { id: 'sweet-eugene', name: "Sweet Eugene's Coffee", latitude: 30.6273, longitude: -96.3345, type: 'coffee' },

  // Dining
  { id: 'sbisa', name: 'Sbisa Dining Hall', latitude: 30.6140, longitude: -96.3413, type: 'dining' },
  { id: 'commons', name: 'The Commons Dining', latitude: 30.6111, longitude: -96.3380, type: 'dining' },
  { id: 'duncan', name: 'Duncan Dining Hall', latitude: 30.6128, longitude: -96.3387, type: 'dining' },
  { id: 'hulla-dining', name: 'Hullabaloo Food Court', latitude: 30.6096, longitude: -96.3393, type: 'dining' },
  { id: 'cfa', name: 'Chick-fil-A (MSC)', latitude: 30.6122, longitude: -96.3410, type: 'dining' },
  { id: 'polo-garage-food', name: 'Polo Road Garage Dining', latitude: 30.6235, longitude: -96.3388, type: 'dining' },
  { id: 'aggie-express', name: 'Aggie Express at Hullabaloo', latitude: 30.6098, longitude: -96.3393, type: 'dining' },

  // Restrooms (major accessible restrooms)
  { id: 'rr-msc', name: 'Restroom (MSC 1st Floor)', latitude: 30.6124, longitude: -96.3416, type: 'restroom' },
  { id: 'rr-evans', name: 'Restroom (Evans Library)', latitude: 30.6172, longitude: -96.3388, type: 'restroom' },
  { id: 'rr-blocker', name: 'Restroom (Blocker 1st Floor)', latitude: 30.6158, longitude: -96.3399, type: 'restroom' },
  { id: 'rr-zach', name: 'Restroom (Zachry 1st Floor)', latitude: 30.6214, longitude: -96.3404, type: 'restroom' },
  { id: 'rr-rudder', name: 'Restroom (Rudder Tower)', latitude: 30.6131, longitude: -96.3407, type: 'restroom' },
  { id: 'rr-rec', name: 'Restroom (Rec Center)', latitude: 30.6095, longitude: -96.3401, type: 'restroom' },

  // Study spots
  { id: 'study-annex', name: 'Study Room (Annex)', latitude: 30.6169, longitude: -96.3384, type: 'study' },
  { id: 'study-wcl', name: 'Study Room (West Campus Library)', latitude: 30.6147, longitude: -96.3441, type: 'study' },
  { id: 'study-bloc', name: 'Study Lounge (Blocker)', latitude: 30.6156, longitude: -96.3397, type: 'study' },
  { id: 'study-zach', name: 'Study Area (Zachry)', latitude: 30.6212, longitude: -96.3402, type: 'study' },

  // Parking
  { id: 'lot30', name: 'Parking Lot 30', latitude: 30.6190, longitude: -96.3360, type: 'parking' },
  { id: 'lot50', name: 'Parking Lot 50', latitude: 30.6070, longitude: -96.3420, type: 'parking' },
  { id: 'garage-cain', name: 'Cain Parking Garage', latitude: 30.6100, longitude: -96.3370, type: 'parking' },
  { id: 'garage-polo', name: 'Polo Road Garage', latitude: 30.6232, longitude: -96.3387, type: 'parking' },
  { id: 'garage-west-campus', name: 'West Campus Garage', latitude: 30.6137, longitude: -96.3466, type: 'parking' },
  { id: 'garage-university-center', name: 'University Center Garage', latitude: 30.6120, longitude: -96.3400, type: 'parking' },
  { id: 'lot100', name: 'Parking Lot 100', latitude: 30.6040, longitude: -96.3408, type: 'parking' },
  { id: 'lot61', name: 'Parking Lot 61', latitude: 30.6088, longitude: -96.3348, type: 'parking' },
  { id: 'lot74', name: 'Parking Lot 74', latitude: 30.6217, longitude: -96.3344, type: 'parking' },
];

// Default user location (MSC area)
export const DEFAULT_USER_LOCATION = {
  buildingId: 'msc',
  name: 'Memorial Student Center',
  latitude: 30.6123,
  longitude: -96.3415,
};

/**
 * Get emoji for building type
 */
export function getBuildingEmoji(type: CampusBuilding['type']): string {
  switch (type) {
    case 'academic': return '🏫';
    case 'athletics': return '🏟️';
    case 'library': return '📚';
    case 'dining': return '🍽️';
    case 'recreation': return '💪';
    case 'landmark': return '⭐';
    case 'housing': return '🏠';
    default: return '📍';
  }
}

/**
 * Get emoji for amenity type
 */
export function getAmenityEmoji(type: CampusAmenity['type']): string {
  switch (type) {
    case 'restroom': return '🚻';
    case 'coffee': return '☕';
    case 'dining': return '🍔';
    case 'study': return '📖';
    case 'parking': return '🅿️';
    default: return '📍';
  }
}
