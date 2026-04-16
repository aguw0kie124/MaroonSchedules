/**
 * Weekly operating hours for retail restaurants.
 * Data source: https://dineoncampus.com/tamu/hours-of-operation
 */

export type WeeklyHours = [string, string, string, string, string, string, string];

export const RESTAURANT_WEEKLY_HOURS: Record<string, WeeklyHours> = {
  '1876 Burgers - Sbisa Complex': ['Closed', '10:30a - 8:00p', '10:30a - 8:00p', '10:30a - 8:00p', '10:30a - 8:00p', '10:30a - 7:00p', 'Closed'],
  'Aggie Express - Hullabaloo': ['9:00a - 12:00a', '8:00a - 12:00a', '8:00a - 12:00a', '8:00a - 12:00a', '8:00a - 12:00a', '8:00a - 12:00a', '8:00a - 12:00a'],
  'Chick-fil-A': ['Closed', '10:00a - 10:00p', '10:00a - 10:00p', '10:00a - 10:00p', '10:00a - 10:00p', '10:00a - 8:00p', '10:00a - 2:30p'],
  'Chick-fil-A (Underground)': ['Closed', '10:30a - 10:00p', '10:30a - 10:00p', '10:30a - 10:00p', '10:30a - 10:00p', '10:30a - 8:00p', '11:00a - 3:00p'],
  'Copperhead Jack\'s': ['Closed', '10:30a - 8:00p', '10:30a - 8:00p', '10:30a - 8:00p', '10:30a - 8:00p', '10:30a - 7:00p', 'Closed'],
  'Einstein Bros. Bagels': ['Closed', '7:00a - 2:00p', '7:00a - 2:00p', '7:00a - 2:00p', '7:00a - 2:00p', '7:00a - 2:00p', 'Closed'],
  'Houston Street Subs': ['Closed', '10:00a - 2:30p', '10:00a - 2:30p', '10:00a - 2:30p', '10:00a - 2:30p', '10:00a - 2:30p', 'Closed'],
  'Bagel Block': ['Closed', '8:00a - 4:00p', '8:00a - 4:00p', '8:00a - 4:00p', '8:00a - 4:00p', '8:00a - 3:00p', 'Closed'],
  'Pizza @ Underground': ['Closed', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', 'Closed'],
  'Starbucks Coffee - Hullabaloo': ['9:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 6:00p', '8:00a - 4:00p'],
  'Smoothie King - Sbisa Underground': ['Closed', '10:00a - 8:00p', '10:00a - 8:00p', '10:00a - 8:00p', '10:00a - 8:00p', '10:00a - 8:00p', 'Closed'],
  'Abu Omar Halal': ['11:00a - 8:00p', '10:00a - 9:30p', '10:00a - 9:30p', '10:00a - 9:30p', '10:00a - 9:30p', '10:00a - 9:30p', '11:00a - 8:00p'],
  'Aggie Express - Pavilion': ['Closed', '7:30a - 10:00p', '7:30a - 10:00p', '7:30a - 10:00p', '7:30a - 10:00p', '7:30a - 7:00p', '10:00a - 6:00p'],
  'Cabo Grill': ['Closed', '10:00a - 3:00p', '10:00a - 3:00p', '10:00a - 3:00p', '10:00a - 3:00p', '10:00a - 3:00p', '10:00a - 2:30p'],
  'Panda Express': ['11:00a - 10:00p', '10:00a - 10:00p', '10:00a - 10:00p', '10:00a - 10:00p', '10:00a - 10:00p', '10:00a - 10:00p', '10:00a - 10:00p'],
  'Rev\'s American Grill': ['Closed', '10:00a - 7:30p', '10:00a - 7:30p', '10:00a - 7:30p', '10:00a - 7:30p', '10:00a - 7:30p', '10:00a - 2:30p'],
  'Starbucks Coffee - Evans Library': ['12:00p - 6:00p', '7:30a - 10:00p', '7:30a - 10:00p', '7:30a - 10:00p', '7:30a - 10:00p', '7:30a - 5:00p', 'Closed'],
  'Shake Smart': ['Closed', '10:00a - 8:00p', '10:00a - 8:00p', '10:00a - 8:00p', '10:00a - 8:00p', '10:00a - 8:00p', 'Closed'],
  'Spin \'N Stone Pizza': ['Closed', '10:00a - 3:00p', '10:00a - 3:00p', '10:00a - 3:00p', '10:00a - 3:00p', '10:00a - 3:00p', 'Closed'],
  'The University Club': ['Closed', 'Closed', '11:00a - 2:00p', '11:00a - 2:00p', '11:00a - 2:00p', '11:00a - 2:00p', 'Closed'],
  'Whoop Coop': ['2:00p - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p'],
  'Aggie Express - Commons': ['9:00a - 11:00p', '7:00a - 2:00a', '7:00a - 2:00a', '7:00a - 2:00a', '7:00a - 2:00a', '7:00a - 11:00p', '9:00a - 11:00p'],
  'White Creek Market': ['11:00a - 12:00a', '7:00a - 12:00a', '7:00a - 12:00a', '7:00a - 12:00a', '7:00a - 12:00a', '7:00a - 10:00p', '10:00a - 10:00p'],
  'Market @ Polo Garage': ['Closed', '8:00a - 5:00p', '8:00a - 5:00p', '8:00a - 5:00p', '8:00a - 5:00p', '8:00a - 3:00p', 'Closed'],
  'Market @ Lamar St.': ['Closed', '8:00a - 6:00p', '8:00a - 6:00p', '8:00a - 6:00p', '8:00a - 6:00p', '8:00a - 3:00p', 'Closed'],
  'Market Express - Business Library (BLCC)': ['1:00p - 9:00p', '7:30a - 9:00p', '7:30a - 9:00p', '7:30a - 9:00p', '7:30a - 9:00p', '7:30a - 5:00p', 'Closed'],
  'Starbucks Coffee - The Quad': ['9:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 6:00p', '8:00a - 4:00p'],
  'Azimuth Cafe - Langford': ['Closed', '7:30a - 3:00p', '7:30a - 3:00p', '7:30a - 3:00p', '7:30a - 3:00p', '7:30a - 3:00p', 'Closed'],
  'Salata': ['Closed', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', '11:00a - 8:00p', 'Closed'],
  'Starbucks Coffee - Zachry': ['Closed', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 5:00p', 'Closed'],
  'Reynolds and Reynolds Cafe': ['Closed', '7:30a - 3:00p', '7:30a - 3:00p', '7:30a - 3:00p', '7:30a - 3:00p', '7:30a - 3:00p', 'Closed'],
  'Creekside Market': ['11:00a - 12:00a', '7:00a - 12:00a', '7:00a - 12:00a', '7:00a - 12:00a', '7:00a - 12:00a', '7:00a - 10:00p', '10:00a - 10:00p'],
  'The Kitchen - Creekside Market': ['5:00p - 10:00p', '5:00p - 10:00p', '5:00p - 10:00p', '5:00p - 10:00p', '5:00p - 10:00p', 'Closed', 'Closed'],
  'Health Science Center Cafe': ['Closed', '7:30a - 2:30p', '7:30a - 2:30p', '7:30a - 2:30p', '7:30a - 2:30p', '7:30a - 2:00p', 'Closed'],
  'Market - Ag Cafe': ['Closed', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 5:00p', 'Closed'],
  'Starbucks - Ag Cafe': ['Closed', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 7:00p', '7:30a - 5:00p', 'Closed'],
  'Shake Smart- Rec Center': ['1:00p - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '7:00a - 8:00p', '10:00a - 8:00p'],
};

/**
 * Returns the operating hours for a restaurant today based on the current day of week.
 */
export function getRestaurantHoursToday(locationName: string): string | null {
  if (!locationName) return null;
  const normalized = locationName.trim();
  const weekHours = RESTAURANT_WEEKLY_HOURS[normalized];
  
  if (!weekHours) {
    // Try fuzzy match or fallback resolver logic
    for (const key in RESTAURANT_WEEKLY_HOURS) {
      if (normalized.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(normalized.toLowerCase())) {
        const dayIdx = new Date().getDay(); // 0 is Sunday, 1 is Monday ...
        return RESTAURANT_WEEKLY_HOURS[key][dayIdx];
      }
    }
    return null;
  }

  const dayIdx = new Date().getDay();
  return weekHours[dayIdx];
}
