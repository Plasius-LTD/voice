# @plasius/voice Demo

This is a lightweight local demo scaffold for package sanity checks.

## Run

```bash
npm run build
node demo/example.mjs
```

## Browser voice MUD

The browser demo is a small text MUD that exercises microphone permission,
Web Speech recognition, transcript mirroring, typed command fallback, and
voice-friendly command parsing.

```bash
npm run build
npm run demo:mud
```

Open the printed localhost URL. Use **Start voice** to approve microphone
access, then say commands such as `west`, `take key`, `east`, `take lantern`,
`unlock gate`, `north`, and `light lantern`. Browsers without Web Speech can
still use the typed command field and shortcut buttons.
