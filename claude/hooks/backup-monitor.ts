#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: backup-monitor
 * Détecte si un backup est nécessaire (trigger temps ou événement).
 * Déclenche l'agent backup si besoin.
 * Met à jour la statusline.
 *
 * Triggers :
 *  - Temps : 15 min écoulées depuis dernier backup ET fichiers modifiés
 *  - Événement : outil Write/Edit/MultiEdit utilisé sur ≥3 fichiers dans la session
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { projectSessionFile } from "./lib/session-paths.js";

const BACKUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const EVENT_THRESHOLD = 3; // fichiers modifiés pour trigger événement
const CHECK_COOLDOWN_MS = 30 * 1000; // 30s minimum entre deux checks complets

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, any>;
  tool_response?: any;
}

interface BackupState {
  lastBackup: string | null;
  strategy: "remote" | "local" | "none";
  branch: string;
  mirrorBranch: string;
  commitCount: number;
}

interface SessionBackupState {
  sessionId: string;
  filesModifiedCount: number;
  lastBackupAttempt: string | null;
  backupCount: number;
}

const HORA_DIR = ".hora";
const BACKUP_STATE_FILE = path.join(HORA_DIR, "backup-state.json");
const BACKUP_LOG = path.join(
  HORA_DIR,
  "backup-log.md"
);

function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --git-dir", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function hasRemote(): boolean {
  try {
    const remotes = execSync("git remote -v", { stdio: "pipe" }).toString();
    return remotes.includes("github.com") || remotes.includes("gitlab.com");
  } catch {
    return false;
  }
}

function getModifiedFilesCount(): number {
  try {
    const output = execSync("git status --short", { stdio: "pipe" }).toString();
    return output.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function getCurrentBranch(): string {
  try {
    return execSync("git branch --show-current", { stdio: "pipe" })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function readBackupState(): BackupState | null {
  try {
    if (fs.existsSync(BACKUP_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_STATE_FILE, "utf-8"));
    }
  } catch {}
  return null;
}

function readSessionState(sessionId: string): SessionBackupState {
  const stateFile = projectSessionFile(sessionId, "session-backup-state", ".json");
  try {
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      if (state.sessionId === sessionId) return state;
    }
  } catch {}
  return {
    sessionId,
    filesModifiedCount: 0,
    lastBackupAttempt: null,
    backupCount: 0,
  };
}

function writeSessionState(state: SessionBackupState) {
  try {
    const stateFile = projectSessionFile(state.sessionId, "session-backup-state", ".json");
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {}
}

function isWriteTool(toolName: string): boolean {
  return ["Write", "Edit", "MultiEdit", "str_replace_based_edit_tool"].includes(toolName);
}

function shouldBackup(
  sessionState: SessionBackupState,
  backupState: BackupState | null,
  modifiedFiles: number
): { should: boolean; reason: string } {
  if (modifiedFiles === 0) {
    return { should: false, reason: "no_changes" };
  }

  // Trigger événement : seuil de fichiers modifiés dans la session
  if (sessionState.filesModifiedCount >= EVENT_THRESHOLD && sessionState.lastBackupAttempt === null) {
    return { should: true, reason: "event_threshold" };
  }

  // Trigger temps : 15 min depuis dernier backup
  if (backupState?.lastBackup) {
    const elapsed = Date.now() - new Date(backupState.lastBackup).getTime();
    if (elapsed >= BACKUP_INTERVAL_MS) {
      return { should: true, reason: "time_interval" };
    }
  } else if (modifiedFiles > 0 && sessionState.filesModifiedCount >= EVENT_THRESHOLD) {
    // Jamais backupé + assez de fichiers modifiés
    return { should: true, reason: "first_backup" };
  }

  // Trigger temps depuis dernière tentative dans la session
  if (sessionState.lastBackupAttempt) {
    const elapsed = Date.now() - new Date(sessionState.lastBackupAttempt).getTime();
    if (elapsed >= BACKUP_INTERVAL_MS && modifiedFiles > 0) {
      return { should: true, reason: "time_interval_session" };
    }
  }

  return { should: false, reason: "ok" };
}

function executeBackup(strategy: "remote" | "local"): {
  success: boolean;
  message: string;
  details: string;
} {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const currentBranch = getCurrentBranch();
  const mirrorBranch = `hora/backup/${currentBranch.replace(/\//g, "-")}`;

  try {
    if (strategy === "remote") {
      // Stash les changements non-commités
      const hasUncommitted = execSync("git status --short", { stdio: "pipe" })
        .toString()
        .trim();

      if (!hasUncommitted) {
        return { success: true, message: "Rien à sauvegarder", details: "" };
      }

      // Sauvegarder les changements en cours
      execSync(
        `git stash push -m "hora-backup-${timestamp}" --include-untracked 2>/dev/null || true`,
        { stdio: "pipe" }
      );

      // Checkout/create mirror branch
      try {
        execSync(`git checkout -B "${mirrorBranch}"`, { stdio: "pipe" });
      } catch {
        execSync(`git checkout -b "${mirrorBranch}"`, { stdio: "pipe" });
      }

      // APPLY (pas pop!) pour garder le stash intact — on le restaure après
      execSync("git stash apply 2>/dev/null || true", { stdio: "pipe" });
      execSync("git add -A", { stdio: "pipe" });

      const filesChanged = execSync("git diff --cached --name-only | wc -l", {
        stdio: "pipe",
      })
        .toString()
        .trim();
      const filesList = execSync(
        "git diff --cached --name-only | head -5 | tr '\n' ', '",
        { stdio: "pipe" }
      )
        .toString()
        .trim();

      execSync(
        `git commit -m "hora/backup: ${timestamp}

Source: ${currentBranch}
Fichiers: ${filesChanged} modifiés
${filesList ? "Inclus: " + filesList : ""}" --allow-empty`,
        { stdio: "pipe" }
      );

      // Push
      execSync(`git push origin "${mirrorBranch}" --force-with-lease`, {
        stdio: "pipe",
      });

      // Retour sur la branche originale et restauration du stash
      execSync(`git checkout "${currentBranch}"`, { stdio: "pipe" });
      execSync("git stash pop 2>/dev/null || true", { stdio: "pipe" });

      return {
        success: true,
        message: `Pushé sur ${mirrorBranch}`,
        details: `${filesChanged} fichiers`,
      };
    } else {
      // Stratégie locale : bundle
      const bundleDir = path.join(HORA_DIR, "backups");
      fs.mkdirSync(bundleDir, { recursive: true });

      const bundleFile = path.join(
        bundleDir,
        `${timestamp}_${currentBranch.replace(/\//g, "-")}.bundle`
      );

      execSync(`git bundle create "${bundleFile}" --all`, { stdio: "pipe" });

      // Garder seulement les 10 derniers bundles
      const bundles = fs
        .readdirSync(bundleDir)
        .filter((f) => f.endsWith(".bundle"))
        .sort();
      if (bundles.length > 10) {
        bundles.slice(0, bundles.length - 10).forEach((b) => {
          try {
            fs.unlinkSync(path.join(bundleDir, b));
          } catch {}
        });
      }

      const size = execSync(`du -sh "${bundleFile}" | cut -f1`, {
        stdio: "pipe",
      })
        .toString()
        .trim();

      return {
        success: true,
        message: `Bundle local créé`,
        details: `${path.basename(bundleFile)} (${size})`,
      };
    }
  } catch (err: any) {
    // Tenter le fallback bundle si remote a échoué
    if (strategy === "remote") {
      try {
        // Revenir sur la branche originale et restaurer le stash
        execSync(`git checkout "${currentBranch}" 2>/dev/null || true`, {
          stdio: "pipe",
        });
        execSync("git stash pop 2>/dev/null || true", { stdio: "pipe" });
      } catch {}

      // Fallback bundle
      return executeBackup("local");
    }

    return {
      success: false,
      message: "Erreur backup",
      details: err.message?.slice(0, 100) || "unknown",
    };
  }
}

function logBackup(
  success: boolean,
  strategy: string,
  message: string,
  modifiedFiles: number
) {
  try {
    const timestamp = new Date().toISOString();
    const branch = getCurrentBranch();
    const status = success ? "✅" : "❌";
    const line = `| ${timestamp} | ${strategy} | ${modifiedFiles} fichiers | ${branch} | ${status} ${message} |\n`;

    if (!fs.existsSync(BACKUP_LOG)) {
      fs.mkdirSync(path.dirname(BACKUP_LOG), { recursive: true });
      fs.writeFileSync(
        BACKUP_LOG,
        "# Hora — Backup Log\n\n| Timestamp | Stratégie | Fichiers | Branche | Statut |\n|---|---|---|---|---|\n"
      );
    }
    fs.appendFileSync(BACKUP_LOG, line);
  } catch {}
}

function formatStatusline(
  backupState: BackupState | null,
  sessionState: SessionBackupState,
  modifiedFiles: number
): string {
  const lastBackup = backupState?.lastBackup
    ? (() => {
        const elapsed = Math.floor(
          (Date.now() - new Date(backupState.lastBackup).getTime()) / 60000
        );
        return elapsed < 1 ? "now" : `${elapsed}min ago`;
      })()
    : "jamais";

  const strategy = backupState?.strategy === "remote" ? "☁️" : "💾";
  const branch = (backupState?.branch || getCurrentBranch()).slice(0, 20);
  const dirty = modifiedFiles > 0 ? ` · ${modifiedFiles}✏️` : "";
  const count =
    sessionState.backupCount > 0 ? ` · ${sessionState.backupCount}x` : "";

  return `[HORA] ${strategy} backup: ${lastBackup}${dirty}${count} | ${branch}`;
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
  } catch {}

  const sessionId = hookData.session_id || "unknown";
  const toolName = hookData.tool_name || "";

  // Rate limiting : éviter les git ops sur chaque outil
  const LAST_CHECK_FILE = projectSessionFile(sessionId, "last-check");
  const isWrite = isWriteTool(toolName);
  if (!isWrite) {
    try {
      const lastCheck = parseInt(fs.readFileSync(LAST_CHECK_FILE, "utf-8").trim(), 10);
      if (Date.now() - lastCheck < CHECK_COOLDOWN_MS) process.exit(0);
    } catch {}
  }
  try {
    fs.mkdirSync(HORA_DIR, { recursive: true });
    fs.writeFileSync(LAST_CHECK_FILE, String(Date.now()));
  } catch {}

  // Seulement dans un repo git
  if (!isGitRepo()) {
    process.exit(0);
  }

  const modifiedFiles = getModifiedFilesCount();
  const sessionState = readSessionState(sessionId);
  const backupState = readBackupState();

  // Incrémenter le compteur de fichiers si outil d'écriture
  if (isWriteTool(toolName)) {
    sessionState.filesModifiedCount += 1;
    writeSessionState(sessionState);
  }

  // Vérifier si backup nécessaire
  const { should, reason } = shouldBackup(sessionState, backupState, modifiedFiles);

  if (should) {
    const strategy = hasRemote() ? "remote" : "local";

    // Mettre à jour l'état avant l'exécution
    sessionState.lastBackupAttempt = new Date().toISOString();
    writeSessionState(sessionState);

    // Exécuter le backup
    const result = executeBackup(strategy);

    if (result.success) {
      sessionState.backupCount += 1;
      writeSessionState(sessionState);

      // Mettre à jour backup-state
      fs.mkdirSync(HORA_DIR, { recursive: true });
      const newBackupState: BackupState = {
        lastBackup: new Date().toISOString(),
        strategy,
        branch: getCurrentBranch(),
        mirrorBranch:
          strategy === "remote"
            ? `hora/backup/${getCurrentBranch().replace(/\//g, "-")}`
            : "local",
        commitCount: (backupState?.commitCount || 0) + 1,
      };
      fs.writeFileSync(BACKUP_STATE_FILE, JSON.stringify(newBackupState, null, 2));

      logBackup(true, strategy, result.message, modifiedFiles);

      // Notifier via hookSpecificOutput (PostToolUse)
      const notification = {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `[HORA Backup] ${result.message} — ${result.details} (trigger: ${reason})`,
        },
      };
      process.stdout.write(JSON.stringify(notification));
    } else {
      logBackup(false, strategy, result.details, modifiedFiles);
    }
  }

  // Mettre à jour le titre du terminal (statusline)
  const statusline = formatStatusline(
    readBackupState(),
    readSessionState(sessionId),
    modifiedFiles
  );

  // Écrire le statusline dans le titre du terminal via ANSI escape
  process.stderr.write(`\x1b]0;${statusline}\x07`);

  process.exit(0);
}

main().catch(() => process.exit(0));
