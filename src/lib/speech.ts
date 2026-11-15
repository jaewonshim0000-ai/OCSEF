import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNative } from './native';

/**
 * Read aloud. The Android app uses the phone's own text-to-speech, because
 * Android's WebView has no working speechSynthesis. Browsers use speechSynthesis.
 */
export function speechAvailable(): boolean {
  if (isNative()) return true;
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

/** Speaks the text, then calls onEnd (also on failure, so the button resets). */
export function speak(text: string, onEnd: () => void): void {
  if (isNative()) {
    TextToSpeech.speak({ text, rate: 0.9 }).then(onEnd, onEnd);
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
}

export function cancelSpeech(): void {
  if (isNative()) {
    TextToSpeech.stop().catch(() => undefined);
    return;
  }
  if (speechAvailable()) window.speechSynthesis.cancel();
}
