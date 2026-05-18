import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const startPort = Number.parseInt(process.env.PORT || "4173", 10);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl || "/", "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);
  const normalizedPath = pathname === "/" ? "/demo/voice-mud.html" : pathname;
  const filePath = path.resolve(root, `.${normalizedPath}`);

  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) {
    return null;
  }

  return filePath;
}

async function sendFile(response, filePath) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const body = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": "no-store",
    "Permissions-Policy": "microphone=(self)",
  });
  response.end(body);
}

function createMudServer() {
  return createServer((request, response) => {
    const filePath = resolveRequestPath(request.url);
    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    sendFile(response, filePath).catch((error) => {
      const notFound = error && error.code === "ENOENT";
      response.writeHead(notFound ? 404 : 500);
      response.end(notFound ? "Not found" : "Server error");
    });
  });
}

function listen(port, maxPort = port + 25) {
  const server = createMudServer();
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < maxPort) {
      listen(port + 1, maxPort);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/demo/voice-mud.html`;
    console.log(`Voice MUD demo: ${url}`);
    console.log(`Package root: ${pathToFileURL(root).href}`);
  });
}

listen(Number.isFinite(startPort) ? startPort : 4173);
