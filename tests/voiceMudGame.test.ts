import { describe, expect, it } from "vitest";

import {
  applyCommand,
  availableExits,
  createInitialState,
  normalizeCommand,
} from "../demo/voice-mud-game.mjs";

function runRoute(commands: string[]) {
  return commands.reduce((state, command) => applyCommand(state, command).state, createInitialState());
}

describe("voice MUD demo game", () => {
  it("normalizes spoken route filler words", () => {
    expect(normalizeCommand("Please go to the west!")).toBe("west");
    expect(normalizeCommand("Head north")).toBe("north");
  });

  it("keeps the market north exit locked until the key unlocks it", () => {
    const initial = createInitialState();
    expect(availableExits(initial)).toContainEqual({
      direction: "north",
      roomId: "gate",
      locked: true,
    });

    const blocked = applyCommand(initial, "north");
    expect(blocked.state.roomId).toBe("market");
    expect(blocked.messages).toContain("The iron gate is locked.");

    const unlocked = runRoute(["west", "take key", "east", "unlock gate"]);
    expect(unlocked.unlockedGate).toBe(true);
    expect(availableExits(unlocked)).toContainEqual({
      direction: "north",
      roomId: "gate",
      locked: false,
    });
  });

  it("supports a complete voice navigation route", () => {
    const finished = runRoute([
      "west",
      "take key",
      "east",
      "east",
      "take lantern",
      "west",
      "unlock gate",
      "north",
      "north",
      "light lantern",
    ]);

    expect(finished.roomId).toBe("tower");
    expect(finished.finished).toBe(true);
    expect(finished.inventory).toEqual(["key", "lantern"]);
  });
});
