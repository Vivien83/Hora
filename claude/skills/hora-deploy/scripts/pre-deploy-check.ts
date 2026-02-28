#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/pre-deploy-check.ts [project-dir] [--skip checks] [--mode quick]
// Runs pre-deploy validation checks on a Node.js project.
// Outputs JSON to stdout, progress to stderr.

import * as fs from "node:fs";
import * as path from "node:path";
import * as child_process from "node:child_process";

// --- Types ---

type CheckStatus = "pass" | "fail" | "warn" | "skip";
type Recommendation = "GO" | "REVIEW" | "NO-GO";

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  duration: number;
  weight: number;
  earned: number;
}

interface DeployReport {
  timestamp: string;
  project: string;
  mode: "full" | "quick";
  score: number;
  recommendation: Recommendation;
  checks: CheckResult[];
  summary: string;
}

interface ProjectConfig {
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  projectType: "nextjs" | "vite" | "node";
  buildCmd: string;
  testCmd: string | null;
  typecheckCmd: string | null;
  hasORM: "drizzle" | "prisma" | null;
  srcDir: string;
}

// --- Arg parsing ---

const args = process.argv.slice(2);
const projectDir = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const skipArg = args.find((a) => a.startsWith("--skip="))?.replace("--skip=", "") || "";
const skipChecks = new Set(skipArg ? skipArg.split(",").map((s) => s.trim()) : []);
const isQuick = args.includes("--mode") && args[args.indexOf("--mode") + 1] === "quick"
  || args.includes("--mode=quick");

// --- Helpers ---

function progress(msg: string): void {
  process.stderr.write(`  ${msg}\n`);
}

function step(name: string): void {
  process.stderr.write(`\n[hora-deploy] ${name}\n`);
}

function run(cmd: string, cwd: string, timeoutMs = 120_000): { ok: boolean; output: string; duration: number } {
  const start = Date.now();
  try {
    const output = child_process.execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    return { ok: true, output: output || "", duration: Date.now() - start };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = (e.stdout || "") + (e.stderr || "") || (e.message || "");
    return { ok: false, output, duration: Date.now() - start };
  }
}

function fileExists(...segments: string[]): boolean {
  return fs.existsSync(path.join(...segments));
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// --- Project detection ---

function detectProject(dir: string): ProjectConfig {
  const pkg = readJson(path.join(dir, "package.json"));
  const scripts = (pkg?.scripts as Record<string, string>) || {};
  const deps = {
    ...((pkg?.dependencies as Record<string, string>) || {}),
    ...((pkg?.devDependencies as Record<string, string>) || {}),
  };

  // Package manager
  let packageManager: ProjectConfig["packageManager"] = "npm";
  if (fileExists(dir, "bun.lockb")) packageManager = "bun";
  else if (fileExists(dir, "pnpm-lock.yaml")) packageManager = "pnpm";
  else if (fileExists(dir, "yarn.lock")) packageManager = "yarn";

  const runCmd = packageManager === "npm" ? "npm run" : packageManager === "bun" ? "bun run" : packageManager;

  // Project type
  let projectType: ProjectConfig["projectType"] = "node";
  if (deps["next"]) projectType = "nextjs";
  else if (deps["vite"]) projectType = "vite";

  // Build command
  const buildCmd = scripts["build"]
    ? `${runCmd} build`
    : projectType === "nextjs"
    ? `${runCmd} build`
    : "echo 'no build script'";

  // Test command
  const testCmd = scripts["test"]
    ? `${runCmd} test`
    : scripts["test:run"]
    ? `${runCmd} test:run`
    : null;

  // Typecheck
  const typecheckCmd = scripts["typecheck"]
    ? `${runCmd} typecheck`
    : scripts["type-check"]
    ? `${runCmd} type-check`
    : fileExists(dir, "tsconfig.json")
    ? "npx tsc --noEmit"
    : null;

  // ORM
  let hasORM: ProjectConfig["hasORM"] = null;
  if (deps["drizzle-orm"]) hasORM = "drizzle";
  else if (deps["@prisma/client"] || deps["prisma"]) hasORM = "prisma";

  // Src dir
  const srcDir = fileExists(dir, "src")
    ? "src"
    : fileExists(dir, "app")
    ? "app"
    : ".";

  return { packageManager, projectType, buildCmd, testCmd, typecheckCmd, hasORM, srcDir };
}

// --- Individual checks ---

function checkBuild(dir: string, cfg: ProjectConfig): CheckResult {
  const weight = 25;
  progress(`Running: ${cfg.buildCmd}`);
  const { ok, output, duration } = run(cfg.buildCmd, dir, 180_000);
  return {
    name: "build",
    status: ok ? "pass" : "fail",
    message: ok
      ? `Build completed in ${(duration / 1000).toFixed(1)}s`
      : `Build failed: ${output.slice(-300).trim()}`,
    duration,
    weight,
    earned: ok ? weight : 0,
  };
}

function checkTests(dir: string, cfg: ProjectConfig): CheckResult {
  const weight = 25;
  if (!cfg.testCmd) {
    return { name: "tests", status: "skip", message: "No test script found in package.json", duration: 0, weight, earned: weight };
  }
  const vitest = cfg.testCmd.includes("vitest");
  const cmd = vitest ? cfg.testCmd + " --run" : cfg.testCmd;
  progress(`Running: ${cmd}`);
  const { ok, output, duration } = run(cmd, dir, 120_000);
  return {
    name: "tests",
    status: ok ? "pass" : "fail",
    message: ok
      ? `Tests passed in ${(duration / 1000).toFixed(1)}s`
      : `Tests failed: ${output.slice(-400).trim()}`,
    duration,
    weight,
    earned: ok ? weight : 0,
  };
}

function checkTypes(dir: string, cfg: ProjectConfig): CheckResult {
  const weight = 15;
  if (!cfg.typecheckCmd) {
    return { name: "typescript", status: "skip", message: "No tsconfig.json found", duration: 0, weight, earned: weight };
  }
  progress(`Running: ${cfg.typecheckCmd}`);
  const { ok, output, duration } = run(cfg.typecheckCmd, dir, 60_000);
  return {
    name: "typescript",
    status: ok ? "pass" : "fail",
    message: ok
      ? `No type errors (${(duration / 1000).toFixed(1)}s)`
      : `Type errors found: ${output.slice(-400).trim()}`,
    duration,
    weight,
    earned: ok ? weight : 0,
  };
}

function checkConsoleLogs(dir: string, cfg: ProjectConfig): CheckResult {
  const weight = 10;
  const srcPath = path.join(dir, cfg.srcDir);
  if (!fs.existsSync(srcPath)) {
    return { name: "console.log", status: "skip", message: `Directory ${cfg.srcDir}/ not found`, duration: 0, weight, earned: weight };
  }
  const start = Date.now();
  const exts = "ts,tsx,js,jsx,mts,mjs";
  const { ok, output } = run(
    `grep -rn "console\\.log" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.mts" --include="*.mjs" ${JSON.stringify(srcPath)}`,
    dir
  );
  const duration = Date.now() - start;
  // grep exits 0 if found, 1 if not found
  const found = output.trim().split("\n").filter((l) => l.trim().length > 0);
  const count = found.length;
  if (count === 0) {
    return { name: "console.log", status: "pass", message: `No console.log found in ${cfg.srcDir}/`, duration, weight, earned: weight };
  }
  const preview = found.slice(0, 3).join("\n");
  return {
    name: "console.log",
    status: "warn",
    message: `${count} console.log found in ${cfg.srcDir}/:\n${preview}${count > 3 ? `\n... and ${count - 3} more` : ""}`,
    duration,
    weight,
    earned: Math.floor(weight / 2),
  };
}

function checkGitStatus(dir: string): CheckResult {
  const weight = 10;
  const start = Date.now();
  const { ok, output } = run("git status --porcelain", dir);
  const duration = Date.now() - start;
  if (!ok) {
    return { name: "git-status", status: "skip", message: "Not a git repository", duration, weight, earned: weight };
  }
  const lines = output.trim().split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { name: "git-status", status: "pass", message: "Working tree clean — no uncommitted changes", duration, weight, earned: weight };
  }
  return {
    name: "git-status",
    status: "warn",
    message: `${lines.length} uncommitted change(s):\n${lines.slice(0, 5).join("\n")}${lines.length > 5 ? `\n... and ${lines.length - 5} more` : ""}`,
    duration,
    weight,
    earned: Math.floor(weight / 2),
  };
}

function checkEnvVars(dir: string): CheckResult {
  const weight = 10;
  const start = Date.now();
  const examplePath = path.join(dir, ".env.example");
  const envPath = path.join(dir, ".env");

  if (!fs.existsSync(examplePath)) {
    return { name: "env-vars", status: "skip", message: "No .env.example found — skipping env check", duration: Date.now() - start, weight, earned: weight };
  }

  const exampleContent = fs.readFileSync(examplePath, "utf-8");
  const requiredVars = exampleContent
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l.trim()))
    .map((l) => l.split("=")[0].trim());

  if (requiredVars.length === 0) {
    return { name: "env-vars", status: "skip", message: ".env.example has no variables defined", duration: Date.now() - start, weight, earned: weight };
  }

  // Check local .env file
  const localVars = new Set<string>();
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf-8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l.trim()))
      .forEach((l) => localVars.add(l.split("=")[0].trim()));
  }

  // Also check process.env (injected by platform)
  const platformVars = new Set(Object.keys(process.env));

  const missing = requiredVars.filter((v) => !localVars.has(v) && !platformVars.has(v));
  const duration = Date.now() - start;

  if (missing.length === 0) {
    return { name: "env-vars", status: "pass", message: `All ${requiredVars.length} required vars present`, duration, weight, earned: weight };
  }
  return {
    name: "env-vars",
    status: "warn",
    message: `${missing.length} var(s) from .env.example missing in .env / environment:\n${missing.join(", ")}`,
    duration,
    weight,
    earned: Math.floor(weight / 2),
  };
}

function checkDependencies(dir: string, cfg: ProjectConfig): CheckResult {
  const weight = 5;
  if (cfg.packageManager !== "npm") {
    return { name: "dependencies", status: "skip", message: `npm audit only supported for npm (detected: ${cfg.packageManager})`, duration: 0, weight, earned: weight };
  }
  progress("Running: npm audit --audit-level=high");
  const { ok, output, duration } = run("npm audit --audit-level=high --json", dir, 30_000);
  if (ok) {
    return { name: "dependencies", status: "pass", message: "No high/critical vulnerabilities", duration, weight, earned: weight };
  }
  // Parse audit output
  try {
    const parsed = JSON.parse(output) as { metadata?: { vulnerabilities?: { high?: number; critical?: number } } };
    const vulns = parsed.metadata?.vulnerabilities;
    const count = (vulns?.high || 0) + (vulns?.critical || 0);
    return {
      name: "dependencies",
      status: "warn",
      message: `${count} high/critical vulnerability(ies) found — run npm audit for details`,
      duration,
      weight,
      earned: 0,
    };
  } catch {
    return { name: "dependencies", status: "warn", message: "npm audit reported issues — check manually", duration, weight, earned: 0 };
  }
}

function checkTodos(dir: string, cfg: ProjectConfig): CheckResult {
  const weight = 5;
  const srcPath = path.join(dir, cfg.srcDir);
  if (!fs.existsSync(srcPath)) {
    return { name: "todos", status: "skip", message: `Directory ${cfg.srcDir}/ not found`, duration: 0, weight, earned: weight };
  }
  const start = Date.now();
  const { output } = run(
    `grep -rn "TODO\\|FIXME\\|HACK" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ${JSON.stringify(srcPath)}`,
    dir
  );
  const duration = Date.now() - start;
  const found = output.trim().split("\n").filter((l) => l.trim().length > 0);
  if (found.length === 0) {
    return { name: "todos", status: "pass", message: `No TODO/FIXME/HACK in ${cfg.srcDir}/`, duration, weight, earned: weight };
  }
  return {
    name: "todos",
    status: "warn",
    message: `${found.length} TODO/FIXME/HACK found:\n${found.slice(0, 3).join("\n")}${found.length > 3 ? `\n... and ${found.length - 3} more` : ""}`,
    duration,
    weight,
    earned: Math.floor(weight / 2),
  };
}

function checkMigrations(dir: string, cfg: ProjectConfig): CheckResult {
  const weight = 5;
  if (!cfg.hasORM) {
    return { name: "migrations", status: "skip", message: "No ORM detected", duration: 0, weight, earned: weight };
  }
  const start = Date.now();
  if (cfg.hasORM === "drizzle") {
    // Check if drizzle-kit is available and migrations dir exists
    const migrationsDir = fileExists(dir, "drizzle")
      ? path.join(dir, "drizzle")
      : fileExists(dir, "migrations")
      ? path.join(dir, "migrations")
      : null;
    if (!migrationsDir) {
      return { name: "migrations", status: "warn", message: "Drizzle detected but no migrations/ or drizzle/ directory found", duration: Date.now() - start, weight, earned: Math.floor(weight / 2) };
    }
    return { name: "migrations", status: "pass", message: `Drizzle migrations directory found at ${path.relative(dir, migrationsDir)}/`, duration: Date.now() - start, weight, earned: weight };
  }
  if (cfg.hasORM === "prisma") {
    const { ok, output, duration } = run("npx prisma migrate status", dir, 30_000);
    if (ok) {
      return { name: "migrations", status: "pass", message: "Prisma migrations are up to date", duration, weight, earned: weight };
    }
    if (output.includes("have not yet been applied")) {
      return { name: "migrations", status: "fail", message: "Pending Prisma migrations — run prisma migrate deploy", duration, weight, earned: 0 };
    }
    return { name: "migrations", status: "warn", message: "Could not verify Prisma migration status", duration, weight, earned: Math.floor(weight / 2) };
  }
  return { name: "migrations", status: "skip", message: "ORM detection inconclusive", duration: Date.now() - start, weight, earned: weight };
}

// --- Scoring ---

function computeScore(checks: CheckResult[]): { score: number; recommendation: Recommendation } {
  const totalWeight = checks.filter((c) => c.status !== "skip").reduce((s, c) => s + c.weight, 0);
  const totalEarned = checks.reduce((s, c) => s + c.earned, 0);
  const score = totalWeight === 0 ? 100 : Math.round((totalEarned / totalWeight) * 100);
  const recommendation: Recommendation = score >= 80 ? "GO" : score >= 60 ? "REVIEW" : "NO-GO";
  return { score, recommendation };
}

// --- Main ---

function main(): void {
  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  const pkg = readJson(path.join(projectDir, "package.json"));
  if (!pkg) {
    process.stderr.write(`Error: no package.json found in ${projectDir}\n`);
    process.exit(1);
  }

  process.stderr.write(`\n[hora-deploy] Pre-deploy check — ${path.basename(projectDir)}\n`);
  process.stderr.write(`Mode: ${isQuick ? "quick" : "full"}\n`);

  step("1/3 SCAN — Detecting project config");
  const cfg = detectProject(projectDir);
  progress(`Project type : ${cfg.projectType}`);
  progress(`Package manager: ${cfg.packageManager}`);
  progress(`Build cmd : ${cfg.buildCmd}`);
  progress(`Test cmd : ${cfg.testCmd || "none"}`);
  progress(`TypeCheck cmd : ${cfg.typecheckCmd || "none"}`);
  progress(`ORM : ${cfg.hasORM || "none"}`);

  step("2/3 CHECK — Running checks");

  const checks: CheckResult[] = [];

  // Build (always)
  if (!skipChecks.has("build")) {
    progress("[ ] build...");
    const r = checkBuild(projectDir, cfg);
    checks.push(r);
    progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] build: ${r.status}`);
  }

  // Tests (always)
  if (!skipChecks.has("tests")) {
    progress("[ ] tests...");
    const r = checkTests(projectDir, cfg);
    checks.push(r);
    progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] tests: ${r.status}`);
  }

  // TypeScript (always)
  if (!skipChecks.has("typescript")) {
    progress("[ ] typescript...");
    const r = checkTypes(projectDir, cfg);
    checks.push(r);
    progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] typescript: ${r.status}`);
  }

  if (!isQuick) {
    // console.log
    if (!skipChecks.has("console")) {
      progress("[ ] console.log...");
      const r = checkConsoleLogs(projectDir, cfg);
      checks.push(r);
      progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] console.log: ${r.status}`);
    }

    // git status
    if (!skipChecks.has("git")) {
      progress("[ ] git-status...");
      const r = checkGitStatus(projectDir);
      checks.push(r);
      progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] git-status: ${r.status}`);
    }

    // env vars
    if (!skipChecks.has("env")) {
      progress("[ ] env-vars...");
      const r = checkEnvVars(projectDir);
      checks.push(r);
      progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] env-vars: ${r.status}`);
    }

    // dependencies
    if (!skipChecks.has("deps")) {
      progress("[ ] dependencies...");
      const r = checkDependencies(projectDir, cfg);
      checks.push(r);
      progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] dependencies: ${r.status}`);
    }

    // todos
    if (!skipChecks.has("todos")) {
      progress("[ ] todos...");
      const r = checkTodos(projectDir, cfg);
      checks.push(r);
      progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] todos: ${r.status}`);
    }

    // migrations
    if (!skipChecks.has("migrations")) {
      progress("[ ] migrations...");
      const r = checkMigrations(projectDir, cfg);
      checks.push(r);
      progress(`[${r.status === "pass" ? "v" : r.status === "skip" ? "-" : "x"}] migrations: ${r.status}`);
    }
  }

  step("3/3 REPORT");

  const { score, recommendation } = computeScore(checks);
  const passed = checks.filter((c) => c.status === "pass").length;
  const total = checks.filter((c) => c.status !== "skip").length;

  const report: DeployReport = {
    timestamp: new Date().toISOString(),
    project: projectDir,
    mode: isQuick ? "quick" : "full",
    score,
    recommendation,
    checks,
    summary: `${passed}/${total} checks passed`,
  };

  // Human-readable summary to stderr
  process.stderr.write(`\n--- Deploy Report ---\n`);
  process.stderr.write(`Score : ${score}/100\n`);
  process.stderr.write(`Result: ${recommendation}\n`);
  process.stderr.write(`Summary: ${report.summary}\n\n`);

  for (const check of checks) {
    const icon = check.status === "pass" ? "[v]" : check.status === "skip" ? "[-]" : check.status === "warn" ? "[!]" : "[x]";
    const pts = check.status !== "skip" ? ` (${check.earned}/${check.weight}pt)` : " (skipped)";
    process.stderr.write(`  ${icon} ${check.name}${pts}\n`);
    if (check.status !== "pass" && check.status !== "skip") {
      const preview = check.message.split("\n")[0];
      process.stderr.write(`      ${preview}\n`);
    }
  }

  process.stderr.write(`\n`);

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  process.exit(recommendation === "GO" ? 0 : recommendation === "REVIEW" ? 0 : 1);
}

main();
