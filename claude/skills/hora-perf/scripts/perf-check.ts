#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/perf-check.ts [project-dir]

import fs from "node:fs";
import path from "node:path";

// --- Types ---

interface PerfIssue {
  rule: string;
  severity: "high" | "medium" | "low";
  file: string;
  line: number;
  snippet: string;
  message: string;
  fix: string;
}

interface PerfReport {
  scannedFiles: number;
  issues: PerfIssue[];
  stats: {
    useClientCount: number;
    useEffectFetchCount: number;
    imgTagCount: number;
    barrelFileCount: number;
    missingLoadingCount: number;
    heavyImportCount: number;
  };
  summary: Record<string, number>;
}

// --- Config ---

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", ".hora"]);
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const HEAVY_IMPORTS = [
  { pattern: /from\s+["']lodash["']/, name: "lodash", fix: 'Import specific functions: import get from "lodash/get"' },
  { pattern: /from\s+["']moment["']/, name: "moment", fix: 'Use date-fns or dayjs instead of moment (540KB)' },
  { pattern: /import\s+\*\s+as\s+\w+\s+from\s+["']date-fns["']/, name: "date-fns/*", fix: 'Import specific functions: import { format } from "date-fns"' },
  { pattern: /from\s+["']@mui\/material["']/, name: "@mui/material", fix: 'Import specific components: import Button from "@mui/material/Button"' },
  { pattern: /from\s+["']@ant-design\/icons["']/, name: "@ant-design/icons", fix: "Import specific icons to reduce bundle size" },
  { pattern: /from\s+["']rxjs["']/, name: "rxjs", fix: 'Import specific operators: import { map } from "rxjs/operators"' },
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
      } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function collectDirs(dir: string): string[] {
  const dirs: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      if (entry.isDirectory()) {
        const fullPath = path.join(current, entry.name);
        dirs.push(fullPath);
        walk(fullPath);
      }
    }
  }

  walk(dir);
  return dirs;
}

function scanFile(
  filePath: string,
  projectDir: string
): { issues: PerfIssue[]; hasUseClient: boolean } {
  const issues: PerfIssue[] = [];
  let hasUseClient = false;

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { issues, hasUseClient };
  }

  const lines = content.split("\n");
  const relPath = path.relative(projectDir, filePath);
  const ext = path.extname(filePath);

  // Check for <img> instead of next/image
  if (ext === ".tsx" || ext === ".jsx") {
    for (let i = 0; i < lines.length; i++) {
      if (/<img\s/i.test(lines[i]) && !lines[i].includes("// perf-ignore")) {
        issues.push({
          rule: "img-tag",
          severity: "medium",
          file: relPath,
          line: i + 1,
          snippet: lines[i].trim().substring(0, 100),
          message: "<img> tag used instead of next/image",
          fix: 'Use <Image> from "next/image" for automatic optimization',
        });
      }
    }
  }

  // Check for "use client"
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].includes('"use client"') || lines[i].includes("'use client'")) {
      hasUseClient = true;
      break;
    }
  }

  // Check for useEffect with fetch/axios
  let inUseEffect = false;
  let useEffectStart = -1;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/useEffect\s*\(/.test(line)) {
      inUseEffect = true;
      useEffectStart = i;
      braceDepth = 0;
    }

    if (inUseEffect) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      if (
        /\bfetch\s*\(/.test(line) ||
        /axios\.\w+\s*\(/.test(line) ||
        /\.get\s*\(/.test(line) ||
        /\.post\s*\(/.test(line)
      ) {
        issues.push({
          rule: "useeffect-fetch",
          severity: "high",
          file: relPath,
          line: useEffectStart + 1,
          snippet: lines[useEffectStart].trim().substring(0, 100),
          message: "useEffect used for data fetching",
          fix: "Use Server Components, TanStack Query, or SWR instead of useEffect for data fetching",
        });
      }

      if (braceDepth <= 0) {
        inUseEffect = false;
      }
    }
  }

  // Check for barrel files (index.ts that re-exports)
  const basename = path.basename(filePath);
  if (
    basename === "index.ts" ||
    basename === "index.tsx" ||
    basename === "index.js"
  ) {
    const exportLines = lines.filter(
      (l) => l.includes("export") && (l.includes("from") || l.includes("*"))
    );
    if (exportLines.length > 3) {
      issues.push({
        rule: "barrel-file",
        severity: "medium",
        file: relPath,
        line: 1,
        snippet: exportLines[0].trim().substring(0, 100),
        message: `Barrel file with ${exportLines.length} re-exports — may prevent tree-shaking`,
        fix: "Import directly from source files instead of barrel indexes",
      });
    }
  }

  // Check for heavy imports
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const heavy of HEAVY_IMPORTS) {
      if (heavy.pattern.test(line)) {
        issues.push({
          rule: "heavy-import",
          severity: "high",
          file: relPath,
          line: i + 1,
          snippet: line.trim().substring(0, 100),
          message: `Heavy import: ${heavy.name}`,
          fix: heavy.fix,
        });
      }
    }
  }

  return { issues, hasUseClient };
}

function checkMissingLoading(projectDir: string): PerfIssue[] {
  const issues: PerfIssue[] = [];

  // Look for app/ directory (Next.js App Router)
  const appDir = path.join(projectDir, "app");
  if (!fs.existsSync(appDir)) {
    const srcAppDir = path.join(projectDir, "src", "app");
    if (!fs.existsSync(srcAppDir)) return issues;
    return checkLoadingInDir(srcAppDir, projectDir);
  }

  return checkLoadingInDir(appDir, projectDir);
}

function checkLoadingInDir(
  dir: string,
  projectDir: string
): PerfIssue[] {
  const issues: PerfIssue[] = [];
  const dirs = collectDirs(dir);

  for (const d of dirs) {
    // Check if this directory has a page.tsx but no loading.tsx
    const hasPage =
      fs.existsSync(path.join(d, "page.tsx")) ||
      fs.existsSync(path.join(d, "page.ts")) ||
      fs.existsSync(path.join(d, "page.jsx"));

    const hasLoading =
      fs.existsSync(path.join(d, "loading.tsx")) ||
      fs.existsSync(path.join(d, "loading.ts")) ||
      fs.existsSync(path.join(d, "loading.jsx"));

    if (hasPage && !hasLoading) {
      issues.push({
        rule: "missing-loading",
        severity: "low",
        file: path.relative(projectDir, d),
        line: 0,
        snippet: "",
        message: "Route directory has page but no loading.tsx",
        fix: "Add loading.tsx for instant loading UI and Suspense boundary",
      });
    }
  }

  return issues;
}

// --- Main ---

function main(): void {
  const projectDir = path.resolve(process.argv[2] || ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  process.stderr.write(`Performance check: ${projectDir}\n`);

  const files = collectFiles(projectDir);
  const allIssues: PerfIssue[] = [];
  let useClientCount = 0;

  for (const file of files) {
    const { issues, hasUseClient } = scanFile(file, projectDir);
    allIssues.push(...issues);
    if (hasUseClient) useClientCount++;
  }

  // Missing loading.tsx check
  const loadingIssues = checkMissingLoading(projectDir);
  allIssues.push(...loadingIssues);

  // Build summary
  const summary: Record<string, number> = {};
  for (const issue of allIssues) {
    summary[issue.rule] = (summary[issue.rule] || 0) + 1;
  }

  const report: PerfReport = {
    scannedFiles: files.length,
    issues: allIssues,
    stats: {
      useClientCount,
      useEffectFetchCount: summary["useeffect-fetch"] || 0,
      imgTagCount: summary["img-tag"] || 0,
      barrelFileCount: summary["barrel-file"] || 0,
      missingLoadingCount: summary["missing-loading"] || 0,
      heavyImportCount: summary["heavy-import"] || 0,
    },
    summary,
  };

  // JSON to stdout
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  // Human summary to stderr
  const high = allIssues.filter((i) => i.severity === "high").length;
  const medium = allIssues.filter((i) => i.severity === "medium").length;
  const low = allIssues.filter((i) => i.severity === "low").length;

  process.stderr.write(`\n--- Performance Check Summary ---\n`);
  process.stderr.write(`Files scanned: ${files.length}\n`);
  process.stderr.write(`Issues found: ${allIssues.length}\n`);
  process.stderr.write(`  High: ${high} | Medium: ${medium} | Low: ${low}\n`);
  process.stderr.write(`\n"use client" directives: ${useClientCount}\n`);

  if (allIssues.length > 0) {
    process.stderr.write(`\nTop issues:\n`);
    const sorted = [...allIssues].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
    for (const issue of sorted.slice(0, 10)) {
      process.stderr.write(
        `  [${issue.severity.toUpperCase()}] ${issue.file}:${issue.line} — ${issue.message}\n`
      );
      process.stderr.write(`    Fix: ${issue.fix}\n`);
    }
  } else {
    process.stderr.write(`No performance issues found.\n`);
  }
}

main();
