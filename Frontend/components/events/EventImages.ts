import { TAMUEvent, classifyCategory } from './EventUtils';

// ─── Category fallback images (1 per category) ───────────────────────
const CATEGORY_FALLBACKS: Record<string, any> = {
  Sports:             require('../../assets/images/events/fallbacks/sports.jpg'),
  Academic:           require('../../assets/images/events/fallbacks/academic.jpg'),
  Food:               require('../../assets/images/events/fallbacks/food.jpg'),
  Social:             require('../../assets/images/events/fallbacks/social.jpg'),
  'Health & Wellness': require('../../assets/images/events/fallbacks/health_wellness.jpg'),
  Entertainment:      require('../../assets/images/events/fallbacks/entertainment.jpg'),
  Advocacy:           require('../../assets/images/events/fallbacks/advocacy.jpg'),

};

// ─── Keyword images ──────────────────────────────────────────────────
// Each entry: { image, triggers[] }
// triggers are lowercase phrases checked against the event title + description.
// Listed in priority order — first match wins.
const KEYWORD_ENTRIES: { image: any; triggers: string[] }[] = [
  {
    image: require('../../assets/images/events/keywords/career_fair.jpg'),
    triggers: ['career fair', 'job fair', 'career expo', 'recruiting event', 'career day'],
  },
  {
    image: require('../../assets/images/events/keywords/hackathon.jpg'),
    triggers: ['hackathon', 'hack-a-thon', 'coding competition', 'code jam'],
  },
  {
    image: require('../../assets/images/events/keywords/pizza.jpg'),
    triggers: ['pizza', 'free pizza'],
  },
  {
    image: require('../../assets/images/events/keywords/football.jpg'),
    triggers: ['football', 'aggie football', '12th man'],
  },
  {
    image: require('../../assets/images/events/keywords/basketball.jpg'),
    triggers: ['basketball', 'hoops'],
  },
  {
    image: require('../../assets/images/events/keywords/tailgate.jpg'),
    triggers: ['tailgate', 'tailgating', 'pre-game'],
  },
  {
    image: require('../../assets/images/events/keywords/concert.jpg'),
    triggers: ['concert', 'live music', 'live band', 'music festival'],
  },
  {
    image: require('../../assets/images/events/keywords/movie_night.jpg'),
    triggers: ['movie night', 'film screening', 'watch party', 'movie screening'],
  },
  {
    image: require('../../assets/images/events/keywords/game_night.jpg'),
    triggers: ['game night', 'board game', 'trivia night', 'trivia'],
  },
  {
    image: require('../../assets/images/events/keywords/dance.jpg'),
    triggers: ['dance', 'formal', 'prom', 'salsa night', 'dance party'],
  },
  {
    image: require('../../assets/images/events/keywords/yoga.jpg'),
    triggers: ['yoga', 'meditation', 'mindfulness', 'stretching'],
  },
  {
    image: require('../../assets/images/events/keywords/fitness.jpg'),
    triggers: ['fitness', 'workout', 'bootcamp', 'gym', 'crossfit', 'run club'],
  },
  {
    image: require('../../assets/images/events/keywords/barbecue.jpg'),
    triggers: ['barbecue', 'bbq', 'cookout', 'grill'],
  },
  {
    image: require('../../assets/images/events/keywords/workshop.jpg'),
    triggers: ['workshop', 'hands-on'],
  },
  {
    image: require('../../assets/images/events/keywords/seminar.jpg'),
    triggers: ['seminar', 'lecture', 'guest speaker', 'keynote', 'panel discussion'],
  },
  {
    image: require('../../assets/images/events/keywords/networking.jpg'),
    triggers: ['networking', 'mixer', 'meet and greet', 'meet & greet', 'social hour'],
  },
  {
    image: require('../../assets/images/events/keywords/study_group.jpg'),
    triggers: ['study group', 'study session', 'cram session', 'exam review', 'review session'],
  },
  {
    image: require('../../assets/images/events/keywords/tutoring.jpg'),
    triggers: ['tutoring', 'tutor', 'help desk', 'office hours'],
  },
  {
    image: require('../../assets/images/events/keywords/research.jpg'),
    triggers: ['research', 'symposium', 'poster session', 'thesis defense'],
  },
  {
    image: require('../../assets/images/events/keywords/volunteering.jpg'),
    triggers: ['volunteer', 'volunteering', 'community service', 'service project', 'giving back'],
  },
  {
    image: require('../../assets/images/events/keywords/blood_drive.jpg'),
    triggers: ['blood drive', 'blood donation', 'donate blood'],
  },
  {
    image: require('../../assets/images/events/keywords/graduation.jpg'),
    triggers: ['graduation', 'commencement', 'convocation', 'grad ceremony'],
  },
  {
    image: require('../../assets/images/events/keywords/debate.jpg'),
    triggers: ['debate', 'mock trial', 'model un', 'moot court'],
  },
  {
    image: require('../../assets/images/events/keywords/art_exhibit.jpg'),
    triggers: ['art exhibit', 'art show', 'gallery', 'exhibition', 'art display'],
  },
  {
    image: require('../../assets/images/events/keywords/fundraiser.jpg'),
    triggers: ['fundraiser', 'fundraising', 'charity', 'benefit', 'donation drive'],
  },
];

// ─── Main export ─────────────────────────────────────────────────────
export function getEventImage(event: TAMUEvent): any | null {
  // Build a searchable blob from the event's title and description
  const blob = [
    event.title || '',
    event.description || '',
    event.location || '',
    ...(event.tags || []),
  ]
    .join(' ')
    .toLowerCase();

  // Check keyword triggers (first match wins)
  for (const entry of KEYWORD_ENTRIES) {
    for (const trigger of entry.triggers) {
      if (blob.includes(trigger)) {
        return entry.image;
      }
    }
  }

  // Fallback to category image (null for Miscellaneous/Featured/For U)
  const category = classifyCategory(event);
  return CATEGORY_FALLBACKS[category] || null;
}
