import { fetch as expoFetch } from 'expo/fetch';
import { requestJson, buildApiHeaders } from '../api/client';
import { API_URL } from '../config';

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
// The streaming connection stays open while tokens trickle in; bounded mainly
// as a last-resort safety net (the backend closes the stream well before this).
const STREAM_TIMEOUT_MS = 60000;

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

/** One prior turn, sent back on every request so the backend can stay stateless. */
export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** One event from the streaming endpoint (see routers/ai.py::assistant_stream). */
export interface AssistantStreamEvent {
  type: 'status' | 'delta' | 'done';
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

export async function askAssistant(
  question: string,
  history: AssistantHistoryTurn[] = [],
): Promise<AssistantReply> {
  const data = await requestJson(
    '/ai/assistant',
    {
      method: 'POST',
      body: JSON.stringify({ message: question, history }),
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

/**
 * Streamed variant of askAssistant: calls `onEvent` as status/delta/done
 * events arrive over SSE. Uses `expo/fetch` rather than the global fetch
 * interceptor in api/client.ts, since RN's built-in fetch doesn't expose an
 * incremental (streamable) response body — `expo/fetch` does.
 *
 * Throws (instead of calling `onEvent`) if the connection can't be made at
 * all, or if the stream ends without a single event — callers should catch
 * this and fall back to `askAssistant`.
 */
export async function streamAssistant(
  question: string,
  history: AssistantHistoryTurn[],
  onEvent: (event: AssistantStreamEvent) => void,
): Promise<void> {
  const body = JSON.stringify({ message: question, history });
  const headers = await buildApiHeaders({ body });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  let receivedAny = false;
  try {
    const response = await expoFetch(`${API_URL}/ai/assistant/stream`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`RevAI stream failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
        if (!dataLine) continue;
        try {
          const event = JSON.parse(dataLine.slice(6)) as AssistantStreamEvent;
          receivedAny = true;
          onEvent(event);
        } catch {
          // Malformed chunk — skip it, the stream will still complete.
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!receivedAny) {
    throw new Error('RevAI stream ended without any events');
  }
}
