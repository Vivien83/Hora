#!/usr/bin/env node
// hora-browser bootstrap — handles paths with spaces (tsx bug workaround)
// This file is plain JS so it can be invoked directly by `node`

import { execFileSync } from "node:child_process";
import { existsSync, symlinkSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const browseTsPath = join(__dirname, "browse.ts");

// If path contains spaces, create a symlink in /tmp and run from there
const hasSpaces = browseTsPath.includes(" ");

let targetScript = browseTsPath;
if (hasSpaces) {
  const linkDir = join(tmpdir(), "hora-browser-link");
  mkdirSync(linkDir, { recursive: true });

  // Symlink the entire scripts directory
  const linkPath = join(linkDir, "scripts");
  try { unlinkSync(linkPath); } catch { /* doesn't exist yet */ }
  symlinkSync(__dirname, linkPath);

  targetScript = join(linkPath, "browse.ts");
}

// Find tsx
let tsxBin;
try {
  tsxBin = execFileSync("which", ["tsx"], { encoding: "utf-8" }).trim();
} catch {
  tsxBin = "npx";
}

const tsxArgs = tsxBin.endsWith("tsx") ? [targetScript, ...process.argv.slice(2)] : ["tsx", targetScript, ...process.argv.slice(2)];

try {
  execFileSync(tsxBin, tsxArgs, {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  process.exit(err.status || 1);
}
