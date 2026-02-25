#!/usr/bin/env npx tsx
if (process.env.HORA_SKIP_HOOKS === "1") process.exit(0);
/**
 * HORA — hook: librarian-check (PreToolUse)
 * Enforce le principe library-first avant la création d'un fichier utilitaire.
 *
 * TRIGGER: PreToolUse (matcher: Write)
 *
 * CONDITIONS de déclenchement (les deux doivent être vraies) :
 *   1. Le fichier N'EXISTE PAS encore (création, pas édition)
 *   2. Le chemin contient un pattern utilitaire : utils/, helpers/, lib/
 *
 * WHITELIST (ne se déclenche jamais sur) :
 *   node_modules/, hooks/lib/, claude/, .hora/, __tests__/
 *
 * SORTIE:
 *   hookSpecificOutput → instruction injectée dans le contexte Claude
 *   Toujours exit 0 — ne bloque jamais
 */

import * as fs from "fs";
import * as path from "path";

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    [key: string]: unknown;
  };
}

const UTILITY_PATTERNS = [/\/utils\//, /\/helpers\//, /\/lib\//];

const WHITELIST_PATTERNS = [
  /\/node_modules\//,
  /\/hooks\/lib\//,
  /\/claude\//,
  /\/\.hora\//,
  /\/__tests__\//,
];

function isUtilityPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (WHITELIST_PATTERNS.some((p) => p.test(normalized))) return false;
  return UTILITY_PATTERNS.some((p) => p.test(normalized));
}

function isNewFile(filePath: string): boolean {
  try {
    return !fs.existsSync(filePath);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const raw = await new Promise<string>((resolve) => {
    let data = "";
    const timeout = setTimeout(() => resolve(data), 200);
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  let input: HookInput = {};
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const filePath = input.tool_input?.file_path;
  if (!filePath) {
    process.exit(0);
  }

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!isNewFile(absolutePath)) {
    process.exit(0);
  }

  if (!isUtilityPath(absolutePath)) {
    process.exit(0);
  }

  const shortPath = filePath.replace(process.cwd() + "/", "");

  const message =
    `[HORA Librarian] Nouveau fichier utilitaire détecté : ${shortPath}. ` +
    `Avant de créer ce fichier, vérifie qu'aucune librairie npm ne couvre ce besoin. ` +
    `Critères : TypeScript natif, >10k dl/semaine, <12 mois, MIT/Apache. ` +
    `Si une lib existe → l'utiliser. Sinon → documenter pourquoi dans un commentaire en tête de fichier.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: message,
    })
  );

  process.exit(0);
}

main().catch(() => process.exit(0));
