# @plasius/voice

[![npm version](https://img.shields.io/npm/v/@plasius/voice.svg)](https://www.npmjs.com/package/@plasius/voice)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/voice/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/voice/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/voice)](https://codecov.io/gh/Plasius-LTD/voice)
[![License](https://img.shields.io/github/license/Plasius-LTD/voice)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Apache-2.0. ESM + CJS builds. TypeScript types included.

---

## Overview

`@plasius/voice` is a React hook and provider for adding speech recognition and voice controls to your applications. It wraps the Web Speech API with a stateful interface, controls (mute, volume, push-to-talk), and an intent registration system for mapping spoken commands to actions.

Web Speech recognition is not available in every browser and can also fail when a browser-side recognition service is disabled. For production use, configure a remote recognition fallback that records microphone audio with `MediaRecorder` and posts it to your own server-side speech-to-text endpoint. Keep provider secrets on the server; the package only sends captured audio to the endpoint or client you provide.

---

## Installation

```bash
npm install @plasius/voice
```

---

## Demo

```bash
npm run build
node demo/example.mjs
```

For browser voice navigation testing, run the MUD test bed:

```bash
npm run build
npm run demo:mud
```

Open the printed localhost URL, approve microphone access, and use commands
such as `west`, `take key`, `east`, `take lantern`, `unlock gate`, `north`, and
`light lantern`. See `demo/README.md` for the local demo scaffolds.

---

## Usage Example

### One-line hook (intents + controls)

If you prefer a single hook, `useVoice` bundles intents and controls and leaves starting/stopping explicit (no auto-start by default):

```ts
import { useEffect, useState } from "react";
import { useVoice } from "@plasius/voice";

export function VoicePanel() {
  const { intents, control, start, stop } = useVoice({
    intents: { origin: "App" }, // set autoStart: true to opt into immediate listening
    control: { enableGlobalKeyboard: false },
  });
  const [muted, setMuted] = useState(
    () => intents.getState?.().muted ?? false
  );

  useEffect(() => intents.subscribeToKey?.("muted", setMuted), [intents]);

  useEffect(() => {
    // Explicit start; hook defaults to autoStart: false
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <div>
      <button
        onClick={() => {
          const next = !muted;
          setMuted(next);
          control.setMuted(next);
        }}
      >
        {muted ? "Unmute" : "Mute"}
      </button>
      <button {...control.pttButtonProps}>Push to Talk</button>
      <div>Transcript: {intents.transcript}</div>
    </div>
  );
}
```

### Using separate hooks

```ts
import { useEffect, useState } from "react";
import { VoiceProvider, useVoiceControl, useVoiceIntents } from "@plasius/voice";

function VoiceControls() {
  const { subscribeToKey, getState } = useVoiceIntents();
  const { setMuted, setVolume, pttButtonProps } = useVoiceControl();

  const [muted, setMutedState] = useState(() => getState?.().muted ?? false);
  const [volume, setVolumeState] = useState(() => getState?.().volume ?? 1);
  const [listening, setListening] = useState(
    () => getState?.().listening ?? false
  );

  useEffect(() => {
    const unsubMuted = subscribeToKey?.("muted", setMutedState);
    const unsubVolume = subscribeToKey?.("volume", setVolumeState);
    const unsubListening = subscribeToKey?.("listening", setListening);
    return () => {
      unsubMuted?.();
      unsubVolume?.();
      unsubListening?.();
    };
  }, [subscribeToKey]);

  return (
    <div>
      <button onClick={() => setMuted(!muted)}>{muted ? "Unmute" : "Mute"}</button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setVolumeState(v);
          setVolume(v);
        }}
      />
      <button {...pttButtonProps}>Push to Talk</button>
      <div>Listening: {listening ? "Yes" : "No"}</div>
    </div>
  );
}

function VoiceTranscript() {
  const { transcript, partial, error, subscribeToKey, getState } = useVoiceIntents({
    origin: "Transcript",
    autoStart: true,
  });
  const [listening, setListening] = useState(
    () => getState?.().listening ?? false
  );

  useEffect(() => subscribeToKey?.("listening", setListening), [subscribeToKey]);

  return (
    <div>
      <div>Listening: {listening ? "Yes" : "No"}</div>
      <div>Transcript: {transcript}</div>
      <div>Partial: {partial}</div>
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
    </div>
  );
}

export default function App() {
  return (
    <VoiceProvider options={{ origin: "App", lang: "en-GB", interim: true }}>
      <h1>My Voice-Enabled App</h1>
      <VoiceControls />
      <VoiceTranscript />
    </VoiceProvider>
  );
}
```

### Local and remote speech recognition fallback

Use `engineConfig.localRecognition` and `engineConfig.remoteRecognition` from `useVoiceControl` or `useVoice`. In `auto` mode, the package prefers a configured local recognizer, then Web Speech, then remote recognition when lower tiers are unavailable or fail.

The local recognizer is an adapter contract. Host apps can wire it to Apple Speech, Android `SpeechRecognizer`, Windows `SpeechRecognizer`, a WebGPU/WebAssembly model, or another native bridge without adding those dependencies to `@plasius/voice`.

```ts
import { useVoice, type LocalSpeechRecognitionClient } from "@plasius/voice";

const localClient: LocalSpeechRecognitionClient = async ({ audio, lang, signal }) => {
  return nativeSpeechBridge.transcribe({ audio, lang, signal });
};

export function VoicePanel({ voiceFallbackEnabled }: { voiceFallbackEnabled: boolean }) {
  const { intents, control, start, stop } = useVoice({
    intents: { origin: "Search", lang: "en-GB", interim: true },
    control: {
      enableGlobalKeyboard: false,
      engineConfig: {
        mode: "auto",
        localRecognition: {
          enabled: true,
          executionTarget: "native",
          adapterName: "apple-speech",
          client: localClient,
        },
        remoteRecognition: {
          enabled: voiceFallbackEnabled,
          endpoint: "/api/voice/speech-to-text",
          fieldName: "audio",
          metadata: { source: "search-panel" },
        },
      },
    },
  });

  return (
    <section>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      <button {...control.pttButtonProps}>Push to Talk</button>
      <output>{intents.partial || intents.transcript}</output>
    </section>
  );
}
```

For WebGPU local recognizers, keep recognition out of the rendering hot path. `executionTarget: "webgpu"` automatically requires `navigator.gpu`; by default it also skips the local recognizer when `gpuPolicy.isRenderingActive()` returns true and limits single recordings to 4000ms unless you override it.

```ts
localRecognition: {
  enabled: webGpuVoiceEnabled,
  executionTarget: "webgpu",
  client: webGpuTranscriber,
  gpuPolicy: {
    isRenderingActive: () => renderer.isFrameBudgetTight(),
    maxRecordingMs: 2500,
  },
}
```

The endpoint receives `multipart/form-data` with `audio`, `lang`, `interim`, `continuous`, `sessionId`, and `mimeType` fields. Return JSON with `transcript` or `text`:

```json
{ "transcript": "show black running shoes" }
```

For non-browser shells, hosted webviews, or a custom speech vendor SDK, pass a `client` instead of an endpoint:

```ts
import type { RemoteSpeechRecognitionClient } from "@plasius/voice";

const client: RemoteSpeechRecognitionClient = async ({ audio, lang, signal }) => {
  const response = await mySpeechSdk.transcribe({ audio, lang, signal });
  return { transcript: response.text };
};
```

### Consumer upgrade guidance

Consumers that already use `useVoice` can add fallback recognition by passing
`control.engineConfig`. This keeps intents and recognition controls on one
shared store.

Consumers that use `VoiceProvider` and `useVoiceIntents` directly should also
mount `useVoiceControl` against the same `globalStore`, or switch to `useVoice`,
otherwise they only register intents and dispatch start/stop requests. The
recognition engine is owned by `useVoiceControl`.

```ts
import {
  createGlobalVoiceStore,
  useVoiceControl,
  useVoiceIntents,
} from "@plasius/voice";

const voiceStore = createGlobalVoiceStore();

export function VoiceConsumer() {
  const intents = useVoiceIntents({
    origin: "Game",
    continuous: true,
    globalStore: voiceStore,
  });
  const control = useVoiceControl({
    globalStore: voiceStore,
    engineConfig: {
      mode: "auto",
      remoteRecognition: {
        enabled: true,
        endpoint: "/api/voice/speech-to-text",
      },
    },
  });

  return <button {...control.pttButtonProps}>{intents.partial || "Talk"}</button>;
}
```

### Registering Intents

You can register voice intents that map certain phrases or regex patterns to custom handlers. These handlers run instead of the generic `activate` callback when the intent matches.

```ts
import { registerVoiceIntents, unregisterVoiceIntents } from "@plasius/voice";

// Register intents for a page or origin
registerVoiceIntents("CartPage", [
  {
    name: "cart.addItem",
    patterns: [/add to (cart|basket|bag)/i],
    handler: async (utterance) => {
      console.log("Adding item:", utterance);
      return { status: "success" };
    },
  },
]);

// Later, you can unregister them by origin or by specific names
unregisterVoiceIntents("CartPage", ["cart.addItem"]);
```

This lets you scope voice commands by page (or use `"*"` as the origin for global commands).

### Spell casting helpers

`@plasius/voice` also exports a small helper surface for spoken spell
declarations. This keeps spell-grammar parsing close to the voice-intent layer
while letting host apps own the actual game or simulation action.

```ts
import {
  createSpellCastingIntent,
  parseSpellCastingUtterance,
  SPELL_CASTING_FEATURE_FLAG_ID,
} from "@plasius/voice";

const parsed = parseSpellCastingUtterance(
  "At the marked point, cast a class 5 stabiliser field"
);

// {
//   mode: "location",
//   target: "the marked point",
//   effect: "a class 5 stabiliser field",
//   rawUtterance: "At the marked point, cast a class 5 stabiliser field"
// }

const spellIntent = createSpellCastingIntent(async (intent, meta) => {
  if (!featureFlags[SPELL_CASTING_FEATURE_FLAG_ID]) {
    return "no-match";
  }

  await spellAuthority.queue(intent, {
    transcript: meta.rawUtterance,
    sessionId: meta.sessionId,
    lang: meta.lang,
  });
  return "success";
});
```

The helper currently recognizes two bounded command shapes:

- `On <target>, cast <effect>` for entity-directed casting.
- `At <target>, cast <effect>` for location-directed casting.

`createSpellCastingIntent(...)` returns a normal registered intent object, so it
can be mounted with `registerVoiceIntents`, `VoiceIntents`, or
`useAutoVoiceIntents`. The helper reads the original spoken transcript from
`params.utterance`, which `useVoiceIntents` now forwards to registered intent
handlers when a pattern match succeeds, while preserving the original
`sessionId`, `origin`, and `lang` metadata on the handler `meta` object.

### Auto-registering intents with a component

```tsx
import { VoiceIntents } from "@plasius/voice";

// Registers while mounted; unregisters on unmount
<VoiceIntents
  origin="CartPage"
  intents={[{
    name: "cart.addItem",
    patterns: [/add to (cart|basket|bag)/i],
    handler: async () => ({ status: "success" }),
  }]}
/>

// Or with a hook
import { useAutoVoiceIntents } from "@plasius/voice";
useAutoVoiceIntents("CartPage", [{ name: "open.menu", patterns: ["open menu"], handler: async () => ({ status: "success" }) }]);
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributor License Agreement](./legal/CLA.md)

---

## License

This project is licensed under the terms of the [Apache 2.0 license](./LICENSE).
