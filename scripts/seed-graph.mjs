#!/usr/bin/env node
/**
 * HORA — Deterministic Knowledge Graph Seed
 *
 * Reads all session archives from MEMORY/SESSIONS/ and extracts
 * entities, facts, and episodes WITHOUT LLM calls.
 *
 * Usage: node scripts/seed-graph.mjs
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, ".claude", "MEMORY");
const SESSIONS_DIR = path.join(MEMORY_DIR, "SESSIONS");
const GRAPH_DIR = path.join(MEMORY_DIR, "GRAPH");

const ENTITIES_FILE = path.join(GRAPH_DIR, "entities.jsonl");
const FACTS_FILE = path.join(GRAPH_DIR, "facts.jsonl");
const EPISODES_FILE = path.join(GRAPH_DIR, "episodes.jsonl");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID().slice(0, 8);
}

function now() {
  return new Date().toISOString();
}

function writeJsonlAtomic(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content =
    entries.map((e) => JSON.stringify(e)).join("\n") +
    (entries.length > 0 ? "\n" : "");
  const tmpFile = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, content, "utf-8");
  fs.renameSync(tmpFile, filePath);
}

function normalizeName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

// ─── Entity Registry (dedup by normalized name) ─────────────────────────────

const entities = new Map(); // normalized name -> EntityNode
const nameToId = new Map(); // normalized name -> id

function upsertEntity(type, name, properties = {}, timestamp = now()) {
  const normalized = normalizeName(name);
  if (nameToId.has(normalized)) {
    const id = nameToId.get(normalized);
    const existing = entities.get(normalized);
    existing.properties = { ...existing.properties, ...properties };
    existing.last_seen = timestamp;
    return id;
  }
  const id = genId();
  const entity = {
    id,
    type,
    name: normalized,
    properties,
    embedding: null,
    created_at: timestamp,
    last_seen: timestamp,
  };
  entities.set(normalized, entity);
  nameToId.set(normalized, id);
  return id;
}

function getEntityId(name) {
  return nameToId.get(normalizeName(name)) || null;
}

// ─── Facts Registry ──────────────────────────────────────────────────────────

const facts = [];
const factDedup = new Set(); // "sourceId:targetId:relation"

function addFact(sourceId, targetId, relation, description, confidence = 0.8, validAt = now()) {
  const key = `${sourceId}:${targetId}:${relation}`;
  if (factDedup.has(key)) return null;
  factDedup.add(key);

  const fact = {
    id: genId(),
    source: sourceId,
    target: targetId,
    relation,
    description,
    embedding: null,
    valid_at: validAt,
    invalid_at: null,
    created_at: now(),
    expired_at: null,
    confidence,
  };
  facts.push(fact);
  return fact.id;
}

// ─── Episodes Registry ───────────────────────────────────────────────────────

const episodes = [];

function addEpisode(sourceRef, entityIds, factIds, timestamp = now()) {
  const episode = {
    id: genId(),
    source_type: "session",
    source_ref: sourceRef,
    timestamp,
    entities_extracted: entityIds,
    facts_extracted: factIds,
  };
  episodes.push(episode);
  return episode.id;
}

// ─── Tool Detection Patterns ─────────────────────────────────────────────────

const TOOL_PATTERNS = [
  // Languages & runtimes
  { pattern: /\btypescript\b/i, name: "TypeScript", type: "tool" },
  { pattern: /\bjavascript\b/i, name: "JavaScript", type: "tool" },
  { pattern: /\bnode\.?js\b/i, name: "Node.js", type: "tool" },
  { pattern: /\bbun\b/i, name: "Bun", type: "tool" },
  { pattern: /\bpython\b/i, name: "Python", type: "tool" },
  { pattern: /\bbash\b/i, name: "Bash", type: "tool" },
  { pattern: /\bpowershell\b/i, name: "PowerShell", type: "tool" },

  // Frameworks
  { pattern: /\bnext\.?js\b/i, name: "Next.js", type: "tool" },
  { pattern: /\breact\b/i, name: "React", type: "tool" },
  { pattern: /\bvite\b/i, name: "Vite", type: "tool" },
  { pattern: /\btailwind\s*css?\b/i, name: "Tailwind CSS", type: "tool" },
  { pattern: /\bshadcn\/?ui\b/i, name: "shadcn/ui", type: "library" },
  { pattern: /\bhono\b/i, name: "Hono", type: "library" },

  // Libraries
  { pattern: /\bdrizzle\b/i, name: "Drizzle ORM", type: "library" },
  { pattern: /\bprisma\b/i, name: "Prisma", type: "library" },
  { pattern: /\bzod\b/i, name: "Zod", type: "library" },
  { pattern: /\btRPC\b/, name: "tRPC", type: "library" },
  { pattern: /\brecharts\b/i, name: "Recharts", type: "library" },
  { pattern: /\bchokidar\b/i, name: "chokidar", type: "library" },
  { pattern: /\breact-force-graph/i, name: "react-force-graph-2d", type: "library" },
  { pattern: /\b@huggingface\/transformers\b/i, name: "@huggingface/transformers", type: "library" },
  { pattern: /\bnode-cron\b/i, name: "node-cron", type: "library" },
  { pattern: /\bvitest\b/i, name: "Vitest", type: "tool" },
  { pattern: /\bplaywright\b/i, name: "Playwright", type: "tool" },
  { pattern: /\bpostgres(?:ql)?\b/i, name: "PostgreSQL", type: "tool" },
  { pattern: /\btelegram\b/i, name: "Telegram", type: "tool" },
  { pattern: /\bwhisper\b/i, name: "Whisper", type: "tool" },
  { pattern: /\bgroq\b/i, name: "Groq", type: "tool" },
  { pattern: /\bdocker\b/i, name: "Docker", type: "tool" },
  { pattern: /\bvercel\b/i, name: "Vercel", type: "tool" },
  { pattern: /\bsentry\b/i, name: "Sentry", type: "tool" },
  { pattern: /\bposthog\b/i, name: "PostHog", type: "tool" },

  // Dev tools
  { pattern: /\bgit\b/i, name: "Git", type: "tool" },
  { pattern: /\bn8n\b/i, name: "n8n", type: "tool" },
  { pattern: /\bclaude\s*code\b/i, name: "Claude Code", type: "tool" },
  { pattern: /\bclaude\s*-p\b/i, name: "Claude CLI", type: "tool" },
  { pattern: /\bjq\b/, name: "jq", type: "tool" },
];

// ─── Concept Detection Patterns ──────────────────────────────────────────────

const CONCEPT_PATTERNS = [
  { pattern: /\bknowledge\s*graph\b/i, name: "knowledge graph" },
  { pattern: /\bmemory\s*tiers?\b/i, name: "memory tiers" },
  { pattern: /\bbi-?temporal(?:ity|ite)?\b/i, name: "bi-temporality" },
  { pattern: /\bembeddings?\s*(?:vectoriels?|locaux)?\b/i, name: "embeddings" },
  { pattern: /\bcosine\s*similarity\b/i, name: "cosine similarity" },
  { pattern: /\bBFS\b/, name: "BFS traversal" },
  { pattern: /\bTDD\b/, name: "TDD" },
  { pattern: /\bghost\s*failures?\b/i, name: "ghost failures" },
  { pattern: /\blibrary[- ]first\b/i, name: "library-first" },
  { pattern: /\bSSOT\b/, name: "SSOT" },
  { pattern: /\bAPEX\b/, name: "APEX methodology" },
  { pattern: /\bcleanroom\b/i, name: "Cleanroom" },
  { pattern: /\bpower\s*of\s*ten\b/i, name: "Power of Ten" },
  { pattern: /\bforge\b/i, name: "Forge workflow" },
  { pattern: /\bdashboard\b/i, name: "dashboard" },
  { pattern: /\bstatusline\b/i, name: "statusline" },
  { pattern: /\bsnapshots?\b/i, name: "snapshots" },
  { pattern: /\bsentiment\b/i, name: "sentiment analysis" },
  { pattern: /\bsession[- ]end\b/i, name: "session-end hook" },
  { pattern: /\bprompt[- ]submit\b/i, name: "prompt-submit hook" },
  { pattern: /\bdoc[- ]sync\b/i, name: "doc-sync" },
  { pattern: /\bbackup\b/i, name: "backup system" },
  { pattern: /\bsecurity\s*(?:hook|audit|events?)?\b/i, name: "security system" },
  { pattern: /\breal[- ]?time\b/i, name: "real-time updates" },
  { pattern: /\bHMR\b/, name: "HMR" },
  { pattern: /\bSSE\b/, name: "SSE" },
  { pattern: /\borchestrat(?:eur|or)\b/i, name: "orchestrator" },
  { pattern: /\bpolling\b/i, name: "polling" },
  { pattern: /\bdry[- ]?run\b/i, name: "dry-run mode" },
  { pattern: /\bAPI\s*routes?\b/i, name: "API routes" },
  { pattern: /\bserver\s*components?\b/i, name: "Server Components" },
  { pattern: /\bapp\s*router\b/i, name: "App Router" },
  { pattern: /\bmigration\b/i, name: "migration" },
  { pattern: /\bheatmap\b/i, name: "heatmap" },
  { pattern: /\binstall\.sh\b/i, name: "install script" },
  { pattern: /\bneural(?:\s*memory)?\s*map\b/i, name: "neural memory map" },
  { pattern: /\bgraphiti\b/i, name: "Graphiti" },
];

// ─── Session Parser ──────────────────────────────────────────────────────────

function parseSession(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath, ".md");

  // Extract metadata
  const sessionId =
    content.match(/\*\*ID\*\*\s*:\s*(\S+)/)?.[1] ||
    content.match(/^ID:\s*(\S+)/m)?.[1] ||
    fileName;

  const projectName =
    content.match(/\*\*Projet\*\*\s*:\s*(.+)/)?.[1]?.trim() ||
    null;

  const projectId =
    content.match(/\*\*ProjetID\*\*\s*:\s*(\S+)/)?.[1] ||
    null;

  const sentimentMatch = content.match(/\*\*Sentiment\*\*\s*:\s*(\d)/);
  const sentiment = sentimentMatch ? parseInt(sentimentMatch[1]) : null;

  const messagesMatch = content.match(/\*\*Messages\*\*\s*:\s*(\d+)/);
  const messageCount = messagesMatch ? parseInt(messagesMatch[1]) : 0;

  const dateMatch = content.match(/\*\*Date\*\*\s*:\s*(\S+)/);
  const sessionDate = dateMatch ? dateMatch[1] : null;

  // Extract timestamp from filename as fallback
  const fileTs = fileName.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  const timestamp = sessionDate || (fileTs ? fileTs[1].replace(/-/g, (m, i) => (i > 9 ? ":" : m)) : now());

  const sessionTitle =
    content.match(/^#\s*Session\s*:\s*(.+)/m)?.[1]?.trim() ||
    content.match(/^#\s*Session\s+(.+)/m)?.[1]?.trim() ||
    null;

  const errorsMatch = content.match(/\*\*Erreurs detectees\*\*\s*:\s*(\d+)/);
  const errorCount = errorsMatch ? parseInt(errorsMatch[1]) : 0;

  return {
    filePath,
    fileName,
    sessionId,
    projectName,
    projectId,
    sentiment,
    messageCount,
    timestamp,
    sessionTitle,
    errorCount,
    content,
  };
}

// ─── Extraction Logic ────────────────────────────────────────────────────────

function extractFromSession(session) {
  const entityIds = [];
  const factIds = [];
  const content = session.content;
  const ts = session.timestamp;

  // 1. HORA entity (always present)
  const horaId = upsertEntity("project", "HORA", { description: "Hybrid Orchestrated Reasoning Architecture" }, ts);
  entityIds.push(horaId);

  // 2. Project entity
  let projectEntityId = null;
  if (session.projectName) {
    projectEntityId = upsertEntity("project", session.projectName, {
      ...(session.projectId ? { projectId: session.projectId } : {}),
    }, ts);
    entityIds.push(projectEntityId);
  }

  // 3. Person: Vivien (the user, always present)
  const vivienId = upsertEntity("person", "Vivien", { role: "developer" }, ts);
  entityIds.push(vivienId);

  // 4. Extract tools mentioned
  const toolsFound = [];
  for (const tp of TOOL_PATTERNS) {
    if (tp.pattern.test(content)) {
      const toolId = upsertEntity(tp.type, tp.name, {}, ts);
      entityIds.push(toolId);
      toolsFound.push({ id: toolId, name: tp.name });
    }
  }

  // 5. Extract concepts mentioned
  const conceptsFound = [];
  for (const cp of CONCEPT_PATTERNS) {
    if (cp.pattern.test(content)) {
      const conceptId = upsertEntity("concept", cp.name, {}, ts);
      entityIds.push(conceptId);
      conceptsFound.push({ id: conceptId, name: cp.name });
    }
  }

  // 6. Extract person names (Melvyn, Holzmann, Harlan Mills etc.)
  const personPatterns = [
    { pattern: /\bMelvyn\b/i, name: "Melvyn" },
    { pattern: /\bHolzmann\b/i, name: "Holzmann" },
    { pattern: /\bHarlan\s*Mills\b/i, name: "Harlan Mills" },
  ];
  for (const pp of personPatterns) {
    if (pp.pattern.test(content)) {
      const personId = upsertEntity("person", pp.name, {}, ts);
      entityIds.push(personId);
    }
  }

  // 7. Extract error_patterns from sessions with errors
  if (session.errorCount > 0) {
    // Look for common error patterns in the text
    const errorPhrases = content.match(/\[(?:erreur|error|bug|fail)\].*$/gim) || [];
    for (const phrase of errorPhrases.slice(0, 3)) {
      const cleanPhrase = phrase.replace(/^\[(?:erreur|error|bug|fail)\]\s*/i, "").trim().slice(0, 80);
      if (cleanPhrase.length > 5) {
        const errorId = upsertEntity("error_pattern", cleanPhrase, { session: session.sessionId }, ts);
        entityIds.push(errorId);
      }
    }
  }

  // ─── Create Facts ────────────────────────────────────────────────────────

  // Vivien works_on project
  if (projectEntityId) {
    const fid = addFact(
      vivienId,
      projectEntityId,
      "works_on",
      `Vivien travaille sur ${session.projectName}`,
      0.9,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  // Project uses tools
  const targetProject = projectEntityId || horaId;
  for (const tool of toolsFound) {
    const fid = addFact(
      targetProject,
      tool.id,
      "uses",
      `${session.projectName || "HORA"} utilise ${tool.name}`,
      0.8,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  // Project involves concepts
  for (const concept of conceptsFound) {
    const fid = addFact(
      targetProject,
      concept.id,
      "involves",
      `${session.projectName || "HORA"} implique ${concept.name}`,
      0.7,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  // If sentiment is low (1-2), create a negative_experience fact
  if (session.sentiment && session.sentiment <= 2 && projectEntityId) {
    const fid = addFact(
      vivienId,
      projectEntityId,
      "frustrated_with",
      `Session avec frustration (sentiment ${session.sentiment}/5) sur ${session.projectName}`,
      0.6,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  // If sentiment is high (4-5), create a positive_experience fact
  if (session.sentiment && session.sentiment >= 4 && projectEntityId) {
    const fid = addFact(
      vivienId,
      projectEntityId,
      "satisfied_with",
      `Session positive (sentiment ${session.sentiment}/5) sur ${session.projectName}`,
      0.6,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  // Detect specific relationships from content
  // "Spotter" uses Nubapp API
  if (/nubapp/i.test(content)) {
    const nubappId = upsertEntity("tool", "Nubapp API", { description: "ResaWOD/Nubapp booking API" }, ts);
    entityIds.push(nubappId);
    if (projectEntityId) {
      const fid = addFact(
        projectEntityId,
        nubappId,
        "integrates",
        `${session.projectName} integre l'API Nubapp pour les reservations CrossFit`,
        0.9,
        ts,
      );
      if (fid) factIds.push(fid);
    }
  }

  // Detect "CrossFit" / "GLHF"
  if (/crossfit|glhf/i.test(content)) {
    const crossfitId = upsertEntity("concept", "CrossFit GLHF", { location: "Craponne" }, ts);
    entityIds.push(crossfitId);
    if (projectEntityId && /spotter/i.test(session.projectName || "")) {
      const fid = addFact(
        projectEntityId,
        crossfitId,
        "serves",
        "Spotter sert la box CrossFit GLHF Craponne",
        0.9,
        ts,
      );
      if (fid) factIds.push(fid);
    }
  }

  // Detect HORA sub-project relationships
  if (session.projectName && session.projectName !== "HORA" &&
    /hora/i.test(content) && !/^hora/i.test(session.projectName)) {
    // This project is related to HORA ecosystem
    const fid = addFact(
      horaId,
      projectEntityId || horaId,
      "ecosystem",
      `${session.projectName} fait partie de l'ecosysteme HORA`,
      0.7,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  // Detect dashboard as HORA sub-project
  if (session.projectName === "dashboard") {
    const fid = addFact(
      horaId,
      projectEntityId,
      "has_component",
      "HORA inclut un dashboard de visualisation",
      0.9,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  // Detect hooks project
  if (session.projectName === "hooks") {
    const fid = addFact(
      horaId,
      projectEntityId,
      "has_component",
      "HORA inclut un systeme de hooks TypeScript",
      0.9,
      ts,
    );
    if (fid) factIds.push(fid);
  }

  return { entityIds: [...new Set(entityIds)], factIds: [...new Set(factIds.filter(Boolean))] };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("=== HORA Knowledge Graph Seed ===\n");

  // Check sessions exist
  if (!fs.existsSync(SESSIONS_DIR)) {
    console.error(`SESSIONS_DIR not found: ${SESSIONS_DIR}`);
    process.exit(1);
  }

  const sessionFiles = fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  console.log(`Found ${sessionFiles.length} session archives\n`);

  // Process each session
  for (const file of sessionFiles) {
    const filePath = path.join(SESSIONS_DIR, file);
    const session = parseSession(filePath);

    // Skip very short sessions (< 3 messages, probably just init)
    if (session.messageCount < 2 && !session.projectName) {
      console.log(`  SKIP ${file} (${session.messageCount} messages, no project)`);
      continue;
    }

    const result = extractFromSession(session);

    // Create episode
    addEpisode(
      session.sessionId,
      result.entityIds,
      result.factIds,
      session.timestamp,
    );

    console.log(
      `  OK   ${file} → ${result.entityIds.length} entities, ${result.factIds.length} facts` +
      (session.projectName ? ` [${session.projectName}]` : ""),
    );
  }

  // Write results
  const allEntities = [...entities.values()];
  const allFacts = facts;
  const allEpisodes = episodes;

  writeJsonlAtomic(ENTITIES_FILE, allEntities);
  writeJsonlAtomic(FACTS_FILE, allFacts);
  writeJsonlAtomic(EPISODES_FILE, allEpisodes);

  console.log(`\n=== Results ===`);
  console.log(`Entities: ${allEntities.length}`);
  console.log(`  Projects: ${allEntities.filter((e) => e.type === "project").length}`);
  console.log(`  Tools:    ${allEntities.filter((e) => e.type === "tool").length}`);
  console.log(`  Libraries:${allEntities.filter((e) => e.type === "library").length}`);
  console.log(`  Concepts: ${allEntities.filter((e) => e.type === "concept").length}`);
  console.log(`  Persons:  ${allEntities.filter((e) => e.type === "person").length}`);
  console.log(`  Errors:   ${allEntities.filter((e) => e.type === "error_pattern").length}`);
  console.log(`Facts:    ${allFacts.length}`);
  console.log(`Episodes: ${allEpisodes.length}`);
  console.log(`\nWritten to ${GRAPH_DIR}/`);

  // Show top entities by connection count
  const connectionCount = new Map();
  for (const fact of allFacts) {
    connectionCount.set(fact.source, (connectionCount.get(fact.source) || 0) + 1);
    connectionCount.set(fact.target, (connectionCount.get(fact.target) || 0) + 1);
  }
  const top = [...connectionCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => {
      const entity = allEntities.find((e) => e.id === id);
      return `  ${entity?.name || id} (${entity?.type}) — ${count} connections`;
    });
  console.log(`\nTop entities:`);
  top.forEach((line) => console.log(line));
}

main();
