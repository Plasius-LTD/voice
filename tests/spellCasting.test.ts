import { describe, expect, it, vi } from "vitest";

import {
  createSpellCastingIntent,
  parseSpellCastingUtterance,
  SPELL_CASTING_FEATURE_FLAG_ID,
} from "../src/spellCasting.js";

describe("spell casting voice helpers", () => {
  it("parses entity-target casting utterances", () => {
    expect(
      parseSpellCastingUtterance("On myself, cast a class 2 coherence shell")
    ).toEqual({
      effect: "a class 2 coherence shell",
      mode: "entity",
      rawUtterance: "On myself, cast a class 2 coherence shell",
      target: "myself",
    });
  });

  it("parses location-target casting utterances", () => {
    expect(
      parseSpellCastingUtterance(
        "At the marked point cast a class 5 stabiliser field"
      )
    ).toEqual({
      effect: "a class 5 stabiliser field",
      mode: "location",
      rawUtterance: "At the marked point cast a class 5 stabiliser field",
      target: "the marked point",
    });
  });

  it("returns null for non-casting utterances", () => {
    expect(parseSpellCastingUtterance("hello there")).toBeNull();
  });

  it("returns null for empty or whitespace-only utterances", () => {
    expect(parseSpellCastingUtterance("")).toBeNull();
    expect(parseSpellCastingUtterance("   ")).toBeNull();
  });

  it("returns null when the cast separator is missing", () => {
    expect(parseSpellCastingUtterance("On myself")).toBeNull();
    expect(parseSpellCastingUtterance("At the marked point")).toBeNull();
  });

  it("returns null when the target or effect is empty", () => {
    expect(parseSpellCastingUtterance("On , cast a class 2 shell")).toBeNull();
    expect(parseSpellCastingUtterance("At the marked point, cast")).toBeNull();
  });

  it("creates a registered intent that passes parsed spell declarations to a handler", async () => {
    const handler = vi.fn(() => "success" as const);
    const intent = createSpellCastingIntent(handler);

    await expect(
      Promise.resolve(intent.handler({
        sessionId: "session-1",
        params: {
          utterance: "At 30m forward, cast a class 3 fireball",
        },
      }))
    ).resolves.toBe("success");

    expect(handler).toHaveBeenCalledWith(
      {
        effect: "a class 3 fireball",
        mode: "location",
        rawUtterance: "At 30m forward, cast a class 3 fireball",
        target: "30m forward",
      },
      {
        params: {
          utterance: "At 30m forward, cast a class 3 fireball",
        },
        rawUtterance: "At 30m forward, cast a class 3 fireball",
      }
    );
    expect(SPELL_CASTING_FEATURE_FLAG_ID).toBe("voice.spell-casting-mode.enabled");
  });

  it("returns no-match when the transcript does not parse as a cast", async () => {
    const handler = vi.fn(() => "success" as const);
    const intent = createSpellCastingIntent(handler);

    expect(
      intent.handler({
        sessionId: "session-2",
        params: {
          transcript: "hello there",
        },
      })
    ).toBe("no-match");

    expect(handler).not.toHaveBeenCalled();
  });
});
