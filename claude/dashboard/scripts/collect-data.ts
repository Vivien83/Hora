#!/usr/bin/env tsx
/**
 * HORA Dashboard — collect-data.ts
 * CLI wrapper around the shared collectors.
 * Usage : npx tsx scripts/collect-data.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { collectAll } from "../lib/collectors";

function main() {
  console.log("HORA Dashboard — collecte des donnees...");

  const projectDir = process.cwd();
  const data = collectAll(projectDir);

  const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch {
    // already exists
  }

  const outputPath = join(outputDir, "data.json");
  writeFileSync(outputPath, JSON.stringify(data, null, 2) + "\n");

  console.log(`  Sessions    : ${data.sessions.length}`);
  console.log(`  Sentiment   : ${data.sentimentHistory.length} entrees`);
  console.log(`  Snapshots   : ${data.snapshotCount}`);
  console.log(`  Outils      : ${Object.keys(data.toolUsage).length} distincts`);
  console.log(`  Thread      : ${data.thread.length} echanges`);
  console.log(`  Failures    : ${data.failures.length}`);
  console.log(`  Security    : ${data.security.alerts}A ${data.security.blocks}B ${data.security.confirms}C`);
  console.log(`  -> ${outputPath}`);
  console.log("");
  console.log("Lancez maintenant : npm run dev");
}

main();
