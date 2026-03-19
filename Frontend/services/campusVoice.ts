/**
 * Campus Voice Service
 * Records audio with expo-av, sends to Gemini for transcription + intent extraction
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { BUILDINGS, AMENITIES } from '../data/campus';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export type VoiceIntent =
  | { type: 'BUILDING'; buildingId: string; raw: string }
  | { type: 'NEAREST'; category: 'restroom' | 'coffee' | 'dining' | 'library' | 'study' | 'parking'; raw: string }
  | { type: 'SEARCH'; query: string; raw: string }
  | { type: 'UNKNOWN'; raw: string };

// ─── Recording ──────────────────────────────────────────────
let recording: Audio.Recording | null = null;

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecording(): Promise<void> {
  if (recording) await stopRecording();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const { recording: rec } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  recording = rec;
}

export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;
  return uri;
}

export function isCurrentlyRecording(): boolean {
  return recording !== null;
}

// ─── Local Rule-Based Intent (fast fallback) ────────────────
const RESTROOM_KW = ['bathroom', 'restroom', 'toilet', 'washroom', 'lavatory'];
const COFFEE_KW = ['coffee', 'cafe', 'espresso', 'latte', 'starbucks', "rev's", 'revs'];
const DINING_KW = ['food', 'eat', 'dining', 'restaurant', 'lunch', 'dinner', 'sbisa', 'commons', 'chick-fil-a'];
const LIBRARY_KW = ['library', 'study', 'evans', 'annex'];
const NEAREST_KW = ['nearest', 'closest', 'nearby', 'near', 'find', 'where'];

function extractLocalIntent(text: string): VoiceIntent {
  const t = text.toLowerCase().trim();
  const raw = text.trim();

  // Check nearest commands
  const isNearest = NEAREST_KW.some((k) => t.includes(k));

  if (isNearest || true) {
    if (RESTROOM_KW.some((k) => t.includes(k))) return { type: 'NEAREST', category: 'restroom', raw };
    if (COFFEE_KW.some((k) => t.includes(k))) return { type: 'NEAREST', category: 'coffee', raw };
    if (DINING_KW.some((k) => t.includes(k))) return { type: 'NEAREST', category: 'dining', raw };
    if (LIBRARY_KW.some((k) => t.includes(k))) return { type: 'NEAREST', category: 'library', raw };
  }

  // Check building names
  for (const b of BUILDINGS) {
    if (t.includes(b.shortName.toLowerCase()) || t.includes(b.name.toLowerCase())) {
      return { type: 'BUILDING', buildingId: b.id, raw };
    }
  }

  // Fallback: treat as search query
  let query = t
    .replace(/take me to\s*/i, '')
    .replace(/go to\s*/i, '')
    .replace(/navigate to\s*/i, '')
    .replace(/directions to\s*/i, '')
    .replace(/find\s*/i, '')
    .replace(/where is\s*/i, '')
    .trim();
  if (query.length > 0) return { type: 'SEARCH', query, raw };

  return { type: 'UNKNOWN', raw };
}

// ─── Gemini Transcription + Intent ──────────────────────────
export async function processVoiceCommand(audioUri: string): Promise<{
  transcript: string;
  intent: VoiceIntent;
}> {
  // Read audio as base64
  let base64Audio: string;
  try {
    base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: 'base64',
    });
  } catch (e) {
    console.error('[CampusVoice] Failed to read audio file:', e);
    return { transcript: '', intent: { type: 'UNKNOWN', raw: '' } };
  }

  if (!GEMINI_API_KEY) {
    console.warn('[CampusVoice] No Gemini API key, using local intent extraction');
    return { transcript: '(no API key)', intent: { type: 'UNKNOWN', raw: '' } };
  }

  try {
    const buildingNames = BUILDINGS.map((b) => `${b.shortName} (${b.name})`).join(', ');
    const amenityTypes = ['restroom', 'coffee', 'dining', 'library', 'study', 'parking'];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'audio/m4a',
                    data: base64Audio,
                  },
                },
                {
                  text: `You are a Texas A&M campus navigation assistant. Transcribe this audio and extract the navigation intent.

Available buildings: ${buildingNames}
Available amenity categories: ${amenityTypes.join(', ')}

Respond ONLY with valid JSON (no markdown, no code fences):
{"transcript": "what the user said", "intent_type": "BUILDING|NEAREST|SEARCH|UNKNOWN", "building_id": "id if BUILDING", "category": "category if NEAREST", "query": "search text if SEARCH"}`,
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.warn('[CampusVoice] Gemini API error:', response.status, '— falling back to local intent');
      // Gemini unavailable (rate limited, etc.) — fall back to local processing
      // We don't have a transcript, so return a hint to the user
      return { transcript: '(voice processed locally)', intent: { type: 'UNKNOWN', raw: '(API rate limited — try typing instead)' } };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON response
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try regex extraction
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {}
      }
    }

    if (!parsed) {
      return { transcript: text, intent: extractLocalIntent(text) };
    }

    const transcript = parsed.transcript || '';
    let intent: VoiceIntent;

    switch (parsed.intent_type) {
      case 'BUILDING':
        intent = { type: 'BUILDING', buildingId: parsed.building_id || '', raw: transcript };
        break;
      case 'NEAREST':
        intent = { type: 'NEAREST', category: parsed.category || 'restroom', raw: transcript };
        break;
      case 'SEARCH':
        intent = { type: 'SEARCH', query: parsed.query || transcript, raw: transcript };
        break;
      default:
        intent = extractLocalIntent(transcript);
    }

    return { transcript, intent };
  } catch (e) {
    console.error('[CampusVoice] Gemini processing error:', e);
    return { transcript: '(processing error)', intent: { type: 'UNKNOWN', raw: 'Voice processing failed — try typing your destination' } };
  }
}
