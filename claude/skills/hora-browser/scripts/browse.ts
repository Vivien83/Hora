#!/usr/bin/env npx tsx
// hora-browser CLI — unified entry point for all browser commands
// Usage: npx tsx browse.ts <command> [args...]

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface DiagnosticsData {
  currentUrl: string | null;
  screenshot: string | null;
  title: string;
  console: {
    errors: Array<{ type: string; text: string; timestamp: string }>;
    warnings: Array<{ type: string; text: string; timestamp: string }>;
    total: number;
  };
  network: {
    totalRequests: number;
    failed: Array<{ url: string; method: string; status: number; statusText: string }>;
    totalSize: number;
    avgTiming: number;
  };
  pageErrors: Array<{ type: string; message: string; timestamp: string }>;
}

interface HealthData {
  status: string;
  pid: number;
  port: number;
  headless: boolean;
  currentUrl: string | null;
  consoleLogs: number;
  networkRequests: number;
  networkResponses: number;
  pageErrors: number;
  uptime: number;
}

interface SessionState {
  pid: number;
  port: number;
  startedAt: string;
  currentUrl: string | null;
}

interface Viewport {
  name: string;
  width: number;
  height: number;
}

interface LinkResult {
  url: string;
  status: number | null;
  statusText: string;
  type: "internal" | "external";
  redirectChain: string[];
  error: string | null;
}

interface CrawlReport {
  baseUrl: string;
  crawledAt: string;
  depth: number;
  timeout: number;
  totalLinks: number;
  valid: number;
  redirected: number;
  broken: number;
  timedOut: number;
  errored: number;
  links: LinkResult[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.HORA_BROWSER_PORT || "9222", 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const STATE_FILE = path.join(os.tmpdir(), "hora-browser-session.json");
const SERVER_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "browser-server.ts");

const VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1536, height: 864 },
];

// ---------------------------------------------------------------------------
// HTTP client helpers
// ---------------------------------------------------------------------------

function httpRequest(
  method: "GET" | "POST",
  urlPath: string,
  body?: Record<string, unknown>
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const postData = body ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      },
      timeout: 60_000,
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        try {
          resolve(JSON.parse(raw) as ApiResult);
        } catch {
          resolve({ success: false, error: `Invalid JSON: ${raw.slice(0, 200)}` });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

async function serverGet(urlPath: string): Promise<ApiResult> {
  return httpRequest("GET", urlPath);
}

async function serverPost(urlPath: string, body?: Record<string, unknown>): Promise<ApiResult> {
  return httpRequest("POST", urlPath, body);
}

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------

async function isServerRunning(): Promise<boolean> {
  try {
    const result = await serverGet("/health");
    return result.success === true;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<boolean> {
  if (await isServerRunning()) {
    progress.info("Server already running");
    return false; // was already running, no startup needed
  }

  progress.info("Launching Playwright server...");

  // Check for stale state file
  if (fs.existsSync(STATE_FILE)) {
    try {
      fs.unlinkSync(STATE_FILE);
    } catch {
      // ignore
    }
  }

  // Use tsx directly if available, fallback to npx tsx
  const tsxPath = (() => {
    try {
      return execSync("which tsx", { encoding: "utf-8" }).trim();
    } catch {
      return "npx";
    }
  })();
  const tsxArgs = tsxPath.endsWith("tsx") ? [SERVER_SCRIPT] : ["tsx", SERVER_SCRIPT];

  // Spawn with stderr piped for debugging, stdout ignored
  const logFile = path.join(os.tmpdir(), "hora-browser-server.log");
  const logFd = fs.openSync(logFile, "w");

  const child = spawn(tsxPath, tsxArgs, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      HORA_BROWSER_PORT: String(PORT),
    },
  });

  child.unref();
  fs.closeSync(logFd);

  // Wait for server to be ready (retry with backoff)
  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(500);
    if (await isServerRunning()) {
      progress.info(`Server ready on port ${PORT}`);
      return true; // started fresh
    }
  }

  progress.fail("Server failed to start within timeout");
  console.error("Try starting manually: npx tsx browser-server.ts");
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Progress tracking — step-by-step visibility in Claude Code terminal
// ---------------------------------------------------------------------------

class Progress {
  private step = 0;
  private total = 0;

  start(command: string, totalSteps: number): void {
    this.total = totalSteps;
    this.step = 0;
    console.error(`\n[hora-browser] -- ${command} --`);
  }

  next(label: string): void {
    this.step++;
    console.error(`  [${this.step}/${this.total}] ${label}...`);
  }

  done(label: string): void {
    console.error(`  [${this.step}/${this.total}] ${label} OK`);
  }

  info(message: string): void {
    console.error(`  > ${message}`);
  }

  warn(message: string): void {
    console.error(`  > WARN: ${message}`);
  }

  fail(message: string): void {
    console.error(`  > FAIL: ${message}`);
  }

  finish(summary: string): void {
    console.error(`[hora-browser] -- ${summary} --\n`);
  }
}

const progress = new Progress();

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function validateUrl(input: string): string {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }
    return url.href;
  } catch {
    if (!input.includes("://")) {
      return validateUrl(`https://${input}`);
    }
    throw new Error(`Invalid URL: ${input}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)}${units[i]}`;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
}

function getDateDir(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---------------------------------------------------------------------------
// Command: navigate (default when URL is provided)
// ---------------------------------------------------------------------------

async function cmdNavigate(url: string): Promise<void> {
  progress.start("navigate", 5);
  const validUrl = validateUrl(url);

  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Navigate to URL");
  const navResult = await serverPost("/navigate", { url: validUrl });
  if (!navResult.success) {
    progress.fail(navResult.error || "Navigation failed");
    process.exit(1);
  }
  progress.done(`Navigate to ${validUrl}`);

  progress.next("Wait for page render");
  await sleep(2000);
  progress.done("Page render complete");

  progress.next("Collect diagnostics");
  const diag = await serverGet("/diagnostics");
  if (!diag.success) {
    progress.fail(diag.error || "Diagnostics failed");
    process.exit(1);
  }
  const d = diag.data as DiagnosticsData;
  progress.done("Diagnostics collected");

  progress.next("Analyze results");

  // Report findings via progress (stderr) for Claude Code visibility
  if (d.screenshot) {
    progress.info(`Screenshot: ${d.screenshot}`);
  }
  if (d.pageErrors.length > 0) {
    progress.warn(`${d.pageErrors.length} page error(s)`);
  }
  if (d.console.errors.length > 0) {
    progress.warn(`${d.console.errors.length} console error(s)`);
  }
  if (d.console.warnings.length > 0) {
    progress.info(`${d.console.warnings.length} console warning(s)`);
  }
  if (d.network.failed.length > 0) {
    progress.warn(`${d.network.failed.length} failed request(s)`);
  }
  progress.info(`Network: ${d.network.totalRequests} requests | ${formatBytes(d.network.totalSize)} | avg ${d.network.avgTiming}ms`);
  if (d.title) {
    progress.info(`Page: "${d.title}"`);
  }

  const errorCount = d.pageErrors.length + d.console.errors.length + d.network.failed.length;
  progress.done(`Analysis complete (${errorCount} issue(s))`);

  progress.finish(errorCount === 0
    ? `OK -- ${validUrl}`
    : `${errorCount} issue(s) found -- ${validUrl}`);

  // Structured output on stdout
  if (d.pageErrors.length > 0) {
    console.log(`\nPage Errors (${d.pageErrors.length}):`);
    for (const e of d.pageErrors) {
      console.log(`   * [${e.type}] ${e.message}`);
    }
  }

  if (d.console.errors.length > 0) {
    console.log(`\nConsole Errors (${d.console.errors.length}):`);
    for (const e of d.console.errors) {
      console.log(`   * ${e.text}`);
    }
  }

  if (d.console.warnings.length > 0) {
    console.log(`\nConsole Warnings (${d.console.warnings.length}):`);
    for (const w of d.console.warnings) {
      console.log(`   * ${w.text}`);
    }
  }

  if (d.network.failed.length > 0) {
    console.log(`\nFailed Requests (${d.network.failed.length}):`);
    for (const f of d.network.failed) {
      console.log(`   * ${f.method} ${f.url} -> ${f.status} ${f.statusText}`);
    }
  }

  console.log(
    `\nNetwork: ${d.network.totalRequests} requests | ${formatBytes(d.network.totalSize)} | avg ${d.network.avgTiming}ms`
  );

  if (d.title) {
    console.log(`Page: "${d.title}" loaded successfully`);
  }

  console.log(JSON.stringify(d, null, 2));
}

// ---------------------------------------------------------------------------
// Command: errors
// ---------------------------------------------------------------------------

async function cmdErrors(): Promise<void> {
  progress.start("errors", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Fetch console errors");
  const result = await serverGet("/console?type=error");
  if (!result.success) {
    progress.fail(result.error || "Failed to fetch errors");
    process.exit(1);
  }
  const entries = result.data as Array<{ type: string; text: string; timestamp: string }>;
  progress.done(`Found ${entries.length} error(s)`);
  progress.finish(`${entries.length} console error(s)`);

  if (entries.length === 0) {
    console.log("No console errors.");
    return;
  }
  console.log(`Console Errors (${entries.length}):`);
  for (const e of entries) {
    console.log(`  [${e.timestamp}] ${e.text}`);
  }
}

// ---------------------------------------------------------------------------
// Command: warnings
// ---------------------------------------------------------------------------

async function cmdWarnings(): Promise<void> {
  progress.start("warnings", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Fetch console warnings");
  const result = await serverGet("/console?type=warning");
  if (!result.success) {
    progress.fail(result.error || "Failed to fetch warnings");
    process.exit(1);
  }
  const entries = result.data as Array<{ type: string; text: string; timestamp: string }>;
  progress.done(`Found ${entries.length} warning(s)`);
  progress.finish(`${entries.length} console warning(s)`);

  if (entries.length === 0) {
    console.log("No console warnings.");
    return;
  }
  console.log(`Console Warnings (${entries.length}):`);
  for (const e of entries) {
    console.log(`  [${e.timestamp}] ${e.text}`);
  }
}

// ---------------------------------------------------------------------------
// Command: console
// ---------------------------------------------------------------------------

async function cmdConsole(): Promise<void> {
  progress.start("console", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Fetch console output");
  const result = await serverGet("/console");
  if (!result.success) {
    progress.fail(result.error || "Failed to fetch console");
    process.exit(1);
  }
  const entries = result.data as Array<{ type: string; text: string; timestamp: string }>;
  progress.done(`Found ${entries.length} entry(ies)`);
  progress.finish(`${entries.length} console entry(ies)`);

  if (entries.length === 0) {
    console.log("No console output.");
    return;
  }
  console.log(`Console Output (${entries.length}):`);
  for (const e of entries) {
    const prefix = e.type === "error" ? "[ERR]" : e.type === "warning" ? "[WRN]" : `[${e.type.toUpperCase().slice(0, 3)}]`;
    console.log(`  ${prefix} [${e.timestamp}] ${e.text}`);
  }
}

// ---------------------------------------------------------------------------
// Command: network
// ---------------------------------------------------------------------------

async function cmdNetwork(): Promise<void> {
  progress.start("network", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Fetch network activity");
  const result = await serverGet("/network?type=response");
  if (!result.success) {
    progress.fail(result.error || "Failed to fetch network data");
    process.exit(1);
  }
  const entries = result.data as Array<{
    url: string; method: string; status: number; statusText: string; timing: number; size: number;
  }>;
  const failed = entries.filter((e) => e.status >= 400).length;
  progress.done(`${entries.length} response(s), ${failed} failed`);
  progress.finish(`${entries.length} network response(s)`);

  if (entries.length === 0) {
    console.log("No network activity.");
    return;
  }
  console.log(`Network Responses (${entries.length}):`);
  for (const e of entries) {
    const statusIcon = e.status >= 400 ? "[FAIL]" : e.status >= 300 ? "[RDIR]" : "[OK]  ";
    console.log(`  ${statusIcon} ${e.status} ${e.method} ${e.url} (${e.timing}ms, ${formatBytes(e.size)})`);
  }
}

// ---------------------------------------------------------------------------
// Command: failed
// ---------------------------------------------------------------------------

async function cmdFailed(): Promise<void> {
  progress.start("failed", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Fetch failed requests");
  const result = await serverGet("/network?type=response");
  if (!result.success) {
    progress.fail(result.error || "Failed to fetch network data");
    process.exit(1);
  }
  const all = result.data as Array<{
    url: string; method: string; status: number; statusText: string; timing: number;
  }>;
  const failed = all.filter((r) => r.status >= 400);
  progress.done(`${failed.length} failed request(s) out of ${all.length}`);
  progress.finish(`${failed.length} failed request(s)`);

  if (failed.length === 0) {
    console.log("No failed requests.");
    return;
  }
  console.log(`Failed Requests (${failed.length}):`);
  for (const f of failed) {
    console.log(`  ${f.method} ${f.url} -> ${f.status} ${f.statusText}`);
  }
}

// ---------------------------------------------------------------------------
// Command: screenshot
// ---------------------------------------------------------------------------

async function cmdScreenshot(outputPath?: string): Promise<void> {
  progress.start("screenshot", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Capture screenshot");
  const screenshotPath = outputPath || path.join(os.tmpdir(), `hora-browse-${Date.now()}.png`);
  const result = await serverPost("/screenshot", { path: screenshotPath });
  if (!result.success) {
    progress.fail(result.error || "Screenshot failed");
    process.exit(1);
  }
  const data = result.data as { path: string; size: number };
  progress.done(`Saved ${formatBytes(data.size)}`);
  progress.finish(`Screenshot: ${data.path}`);

  console.log(`Screenshot saved: ${data.path} (${formatBytes(data.size)})`);
}

// ---------------------------------------------------------------------------
// Command: click
// ---------------------------------------------------------------------------

async function cmdClick(selector: string): Promise<void> {
  progress.start("click", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next(`Click "${selector}"`);
  const result = await serverPost("/click", { selector });
  if (!result.success) {
    progress.fail(result.error || "Click failed");
    process.exit(1);
  }
  progress.done(`Clicked "${selector}"`);
  progress.finish("Click complete");

  console.log(`Clicked: ${selector}`);
}

// ---------------------------------------------------------------------------
// Command: fill
// ---------------------------------------------------------------------------

async function cmdFill(selector: string, value: string): Promise<void> {
  progress.start("fill", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next(`Fill "${selector}"`);
  const result = await serverPost("/fill", { selector, value });
  if (!result.success) {
    progress.fail(result.error || "Fill failed");
    process.exit(1);
  }
  progress.done(`Filled "${selector}"`);
  progress.finish("Fill complete");

  console.log(`Filled: ${selector} = "${value}"`);
}

// ---------------------------------------------------------------------------
// Command: eval
// ---------------------------------------------------------------------------

async function cmdEval(script: string): Promise<void> {
  progress.start("eval", 2);
  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Execute JavaScript");
  const result = await serverPost("/eval", { script });
  if (!result.success) {
    progress.fail(result.error || "Eval failed");
    process.exit(1);
  }
  progress.done("JavaScript executed");
  progress.finish("Eval complete");

  const data = result.data as { result: unknown };
  console.log(JSON.stringify(data.result, null, 2));
}

// ---------------------------------------------------------------------------
// Command: capture (multi-viewport screenshots)
// ---------------------------------------------------------------------------

async function cmdCapture(url: string): Promise<void> {
  const totalSteps = 3 + VIEWPORTS.length; // server + navigate + viewports + restore
  progress.start("capture", totalSteps);
  const validUrl = validateUrl(url);

  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Navigate to URL");
  const navResult = await serverPost("/navigate", { url: validUrl });
  if (!navResult.success) {
    progress.fail(navResult.error || "Navigation failed");
    process.exit(1);
  }
  await sleep(1500);
  progress.done(`Navigated to ${validUrl}`);

  const baseDir = path.join(process.cwd(), ".hora", "screenshots", getDateDir());
  fs.mkdirSync(baseDir, { recursive: true });
  const timestamp = getTimestamp();

  const results: Array<{ viewport: string; width: number; height: number; path: string; size: number }> = [];

  for (const vp of VIEWPORTS) {
    progress.next(`Capture ${vp.name} (${vp.width}x${vp.height})`);

    const resizeResult = await serverPost("/resize", { width: vp.width, height: vp.height });
    if (!resizeResult.success) {
      progress.warn(`Failed to resize to ${vp.name}: ${resizeResult.error}`);
      continue;
    }
    await sleep(500);

    const filePath = path.join(baseDir, `${timestamp}_${vp.name}.png`);
    const ssResult = await serverPost("/screenshot", { path: filePath, fullPage: true });
    if (!ssResult.success) {
      progress.warn(`Failed to capture ${vp.name}: ${ssResult.error}`);
      continue;
    }
    const data = ssResult.data as { path: string; size: number };
    results.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      path: data.path,
      size: data.size,
    });
    progress.done(`${vp.name} captured (${formatBytes(data.size)})`);
  }

  progress.next("Restore desktop viewport");
  await serverPost("/resize", { width: 1280, height: 800 });
  progress.done("Viewport restored to 1280x800");

  if (results.length === 0) {
    progress.fail("No screenshots were captured successfully");
    process.exit(1);
  }

  progress.finish(`${results.length}/${VIEWPORTS.length} viewports captured`);

  const output = {
    url: validUrl,
    timestamp,
    outputDir: baseDir,
    screenshots: results,
  };

  console.log(JSON.stringify(output, null, 2));
}

// ---------------------------------------------------------------------------
// Command: diff (visual diff with pixelmatch)
// ---------------------------------------------------------------------------

async function cmdDiff(image1Path: string, image2Path: string): Promise<void> {
  progress.start("visual diff", 4);

  progress.next("Load dependencies");
  let pixelmatch: (
    img1: Buffer | Uint8Array,
    img2: Buffer | Uint8Array,
    output: Buffer | Uint8Array,
    width: number,
    height: number,
    options?: { threshold?: number }
  ) => number;
  let PNG: typeof import("pngjs").PNG;

  try {
    const pm = await import("pixelmatch");
    pixelmatch = (pm.default ?? pm) as typeof pixelmatch;
  } catch {
    console.error(
      "pixelmatch is not installed. Install it with:\n\n  npm install -D pixelmatch\n"
    );
    process.exit(1);
  }

  try {
    const pngjs = await import("pngjs");
    PNG = pngjs.PNG;
  } catch {
    console.error(
      "pngjs is not installed. Install it with:\n\n  npm install -D pngjs\n"
    );
    process.exit(1);
  }

  function readPng(filepath: string): Promise<InstanceType<typeof PNG>> {
    return new Promise((resolve, reject) => {
      const absolutePath = path.resolve(filepath);
      if (!fs.existsSync(absolutePath)) {
        reject(new Error(`File not found: ${absolutePath}`));
        return;
      }
      const stream = fs.createReadStream(absolutePath).pipe(new PNG());
      stream.on("parsed", function (this: InstanceType<typeof PNG>) {
        resolve(this);
      });
      stream.on("error", (err: Error) => {
        reject(new Error(`Failed to parse PNG ${absolutePath}: ${err.message}`));
      });
    });
  }

  function writePng(filepath: string, png: InstanceType<typeof PNG>): Promise<void> {
    return new Promise((resolve, reject) => {
      const absolutePath = path.resolve(filepath);
      const dir = path.dirname(absolutePath);
      fs.mkdirSync(dir, { recursive: true });
      const stream = png.pack().pipe(fs.createWriteStream(absolutePath));
      stream.on("finish", resolve);
      stream.on("error", (err: Error) => {
        reject(new Error(`Failed to write PNG ${absolutePath}: ${err.message}`));
      });
    });
  }

  progress.done("Dependencies loaded");

  progress.next("Read images");
  const [img1, img2] = await Promise.all([
    readPng(image1Path),
    readPng(image2Path),
  ]);

  if (img1.width !== img2.width || img1.height !== img2.height) {
    console.error(
      `Image dimensions do not match:\n` +
      `  ${image1Path}: ${img1.width}x${img1.height}\n` +
      `  ${image2Path}: ${img2.width}x${img2.height}\n\n` +
      `Both images must have the same dimensions for pixel comparison.`
    );
    process.exit(1);
  }

  progress.done(`Images loaded (${img1.width}x${img1.height})`);

  progress.next("Compare pixels");
  const { width, height } = img1;
  const diff = new PNG({ width, height });
  const threshold = 0.1;

  const differentPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
    { threshold }
  );

  const totalPixels = width * height;
  const percentDifferent = totalPixels > 0
    ? Math.round((differentPixels / totalPixels) * 10000) / 100
    : 0;

  progress.done(`${percentDifferent}% different (${differentPixels} pixels)`);

  progress.next("Save diff image");
  const outputPath = path.join(os.tmpdir(), `hora-diff-${Date.now()}.png`);
  await writePng(outputPath, diff);
  progress.done(`Diff saved: ${outputPath}`);
  progress.finish(percentDifferent === 0
    ? "Images are identical"
    : `${percentDifferent}% different`);

  const result = {
    image1: path.resolve(image1Path),
    image2: path.resolve(image2Path),
    output: path.resolve(outputPath),
    width,
    height,
    totalPixels,
    differentPixels,
    percentDifferent,
    threshold,
  };

  console.log(`Visual diff: ${percentDifferent}% different (${differentPixels}/${totalPixels} pixels)`);
  console.log(`Diff image: ${outputPath}`);
  console.log(JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// Command: a11y (accessibility audit with axe-core)
// ---------------------------------------------------------------------------

async function cmdA11y(url: string): Promise<void> {
  progress.start("a11y audit", 5);
  const validUrl = validateUrl(url);

  progress.next("Ensure server");
  await ensureServer();
  progress.done("Ensure server");

  progress.next("Navigate to URL");
  const navResult = await serverPost("/navigate", { url: validUrl });
  if (!navResult.success) {
    progress.fail(navResult.error || "Navigation failed");
    process.exit(1);
  }
  await sleep(2000);
  progress.done(`Navigated to ${validUrl}`);

  progress.next("Inject axe-core");
  // Inject axe-core via CDN
  const AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js";
  const injectScript = `
    (async () => {
      if (typeof window.axe === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '${AXE_CDN}';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      return typeof window.axe !== 'undefined';
    })()
  `;

  const injectResult = await serverPost("/eval", { script: injectScript });
  if (!injectResult.success) {
    progress.fail(`Failed to inject axe-core: ${injectResult.error}`);
    console.error("The page might be offline or blocking external scripts.");
    process.exit(1);
  }

  const injectData = injectResult.data as { result: boolean };
  if (!injectData.result) {
    progress.fail("axe-core failed to load");
    process.exit(1);
  }
  progress.done("axe-core injected");

  progress.next("Run accessibility audit");
  // Run axe
  const runScript = `
    (async () => {
      const results = await window.axe.run(document);
      return {
        violations: results.violations,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length,
        version: window.axe.version || 'unknown'
      };
    })()
  `;

  const axeResult = await serverPost("/eval", { script: runScript });
  if (!axeResult.success) {
    progress.fail(`axe.run() failed: ${axeResult.error}`);
    process.exit(1);
  }
  progress.done("Audit complete");

  const axeData = (axeResult.data as { result: {
    violations: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{ html: string; target: string[]; failureSummary: string }>;
    }>;
    passes: number;
    incomplete: number;
    inapplicable: number;
    version: string;
  } }).result;

  const countByImpact = (impact: string) =>
    axeData.violations.filter((v) => v.impact === impact).length;

  progress.next("Analyze results");
  const totalViolations = axeData.violations.length;
  const criticalCount = countByImpact("critical");
  const seriousCount = countByImpact("serious");
  if (criticalCount > 0) progress.warn(`${criticalCount} CRITICAL violation(s)`);
  if (seriousCount > 0) progress.warn(`${seriousCount} SERIOUS violation(s)`);
  progress.done(`${totalViolations} violation(s), ${axeData.passes} passes`);
  progress.finish(totalViolations === 0
    ? `A11y OK -- ${validUrl}`
    : `${totalViolations} violation(s) -- ${validUrl}`);

  // Format output
  console.log(`\nA11Y AUDIT -- ${validUrl}`);
  console.log(`axe-core: ${axeData.version}`);
  console.log("-".repeat(60));
  console.log(`  Violations: ${axeData.violations.length}`);
  console.log(`    Critical: ${countByImpact("critical")}`);
  console.log(`    Serious:  ${countByImpact("serious")}`);
  console.log(`    Moderate: ${countByImpact("moderate")}`);
  console.log(`    Minor:    ${countByImpact("minor")}`);
  console.log(`  Passes:     ${axeData.passes}`);
  console.log(`  Incomplete: ${axeData.incomplete}`);

  if (axeData.violations.length > 0) {
    const impactOrder = ["critical", "serious", "moderate", "minor"];
    for (const impact of impactOrder) {
      const violations = axeData.violations.filter((v) => v.impact === impact);
      if (violations.length === 0) continue;

      console.log(`\n${"=".repeat(60)}`);
      console.log(`[${impact.toUpperCase()}] -- ${violations.length} violation(s)`);
      console.log("=".repeat(60));

      for (const v of violations) {
        console.log(`\n  ${v.id}: ${v.help}`);
        console.log(`  ${v.description}`);
        console.log(`  More info: ${v.helpUrl}`);

        const nodes = v.nodes.slice(0, 3);
        for (const node of nodes) {
          const target = node.target.join(", ");
          const html = node.html.length > 120 ? node.html.slice(0, 120) + "..." : node.html;
          console.log(`    Element: ${target}`);
          console.log(`    HTML: ${html}`);
          if (node.failureSummary) {
            const lines = node.failureSummary.split("\n").slice(0, 3);
            for (const line of lines) {
              console.log(`      ${line.trim()}`);
            }
          }
        }

        if (v.nodes.length > 3) {
          console.log(`    ... and ${v.nodes.length - 3} more element(s)`);
        }
      }
    }
  }

  // Save report
  const reportDir = path.join(process.cwd(), ".hora", "screenshots", getDateDir());
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${getTimestamp()}_a11y.json`);
  const report = {
    url: validUrl,
    auditedAt: new Date().toISOString(),
    axeVersion: axeData.version,
    summary: {
      totalViolations: axeData.violations.length,
      critical: countByImpact("critical"),
      serious: countByImpact("serious"),
      moderate: countByImpact("moderate"),
      minor: countByImpact("minor"),
      passes: axeData.passes,
      incomplete: axeData.incomplete,
    },
    violations: axeData.violations,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\nReport saved: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));
}

// ---------------------------------------------------------------------------
// Command: links (link checker — uses native fetch, no server needed)
// ---------------------------------------------------------------------------

async function cmdLinks(url: string): Promise<void> {
  progress.start("links", 3);
  const baseUrl = new URL(validateUrl(url));
  const timeout = 5000;
  const maxDepth = 1;
  const visited = new Set<string>();
  const results: LinkResult[] = [];

  function isInternalLink(link: string): boolean {
    try {
      const parsed = new URL(link, baseUrl.href);
      return parsed.hostname === baseUrl.hostname;
    } catch {
      return false;
    }
  }

  function normalizeUrl(link: string, base: URL): string | null {
    try {
      const parsed = new URL(link, base.href);
      if (!["http:", "https:"].includes(parsed.protocol)) return null;
      parsed.hash = "";
      return parsed.href;
    } catch {
      return null;
    }
  }

  async function checkLink(linkUrl: string): Promise<LinkResult> {
    const redirectChain: string[] = [];
    let current = linkUrl;
    const maxRedirects = 10;

    for (let i = 0; i < maxRedirects; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(current, {
          method: "HEAD",
          redirect: "manual",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (location) {
            redirectChain.push(current);
            current = new URL(location, current).href;
            continue;
          }
        }

        if (response.status === 405) {
          const ctrl2 = new AbortController();
          const tid2 = setTimeout(() => ctrl2.abort(), timeout);
          const getResp = await fetch(current, { method: "GET", redirect: "manual", signal: ctrl2.signal });
          clearTimeout(tid2);
          return { url: linkUrl, status: getResp.status, statusText: getResp.statusText, type: "external", redirectChain, error: null };
        }

        return { url: linkUrl, status: response.status, statusText: response.statusText, type: "external", redirectChain, error: null };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { url: linkUrl, status: null, statusText: "timeout", type: "external", redirectChain, error: `Timeout after ${timeout}ms` };
        }
        return { url: linkUrl, status: null, statusText: "error", type: "external", redirectChain, error: err instanceof Error ? err.message : String(err) };
      }
    }

    return { url: linkUrl, status: null, statusText: "too-many-redirects", type: "external", redirectChain, error: `Too many redirects (>${maxRedirects})` };
  }

  async function extractLinks(pageUrl: string): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(pageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return [];
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) return [];
      const html = await response.text();
      const linkRegex = /href\s*=\s*["']([^"']+)["']/gi;
      const links: string[] = [];
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        links.push(match[1]);
      }
      return links;
    } catch {
      return [];
    }
  }

  progress.next("Extract links from page");
  progress.info(`Crawling ${baseUrl.href} (depth: ${maxDepth}, timeout: ${timeout}ms)`);

  const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl.href, depth: 0 }];

  while (queue.length > 0) {
    const batch = queue.splice(0, 10);
    await Promise.all(batch.map(async ({ url: pageUrl, depth }) => {
      if (visited.has(pageUrl)) return;
      visited.add(pageUrl);

      const rawLinks = await extractLinks(pageUrl);
      const base = new URL(pageUrl);
      const normalizedLinks = rawLinks
        .map((link) => normalizeUrl(link, base))
        .filter((link): link is string => link !== null)
        .filter((link) => !visited.has(link));
      const uniqueLinks = [...new Set(normalizedLinks)];

      await Promise.all(uniqueLinks.map(async (link) => {
        if (visited.has(link)) return;
        visited.add(link);
        const result = await checkLink(link);
        result.type = isInternalLink(link) ? "internal" : "external";
        results.push(result);
        if (result.type === "internal" && depth < maxDepth && result.status !== null && result.status >= 200 && result.status < 400) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }));
    }));
  }

  progress.done(`Extracted ${results.length} link(s)`);

  progress.next("Check link status");
  const valid = results.filter((l) => l.status !== null && l.status >= 200 && l.status < 300).length;
  const redirected = results.filter((l) => l.status !== null && l.status >= 300 && l.status < 400).length;
  const broken = results.filter((l) => l.status !== null && l.status >= 400).length;
  const timedOut = results.filter((l) => l.error !== null && l.error.includes("Timeout")).length;
  const errored = results.filter((l) => l.error !== null && !l.error.includes("Timeout")).length;
  if (broken > 0) progress.warn(`${broken} broken link(s)`);
  if (timedOut > 0) progress.warn(`${timedOut} timed out`);
  progress.done(`${valid} valid, ${broken} broken, ${redirected} redirected`);

  progress.next("Generate report");
  progress.done("Report generated");

  const report: CrawlReport = {
    baseUrl: baseUrl.href,
    crawledAt: new Date().toISOString(),
    depth: maxDepth,
    timeout,
    totalLinks: results.length,
    valid,
    redirected,
    broken,
    timedOut,
    errored,
    links: results.sort((a, b) => {
      const priority = (l: LinkResult) => {
        if (l.status === null) return 0;
        if (l.status >= 400) return 1;
        if (l.status >= 300) return 2;
        return 3;
      };
      return priority(a) - priority(b);
    }),
  };

  console.log(`\nLink Check Results:`);
  console.log(`  Total:      ${results.length}`);
  console.log(`  Valid:      ${valid}`);
  console.log(`  Redirected: ${redirected}`);
  console.log(`  Broken:     ${broken}`);
  console.log(`  Timed out:  ${timedOut}`);
  console.log(`  Errored:    ${errored}`);

  progress.finish(broken === 0
    ? `All ${results.length} links OK -- ${baseUrl.href}`
    : `${broken} broken link(s) -- ${baseUrl.href}`);

  if (broken > 0) {
    console.log(`\nBroken links:`);
    results.filter((l) => l.status !== null && l.status >= 400).forEach((l) => {
      console.log(`  ${l.status} ${l.url}`);
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

// ---------------------------------------------------------------------------
// Command: status
// ---------------------------------------------------------------------------

async function cmdStatus(): Promise<void> {
  progress.start("status", 1);
  progress.next("Check server health");

  if (!(await isServerRunning())) {
    progress.done("Server is not running");
    progress.finish("No active session");
    console.log("Server is not running.");
    return;
  }
  const result = await serverGet("/health");
  if (!result.success) {
    progress.fail("Health check failed");
    console.log("Server health check failed.");
    return;
  }
  const h = result.data as HealthData;
  progress.done(`Server running (PID ${h.pid}, uptime ${Math.round(h.uptime)}s)`);
  progress.finish("Status retrieved");

  console.log(`hora-browser session:`);
  console.log(`  Status:     ${h.status}`);
  console.log(`  PID:        ${h.pid}`);
  console.log(`  Port:       ${h.port}`);
  console.log(`  Headless:   ${h.headless}`);
  console.log(`  Current URL: ${h.currentUrl || "(none)"}`);
  console.log(`  Uptime:     ${Math.round(h.uptime)}s`);
  console.log(`  Console:    ${h.consoleLogs} entries`);
  console.log(`  Network:    ${h.networkRequests} requests, ${h.networkResponses} responses`);
  console.log(`  Errors:     ${h.pageErrors} page errors`);
}

// ---------------------------------------------------------------------------
// Command: restart
// ---------------------------------------------------------------------------

async function cmdRestart(): Promise<void> {
  progress.start("restart", 2);

  progress.next("Stop current session");
  if (await isServerRunning()) {
    try {
      await serverPost("/stop");
    } catch {
      // ignore
    }
    await sleep(1000);
    progress.done("Session stopped");
  } else {
    progress.done("No session to stop");
  }

  // Remove stale state
  if (fs.existsSync(STATE_FILE)) {
    try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
  }

  progress.next("Start fresh session");
  await ensureServer();
  progress.done("Fresh session started");
  progress.finish("Restart complete");

  console.log("Server restarted successfully.");
}

// ---------------------------------------------------------------------------
// Command: stop
// ---------------------------------------------------------------------------

async function cmdStop(): Promise<void> {
  progress.start("stop", 1);
  progress.next("Stop server");

  if (!(await isServerRunning())) {
    progress.done("Server was not running");
    progress.finish("Nothing to stop");
    console.log("Server is not running.");
    return;
  }
  try {
    await serverPost("/stop");
  } catch {
    // expected — server shuts down
  }
  progress.done("Server stopped");
  progress.finish("Session ended");

  console.log("Server stopped.");
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`hora-browser — debug-first browser automation

Usage: node hora-browser.mjs <command> [args...]

Navigation & Diagnostics:
  <url>                      Navigate + full diagnostics
  errors                     Console errors only
  warnings                   Console warnings
  console                    All console output
  network                    Network activity
  failed                     Failed requests (4xx, 5xx)

Interaction:
  screenshot [path]          Take screenshot
  click <selector>           Click element
  fill <selector> <value>    Fill input
  eval "<javascript>"        Execute JS

Testing:
  capture <url>              Multi-viewport screenshots (4 viewports)
  diff <img1> <img2>         Visual diff (pixelmatch)
  a11y <url>                 Accessibility audit (axe-core)
  links <url>                Link checker

Session:
  status                     Session info
  restart                    Fresh session
  stop                       Stop session
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  // Detect if first arg is a URL
  const looksLikeUrl = command.startsWith("http://") || command.startsWith("https://") || command.includes("localhost") || command.includes(".");

  try {
    if (looksLikeUrl) {
      await cmdNavigate(command);
    } else {
      switch (command) {
        case "errors":
          await cmdErrors();
          break;
        case "warnings":
          await cmdWarnings();
          break;
        case "console":
          await cmdConsole();
          break;
        case "network":
          await cmdNetwork();
          break;
        case "failed":
          await cmdFailed();
          break;
        case "screenshot":
          await cmdScreenshot(args[1]);
          break;
        case "click":
          if (!args[1]) { console.error("Usage: browse.ts click <selector>"); process.exit(1); }
          await cmdClick(args[1]);
          break;
        case "fill":
          if (!args[1] || !args[2]) { console.error("Usage: browse.ts fill <selector> <value>"); process.exit(1); }
          await cmdFill(args[1], args[2]);
          break;
        case "eval":
          if (!args[1]) { console.error("Usage: browse.ts eval \"<javascript>\""); process.exit(1); }
          await cmdEval(args[1]);
          break;
        case "capture":
          if (!args[1]) { console.error("Usage: browse.ts capture <url>"); process.exit(1); }
          await cmdCapture(args[1]);
          break;
        case "diff":
          if (!args[1] || !args[2]) { console.error("Usage: browse.ts diff <img1> <img2>"); process.exit(1); }
          await cmdDiff(args[1], args[2]);
          break;
        case "a11y":
          if (!args[1]) { console.error("Usage: browse.ts a11y <url>"); process.exit(1); }
          await cmdA11y(args[1]);
          break;
        case "links":
          if (!args[1]) { console.error("Usage: browse.ts links <url>"); process.exit(1); }
          await cmdLinks(args[1]);
          break;
        case "status":
          await cmdStatus();
          break;
        case "restart":
          await cmdRestart();
          break;
        case "stop":
          await cmdStop();
          break;
        case "help":
        case "--help":
        case "-h":
          printUsage();
          break;
        default:
          console.error(`Unknown command: ${command}`);
          printUsage();
          process.exit(1);
      }
    }
  } catch (err) {
    console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
