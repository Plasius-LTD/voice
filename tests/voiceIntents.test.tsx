import React from "react";
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { VoiceIntents } from "../src/components/voiceIntents";
import { getRegisteredIntentNames } from "../src/components/useVoice.js";
import type { IntentHandler } from "../src/components/useVoice";

const noopHandler: IntentHandler = (async () =>
  ({ status: "success" }) as any) as any;

describe("<VoiceIntents/>", () => {
  it("registers on mount and unregisters on unmount", () => {
    const origin = "TestOrigin";

    const { unmount } = render(
      <VoiceIntents
        origin={origin}
        intents={[
          { name: "open.menu", patterns: ["open menu"], handler: noopHandler },
          {
            name: "close.menu",
            patterns: ["close menu"],
            handler: noopHandler,
          },
        ]}
      />
    );

    const names = getRegisteredIntentNames(origin);
    expect(names).toEqual(expect.arrayContaining(["open.menu", "close.menu"]));

    unmount();

    const after = getRegisteredIntentNames(origin);
    expect(after).not.toEqual(
      expect.arrayContaining(["open.menu", "close.menu"])
    );
  });

  it("respects enabled=false (no registration)", () => {
    const origin = "DisabledOrigin";

    const { unmount, rerender } = render(
      <VoiceIntents
        origin={origin}
        enabled={false}
        intents={[
          { name: "search.query", patterns: ["search"], handler: noopHandler },
        ]}
      />
    );

    expect(getRegisteredIntentNames(origin)).toEqual(
      expect.not.arrayContaining(["search.query"])
    );

    // Flip to enabled=true — should now register
    rerender(
      <VoiceIntents
        origin={origin}
        enabled={true}
        intents={[
          { name: "search.query", patterns: ["search"], handler: noopHandler },
        ]}
      />
    );

    expect(getRegisteredIntentNames(origin)).toEqual(
      expect.arrayContaining(["search.query"])
    );

    unmount();
    cleanup();
  });
});
