#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/anti-ai-scan.ts [project-dir]

import fs from "node:fs";
import path from "node:path";

// --- Types ---

interface AntiPattern {
  rule: string;
  severity: "high" | "medium" | "low";
  file: string;
  line: number;
  snippet: string;
  message: string;
}

interface DesignReport {
  scannedFiles: number;
  antiPatterns: AntiPattern[];
  summary: Record<string, number>;
}

// --- Config ---

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", ".hora"]);
const DESIGN_EXTS = new Set([".tsx", ".jsx", ".css", ".scss"]);

const AI_BUZZWORDS = [
  "seamless",
  "leverage",
  "empower",
  "delve",
  "landscape",
  "synergy",
  "paradigm",
  "disrupt",
  "holistic",
  "cutting-edge",
  "game-changer",
  "next-gen",
  "revolutionary",
  "transformative",
  "innovative solution",
];

const RULES: Array<{
  id: string;
  severity: AntiPattern["severity"];
  patterns: RegExp[];
  message: string;
}> = [
  {
    id: "gradient-indigo-violet",
    severity: "high",
    patterns: [
      /from-indigo/,
      /from-purple/,
      /from-violet/,
      /to-indigo/,
      /to-purple/,
      /to-violet/,
      /via-indigo/,
      /via-purple/,
      /via-violet/,
      /bg-gradient.*(?:indigo|purple|violet)/,
      /linear-gradient.*(?:#6366f1|#8b5cf6|#a855f7|#7c3aed)/i,
    ],
    message:
      "AI-typical gradient (indigo/violet/purple) — use intentional brand colors instead",
  },
  {
    id: "pure-black",
    severity: "medium",
    patterns: [
      /(?:^|\s|;|:)#000000/,
      /(?:^|\s|;|:)#000(?:\s|;|"|'|`|$)/,
      /\bbg-black\b/,
      /\btext-black\b/,
      /\bborder-black\b/,
      /color:\s*black\b/,
      /background(?:-color)?:\s*black\b/,
    ],
    message: "Pure black (#000000) — use #0A0A0B or zinc-950 for depth",
  },
  {
    id: "uniform-rounded",
    severity: "low",
    patterns: [/rounded-2xl/],
    message:
      "rounded-2xl detected — check for uniform radius without variation across components",
  },
  {
    id: "glassmorphism",
    severity: "medium",
    patterns: [
      /backdrop-blur.*bg-.*\/\d+/,
      /bg-.*\/\d+.*backdrop-blur/,
      /backdrop-blur.*bg-opacity/,
      /bg-opacity.*backdrop-blur/,
      /backdrop-filter:\s*blur.*background.*rgba/,
    ],
    message:
      "Glassmorphism pattern (backdrop-blur + semi-transparent bg) — use solid backgrounds",
  },
  {
    id: "shadow-overuse",
    severity: "low",
    patterns: [/shadow-lg/, /shadow-xl/, /shadow-2xl/],
    message:
      "Heavy shadow detected — ensure shadows create visual hierarchy, not uniformity",
  },
  {
    id: "glow-cta",
    severity: "medium",
    patterns: [
      /shadow-.*(?:indigo|purple|violet|blue)/,
      /ring-.*(?:indigo|purple|violet)/,
      /glow/i,
    ],
    message: "Glow effect on interactive element — prefer subtle hover states",
  },
];

// --- Helpers ---

function collectFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && DESIGN_EXTS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function scanFile(filePath: string, projectDir: string): AntiPattern[] {
  const findings: AntiPattern[] = [];
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return findings;
  }

  const lines = content.split("\n");
  const relPath = path.relative(projectDir, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and imports
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import")) continue;

    // Rule-based checks
    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(line)) {
          // Avoid duplicate findings for the same rule on the same line
          const alreadyFound = findings.some(
            (f) => f.rule === rule.id && f.file === relPath && f.line === i + 1
          );
          if (!alreadyFound) {
            findings.push({
              rule: rule.id,
              severity: rule.severity,
              file: relPath,
              line: i + 1,
              snippet: trimmed.substring(0, 120),
              message: rule.message,
            });
          }
          break;
        }
      }
    }

    // AI buzzwords check (only in JSX text content or string literals)
    if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
      const lowerLine = line.toLowerCase();
      for (const buzzword of AI_BUZZWORDS) {
        if (lowerLine.includes(buzzword)) {
          // Skip if it's in a variable name or import
          if (trimmed.startsWith("import") || trimmed.startsWith("const") || trimmed.startsWith("let")) continue;
          findings.push({
            rule: "ai-buzzword",
            severity: "low",
            file: relPath,
            line: i + 1,
            snippet: trimmed.substring(0, 120),
            message: `AI buzzword "${buzzword}" — use specific, human language instead`,
          });
          break; // one buzzword per line is enough
        }
      }
    }
  }

  return findings;
}

function checkInterFontOnly(
  files: string[],
  projectDir: string
): AntiPattern[] {
  const findings: AntiPattern[] = [];
  let hasInter = false;
  let hasOtherFont = false;
  let interFile = "";
  let interLine = 0;

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    const relPath = path.relative(projectDir, file);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/font-family.*Inter/i.test(line) || /Inter/.test(line) && /font/i.test(line)) {
        hasInter = true;
        interFile = relPath;
        interLine = i + 1;
      }
      if (
        /font-family/i.test(line) &&
        !(/Inter/i.test(line)) &&
        (/Geist|Jakarta|Bricolage|Poppins|Roboto|Montserrat|Lato|Raleway/i.test(line))
      ) {
        hasOtherFont = true;
      }
      // Check for Next.js font imports
      if (/next\/font/.test(line) && !/Inter/.test(line)) {
        hasOtherFont = true;
      }
    }
  }

  if (hasInter && !hasOtherFont) {
    findings.push({
      rule: "inter-only",
      severity: "medium",
      file: interFile,
      line: interLine,
      snippet: "Only Inter font detected",
      message:
        "Only Inter font used — too generic. Consider Geist, Plus Jakarta Sans, or Bricolage Grotesque for display",
    });
  }

  return findings;
}

function checkUniformRounded(
  files: string[],
  projectDir: string
): AntiPattern[] {
  const findings: AntiPattern[] = [];
  let rounded2xlCount = 0;
  let otherRoundedCount = 0;

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const r2xl = (content.match(/rounded-2xl/g) || []).length;
    const rOther = (
      content.match(/rounded-(?:sm|md|lg|xl|3xl|full|none)/g) || []
    ).length;
    rounded2xlCount += r2xl;
    otherRoundedCount += rOther;
  }

  if (rounded2xlCount > 5 && otherRoundedCount < 2) {
    findings.push({
      rule: "uniform-rounded-project",
      severity: "medium",
      file: "(project-wide)",
      line: 0,
      snippet: `rounded-2xl: ${rounded2xlCount} occurrences, other radii: ${otherRoundedCount}`,
      message: `Uniform rounded-2xl across project (${rounded2xlCount} uses) without variation — vary border-radius for visual hierarchy`,
    });
  }

  return findings;
}

// --- Main ---

function main(): void {
  const projectDir = path.resolve(process.argv[2] || ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  process.stderr.write(`Anti-AI design scan: ${projectDir}\n`);

  const files = collectFiles(projectDir);
  const allFindings: AntiPattern[] = [];

  for (const file of files) {
    allFindings.push(...scanFile(file, projectDir));
  }

  // Cross-file checks
  allFindings.push(...checkInterFontOnly(files, projectDir));
  allFindings.push(...checkUniformRounded(files, projectDir));

  // Build summary
  const summary: Record<string, number> = {};
  for (const f of allFindings) {
    summary[f.rule] = (summary[f.rule] || 0) + 1;
  }

  const report: DesignReport = {
    scannedFiles: files.length,
    antiPatterns: allFindings,
    summary,
  };

  // JSON to stdout
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  // Human summary to stderr
  const high = allFindings.filter((f) => f.severity === "high").length;
  const medium = allFindings.filter((f) => f.severity === "medium").length;
  const low = allFindings.filter((f) => f.severity === "low").length;

  process.stderr.write(`\n--- Anti-AI Design Scan Summary ---\n`);
  process.stderr.write(`Files scanned: ${files.length}\n`);
  process.stderr.write(`Anti-patterns found: ${allFindings.length}\n`);
  process.stderr.write(`  High: ${high} | Medium: ${medium} | Low: ${low}\n`);

  if (allFindings.length > 0) {
    process.stderr.write(`\nTop issues:\n`);
    const sorted = [...allFindings].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
    for (const f of sorted.slice(0, 10)) {
      process.stderr.write(
        `  [${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.message}\n`
      );
    }
  } else {
    process.stderr.write(`No AI design anti-patterns found.\n`);
  }
}

main();
