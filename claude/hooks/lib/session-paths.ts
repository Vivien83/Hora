/**
 * HORA — Session-scoped file paths
 *
 * Ensures each Claude Code session writes to its own files,
 * preventing cross-contamination when multiple sessions run in parallel.
 *
 * Convention:
 *   ~/.claude/.hora/sessions/<sid8>/   — per-session hook state
 *   ~/.claude/MEMORY/STATE/<name>-<sid8>.json — per-session memory state
 *   ~/.claude/MEMORY/.<name>-<sid8>.json      — per-session memory root
 *   <cwd>/.hora/<name>-<sid8><ext>            — per-session project state
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";

const DEFAULT_CLAUDE_DIR = path.join(homedir(), ".claude");

/**
 * Returns the first 8 characters of a session ID (or "unknown").
 * Sanitizes to [a-zA-Z0-9_-] only to prevent path traversal.
 */
export function sid8(sessionId: string | undefined | null): string {
  const raw = sessionId || "";
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  if (sanitized.length === 0) return "unknown";
  return sanitized.length >= 8 ? sanitized.slice(0, 8) : sanitized;
}

/**
 * Session-scoped directory under ~/.claude/.hora/sessions/<sid8>/
 * Used for: context-pct.txt, context-state.json, .compact-recovered
 */
export function getHoraSessionDir(sessionId: string, claudeDir?: string): string {
  const base = claudeDir || DEFAULT_CLAUDE_DIR;
  const dir = path.join(base, ".hora", "sessions", sid8(sessionId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Session-scoped file under ~/.claude/.hora/sessions/<sid8>/<filename>
 */
export function horaSessionFile(sessionId: string, filename: string, claudeDir?: string): string {
  return path.join(getHoraSessionDir(sessionId, claudeDir), filename);
}

/**
 * Session-scoped state file: ~/.claude/MEMORY/STATE/<name>-<sid8>.json
 * Used for: thread-state, pending-user-msg, session-name-cache
 */
export function stateSessionFile(sessionId: string, name: string, ext: string = ".json", claudeDir?: string): string {
  const base = claudeDir || DEFAULT_CLAUDE_DIR;
  const dir = path.join(base, "MEMORY", "STATE");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}-${sid8(sessionId)}${ext}`);
}

/**
 * Session-scoped memory root file: ~/.claude/MEMORY/.<name>-<sid8>.json
 * Used for: .session-state
 */
export function memorySessionFile(sessionId: string, name: string, ext: string = ".json", claudeDir?: string): string {
  const base = claudeDir || DEFAULT_CLAUDE_DIR;
  const dir = path.join(base, "MEMORY");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `.${name}-${sid8(sessionId)}${ext}`);
}

/**
 * Session-scoped project file: <cwd>/.hora/<name>-<sid8><ext>
 * Used for: session-backup-state, .last-check
 */
export function projectSessionFile(sessionId: string, name: string, ext: string = "", cwd?: string): string {
  const dir = path.join(cwd || process.cwd(), ".hora");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}-${sid8(sessionId)}${ext}`);
}

/**
 * Find the most recent file matching a prefix in a directory.
 * Used for cross-session bridging (e.g., thread-state-*.json).
 */
export function findLatestFile(dir: string, prefix: string): string | null {
  try {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(prefix))
      .map(f => ({
        path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? files[0].path : null;
  } catch {
    return null;
  }
}

/**
 * Find and read the most recent file matching prefix, then delete all matching files.
 * Used for thread-state cross-session bridging.
 */
export function readLatestAndClean(dir: string, prefix: string): string | null {
  try {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir).filter(f => f.startsWith(prefix));
    if (entries.length === 0) return null;

    // Build file list with stat — skip files that vanish (race condition)
    const files: { name: string; path: string; mtime: number }[] = [];
    for (const f of entries) {
      const fPath = path.join(dir, f);
      try {
        files.push({ name: f, path: fPath, mtime: fs.statSync(fPath).mtimeMs });
      } catch {
        // File disappeared between readdir and stat — skip
      }
    }
    if (files.length === 0) return null;

    files.sort((a, b) => b.mtime - a.mtime);

    // Read the most recent — may fail if file vanishes (race condition)
    let content: string | null = null;
    try {
      content = fs.readFileSync(files[0].path, "utf-8").trim();
    } catch {
      // File disappeared between stat and read — try next
      for (let i = 1; i < files.length; i++) {
        try {
          content = fs.readFileSync(files[i].path, "utf-8").trim();
          break;
        } catch {}
      }
    }

    // Clean all matching files (they've been consumed)
    for (const f of files) {
      try { fs.unlinkSync(f.path); } catch {}
    }

    return content;
  } catch {
    return null;
  }
}

/**
 * Cleanup expired session directories under ~/.claude/.hora/sessions/
 * and session-scoped files in MEMORY/.
 */
export function cleanupExpiredSessions(maxAgeMs: number = 24 * 60 * 60 * 1000, claudeDir?: string): void {
  const base = claudeDir || DEFAULT_CLAUDE_DIR;
  const now = Date.now();

  // 1. Clean session directories
  const sessionsDir = path.join(base, ".hora", "sessions");
  try {
    if (fs.existsSync(sessionsDir)) {
      for (const entry of fs.readdirSync(sessionsDir)) {
        const entryPath = path.join(sessionsDir, entry);
        try {
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory() && (now - stat.mtimeMs) > maxAgeMs) {
            fs.rmSync(entryPath, { recursive: true, force: true });
          }
        } catch {}
      }
    }
  } catch {}

  // 2. Clean session-scoped files in MEMORY/STATE/
  const stateDir = path.join(base, "MEMORY", "STATE");
  const statePrefixes = ["thread-state-", "pending-user-msg-", "session-name-cache-"];
  cleanExpiredFilesInDir(stateDir, statePrefixes, maxAgeMs, now);

  // 3. Clean session-scoped files in MEMORY/ root
  const memoryDir = path.join(base, "MEMORY");
  cleanExpiredFilesInDir(memoryDir, [".session-state-"], maxAgeMs, now);
}

function cleanExpiredFilesInDir(dir: string, prefixes: string[], maxAgeMs: number, now: number): void {
  try {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (!prefixes.some(p => f.startsWith(p))) continue;
      const fPath = path.join(dir, f);
      try {
        const stat = fs.statSync(fPath);
        if (!stat.isDirectory() && (now - stat.mtimeMs) > maxAgeMs) {
          fs.unlinkSync(fPath);
        }
      } catch {}
    }
  } catch {}
}
