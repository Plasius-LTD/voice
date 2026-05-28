import {
  applyCommand,
  availableExits,
  createInitialState,
  currentRoom,
  describeRoom,
  rooms,
} from "./voice-mud-game.mjs";

const elements = {
  commandChips: document.querySelector("#commandChips"),
  commandForm: document.querySelector("#commandForm"),
  commandInput: document.querySelector("#commandInput"),
  exitButtons: document.querySelector("#exitButtons"),
  gameLog: document.querySelector("#gameLog"),
  inventoryState: document.querySelector("#inventoryState"),
  micState: document.querySelector("#micState"),
  partialText: document.querySelector("#partialText"),
  recognizerState: document.querySelector("#recognizerState"),
  roomMap: document.querySelector("#roomMap"),
  startVoice: document.querySelector("#startVoice"),
  statusLine: document.querySelector("#statusLine"),
  stopVoice: document.querySelector("#stopVoice"),
  storeState: document.querySelector("#storeState"),
  turnState: document.querySelector("#turnState"),
};

const requiredElements = Object.entries(elements)
  .filter(([, element]) => !element)
  .map(([name]) => name);

if (requiredElements.length > 0) {
  throw new Error(`Voice MUD demo missing elements: ${requiredElements.join(", ")}`);
}

const commandSuggestions = [
  "look",
  "west",
  "take key",
  "east",
  "take lantern",
  "unlock gate",
  "north",
  "light lantern",
  "inventory",
  "restart",
];

let state = createInitialState();
let logEntries = [
  { text: "Rain taps the canvas awnings.", kind: "narration" },
  ...describeRoom(state).map((text) => ({ text, kind: "narration" })),
];
let voiceStore = null;
let recognition = null;
let voiceEnabled = false;
let restartTimer = 0;

const SpeechRecognitionConstructor =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

function createVoiceStoreMirror() {
  const mirrorState = {
    permission: "prompt",
    partial: "",
    transcript: "",
    listening: false,
    wantListening: false,
  };

  return {
    dispatch(action) {
      switch (action.type) {
        case "REQ/START":
          mirrorState.wantListening = true;
          break;
        case "REQ/STOP":
          mirrorState.wantListening = false;
          break;
        case "INT/SET_PERMISSIONS":
          mirrorState.permission = action.payload.permission;
          break;
        case "EVT/START":
          mirrorState.listening = true;
          mirrorState.partial = "";
          break;
        case "EVT/PARTIAL":
          mirrorState.partial = action.payload.text;
          break;
        case "EVT/FINAL":
          mirrorState.transcript = `${mirrorState.transcript} ${action.payload.text}`.trim();
          mirrorState.partial = "";
          break;
        case "EVT/ERROR":
        case "EVT/END":
          mirrorState.listening = false;
          break;
        default:
          break;
      }
    },
    getState() {
      return { ...mirrorState };
    },
  };
}

function storeDispatch(action) {
  if (!voiceStore || typeof voiceStore.dispatch !== "function") {
    return;
  }

  try {
    voiceStore.dispatch(action);
  } catch (error) {
    console.warn("Voice store dispatch failed", error);
  }
}

function loadVoiceStore() {
  const injectedStore = window.plasiusVoiceStore;
  if (injectedStore && typeof injectedStore.dispatch === "function") {
    voiceStore = injectedStore;
    elements.storeState.textContent = "injected";
  } else {
    voiceStore = createVoiceStoreMirror();
    elements.storeState.textContent = "demo mirror";
  }

  storeDispatch({
    type: "INT/SET_CONFIG",
    payload: { lang: "en-GB", interim: true, continuous: false },
  });
}

function setStatus(message, isError = false) {
  elements.statusLine.textContent = message;
  elements.statusLine.classList.toggle("error", isError);
}

function addLog(messages, kind = "narration") {
  const nextEntries = messages.map((text) => ({ text, kind }));
  logEntries = [...logEntries, ...nextEntries].slice(-28);
}

function renderLog() {
  elements.gameLog.replaceChildren(
    ...logEntries.map((entry) => {
      const line = document.createElement("p");
      line.textContent = entry.text;
      if (entry.kind === "command") line.className = "command";
      if (entry.kind === "miss") line.className = "miss";
      return line;
    })
  );
  elements.gameLog.scrollTop = elements.gameLog.scrollHeight;
}

function renderExits() {
  elements.exitButtons.replaceChildren(
    ...availableExits(state).map((exit) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = exit.locked ? `${exit.direction} locked` : exit.direction;
      button.disabled = exit.locked;
      button.addEventListener("click", () => runCommand(exit.direction, "button"));
      return button;
    })
  );
}

function renderChips() {
  elements.commandChips.replaceChildren(
    ...commandSuggestions.map((command) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = command;
      button.addEventListener("click", () => runCommand(command, "chip"));
      return button;
    })
  );
}

function renderMap() {
  const orderedRooms = ["archive", "market", "glasshouse", "gate", "tower"];
  elements.roomMap.replaceChildren(
    ...orderedRooms.map((roomId) => {
      const node = document.createElement("div");
      const room = rooms[roomId];
      node.className = `room-node${state.roomId === roomId ? " current" : ""}`;
      node.textContent = room.name;
      node.setAttribute("aria-current", state.roomId === roomId ? "location" : "false");
      return node;
    })
  );
}

function renderState() {
  const room = currentRoom(state);
  const inventory = state.inventory.length ? state.inventory.join(", ") : "Empty";
  elements.inventoryState.textContent = inventory;
  elements.turnState.textContent = String(state.turns);
  setStatus(`${room.name}${state.finished ? " - complete" : ""}`);
  renderLog();
  renderExits();
  renderMap();
}

function runCommand(command, source) {
  const trimmed = command.trim();
  if (!trimmed) {
    return;
  }

  const result = applyCommand(state, trimmed);
  state = result.state;
  addLog([`> ${trimmed}`], "command");
  addLog(result.messages, result.understood ? "narration" : "miss");
  storeDispatch({ type: "EVT/FINAL", payload: { text: trimmed } });
  elements.partialText.textContent =
    source === "voice" ? `Heard: ${trimmed}` : "No speech yet.";
  elements.commandInput.value = "";
  renderState();
}

function updateVoiceButtons(listening) {
  elements.startVoice.disabled = listening;
  elements.stopVoice.disabled = !listening;
}

function updateRecognizerAvailability() {
  if (SpeechRecognitionConstructor) {
    elements.recognizerState.textContent = "Web Speech";
    return;
  }

  elements.recognizerState.textContent = "text only";
  elements.micState.textContent = "unsupported";
  storeDispatch({
    type: "INT/SET_PERMISSIONS",
    payload: { permission: "unsupported" },
  });
}

function createRecognition() {
  if (!SpeechRecognitionConstructor) {
    return null;
  }

  const recognizer = new SpeechRecognitionConstructor();
  recognizer.lang = "en-GB";
  recognizer.interimResults = true;
  recognizer.continuous = false;
  recognizer.maxAlternatives = 1;

  recognizer.addEventListener("start", () => {
    elements.recognizerState.textContent = "listening";
    elements.micState.textContent = "granted";
    elements.partialText.textContent = "Listening...";
    updateVoiceButtons(true);
    storeDispatch({ type: "EVT/START" });
    storeDispatch({
      type: "INT/SET_PERMISSIONS",
      payload: { permission: "granted" },
    });
  });

  recognizer.addEventListener("result", (event) => {
    let interim = "";
    let finalText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript?.trim() ?? "";
      if (!transcript) continue;
      if (result.isFinal) {
        finalText = `${finalText} ${transcript}`.trim();
      } else {
        interim = `${interim} ${transcript}`.trim();
      }
    }

    if (interim) {
      elements.partialText.textContent = interim;
      storeDispatch({ type: "EVT/PARTIAL", payload: { text: interim } });
    }

    if (finalText) {
      runCommand(finalText, "voice");
    }
  });

  recognizer.addEventListener("error", (event) => {
    const error = event.error || "recognition-error";
    const permissionDenied = error === "not-allowed" || error === "service-not-allowed";
    elements.recognizerState.textContent = "stopped";
    elements.micState.textContent = permissionDenied ? "denied" : "granted";
    elements.partialText.textContent = `Speech error: ${error}`;
    setStatus(`Speech recognition error: ${error}`, true);
    storeDispatch({ type: "EVT/ERROR", payload: { error } });
    if (permissionDenied) {
      voiceEnabled = false;
      storeDispatch({
        type: "INT/SET_PERMISSIONS",
        payload: { permission: "denied" },
      });
    }
  });

  recognizer.addEventListener("end", () => {
    elements.recognizerState.textContent = voiceEnabled ? "restarting" : "stopped";
    updateVoiceButtons(false);
    storeDispatch({ type: "EVT/END" });

    if (!voiceEnabled) {
      return;
    }

    window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(() => {
      try {
        recognizer.start();
      } catch (error) {
        voiceEnabled = false;
        elements.recognizerState.textContent = "stopped";
        setStatus("Speech recognition could not restart.", true);
        storeDispatch({
          type: "EVT/ERROR",
          payload: { error: error instanceof Error ? error.message : "restart failed" },
        });
      }
    }, 250);
  });

  return recognizer;
}

async function requestMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    elements.micState.textContent = "unsupported";
    storeDispatch({
      type: "INT/SET_PERMISSIONS",
      payload: { permission: "unsupported" },
    });
    throw new Error("Browser microphone capture is unavailable.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  elements.micState.textContent = "granted";
  storeDispatch({
    type: "INT/SET_PERMISSIONS",
    payload: { permission: "granted" },
  });
}

async function startVoice() {
  if (!SpeechRecognitionConstructor) {
    setStatus("This browser does not expose Web Speech. Typed commands remain available.", true);
    return;
  }

  try {
    await requestMicrophone();
    recognition = recognition ?? createRecognition();
    voiceEnabled = true;
    storeDispatch({
      type: "REQ/START",
      payload: { lang: "en-GB", interim: true, continuous: false },
    });
    recognition.start();
  } catch (error) {
    voiceEnabled = false;
    updateVoiceButtons(false);
    elements.micState.textContent = "denied";
    setStatus(error instanceof Error ? error.message : "Microphone permission failed.", true);
    storeDispatch({
      type: "EVT/ERROR",
      payload: { error: error instanceof Error ? error.message : "microphone failed" },
    });
    storeDispatch({
      type: "INT/SET_PERMISSIONS",
      payload: { permission: "denied" },
    });
  }
}

function stopVoice() {
  voiceEnabled = false;
  window.clearTimeout(restartTimer);
  storeDispatch({ type: "REQ/STOP" });
  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.warn("Speech recognition stop failed", error);
    }
  }
  elements.recognizerState.textContent = SpeechRecognitionConstructor ? "stopped" : "text only";
  elements.partialText.textContent = "No speech yet.";
  updateVoiceButtons(false);
}

elements.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runCommand(elements.commandInput.value, "typed");
});

elements.startVoice.addEventListener("click", () => {
  void startVoice();
});

elements.stopVoice.addEventListener("click", stopVoice);

loadVoiceStore();
renderChips();
updateRecognizerAvailability();
renderState();
