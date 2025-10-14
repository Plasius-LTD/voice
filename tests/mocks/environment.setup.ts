// tests/mocks/environment.setup.ts
import { beforeAll, beforeEach, afterAll } from "vitest";
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

// Clean up at the very end if needed
afterAll(() => {
  _uninstallNavigatorMocks();
});
