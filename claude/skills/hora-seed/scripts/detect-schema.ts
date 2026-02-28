#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/detect-schema.ts [project-dir]
// Detects ORM (Drizzle or Prisma) and extracts schema structure.
// Outputs JSON to stdout, human-readable summary to stderr.

import * as fs from "node:fs";
import * as path from "node:path";

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
  references: { table: string; column: string } | null;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

interface SchemaResult {
  projectDir: string;
  orm: "drizzle" | "prisma" | "unknown";
  schemaFiles: string[];
  tables: TableInfo[];
  totalTables: number;
  totalColumns: number;
}

function findDrizzleConfig(projectDir: string): string | null {
  const candidates = [
    "drizzle.config.ts",
    "drizzle.config.js",
    "drizzle.config.mts",
    "drizzle.config.mjs",
  ];
  for (const candidate of candidates) {
    const filePath = path.join(projectDir, candidate);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function findPrismaSchema(projectDir: string): string | null {
  const candidates = [
    path.join("prisma", "schema.prisma"),
    "schema.prisma",
  ];
  for (const candidate of candidates) {
    const filePath = path.join(projectDir, candidate);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function findDrizzleSchemaFiles(projectDir: string): string[] {
  const results: string[] = [];
  const searchDirs = [
    path.join(projectDir, "src", "db"),
    path.join(projectDir, "src", "schema"),
    path.join(projectDir, "src", "lib", "db"),
    path.join(projectDir, "db"),
    path.join(projectDir, "schema"),
    path.join(projectDir, "drizzle"),
    path.join(projectDir, "src", "server", "db"),
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    walkForSchemas(dir, results);
  }

  // Also check root-level schema files
  const rootFiles = ["schema.ts", "schema.js"];
  for (const file of rootFiles) {
    const filePath = path.join(projectDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (/(?:pgTable|mysqlTable|sqliteTable)\s*\(/.test(content)) {
        results.push(filePath);
      }
    }
  }

  return results;
}

function walkForSchemas(dir: string, results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkForSchemas(fullPath, results);
    } else if (entry.isFile() && /\.(ts|js|mts|mjs)$/.test(entry.name)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (/(?:pgTable|mysqlTable|sqliteTable)\s*\(/.test(content)) {
          results.push(fullPath);
        }
      } catch {
        // skip unreadable files
      }
    }
  }
}

function parseDrizzleSchema(filePath: string): TableInfo[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const tables: TableInfo[] = [];

  // Match pgTable/mysqlTable/sqliteTable("name", { ... })
  const tablePattern = /(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*["'`](\w+)["'`]\s*,\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;

  let match: RegExpExecArray | null;
  while ((match = tablePattern.exec(content)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    const columns = parseDrizzleColumns(columnsBlock);
    tables.push({ name: tableName, columns });
  }

  return tables;
}

function parseDrizzleColumns(block: string): ColumnInfo[] {
  const columns: ColumnInfo[] = [];

  // Match: columnName: type("name").modifiers()
  const colPattern = /(\w+)\s*:\s*(\w+)\s*\(\s*(?:["'`](\w+)["'`])?\s*\)([^,\n]*(?:\([^)]*\)[^,\n]*)*)/g;

  let match: RegExpExecArray | null;
  while ((match = colPattern.exec(block)) !== null) {
    const name = match[1];
    const type = match[2];
    const modifiers = match[4] || "";

    const nullable = /\.notNull\(\)/.test(modifiers) === false;
    const primaryKey = /\.primaryKey\(\)/.test(modifiers);
    const unique = /\.unique\(\)/.test(modifiers);

    // Default value
    let defaultValue: string | null = null;
    const defaultMatch = modifiers.match(/\.default\(([^)]+)\)/);
    if (defaultMatch) defaultValue = defaultMatch[1].trim();
    if (/\.\$defaultFn\(/.test(modifiers)) defaultValue = "$defaultFn";
    if (/\.defaultRandom\(\)/.test(modifiers)) defaultValue = "random()";

    // References
    let references: { table: string; column: string } | null = null;
    const refMatch = modifiers.match(/\.references\(\s*\(\)\s*=>\s*(\w+)\.(\w+)/);
    if (refMatch) {
      references = { table: refMatch[1], column: refMatch[2] };
    }

    columns.push({
      name,
      type,
      nullable,
      primaryKey,
      unique,
      defaultValue,
      references,
    });
  }

  return columns;
}

function parsePrismaSchema(filePath: string): TableInfo[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const tables: TableInfo[] = [];

  // Match model blocks
  const modelPattern = /model\s+(\w+)\s*\{([^}]+)\}/g;

  let match: RegExpExecArray | null;
  while ((match = modelPattern.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = parsePrismaColumns(body);
    tables.push({ name: tableName, columns });
  }

  return tables;
}

function parsePrismaColumns(body: string): ColumnInfo[] {
  const columns: ColumnInfo[] = [];
  const lines = body.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));

  for (const line of lines) {
    // Match: fieldName Type? @modifiers
    const fieldMatch = line.match(/^(\w+)\s+([\w\[\]]+)(\?)?\s*(.*)?$/);
    if (!fieldMatch) continue;

    const name = fieldMatch[1];
    let type = fieldMatch[2];
    const isOptional = fieldMatch[3] === "?";
    const modifiers = fieldMatch[4] || "";

    // Skip relation fields (Type is another model with @relation)
    if (/@relation/.test(modifiers) && !type.startsWith("Int") && !type.startsWith("String")) {
      // Still include if it has @relation but is a scalar type (FK field)
      if (!/^(String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json|Bytes)/.test(type)) {
        continue;
      }
    }

    const primaryKey = /@id/.test(modifiers);
    const unique = /@unique/.test(modifiers);

    let defaultValue: string | null = null;
    const defaultMatch = modifiers.match(/@default\(([^)]+)\)/);
    if (defaultMatch) defaultValue = defaultMatch[1].trim();

    // References from @relation
    let references: { table: string; column: string } | null = null;
    // Check next line or same line for relation info
    // Prisma uses @relation(fields: [userId], references: [id])
    // We detect this from the scalar FK field, not the relation field

    // Map Prisma types to simpler types
    const typeMap: Record<string, string> = {
      String: "text",
      Int: "integer",
      BigInt: "bigint",
      Float: "float",
      Decimal: "decimal",
      Boolean: "boolean",
      DateTime: "timestamp",
      Json: "json",
      Bytes: "bytes",
    };

    const isArray = type.endsWith("[]");
    const baseType = type.replace("[]", "");
    type = typeMap[baseType] || baseType;
    if (isArray) type = type + "[]";

    columns.push({
      name,
      type,
      nullable: isOptional,
      primaryKey,
      unique,
      defaultValue,
      references,
    });
  }

  return columns;
}

function main(): void {
  const projectDir = path.resolve(process.argv[2] || ".");

  if (!fs.existsSync(projectDir)) {
    process.stderr.write(`Error: directory not found: ${projectDir}\n`);
    process.exit(1);
  }

  const result: SchemaResult = {
    projectDir,
    orm: "unknown",
    schemaFiles: [],
    tables: [],
    totalTables: 0,
    totalColumns: 0,
  };

  // Check for Drizzle
  const drizzleConfig = findDrizzleConfig(projectDir);
  const drizzleSchemaFiles = findDrizzleSchemaFiles(projectDir);

  // Check for Prisma
  const prismaSchema = findPrismaSchema(projectDir);

  if (drizzleConfig || drizzleSchemaFiles.length > 0) {
    result.orm = "drizzle";
    result.schemaFiles = drizzleSchemaFiles.map((f) => path.relative(projectDir, f));

    for (const schemaFile of drizzleSchemaFiles) {
      const tables = parseDrizzleSchema(schemaFile);
      result.tables.push(...tables);
    }
  } else if (prismaSchema) {
    result.orm = "prisma";
    result.schemaFiles = [path.relative(projectDir, prismaSchema)];
    result.tables = parsePrismaSchema(prismaSchema);
  }

  result.totalTables = result.tables.length;
  result.totalColumns = result.tables.reduce((sum, t) => sum + t.columns.length, 0);

  // JSON output to stdout
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  // Human-readable to stderr
  process.stderr.write(`\n--- Schema Detection ---\n`);
  process.stderr.write(`Project: ${projectDir}\n`);
  process.stderr.write(`ORM: ${result.orm}\n`);
  process.stderr.write(`Schema files: ${result.schemaFiles.join(", ") || "none"}\n`);
  process.stderr.write(`Tables: ${result.totalTables} | Columns: ${result.totalColumns}\n\n`);

  for (const table of result.tables) {
    process.stderr.write(`  ${table.name} (${table.columns.length} columns)\n`);
    for (const col of table.columns) {
      const flags: string[] = [];
      if (col.primaryKey) flags.push("PK");
      if (col.unique) flags.push("UQ");
      if (!col.nullable) flags.push("NOT NULL");
      if (col.references) flags.push(`FK -> ${col.references.table}.${col.references.column}`);
      if (col.defaultValue) flags.push(`default: ${col.defaultValue}`);
      const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      process.stderr.write(`    ${col.name}: ${col.type}${flagStr}\n`);
    }
    process.stderr.write(`\n`);
  }
}

main();
