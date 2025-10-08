// tests/mocks/stopAndWait.mock.ts
import { vi } from "vitest";

// Mock stopAndWait to be instant-resolving
vi.mock("../../src/utils/stopAndWait.js", async () => {
  const stopAndWait = vi.fn(async (_sr: any) => {
    // Optionally, tests can override behavior using mockImplementationOnce
    return;
  });
  return { stopAndWait };
});

// Re-export the spy for assertions
export const { stopAndWait } = await import("../../src/utils/stopAndWait.js");
