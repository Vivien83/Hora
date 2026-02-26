/**
 * HORA — ACT-R Activation Model
 *
 * Adaptive memory decay inspired by ACT-R (Anderson & Lebiere, 1998).
 * Each fact has an activation level A = ln(Σ(t_i^{-d})) where:
 *   - t_i = time (in days) since the i-th access
 *   - d = decay parameter (~0.5, standard ACT-R)
 *
 * Facts with high activation survive longer; rarely-accessed facts expire faster.
 * Emotional weight (corrections, failures) boosts activation.
 *
 * Storage: GRAPH/activation-log.jsonl
 */

import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ActivationEntry {
  factId: string;
  accessTimes: string[];     // ISO timestamps of access/retrieval events
  emotionalWeight: number;   // 1.0 default, 1.5 for correction/failure-related
  lastActivation: number;    // cached last computation
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DECAY_D = 0.5;          // ACT-R standard decay
const EXPIRE_THRESHOLD = -2.0; // Below this → fact is "forgotten"
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Compute ACT-R activation for a fact.
 * A = ln(Σ(t_i^{-d})) * emotionalWeight
 *
 * Returns -Infinity if no access times.
 */
export function computeActivation(entry: ActivationEntry, now?: Date): number {
  const refTime = (now || new Date()).getTime();
  const accessTimes = entry.accessTimes;

  if (accessTimes.length === 0) return -Infinity;

  let sum = 0;
  for (const ts of accessTimes) {
    const accessTime = new Date(ts).getTime();
    if (isNaN(accessTime)) continue;
    const daysSince = Math.max(0.01, (refTime - accessTime) / MS_PER_DAY); // min 0.01 to avoid log(Infinity)
    sum += Math.pow(daysSince, -DECAY_D);
  }

  if (sum <= 0) return -Infinity;

  return Math.log(sum) * (entry.emotionalWeight || 1.0);
}

/**
 * Check if a fact should expire based on its activation level.
 */
export function shouldExpire(activation: number, threshold: number = EXPIRE_THRESHOLD): boolean {
  return !isFinite(activation) || activation < threshold;
}

/**
 * Sigmoid normalization of activation for use as a scoring factor.
 * Centers on the expire threshold, outputs 0-1.
 * sigmoid(activation + 2) where 2 = |EXPIRE_THRESHOLD|
 */
export function activationFactor(activation: number): number {
  if (!isFinite(activation)) return 0;
  const x = activation - EXPIRE_THRESHOLD; // shift so threshold maps to 0
  return 1 / (1 + Math.exp(-x));
}

/**
 * Record an access event for a fact.
 * Returns a new ActivationEntry with updated accessTimes and cached activation.
 */
export function recordAccess(entry: ActivationEntry, now?: Date): ActivationEntry {
  const timestamp = (now || new Date()).toISOString();
  const updated: ActivationEntry = {
    ...entry,
    accessTimes: [...entry.accessTimes, timestamp],
  };
  updated.lastActivation = computeActivation(updated);
  return updated;
}

/**
 * Create a new activation entry for a fact.
 */
export function createActivationEntry(
  factId: string,
  emotionalWeight: number = 1.0,
): ActivationEntry {
  const now = new Date().toISOString();
  const entry: ActivationEntry = {
    factId,
    accessTimes: [now],
    emotionalWeight,
    lastActivation: 0,
  };
  entry.lastActivation = computeActivation(entry);
  return entry;
}

// ─── Persistence ────────────────────────────────────────────────────────────

/**
 * Load activation log from JSONL file.
 * Returns a Map<factId, ActivationEntry> for fast lookup.
 */
export function loadActivationLog(logPath: string): Map<string, ActivationEntry> {
  const map = new Map<string, ActivationEntry>();
  try {
    const content = fs.readFileSync(logPath, "utf-8").trim();
    if (!content) return map;
    for (const line of content.split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as ActivationEntry;
        if (entry.factId) map.set(entry.factId, entry);
      } catch {}
    }
  } catch {}
  return map;
}

/**
 * Save activation log atomically (tmp + rename).
 */
export function saveActivationLog(logPath: string, log: Map<string, ActivationEntry>): void {
  const entries = [...log.values()];
  const content = entries.map(e => JSON.stringify(e)).join("\n") + (entries.length > 0 ? "\n" : "");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const tmpFile = logPath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, content, "utf-8");
  fs.renameSync(tmpFile, logPath);
}

/**
 * Get the activation log file path for a graph directory.
 */
export function activationLogPath(graphDir: string): string {
  return path.join(graphDir, "activation-log.jsonl");
}
