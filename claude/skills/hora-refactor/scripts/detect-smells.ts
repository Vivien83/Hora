#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/detect-smells.ts [dir] [--json]

import fs from "node:fs";
import path from "node:path";

// --- Types ---

interface Smell {
  type: string;
  severity: "high" | "medium" | "low";
  file: string;
  line: number;
  message: string;
  detail?: string;
}

interface SmellReport {
  scannedFiles: number;
  smells: Smell[];
  summary: Record<string, number>;
}

// --- Config ---

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", ".hora"]);
const TS_EXTS = new Set([".ts", ".tsx"]);

const LONG_FUNCTION_THRESHOLD = 20;
const LARGE_FILE_THRESHOLD = 200;
const MAX_PARAMS = 3;
const MAX_NESTING = 3;
const DUPLICATE_STRING_THRESHOLD = 3;

// --- Helpers ---

function collectTsFiles(dir: string): string[] {
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
      } else if (entry.isFile() && TS_EXTS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function detectLongFunctions(
  lines: string[],
  relPath: string
): Smell[] {
  const smells: Smell[] = [];
  const funcStart =
    /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>|(?:async\s+)?(?:\w+)\s*\([^)]*\)\s*\{)/;

  let braceDepth = 0;
  let funcStartLine = -1;
  let inFunc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFunc && funcStart.test(line)) {
      funcStartLine = i;
      inFunc = true;
      braceDepth = 0;
    }

    if (inFunc) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      if (braceDepth <= 0 && funcStartLine >= 0) {
        const length = i - funcStartLine + 1;
        if (length > LONG_FUNCTION_THRESHOLD) {
          smells.push({
            type: "long-function",
            severity: length > 50 ? "high" : "medium",
            file: relPath,
            line: funcStartLine + 1,
            message: `Function is ${length} lines long (threshold: ${LONG_FUNCTION_THRESHOLD})`,
          });
        }
        inFunc = false;
        funcStartLine = -1;
      }
    }
  }

  return smells;
}

function detectLargeFile(
  lines: string[],
  relPath: string
): Smell[] {
  if (lines.length > LARGE_FILE_THRESHOLD) {
    return [
      {
        type: "large-file",
        severity: lines.length > 500 ? "high" : "medium",
        file: relPath,
        line: 1,
        message: `File is ${lines.length} lines long (threshold: ${LARGE_FILE_THRESHOLD})`,
      },
    ];
  }
  return [];
}

function detectLongParamLists(
  lines: string[],
  relPath: string
): Smell[] {
  const smells: Smell[] = [];
  const paramPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:async\s+)?\w+\s*\()\s*\(([^)]+)\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Simple heuristic: count commas in function parameter lists
    const match = line.match(/\(([^)]{10,})\)/);
    if (match) {
      const inner = match[1];
      // Skip if it looks like a function call with string args
      if (
        (line.includes("function") ||
          line.includes("=>") ||
          line.match(/\w+\s*\(/)) &&
        !line.trim().startsWith("//")
      ) {
        const params = inner.split(",").filter((p) => p.trim().length > 0);
        if (params.length > MAX_PARAMS) {
          // Only flag if it looks like a declaration
          if (
            line.includes("function") ||
            line.includes("=>") ||
            line.match(/(?:const|let|var)\s+\w+/)
          ) {
            smells.push({
              type: "long-param-list",
              severity: "medium",
              file: relPath,
              line: i + 1,
              message: `${params.length} parameters (threshold: ${MAX_PARAMS}) — consider using an options object`,
            });
          }
        }
      }
    }
  }

  return smells;
}

function detectDeepNesting(
  lines: string[],
  relPath: string
): Smell[] {
  const smells: Smell[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.length === 0) continue;

    const indent = line.length - trimmed.length;
    const tabSize = 2;
    const level = Math.floor(indent / tabSize);

    if (level > MAX_NESTING && (trimmed.startsWith("if") || trimmed.startsWith("for") || trimmed.startsWith("while") || trimmed.startsWith("switch"))) {
      smells.push({
        type: "deep-nesting",
        severity: level > 5 ? "high" : "medium",
        file: relPath,
        line: i + 1,
        message: `Nesting level ${level} (threshold: ${MAX_NESTING}) — consider early returns or extraction`,
      });
    }
  }

  return smells;
}

function detectDuplicateStrings(
  lines: string[],
  relPath: string
): Smell[] {
  const smells: Smell[] = [];
  const stringCounts = new Map<string, { count: number; lines: number[] }>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import")) continue;

    const matches = line.match(/["'`]([^"'`]{4,60})["'`]/g);
    if (matches) {
      for (const m of matches) {
        const str = m.slice(1, -1);
        // Skip common non-issues
        if (str.startsWith("use ") || str.startsWith("./") || str.startsWith("@/")) continue;

        const entry = stringCounts.get(str) || { count: 0, lines: [] };
        entry.count++;
        entry.lines.push(i + 1);
        stringCounts.set(str, entry);
      }
    }
  }

  for (const [str, entry] of stringCounts) {
    if (entry.count >= DUPLICATE_STRING_THRESHOLD) {
      smells.push({
        type: "duplicate-string",
        severity: "low",
        file: relPath,
        line: entry.lines[0],
        message: `String "${str.substring(0, 40)}" repeated ${entry.count} times — consider extracting to a constant`,
        detail: `Lines: ${entry.lines.join(", ")}`,
      });
    }
  }

  return smells;
}

function detectTodoComments(
  lines: string[],
  relPath: string
): Smell[] {
  const smells: Smell[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX)\b/i);
    if (match) {
      smells.push({
        type: "todo-comment",
        severity: match[1].toUpperCase() === "HACK" ? "medium" : "low",
        file: relPath,
        line: i + 1,
        message: `${match[1].toUpperCase()} comment found`,
        detail: line.trim().substring(0, 100),
      });
    }
  }

  return smells;
}

function detectUnusedExports(
  files: string[],
  projectDir: string
): Smell[] {
  const smells: Smell[] = [];

  // Phase 1: collect all exports
  const exports: Array<{ name: string; file: string; line: number }> = [];
  const allContents = new Map<string, string>();

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    allContents.set(file, content);

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const exportMatch = line.match(
        /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/
      );
      if (exportMatch) {
        exports.push({
          name: exportMatch[1],
          file: path.relative(projectDir, file),
          line: i + 1,
        });
      }
    }
  }

  // Phase 2: check if each export is imported somewhere else
  for (const exp of exports) {
    let used = false;
    const absFile = path.join(projectDir, exp.file);

    for (const [otherFile, content] of allContents) {
      if (otherFile === absFile) continue;
      if (content.includes(exp.name)) {
        used = true;
        break;
      }
    }

    if (!used) {
      smells.push({
        type: "unused-export",
        severity: "low",
        file: exp.file,
        line: exp.line,
        message: `Export "${exp.name}" is not imported in any other scanned file`,
      });
    }
  }

  return smells;
}

// --- Main ---

function main(): void {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const jsonOnly = flags.includes("--json");

  const projectDir = path.resolve(args[0] || ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  process.stderr.write(`Scanning for code smells: ${projectDir}\n`);

  const files = collectTsFiles(projectDir);
  const allSmells: Smell[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    const relPath = path.relative(projectDir, file);

    allSmells.push(...detectLargeFile(lines, relPath));
    allSmells.push(...detectLongFunctions(lines, relPath));
    allSmells.push(...detectLongParamLists(lines, relPath));
    allSmells.push(...detectDeepNesting(lines, relPath));
    allSmells.push(...detectDuplicateStrings(lines, relPath));
    allSmells.push(...detectTodoComments(lines, relPath));
  }

  // Unused exports (cross-file analysis)
  allSmells.push(...detectUnusedExports(files, projectDir));

  // Build summary
  const summary: Record<string, number> = {};
  for (const s of allSmells) {
    summary[s.type] = (summary[s.type] || 0) + 1;
  }

  const report: SmellReport = {
    scannedFiles: files.length,
    smells: allSmells,
    summary,
  };

  // JSON to stdout
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  // Human summary to stderr
  if (!jsonOnly) {
    const high = allSmells.filter((s) => s.severity === "high").length;
    const medium = allSmells.filter((s) => s.severity === "medium").length;
    const low = allSmells.filter((s) => s.severity === "low").length;

    process.stderr.write(`\n--- Code Smell Report ---\n`);
    process.stderr.write(`Files scanned: ${files.length}\n`);
    process.stderr.write(`Smells found: ${allSmells.length}\n`);
    process.stderr.write(`  High: ${high} | Medium: ${medium} | Low: ${low}\n`);
    process.stderr.write(`\nBreakdown:\n`);
    for (const [type, count] of Object.entries(summary).sort(
      (a, b) => b[1] - a[1]
    )) {
      process.stderr.write(`  ${type}: ${count}\n`);
    }
  }
}

main();
