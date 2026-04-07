/**
 * Campus Voice Service
 * Records audio with expo-av, sends to Gemini for transcription + intent extraction
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { API_URL } from '../config';
import { buildExpandedPlacesDirectory, getLocationSelectionId } from '../components/places/campusData';

export type VoiceIntent =
  | { type: 'BUILDING'; buildingId: string; raw: string }
  | { type: 'NEAREST'; category: 'restroom' | 'coffee' | 'dining' | 'library' | 'study' | 'parking'; raw: string }
  | { type: 'SEARCH'; query: string; raw: string }
  | { type: 'UNKNOWN'; raw: string };

// ─── Recording ──────────────────────────────────────────────
let recording: Audio.Recording | null = null;
const VOICE_LOCATIONS = buildExpandedPlacesDirectory();

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
  for (const location of VOICE_LOCATIONS) {
    const shortName = location.shortName?.toLowerCase() || '';
    const locationName = location.location.toLowerCase();
    if ((shortName && t.includes(shortName)) || t.includes(locationName)) {
      return {
        type: 'BUILDING',
        buildingId: location.placeId || getLocationSelectionId(location),
        raw,
      };
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

// ─── OpenAI Backend Proxy ───────────────────────────────────
export async function processVoiceCommand(audioUri: string): Promise<{
  transcript: string;
  intent: VoiceIntent;
}> {
    try {
        const formData = new FormData();
        // @ts-ignore
        formData.append('file', {
            uri: audioUri,
            name: 'recording.m4a',
            type: 'audio/m4a',
        });

        const response = await fetch(`${API_URL}/ai/process-voice`, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data',
            },
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Voice Processing Error: ${err}`);
        }

        const data = await response.json();
        const transcript = data.transcript || '';
        const rawIntent = data.intent || {};

        let intent: VoiceIntent;
        switch (rawIntent.intent_type) {
            case 'BUILDING':
                intent = { type: 'BUILDING', buildingId: rawIntent.building_id || '', raw: transcript };
                break;
            case 'NEAREST':
                intent = { type: 'NEAREST', category: rawIntent.category || 'restroom', raw: transcript };
                break;
            case 'SEARCH':
                intent = { type: 'SEARCH', query: rawIntent.query || transcript, raw: transcript };
                break;
            default:
                intent = extractLocalIntent(transcript);
        }

        return { transcript, intent };
    } catch (e) {
        console.error('[CampusVoice] OpenAI Processing Error:', e);
        return { transcript: '(processing error)', intent: { type: 'UNKNOWN', raw: 'Proxy failed — try typing your destination' } };
    }
}
