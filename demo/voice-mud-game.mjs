export const rooms = {
  market: {
    name: "Rain Market",
    description:
      "Canvas awnings snap in the rain. A locked north gate blocks the old road. The archive is west and the glasshouse is east.",
    exits: { west: "archive", east: "glasshouse", north: "gate" },
    lockedExits: { north: "The iron gate is locked." },
    items: ["map"],
  },
  archive: {
    name: "Flooded Archive",
    description:
      "Water climbs the lower shelves. A brass key hangs from a nail beside a ledger of vanished captains.",
    exits: { east: "market" },
    items: ["key"],
  },
  glasshouse: {
    name: "Cracked Glasshouse",
    description:
      "Broken panes breathe mist over silvered leaves. A storm lantern waits on a stone bench.",
    exits: { west: "market" },
    items: ["lantern"],
  },
  gate: {
    name: "Old Road Gate",
    description:
      "The gate opens onto a narrow causeway. The tower waits north through the rain.",
    exits: { south: "market", north: "tower" },
    items: [],
  },
  tower: {
    name: "Signal Tower",
    description:
      "The tower room is dark except for the sea flashing below. A hook hangs ready for a lantern.",
    exits: { south: "gate" },
    items: [],
  },
};

export const directionAliases = {
  n: "north",
  north: "north",
  up: "north",
  s: "south",
  south: "south",
  down: "south",
  e: "east",
  east: "east",
  right: "east",
  w: "west",
  west: "west",
  left: "west",
};

export function createInitialState() {
  return {
    roomId: "market",
    inventory: [],
    visited: ["market"],
    unlockedGate: false,
    finished: false,
    turns: 0,
  };
}

export function currentRoom(state) {
  return rooms[state.roomId];
}

export function availableExits(state) {
  return Object.entries(currentRoom(state).exits).map(([direction, roomId]) => ({
    direction,
    roomId,
    locked: state.roomId === "market" && direction === "north" && !state.unlockedGate,
  }));
}

export function describeRoom(state) {
  const room = currentRoom(state);
  const items = room.items.filter((item) => !state.inventory.includes(item));
  const exits = availableExits(state)
    .map((exit) => `${exit.direction}${exit.locked ? " (locked)" : ""}`)
    .join(", ");

  return [
    room.description,
    items.length ? `You can see ${items.join(", ")}.` : "There is nothing loose here.",
    `Exits: ${exits}.`,
  ];
}

export function normalizeCommand(input) {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\b(go|move|walk|travel|head|please|to|the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCommand(input) {
  const normalized = normalizeCommand(input);
  const [first = "", second = ""] = normalized.split(" ");
  const direction = directionAliases[first] ?? directionAliases[second];

  if (!normalized) return { verb: "empty" };
  if (direction) return { verb: "move", direction };
  if (/\b(look|where|describe|room)\b/.test(normalized)) return { verb: "look" };
  if (/\b(help|commands)\b/.test(normalized)) return { verb: "help" };
  if (/\b(inventory|bag|items|carrying)\b/.test(normalized)) {
    return { verb: "inventory" };
  }
  if (/\b(restart|reset|again)\b/.test(normalized)) return { verb: "restart" };
  if (/\b(open|unlock|use)\b/.test(normalized) && /\b(gate|key|lock)\b/.test(normalized)) {
    return { verb: "unlock" };
  }
  if (/\b(take|get|grab|pick)\b/.test(normalized)) {
    if (/\bkey\b/.test(normalized)) return { verb: "take", item: "key" };
    if (/\blantern\b/.test(normalized)) return { verb: "take", item: "lantern" };
    if (/\bmap\b/.test(normalized)) return { verb: "take", item: "map" };
    return { verb: "take" };
  }
  if (/\b(light|hang|raise|signal)\b/.test(normalized) && /\b(lantern|light|signal)\b/.test(normalized)) {
    return { verb: "finish" };
  }

  return { verb: "unknown", normalized };
}

function withTurn(state, patch = {}) {
  return { ...state, ...patch, turns: state.turns + 1 };
}

export function applyCommand(state, input) {
  const command = parseCommand(input);
  const room = currentRoom(state);

  if (command.verb === "empty") {
    return { state, messages: ["No command heard."], understood: false };
  }

  if (command.verb === "restart") {
    const next = createInitialState();
    return {
      state: next,
      messages: ["The rain folds back on itself. You return to the market.", ...describeRoom(next)],
      understood: true,
    };
  }

  if (state.finished && command.verb !== "look" && command.verb !== "inventory") {
    return {
      state,
      messages: ["The signal already burns. Say restart to run the route again."],
      understood: true,
    };
  }

  if (command.verb === "look") {
    return { state: withTurn(state), messages: describeRoom(state), understood: true };
  }

  if (command.verb === "help") {
    return {
      state: withTurn(state),
      messages: [
        "Try: north, south, east, west, look, take key, unlock gate, light lantern, inventory, restart.",
      ],
      understood: true,
    };
  }

  if (command.verb === "inventory") {
    return {
      state: withTurn(state),
      messages: [
        state.inventory.length
          ? `You carry ${state.inventory.join(", ")}.`
          : "You carry nothing.",
      ],
      understood: true,
    };
  }

  if (command.verb === "take") {
    if (!command.item) {
      return {
        state: withTurn(state),
        messages: ["Name the thing to take."],
        understood: true,
      };
    }
    if (!room.items.includes(command.item) || state.inventory.includes(command.item)) {
      return {
        state: withTurn(state),
        messages: [`There is no ${command.item} here.`],
        understood: true,
      };
    }
    const next = withTurn(state, {
      inventory: [...state.inventory, command.item],
    });
    return {
      state: next,
      messages: [`Taken: ${command.item}.`],
      understood: true,
    };
  }

  if (command.verb === "unlock") {
    if (state.roomId !== "market") {
      return {
        state: withTurn(state),
        messages: ["The locked gate is back at the market."],
        understood: true,
      };
    }
    if (!state.inventory.includes("key")) {
      return {
        state: withTurn(state),
        messages: ["The gate will not move without a key."],
        understood: true,
      };
    }
    if (state.unlockedGate) {
      return {
        state: withTurn(state),
        messages: ["The gate is already unlocked."],
        understood: true,
      };
    }
    return {
      state: withTurn(state, { unlockedGate: true }),
      messages: ["The brass key turns. The north gate opens."],
      understood: true,
    };
  }

  if (command.verb === "finish") {
    if (state.roomId !== "tower") {
      return {
        state: withTurn(state),
        messages: ["The signal hook is in the tower."],
        understood: true,
      };
    }
    if (!state.inventory.includes("lantern")) {
      return {
        state: withTurn(state),
        messages: ["The hook waits, but you need the lantern."],
        understood: true,
      };
    }
    return {
      state: withTurn(state, { finished: true }),
      messages: [
        "You light the lantern. The harbor answers with three distant bells.",
        `Route complete in ${state.turns + 1} turns.`,
      ],
      understood: true,
    };
  }

  if (command.verb === "move") {
    const target = room.exits[command.direction];
    if (!target) {
      return {
        state: withTurn(state),
        messages: [`You cannot go ${command.direction} from here.`],
        understood: true,
      };
    }
    if (state.roomId === "market" && command.direction === "north" && !state.unlockedGate) {
      return {
        state: withTurn(state),
        messages: [room.lockedExits.north],
        understood: true,
      };
    }
    const visited = state.visited.includes(target)
      ? state.visited
      : [...state.visited, target];
    const next = withTurn(state, { roomId: target, visited });
    return {
      state: next,
      messages: [`You go ${command.direction} to ${rooms[target].name}.`, ...describeRoom(next)],
      understood: true,
    };
  }

  return {
    state: withTurn(state),
    messages: [`I heard "${input}", but no route matched it.`],
    understood: false,
  };
}
