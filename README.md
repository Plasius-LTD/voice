# @plasius/voice

[![npm version](https://img.shields.io/npm/v/@plasius/voice.svg)](https://www.npmjs.com/package/@plasius/voice)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/voice/ci.yml?branch=main&label=build&style=flat)](https://github.com/plasius/voice/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/voice)](https://codecov.io/gh/Plasius-LTD/voice)
[![License](https://img.shields.io/github/license/Plasius-LTD/voice)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

---

## Overview

`@plasius/voice` is a React hook and provider for adding speech recognition and voice controls to your applications. It wraps the Web Speech API with a stateful interface, controls (mute, volume, push-to-talk), and an intent registration system for mapping spoken commands to actions.

---

## Installation

```bash
npm install @plasius/voice
```

---

## Usage Example

### One-line hook (intents + controls)

If you prefer a single hook, `useVoice` bundles intents and controls and leaves starting/stopping explicit (no auto-start by default):

```ts
import { useEffect } from "react";
import { useVoice } from "@plasius/voice";

export function VoicePanel() {
  const { intents, control, start, stop } = useVoice({
    intents: { origin: "App" }, // set autoStart: true to opt into immediate listening
    control: { enableGlobalKeyboard: false },
  });

  useEffect(() => {
    // Start on mount; callers can also bind start/stop to UI buttons.
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <div>
      <button onClick={() => control.setMuted(!control.pttButtonProps["aria-pressed"])}>
        Toggle mute
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
    <VoiceProvider opts={{ origin: "App", lang: "en-GB", interim: true }}>
      <h1>My Voice-Enabled App</h1>
      <VoiceControls />
      <VoiceTranscript />
    </VoiceProvider>
  );
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
