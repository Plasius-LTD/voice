// tests/mocks/telemetry.mock.ts
import { vi } from "vitest";

// Mock the telemetry module your hook imports
vi.mock("@plasius/nfr", () => {
  return {
    track: vi.fn(),
  };
});

export const { track } = await import("@plasius/nfr");
