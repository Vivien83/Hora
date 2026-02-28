#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/capture-viewports.ts <url> [output-dir]
// Requires: Playwright (npx playwright install chromium)

import fs from "node:fs";
import path from "node:path";

// --- Types ---

interface Viewport {
  name: string;
  width: number;
  height: number;
}

interface CaptureResult {
  url: string;
  outputDir: string;
  screenshots: Array<{
    viewport: string;
    width: number;
    height: number;
    path: string;
  }>;
  timestamp: string;
}

// --- Config ---

const VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1536, height: 864 },
];

// --- Main ---

async function main(): Promise<void> {
  const url = process.argv[2];
  const outputBase = process.argv[3] || path.join(process.cwd(), ".hora", "screenshots");

  if (!url) {
    process.stderr.write(
      `Usage: npx tsx scripts/capture-viewports.ts <url> [output-dir]\n\n` +
        `Examples:\n` +
        `  npx tsx scripts/capture-viewports.ts http://localhost:3000\n` +
        `  npx tsx scripts/capture-viewports.ts https://example.com ./screenshots\n`
    );
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    process.stderr.write(`Error: invalid URL: ${url}\n`);
    process.exit(1);
  }

  // Try to import Playwright
  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    process.stderr.write(
      `Error: Playwright is not installed.\n\n` +
        `Install it with:\n` +
        `  npm install -D playwright\n` +
        `  npx playwright install chromium\n\n` +
        `Or for a quick one-liner:\n` +
        `  npm install -D playwright && npx playwright install chromium\n`
    );
    process.exit(1);
  }

  // Create output directory
  const now = new Date();
  const dateDir = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const timePrefix = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("-");

  const outputDir = path.join(outputBase, dateDir);
  fs.mkdirSync(outputDir, { recursive: true });

  process.stderr.write(`Capturing: ${url}\n`);
  process.stderr.write(`Output: ${outputDir}\n\n`);

  const result: CaptureResult = {
    url,
    outputDir,
    screenshots: [],
    timestamp: now.toISOString(),
  };

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of VIEWPORTS) {
      process.stderr.write(
        `  Capturing ${viewport.name} (${viewport.width}x${viewport.height})...`
      );

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
      });

      const page = await context.newPage();

      try {
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
      } catch (err) {
        process.stderr.write(` timeout, capturing anyway...`);
        // Continue with whatever loaded
      }

      // Small delay for animations to settle
      await page.waitForTimeout(500);

      const filename = `${timePrefix}_${viewport.name}.png`;
      const filePath = path.join(outputDir, filename);

      await page.screenshot({
        path: filePath,
        fullPage: true,
      });

      result.screenshots.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        path: filePath,
      });

      process.stderr.write(` done\n`);

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // JSON to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Summary to stderr
  process.stderr.write(`\n--- Capture Complete ---\n`);
  process.stderr.write(`URL: ${url}\n`);
  process.stderr.write(`Screenshots: ${result.screenshots.length}\n`);
  for (const s of result.screenshots) {
    process.stderr.write(`  ${s.viewport}: ${s.path}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
