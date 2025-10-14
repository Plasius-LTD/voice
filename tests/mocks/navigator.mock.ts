// tests/mocks/navigator.mock.ts
import { vi } from "vitest";

type Device = MediaDeviceInfo & {
  kind: "audioinput" | "audiooutput" | "videoinput";
};

type PermissionState = "granted" | "denied" | "prompt";

type DeviceChangeListener = () => void;

export const permissionsQueryMock = vi.fn(async (_: { name: string }) => ({ state: permissionState }));

const deviceListeners = new Set<DeviceChangeListener>();

let devices: Device[] = [];
let permissionState: PermissionState = "granted";
let originalNavigator: Navigator | null = null;

export const enumerateDevicesMock = vi.fn(
  async () => devices as MediaDeviceInfo[]
);
export const getUserMediaMock = vi.fn(
  async (_constraints?: MediaStreamConstraints) => {
    // Minimal fake MediaStream
    const track: MediaStreamTrack = {
      kind: "audio",
      id: "track-1",
      label: "Fake Mic",
      enabled: true,
      muted: false,
      readyState: "live",
      onended: null,
      contentHint: "",
      applyConstraints: vi.fn(),
      clone: vi.fn(),
      getCapabilities: vi.fn(() => ({})),
      getConstraints: vi.fn(() => ({})),
      getSettings: vi.fn(() => ({ deviceId: devices[0]?.deviceId })),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } as unknown as MediaStreamTrack;

    const stream: MediaStream = {
      id: "stream-1",
      active: true,
      getAudioTracks: () => [track],
      getVideoTracks: () => [],
      getTracks: () => [track],
      getTrackById: vi.fn(),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    } as unknown as MediaStream;

    return stream;
  }
);

export function _emitDeviceChange() {
  ((globalThis as any)?.navigator.mediaDevices as any).dispatchEvent?.(
    new Event("devicechange")
  );
  for (const l of Array.from(deviceListeners)) l();
}

export function _setDevices(d: Device[]) {
  devices = d;
}

export function _setPermission(state: PermissionState) {
  permissionState = state;
}

export function _resetNavigatorMocks() {
  devices = [];
  permissionState = "granted";
  deviceListeners.clear();
  enumerateDevicesMock.mockClear();
  getUserMediaMock.mockClear();
  permissionsQueryMock.mockClear();
  // Intentionally do NOT restore globalThis.navigator here.
  // We keep the mock installed across tests for stability; use _uninstallNavigatorMocks() in afterAll if needed.
}

export function _uninstallNavigatorMocks() {
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      get: () => originalNavigator as Navigator,
    });
    originalNavigator = null;
  }
  deviceListeners.clear();
}

export function installNavigatorMocks() {
  const mediaDevices = {
    addEventListener: vi.fn((name: string, cb: DeviceChangeListener) => {
      if (name === "devicechange") deviceListeners.add(cb);
    }),
    removeEventListener: vi.fn((name: string, cb: DeviceChangeListener) => {
      if (name === "devicechange") deviceListeners.delete(cb);
    }),
    get ondevicechange() {
      return null;
    },
    set ondevicechange(cb: DeviceChangeListener | null) {
      if (cb) deviceListeners.add(cb);
    },
    enumerateDevices: enumerateDevicesMock,
    getUserMedia: getUserMediaMock,
  };

  const permissions = {
    query: permissionsQueryMock,
  };

  if (!originalNavigator) {
    originalNavigator = globalThis.navigator as Navigator;
  }

  const merged = Object.create(originalNavigator ?? {});

  // Define/override only the props we need, with getters so they always reflect current state
  Object.defineProperty(merged, "mediaDevices", {
    configurable: true,
    enumerable: true,
    get: () => mediaDevices as any,
  });
  Object.defineProperty(merged, "permissions", {
    configurable: true,
    enumerable: true,
    get: () => permissions as any,
  });
  Object.defineProperty(merged, "language", {
    configurable: true,
    enumerable: true,
    get: () => "en-GB",
  });
  Object.defineProperty(merged, "languages", {
    configurable: true,
    enumerable: true,
    get: () => ["en-GB", "en"],
  });

  // Critical for React/other libs that read userAgent at import time
  Object.defineProperty(merged, "userAgent", {
    configurable: true,
    enumerable: true,
    get: () => "jsdom/vitest",
  });
  Object.defineProperty(merged, "vendor", {
    configurable: true,
    enumerable: true,
    get: () => "",
  });
  Object.defineProperty(merged, "product", {
    configurable: true,
    enumerable: true,
    get: () => "Gecko",
  });
  Object.defineProperty(merged, "appVersion", {
    configurable: true,
    enumerable: true,
    get: () => "5.0 (jsdom)",
  });
  Object.defineProperty(merged, "platform", {
    configurable: true,
    enumerable: true,
    get: () => "MacIntel",
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    get: () => merged as Navigator,
  });
}
