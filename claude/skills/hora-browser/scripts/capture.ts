#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/capture.ts <url> [output-dir]

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Viewport {
  name: string;
  width: number;
  height: number;
}

interface CaptureResult {
  url: string;
  timestamp: string;
  outputDir: string;
  screenshots: Array<{
    viewport: string;
    width: number;
    height: number;
    path: string;
    size: number;
  }>;
}

const VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1536, height: 864 },
];

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

function validateUrl(input: string): string {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`Unsupported protocol: ${url.protocol}`);
    }
    return url.href;
  } catch {
    // Try adding https:// if no protocol
    if (!input.includes("://")) {
      return validateUrl(`https://${input}`);
    }
    throw new Error(`Invalid URL: ${input}`);
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    console.error(
      "Playwright is not installed. Install it with:\n\n" +
        "  npm install -D playwright\n" +
        "  npx playwright install chromium\n"
    );
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npx tsx capture.ts <url> [output-dir]");
    console.error("Example: npx tsx capture.ts https://example.com");
    process.exit(1);
  }

  const url = validateUrl(args[0]);
  const baseOutputDir =
    args[1] || path.join(process.cwd(), ".hora", "screenshots");
  const dateDir = getDateDir();
  const outputDir = path.join(baseOutputDir, dateDir);
  const timestamp = getTimestamp();

  // Create output directory
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create output directory: ${outputDir}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const pw = await loadPlaywright();
  let browser;

  try {
    browser = await pw.chromium.launch({ headless: true });
  } catch (err) {
    console.error(
      "Failed to launch Chromium. Make sure it's installed:\n\n" +
        "  npx playwright install chromium\n"
    );
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const result: CaptureResult = {
    url,
    timestamp,
    outputDir,
    screenshots: [],
  };

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      try {
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
      } catch (err) {
        console.error(
          `Warning: page.goto timeout or error for ${viewport.name} (${viewport.width}x${viewport.height})`
        );
        console.error(err instanceof Error ? err.message : String(err));
        await context.close();
        continue;
      }

      const filename = `${timestamp}_${viewport.name}.png`;
      const filepath = path.join(outputDir, filename);

      try {
        await page.screenshot({ path: filepath, fullPage: true });
        const stats = fs.statSync(filepath);

        result.screenshots.push({
          viewport: viewport.name,
          width: viewport.width,
          height: viewport.height,
          path: filepath,
          size: stats.size,
        });
      } catch (err) {
        console.error(`Failed to save screenshot for ${viewport.name}`);
        console.error(err instanceof Error ? err.message : String(err));
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  if (result.screenshots.length === 0) {
    console.error("No screenshots were captured successfully.");
    process.exit(1);
  }

  // Output JSON summary to stdout
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
