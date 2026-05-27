import { describe, expect, it } from "vitest";

import {
  applyCommand,
  availableExits,
  createInitialState,
  describeRoom,
  normalizeCommand,
  parseCommand,
} from "../demo/voice-mud-game.mjs";

function runRoute(commands: string[]) {
  return commands.reduce((state, command) => applyCommand(state, command).state, createInitialState());
}

describe("voice MUD demo game", () => {
  it("normalizes spoken route filler words", () => {
    expect(normalizeCommand("Please go to the west!")).toBe("west");
    expect(normalizeCommand("Head north")).toBe("north");
    expect(parseCommand("")).toEqual({ verb: "empty" });
    expect(parseCommand("where am I")).toEqual({ verb: "look" });
    expect(parseCommand("show inventory")).toEqual({ verb: "inventory" });
    expect(parseCommand("open the gate")).toEqual({ verb: "unlock" });
    expect(parseCommand("grab the lantern")).toEqual({
      verb: "take",
      item: "lantern",
    });
    expect(parseCommand("sing loudly")).toEqual({
      verb: "unknown",
      normalized: "sing loudly",
    });
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

  it("covers help, inventory, item, movement, and completed-route branches", () => {
    const initial = createInitialState();
    const empty = applyCommand(initial, " ");
    const help = applyCommand(initial, "help");
    const inventory = applyCommand(initial, "inventory");
    const unnamedTake = applyCommand(initial, "take");
    const missingTake = applyCommand(initial, "take lantern");
    const badMove = applyCommand(initial, "south");
    const awayFromGate = applyCommand(applyCommand(initial, "west").state, "unlock gate");
    const noKey = applyCommand(initial, "unlock gate");
    const withKey = runRoute(["west", "take key", "east", "unlock gate"]);
    const alreadyUnlocked = applyCommand(withKey, "unlock gate");
    const noLanternFinish = applyCommand(runRoute(["west", "take key", "east", "unlock gate", "north", "north"]), "light lantern");
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
    const afterFinish = applyCommand(finished, "south");
    const restarted = applyCommand(finished, "restart");

    expect(describeRoom(initial)).toContain("You can see map.");
    expect(empty.understood).toBe(false);
    expect(help.messages[0]).toContain("Try:");
    expect(inventory.messages).toEqual(["You carry nothing."]);
    expect(unnamedTake.messages).toEqual(["Name the thing to take."]);
    expect(missingTake.messages).toEqual(["There is no lantern here."]);
    expect(badMove.messages).toEqual(["You cannot go south from here."]);
    expect(awayFromGate.messages).toEqual(["The locked gate is back at the market."]);
    expect(noKey.messages).toEqual(["The gate will not move without a key."]);
    expect(alreadyUnlocked.messages).toEqual(["The gate is already unlocked."]);
    expect(noLanternFinish.messages).toEqual(["The hook waits, but you need the lantern."]);
    expect(afterFinish.messages).toEqual([
      "The signal already burns. Say restart to run the route again.",
    ]);
    expect(restarted.state.roomId).toBe("market");
    expect(restarted.state.finished).toBe(false);
  });
});
