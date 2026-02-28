#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/parse-commits.ts [--since tag-or-sha] [--format markdown|json]
// Parses git log and generates structured changelog.
// Outputs JSON to stdout (or markdown with --format markdown), human-readable summary to stderr.

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

interface CommitInfo {
  hash: string;
  shortHash: string;
  type: string;
  scope: string | null;
  description: string;
  author: string;
  date: string;
  breaking: boolean;
  breakingNote: string | null;
  raw: string;
}

interface ChangelogResult {
  version: string | null;
  date: string;
  since: string | null;
  totalCommits: number;
  categories: Record<string, CommitInfo[]>;
  breaking: CommitInfo[];
  uncategorized: CommitInfo[];
}

const COMMIT_TYPES: Record<string, string> = {
  feat: "New Features",
  fix: "Bug Fixes",
  refactor: "Refactoring",
  docs: "Documentation",
  perf: "Performance",
  test: "Tests",
  chore: "Chores",
  build: "Build",
  ci: "CI/CD",
  style: "Code Style",
};

function parseArgs(args: string[]): { since: string | null; format: "json" | "markdown" } {
  let since: string | null = null;
  let format: "json" | "markdown" = "json";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since" && i + 1 < args.length) {
      since = args[++i];
    } else if (args[i] === "--format" && i + 1 < args.length) {
      format = args[++i] === "markdown" ? "markdown" : "json";
    }
  }

  return { since, format };
}

function execGit(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch (err: unknown) {
    if (err instanceof Error) {
      process.stderr.write(`Git error: ${err.message}\n`);
    }
    return "";
  }
}

function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getLatestTag(): string | null {
  const tag = execGit("git describe --tags --abbrev=0 2>/dev/null || true");
  return tag || null;
}

function detectVersion(): string | null {
  const pkgPath = path.resolve("package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return pkg.version ? `v${pkg.version}` : null;
    } catch {
      return null;
    }
  }
  return null;
}

function getCommits(since: string | null): string[] {
  const range = since ? `${since}..HEAD` : "";
  const format = "%H|%h|%s|%an|%aI|%b%x00";
  const command = `git log --format="${format}" ${range}`;
  const output = execGit(command);

  if (!output) return [];

  // Split by null byte separator
  return output.split("\x00").filter((entry) => entry.trim());
}

function parseCommit(raw: string): CommitInfo | null {
  const lines = raw.trim().split("\n");
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const parts = firstLine.split("|");
  if (parts.length < 5) return null;

  const hash = parts[0];
  const shortHash = parts[1];
  const subject = parts[2];
  const author = parts[3];
  const date = parts[4];
  const body = parts.slice(5).join("|") + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "");

  // Parse conventional commit: type(scope)!: description
  const conventionalMatch = subject.match(
    /^(\w+)(?:\(([^)]+)\))?(!)?\s*:\s*(.+)$/
  );

  let type = "other";
  let scope: string | null = null;
  let description = subject;
  let breaking = false;
  let breakingNote: string | null = null;

  if (conventionalMatch) {
    type = conventionalMatch[1].toLowerCase();
    scope = conventionalMatch[2] || null;
    breaking = conventionalMatch[3] === "!";
    description = conventionalMatch[4].trim();
  }

  // Check for BREAKING CHANGE in body
  const breakingMatch = body.match(/BREAKING[\s-]CHANGE:\s*(.+)/i);
  if (breakingMatch) {
    breaking = true;
    breakingNote = breakingMatch[1].trim();
  }

  if (breaking && !breakingNote) {
    breakingNote = description;
  }

  return {
    hash,
    shortHash,
    type,
    scope,
    description,
    author,
    date,
    breaking,
    breakingNote,
    raw: subject,
  };
}

function categorize(commits: CommitInfo[]): ChangelogResult {
  const categories: Record<string, CommitInfo[]> = {};
  const breaking: CommitInfo[] = [];
  const uncategorized: CommitInfo[] = [];

  for (const commit of commits) {
    if (commit.breaking) {
      breaking.push(commit);
    }

    if (COMMIT_TYPES[commit.type]) {
      if (!categories[commit.type]) categories[commit.type] = [];
      categories[commit.type].push(commit);
    } else if (commit.type !== "other") {
      // Unknown type, still categorize
      if (!categories[commit.type]) categories[commit.type] = [];
      categories[commit.type].push(commit);
    } else {
      uncategorized.push(commit);
    }
  }

  return {
    version: detectVersion(),
    date: new Date().toISOString().split("T")[0],
    since: null,
    totalCommits: commits.length,
    categories,
    breaking,
    uncategorized,
  };
}

function formatMarkdown(result: ChangelogResult): string {
  const lines: string[] = [];

  // Title
  const title = result.version || "Unreleased";
  lines.push(`# ${title} (${result.date})`);
  lines.push("");

  // Breaking changes
  if (result.breaking.length > 0) {
    lines.push("## Breaking Changes");
    for (const commit of result.breaking) {
      const scope = commit.scope ? `**${commit.scope}**: ` : "";
      const note = commit.breakingNote || commit.description;
      lines.push(`- ${scope}${note}`);
    }
    lines.push("");
  }

  // Categorized commits (in a specific order)
  const typeOrder = ["feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "style"];

  for (const type of typeOrder) {
    const commits = result.categories[type];
    if (!commits || commits.length === 0) continue;

    const label = COMMIT_TYPES[type] || type;
    lines.push(`## ${label}`);
    for (const commit of commits) {
      const scope = commit.scope ? `**${commit.scope}**: ` : "";
      lines.push(`- ${scope}${commit.description}`);
    }
    lines.push("");
  }

  // Unknown types
  for (const [type, commits] of Object.entries(result.categories)) {
    if (typeOrder.includes(type)) continue;
    if (commits.length === 0) continue;
    lines.push(`## ${type}`);
    for (const commit of commits) {
      const scope = commit.scope ? `**${commit.scope}**: ` : "";
      lines.push(`- ${scope}${commit.description}`);
    }
    lines.push("");
  }

  // Uncategorized
  if (result.uncategorized.length > 0) {
    lines.push("## Other Changes");
    for (const commit of result.uncategorized) {
      lines.push(`- ${commit.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main(): void {
  if (!isGitRepo()) {
    process.stderr.write("Error: not a git repository\n");
    process.exit(1);
  }

  const { since, format } = parseArgs(process.argv.slice(2));

  // Determine the starting point
  let effectiveSince = since;
  if (!effectiveSince) {
    effectiveSince = getLatestTag();
    if (effectiveSince) {
      process.stderr.write(`Using latest tag as starting point: ${effectiveSince}\n`);
    } else {
      process.stderr.write(`No tags found, using all commits\n`);
    }
  }

  // Get and parse commits
  const rawCommits = getCommits(effectiveSince);
  const commits: CommitInfo[] = [];

  for (const raw of rawCommits) {
    const commit = parseCommit(raw);
    if (commit) commits.push(commit);
  }

  if (commits.length === 0) {
    process.stderr.write("No commits found in the specified range\n");
    const emptyResult: ChangelogResult = {
      version: detectVersion(),
      date: new Date().toISOString().split("T")[0],
      since: effectiveSince,
      totalCommits: 0,
      categories: {},
      breaking: [],
      uncategorized: [],
    };

    if (format === "markdown") {
      process.stdout.write(formatMarkdown(emptyResult) + "\n");
    } else {
      process.stdout.write(JSON.stringify(emptyResult, null, 2) + "\n");
    }
    process.exit(0);
  }

  const result = categorize(commits);
  result.since = effectiveSince;

  if (format === "markdown") {
    // Markdown to stdout
    process.stdout.write(formatMarkdown(result) + "\n");
  } else {
    // JSON to stdout
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }

  // Human-readable summary to stderr
  process.stderr.write(`\n--- Changelog Summary ---\n`);
  process.stderr.write(`Since: ${effectiveSince || "beginning"}\n`);
  process.stderr.write(`Total commits: ${result.totalCommits}\n`);
  process.stderr.write(`Breaking changes: ${result.breaking.length}\n`);

  for (const [type, commits] of Object.entries(result.categories)) {
    const label = COMMIT_TYPES[type] || type;
    process.stderr.write(`  ${label}: ${commits.length}\n`);
  }

  if (result.uncategorized.length > 0) {
    process.stderr.write(`  Uncategorized: ${result.uncategorized.length}\n`);
  }
  process.stderr.write(`\n`);
}

main();
