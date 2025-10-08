import { createStore, Store } from "@plasius/react-state";

export type GlobalVoiceState = {
  // Intent vs actual
  wantListening: boolean;
  listening: boolean;

  // Config visible to UI
  lang: string;
  interim: boolean;
  continuous: boolean;

  // User-visible speech output
  partial: string;
  transcript: string;

  // Device & permissions
  muted: boolean;
  deviceId: string | null;
  deviceList: MediaDeviceInfo[];
  permission: "granted" | "denied" | "prompt" | "unsupported";

  // New: app-level input volume (0..1), for downstream UX/mixers
  volume: number;

  // New: Push-To-Talk configuration & runtime
  pttEnabled: boolean; // if true, PTT gating is active
  pttHold: boolean; // if true, hold-to-talk; if false, press toggles on/off
  pttPressed: boolean; // input currently pressed (for hold mode)
  pttActive: boolean; // whether PTT is activating wantListening
  pttSource: "keyboard" | "mouse" | "touch" | null;

  // Last user-visible error
  lastError?: string;
};

export type GlobalVoiceAction =
  // External requests (UI/API)
  | {
      type: "REQ/START";
      payload?: Partial<
        Pick<GlobalVoiceState, "lang" | "interim" | "continuous">
      >;
    }
  | { type: "REQ/STOP" }

  // Internal config changes (does not imply start/stop)
  | {
      type: "INT/SET_CONFIG";
      payload: Pick<GlobalVoiceState, "lang" | "interim" | "continuous">;
    }
  | {
      type: "INT/SET_PERMISSIONS";
      payload: { permission: GlobalVoiceState["permission"] };
    }
  // New: volume
  | { type: "INT/SET_VOLUME"; payload: { volume: number } }
  // New: PTT config
  | {
      type: "INT/SET_PTT_CONFIG";
      payload: Partial<Pick<GlobalVoiceState, "pttEnabled" | "pttHold">>;
    }

  // Engine event mirrors
  | { type: "EVT/START" }
  | { type: "EVT/PARTIAL"; payload: { text: string } }
  | { type: "EVT/FINAL"; payload: { text: string } }
  | { type: "EVT/ERROR"; payload: { error: string } }
  | { type: "EVT/END" }

  // Device/mute
  | { type: "EVT/DEVICE_CHANGED"; payload: { deviceId: string | null } }
  | { type: "EVT/MUTE_CHANGED"; payload: { muted: boolean } }
  | {
      type: "EVT/DEVICE_LIST_CHANGED";
      payload: { deviceList: MediaDeviceInfo[] };
    }

  // New: PTT runtime
  | {
      type: "EVT/PTT_PRESSED";
      payload: { source: "keyboard" | "mouse" | "touch" };
    }
  | {
      type: "EVT/PTT_RELEASED";
      payload: { source: "keyboard" | "mouse" | "touch" };
    }
  | {
      type: "EVT/PTT_TOGGLE";
      payload: { source: "keyboard" | "mouse" | "touch" };
    };

const clamp01 = (n: number) => (isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export const createGlobalVoiceStore = (
  initial?: Partial<GlobalVoiceState>
): Store<GlobalVoiceState, GlobalVoiceAction> => {
  const reducer = (
    state: GlobalVoiceState,
    action: GlobalVoiceAction
  ): GlobalVoiceState => {
    switch (action.type) {
      case "INT/SET_CONFIG":
        return { ...state, ...action.payload };

      case "INT/SET_PERMISSIONS":
        return { ...state, permission: action.payload.permission };

      case "INT/SET_VOLUME":
        return { ...state, volume: clamp01(action.payload.volume) };

      case "INT/SET_PTT_CONFIG": {
        const next = { ...state };
        if (typeof action.payload.pttEnabled === "boolean")
          next.pttEnabled = !!action.payload.pttEnabled;
        if (typeof action.payload.pttHold === "boolean")
          next.pttHold = !!action.payload.pttHold;
        return next;
      }

      case "REQ/START": {
        const next = { ...state, wantListening: true, lastError: undefined };
        if (action.payload?.lang) next.lang = action.payload.lang;
        if (typeof action.payload?.interim === "boolean")
          next.interim = !!action.payload.interim;
        if (typeof action.payload?.continuous === "boolean")
          next.continuous = !!action.payload.continuous;
        return next;
      }

      case "REQ/STOP":
        return { ...state, wantListening: false };

      case "EVT/START":
        return { ...state, listening: true, partial: "" };

      case "EVT/PARTIAL":
        return { ...state, partial: action.payload.text };

      case "EVT/FINAL": {
        const t = action.payload.text.trim();
        const nextTx = ((state.transcript ? state.transcript + " " : "") + t)
          .replace(/\s+/g, " ")
          .trim();
        return { ...state, transcript: nextTx, partial: "" };
      }

      case "EVT/ERROR":
        return { ...state, lastError: action.payload.error, listening: false };

      case "EVT/END":
        return { ...state, listening: false };

      case "EVT/DEVICE_CHANGED":
        return { ...state, deviceId: action.payload.deviceId };

      case "EVT/MUTE_CHANGED":
        return { ...state, muted: action.payload.muted };

      case "EVT/DEVICE_LIST_CHANGED":
        return { ...state, deviceList: action.payload.deviceList };

      // PTT runtime: hold logic and toggle behavior
      case "EVT/PTT_PRESSED":
        return {
          ...state,
          pttPressed: true,
          pttSource: action.payload.source,
          pttActive: state.pttHold ? true : state.pttActive,
        };

      case "EVT/PTT_RELEASED":
        return {
          ...state,
          pttPressed: false,
          pttSource: action.payload.source,
          pttActive: state.pttHold ? false : state.pttActive,
        };

      case "EVT/PTT_TOGGLE":
        return {
          ...state,
          pttActive: !state.pttActive,
          pttSource: action.payload.source,
        };

      default:
        return state;
    }
  };

  const defaults: GlobalVoiceState = {
    wantListening: false,
    listening: false,
    lang:
      typeof globalThis?.navigator?.language === "string"
        ? globalThis.navigator.language
        : "en-GB",
    interim: false,
    continuous: false,
    partial: "",
    transcript: "",
    muted: false,
    deviceId: null,
    deviceList: [],
    permission:
      typeof (globalThis as any)?.SpeechRecognition !== "undefined" ||
      typeof (globalThis as any)?.webkitSpeechRecognition !== "undefined"
        ? "prompt"
        : "unsupported",
    volume: 1.0,
    pttEnabled: false,
    pttHold: true,
    pttPressed: false,
    pttActive: false,
    pttSource: null,
    lastError: undefined,
  };

  return createStore<GlobalVoiceState, GlobalVoiceAction>(reducer, {
    ...defaults,
    ...initial,
  });
};

export const globalVoiceStore = createGlobalVoiceStore();
export type GlobalVoiceStore = Store<GlobalVoiceState, GlobalVoiceAction>;
