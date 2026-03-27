/**
 * Campus TTS Service
 * Uses expo-speech for immediate offline text-to-speech
 * ElevenLabs key stored in env for future premium voice upgrade
 */

import * as Speech from 'expo-speech';

let isSpeaking = false;

/**
 * Speak text aloud using device TTS
 */
export async function speakText(text: string): Promise<void> {
  try {
    await stopSpeech();
    isSpeaking = true;
    return new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.82,
        pitch: 0.9,
        onDone: () => {
          isSpeaking = false;
          resolve();
        },
        onError: () => {
          isSpeaking = false;
          resolve();
        },
      });
    });
  } catch (e) {
    isSpeaking = false;
    console.error('[CampusTTS] Error:', e);
  }
}

/**
 * Stop any in-progress speech
 */
export async function stopSpeech(): Promise<void> {
  try {
    if (isSpeaking) {
      Speech.stop();
      isSpeaking = false;
    }
  } catch (e) {
    isSpeaking = false;
  }
}

/**
 * Check if currently speaking
 */
export function getIsSpeaking(): boolean {
  return isSpeaking;
}

/**
 * Build and speak the route introduction
 */
export async function speakRouteIntro(
  destinationName: string,
  distance: string,
  time: string,
  mode: 'walk' | 'bus' = 'walk',
): Promise<void> {
  const intro = mode === 'bus'
    ? `Bus directions to ${destinationName}. Total trip is ${distance}, estimated ${time}.`
    : `Walking directions to ${destinationName}. Distance is ${distance}, estimated ${time} walk.`;
  await speakText(intro);
}

/**
 * Speak a direction step
 */
export async function speakStep(instruction: string): Promise<void> {
  await speakText(instruction);
}
