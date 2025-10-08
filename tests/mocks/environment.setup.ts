// tests/mocks/environment.setup.ts
import { beforeEach, vi } from "vitest";
import {
  installNavigatorMocks,
  _resetNavigatorMocks,
} from "./navigator.mock.js";
import {
  installSpeechRecognitionMock,
  _clearSRInstances,
} from "./speechrecognition.mock.js";

// Install mocks once
installNavigatorMocks();
installSpeechRecognitionMock();

// Reset between tests
beforeEach(() => {
  _resetNavigatorMocks();
  _clearSRInstances();
});
