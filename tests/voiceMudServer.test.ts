import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import {
  createMudServer,
  resolveRequestPath,
} from "../demo/serve-mud.mjs";

function listen(server: ReturnType<typeof createMudServer>) {
  return new Promise<AddressInfo>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address() as AddressInfo);
    });
  });
}

function close(server: ReturnType<typeof createMudServer>) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("voice MUD demo server", () => {
  it("resolves demo files while rejecting traversal and malformed paths", () => {
    expect(resolveRequestPath("/")).toMatch(/demo[/\\]voice-mud\.html$/);
    expect(resolveRequestPath("/demo/voice-mud.js")).toMatch(/demo[/\\]voice-mud\.js$/);
    expect(resolveRequestPath("/%E0%A4%A")).toBeNull();
  });

  it("serves the demo root and returns safe errors", async () => {
    const server = createMudServer();
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const root = await fetch(`${baseUrl}/`);
      const missing = await fetch(`${baseUrl}/missing.js`);
      const forbidden = await fetch(`${baseUrl}/%E0%A4%A`);

      expect(root.status).toBe(200);
      expect(root.headers.get("content-type")).toContain("text/html");
      expect(root.headers.get("permissions-policy")).toBe("microphone=(self)");
      expect(await root.text()).toContain("Voice MUD");
      expect(missing.status).toBe(404);
      expect(await missing.text()).toBe("Not found");
      expect(forbidden.status).toBe(403);
      expect(await forbidden.text()).toBe("Forbidden");
    } finally {
      await close(server);
    }
  });
});
