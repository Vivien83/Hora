/**
 * HORA — Memory Tiers: court/moyen/long terme
 *
 * T1 (court terme, 24h-48h): STATE/, .hora/sessions/ — contexte immediat
 * T2 (moyen terme, 30 jours): SESSIONS/, LEARNING/ — patterns recents
 * T3 (long terme, permanent): PROFILE/, INSIGHTS/ — savoir consolide
 *
 * Fonctions principales:
 *   expireT2()     — archive/tronque les donnees T2 depassees
 *   promoteToT3()  — distille les patterns recurrents en insights permanents
 *   getMemoryHealth() — retourne les stats par tier pour le dashboard
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExpireReport {
  sessionsArchived: number;
  sentimentTruncated: number;
  toolUsageAggregated: number;
  failuresTruncated: number;
}

export interface PromoteReport {
  recurringFailures: number;
  sentimentInsights: number;
  toolPatterns: number;
  projectHealth: number;
  crystallizedPatterns: number;
  graphPatterns: number;
}

export interface TierStats {
  items: number;
  sizeKb: number;
  oldestDays?: number;
}

export interface MemoryHealth {
  t1: TierStats;
  t2: TierStats;
  t3: TierStats;
  lastGc: string | null;
  alerts: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GC_LOCKFILE = ".gc-running";
const GC_TIMESTAMP_FILE = ".last-gc-timestamp";
const GC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 heures
const GC_LOCK_TIMEOUT_MS = 60 * 1000; // 60 secondes

const T2_SESSION_MAX_AGE_DAYS = 30;
const T2_SENTIMENT_MAX_AGE_DAYS = 90;
const T2_TOOL_USAGE_MAX_AGE_DAYS = 30;
const T2_FAILURES_MAX_AGE_DAYS = 30;

const RECURRING_FAILURE_THRESHOLD = 3;
const MAX_RECURRING_FAILURES = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
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

function writeJsonl<T>(filePath: string, entries: T[]): void {
  ensureDir(path.dirname(filePath));
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length > 0 ? "\n" : "");
  // Atomic write: tmp + rename (GF-2 mitigation)
  const tmpFile = filePath + ".tmp." + process.pid;
  fs.writeFileSync(tmpFile, content, "utf-8");
  fs.renameSync(tmpFile, filePath);
}

function appendJsonl<T>(filePath: string, entries: T[]): void {
  if (entries.length === 0) return;
  ensureDir(path.dirname(filePath));
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.appendFileSync(filePath, content, "utf-8");
}

/**
 * Safe move: copyFile + unlink, fallback for cross-device (GF-1)
 */
function safeMove(src: string, dest: string): boolean {
  try {
    fs.renameSync(src, dest);
    return true;
  } catch {
    try {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      return true;
    } catch {
      return false;
    }
  }
}

function daysAgo(dateStr: string): number {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 0;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function fileDaysOld(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return Math.floor((Date.now() - stat.mtimeMs) / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

function fileSizeKb(filePath: string): number {
  try {
    return Math.round(fs.statSync(filePath).size / 1024);
  } catch {
    return 0;
  }
}

function dirStats(dirPath: string, extensions?: string[]): { items: number; sizeKb: number; oldestDays: number } {
  let items = 0;
  let totalSize = 0;
  let oldestMs = Date.now();

  try {
    if (!fs.existsSync(dirPath)) return { items: 0, sizeKb: 0, oldestDays: 0 };
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const fullPath = path.join(dirPath, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          if (extensions && !extensions.some((ext) => entry.endsWith(ext))) continue;
          items++;
          totalSize += stat.size;
          if (stat.mtimeMs < oldestMs) oldestMs = stat.mtimeMs;
        }
      } catch {}
    }
  } catch {}

  return {
    items,
    sizeKb: Math.round(totalSize / 1024),
    oldestDays: items > 0 ? Math.floor((Date.now() - oldestMs) / (24 * 60 * 60 * 1000)) : 0,
  };
}

// ─── GC Lock ────────────────────────────────────────────────────────────────

function acquireGcLock(memoryDir: string): boolean {
  const lockPath = path.join(memoryDir, GC_LOCKFILE);
  try {
    if (fs.existsSync(lockPath)) {
      const stat = fs.statSync(lockPath);
      // Lock expired? (GF-3 mitigation: 60s timeout)
      if (Date.now() - stat.mtimeMs > GC_LOCK_TIMEOUT_MS) {
        fs.unlinkSync(lockPath);
      } else {
        return false; // Another process is running GC
      }
    }
    fs.writeFileSync(lockPath, String(process.pid), "utf-8");
    return true;
  } catch {
    return false;
  }
}

function releaseGcLock(memoryDir: string): void {
  try {
    fs.unlinkSync(path.join(memoryDir, GC_LOCKFILE));
  } catch {}
}

function shouldRunGc(memoryDir: string): boolean {
  const tsFile = path.join(memoryDir, GC_TIMESTAMP_FILE);
  try {
    const raw = fs.readFileSync(tsFile, "utf-8").trim();
    const lastRun = new Date(raw).getTime();
    return Date.now() - lastRun > GC_MIN_INTERVAL_MS;
  } catch {
    return true; // Never run before
  }
}

function markGcRun(memoryDir: string): void {
  try {
    fs.writeFileSync(path.join(memoryDir, GC_TIMESTAMP_FILE), new Date().toISOString(), "utf-8");
  } catch {}
}

// ─── expireT2 ───────────────────────────────────────────────────────────────

interface SentimentLogEntry {
  sid?: string;
  score?: number;
  ts?: string;
  messages?: number;
  trigger?: string;
}

interface ToolUsageEntry {
  ts?: string;
  tool?: string;
  session?: string;
  count?: number;
}

interface FailureLogEntry {
  ts?: string;
  sid?: string;
  type?: string;
  summary?: string;
}

interface SentimentMonthlySummary {
  month: string;
  avgScore: number;
  sessions: number;
  trend: "up" | "down" | "stable";
}

interface ToolMonthlySummary {
  month: string;
  tools: Record<string, number>;
  total: number;
}

/**
 * Expire T2 data:
 * 1. Sessions > 30 jours → SESSIONS/_archived/
 * 2. sentiment-log.jsonl > 90 jours → tronquer, consolider dans INSIGHTS/
 * 3. .tool-usage.jsonl > 30 jours → agreger par mois dans INSIGHTS/
 * 4. failures-log.jsonl → garder 30 jours brut
 */
export function expireT2(memoryDir: string): ExpireReport {
  const report: ExpireReport = {
    sessionsArchived: 0,
    sentimentTruncated: 0,
    toolUsageAggregated: 0,
    failuresTruncated: 0,
  };

  // 1. Archive old sessions
  const sessionsDir = path.join(memoryDir, "SESSIONS");
  const archiveDir = path.join(sessionsDir, "_archived");
  try {
    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const filePath = path.join(sessionsDir, file);
        if (fileDaysOld(filePath) > T2_SESSION_MAX_AGE_DAYS) {
          ensureDir(archiveDir);
          if (safeMove(filePath, path.join(archiveDir, file))) {
            report.sessionsArchived++;
          }
        }
      }
    }
  } catch {}

  // 2. Truncate sentiment log (keep 90 days, consolidate older)
  const sentimentLog = path.join(memoryDir, "LEARNING", "ALGORITHM", "sentiment-log.jsonl");
  try {
    const entries = parseJsonl<SentimentLogEntry>(sentimentLog);
    if (entries.length > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - T2_SENTIMENT_MAX_AGE_DAYS);
      const cutoff = cutoffDate.toISOString();

      const recent = entries.filter((e) => (e.ts || "") >= cutoff);
      const old = entries.filter((e) => (e.ts || "") < cutoff);

      if (old.length > 0) {
        // Consolidate old entries into monthly summaries
        const monthlySummaries = consolidateSentimentByMonth(old);
        const insightsDir = path.join(memoryDir, "INSIGHTS");
        const summaryFile = path.join(insightsDir, "sentiment-summary.jsonl");

        // Merge with existing summaries
        const existingSummaries = parseJsonl<SentimentMonthlySummary>(summaryFile);
        const mergedSummaries = mergeSentimentSummaries(existingSummaries, monthlySummaries);
        writeJsonl(summaryFile, mergedSummaries);

        // Truncate the log to recent entries only
        writeJsonl(sentimentLog, recent);
        report.sentimentTruncated = old.length;
      }
    }
  } catch {}

  // 3. Aggregate tool usage (keep 30 days, aggregate older by month)
  const toolUsageLog = path.join(memoryDir, ".tool-usage.jsonl");
  try {
    const entries = parseJsonl<ToolUsageEntry>(toolUsageLog);
    if (entries.length > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - T2_TOOL_USAGE_MAX_AGE_DAYS);
      const cutoff = cutoffDate.toISOString();

      const recent = entries.filter((e) => (e.ts || "") >= cutoff);
      const old = entries.filter((e) => (e.ts || "") < cutoff);

      if (old.length > 0) {
        const monthlySummaries = consolidateToolUsageByMonth(old);
        const insightsDir = path.join(memoryDir, "INSIGHTS");
        const summaryFile = path.join(insightsDir, "tool-monthly.jsonl");

        const existingSummaries = parseJsonl<ToolMonthlySummary>(summaryFile);
        const mergedSummaries = mergeToolSummaries(existingSummaries, monthlySummaries);
        writeJsonl(summaryFile, mergedSummaries);

        writeJsonl(toolUsageLog, recent);
        report.toolUsageAggregated = old.length;
      }
    }
  } catch {}

  // 4. Truncate failures log (keep 30 days brut)
  const failuresLog = path.join(memoryDir, "LEARNING", "FAILURES", "failures-log.jsonl");
  try {
    const entries = parseJsonl<FailureLogEntry>(failuresLog);
    if (entries.length > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - T2_FAILURES_MAX_AGE_DAYS);
      const cutoff = cutoffDate.toISOString();

      const recent = entries.filter((e) => (e.ts || "") >= cutoff);
      const removed = entries.length - recent.length;
      if (removed > 0) {
        writeJsonl(failuresLog, recent);
        report.failuresTruncated = removed;
      }
    }
  } catch {}

  // 5. Cap preference signals (rolling window)
  const signalLog = path.join(memoryDir, "LEARNING", "SIGNALS", "preference-signals.jsonl");
  try {
    const signals = parseJsonl<Record<string, unknown>>(signalLog);
    if (signals.length > 500) {
      writeJsonl(signalLog, signals.slice(signals.length - 500));
    }
  } catch {}

  return report;
}

// ─── Consolidation helpers ──────────────────────────────────────────────────

function consolidateSentimentByMonth(entries: SentimentLogEntry[]): SentimentMonthlySummary[] {
  const byMonth = new Map<string, number[]>();

  for (const e of entries) {
    if (!e.ts || typeof e.score !== "number") continue;
    const month = e.ts.slice(0, 7); // YYYY-MM
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(e.score);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      // Trend: compare first half vs second half
      const mid = Math.floor(scores.length / 2);
      const firstHalf = scores.slice(0, mid);
      const secondHalf = scores.slice(mid);
      const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : avg;
      const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : avg;
      const diff = avgSecond - avgFirst;
      const trend: "up" | "down" | "stable" = diff > 0.3 ? "up" : diff < -0.3 ? "down" : "stable";

      return {
        month,
        avgScore: Math.round(avg * 10) / 10,
        sessions: scores.length,
        trend,
      };
    });
}

function mergeSentimentSummaries(
  existing: SentimentMonthlySummary[],
  incoming: SentimentMonthlySummary[],
): SentimentMonthlySummary[] {
  const map = new Map<string, SentimentMonthlySummary>();
  for (const s of existing) map.set(s.month, s);
  // Incoming overwrites (more accurate since it includes newly consolidated data)
  for (const s of incoming) {
    const prev = map.get(s.month);
    if (prev) {
      // Weighted merge
      const totalSessions = prev.sessions + s.sessions;
      const mergedAvg = (prev.avgScore * prev.sessions + s.avgScore * s.sessions) / totalSessions;
      map.set(s.month, {
        month: s.month,
        avgScore: Math.round(mergedAvg * 10) / 10,
        sessions: totalSessions,
        trend: s.trend, // Use latest trend
      });
    } else {
      map.set(s.month, s);
    }
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function consolidateToolUsageByMonth(entries: ToolUsageEntry[]): ToolMonthlySummary[] {
  const byMonth = new Map<string, Record<string, number>>();

  for (const e of entries) {
    if (!e.ts || !e.tool) continue;
    const month = e.ts.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, {});
    const tools = byMonth.get(month)!;
    tools[e.tool] = (tools[e.tool] || 0) + (e.count || 1);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, tools]) => ({
      month,
      tools,
      total: Object.values(tools).reduce((a, b) => a + b, 0),
    }));
}

function mergeToolSummaries(
  existing: ToolMonthlySummary[],
  incoming: ToolMonthlySummary[],
): ToolMonthlySummary[] {
  const map = new Map<string, ToolMonthlySummary>();
  for (const s of existing) map.set(s.month, s);
  for (const s of incoming) {
    const prev = map.get(s.month);
    if (prev) {
      // Merge tool counts
      const merged = { ...prev.tools };
      for (const [tool, count] of Object.entries(s.tools)) {
        merged[tool] = (merged[tool] || 0) + count;
      }
      map.set(s.month, {
        month: s.month,
        tools: merged,
        total: Object.values(merged).reduce((a, b) => a + b, 0),
      });
    } else {
      map.set(s.month, s);
    }
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ─── promoteToT3 ────────────────────────────────────────────────────────────

/**
 * Promote recurring patterns from T2 → T3:
 * 1. Failures recurrentes (3+) → INSIGHTS/recurring-failures.md
 * 2. Sentiment par projet → INSIGHTS/project-health.md
 */
export async function promoteToT3(memoryDir: string): Promise<PromoteReport> {
  const report: PromoteReport = {
    recurringFailures: 0,
    sentimentInsights: 0,
    toolPatterns: 0,
    projectHealth: 0,
    crystallizedPatterns: 0,
    graphPatterns: 0,
  };

  const insightsDir = path.join(memoryDir, "INSIGHTS");
  ensureDir(insightsDir);

  // 1. Detect recurring failures
  const failuresLog = path.join(memoryDir, "LEARNING", "FAILURES", "failures-log.jsonl");
  try {
    const entries = parseJsonl<FailureLogEntry>(failuresLog);
    if (entries.length > 0) {
      // Group by normalized summary (lowercase, first 80 chars)
      const grouped = new Map<string, { count: number; type: string; lastTs: string; summary: string }>();
      for (const e of entries) {
        if (!e.summary) continue;
        const key = normalizeFailureSummary(e.summary);
        const existing = grouped.get(key);
        if (existing) {
          existing.count++;
          if ((e.ts || "") > existing.lastTs) {
            existing.lastTs = e.ts || "";
            existing.summary = e.summary;
          }
        } else {
          grouped.set(key, {
            count: 1,
            type: e.type || "error",
            lastTs: e.ts || "",
            summary: e.summary,
          });
        }
      }

      // Keep only recurring (3+), sorted by count desc, top 10 (GF-4)
      const recurring = [...grouped.values()]
        .filter((g) => g.count >= RECURRING_FAILURE_THRESHOLD)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_RECURRING_FAILURES);

      if (recurring.length > 0) {
        const lines = [
          `# Recurring Failures`,
          `> Auto-generated by memory-tiers. Updated: ${new Date().toISOString().slice(0, 10)}`,
          ``,
          `| # | Type | Occurrences | Derniere | Resume |`,
          `|---|------|------------|----------|--------|`,
        ];
        recurring.forEach((r, i) => {
          const lastDate = r.lastTs.slice(0, 10) || "?";
          const summary = r.summary.slice(0, 80).replace(/\|/g, "/");
          lines.push(`| ${i + 1} | ${r.type} | ${r.count}x | ${lastDate} | ${summary} |`);
        });

        fs.writeFileSync(path.join(insightsDir, "recurring-failures.md"), lines.join("\n") + "\n", "utf-8");
        report.recurringFailures = recurring.length;
      }
    }
  } catch {}

  // 2. Crystallize preference patterns (cross-session)
  try {
    const { crystallizePatterns } = await import("./signal-tracker.js");
    let graph: { getActiveFacts(): any[] } | undefined;
    try {
      const graphDir = path.join(memoryDir, "GRAPH");
      if (fs.existsSync(path.join(graphDir, "entities.jsonl"))) {
        const { HoraGraph } = await import("./knowledge-graph.js");
        graph = new HoraGraph(graphDir);
      }
    } catch {}
    const crystal = crystallizePatterns(memoryDir, graph);
    report.crystallizedPatterns = crystal.signalsCrystallized;
    report.graphPatterns = crystal.graphPatternsCrystallized;
  } catch {}

  // 3. Sentiment insights from consolidated summaries
  const sentimentSummaryFile = path.join(insightsDir, "sentiment-summary.jsonl");
  try {
    const summaries = parseJsonl<SentimentMonthlySummary>(sentimentSummaryFile);
    if (summaries.length >= 2) {
      // Already consolidated — count as insight
      report.sentimentInsights = summaries.length;
    }
  } catch {}

  // 3. Tool patterns from consolidated summaries
  const toolSummaryFile = path.join(insightsDir, "tool-monthly.jsonl");
  try {
    const summaries = parseJsonl<ToolMonthlySummary>(toolSummaryFile);
    if (summaries.length >= 1) {
      report.toolPatterns = summaries.length;
    }
  } catch {}

  return report;
}

function normalizeFailureSummary(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// ─── getMemoryHealth ────────────────────────────────────────────────────────

/**
 * Returns memory health stats per tier for dashboard visualization.
 */
export function getMemoryHealth(memoryDir: string): MemoryHealth {
  const alerts: string[] = [];

  // T1: STATE/ + .hora/sessions/
  const stateDir = path.join(memoryDir, "STATE");
  const stateStats = dirStats(stateDir);
  const horaSessionsDir = path.join(path.dirname(memoryDir), ".hora", "sessions");
  const horaStats = dirStats(horaSessionsDir);
  const t1: TierStats = {
    items: stateStats.items + horaStats.items,
    sizeKb: stateStats.sizeKb + horaStats.sizeKb,
  };

  // T2: SESSIONS/ + LEARNING/
  const sessionsDir = path.join(memoryDir, "SESSIONS");
  const sessionsStats = dirStats(sessionsDir, [".md"]);
  const learningDir = path.join(memoryDir, "LEARNING");
  const sentimentSize = fileSizeKb(path.join(learningDir, "ALGORITHM", "sentiment-log.jsonl"));
  const failuresSize = fileSizeKb(path.join(learningDir, "FAILURES", "failures-log.jsonl"));
  const toolUsageSize = fileSizeKb(path.join(memoryDir, ".tool-usage.jsonl"));
  const toolUsageLines = parseJsonl<unknown>(path.join(memoryDir, ".tool-usage.jsonl")).length;
  const sentimentLines = parseJsonl<unknown>(path.join(learningDir, "ALGORITHM", "sentiment-log.jsonl")).length;
  const failuresLines = parseJsonl<unknown>(path.join(learningDir, "FAILURES", "failures-log.jsonl")).length;

  const t2Items = sessionsStats.items + sentimentLines + failuresLines + toolUsageLines;
  const t2: TierStats = {
    items: t2Items,
    sizeKb: sessionsStats.sizeKb + sentimentSize + failuresSize + toolUsageSize,
    oldestDays: sessionsStats.oldestDays,
  };

  if (t2Items > 500) {
    alerts.push(`T2 surcharge: ${t2Items} items (consolidation recommandee)`);
  }

  // T3: PROFILE/ + INSIGHTS/
  const profileDir = path.join(memoryDir, "PROFILE");
  const insightsDir = path.join(memoryDir, "INSIGHTS");
  const profileStats = dirStats(profileDir);
  const insightsStats = dirStats(insightsDir);
  const t3: TierStats = {
    items: profileStats.items + insightsStats.items,
    sizeKb: profileStats.sizeKb + insightsStats.sizeKb,
  };

  // Last GC
  let lastGc: string | null = null;
  try {
    lastGc = readFile(path.join(memoryDir, GC_TIMESTAMP_FILE)) || null;
  } catch {}

  if (!lastGc) {
    alerts.push("GC jamais execute");
  } else if (daysAgo(lastGc) > 1) {
    alerts.push(`Dernier GC: il y a ${daysAgo(lastGc)} jours`);
  }

  // Alert if INSIGHTS/ is empty after 10+ sessions (data should be flowing)
  const sessionCount = sessionsStats.items;
  if (sessionCount >= 10 && insightsStats.items === 0) {
    alerts.push(`INSIGHTS/ vide apres ${sessionCount} sessions — verifier le pipeline failures/sentiment`);
  }

  // Alert if failures-log.jsonl doesn't exist despite sessions
  const failuresLogPath = path.join(memoryDir, "LEARNING", "FAILURES", "failures-log.jsonl");
  if (sessionCount >= 5) {
    try {
      if (!fs.existsSync(failuresLogPath)) {
        alerts.push("failures-log.jsonl absent — les erreurs conversationnelles ne sont pas capturees");
      }
    } catch {}
  }

  return { t1, t2, t3, lastGc, alerts };
}

// ─── ACT-R Graph Expiry ──────────────────────────────────────────────────────

/**
 * Expire graph facts using ACT-R activation model.
 * Facts with activation below threshold are superseded.
 * Returns number of facts expired.
 */
async function expireGraphFacts(memoryDir: string): Promise<number> {
  const graphDir = path.join(memoryDir, "GRAPH");
  if (!fs.existsSync(path.join(graphDir, "entities.jsonl"))) return 0;

  try {
    const { HoraGraph } = await import("./knowledge-graph.js");
    const { loadActivationLog, computeActivation, shouldExpire, activationLogPath } = await import("./activation-model.js");

    const graph = new HoraGraph(graphDir);
    const actLog = loadActivationLog(activationLogPath(graphDir));
    const activeFacts = graph.getActiveFacts();

    let expiredCount = 0;
    for (const fact of activeFacts) {
      const actEntry = actLog.get(fact.id);
      if (!actEntry) {
        // No activation data — use recency-based fallback
        const ageDays = daysAgo(fact.valid_at);
        if (ageDays > 90) {
          graph.supersedeFact(fact.id);
          expiredCount++;
        }
        continue;
      }

      const activation = computeActivation(actEntry);
      if (shouldExpire(activation)) {
        graph.supersedeFact(fact.id);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      graph.save();
    }
    return expiredCount;
  } catch {
    return 0;
  }
}

// ─── Main orchestrator ──────────────────────────────────────────────────────

/**
 * Run the full memory lifecycle: expire T2 + promote to T3 + expire graph facts.
 * Respects GC lock and minimum interval.
 * Call this from session-end.ts after extraction.
 */
export async function runMemoryLifecycle(memoryDir: string): Promise<{ expire: ExpireReport; promote: PromoteReport } | null> {
  // Check if GC should run (interval check)
  if (!shouldRunGc(memoryDir)) {
    return null; // Too recent, skip
  }

  // Acquire lock (GF-3: prevent parallel execution)
  if (!acquireGcLock(memoryDir)) {
    return null; // Another process is running
  }

  try {
    const expireReport = expireT2(memoryDir);
    const promoteReport = await promoteToT3(memoryDir);

    // ACT-R based graph fact expiry
    try {
      await expireGraphFacts(memoryDir);
    } catch {}

    // Dream cycle: consolidate episodes into semantic knowledge
    try {
      const graphDir = path.join(memoryDir, "GRAPH");
      if (fs.existsSync(path.join(graphDir, "entities.jsonl"))) {
        const { HoraGraph } = await import("./knowledge-graph.js");
        const { runDreamCycle } = await import("./dream-cycle.js");
        const graph = new HoraGraph(graphDir);
        const dreamReport = runDreamCycle(graph);
        if (dreamReport.patternsDistilled > 0 || dreamReport.factsReconsolidated > 0) {
          graph.save();
        }
      }
    } catch {}

    markGcRun(memoryDir);
    return { expire: expireReport, promote: promoteReport };
  } finally {
    releaseGcLock(memoryDir);
  }
}
