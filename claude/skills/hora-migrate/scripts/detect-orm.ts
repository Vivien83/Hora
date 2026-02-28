#!/usr/bin/env npx tsx
/**
 * hora-migrate: detect-orm.ts
 * Detecte l'ORM (Drizzle/Prisma), la config, les schema files et les paths de migrations.
 * Output: JSON sur stdout. Progress sur stderr.
 * Usage: npx tsx detect-orm.ts [project-dir]
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

type OrmType = "drizzle" | "prisma" | "none";

interface DetectResult {
  orm: OrmType;
  configPath: string | null;
  schemaFiles: string[];
  dbEnvVar: string | null;
  migrationsDir: string | null;
  cliAvailable: boolean;
  cliCommand: string | null;
  warnings: string[];
}

function log(msg: string): void {
  process.stderr.write(`[hora-migrate] ${msg}\n`);
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readFileSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Cherche un fichier dans le repertoire donne et ses sous-dossiers directs (1 niveau).
 */
function findFile(dir: string, names: string[]): string | null {
  for (const name of names) {
    const direct = path.join(dir, name);
    if (fileExists(direct)) return direct;
  }
  // Sous-dossiers directs (profondeur 1)
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      for (const name of names) {
        const candidate = path.join(dir, entry.name, name);
        if (fileExists(candidate)) return candidate;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Parse basique de drizzle.config.ts / .js sans l'importer.
 * Extrait les valeurs de `out`, `schema`, `dialect` par regex.
 */
function parseDrizzleConfig(content: string): {
  schema: string | string[] | null;
  out: string | null;
  dbEnvVar: string | null;
} {
  const result: { schema: string | string[] | null; out: string | null; dbEnvVar: string | null } =
    { schema: null, out: null, dbEnvVar: null };

  // schema: "./src/schema.ts" ou schema: ["./src/a.ts", "./src/b.ts"]
  const schemaMatch = content.match(/schema\s*:\s*["'`]([^"'`]+)["'`]/);
  if (schemaMatch) result.schema = schemaMatch[1];

  const schemaArrayMatch = content.match(/schema\s*:\s*\[([^\]]+)\]/);
  if (schemaArrayMatch) {
    const items = schemaArrayMatch[1].match(/["'`]([^"'`]+)["'`]/g);
    if (items) result.schema = items.map((s) => s.replace(/["'`]/g, ""));
  }

  // out: "./drizzle"
  const outMatch = content.match(/out\s*:\s*["'`]([^"'`]+)["'`]/);
  if (outMatch) result.out = outMatch[1];

  // Cherche les references a process.env.XXX pour trouver l'env var DB
  const envMatch = content.match(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
  if (envMatch) {
    // Preferer DATABASE_URL, sinon prendre le premier
    const dbUrl = envMatch.find((e) => e.includes("DATABASE_URL") || e.includes("DB_URL"));
    result.dbEnvVar = (dbUrl ?? envMatch[0]).replace("process.env.", "");
  }

  return result;
}

/**
 * Parse basique de prisma/schema.prisma.
 * Extrait le provider et la datasource url env var.
 */
function parsePrismaSchema(content: string): {
  dbEnvVar: string | null;
  provider: string | null;
} {
  const result: { dbEnvVar: string | null; provider: string | null } = {
    dbEnvVar: null,
    provider: null,
  };

  // provider = "postgresql"
  const providerMatch = content.match(/provider\s*=\s*["']([^"']+)["']/);
  if (providerMatch) result.provider = providerMatch[1];

  // url = env("DATABASE_URL")
  const urlMatch = content.match(/url\s*=\s*env\(["']([^"']+)["']\)/);
  if (urlMatch) result.dbEnvVar = urlMatch[1];

  return result;
}

function checkCliAvailable(cmd: string): boolean {
  try {
    execSync(`${cmd} --version`, { stdio: "pipe", encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

function detectDrizzle(projectDir: string): DetectResult | null {
  log("Recherche drizzle.config.ts / drizzle.config.js...");

  const configPath = findFile(projectDir, [
    "drizzle.config.ts",
    "drizzle.config.js",
    "drizzle.config.mts",
    "drizzle.config.mjs",
  ]);

  if (!configPath) {
    // Fallback: presence d'un dossier drizzle/
    const drizzleDir = path.join(projectDir, "drizzle");
    if (!fileExists(drizzleDir)) return null;
    log("Dossier drizzle/ trouve sans config — configuration incomplete.");
  }

  log(`Config Drizzle trouvee : ${configPath ?? "(aucune)"}`);

  const warnings: string[] = [];
  let schemaFiles: string[] = [];
  let migrationsDir: string | null = null;
  let dbEnvVar: string | null = null;

  if (configPath) {
    const content = readFileSafe(configPath);
    if (content) {
      const parsed = parseDrizzleConfig(content);

      if (parsed.schema) {
        const schemas = Array.isArray(parsed.schema) ? parsed.schema : [parsed.schema];
        schemaFiles = schemas.map((s) => path.resolve(path.dirname(configPath), s));
        schemaFiles = schemaFiles.filter((f) => {
          const exists = fileExists(f);
          if (!exists) warnings.push(`Schema file non trouve : ${f}`);
          return exists;
        });
      }

      if (parsed.out) {
        migrationsDir = path.resolve(path.dirname(configPath), parsed.out);
      }

      dbEnvVar = parsed.dbEnvVar;
    }
  }

  // Fallback migrations dir
  if (!migrationsDir) {
    const candidates = [
      path.join(projectDir, "drizzle"),
      path.join(projectDir, "migrations"),
      path.join(projectDir, "db", "migrations"),
    ];
    migrationsDir = candidates.find(fileExists) ?? null;
  }

  if (!dbEnvVar) {
    warnings.push(
      "Variable DATABASE_URL non detectee dans la config — verifier manuellement."
    );
    dbEnvVar = "DATABASE_URL"; // defaut
  }

  // Verifier CLI
  log("Verification de drizzle-kit...");
  const cliLocal = path.join(projectDir, "node_modules", ".bin", "drizzle-kit");
  const cliAvailable = fileExists(cliLocal) || checkCliAvailable("npx drizzle-kit");
  if (!cliAvailable) {
    warnings.push("drizzle-kit non trouve — installer avec : npm install -D drizzle-kit");
  }

  return {
    orm: "drizzle",
    configPath: configPath ?? null,
    schemaFiles,
    dbEnvVar,
    migrationsDir,
    cliAvailable,
    cliCommand: cliAvailable ? "npx drizzle-kit" : null,
    warnings,
  };
}

function detectPrisma(projectDir: string): DetectResult | null {
  log("Recherche prisma/schema.prisma...");

  const schemaPath = findFile(projectDir, [
    path.join("prisma", "schema.prisma"),
    "schema.prisma",
  ]);

  if (!schemaPath) return null;

  log(`Schema Prisma trouve : ${schemaPath}`);

  const warnings: string[] = [];
  let dbEnvVar: string | null = null;
  let migrationsDir: string | null = null;

  const content = readFileSafe(schemaPath);
  if (content) {
    const parsed = parsePrismaSchema(content);
    dbEnvVar = parsed.dbEnvVar;
    if (!dbEnvVar) {
      warnings.push("URL de datasource non detectee dans schema.prisma.");
      dbEnvVar = "DATABASE_URL";
    }
  }

  // Migrations dir Prisma = prisma/migrations/
  const prismaDir = path.dirname(schemaPath);
  const migrationsCandidate = path.join(prismaDir, "migrations");
  migrationsDir = fileExists(migrationsCandidate) ? migrationsCandidate : null;

  // Verifier CLI
  log("Verification de prisma CLI...");
  const cliLocal = path.join(projectDir, "node_modules", ".bin", "prisma");
  const cliAvailable = fileExists(cliLocal) || checkCliAvailable("npx prisma");
  if (!cliAvailable) {
    warnings.push("prisma CLI non trouve — installer avec : npm install -D prisma");
  }

  return {
    orm: "prisma",
    configPath: schemaPath,
    schemaFiles: [schemaPath],
    dbEnvVar,
    migrationsDir,
    cliAvailable,
    cliCommand: cliAvailable ? "npx prisma" : null,
    warnings,
  };
}

function main(): void {
  const projectDir = path.resolve(process.argv[2] ?? process.cwd());
  log(`Analyse du projet : ${projectDir}`);

  if (!fileExists(projectDir)) {
    process.stderr.write(`[hora-migrate] Erreur : repertoire non trouve : ${projectDir}\n`);
    process.exit(1);
  }

  // Drizzle en priorite (plus courant dans la stack HORA)
  let result = detectDrizzle(projectDir);

  if (!result) {
    result = detectPrisma(projectDir);
  }

  if (!result) {
    log("Aucun ORM detecte.");
    result = {
      orm: "none",
      configPath: null,
      schemaFiles: [],
      dbEnvVar: null,
      migrationsDir: null,
      cliAvailable: false,
      cliCommand: null,
      warnings: [
        "Ni Drizzle ni Prisma detecte dans ce projet.",
        "Verifier la presence de drizzle.config.ts ou prisma/schema.prisma.",
      ],
    };
  }

  log(`ORM detecte : ${result.orm}`);
  log(`Schema files : ${result.schemaFiles.length} trouve(s)`);
  log(`CLI disponible : ${result.cliAvailable}`);

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();
