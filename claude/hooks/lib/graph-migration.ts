/**
 * HORA -- Lazy Migration: existing MEMORY data -> Knowledge Graph
 *
 * Migrates SESSIONS/*.md into GRAPH/ incrementally (max 3 per call).
 * Called from session-end — must never crash or block.
 */

import * as fs from "fs";
import * as path from "path";
import { HoraGraph } from "./knowledge-graph.js";
import { buildGraphFromSession } from "./graph-builder.js";
import type { EntityNode } from "./knowledge-graph.js";
import type { SessionData } from "./graph-builder.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MigrationReport {
  sessionsMigrated: number;
  totalRemaining: number;
  isComplete: boolean;
  error?: string;
}

interface MigrationProgress {
  migratedFiles: string[];
  lastRun: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_PER_CALL = 3;
const PROGRESS_FILE = ".migration-progress";
const MIGRATED_FLAG = ".migrated";
const ARCHIVE_MAX = 3000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function readProgress(graphDir: string): MigrationProgress {
  const filePath = path.join(graphDir, PROGRESS_FILE);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      migratedFiles: Array.isArray(parsed.migratedFiles) ? parsed.migratedFiles : [],
      lastRun: typeof parsed.lastRun === "string" ? parsed.lastRun : "",
    };
  } catch {
    return { migratedFiles: [], lastRun: "" };
  }
}

function writeProgress(graphDir: string, progress: MigrationProgress): void {
  fs.mkdirSync(graphDir, { recursive: true });
  const filePath = path.join(graphDir, PROGRESS_FILE);
  const tmpFile = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(progress, null, 2), "utf-8");
  fs.renameSync(tmpFile, filePath);
}

function writeMigratedFlag(graphDir: string): void {
  fs.writeFileSync(path.join(graphDir, MIGRATED_FLAG), new Date().toISOString(), "utf-8");
}

/**
 * Parse a session markdown file into partial SessionData.
 *
 * Expected format:
 *   # Session : <name>
 *   - **ID** : <session-id>
 *   - **Projet** : <display>
 *   - **ProjetID** : <id>
 *   - **Messages** : <n>
 *   - **Sentiment** : <n>/5
 *   ...
 *   ---
 *   [transcript]
 */
function parseSessionMarkdown(content: string): SessionData | null {
  if (!content || content.length < 20) return null;

  // Extract metadata fields
  const idMatch = content.match(/\*\*ID\*\*\s*:\s*(.+)/);
  const projectIdMatch = content.match(/\*\*ProjetID\*\*\s*:\s*(.+)/);
  const sentimentMatch = content.match(/\*\*Sentiment\*\*\s*:\s*(\d)/);
  const messagesMatch = content.match(/\*\*Messages\*\*\s*:\s*(\d+)/);

  const sessionId = idMatch ? idMatch[1].trim() : "";
  if (!sessionId) return null;

  const projectId = projectIdMatch ? projectIdMatch[1].trim() : undefined;
  const sentiment = sentimentMatch ? parseInt(sentimentMatch[1], 10) : 3;
  const messageCount = messagesMatch ? parseInt(messagesMatch[1], 10) : 0;

  // Extract transcript (everything after first ---)
  const separatorIndex = content.indexOf("\n---\n");
  let archive = "";
  if (separatorIndex !== -1) {
    archive = content.slice(separatorIndex + 5).trim();
  }
  if (archive.length > ARCHIVE_MAX) {
    archive = archive.slice(0, ARCHIVE_MAX) + "...";
  }

  // Skip very short sessions (< 2 messages = likely noise)
  if (messageCount < 2 && archive.length < 50) return null;

  return {
    sessionId,
    archive,
    failures: [],
    sentiment,
    toolUsage: {},
    projectId: projectId || undefined,
  };
}

function listSessionFiles(memoryDir: string): string[] {
  const sessionsDir = path.join(memoryDir, "SESSIONS");
  try {
    return fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  } catch {
    return [];
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

/**
 * Migrate existing session archives into the Knowledge Graph.
 * Processes max 3 sessions per call to avoid blocking session-end.
 * Tracks progress in GRAPH/.migration-progress.
 */
export async function migrateExistingData(
  graph: HoraGraph,
  memoryDir: string,
): Promise<MigrationReport> {
  try {
    const graphDir = path.join(memoryDir, "GRAPH");
    const flagPath = path.join(graphDir, MIGRATED_FLAG);

    // Already fully migrated
    if (fs.existsSync(flagPath)) {
      return { sessionsMigrated: 0, totalRemaining: 0, isComplete: true };
    }

    // Read progress
    const progress = readProgress(graphDir);
    const migratedSet = new Set(progress.migratedFiles);

    // List unmigrated sessions (exclude _archived/ subdirs via filter above)
    const allFiles = listSessionFiles(memoryDir);
    const remaining = allFiles.filter((f) => !migratedSet.has(f));

    if (remaining.length === 0) {
      // All done
      writeMigratedFlag(graphDir);
      writeProgress(graphDir, { ...progress, lastRun: new Date().toISOString() });
      return { sessionsMigrated: 0, totalRemaining: 0, isComplete: true };
    }

    // Take first batch
    const batch = remaining.slice(0, MAX_PER_CALL);
    const sessionsDir = path.join(memoryDir, "SESSIONS");
    let migrated = 0;

    for (const fileName of batch) {
      try {
        const filePath = path.join(sessionsDir, fileName);
        const content = fs.readFileSync(filePath, "utf-8");
        const sessionData = parseSessionMarkdown(content);

        if (sessionData) {
          await buildGraphFromSession(graph, sessionData);
        }

        // Mark as migrated even if sessionData was null (skip noise files)
        progress.migratedFiles.push(fileName);
        migrated++;
      } catch {
        // Mark as migrated to avoid infinite retry on broken files
        progress.migratedFiles.push(fileName);
      }
    }

    // Update progress
    progress.lastRun = new Date().toISOString();
    writeProgress(graphDir, progress);

    const totalRemaining = remaining.length - migrated;
    const isComplete = totalRemaining <= 0;

    if (isComplete) {
      writeMigratedFlag(graphDir);
    }

    return { sessionsMigrated: migrated, totalRemaining: Math.max(0, totalRemaining), isComplete };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sessionsMigrated: 0, totalRemaining: -1, isComplete: false, error: message };
  }
}
