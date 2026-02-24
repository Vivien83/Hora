/**
 * HORA — Session isolation tests
 *
 * Tests that session-scoped file paths prevent cross-contamination
 * between concurrent Claude Code sessions.
 *
 * Maps to ISC-1 through ISC-9 of the Forge spec.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  sid8,
  getHoraSessionDir,
  horaSessionFile,
  stateSessionFile,
  memorySessionFile,
  projectSessionFile,
  findLatestFile,
  readLatestAndClean,
  cleanupExpiredSessions,
} from "../lib/session-paths.js";

// Each test gets its own temp directory
let tmpDir: string;
let claudeDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hora-test-"));
  claudeDir = path.join(tmpDir, ".claude");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────
// Unit tests: sid8
// ─────────────────────────────────────────────────────────────

describe("sid8", () => {
  it("returns first 8 chars of session ID", () => {
    expect(sid8("abcdefghijklmnop")).toBe("abcdefgh");
  });

  it("returns full string if shorter than 8", () => {
    expect(sid8("abc")).toBe("abc");
  });

  it("returns 'unknown' for empty string", () => {
    expect(sid8("")).toBe("unknown");
  });

  it("returns 'unknown' for null", () => {
    expect(sid8(null)).toBe("unknown");
  });

  it("returns 'unknown' for undefined", () => {
    expect(sid8(undefined)).toBe("unknown");
  });
});

// ─────────────────────────────────────────────────────────────
// Unit tests: path generation
// ─────────────────────────────────────────────────────────────

describe("getHoraSessionDir", () => {
  it("creates directory under .hora/sessions/<sid8>", () => {
    const dir = getHoraSessionDir("session-abc-123", claudeDir);
    expect(dir).toBe(path.join(claudeDir, ".hora", "sessions", "session-"));
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("returns different directories for different sessions", () => {
    const dirA = getHoraSessionDir("aaaaaaaa-1111", claudeDir);
    const dirB = getHoraSessionDir("bbbbbbbb-2222", claudeDir);
    expect(dirA).not.toBe(dirB);
  });

  it("creates dir idempotently", () => {
    const dir1 = getHoraSessionDir("test1234", claudeDir);
    const dir2 = getHoraSessionDir("test1234", claudeDir);
    expect(dir1).toBe(dir2);
    expect(fs.existsSync(dir1)).toBe(true);
  });
});

describe("horaSessionFile", () => {
  it("returns file path inside session directory", () => {
    const file = horaSessionFile("session-abc", "context-pct.txt", claudeDir);
    expect(file).toBe(path.join(claudeDir, ".hora", "sessions", "session-", "context-pct.txt"));
  });
});

describe("stateSessionFile", () => {
  it("returns scoped path in MEMORY/STATE/", () => {
    const file = stateSessionFile("session1234", "thread-state", ".json", claudeDir);
    expect(file).toBe(path.join(claudeDir, "MEMORY", "STATE", "thread-state-session1.json"));
  });

  it("creates STATE directory", () => {
    const file = stateSessionFile("test1234", "pending-user-msg", ".json", claudeDir);
    expect(fs.existsSync(path.dirname(file))).toBe(true);
  });
});

describe("memorySessionFile", () => {
  it("returns dot-prefixed scoped path in MEMORY/", () => {
    const file = memorySessionFile("session1234", "session-state", ".json", claudeDir);
    expect(file).toBe(path.join(claudeDir, "MEMORY", ".session-state-session1.json"));
  });
});

describe("projectSessionFile", () => {
  it("returns scoped path under cwd/.hora/", () => {
    const file = projectSessionFile("session1234", "session-backup-state", ".json", tmpDir);
    expect(file).toBe(path.join(tmpDir, ".hora", "session-backup-state-session1.json"));
  });

  it("returns scoped path for last-check", () => {
    const file = projectSessionFile("session1234", "last-check", "", tmpDir);
    expect(file).toBe(path.join(tmpDir, ".hora", "last-check-session1"));
  });
});

// ─────────────────────────────────────────────────────────────
// ISC tests: two sessions don't collide
// ─────────────────────────────────────────────────────────────

describe("ISC — Session Isolation", () => {
  const SID_A = "aaaaaaaa-1111-2222-3333-444444444444";
  const SID_B = "bbbbbbbb-5555-6666-7777-888888888888";

  it("ISC-1: context-pct.txt is isolated per session", () => {
    const fileA = horaSessionFile(SID_A, "context-pct.txt", claudeDir);
    const fileB = horaSessionFile(SID_B, "context-pct.txt", claudeDir);

    // Different paths
    expect(fileA).not.toBe(fileB);

    // Writes don't collide
    fs.writeFileSync(fileA, "75");
    fs.writeFileSync(fileB, "30");

    expect(fs.readFileSync(fileA, "utf-8")).toBe("75");
    expect(fs.readFileSync(fileB, "utf-8")).toBe("30");
  });

  it("ISC-2: context-state.json is isolated per session", () => {
    const fileA = horaSessionFile(SID_A, "context-state.json", claudeDir);
    const fileB = horaSessionFile(SID_B, "context-state.json", claudeDir);

    expect(fileA).not.toBe(fileB);

    const stateA = { session_id: SID_A, last_pct: 80, compact_count: 1 };
    const stateB = { session_id: SID_B, last_pct: 20, compact_count: 0 };

    fs.writeFileSync(fileA, JSON.stringify(stateA));
    fs.writeFileSync(fileB, JSON.stringify(stateB));

    expect(JSON.parse(fs.readFileSync(fileA, "utf-8")).last_pct).toBe(80);
    expect(JSON.parse(fs.readFileSync(fileB, "utf-8")).last_pct).toBe(20);
  });

  it("ISC-3: .session-state is isolated per session", () => {
    const fileA = memorySessionFile(SID_A, "session-state", ".json", claudeDir);
    const fileB = memorySessionFile(SID_B, "session-state", ".json", claudeDir);

    expect(fileA).not.toBe(fileB);

    fs.writeFileSync(fileA, JSON.stringify({ messageCount: 5 }));
    fs.writeFileSync(fileB, JSON.stringify({ messageCount: 2 }));

    expect(JSON.parse(fs.readFileSync(fileA, "utf-8")).messageCount).toBe(5);
    expect(JSON.parse(fs.readFileSync(fileB, "utf-8")).messageCount).toBe(2);
  });

  it("ISC-4: pending-user-msg is isolated per session", () => {
    const fileA = stateSessionFile(SID_A, "pending-user-msg", ".json", claudeDir);
    const fileB = stateSessionFile(SID_B, "pending-user-msg", ".json", claudeDir);

    expect(fileA).not.toBe(fileB);

    fs.writeFileSync(fileA, JSON.stringify({ message: "from session A" }));
    fs.writeFileSync(fileB, JSON.stringify({ message: "from session B" }));

    expect(JSON.parse(fs.readFileSync(fileA, "utf-8")).message).toBe("from session A");
    expect(JSON.parse(fs.readFileSync(fileB, "utf-8")).message).toBe("from session B");
  });

  it("ISC-5: thread-state is isolated per session", () => {
    const fileA = stateSessionFile(SID_A, "thread-state", ".json", claudeDir);
    const fileB = stateSessionFile(SID_B, "thread-state", ".json", claudeDir);

    expect(fileA).not.toBe(fileB);

    fs.writeFileSync(fileA, JSON.stringify({ assistant_summary: "summary A" }));
    fs.writeFileSync(fileB, JSON.stringify({ assistant_summary: "summary B" }));

    expect(JSON.parse(fs.readFileSync(fileA, "utf-8")).assistant_summary).toBe("summary A");
    expect(JSON.parse(fs.readFileSync(fileB, "utf-8")).assistant_summary).toBe("summary B");
  });

  it("ISC-6: .compact-recovered is isolated per session", () => {
    const fileA = horaSessionFile(SID_A, ".compact-recovered", claudeDir);
    const fileB = horaSessionFile(SID_B, ".compact-recovered", claudeDir);

    expect(fileA).not.toBe(fileB);

    // Session A sets recovery flag
    fs.writeFileSync(fileA, new Date().toISOString());

    // Session B should not see it
    expect(fs.existsSync(fileA)).toBe(true);
    expect(fs.existsSync(fileB)).toBe(false);
  });

  it("ISC-7: session-backup-state is isolated per session", () => {
    const fileA = projectSessionFile(SID_A, "session-backup-state", ".json", tmpDir);
    const fileB = projectSessionFile(SID_B, "session-backup-state", ".json", tmpDir);

    expect(fileA).not.toBe(fileB);

    fs.writeFileSync(fileA, JSON.stringify({ filesModifiedCount: 5 }));
    fs.writeFileSync(fileB, JSON.stringify({ filesModifiedCount: 1 }));

    expect(JSON.parse(fs.readFileSync(fileA, "utf-8")).filesModifiedCount).toBe(5);
    expect(JSON.parse(fs.readFileSync(fileB, "utf-8")).filesModifiedCount).toBe(1);
  });

  it("ISC-8: session-name-cache is isolated per session", () => {
    const fileA = stateSessionFile(SID_A, "session-name-cache", ".sh", claudeDir);
    const fileB = stateSessionFile(SID_B, "session-name-cache", ".sh", claudeDir);

    expect(fileA).not.toBe(fileB);

    fs.writeFileSync(fileA, "cached_session_label='Session A'\n");
    fs.writeFileSync(fileB, "cached_session_label='Session B'\n");

    expect(fs.readFileSync(fileA, "utf-8")).toContain("Session A");
    expect(fs.readFileSync(fileB, "utf-8")).toContain("Session B");
  });
});

// ─────────────────────────────────────────────────────────────
// Cross-session bridging: findLatestFile + readLatestAndClean
// ─────────────────────────────────────────────────────────────

describe("Cross-session bridging", () => {
  it("findLatestFile returns the most recent file matching prefix", () => {
    const dir = path.join(claudeDir, "MEMORY", "STATE");
    fs.mkdirSync(dir, { recursive: true });

    const fileOld = path.join(dir, "thread-state-aaaaaaaa.json");
    const fileNew = path.join(dir, "thread-state-bbbbbbbb.json");

    fs.writeFileSync(fileOld, '{"old":true}');
    // Ensure different mtime
    const pastTime = (Date.now() - 5000) / 1000;
    fs.utimesSync(fileOld, pastTime, pastTime);
    fs.writeFileSync(fileNew, '{"new":true}');

    const latest = findLatestFile(dir, "thread-state-");
    expect(latest).toBe(fileNew);
  });

  it("findLatestFile returns null for no matches", () => {
    const dir = path.join(claudeDir, "empty");
    fs.mkdirSync(dir, { recursive: true });
    expect(findLatestFile(dir, "thread-state-")).toBeNull();
  });

  it("findLatestFile returns null for non-existent directory", () => {
    expect(findLatestFile("/tmp/nonexistent-hora-test", "thread-state-")).toBeNull();
  });

  it("readLatestAndClean reads most recent and deletes all matching", () => {
    const dir = path.join(claudeDir, "MEMORY", "STATE");
    fs.mkdirSync(dir, { recursive: true });

    const file1 = path.join(dir, "thread-state-aaaaaaaa.json");
    const file2 = path.join(dir, "thread-state-bbbbbbbb.json");

    // file1 is older
    fs.writeFileSync(file1, '{"from":"A"}');
    const pastTime = (Date.now() - 5000) / 1000;
    fs.utimesSync(file1, pastTime, pastTime);

    // file2 is newer
    fs.writeFileSync(file2, '{"from":"B"}');

    const content = readLatestAndClean(dir, "thread-state-");
    expect(content).toBe('{"from":"B"}');

    // Both files should be deleted
    expect(fs.existsSync(file1)).toBe(false);
    expect(fs.existsSync(file2)).toBe(false);
  });

  it("readLatestAndClean returns null for no matches", () => {
    const dir = path.join(claudeDir, "MEMORY", "STATE");
    fs.mkdirSync(dir, { recursive: true });

    expect(readLatestAndClean(dir, "nonexistent-")).toBeNull();
  });

  it("does not delete unrelated files", () => {
    const dir = path.join(claudeDir, "MEMORY", "STATE");
    fs.mkdirSync(dir, { recursive: true });

    const target = path.join(dir, "thread-state-aaaaaaaa.json");
    const unrelated = path.join(dir, "session-names.json");

    fs.writeFileSync(target, '{"target":true}');
    fs.writeFileSync(unrelated, '{"unrelated":true}');

    readLatestAndClean(dir, "thread-state-");

    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(unrelated)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// ISC-9: Cleanup expired sessions
// ─────────────────────────────────────────────────────────────

describe("ISC-9: cleanupExpiredSessions", () => {
  it("removes session dirs older than maxAge", () => {
    const sessionsDir = path.join(claudeDir, ".hora", "sessions");
    const oldDir = path.join(sessionsDir, "old12345");
    const newDir = path.join(sessionsDir, "new12345");

    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });

    fs.writeFileSync(path.join(oldDir, "context-pct.txt"), "50");
    fs.writeFileSync(path.join(newDir, "context-pct.txt"), "70");

    // Make old dir very old (48h)
    const oldTime = (Date.now() - 48 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(oldDir, oldTime, oldTime);

    cleanupExpiredSessions(24 * 60 * 60 * 1000, claudeDir);

    expect(fs.existsSync(oldDir)).toBe(false);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it("removes expired session-scoped state files", () => {
    const stateDir = path.join(claudeDir, "MEMORY", "STATE");
    fs.mkdirSync(stateDir, { recursive: true });

    const oldFile = path.join(stateDir, "thread-state-old12345.json");
    const newFile = path.join(stateDir, "thread-state-new12345.json");
    const unrelated = path.join(stateDir, "session-names.json");

    fs.writeFileSync(oldFile, "{}");
    fs.writeFileSync(newFile, "{}");
    fs.writeFileSync(unrelated, "{}");

    // Make old file expired
    const oldTime = (Date.now() - 48 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(oldFile, oldTime, oldTime);

    cleanupExpiredSessions(24 * 60 * 60 * 1000, claudeDir);

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
    expect(fs.existsSync(unrelated)).toBe(true); // non-session file preserved
  });

  it("removes expired memory root session files", () => {
    const memDir = path.join(claudeDir, "MEMORY");
    fs.mkdirSync(memDir, { recursive: true });

    const oldFile = path.join(memDir, ".session-state-old12345.json");
    const newFile = path.join(memDir, ".session-state-new12345.json");

    fs.writeFileSync(oldFile, "{}");
    fs.writeFileSync(newFile, "{}");

    const oldTime = (Date.now() - 48 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(oldFile, oldTime, oldTime);

    cleanupExpiredSessions(24 * 60 * 60 * 1000, claudeDir);

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });

  it("handles non-existent sessions directory gracefully", () => {
    // Should not throw
    expect(() => cleanupExpiredSessions(1000, claudeDir)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// F1: Path traversal prevention — sid8 sanitization
// ─────────────────────────────────────────────────────────────

describe("F1 — sid8 path traversal prevention", () => {
  it("strips path traversal characters from session_id", () => {
    const result = sid8("../../../etc");
    expect(result).not.toContain("..");
    expect(result).not.toContain("/");
  });

  it("strips dots and slashes from session_id", () => {
    const result = sid8("a]b[c/d\\e.f");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    expect(result).not.toContain("[");
    expect(result).not.toContain("]");
  });

  it("preserves valid alphanumeric + dash + underscore characters", () => {
    expect(sid8("abc-def_123")).toBe("abc-def_");
  });

  it("returns 'unknown' if sanitized result is empty", () => {
    expect(sid8("../..")).toBe("unknown");
  });

  it("session dir never escapes base directory", () => {
    const dir = getHoraSessionDir("../../.ssh/keys", claudeDir);
    // Must be under claudeDir, not escaped
    expect(dir.startsWith(claudeDir)).toBe(true);
    expect(dir).not.toContain(".ssh");
  });
});

// ─────────────────────────────────────────────────────────────
// F2: readLatestAndClean race condition safety
// ─────────────────────────────────────────────────────────────

describe("F2 — readLatestAndClean race safety", () => {
  it("returns null gracefully if file disappears between list and read", () => {
    const dir = path.join(claudeDir, "MEMORY", "STATE");
    fs.mkdirSync(dir, { recursive: true });

    const file = path.join(dir, "thread-state-aaaaaaaa.json");
    fs.writeFileSync(file, '{"data":"test"}');

    // Delete the file to simulate race condition (another process consumed it)
    fs.unlinkSync(file);

    // readLatestAndClean should handle this gracefully, not throw
    const result = readLatestAndClean(dir, "thread-state-");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// F3: getLastSessionSummary cross-session bridging
// ─────────────────────────────────────────────────────────────

describe("F3 — thread-state cross-session read", () => {
  it("readLatestAndClean reads thread-state from any previous session", () => {
    const dir = path.join(claudeDir, "MEMORY", "STATE");
    fs.mkdirSync(dir, { recursive: true });

    // Session A wrote a thread-state
    const fileA = path.join(dir, "thread-state-aaaaaaaa.json");
    fs.writeFileSync(fileA, JSON.stringify({
      session_id: "aaaaaaaa-1111",
      session_name: "Fix Session",
      session_summary: "Fixed the session isolation bug",
      timestamp: new Date().toISOString(),
    }));

    // Session B reads it via readLatestAndClean
    const content = readLatestAndClean(dir, "thread-state-");
    expect(content).not.toBeNull();
    const parsed = JSON.parse(content!);
    expect(parsed.session_name).toBe("Fix Session");
    expect(parsed.session_summary).toContain("session isolation");

    // File should be consumed (deleted)
    expect(fs.existsSync(fileA)).toBe(false);
  });
});
