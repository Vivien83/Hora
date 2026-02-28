#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/security-scan.ts [project-dir]
// Defaults to current directory

import fs from "node:fs";
import path from "node:path";

// --- Types ---

interface Finding {
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  snippet: string;
  message: string;
}

interface ScanResult {
  scannedFiles: number;
  findings: Finding[];
  summary: Record<string, number>;
}

// --- Config ---

const SCAN_DIRS = ["src", "app", "pages", "lib", "components", "services"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", ".hora"]);
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const RULES: Array<{
  id: string;
  severity: Finding["severity"];
  pattern: RegExp;
  message: string;
}> = [
  {
    id: "hardcoded-secret",
    severity: "critical",
    pattern:
      /(?:password|passwd|secret|api_?key|token|auth|private_?key)\s*[:=]\s*["'`][^"'`]{4,}/i,
    message: "Potential hardcoded secret detected",
  },
  {
    id: "hardcoded-secret-const",
    severity: "critical",
    pattern:
      /(?:const|let|var)\s+(?:\w*(?:password|secret|apiKey|token|privateKey)\w*)\s*=\s*["'`][^"'`]{4,}/i,
    message: "Potential hardcoded secret in variable assignment",
  },
  {
    id: "dangerous-html",
    severity: "high",
    pattern: /dangerouslySetInnerHTML/,
    message: "dangerouslySetInnerHTML usage — XSS risk",
  },
  {
    id: "raw-sql",
    severity: "high",
    pattern: /\.raw\s*\(|sql\s*`/,
    message: "Raw SQL query — SQL injection risk",
  },
  {
    id: "command-injection",
    severity: "high",
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(/,
    message: "Shell command execution — command injection risk",
  },
  {
    id: "empty-catch",
    severity: "medium",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    message: "Empty catch block — silent error swallowing",
  },
  {
    id: "math-random-security",
    severity: "medium",
    pattern:
      /Math\.random\s*\(\).*(?:token|secret|key|password|hash|salt|nonce|id)/i,
    message: "Math.random() used in security context — use crypto.randomUUID()",
  },
  {
    id: "math-random-security-reverse",
    severity: "medium",
    pattern:
      /(?:token|secret|key|password|hash|salt|nonce|id).*Math\.random\s*\(\)/i,
    message: "Math.random() used in security context — use crypto.randomUUID()",
  },
  {
    id: "eval-usage",
    severity: "critical",
    pattern: /\beval\s*\(/,
    message: "eval() usage — code injection risk",
  },
  {
    id: "no-auth-header-check",
    severity: "medium",
    pattern: /req\.headers\s*\[\s*["']authorization["']\s*\]/,
    message:
      "Direct authorization header access — ensure proper auth middleware",
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
      } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function scanFile(filePath: string, projectDir: string): Finding[] {
  const findings: Finding[] = [];
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
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file: relPath,
          line: i + 1,
          snippet: line.trim().substring(0, 120),
          message: rule.message,
        });
      }
    }
  }

  return findings;
}

function checkEnvFiles(projectDir: string): Finding[] {
  const findings: Finding[] = [];

  // Check for .env without .gitignore entry
  const gitignorePath = path.join(projectDir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes(".env")) {
      findings.push({
        rule: "missing-gitignore-env",
        severity: "critical",
        file: ".gitignore",
        line: 0,
        snippet: "",
        message: ".env is not listed in .gitignore — secrets may be committed",
      });
    }
  } else {
    findings.push({
      rule: "missing-gitignore",
      severity: "high",
      file: ".gitignore",
      line: 0,
      snippet: "",
      message: "No .gitignore file found",
    });
  }

  // Check for .env.example
  const envExists = fs.existsSync(path.join(projectDir, ".env")) ||
    fs.existsSync(path.join(projectDir, ".env.local"));
  if (envExists && !fs.existsSync(path.join(projectDir, ".env.example"))) {
    findings.push({
      rule: "missing-env-example",
      severity: "low",
      file: ".env.example",
      line: 0,
      snippet: "",
      message:
        ".env exists but .env.example is missing — team members won't know required vars",
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

  process.stderr.write(`Scanning: ${projectDir}\n`);

  const allFindings: Finding[] = [];
  let scannedFiles = 0;

  // Scan source directories
  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(projectDir, dir);
    if (!fs.existsSync(fullDir)) continue;

    const files = collectFiles(fullDir);
    for (const file of files) {
      scannedFiles++;
      allFindings.push(...scanFile(file, projectDir));
    }
  }

  // Check env files
  allFindings.push(...checkEnvFiles(projectDir));

  // Build summary
  const summary: Record<string, number> = {};
  for (const f of allFindings) {
    summary[f.rule] = (summary[f.rule] || 0) + 1;
  }

  const result: ScanResult = {
    scannedFiles,
    findings: allFindings,
    summary,
  };

  // JSON to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Human summary to stderr
  const critical = allFindings.filter((f) => f.severity === "critical").length;
  const high = allFindings.filter((f) => f.severity === "high").length;
  const medium = allFindings.filter((f) => f.severity === "medium").length;
  const low = allFindings.filter((f) => f.severity === "low").length;

  process.stderr.write(`\n--- Security Scan Summary ---\n`);
  process.stderr.write(`Files scanned: ${scannedFiles}\n`);
  process.stderr.write(`Findings: ${allFindings.length}\n`);
  process.stderr.write(
    `  Critical: ${critical} | High: ${high} | Medium: ${medium} | Low: ${low}\n`
  );

  if (allFindings.length > 0) {
    process.stderr.write(`\nTop issues:\n`);
    const sorted = [...allFindings].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
    for (const f of sorted.slice(0, 10)) {
      process.stderr.write(
        `  [${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.message}\n`
      );
    }
  } else {
    process.stderr.write(`No security issues found.\n`);
  }
}

main();
