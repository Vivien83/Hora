/**
 * HORA — Signal Tracker: cross-session preference crystallization
 *
 * Captures preference signals from user messages (deterministic, no LLM),
 * then crystallizes recurring patterns (3+ unique sessions) into T3 insights.
 *
 * Signal types:
 *   - explicit: "toujours X", "jamais Y", "je prefere X"
 *   - principle: SSOT, DRY, KISS, library-first, TDD...
 *   - correction: "non, X", "je t'ai dit X", "arrete, X"
 *
 * Storage: MEMORY/LEARNING/SIGNALS/preference-signals.jsonl (append-only, T2)
 * Output:  MEMORY/INSIGHTS/crystallized-patterns.md (T3, atomic write)
 *        + MEMORY/PROFILE/preferences.md (append new crystallized entries)
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PreferenceSignal {
  signal: string;
  raw: string;
  sessionId: string;
  ts: string;
  type: "explicit" | "principle" | "correction";
}

export interface CrystallizationReport {
  signalsCrystallized: number;
  graphPatternsCrystallized: number;
  totalSignalsProcessed: number;
}

interface CrystallizedEntry {
  signal: string;
  sessions: number;
  type: "explicit" | "principle" | "correction" | "graph";
  lastSeen: string;
  raw: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}

function parseJsonl<T>(filePath: string): T[] {
  const content = readFile(filePath);
  if (!content) return [];
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((x): x is T => x !== null);
}

// ─── Signal Normalization ───────────────────────────────────────────────────

/**
 * Normalize a signal for grouping:
 * - lowercase, collapse whitespace
 * - strip neutral prefixes (toujours, always, il faut, you should, on doit)
 * - KEEP negative prefixes (pas de, jamais, never, avoid, evite) — GF-1
 * - truncate 100 chars
 */
export function normalizeSignal(raw: string): string {
  let s = raw.toLowerCase().replace(/\s+/g, " ").trim();

  // Strip neutral prefixes (order matters: longest first)
  const neutralPrefixes = [
    "il faut toujours ",
    "you should always ",
    "on doit toujours ",
    "il faut ",
    "you should ",
    "on doit ",
    "toujours ",
    "always ",
    "je prefere ",
    "je préfère ",
    "i prefer ",
    "utilise ",
    "use ",
  ];

  for (const prefix of neutralPrefixes) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length);
      break;
    }
  }

  return s.slice(0, 100);
}

// ─── Signal Extraction ──────────────────────────────────────────────────────

const MAX_SIGNALS_PER_SESSION = 10;

interface PatternDef {
  pattern: RegExp;
  type: "explicit" | "principle" | "correction";
  extract: (match: RegExpMatchArray, line: string) => string | null;
}

// Known principles (case-insensitive matching)
const KNOWN_PRINCIPLES = [
  "ssot", "dry", "kiss", "yagni", "solid",
  "library-first", "library first",
  "tdd", "test-driven", "type-safe", "type safe",
  "single responsibility", "separation of concerns",
  "convention over configuration",
  "composition over inheritance",
  "immutability", "pure functions",
];

const PATTERNS: PatternDef[] = [
  // --- Explicit preferences (FR) ---
  {
    pattern: /\b(?:toujours|il faut toujours|on doit toujours)\s+(.{5,100})/i,
    type: "explicit",
    extract: (m) => m[1],
  },
  {
    pattern: /\b(?:jamais|il ne faut jamais|on ne doit jamais|evite|évite)\s+(.{5,100})/i,
    type: "explicit",
    extract: (m) => `pas de ${m[1]}`,
  },
  {
    pattern: /\bje pr[eé]f[eè]re\s+(.{5,100})/i,
    type: "explicit",
    extract: (m) => m[1],
  },

  // --- Explicit preferences (EN) ---
  {
    pattern: /\b(?:always|you should always)\s+(.{5,100})/i,
    type: "explicit",
    extract: (m) => m[1],
  },
  {
    pattern: /\b(?:never|avoid|don'?t ever)\s+(.{5,100})/i,
    type: "explicit",
    extract: (m) => `never ${m[1]}`,
  },
  {
    pattern: /\bi prefer\s+(.{5,100})/i,
    type: "explicit",
    extract: (m) => m[1],
  },

  // --- Principles ---
  {
    pattern: new RegExp(`\\b(?:principe|principle|approche|approach|on suit|suivre|follow)\\s+(?:du?\\s+)?(?:${KNOWN_PRINCIPLES.join("|")})`, "i"),
    type: "principle",
    extract: (_m, line) => {
      const lower = line.toLowerCase();
      for (const p of KNOWN_PRINCIPLES) {
        if (lower.includes(p)) return p;
      }
      return null;
    },
  },
  // Standalone principle mention (e.g. "SSOT" or "library-first" alone or in context)
  {
    pattern: new RegExp(`\\b(${KNOWN_PRINCIPLES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})\\b`, "i"),
    type: "principle",
    extract: (m) => m[1].toLowerCase(),
  },

  // --- Corrections (FR) — GF-4: require 10+ chars after marker ---
  {
    pattern: /\bnon[,.]?\s+(.{10,200})/i,
    type: "correction",
    extract: (m, line) => {
      // Filter out "non" as just negation in a longer sentence
      // Only count if "non" is near the start (first 5 chars) or preceded by punctuation
      const idx = line.toLowerCase().indexOf("non");
      if (idx > 5 && !/[.!?\n]/.test(line[idx - 1] || "")) return null;
      return m[1];
    },
  },
  {
    pattern: /\bje t'ai dit\s+(.{10,200})/i,
    type: "correction",
    extract: (m) => m[1],
  },
  {
    pattern: /\barr[eê]te[,.]?\s+(.{10,200})/i,
    type: "correction",
    extract: (m) => m[1],
  },

  // --- Corrections (EN) ---
  {
    pattern: /\bi (?:already )?(?:said|told you)\s+(.{10,200})/i,
    type: "correction",
    extract: (m) => m[1],
  },
  {
    pattern: /\bstop[,.]?\s+(.{10,200})/i,
    type: "correction",
    extract: (m) => m[1],
  },
];

/**
 * Extract preference signals from a parsed transcript (deterministic, no LLM).
 * Only processes [user] / [human] lines.
 * Returns max MAX_SIGNALS_PER_SESSION signals.
 */
export function extractPreferenceSignals(transcript: string, sessionId: string): PreferenceSignal[] {
  const signals: PreferenceSignal[] = [];
  const seenNormalized = new Set<string>();
  const ts = new Date().toISOString();

  const userLines = transcript
    .split("\n")
    .filter((l) => l.startsWith("[user]:") || l.startsWith("[human]:"))
    .map((l) => l.replace(/^\[(?:user|human)\]:\s*/, ""));

  // Skip code blocks
  let inCodeBlock = false;
  const cleanLines: string[] = [];
  for (const line of userLines) {
    if (line.includes("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) cleanLines.push(line);
  }

  for (const line of cleanLines) {
    if (signals.length >= MAX_SIGNALS_PER_SESSION) break;

    for (const def of PATTERNS) {
      if (signals.length >= MAX_SIGNALS_PER_SESSION) break;

      const match = line.match(def.pattern);
      if (!match) continue;

      const extracted = def.extract(match, line);
      if (!extracted || extracted.trim().length < 3) continue;

      const normalized = normalizeSignal(extracted);
      if (seenNormalized.has(normalized)) continue;
      seenNormalized.add(normalized);

      signals.push({
        signal: normalized,
        raw: extracted.slice(0, 200),
        sessionId: sessionId.slice(0, 8),
        ts,
        type: def.type,
      });
      break; // One signal per line max
    }
  }

  return signals;
}

// ─── Signal Persistence ─────────────────────────────────────────────────────

/**
 * Append signals to the JSONL file (atomic append for POSIX < 4096B).
 */
export function appendSignals(filePath: string, signals: PreferenceSignal[]): void {
  if (signals.length === 0) return;
  ensureDir(path.dirname(filePath));
  const content = signals.map((s) => JSON.stringify(s)).join("\n") + "\n";
  fs.appendFileSync(filePath, content, "utf-8");
}

// ─── Crystallization ────────────────────────────────────────────────────────

const CRYSTALLIZATION_THRESHOLD = 3; // sessions uniques minimum
const MAX_CRYSTALLIZED_PREFS = 30; // cap dans preferences.md — GF-5

/**
 * Crystallize recurring preference patterns from T2 → T3.
 *
 * Algorithm:
 * 1. Read preference-signals.jsonl
 * 2. Group by normalizeSignal(signal)
 * 3. Count unique sessionIds per group
 * 4. If unique sessions >= 3 → crystallize
 * 5. Optionally mine graph facts with preference-related relations
 * 6. Write INSIGHTS/crystallized-patterns.md (atomic, full rewrite)
 * 7. Append NEW preferences to PROFILE/preferences.md
 */
export function crystallizePatterns(
  memoryDir: string,
  graph?: { getActiveFacts(): Array<{ source: string; target: string; relation: string; description: string; metadata?: { source_session?: string } }> },
): CrystallizationReport {
  const report: CrystallizationReport = {
    signalsCrystallized: 0,
    graphPatternsCrystallized: 0,
    totalSignalsProcessed: 0,
  };

  const signalFile = path.join(memoryDir, "LEARNING", "SIGNALS", "preference-signals.jsonl");
  const signals = parseJsonl<PreferenceSignal>(signalFile);
  report.totalSignalsProcessed = signals.length;

  if (signals.length === 0 && !graph) return report;

  // 1. Group signals by normalized key
  const groups = new Map<string, { sessions: Set<string>; type: PreferenceSignal["type"]; lastTs: string; raw: string }>();

  for (const s of signals) {
    const key = normalizeSignal(s.signal);
    const existing = groups.get(key);
    if (existing) {
      existing.sessions.add(s.sessionId);
      if (s.ts > existing.lastTs) {
        existing.lastTs = s.ts;
        existing.raw = s.raw;
      }
    } else {
      groups.set(key, {
        sessions: new Set([s.sessionId]),
        type: s.type,
        lastTs: s.ts,
        raw: s.raw,
      });
    }
  }

  // 2. Filter: 3+ unique sessions
  const crystallized: CrystallizedEntry[] = [];
  for (const [signal, data] of groups) {
    if (data.sessions.size >= CRYSTALLIZATION_THRESHOLD) {
      crystallized.push({
        signal,
        sessions: data.sessions.size,
        type: data.type,
        lastSeen: data.lastTs,
        raw: data.raw,
      });
    }
  }
  report.signalsCrystallized = crystallized.length;

  // 3. Mine graph facts (preference-related relations in 3+ episodes)
  if (graph) {
    try {
      const prefRelations = new Set(["prefers", "decided_for", "decided_against", "uses", "avoids"]);
      const facts = graph.getActiveFacts().filter((f) => prefRelations.has(f.relation));

      // Group facts by description, count unique sessions
      const factGroups = new Map<string, { sessions: Set<string>; desc: string; lastSession: string }>();
      for (const f of facts) {
        const key = f.description.toLowerCase().slice(0, 100);
        const session = f.metadata?.source_session || "";
        const existing = factGroups.get(key);
        if (existing) {
          if (session) existing.sessions.add(session);
        } else {
          factGroups.set(key, {
            sessions: new Set(session ? [session] : []),
            desc: f.description,
            lastSession: session,
          });
        }
      }

      for (const [, data] of factGroups) {
        if (data.sessions.size >= CRYSTALLIZATION_THRESHOLD) {
          // Avoid duplicates with signal-based crystallizations
          const normalized = normalizeSignal(data.desc);
          if (!crystallized.some((c) => c.signal === normalized)) {
            crystallized.push({
              signal: normalized,
              sessions: data.sessions.size,
              type: "graph",
              lastSeen: new Date().toISOString(),
              raw: data.desc,
            });
            report.graphPatternsCrystallized++;
          }
        }
      }
    } catch {}
  }

  if (crystallized.length === 0) return report;

  // 4. Sort by sessions desc, then by lastSeen desc
  crystallized.sort((a, b) => b.sessions - a.sessions || b.lastSeen.localeCompare(a.lastSeen));

  // 5. Write crystallized-patterns.md (atomic write)
  const insightsDir = path.join(memoryDir, "INSIGHTS");
  ensureDir(insightsDir);

  const mdLines = [
    `# Crystallized Preferences`,
    `> Auto-generated by signal-tracker. Updated: ${new Date().toISOString().slice(0, 10)}`,
    `> Threshold: ${CRYSTALLIZATION_THRESHOLD}+ unique sessions`,
    ``,
    `| # | Signal | Sessions | Type | Last seen |`,
    `|---|--------|----------|------|-----------|`,
  ];
  crystallized.forEach((c, i) => {
    const signal = c.signal.slice(0, 60).replace(/\|/g, "/");
    const lastDate = c.lastSeen.slice(0, 10);
    mdLines.push(`| ${i + 1} | ${signal} | ${c.sessions}x | ${c.type} | ${lastDate} |`);
  });

  const mdContent = mdLines.join("\n") + "\n";
  const mdPath = path.join(insightsDir, "crystallized-patterns.md");
  const tmpPath = mdPath + ".tmp." + process.pid;
  fs.writeFileSync(tmpPath, mdContent, "utf-8");
  fs.renameSync(tmpPath, mdPath); // ISC-6: atomic write

  // 6. Append NEW preferences to PROFILE/preferences.md (idempotent — ISC-7)
  const prefsFile = path.join(memoryDir, "PROFILE", "preferences.md");
  const existingPrefs = readFile(prefsFile);

  const newEntries: string[] = [];
  for (const c of crystallized) {
    const tag = `[crystallized, ${c.sessions} sessions]`;
    // Check if this preference is already in the file (avoid duplicates)
    if (existingPrefs.includes(c.signal) || existingPrefs.includes(tag + " " + c.signal)) {
      continue;
    }
    newEntries.push(`- Pref: ${c.signal} ${tag}`);
  }

  if (newEntries.length > 0) {
    // Cap: count existing crystallized entries, remove oldest if > MAX — GF-5
    const existingLines = existingPrefs.split("\n");
    const crystallizedLines = existingLines.filter((l) => l.includes("[crystallized,"));
    const nonCrystallizedLines = existingLines.filter((l) => !l.includes("[crystallized,"));

    let allCrystallized = [...crystallizedLines, ...newEntries];
    if (allCrystallized.length > MAX_CRYSTALLIZED_PREFS) {
      allCrystallized = allCrystallized.slice(allCrystallized.length - MAX_CRYSTALLIZED_PREFS);
    }

    const finalContent = [...nonCrystallizedLines, ...allCrystallized].join("\n").trim();
    ensureDir(path.dirname(prefsFile));

    const prefsTmp = prefsFile + ".tmp." + process.pid;
    fs.writeFileSync(prefsTmp, finalContent + "\n", "utf-8");
    fs.renameSync(prefsTmp, prefsFile);
  }

  return report;
}
