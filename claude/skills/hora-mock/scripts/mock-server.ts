#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/mock-server.ts [--port 4000] [--delay 0] [--error-rate 0] [--config path]
// Reads routes from .hora/mock-config.json (or scan-api.ts output piped via stdin).
// Starts an HTTP mock server with realistic fake data generation.
// Outputs JSON session info to stdout, request logs to stderr.

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";

// --- Types ---

interface RouteInfo {
  path: string;
  methods: string[];
  file: string;
  hasZodSchema: boolean;
  schemaName: string | null;
  framework: string;
}

interface ScanResult {
  framework: string;
  projectDir: string;
  routes: RouteInfo[];
  totalRoutes: number;
  totalEndpoints: number;
}

interface MockSession {
  pid: number;
  port: number;
  startedAt: string;
  routes: string[];
}

// --- Argument parsing ---

function parseArgs(): { port: number; delay: number; errorRate: number; configPath: string | null } {
  const args = process.argv.slice(2);
  let port = 4000;
  let delay = 0;
  let errorRate = 0;
  let configPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--port":
        port = parseInt(args[++i] ?? "4000", 10);
        break;
      case "--delay":
        delay = parseInt(args[++i] ?? "0", 10);
        break;
      case "--error-rate":
        errorRate = parseFloat(args[++i] ?? "0");
        break;
      case "--config":
        configPath = args[++i] ?? null;
        break;
    }
  }

  return { port, delay, errorRate, configPath };
}

// --- Fake data generation ---

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "dolore",
];

const FIRST_NAMES = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller"];

function lorem(words = 5): string {
  const result: string[] = [];
  for (let i = 0; i < words; i++) {
    result.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
  }
  return result.join(" ");
}

function randomInt(min = 1, max = 1000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function randomEmail(): string {
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)].toLowerCase();
  return `${name}@example.com`;
}

function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomDate(): string {
  const now = Date.now();
  const offset = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
  return new Date(now - offset).toISOString();
}

function generateFakeValue(key: string): unknown {
  const k = key.toLowerCase();
  if (k === "id" || k === "_id" || k.endsWith("id")) return randomId();
  if (k.includes("email")) return randomEmail();
  if (k.includes("name")) return randomName();
  if (k.includes("url") || k.includes("image") || k.includes("avatar")) return `https://example.com/${randomId()}`;
  if (k.includes("date") || k.includes("at") || k.includes("time")) return randomDate();
  if (k.includes("count") || k.includes("total") || k.includes("age") || k.includes("price")) return randomInt(1, 100);
  if (k.includes("enabled") || k.includes("active") || k.includes("verified")) return Math.random() > 0.5;
  if (k.includes("description") || k.includes("bio") || k.includes("content")) return lorem(10);
  if (k.includes("title") || k.includes("label") || k.includes("name")) return lorem(3);
  return lorem(4);
}

function generateMockObject(depth = 0): Record<string, unknown> {
  if (depth > 2) return { value: lorem(2) };
  return {
    id: randomId(),
    name: randomName(),
    email: randomEmail(),
    createdAt: randomDate(),
    updatedAt: randomDate(),
    active: true,
  };
}

function generateMockResponse(route: RouteInfo, method: string): unknown {
  // POST/PUT/PATCH — return the created/updated resource
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return {
      data: generateMockObject(),
      message: method === "POST" ? "Created successfully" : "Updated successfully",
    };
  }

  // DELETE
  if (method === "DELETE") {
    return { message: "Deleted successfully" };
  }

  // GET — list if path ends without dynamic param, single if has :param
  const hasDynamicParam = route.path.includes(":");
  if (hasDynamicParam) {
    return { data: generateMockObject() };
  }

  // List response
  const items = Array.from({ length: 3 }, () => generateMockObject());
  return {
    data: items,
    total: randomInt(3, 50),
    page: 1,
    pageSize: 10,
  };
}

// --- Route matching ---

function buildPathPattern(routePath: string): RegExp {
  // Convert :param and * to regex groups
  const escaped = routePath
    .replace(/[.*+?^${}()|[\]\\]/g, (c) => {
      if (c === "." || c === "*") return c === "*" ? ".*" : "\\.";
      return "\\" + c;
    })
    .replace(/:[\w]+/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

interface MockRoute {
  pattern: RegExp;
  routePath: string;
  methods: string[];
  info: RouteInfo;
}

function buildMockRoutes(routes: RouteInfo[]): MockRoute[] {
  return routes.map((r) => ({
    pattern: buildPathPattern(r.path),
    routePath: r.path,
    methods: r.methods.map((m) => m.toUpperCase()),
    info: r,
  }));
}

function matchRoute(mockRoutes: MockRoute[], urlPath: string): MockRoute | null {
  for (const mock of mockRoutes) {
    if (mock.pattern.test(urlPath)) return mock;
  }
  return null;
}

// --- Load config ---

function loadScanResult(configPath: string | null): ScanResult | null {
  // Try explicit config path first
  if (configPath) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw) as ScanResult;
    } catch {
      process.stderr.write(`Warning: could not read config at ${configPath}\n`);
    }
  }

  // Try default .hora/mock-config.json
  const defaultConfig = path.join(process.cwd(), ".hora", "mock-config.json");
  if (fs.existsSync(defaultConfig)) {
    try {
      const raw = fs.readFileSync(defaultConfig, "utf-8");
      return JSON.parse(raw) as ScanResult;
    } catch {
      process.stderr.write(`Warning: could not parse .hora/mock-config.json\n`);
    }
  }

  return null;
}

// --- HTTP Server ---

function startServer(
  mockRoutes: MockRoute[],
  port: number,
  delay: number,
  errorRate: number
): http.Server {
  const server = http.createServer((req, res) => {
    const startTime = Date.now();
    const method = (req.method ?? "GET").toUpperCase();
    const urlPath = (req.url ?? "/").split("?")[0];

    function respond(): void {
      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      // Preflight
      if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        logRequest(method, urlPath, 204, Date.now() - startTime);
        return;
      }

      // Internal routes
      if (urlPath === "/__hora/routes") {
        const payload = JSON.stringify(
          mockRoutes.map((r) => ({ path: r.routePath, methods: r.methods })),
          null, 2
        );
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(payload);
        logRequest(method, urlPath, 200, Date.now() - startTime);
        return;
      }

      if (urlPath === "/__hora/stop" && method === "POST") {
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end(JSON.stringify({ message: "Shutting down..." }));
        logRequest(method, urlPath, 200, Date.now() - startTime);
        setTimeout(() => {
          cleanup(port);
          process.exit(0);
        }, 100);
        return;
      }

      // Random errors
      if (errorRate > 0 && Math.random() < errorRate) {
        const payload = JSON.stringify({ error: "Internal Server Error", code: "MOCK_ERROR" });
        res.setHeader("Content-Type", "application/json");
        res.writeHead(500);
        res.end(payload);
        logRequest(method, urlPath, 500, Date.now() - startTime);
        return;
      }

      const matched = matchRoute(mockRoutes, urlPath);

      if (!matched) {
        const payload = JSON.stringify({ error: "Not found", code: "NOT_FOUND" });
        res.setHeader("Content-Type", "application/json");
        res.writeHead(404);
        res.end(payload);
        logRequest(method, urlPath, 404, Date.now() - startTime);
        return;
      }

      if (!matched.methods.includes(method)) {
        res.setHeader("Allow", matched.methods.join(", "));
        const payload = JSON.stringify({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" });
        res.setHeader("Content-Type", "application/json");
        res.writeHead(405);
        res.end(payload);
        logRequest(method, urlPath, 405, Date.now() - startTime);
        return;
      }

      const data = generateMockResponse(matched.info, method);
      const statusCode = method === "POST" ? 201 : 200;
      const payload = JSON.stringify(data, null, 2);

      res.setHeader("Content-Type", "application/json");
      res.writeHead(statusCode);
      res.end(payload);
      logRequest(method, urlPath, statusCode, Date.now() - startTime);
    }

    if (delay > 0) {
      setTimeout(respond, delay);
    } else {
      respond();
    }
  });

  server.listen(port, () => {
    process.stderr.write(`\n--- hora-mock server ---\n`);
    process.stderr.write(`Listening on http://localhost:${port}\n`);
    if (delay > 0) process.stderr.write(`Delay: ${delay}ms per request\n`);
    if (errorRate > 0) process.stderr.write(`Error rate: ${Math.round(errorRate * 100)}%\n`);
    process.stderr.write(`Routes mocked: ${mockRoutes.length}\n`);
    process.stderr.write(`Inspect routes: http://localhost:${port}/__hora/routes\n`);
    process.stderr.write(`Stop server:    POST http://localhost:${port}/__hora/stop\n\n`);
  });

  return server;
}

function logRequest(method: string, urlPath: string, status: number, ms: number): void {
  const statusStr = status >= 500 ? `[ERR ${status}]` : status >= 400 ? `[${status}]` : `[${status}]`;
  process.stderr.write(`  ${method.padEnd(7)} ${urlPath.padEnd(40)} ${statusStr} ${ms}ms\n`);
}

function cleanup(port: number): void {
  const sessionFile = path.join("/tmp", "hora-mock-session.json");
  try {
    fs.unlinkSync(sessionFile);
  } catch {
    // already gone
  }
}

function writeSession(port: number, mockRoutes: MockRoute[]): void {
  const session: MockSession = {
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
    routes: mockRoutes.map((r) => r.routePath),
  };

  const sessionFile = path.join("/tmp", "hora-mock-session.json");
  try {
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  } catch {
    // non-critical
  }

  // Also write to stdout for Claude
  process.stdout.write(JSON.stringify(session, null, 2) + "\n");
}

// --- Main ---

function main(): void {
  const { port, delay, errorRate, configPath } = parseArgs();

  const scanResult = loadScanResult(configPath);

  if (!scanResult || scanResult.routes.length === 0) {
    process.stderr.write(
      "No routes found. Run scan-api.ts first and save the output to .hora/mock-config.json:\n" +
      "  npx tsx scan-api.ts . > .hora/mock-config.json\n"
    );

    // Start with a minimal health-check server anyway
    const mockRoutes: MockRoute[] = [];
    const server = startServer(mockRoutes, port, delay, errorRate);
    writeSession(port, mockRoutes);

    process.on("SIGINT", () => {
      cleanup(port);
      server.close(() => process.exit(0));
    });
    return;
  }

  const mockRoutes = buildMockRoutes(scanResult.routes);
  const server = startServer(mockRoutes, port, delay, errorRate);

  writeSession(port, mockRoutes);

  process.on("SIGINT", () => {
    process.stderr.write("\nShutting down hora-mock...\n");
    cleanup(port);
    server.close(() => process.exit(0));
  });
}

main();
