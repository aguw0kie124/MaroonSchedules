import { requestJson } from '../api/client';

/**
 * RevAI campus-assistant service.
 *
 * Always calls the live backend agent (POST /ai/assistant), which routes the
 * question to real campus data and returns {text, card?, courses?}.
 *
 * There are intentionally NO mock / hardcoded answers here — every question
 * goes to the agent, and if the backend can't be reached the error surfaces to
 * the caller instead of being masked by canned text.
 */

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

/** Static opening line shown before the user asks anything (UI only, not an answer). */
export const GREETING: AssistantReply = {
  text: "**Howdy! I'm RevAI** — your campus sidekick. Ask me about classes, dining, events, or what's happening on campus today.",
};

/** Example prompts the user can tap; each is sent to the agent like any question. */
export const SUGGESTION_CHIPS: string[] = [
  'Easy electives',
  'Free food today',
  'Is Sbisa open?',
  'Best prof for CSCE 221',
];

export async function askAssistant(question: string): Promise<AssistantReply> {
  const data = await requestJson(
    '/ai/assistant',
    {
      method: 'POST',
      body: JSON.stringify({ message: question }),
    },
    ASSISTANT_TIMEOUT_MS,
  );

  if (data && typeof data.text === 'string') {
    return {
      text: data.text,
      card: data.card ?? undefined,
      courses: Array.isArray(data.courses) ? data.courses : undefined,
    };
  }

  throw new Error('RevAI returned an unexpected response');
}
