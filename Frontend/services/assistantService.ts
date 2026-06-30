import { requestJson } from '../api/client';

/**
 * RevAI campus-assistant service.
 *
 * Today this returns local demo replies so the chat screen is fully functional
 * and on-design. When the backend agent endpoint (POST /ai/assistant, tool-calling
 * over courses/grades/dining/events) is live, flip USE_BACKEND to true — the
 * screen needs no changes.
 */

const USE_BACKEND = true; // POST /ai/assistant is live (routes → campus data → answer)

// The endpoint makes two (slow, free-model) LLM calls plus a possible cold
// course-catalog fetch, so it needs a much longer timeout than the 8s default.
const ASSISTANT_TIMEOUT_MS = 45000;

export type AssistantStatusTone = 'open' | 'closed';

/** Inline status card inside an AI bubble (e.g. dining hours). */
export interface AssistantInfoCard {
  name: string;
  detail: string; // e.g. "North Campus · Closes 9:00 PM"
  status?: { label: string; tone: AssistantStatusTone };
}

/** A row in an AI bubble's course list (e.g. best profs by GPA). */
export interface AssistantCourseRow {
  code: string; // e.g. "221"
  name: string; // e.g. "Dr. Teresa Leyk"
  meta: string; // e.g. "3.6 GPA"
}

export interface AssistantReply {
  /** Body text. Supports lightweight **bold** markers, rendered in maroon. */
  text: string;
  card?: AssistantInfoCard;
  courses?: AssistantCourseRow[];
}

export const GREETING: AssistantReply = {
  text: "**Howdy! I'm RevAI** — your campus sidekick. Ask me about classes, dining, events, or what's happening on campus today.",
};

export const SUGGESTION_CHIPS: string[] = [
  'Easy electives',
  'Free food today',
  'Is Sbisa open?',
  'Best prof for CSCE 221',
];

const FALLBACK: AssistantReply = {
  text: 'Good question! Let me pull that from campus data — I can check dining hours, grade distributions, events, and more.',
};

const MOCK_REPLIES: Record<string, AssistantReply> = {
  'easy electives': {
    text: 'A few crowd favorites with high GPAs — want me to check which have open seats?',
    courses: [
      { code: 'KINE', name: 'Physical Activity (199)', meta: '3.9 GPA' },
      { code: 'AGEC', name: 'Intro to Ag Economics (105)', meta: '3.7 GPA' },
      { code: 'COMM', name: 'Public Speaking (203)', meta: '3.6 GPA' },
    ],
  },
  'free food today': {
    text: 'Found **3 events with free food** today: Engineering Career Mixer (5 PM, Zachry), MSC Open House pizza (12 PM), and a CS Club taco night (6 PM, HRBB). Want details?',
  },
  'is sbisa open?': {
    text: 'Yes — **Sbisa Dining Hall** is serving dinner right now.',
    card: {
      name: 'Sbisa Dining Hall',
      detail: 'North Campus · Closes 9:00 PM',
      status: { label: 'Open now', tone: 'open' },
    },
  },
  'best prof for csce 221': {
    text: 'Based on grade distributions and reviews, these instructors have the highest GPA for **CSCE 221**:',
    courses: [
      { code: '221', name: 'Dr. Teresa Leyk', meta: '3.6 GPA' },
      { code: '221', name: 'Dr. John Keyser', meta: '3.4 GPA' },
    ],
  },
};

function normalizeKey(question: string): string {
  return question.trim().toLowerCase().replace(/[?…]+$/g, '');
}

export async function askAssistant(question: string): Promise<AssistantReply> {
  if (USE_BACKEND) {
    try {
      const data = await requestJson(
        '/ai/assistant',
        {
          method: 'POST',
          body: JSON.stringify({ message: question }),
        },
        ASSISTANT_TIMEOUT_MS,
      );
      if (data && typeof data.text === 'string') {
        return { text: data.text, card: data.card, courses: data.courses };
      }
    } catch (err) {
      // Backend agent unavailable — fall through to local demo replies.
    }
  }

  // Simulate latency so the typing indicator reads naturally.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return MOCK_REPLIES[normalizeKey(question)] ?? FALLBACK;
}
