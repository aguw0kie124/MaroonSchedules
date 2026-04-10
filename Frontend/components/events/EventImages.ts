import { TAMUEvent, ExploreCategory, classifyCategory, matchesMajor, MAJOR_OPTIONS } from './EventUtils';

const CATEGORY_IMAGES: Record<string, any[]> = {
  Sports: [
    require('../../assets/images/events/Categories/Sports/1.jpg'),
    require('../../assets/images/events/Categories/Sports/2.jpg'),
    require('../../assets/images/events/Categories/Sports/3.jpg'),
    require('../../assets/images/events/Categories/Sports/4.jpg'),
  ],
  Academic: [
    require('../../assets/images/events/Categories/Academic/1.jpg'),
    require('../../assets/images/events/Categories/Academic/2.jpg'),
    require('../../assets/images/events/Categories/Academic/3.jpg'),
    require('../../assets/images/events/Categories/Academic/4.jpg'),
  ],
  Food: [
    require('../../assets/images/events/Categories/Food/1.jpg'),
    require('../../assets/images/events/Categories/Food/2.jpg'),
    require('../../assets/images/events/Categories/Food/3.jpg'),
    require('../../assets/images/events/Categories/Food/4.jpg'),
  ],
  Social: [
    require('../../assets/images/events/Categories/Social/1.jpg'),
    require('../../assets/images/events/Categories/Social/2.jpg'),
    require('../../assets/images/events/Categories/Social/3.jpg'),
    require('../../assets/images/events/Categories/Social/4.jpg'),
  ],
  Health_Wellness: [
    require('../../assets/images/events/Categories/Health_Wellness/1.jpg'),
    require('../../assets/images/events/Categories/Health_Wellness/2.jpg'),
    require('../../assets/images/events/Categories/Health_Wellness/3.jpg'),
    require('../../assets/images/events/Categories/Health_Wellness/4.jpg'),
  ],
  Entertainment: [
    require('../../assets/images/events/Categories/Entertainment/1.jpg'),
    require('../../assets/images/events/Categories/Entertainment/2.jpg'),
    require('../../assets/images/events/Categories/Entertainment/3.jpg'),
    require('../../assets/images/events/Categories/Entertainment/4.jpg'),
  ],
  Advocacy: [
    require('../../assets/images/events/Categories/Advocacy/1.jpg'),
    require('../../assets/images/events/Categories/Advocacy/2.jpg'),
    require('../../assets/images/events/Categories/Advocacy/3.jpg'),
    require('../../assets/images/events/Categories/Advocacy/4.jpg'),
  ],
  Miscellaneous: [
    require('../../assets/images/events/Categories/Miscellaneous/1.jpg'),
    require('../../assets/images/events/Categories/Miscellaneous/2.jpg'),
    require('../../assets/images/events/Categories/Miscellaneous/3.jpg'),
    require('../../assets/images/events/Categories/Miscellaneous/4.jpg'),
  ],
};

// TODO: Add major images later. For now, events matching a major
// will fall through to their category image instead.
// const MAJOR_IMAGES: Record<string, any[]> = { ... };

function getStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function escapeCategory(cat: string): string {
  if (cat === "Health & Wellness") return "Health_Wellness";
  if (cat === "For U") return "Miscellaneous";
  if (cat === "Featured") return "Miscellaneous";
  return cat;
}

export function getEventImage(event: TAMUEvent) {
  const hash = getStringHash(String(event.id));

  // Use category-based image selection
  const category = classifyCategory(event);
  const safeCategory = escapeCategory(category);
  const images = CATEGORY_IMAGES[safeCategory] || CATEGORY_IMAGES['Miscellaneous'];
  
  return images[hash % images.length];
}
