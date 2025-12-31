// tests/mocks/environment.setup.ts
import { beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { __clearIntentRegistryForTests } from "../../src/components/useVoiceIntents.js";
import {
  installNavigatorMocks,
  _resetNavigatorMocks,
  _uninstallNavigatorMocks,
} from "./navigator.mock.js";
import {
  installSpeechRecognitionMock,
  _clearSRInstances,
} from "./speechrecognition.mock.js";
import "./stopAndWait.mock.js";
import "./telemetry.mock.js";

// Install mocks once for the whole suite
beforeAll(() => {
  installNavigatorMocks();
  installSpeechRecognitionMock();
});

// Reset mock state between tests (but keep the mocks installed)
beforeEach(() => {
  _resetNavigatorMocks();
  _clearSRInstances();
});

// Ensure all rendered components/hooks are unmounted to avoid jsdom buildup between tests
afterEach(() => {
  cleanup();
  __clearIntentRegistryForTests();
});

// Clean up at the very end if needed
afterAll(() => {
  _uninstallNavigatorMocks();
});
