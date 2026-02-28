#!/usr/bin/env npx tsx
// hora-browser server — persistent Playwright session with always-on event capture
// Usage: npx tsx browser-server.ts

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: string;
}

interface NetworkRequestEntry {
  id: string;
  url: string;
  method: string;
  resourceType: string;
  headers: Record<string, string>;
  timestamp: string;
}

interface NetworkResponseEntry {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  timing: number;
  size: number;
  timestamp: string;
}

interface PageErrorEntry {
  type: "uncaughtException" | "unhandledrejection";
  message: string;
  timestamp: string;
}

interface SessionState {
  pid: number;
  port: number;
  startedAt: string;
  currentUrl: string | null;
}

interface ApiSuccess {
  success: true;
  data: unknown;
}

interface ApiError {
  success: false;
  error: string;
}

type ApiResponse = ApiSuccess | ApiError;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.HORA_BROWSER_PORT || "9222", 10);
const HEADLESS = process.env.HORA_BROWSER_HEADLESS !== "false";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const STATE_FILE = path.join(os.tmpdir(), "hora-browser-session.json");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let consoleLogs: ConsoleEntry[] = [];
let networkRequests: NetworkRequestEntry[] = [];
let networkResponses: NetworkResponseEntry[] = [];
let pageErrors: PageErrorEntry[] = [];
let requestTimings = new Map<string, number>();
let currentUrl: string | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

// Playwright instances — initialized in start()
let browser: Awaited<ReturnType<Awaited<ReturnType<typeof import("playwright")>>["chromium"]["launch"]>> | null = null;
let page: Awaited<ReturnType<NonNullable<typeof browser>["newPage"]>> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.error("[hora-browser] Idle timeout reached (30min). Shutting down.");
    shutdown();
  }, IDLE_TIMEOUT_MS);
}

function clearLogs(): void {
  consoleLogs = [];
  networkRequests = [];
  networkResponses = [];
  pageErrors = [];
  requestTimings.clear();
}

function writeStateFile(): void {
  const state: SessionState = {
    pid: process.pid,
    port: PORT,
    startedAt: new Date().toISOString(),
    currentUrl,
  };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // non-critical
  }
}

function removeStateFile(): void {
  try {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  } catch {
    // non-critical
  }
}

function jsonResponse(res: http.ServerResponse, statusCode: number, body: ApiResponse): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function parseJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx));
  const result: Record<string, string> = {};
  params.forEach((v, k) => { result[k] = v; });
  return result;
}

function getPathname(url: string): string {
  const idx = url.indexOf("?");
  return idx === -1 ? url : url.slice(0, idx);
}

// ---------------------------------------------------------------------------
// Event capture setup
// ---------------------------------------------------------------------------

function attachPageListeners(p: NonNullable<typeof page>): void {
  p.on("console", (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString(),
    });
  });

  p.on("pageerror", (err) => {
    pageErrors.push({
      type: "uncaughtException",
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  });

  p.on("request", (req) => {
    const id = `${req.method()}-${req.url()}-${Date.now()}`;
    requestTimings.set(req.url(), Date.now());
    networkRequests.push({
      id,
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      headers: req.headers(),
      timestamp: new Date().toISOString(),
    });
  });

  p.on("response", (resp) => {
    const startTime = requestTimings.get(resp.url());
    const timing = startTime ? Date.now() - startTime : 0;
    networkResponses.push({
      id: `${resp.request().method()}-${resp.url()}-${Date.now()}`,
      url: resp.url(),
      method: resp.request().method(),
      status: resp.status(),
      statusText: resp.statusText(),
      timing,
      size: parseInt(resp.headers()["content-length"] || "0", 10),
      timestamp: new Date().toISOString(),
    });
  });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleHealth(res: http.ServerResponse): Promise<void> {
  jsonResponse(res, 200, {
    success: true,
    data: {
      status: "running",
      pid: process.pid,
      port: PORT,
      headless: HEADLESS,
      currentUrl,
      consoleLogs: consoleLogs.length,
      networkRequests: networkRequests.length,
      networkResponses: networkResponses.length,
      pageErrors: pageErrors.length,
      uptime: process.uptime(),
    },
  });
}

async function handleDiagnostics(res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }

  const screenshotPath = path.join(os.tmpdir(), `hora-diag-${Date.now()}.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch {
    // screenshot failed, continue with other diagnostics
  }

  const errors = consoleLogs.filter((l) => l.type === "error");
  const warnings = consoleLogs.filter((l) => l.type === "warning");
  const failed = networkResponses.filter((r) => r.status >= 400);
  const totalSize = networkResponses.reduce((sum, r) => sum + r.size, 0);
  const avgTiming = networkResponses.length > 0
    ? Math.round(networkResponses.reduce((sum, r) => sum + r.timing, 0) / networkResponses.length)
    : 0;

  jsonResponse(res, 200, {
    success: true,
    data: {
      currentUrl,
      screenshot: fs.existsSync(screenshotPath) ? screenshotPath : null,
      title: await page.title().catch(() => ""),
      console: { errors, warnings, total: consoleLogs.length },
      network: {
        totalRequests: networkResponses.length,
        failed,
        totalSize,
        avgTiming,
      },
      pageErrors,
    },
  });
}

async function handleConsole(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const query = parseQuery(req.url || "");
  let logs = consoleLogs;
  if (query.type) {
    logs = consoleLogs.filter((l) => l.type === query.type);
  }
  jsonResponse(res, 200, { success: true, data: logs });
}

async function handleNetwork(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const query = parseQuery(req.url || "");
  if (query.type === "response") {
    jsonResponse(res, 200, { success: true, data: networkResponses });
  } else if (query.type === "request") {
    jsonResponse(res, 200, { success: true, data: networkRequests });
  } else {
    jsonResponse(res, 200, {
      success: true,
      data: { requests: networkRequests, responses: networkResponses },
    });
  }
}

async function handleNavigate(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  const body = await parseJsonBody(req);
  const url = body.url as string | undefined;
  if (!url) {
    jsonResponse(res, 400, { success: false, error: "Missing 'url' in body" });
    return;
  }
  clearLogs();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1500);
    currentUrl = url;
    writeStateFile();
    const title = await page.title().catch(() => "");
    jsonResponse(res, 200, { success: true, data: { url, title } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleScreenshot(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  const body = await parseJsonBody(req);
  const outputPath = (body.path as string) || path.join(os.tmpdir(), `hora-browse-${Date.now()}.png`);
  const fullPage = body.fullPage !== false;
  try {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: outputPath, fullPage });
    const stats = fs.statSync(outputPath);
    jsonResponse(res, 200, { success: true, data: { path: outputPath, size: stats.size } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleClick(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  const body = await parseJsonBody(req);
  const selector = body.selector as string | undefined;
  if (!selector) {
    jsonResponse(res, 400, { success: false, error: "Missing 'selector' in body" });
    return;
  }
  try {
    await page.click(selector, { timeout: 10_000 });
    jsonResponse(res, 200, { success: true, data: { selector, clicked: true } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleFill(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  const body = await parseJsonBody(req);
  const selector = body.selector as string | undefined;
  const value = body.value as string | undefined;
  if (!selector || value === undefined) {
    jsonResponse(res, 400, { success: false, error: "Missing 'selector' or 'value' in body" });
    return;
  }
  try {
    await page.fill(selector, value, { timeout: 10_000 });
    jsonResponse(res, 200, { success: true, data: { selector, value, filled: true } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleType(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  const body = await parseJsonBody(req);
  const selector = body.selector as string | undefined;
  const text = body.text as string | undefined;
  const delay = typeof body.delay === "number" ? body.delay : 50;
  if (!selector || !text) {
    jsonResponse(res, 400, { success: false, error: "Missing 'selector' or 'text' in body" });
    return;
  }
  try {
    await page.click(selector, { timeout: 10_000 });
    await page.keyboard.type(text, { delay });
    jsonResponse(res, 200, { success: true, data: { selector, text, typed: true } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleEval(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  const body = await parseJsonBody(req);
  const script = body.script as string | undefined;
  if (!script) {
    jsonResponse(res, 400, { success: false, error: "Missing 'script' in body" });
    return;
  }
  try {
    const result = await page.evaluate(script);
    jsonResponse(res, 200, { success: true, data: { result } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleResize(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  const body = await parseJsonBody(req);
  const width = body.width as number | undefined;
  const height = body.height as number | undefined;
  if (!width || !height) {
    jsonResponse(res, 400, { success: false, error: "Missing 'width' or 'height' in body" });
    return;
  }
  try {
    await page.setViewportSize({ width, height });
    jsonResponse(res, 200, { success: true, data: { width, height } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleReload(res: http.ServerResponse): Promise<void> {
  if (!page) {
    jsonResponse(res, 503, { success: false, error: "No page available" });
    return;
  }
  clearLogs();
  try {
    await page.reload({ waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1500);
    jsonResponse(res, 200, { success: true, data: { reloaded: true } });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleStop(res: http.ServerResponse): Promise<void> {
  jsonResponse(res, 200, { success: true, data: { stopped: true } });
  setTimeout(() => shutdown(), 100);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function router(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  resetIdleTimer();
  const pathname = getPathname(req.url || "/");
  const method = (req.method || "GET").toUpperCase();

  try {
    if (pathname === "/health" && method === "GET") return handleHealth(res);
    if (pathname === "/diagnostics" && method === "GET") return handleDiagnostics(res);
    if (pathname === "/console" && method === "GET") return handleConsole(req, res);
    if (pathname === "/network" && method === "GET") return handleNetwork(req, res);
    if (pathname === "/navigate" && method === "POST") return handleNavigate(req, res);
    if (pathname === "/screenshot" && method === "POST") return handleScreenshot(req, res);
    if (pathname === "/click" && method === "POST") return handleClick(req, res);
    if (pathname === "/fill" && method === "POST") return handleFill(req, res);
    if (pathname === "/type" && method === "POST") return handleType(req, res);
    if (pathname === "/eval" && method === "POST") return handleEval(req, res);
    if (pathname === "/resize" && method === "POST") return handleResize(req, res);
    if (pathname === "/reload" && method === "POST") return handleReload(res);
    if (pathname === "/stop" && method === "POST") return handleStop(res);

    jsonResponse(res, 404, { success: false, error: `Unknown endpoint: ${method} ${pathname}` });
  } catch (err) {
    jsonResponse(res, 500, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function shutdown(): Promise<void> {
  console.error("[hora-browser] Shutting down...");
  if (idleTimer) clearTimeout(idleTimer);
  removeStateFile();
  try {
    if (browser) await browser.close();
  } catch {
    // ignore
  }
  process.exit(0);
}

async function start(): Promise<void> {
  // Load Playwright
  let pw: typeof import("playwright");
  try {
    pw = await import("playwright");
  } catch {
    console.error(
      "Playwright is not installed. Install it with:\n\n" +
      "  npm install -D playwright\n" +
      "  npx playwright install chromium\n"
    );
    process.exit(1);
  }

  // Launch browser
  try {
    browser = await pw.chromium.launch({ headless: HEADLESS });
  } catch (err) {
    console.error(
      "Failed to launch Chromium. Make sure it's installed:\n\n" +
      "  npx playwright install chromium\n"
    );
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Create page and attach listeners
  page = await browser.newPage();
  attachPageListeners(page);

  // Start HTTP server
  const server = http.createServer((req, res) => {
    router(req, res).catch((err) => {
      jsonResponse(res, 500, {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[hora-browser] Port ${PORT} already in use. Set HORA_BROWSER_PORT to use another port.`);
      process.exit(1);
    }
    console.error("[hora-browser] Server error:", err.message);
    process.exit(1);
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.error(`[hora-browser] Server listening on http://127.0.0.1:${PORT}`);
    console.error(`[hora-browser] Headless: ${HEADLESS}`);
    console.error(`[hora-browser] PID: ${process.pid}`);
    writeStateFile();
    resetIdleTimer();
  });

  // Cleanup handlers
  process.on("SIGTERM", () => shutdown());
  process.on("SIGINT", () => shutdown());
  process.on("uncaughtException", (err) => {
    console.error("[hora-browser] Uncaught exception:", err.message);
    shutdown();
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[hora-browser] Unhandled rejection:", reason);
  });
}

start();
