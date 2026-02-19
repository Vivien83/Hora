#!/usr/bin/env npx tsx
/**
 * HORA — hook: snapshot (PreToolUse)
 * Sauvegarde un fichier AVANT chaque Write/Edit/MultiEdit.
 * Fonctionne avec ou sans git. Filet de securite universel.
 *
 * Stockage :
 *   .hora/snapshots/manifest.jsonl   — index append-only
 *   .hora/snapshots/YYYY-MM-DD/      — fichiers .bak par jour
 *
 * Limites : 100 snapshots max, 5 Mo par fichier, skip binaires.
 * Sortie : aucune (exit 0 silencieux = l'outil continue).
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const MAX_SNAPSHOTS = 100;
const CLEANUP_TARGET = 90;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

const HORA_DIR = path.join(process.env.HOME!, ".claude", ".hora");
const SNAPSHOTS_DIR = path.join(HORA_DIR, "snapshots");
const MANIFEST_FILE = path.join(SNAPSHOTS_DIR, "manifest.jsonl");

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".avif",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv", ".flac",
  ".zip", ".gz", ".tar", ".rar", ".7z", ".bz2",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".dat",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".sqlite", ".db", ".bundle",
]);

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    command?: string;
    [key: string]: any;
  };
}

interface SnapshotEntry {
  id: string;
  ts: string;
  path: string;
  backup: string;
  tool: string;
  session: string;
  size: number;
}

function isBinary(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function getDateDir(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${h}-${m}-${s}-${ms}`;
}

function countManifestLines(): number {
  try {
    if (!fs.existsSync(MANIFEST_FILE)) return 0;
    const content = fs.readFileSync(MANIFEST_FILE, "utf-8");
    return content.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function cleanup() {
  try {
    if (!fs.existsSync(MANIFEST_FILE)) return;
    const lines = fs.readFileSync(MANIFEST_FILE, "utf-8").trim().split("\n").filter(Boolean);
    if (lines.length <= MAX_SNAPSHOTS) return;

    // Garder les CLEANUP_TARGET derniers
    const toRemove = lines.slice(0, lines.length - CLEANUP_TARGET);
    const toKeep = lines.slice(lines.length - CLEANUP_TARGET);

    // Supprimer les fichiers .bak des anciens snapshots
    for (const line of toRemove) {
      try {
        const entry: SnapshotEntry = JSON.parse(line);
        if (fs.existsSync(entry.backup)) {
          fs.unlinkSync(entry.backup);
        }
      } catch {}
    }

    // Reecrire le manifest avec rename atomique
    const tmpFile = MANIFEST_FILE + ".tmp";
    fs.writeFileSync(tmpFile, toKeep.join("\n") + "\n");
    fs.renameSync(tmpFile, MANIFEST_FILE);

    // Nettoyer les repertoires de dates vides
    try {
      const dateDirs = fs.readdirSync(SNAPSHOTS_DIR).filter((d) => {
        const full = path.join(SNAPSHOTS_DIR, d);
        return fs.statSync(full).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d);
      });
      for (const dir of dateDirs) {
        const full = path.join(SNAPSHOTS_DIR, dir);
        const files = fs.readdirSync(full);
        if (files.length === 0) {
          fs.rmdirSync(full);
        }
      }
    } catch {}
  } catch {}
}

async function main() {
  const input = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });

  let hookData: HookInput = {};
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = hookData.tool_input?.file_path;
  if (!filePath) process.exit(0);

  // Skip : fichier n'existe pas (Write nouveau)
  if (!fs.existsSync(filePath)) process.exit(0);

  // Skip : binaire
  if (isBinary(filePath)) process.exit(0);

  // Skip : fichier vide
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    process.exit(0);
  }
  if (stat.size === 0) process.exit(0);

  // Skip : > 5 Mo
  if (stat.size > MAX_FILE_SIZE) process.exit(0);

  // Creer la structure
  const dateDir = getDateDir();
  const dayDir = path.join(SNAPSHOTS_DIR, dateDir);
  fs.mkdirSync(dayDir, { recursive: true });

  // Nom du backup : HH-MM-SS-mmm_filename.ext.bak
  const ts = getTimestamp();
  const basename = path.basename(filePath);
  const backupName = `${ts}_${basename}.bak`;
  const backupPath = path.join(dayDir, backupName);

  // Copier le fichier
  try {
    fs.copyFileSync(filePath, backupPath);
  } catch {
    process.exit(0);
  }

  // Ecrire dans le manifest (append)
  const entry: SnapshotEntry = {
    id: `snap_${crypto.randomBytes(6).toString("hex")}`,
    ts: new Date().toISOString(),
    path: filePath,
    backup: backupPath,
    tool: hookData.tool_name || "unknown",
    session: hookData.session_id || "unknown",
    size: stat.size,
  };

  try {
    fs.appendFileSync(MANIFEST_FILE, JSON.stringify(entry) + "\n");
  } catch {}

  // Cleanup si necessaire
  if (countManifestLines() > MAX_SNAPSHOTS) {
    cleanup();
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
