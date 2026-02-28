#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/analyze-error.ts "<error text>" [--project dir] [--context N] [--file path] [--stdin]
// Parses a stack trace, locates frames in the project, identifies root cause, suggests fix.
// Outputs JSON to stdout, progress to stderr.

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

// --- Types ---

interface StackFrame {
  raw: string;
  file: string;
  line: number;
  col: number;
  fn: string;
  resolvedPath: string | null;
  exists: boolean;
  inProject: boolean;
  code: string[];
  errorLine: string | null;
}

interface ParsedError {
  type: string;
  message: string;
  raw: string;
}

interface AnalysisResult {
  error: ParsedError;
  frames: StackFrame[];
  rootCauseFrame: StackFrame | null;
  suggestion: string;
  confidence: "high" | "medium" | "low";
}

// --- Arg parsing ---

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  const prefixed = args.find((a) => a.startsWith(flag + "="));
  if (prefixed) return prefixed.slice(flag.length + 1);
  return null;
}

const projectDir = path.resolve(getArg("--project") || ".");
const contextLines = parseInt(getArg("--context") || "5", 10);
const fileArg = getArg("--file");
const fromStdin = args.includes("--stdin");
// Inline error: first arg that doesn't start with --
const inlineArg = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--project") + 1] && a !== args[args.indexOf("--file") + 1] && a !== args[args.indexOf("--context") + 1]);

// --- Helpers ---

function progress(msg: string): void {
  process.stderr.write(`  ${msg}\n`);
}

function step(label: string): void {
  process.stderr.write(`\n[hora-debug] ${label}\n`);
}

function readFileLines(filePath: string): string[] {
  try {
    return fs.readFileSync(filePath, "utf-8").split("\n");
  } catch {
    return [];
  }
}

function getCodeContext(filePath: string, lineNo: number, n: number): { lines: string[]; errorLine: string | null } {
  const all = readFileLines(filePath);
  if (all.length === 0) return { lines: [], errorLine: null };
  const start = Math.max(0, lineNo - n - 1);
  const end = Math.min(all.length - 1, lineNo + n - 1);
  const lines: string[] = [];
  for (let i = start; i <= end; i++) {
    const marker = i === lineNo - 1 ? ">>>" : "   ";
    lines.push(`${marker} ${i + 1}: ${all[i]}`);
  }
  const errorLine = all[lineNo - 1] ?? null;
  return { lines, errorLine };
}

// --- Stack trace parsers ---

// Node.js / V8: "    at functionName (file:line:col)"
// or:           "    at file:line:col"
const NODE_FRAME_RE = /^\s+at\s+(?:([^\s(]+)\s+\()?([^)]+):(\d+):(\d+)\)?$/;

// React component stack: "    in ComponentName (at file:line)"
const REACT_COMPONENT_RE = /^\s+in\s+(\w+)\s+\((?:at\s+)?([^:)]+):(\d+)\)/;

// Next.js webpack-internal: "at eval (webpack-internal:///./src/...)"
const WEBPACK_INTERNAL_RE = /webpack-internal:\/\/\/\.(\/[^:)]+):(\d+):(\d+)/;

function parseFrame(line: string): Omit<StackFrame, "resolvedPath" | "exists" | "inProject" | "code" | "errorLine"> | null {
  // Try React component stack first
  const reactMatch = line.match(REACT_COMPONENT_RE);
  if (reactMatch) {
    return {
      raw: line.trim(),
      fn: reactMatch[1],
      file: reactMatch[2],
      line: parseInt(reactMatch[3], 10),
      col: 0,
    };
  }

  // Try webpack-internal
  const webpackMatch = line.match(WEBPACK_INTERNAL_RE);
  if (webpackMatch) {
    return {
      raw: line.trim(),
      fn: "eval",
      file: webpackMatch[1].replace(/^\//, ""),
      line: parseInt(webpackMatch[2], 10),
      col: parseInt(webpackMatch[3], 10),
    };
  }

  // Try standard Node/V8
  const nodeMatch = line.match(NODE_FRAME_RE);
  if (nodeMatch) {
    const fn = nodeMatch[1] || "<anonymous>";
    const fileWithPath = nodeMatch[2];
    const lineNo = parseInt(nodeMatch[3], 10);
    const colNo = parseInt(nodeMatch[4], 10);

    // Skip native / node internals
    if (fileWithPath.startsWith("node:") || fileWithPath === "<anonymous>") return null;

    return {
      raw: line.trim(),
      fn,
      file: fileWithPath,
      line: lineNo,
      col: colNo,
    };
  }

  return null;
}

// --- Error message parser ---

function parseError(text: string): ParsedError {
  const lines = text.trim().split("\n");
  const firstLine = lines[0].trim();

  // Match "ErrorType: message"
  const typeMatch = firstLine.match(/^([A-Za-z][A-Za-z0-9]*(?:Error|Exception|Warning|Rejection)?)\s*:\s*(.+)$/);
  if (typeMatch) {
    return { type: typeMatch[1], message: typeMatch[2].trim(), raw: firstLine };
  }

  // React error boundary format
  if (firstLine.includes("The above error occurred in the")) {
    return { type: "ReactError", message: firstLine, raw: firstLine };
  }

  // Unhandled rejection
  if (firstLine.includes("UnhandledPromiseRejection")) {
    return { type: "UnhandledPromiseRejection", message: firstLine, raw: firstLine };
  }

  return { type: "Error", message: firstLine, raw: firstLine };
}

// --- Suggestion patterns ---

const SUGGESTIONS: Array<{ pattern: RegExp; suggest: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '(.+?)'\))?/,
    suggest: (m) => {
      const prop = m[2] ? `.${m[2]}` : "";
      const nullish = m[1];
      return `The object is ${nullish} when accessing${prop}. Add a null check: \`if (obj != null)\` or use optional chaining: \`obj?.${m[2] || "property"}\`.`;
    },
  },
  {
    pattern: /is not a function/,
    suggest: () =>
      "The value is not a function — it may be undefined or a different type. Check the import, the variable assignment, and whether the function is exported correctly.",
  },
  {
    pattern: /Cannot set propert(?:y|ies) of (undefined|null)/,
    suggest: (m) =>
      `Trying to set a property on ${m[1]}. The parent object was never initialized. Check the initialization path and add a guard.`,
  },
  {
    pattern: /is not defined/,
    suggest: () =>
      "Variable or module not in scope. Check for a missing import, a typo in the variable name, or a scope issue (closure, async).",
  },
  {
    pattern: /ENOENT.*no such file or directory.*'(.+?)'/,
    suggest: (m) =>
      `File not found: ${m[1]}. Check the path is correct, the file exists, and you are running the command from the right directory.`,
  },
  {
    pattern: /ECONNREFUSED/,
    suggest: () =>
      "Connection refused — the target server is not running or not listening on the expected port. Start the server first.",
  },
  {
    pattern: /SyntaxError: Unexpected token/,
    suggest: () =>
      "Syntax error in parsed content — likely invalid JSON, unexpected character in source, or a missing/extra bracket.",
  },
  {
    pattern: /Maximum update depth exceeded/,
    suggest: () =>
      "Infinite re-render loop in React. A useEffect is triggering a state update that causes the same useEffect to run again. Check the dependency array.",
  },
  {
    pattern: /Objects are not valid as a React child/,
    suggest: () =>
      "Tried to render a plain object as JSX. Use JSON.stringify(), access a specific property (.name, .label), or map the object to JSX elements.",
  },
  {
    pattern: /Hydration failed/,
    suggest: () =>
      "Server and client rendered different HTML. Common causes: Date.now() / Math.random() in render, browser-only APIs (window, localStorage) called during SSR, or conditional rendering based on client-only state.",
  },
  {
    pattern: /Module not found.*['"](.+?)['"]/,
    suggest: (m) =>
      `Module '${m[1]}' not found. Run \`npm install ${m[1]}\` or check the import path for a typo.`,
  },
];

function suggestFix(errorMsg: string): { suggestion: string; confidence: "high" | "medium" | "low" } {
  for (const { pattern, suggest } of SUGGESTIONS) {
    const match = errorMsg.match(pattern);
    if (match) {
      return { suggestion: suggest(match), confidence: "high" };
    }
  }
  return {
    suggestion: "No pattern matched. Read the rootCauseFrame code context and trace the data flow backwards from the error line.",
    confidence: "low",
  };
}

// --- Frame resolution ---

function resolveFrame(
  frame: Omit<StackFrame, "resolvedPath" | "exists" | "inProject" | "code" | "errorLine">
): StackFrame {
  let resolvedPath: string | null = null;
  let exists = false;
  let inProject = false;

  // Skip node internals
  if (frame.file.startsWith("node:") || frame.file.startsWith("<")) {
    return { ...frame, resolvedPath: null, exists: false, inProject: false, code: [], errorLine: null };
  }

  // Skip node_modules
  if (frame.file.includes("node_modules")) {
    return { ...frame, resolvedPath: null, exists: false, inProject: false, code: [], errorLine: null };
  }

  // Try absolute path first
  if (path.isAbsolute(frame.file) && fs.existsSync(frame.file)) {
    resolvedPath = frame.file;
    exists = true;
    inProject = frame.file.startsWith(projectDir);
  } else {
    // Try relative to project root
    const candidate = path.join(projectDir, frame.file);
    if (fs.existsSync(candidate)) {
      resolvedPath = candidate;
      exists = true;
      inProject = true;
    } else {
      // Try stripping leading /
      const stripped = frame.file.replace(/^\//, "");
      const candidate2 = path.join(projectDir, stripped);
      if (fs.existsSync(candidate2)) {
        resolvedPath = candidate2;
        exists = true;
        inProject = true;
      }
    }
  }

  let code: string[] = [];
  let errorLine: string | null = null;
  if (resolvedPath && exists) {
    const ctx = getCodeContext(resolvedPath, frame.line, contextLines);
    code = ctx.lines;
    errorLine = ctx.errorLine;
  }

  return { ...frame, resolvedPath, exists, inProject, code, errorLine };
}

// --- Main analysis ---

function analyzeText(text: string): AnalysisResult {
  step("1/4 PARSE — Extracting error type and frames");
  const parsedError = parseError(text);
  progress(`Type   : ${parsedError.type}`);
  progress(`Message: ${parsedError.message.slice(0, 120)}`);

  const lines = text.split("\n");
  const rawFrames: ReturnType<typeof parseFrame>[] = [];

  for (const line of lines) {
    const f = parseFrame(line);
    if (f) rawFrames.push(f);
  }

  progress(`Frames found: ${rawFrames.length}`);

  step("2/4 LOCATE — Resolving frames to project files");
  const frames: StackFrame[] = rawFrames
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .map(resolveFrame);

  const projectFrames = frames.filter((f) => f.inProject && f.exists);
  progress(`Frames in project: ${projectFrames.length} / ${frames.length}`);

  step("3/4 TRACE — Building execution flow");
  for (const f of projectFrames) {
    const rel = f.resolvedPath ? path.relative(projectDir, f.resolvedPath) : f.file;
    progress(`  ${f.fn} @ ${rel}:${f.line}:${f.col}`);
  }

  step("4/4 ANALYZE — Identifying root cause");

  // Root cause = deepest frame in the project (last in stack = first called)
  const rootCauseFrame = projectFrames.length > 0 ? projectFrames[projectFrames.length - 1] : null;

  if (rootCauseFrame) {
    const rel = rootCauseFrame.resolvedPath
      ? path.relative(projectDir, rootCauseFrame.resolvedPath)
      : rootCauseFrame.file;
    progress(`Root cause frame: ${rel}:${rootCauseFrame.line}`);
  } else {
    progress("No project frames found — stack trace may be from node_modules or minified code");
  }

  const { suggestion, confidence } = suggestFix(parsedError.message);
  progress(`Suggestion confidence: ${confidence}`);

  return {
    error: parsedError,
    frames,
    rootCauseFrame,
    suggestion,
    confidence,
  };
}

// --- Entry point ---

async function main(): Promise<void> {
  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: project directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  process.stderr.write(`\n[hora-debug] Error analysis\n`);
  process.stderr.write(`Project: ${projectDir}\n`);

  let errorText = "";

  if (fileArg) {
    const filePath = path.resolve(fileArg);
    if (!fs.existsSync(filePath)) {
      process.stderr.write(`Error: file not found: ${filePath}\n`);
      process.exit(1);
    }
    errorText = fs.readFileSync(filePath, "utf-8");
    process.stderr.write(`Reading from file: ${filePath}\n`);
  } else if (fromStdin) {
    process.stderr.write(`Reading from stdin...\n`);
    const rl = readline.createInterface({ input: process.stdin });
    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
    }
    errorText = lines.join("\n");
  } else if (inlineArg) {
    errorText = inlineArg;
  } else {
    process.stderr.write(`Usage: npx tsx scripts/analyze-error.ts "<error text>" [--project dir] [--context N]\n`);
    process.stderr.write(`       npx tsx scripts/analyze-error.ts --file error.log [--project dir]\n`);
    process.stderr.write(`       npx tsx scripts/analyze-error.ts --stdin [--project dir]\n`);
    process.exit(1);
  }

  if (!errorText.trim()) {
    process.stderr.write(`Error: no error text provided\n`);
    process.exit(1);
  }

  const result = analyzeText(errorText);

  // Human-readable summary
  process.stderr.write(`\n--- Analysis Result ---\n`);
  process.stderr.write(`Error  : ${result.error.type}: ${result.error.message.slice(0, 100)}\n`);
  if (result.rootCauseFrame) {
    const rel = result.rootCauseFrame.resolvedPath
      ? path.relative(projectDir, result.rootCauseFrame.resolvedPath)
      : result.rootCauseFrame.file;
    process.stderr.write(`Root   : ${rel}:${result.rootCauseFrame.line} (fn: ${result.rootCauseFrame.fn})\n`);
    if (result.rootCauseFrame.code.length > 0) {
      process.stderr.write(`\nCode context:\n`);
      result.rootCauseFrame.code.forEach((l) => process.stderr.write(`  ${l}\n`));
    }
  } else {
    process.stderr.write(`Root   : not found in project files\n`);
  }
  process.stderr.write(`\nSuggestion [${result.confidence}]:\n  ${result.suggestion}\n\n`);

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
