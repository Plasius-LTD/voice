// tests/types/webspeech.d.ts
// Minimal Web Speech typings for test environment
export {};

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEvent {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex?: number;
}

declare global {
  interface SpeechRecognition {
    lang: string;
    interimResults: boolean;
    continuous: boolean;

    onstart?: () => void;
    onend?: () => void;
    onerror?: (e: any) => void;
    onresult?: (ev: any) => void;

    start(): void;
    stop(): void;
    abort(): void;
  }
}

declare var webkitSpeechRecognition: SpeechRecognition;
