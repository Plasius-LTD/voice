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

```ts
import { VoiceProvider, useVoice, useVoiceControls } from "@plasius/voice";

function VoiceControls() {
  const { muted, volume, toggleMute, setVolume, listening, pushToTalk } = useVoiceControls();

  return (
    <div>
      <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
      />
      <button {...pushToTalk}>Push to Talk</button>
      <div>Listening: {listening ? "Yes" : "No"}</div>
    </div>
  );
}

function VoiceTranscript() {
  const { listening, transcript, partial, error } = useVoice({ origin: "Transcript" });

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

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributor License Agreement](./legal/CLA.md)

---

## License

This project is licensed under the terms of the [Apache 2.0 license](./LICENSE).
