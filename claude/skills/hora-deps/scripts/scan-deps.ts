#!/usr/bin/env npx tsx
/**
 * hora-deps: scan-deps.ts
 * Detecte le package manager, scanne les packages obsoletes et audite les vulnerabilites.
 * Output: JSON sur stdout. Progress sur stderr.
 * Usage: npx tsx scan-deps.ts [project-dir]
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
type DepType = "dependencies" | "devDependencies";
type Severity = "critical" | "high" | "moderate" | "low" | "info";

interface OutdatedEntry {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: DepType;
  breaking: boolean;
}

interface Vulnerability {
  name: string;
  severity: Severity;
  title: string;
  url: string | null;
  fixAvailable: boolean | string;
}

interface ScanResult {
  packageManager: PackageManager;
  totalDeps: number;
  totalDevDeps: number;
  outdated: OutdatedEntry[];
  vulnerabilities: Vulnerability[];
  summary: {
    outdatedCount: number;
    breakingCount: number;
    criticalVulns: number;
    highVulns: number;
    moderateVulns: number;
    lowVulns: number;
  };
}

function log(msg: string): void {
  process.stderr.write(`[hora-deps] ${msg}\n`);
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function execSafe(cmd: string, cwd: string): { stdout: string; stderr: string; ok: boolean } {
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      // timeout 60s pour les commandes reseau (audit)
      timeout: 60_000,
    });
    return { stdout, stderr: "", ok: true };
  } catch (err: unknown) {
    // execSync throw si exit code != 0
    // npm outdated retourne exit 1 quand il y a des packages outdated — c'est voulu
    const e = err as { stdout?: string; stderr?: string };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      ok: false,
    };
  }
}

/**
 * Detecte le package manager par la presence des lockfiles.
 * Ordre de priorite : bun > pnpm > yarn > npm
 */
function detectPackageManager(projectDir: string): PackageManager {
  if (fileExists(path.join(projectDir, "bun.lockb"))) return "bun";
  if (fileExists(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (
    fileExists(path.join(projectDir, "yarn.lock")) &&
    !fileExists(path.join(projectDir, "package-lock.json"))
  )
    return "yarn";
  return "npm";
}

/**
 * Lit package.json et retourne dependencies + devDependencies.
 */
function readPackageJson(projectDir: string): {
  deps: Record<string, string>;
  devDeps: Record<string, string>;
} {
  const pkgPath = path.join(projectDir, "package.json");
  if (!fileExists(pkgPath)) {
    throw new Error(`package.json non trouve dans ${projectDir}`);
  }
  const raw = fs.readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return {
    deps: pkg.dependencies ?? {},
    devDeps: pkg.devDependencies ?? {},
  };
}

/**
 * Parse la sortie de `npm outdated --json`.
 * npm outdated JSON : { "package": { current, wanted, latest, location, type } }
 * Note : sort sur stderr + exit 1 quand il y a des outdated — on capture les deux.
 */
function parseNpmOutdated(
  json: string,
  deps: Record<string, string>,
  devDeps: Record<string, string>
): OutdatedEntry[] {
  if (!json.trim()) return [];
  let parsed: Record<
    string,
    { current?: string; wanted?: string; latest?: string; type?: string }
  >;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  return Object.entries(parsed).map(([name, info]) => {
    const current = info.current ?? "0.0.0";
    const latest = info.latest ?? current;
    const wanted = info.wanted ?? latest;
    const inDevDeps = name in devDeps;
    const type: DepType = inDevDeps ? "devDependencies" : "dependencies";

    // Breaking = changement de major version
    const currentMajor = parseInt(current.replace(/[^0-9.].*/, "").split(".")[0] ?? "0", 10);
    const latestMajor = parseInt(latest.replace(/[^0-9.].*/, "").split(".")[0] ?? "0", 10);
    const breaking = latestMajor > currentMajor;

    return { name, current, wanted, latest, type, breaking };
  });
}

/**
 * Parse la sortie de `pnpm outdated --json`.
 * Format pnpm : { "package": { current, latest, wanted } } — similaire npm mais sans "type"
 */
function parsePnpmOutdated(
  json: string,
  deps: Record<string, string>,
  devDeps: Record<string, string>
): OutdatedEntry[] {
  // pnpm outdated --json utilise le meme format que npm
  return parseNpmOutdated(json, deps, devDeps);
}

/**
 * Parse `npm audit --json`.
 * Format npm v7+ : { vulnerabilities: { [name]: { severity, via, fixAvailable } } }
 */
function parseNpmAudit(json: string): Vulnerability[] {
  if (!json.trim()) return [];
  let parsed: {
    vulnerabilities?: Record<
      string,
      {
        severity?: string;
        via?: Array<{ title?: string; url?: string } | string>;
        fixAvailable?: boolean | { name: string; version: string };
      }
    >;
    advisories?: Record<
      string,
      {
        severity?: string;
        title?: string;
        url?: string;
        findings?: Array<{ version: string }>;
        module_name?: string;
        cves?: string[];
      }
    >;
  };

  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  // Format npm v7+
  if (parsed.vulnerabilities) {
    return Object.entries(parsed.vulnerabilities).map(([name, vuln]) => {
      const severity = (vuln.severity ?? "low") as Severity;
      // via peut contenir des objets ou des strings (dependances transitives)
      const viaObj = (vuln.via ?? []).find((v) => typeof v === "object") as
        | { title?: string; url?: string }
        | undefined;
      const title = viaObj?.title ?? `Vulnerabilite dans ${name}`;
      const url = viaObj?.url ?? null;
      const fixAvailable =
        typeof vuln.fixAvailable === "boolean"
          ? vuln.fixAvailable
          : typeof vuln.fixAvailable === "object"
          ? `${vuln.fixAvailable.name}@${vuln.fixAvailable.version}`
          : false;

      return { name, severity, title, url, fixAvailable };
    });
  }

  // Format npm v6 (advisories)
  if (parsed.advisories) {
    return Object.values(parsed.advisories).map((adv) => ({
      name: adv.module_name ?? "unknown",
      severity: (adv.severity ?? "low") as Severity,
      title: adv.title ?? "Vulnerabilite",
      url: adv.url ?? null,
      fixAvailable: false,
    }));
  }

  return [];
}

/**
 * Parse `pnpm audit --json`.
 * Format pnpm : similaire npm v6 advisories.
 */
function parsePnpmAudit(json: string): Vulnerability[] {
  if (!json.trim()) return [];
  let parsed: {
    advisories?: Record<
      string,
      { module_name?: string; severity?: string; title?: string; url?: string }
    >;
    vulnerabilities?: Record<string, { severity?: string; via?: unknown[]; fixAvailable?: unknown }>;
  };
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  // pnpm >= 8 utilise le format npm v7
  if (parsed.vulnerabilities) {
    return parseNpmAudit(json);
  }
  // pnpm < 8 utilise advisories
  if (parsed.advisories) {
    return Object.values(parsed.advisories).map((adv) => ({
      name: adv.module_name ?? "unknown",
      severity: (adv.severity ?? "low") as Severity,
      title: adv.title ?? "Vulnerabilite",
      url: adv.url ?? null,
      fixAvailable: false,
    }));
  }
  return [];
}

function runOutdated(pm: PackageManager, projectDir: string, deps: Record<string, string>, devDeps: Record<string, string>): OutdatedEntry[] {
  log(`Scan des packages obsoletes avec ${pm}...`);

  let result: ReturnType<typeof execSafe>;

  switch (pm) {
    case "npm":
      result = execSafe("npm outdated --json", projectDir);
      break;
    case "pnpm":
      result = execSafe("pnpm outdated --json", projectDir);
      break;
    case "yarn":
      // yarn v1 : yarn outdated --json ; yarn v2+ pas de JSON natif
      result = execSafe("yarn outdated --json 2>/dev/null || echo '{}'", projectDir);
      break;
    case "bun":
      // bun n'a pas de commande outdated native — fallback npm
      log("bun detecte — fallback sur npm outdated pour le scan");
      result = execSafe("npm outdated --json", projectDir);
      break;
  }

  // npm/pnpm sortent sur stdout meme avec exit 1
  const json = result!.stdout || result!.stderr;

  if (pm === "pnpm") return parsePnpmOutdated(json, deps, devDeps);
  return parseNpmOutdated(json, deps, devDeps);
}

function runAudit(pm: PackageManager, projectDir: string): Vulnerability[] {
  log(`Audit de securite avec ${pm}...`);

  let result: ReturnType<typeof execSafe>;

  switch (pm) {
    case "npm":
      result = execSafe("npm audit --json", projectDir);
      break;
    case "pnpm":
      result = execSafe("pnpm audit --json", projectDir);
      break;
    case "yarn":
      result = execSafe("yarn npm audit --json 2>/dev/null || echo '{}'", projectDir);
      break;
    case "bun":
      // bun audit n'a pas de JSON — fallback npm
      log("bun detecte — fallback sur npm audit pour l'audit securite");
      result = execSafe("npm audit --json", projectDir);
      break;
  }

  const json = result!.stdout || result!.stderr;

  if (pm === "pnpm") return parsePnpmAudit(json);
  return parseNpmAudit(json);
}

function main(): void {
  const projectDir = path.resolve(process.argv[2] ?? process.cwd());
  log(`Analyse du projet : ${projectDir}`);

  if (!fileExists(projectDir)) {
    process.stderr.write(`[hora-deps] Erreur : repertoire non trouve : ${projectDir}\n`);
    process.exit(1);
  }

  // Step 1 — Package manager
  log("Detection du package manager...");
  const pm = detectPackageManager(projectDir);
  log(`Package manager : ${pm}`);

  // Step 2 — Lire package.json
  log("Lecture de package.json...");
  let deps: Record<string, string>;
  let devDeps: Record<string, string>;
  try {
    ({ deps, devDeps } = readPackageJson(projectDir));
  } catch (err: unknown) {
    process.stderr.write(`[hora-deps] Erreur : ${(err as Error).message}\n`);
    process.exit(1);
  }

  const totalDeps = Object.keys(deps).length;
  const totalDevDeps = Object.keys(devDeps).length;
  log(`Dependencies : ${totalDeps} prod + ${totalDevDeps} dev`);

  // Step 3 — Outdated
  const outdated = runOutdated(pm, projectDir, deps, devDeps);
  log(`Packages obsoletes : ${outdated.length}`);

  // Step 4 — Audit
  const vulnerabilities = runAudit(pm, projectDir);
  log(`Vulnerabilites : ${vulnerabilities.length}`);

  // Step 5 — Summary
  const summary = {
    outdatedCount: outdated.length,
    breakingCount: outdated.filter((o) => o.breaking).length,
    criticalVulns: vulnerabilities.filter((v) => v.severity === "critical").length,
    highVulns: vulnerabilities.filter((v) => v.severity === "high").length,
    moderateVulns: vulnerabilities.filter((v) => v.severity === "moderate").length,
    lowVulns: vulnerabilities.filter((v) => v.severity === "low").length,
  };

  const result: ScanResult = {
    packageManager: pm,
    totalDeps,
    totalDevDeps,
    outdated,
    vulnerabilities,
    summary,
  };

  log("Scan termine.");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();
