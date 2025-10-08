import React, { useEffect } from "react";
import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { VoiceIntents } from "../../src/components/voiceIntents.js";
import { useVoiceIntents } from "../../src/components/useVoiceIntents.js"; // used only inside harness
import type { IntentHandler } from "../../src/components/useVoiceIntents.js";

const noopHandler: IntentHandler = (async () =>
  ({ status: "success" }) as any) as any;

// Helper harness to access useVoiceIntents API inside a component (Rules of Hooks)
const RegistryHarness: React.FC<{
  origin?: string;
  setup?: (api: ReturnType<typeof useVoiceIntents>) => void;
}> = ({ origin, setup }) => {
  const api = useVoiceIntents({ origin } as any);
  useEffect(() => {
    setup?.(api);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);
  return null;
};

describe("<VoiceIntents/>", () => {
  it("registers on mount and unregisters on unmount", () => {
    const origin = "TestOrigin";
    let registryApi: ReturnType<typeof useVoiceIntents> | undefined;

    const { unmount } = render(
      <>
        <RegistryHarness origin={origin} setup={(api) => (registryApi = api)} />
        <VoiceIntents
          origin={origin}
          intents={[
            { name: "open.menu", patterns: ["open menu"], handler: noopHandler },
            { name: "close.menu", patterns: ["close menu"], handler: noopHandler },
          ]}
        />
      </>
    );

    const names = registryApi!.getRegisteredIntentNames(origin);
    expect(names).toEqual(expect.arrayContaining(["open.menu", "close.menu"]));

    unmount();

    const after = registryApi!.getRegisteredIntentNames(origin);
    expect(after).not.toEqual(expect.arrayContaining(["open.menu", "close.menu"]));
  });

  it("respects enabled=false (no registration)", () => {
    const origin = "DisabledOrigin";
    let registryApi: ReturnType<typeof useVoiceIntents> | undefined;

    const { unmount, rerender } = render(
      <>
        <RegistryHarness origin={origin} setup={(api) => (registryApi = api)} />
        <VoiceIntents
          origin={origin}
          enabled={false}
          intents={[{ name: "search.query", patterns: ["search"], handler: noopHandler }]}
        />
      </>
    );

    expect(registryApi!.getRegisteredIntentNames(origin)).toEqual(
      expect.not.arrayContaining(["search.query"])
    );

    // Flip to enabled=true — should now register
    rerender(
      <>
        <RegistryHarness origin={origin} setup={(api) => (registryApi = api)} />
        <VoiceIntents
          origin={origin}
          enabled={true}
          intents={[{ name: "search.query", patterns: ["search"], handler: noopHandler }]}
        />
      </>
    );

    expect(registryApi!.getRegisteredIntentNames(origin)).toEqual(
      expect.arrayContaining(["search.query"])
    );

    unmount();
    cleanup();
  });
});
