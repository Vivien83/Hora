#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/a11y-audit.ts <url> [--json]

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js";

type ImpactLevel = "critical" | "serious" | "moderate" | "minor";

interface AxeViolation {
  id: string;
  impact: ImpactLevel;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

interface AxeResults {
  violations: AxeViolation[];
  passes: Array<{ id: string; description: string }>;
  incomplete: Array<{ id: string; description: string }>;
  inapplicable: Array<{ id: string }>;
}

interface AuditReport {
  url: string;
  auditedAt: string;
  axeVersion: string;
  summary: {
    totalViolations: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    passes: number;
    incomplete: number;
  };
  violations: AxeViolation[];
}

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

function parseArgs(args: string[]) {
  let url = "";
  let jsonOutput = false;

  for (const arg of args) {
    if (arg === "--json") {
      jsonOutput = true;
    } else if (!url) {
      url = arg;
    }
  }

  return { url, jsonOutput };
}

function printHumanReport(report: AuditReport): void {
  console.log(`\nA11Y AUDIT — ${report.url}`);
  console.log(`Audited: ${report.auditedAt}`);
  console.log(`axe-core: ${report.axeVersion}`);
  console.log("─".repeat(60));

  console.log(`\nSummary:`);
  console.log(`  Total violations: ${report.summary.totalViolations}`);
  console.log(`  Critical:  ${report.summary.critical}`);
  console.log(`  Serious:   ${report.summary.serious}`);
  console.log(`  Moderate:  ${report.summary.moderate}`);
  console.log(`  Minor:     ${report.summary.minor}`);
  console.log(`  Passes:    ${report.summary.passes}`);
  console.log(`  Incomplete: ${report.summary.incomplete}`);

  if (report.violations.length === 0) {
    console.log("\nNo violations found. The page passes all axe-core checks.");
    return;
  }

  const groups: Record<ImpactLevel, AxeViolation[]> = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
  };

  for (const v of report.violations) {
    const impact = v.impact || "minor";
    groups[impact].push(v);
  }

  const impactOrder: ImpactLevel[] = ["critical", "serious", "moderate", "minor"];
  const impactIcons: Record<ImpactLevel, string> = {
    critical: "[CRITICAL]",
    serious: "[SERIOUS]",
    moderate: "[MODERATE]",
    minor: "[MINOR]",
  };

  for (const impact of impactOrder) {
    const violations = groups[impact];
    if (violations.length === 0) continue;

    console.log(`\n${"─".repeat(60)}`);
    console.log(`${impactIcons[impact]} — ${violations.length} violation(s)`);
    console.log("─".repeat(60));

    for (const v of violations) {
      console.log(`\n  ${v.id}: ${v.help}`);
      console.log(`  ${v.description}`);
      console.log(`  More info: ${v.helpUrl}`);

      const maxNodes = 3;
      const nodes = v.nodes.slice(0, maxNodes);

      for (const node of nodes) {
        const target = node.target.join(", ");
        const html =
          node.html.length > 120
            ? node.html.substring(0, 120) + "..."
            : node.html;
        console.log(`    Element: ${target}`);
        console.log(`    HTML: ${html}`);
        if (node.failureSummary) {
          const lines = node.failureSummary.split("\n").slice(0, 3);
          for (const line of lines) {
            console.log(`      ${line.trim()}`);
          }
        }
      }

      if (v.nodes.length > maxNodes) {
        console.log(
          `    ... and ${v.nodes.length - maxNodes} more element(s)`
        );
      }
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(
    `Total: ${report.summary.totalViolations} violations across ${report.violations.length} rules`
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npx tsx a11y-audit.ts <url> [--json]");
    console.error("Example: npx tsx a11y-audit.ts https://example.com");
    process.exit(1);
  }

  const { url: rawUrl, jsonOutput } = parseArgs(args);

  if (!rawUrl) {
    console.error("URL is required.");
    process.exit(1);
  }

  const url = validateUrl(rawUrl);
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

  try {
    const page = await browser.newPage();

    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
    } catch (err) {
      console.error(`Failed to load page: ${url}`);
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // Inject axe-core from CDN
    try {
      await page.addScriptTag({ url: AXE_CDN });
      // Wait for axe to be available
      await page.waitForFunction("typeof window.axe !== 'undefined'", {
        timeout: 10_000,
      });
    } catch (err) {
      console.error(
        "Failed to inject axe-core from CDN. " +
          "The page might be offline or blocking external scripts.\n" +
          `CDN URL: ${AXE_CDN}`
      );
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // Run axe
    const axeResults: AxeResults = await page.evaluate(async () => {
      // @ts-expect-error axe is injected globally
      return await window.axe.run(document);
    });

    // Get axe version
    const axeVersion: string = await page.evaluate(() => {
      // @ts-expect-error axe is injected globally
      return window.axe.version || "unknown";
    });

    const countByImpact = (impact: ImpactLevel) =>
      axeResults.violations.filter((v) => v.impact === impact).length;

    const report: AuditReport = {
      url,
      auditedAt: new Date().toISOString(),
      axeVersion,
      summary: {
        totalViolations: axeResults.violations.length,
        critical: countByImpact("critical"),
        serious: countByImpact("serious"),
        moderate: countByImpact("moderate"),
        minor: countByImpact("minor"),
        passes: axeResults.passes.length,
        incomplete: axeResults.incomplete.length,
      },
      violations: axeResults.violations,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanReport(report);
    }

    // Save JSON report to .hora/screenshots/{date}/
    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    const dateDir = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timestamp = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
    const outDir = path.join(process.cwd(), ".hora", "screenshots", dateDir);
    const outFile = path.join(outDir, `${timestamp}_a11y.json`);

    try {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf-8");
      console.error(`\nReport saved to: ${outFile}`);
    } catch (err) {
      console.error(
        `Warning: Could not save report to ${outFile}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(
    "Unexpected error:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
