#!/usr/bin/env npx tsx
// hora-browser CLI — unified entry point for all browser commands
// Usage: npx tsx browse.ts <command> [args...]

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";

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
const SERVER_SCRIPT = path.join(path.dirname(new URL(import.meta.url).pathname), "browser-server.ts");

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

async function ensureServer(): Promise<void> {
  if (await isServerRunning()) return;

  // Check for stale state file
  if (fs.existsSync(STATE_FILE)) {
    try {
      fs.unlinkSync(STATE_FILE);
    } catch {
      // ignore
    }
  }

  console.error("[hora-browser] Starting server...");

  const child = spawn("npx", ["tsx", SERVER_SCRIPT], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      HORA_BROWSER_PORT: String(PORT),
    },
  });

  child.unref();

  // Wait for server to be ready (retry with backoff)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(300 + i * 100);
    if (await isServerRunning()) {
      console.error(`[hora-browser] Server ready on port ${PORT}`);
      return;
    }
  }

  console.error("[hora-browser] ERROR: Server failed to start within timeout.");
  console.error("Try starting manually: npx tsx browser-server.ts");
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  await ensureServer();
  const validUrl = validateUrl(url);

  const navResult = await serverPost("/navigate", { url: validUrl });
  if (!navResult.success) {
    console.error(`ERROR: ${navResult.error}`);
    process.exit(1);
  }

  // Wait for events to accumulate
  await sleep(2000);

  // Get diagnostics
  const diag = await serverGet("/diagnostics");
  if (!diag.success) {
    console.error(`ERROR: ${diag.error}`);
    process.exit(1);
  }

  const d = diag.data as DiagnosticsData;

  // Format output
  if (d.screenshot) {
    console.log(`\nScreenshot: ${d.screenshot}`);
  }

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

  // JSON to stdout for programmatic use
  console.log(JSON.stringify(d, null, 2));
}

// ---------------------------------------------------------------------------
// Command: errors
// ---------------------------------------------------------------------------

async function cmdErrors(): Promise<void> {
  await ensureServer();
  const result = await serverGet("/console?type=error");
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  const entries = result.data as Array<{ type: string; text: string; timestamp: string }>;
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
  await ensureServer();
  const result = await serverGet("/console?type=warning");
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  const entries = result.data as Array<{ type: string; text: string; timestamp: string }>;
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
  await ensureServer();
  const result = await serverGet("/console");
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  const entries = result.data as Array<{ type: string; text: string; timestamp: string }>;
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
  await ensureServer();
  const result = await serverGet("/network?type=response");
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  const entries = result.data as Array<{
    url: string; method: string; status: number; statusText: string; timing: number; size: number;
  }>;
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
  await ensureServer();
  const result = await serverGet("/network?type=response");
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  const all = result.data as Array<{
    url: string; method: string; status: number; statusText: string; timing: number;
  }>;
  const failed = all.filter((r) => r.status >= 400);
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
  await ensureServer();
  const screenshotPath = outputPath || path.join(os.tmpdir(), `hora-browse-${Date.now()}.png`);
  const result = await serverPost("/screenshot", { path: screenshotPath });
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  const data = result.data as { path: string; size: number };
  console.log(`Screenshot saved: ${data.path} (${formatBytes(data.size)})`);
}

// ---------------------------------------------------------------------------
// Command: click
// ---------------------------------------------------------------------------

async function cmdClick(selector: string): Promise<void> {
  await ensureServer();
  const result = await serverPost("/click", { selector });
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  console.log(`Clicked: ${selector}`);
}

// ---------------------------------------------------------------------------
// Command: fill
// ---------------------------------------------------------------------------

async function cmdFill(selector: string, value: string): Promise<void> {
  await ensureServer();
  const result = await serverPost("/fill", { selector, value });
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  console.log(`Filled: ${selector} = "${value}"`);
}

// ---------------------------------------------------------------------------
// Command: eval
// ---------------------------------------------------------------------------

async function cmdEval(script: string): Promise<void> {
  await ensureServer();
  const result = await serverPost("/eval", { script });
  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }
  const data = result.data as { result: unknown };
  console.log(JSON.stringify(data.result, null, 2));
}

// ---------------------------------------------------------------------------
// Command: capture (multi-viewport screenshots)
// ---------------------------------------------------------------------------

async function cmdCapture(url: string): Promise<void> {
  await ensureServer();
  const validUrl = validateUrl(url);

  // Navigate first
  const navResult = await serverPost("/navigate", { url: validUrl });
  if (!navResult.success) {
    console.error(`ERROR: ${navResult.error}`);
    process.exit(1);
  }
  await sleep(1500);

  const baseDir = path.join(process.cwd(), ".hora", "screenshots", getDateDir());
  fs.mkdirSync(baseDir, { recursive: true });
  const timestamp = getTimestamp();

  const results: Array<{ viewport: string; width: number; height: number; path: string; size: number }> = [];

  for (const vp of VIEWPORTS) {
    // Resize
    const resizeResult = await serverPost("/resize", { width: vp.width, height: vp.height });
    if (!resizeResult.success) {
      console.error(`  WARNING: Failed to resize to ${vp.name}: ${resizeResult.error}`);
      continue;
    }
    await sleep(500);

    // Screenshot
    const filePath = path.join(baseDir, `${timestamp}_${vp.name}.png`);
    const ssResult = await serverPost("/screenshot", { path: filePath, fullPage: true });
    if (!ssResult.success) {
      console.error(`  WARNING: Failed to capture ${vp.name}: ${ssResult.error}`);
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
    console.error(`  Captured ${vp.name} (${vp.width}x${vp.height}): ${data.path}`);
  }

  // Restore to desktop viewport
  await serverPost("/resize", { width: 1280, height: 800 });

  if (results.length === 0) {
    console.error("ERROR: No screenshots were captured successfully.");
    process.exit(1);
  }

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

  const outputPath = path.join(os.tmpdir(), `hora-diff-${Date.now()}.png`);
  await writePng(outputPath, diff);

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
  await ensureServer();
  const validUrl = validateUrl(url);

  // Navigate
  const navResult = await serverPost("/navigate", { url: validUrl });
  if (!navResult.success) {
    console.error(`ERROR: ${navResult.error}`);
    process.exit(1);
  }
  await sleep(2000);

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
    console.error(`ERROR: Failed to inject axe-core: ${injectResult.error}`);
    console.error("The page might be offline or blocking external scripts.");
    process.exit(1);
  }

  const injectData = injectResult.data as { result: boolean };
  if (!injectData.result) {
    console.error("ERROR: axe-core failed to load.");
    process.exit(1);
  }

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
    console.error(`ERROR: axe.run() failed: ${axeResult.error}`);
    process.exit(1);
  }

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

  console.error(`Crawling ${baseUrl.href} (depth: ${maxDepth}, timeout: ${timeout}ms)...`);

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

  const valid = results.filter((l) => l.status !== null && l.status >= 200 && l.status < 300).length;
  const redirected = results.filter((l) => l.status !== null && l.status >= 300 && l.status < 400).length;
  const broken = results.filter((l) => l.status !== null && l.status >= 400).length;
  const timedOut = results.filter((l) => l.error !== null && l.error.includes("Timeout")).length;
  const errored = results.filter((l) => l.error !== null && !l.error.includes("Timeout")).length;

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
  if (!(await isServerRunning())) {
    console.log("Server is not running.");
    return;
  }
  const result = await serverGet("/health");
  if (!result.success) {
    console.log("Server health check failed.");
    return;
  }
  const h = result.data as HealthData;
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
  if (await isServerRunning()) {
    console.error("[hora-browser] Stopping current session...");
    try {
      await serverPost("/stop");
    } catch {
      // ignore
    }
    await sleep(1000);
  }
  // Remove stale state
  if (fs.existsSync(STATE_FILE)) {
    try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
  }
  console.error("[hora-browser] Starting fresh session...");
  await ensureServer();
  console.log("Server restarted successfully.");
}

// ---------------------------------------------------------------------------
// Command: stop
// ---------------------------------------------------------------------------

async function cmdStop(): Promise<void> {
  if (!(await isServerRunning())) {
    console.log("Server is not running.");
    return;
  }
  try {
    await serverPost("/stop");
  } catch {
    // expected — server shuts down
  }
  console.log("Server stopped.");
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`hora-browser — debug-first browser automation

Usage: npx tsx browse.ts <command> [args...]

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
