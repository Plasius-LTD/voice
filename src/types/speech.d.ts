// speech.d.ts
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onaudioend?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror?: ((this: SpeechRecognition, ev: any) => any) | null;
  onresult?:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onstart?: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};
