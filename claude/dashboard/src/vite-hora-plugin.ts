/**
 * Vite plugin for HORA real-time dashboard.
 * Watches MEMORY and project .hora directories, pushes updates via HMR.
 * Provides /api/hora-chat (memory chatbot) and /api/hora-chat-config (settings).
 */

import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import { watch } from "chokidar";
import { homedir } from "os";
import { join } from "path";
import { appendFileSync, readFileSync, existsSync, readdirSync, statSync } from "fs";
import { collectAll } from "../lib/collectors";

const MEMORY_DIR = join(homedir(), ".claude", "MEMORY");
const GRAPH_DIR = join(MEMORY_DIR, "GRAPH");
const CHAT_HISTORY_PATH = join(homedir(), ".claude", "hora-chat-history.jsonl");
const DEBOUNCE_MS = 500;

// Lazy-loaded graph instance (cached across requests)
let graphInstance: unknown = null;
let graphLoadTime = 0;
const GRAPH_CACHE_MS = 30_000;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

// ─── LLM Call ────────────────────────────────────────────────────────────────

interface LLMConfig {
  provider: "anthropic" | "openrouter";
  apiKey: string;
  model: string;
}

// ─── Chat history persistence ────────────────────────────────────────────────

interface HistoryEntry {
  ts: string;
  role: "user" | "hora";
  content: string;
  answer?: string;
  entities?: number;
  facts?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  model?: string;
}

function appendHistory(entry: HistoryEntry): void {
  try {
    appendFileSync(CHAT_HISTORY_PATH, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Non-critical — don't break chat if history write fails
  }
}

function loadHistory(limit = 200): HistoryEntry[] {
  if (!existsSync(CHAT_HISTORY_PATH)) return [];
  try {
    const lines = readFileSync(CHAT_HISTORY_PATH, "utf-8").trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function totalCost(): number {
  const entries = loadHistory(10000);
  return entries.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
}

// ─── LLM Call ────────────────────────────────────────────────────────────────

// Pricing per 1M tokens (input/output) — Feb 2026
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "claude-3-5-haiku-20241022": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-5-20250514": { input: 3.00, output: 15.00 },
  "claude-sonnet-4-6-20250725": { input: 3.00, output: 15.00 },
  "anthropic/claude-3.5-haiku": { input: 0.80, output: 4.00 },
  "anthropic/claude-3.5-sonnet": { input: 3.00, output: 15.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? { input: 1.00, output: 5.00 }; // conservative fallback
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

interface LLMResult {
  answer: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResult> {
  if (config.provider === "anthropic") {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic API ${resp.status}: ${err}`);
    }
    const data = await resp.json();
    const answer = data.content?.[0]?.text ?? "";
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    return { answer, inputTokens, outputTokens, costUsd: estimateCost(config.model, inputTokens, outputTokens) };
  }

  // OpenRouter
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter API ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  const answer = data.choices?.[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;

  // Fetch real billed cost from OpenRouter generation stats endpoint
  let costUsd: number | null = null;
  const generationId = data.id;
  if (generationId) {
    // Small delay to let OpenRouter index the generation
    await new Promise((r) => setTimeout(r, 500));
    try {
      const genResp = await fetch(`https://openrouter.ai/api/v1/generation?id=${generationId}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      if (genResp.ok) {
        const genData = await genResp.json();
        if (typeof genData.data?.total_cost === "number") {
          costUsd = genData.data.total_cost;
        }
      }
    } catch {
      // generation endpoint failed, fall through to fallbacks
    }
  }
  // Fallback: usage.cost from completion response, then local estimate
  if (costUsd === null) {
    const usageCost = data.usage?.cost ?? null;
    costUsd = typeof usageCost === "number" ? usageCost : estimateCost(config.model, inputTokens, outputTokens);
  }
  return { answer, inputTokens, outputTokens, costUsd };
}

// ─── Graph helpers ───────────────────────────────────────────────────────────

async function getGraph() {
  const { HoraGraph } = await import("../../hooks/lib/knowledge-graph");
  const now = Date.now();
  if (!graphInstance || now - graphLoadTime > GRAPH_CACHE_MS) {
    graphInstance = new HoraGraph(GRAPH_DIR);
    graphLoadTime = now;
    // Auto-embed entries missing embeddings
    try {
      const { embed } = await import("../../hooks/lib/embeddings");
      const g = graphInstance as InstanceType<typeof HoraGraph>;
      for (const e of g.getAllEntities()) {
        if (!e.embedding) {
          const emb = await embed(e.name + " " + (e.properties?.description || ""));
          if (emb) g.setEntityEmbedding(e.id, emb);
        }
      }
      for (const f of g.getAllFacts()) {
        if (!f.embedding) {
          const emb = await embed(f.description || f.relation);
          if (emb) g.setFactEmbedding(f.id, emb);
        }
      }
      g.save();
    } catch { /* embeddings unavailable */ }
  }
  return graphInstance as InstanceType<typeof HoraGraph>;
}

function extractEntitiesAndFacts(graph: ReturnType<Awaited<ReturnType<typeof getGraph>> extends infer G ? () => G : never> extends () => infer R ? R : unknown, keywords: string[]) {
  // Use any to simplify — the graph API is untyped from the plugin's perspective
  const g = graph as { getAllEntities: () => Array<Record<string, unknown>>; getAllFacts: () => Array<Record<string, unknown>>; getStats: () => Record<string, number> };
  const allEntities = g.getAllEntities();
  const allFacts = g.getAllFacts();

  const matchedEntities = allEntities
    .filter((e) => {
      const nameL = String(e.name ?? "").toLowerCase();
      const typeL = String(e.type ?? "").toLowerCase();
      return keywords.some((kw) => nameL.includes(kw) || typeL.includes(kw));
    })
    .slice(0, 20)
    .map((e) => {
      const connections = allFacts.filter(
        (f) => (f.source === e.id || f.target === e.id) && f.expired_at === null,
      ).length;
      return { id: String(e.id), name: String(e.name), type: String(e.type), connections };
    });

  const entityIds = new Set(matchedEntities.map((e) => e.id));
  const matchedFacts = allFacts
    .filter((f) => {
      if (f.expired_at !== null) return false;
      const descL = String(f.description ?? "").toLowerCase();
      const relatedToEntity = entityIds.has(String(f.source)) || entityIds.has(String(f.target));
      const descMatch = keywords.some((kw) => descL.includes(kw));
      return relatedToEntity || descMatch;
    })
    .slice(0, 30)
    .map((f) => {
      const srcEntity = allEntities.find((e) => e.id === f.source);
      const tgtEntity = allEntities.find((e) => e.id === f.target);
      return {
        relation: String(f.relation),
        description: String(f.description),
        confidence: Number(f.confidence ?? 0),
        source: String(srcEntity?.name ?? f.source),
        target: String(tgtEntity?.name ?? f.target),
      };
    });

  return { matchedEntities, matchedFacts, stats: g.getStats() };
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export function horaPlugin(projectDir: string): Plugin {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let server: ViteDevServer | null = null;

  function pushUpdate() {
    if (!server) return;
    try {
      const data = collectAll(projectDir);
      server.hot.send("hora:update", data);
    } catch (e) {
      console.error("[hora] collect error:", e);
    }
  }

  function debouncedPush() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(pushUpdate, DEBOUNCE_MS);
  }

  return {
    name: "vite-hora-plugin",

    configureServer(srv) {
      server = srv;

      // ── /api/hora-data ─────────────────────────────────────────────
      srv.middlewares.use("/api/hora-data", (_req, res) => {
        try {
          const data = collectAll(projectDir);
          json(res, data);
        } catch (e) {
          json(res, { error: String(e) }, 500);
        }
      });

      // ── /api/hora-chat-config — GET/POST LLM config ────────────────
      srv.middlewares.use("/api/hora-chat-config", async (req: IncomingMessage, res: ServerResponse) => {
        cors(res);
        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

        const { loadConfig, saveConfig, getDefaultModel } = await import("./chat-config");

        if (req.method === "GET") {
          const config = loadConfig();
          // Never leak the full key to the frontend
          if (config) {
            json(res, {
              provider: config.provider,
              model: config.model,
              keySet: true,
              keyPreview: config.apiKey.slice(0, 8) + "..." + config.apiKey.slice(-4),
            });
          } else {
            json(res, { provider: null, model: null, keySet: false });
          }
          return;
        }

        if (req.method === "POST") {
          try {
            const body = JSON.parse(await readBody(req));
            const provider = body.provider === "openrouter" ? "openrouter" : "anthropic";
            const apiKey = String(body.apiKey ?? "").trim();
            if (!apiKey) {
              json(res, { error: "apiKey required" }, 400);
              return;
            }
            const model = String(body.model ?? "").trim() || getDefaultModel(provider);
            saveConfig({ provider, apiKey, model });
            json(res, { ok: true, provider, model });
          } catch (e) {
            json(res, { error: String(e) }, 400);
          }
          return;
        }

        res.statusCode = 405;
        res.end();
      });

      // ── /api/hora-chat-history — GET chat history + cost ────────────
      srv.middlewares.use("/api/hora-chat-history", (_req: IncomingMessage, res: ServerResponse) => {
        cors(res);
        const entries = loadHistory();
        const cost = entries.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
        json(res, { entries, totalCostUsd: cost });
      });

      // ── /api/hora-chat — Memory chatbot ────────────────────────────
      srv.middlewares.use("/api/hora-chat", async (req: IncomingMessage, res: ServerResponse) => {
        cors(res);
        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }

        const start = Date.now();
        try {
          const body = JSON.parse(await readBody(req));
          const message = String(body?.message ?? "").trim();
          const history = Array.isArray(body?.history) ? body.history : [];

          if (message.length < 2) {
            json(res, { error: "message required (min 2 chars)" }, 400);
            return;
          }

          // 1. Retrieve memory context
          const { agenticRetrieve } = await import("../../hooks/lib/agentic-retrieval");
          const graph = await getGraph();

          const retrievePromise = agenticRetrieve({
            message,
            graph: graph as Parameters<typeof agenticRetrieve>[0]["graph"],
            graphDir: GRAPH_DIR,
            projectName: "hora",
            maxBudget: 8000,
          });
          const memoryContext = await Promise.race([
            retrievePromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
          ]);

          // 2. Extract structured entities/facts
          const keywords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 2);
          const { matchedEntities, matchedFacts, stats } = extractEntitiesAndFacts(graph, keywords);

          // 3. Try LLM synthesis
          const { loadConfig } = await import("./chat-config");
          const config = loadConfig();

          let answer: string | null = null;
          let inputTokens = 0;
          let outputTokens = 0;
          let costUsd = 0;
          let llmUsed = false;

          if (config?.apiKey) {
            const systemPrompt = `Tu es HORA, un assistant memoire. Tu reponds aux questions en te basant EXCLUSIVEMENT sur le contexte memoire fourni ci-dessous.
Si l'information n'est pas dans le contexte, dis-le clairement.
Reponds en francais, de maniere structuree et concise.
Si l'utilisateur demande du contexte a injecter, formate-le proprement pour un copier-coller.

=== MEMOIRE HORA ===
${memoryContext ?? "Aucun contexte pertinent trouve."}

=== ENTITES TROUVEES (${matchedEntities.length}) ===
${matchedEntities.map((e) => `- ${e.name} [${e.type}] (${e.connections} connexions)`).join("\n") || "Aucune"}

=== FACTS PERTINENTS (${matchedFacts.length}) ===
${matchedFacts.map((f) => `- ${f.source} —[${f.relation}]→ ${f.target}: ${f.description} (${Math.round(f.confidence * 100)}%)`).join("\n") || "Aucun"}`;

            // Build conversation history for multi-turn
            const messages = history.slice(-6).map((h: { role: string; content: string }) => ({
              role: h.role === "hora" ? "assistant" : "user",
              content: h.content,
            }));
            messages.push({ role: "user", content: message });

            try {
              const llmResult = await Promise.race([
                callLLM(
                  config,
                  systemPrompt,
                  // For multi-turn with Anthropic, we send conversation
                  config.provider === "anthropic" ? message : messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join("\n"),
                ),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000)),
              ]);

              if (llmResult) {
                answer = llmResult.answer;
                inputTokens = llmResult.inputTokens;
                outputTokens = llmResult.outputTokens;
                costUsd = llmResult.costUsd;
                llmUsed = true;
              }
            } catch (e) {
              console.error("[hora-chat] LLM error:", e);
              // Fallback to retrieval-only mode
            }
          }

          const durationMs = Date.now() - start;

          // Persist to history
          appendHistory({ ts: new Date().toISOString(), role: "user", content: message });
          appendHistory({
            ts: new Date().toISOString(),
            role: "hora",
            content: answer ?? memoryContext ?? "",
            answer: answer ?? undefined,
            entities: matchedEntities.length,
            facts: matchedFacts.length,
            inputTokens: inputTokens || undefined,
            outputTokens: outputTokens || undefined,
            costUsd: costUsd || undefined,
            durationMs,
            model: llmUsed ? config?.model : undefined,
          });

          json(res, {
            answer: answer ?? null,
            context: memoryContext ?? "Aucun resultat pertinent trouve.",
            entities: matchedEntities,
            facts: matchedFacts,
            stats: {
              totalSearched: (stats.entities ?? 0) + (stats.facts ?? 0),
              returned: matchedEntities.length + matchedFacts.length,
              durationMs,
              inputTokens,
              outputTokens,
              costUsd,
              totalCostUsd: totalCost(),
              llmUsed,
            },
          });
        } catch (e) {
          console.error("[hora-chat] error:", e);
          json(res, { error: String(e) }, 500);
        }
      });

      // ── /api/hora/sessions-list — List archived sessions ─────────
      srv.middlewares.use("/api/hora/sessions-list", (_req: IncomingMessage, res: ServerResponse) => {
        cors(res);
        try {
          const sessionsDir = join(homedir(), ".claude", "MEMORY", "SESSIONS");
          if (!existsSync(sessionsDir)) {
            json(res, { sessions: [] });
            return;
          }
          const files = readdirSync(sessionsDir)
            .filter((f) => f.endsWith(".md") && f !== ".gitkeep");
          const sessions = files
            .map((f) => {
              try {
                const filePath = join(sessionsDir, f);
                const st = statSync(filePath);
                const content = readFileSync(filePath, "utf-8");
                const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
                const summary = firstLine.replace(/^#+\s*/, "").slice(0, 120);
                return {
                  id: f.replace(/\.md$/, ""),
                  date: f.slice(0, 19).replace(/T/, " ").replace(/-/g, (m, offset: number) => offset > 9 ? ":" : "-"),
                  summary,
                  sizeKb: Math.round(st.size / 1024 * 10) / 10,
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .sort((a, b) => (b!.id > a!.id ? 1 : -1))
            .slice(0, 50);
          json(res, { sessions });
        } catch (e) {
          json(res, { error: String(e) }, 500);
        }
      });

      // ── /api/hora/session/* — Single session detail ──────────────
      srv.middlewares.use("/api/hora/session", (req: IncomingMessage, res: ServerResponse) => {
        cors(res);
        try {
          // Extract session ID from URL: /api/hora/session/some-id
          const urlPath = req.url ?? "";
          const sessionId = decodeURIComponent(urlPath.replace(/^\//, "").replace(/\?.*$/, ""));
          if (!sessionId) {
            json(res, { error: "session id required" }, 400);
            return;
          }
          const sessionsDir = join(homedir(), ".claude", "MEMORY", "SESSIONS");
          const filePath = join(sessionsDir, sessionId + ".md");
          if (!existsSync(filePath)) {
            json(res, { error: "session not found" }, 404);
            return;
          }
          const content = readFileSync(filePath, "utf-8");
          const st = statSync(filePath);

          // Extract sid suffix (after underscore) for matching sentiment
          const sidMatch = sessionId.match(/_([a-z0-9-]+)$/);
          const sid = sidMatch ? sidMatch[1] : "";

          // Read sentiment
          let sentiment: number | null = null;
          const sentimentPath = join(homedir(), ".claude", "MEMORY", "LEARNING", "ALGORITHM", "sentiment-log.jsonl");
          if (existsSync(sentimentPath)) {
            try {
              const lines = readFileSync(sentimentPath, "utf-8").split("\n").filter(Boolean);
              for (const line of lines) {
                try {
                  const entry = JSON.parse(line);
                  if (entry.sid === sid || entry.sid === sessionId.slice(0, 8)) {
                    sentiment = entry.score ?? null;
                  }
                } catch { /* skip malformed */ }
              }
            } catch { /* file read error */ }
          }

          // Read failures from FAILURES subdirectories matching session date prefix
          const datePrefix = sessionId.slice(0, 19); // e.g. 2026-02-19T17-47-05
          const failuresBase = join(homedir(), ".claude", "MEMORY", "LEARNING", "FAILURES");
          const failures: Array<{ type: string; summary: string }> = [];
          if (existsSync(failuresBase)) {
            try {
              const subdirs = readdirSync(failuresBase).filter((d) => !d.startsWith(".") && d !== "_legacy");
              for (const subdir of subdirs) {
                const subdirPath = join(failuresBase, subdir);
                try {
                  const failFiles = readdirSync(subdirPath).filter((f) => f.startsWith(datePrefix));
                  for (const ff of failFiles) {
                    try {
                      const fc = readFileSync(join(subdirPath, ff), "utf-8");
                      const title = fc.split("\n").find((l) => l.trim().length > 0)?.replace(/^#+\s*/, "").slice(0, 200) ?? ff;
                      failures.push({ type: "failure", summary: title });
                    } catch { /* skip */ }
                  }
                } catch { /* skip unreadable subdir */ }
              }
            } catch { /* failures dir read error */ }
          }

          json(res, {
            content,
            sentiment,
            failures,
            date: st.mtime.toISOString(),
          });
        } catch (e) {
          json(res, { error: String(e) }, 500);
        }
      });

      // ── /api/hora/telemetry — Hook telemetry data ──────────────────
      srv.middlewares.use("/api/hora/telemetry", (_req: IncomingMessage, res: ServerResponse) => {
        cors(res);
        try {
          const toolUsagePath = join(MEMORY_DIR, ".tool-usage.jsonl");
          const monthlyPath = join(MEMORY_DIR, "INSIGHTS", "tool-monthly.jsonl");

          // Parse last 7 days from .tool-usage.jsonl
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          interface ToolEntry { ts: string; session: string; tool: string }
          const entries: ToolEntry[] = [];

          if (existsSync(toolUsagePath)) {
            const lines = readFileSync(toolUsagePath, "utf-8").split("\n").filter(Boolean);
            for (const line of lines) {
              try {
                const entry = JSON.parse(line) as ToolEntry;
                if (new Date(entry.ts) >= sevenDaysAgo) {
                  entries.push(entry);
                }
              } catch {
                // Skip malformed lines
              }
            }
          }

          // Aggregate tool counts
          const toolCounts: Record<string, number> = {};
          const hourBuckets = new Array(24).fill(0) as number[];
          const dailyMap: Record<string, number> = {};
          const sessions = new Set<string>();

          for (const e of entries) {
            // Tool counts
            toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1;

            // Hourly activity
            const d = new Date(e.ts);
            hourBuckets[d.getHours()] += 1;

            // Daily activity
            const dayKey = e.ts.slice(0, 10); // YYYY-MM-DD
            dailyMap[dayKey] = (dailyMap[dayKey] ?? 0) + 1;

            // Unique sessions
            if (e.session) sessions.add(e.session);
          }

          // Top tools sorted
          const totalCalls = entries.length || 1;
          const topTools = Object.entries(toolCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([tool, count]) => ({
              tool,
              count,
              pct: Math.round((count / totalCalls) * 100),
            }));

          // Hourly activity array
          const hourlyActivity = hourBuckets.map((count, hour) => ({ hour, count }));

          // Daily activity sorted
          const dailyActivity = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));

          // Monthly history (optional file)
          let monthlyHistory: unknown[] = [];
          if (existsSync(monthlyPath)) {
            try {
              const mLines = readFileSync(monthlyPath, "utf-8").split("\n").filter(Boolean);
              monthlyHistory = mLines.map((l) => JSON.parse(l));
            } catch {
              // Skip if malformed
            }
          }

          json(res, {
            toolCounts,
            hourlyActivity,
            dailyActivity,
            topTools,
            sessionCount: sessions.size,
            monthlyHistory,
            totalCalls: entries.length,
          });
        } catch (e) {
          json(res, { error: String(e) }, 500);
        }
      });

      // ── /api/hora/memory-diff — Graph diff between sessions ────────
      srv.middlewares.use("/api/hora/memory-diff", (_req: IncomingMessage, res: ServerResponse) => {
        cors(res);
        try {
          const snapshotFile = join(MEMORY_DIR, "GRAPH", "snapshots", "snapshots.jsonl");
          if (!existsSync(snapshotFile)) {
            json(res, { snapshots: [], diff: null, noPrevious: true });
            return;
          }
          const raw = readFileSync(snapshotFile, "utf-8").trim();
          if (!raw) {
            json(res, { snapshots: [], diff: null, noPrevious: true });
            return;
          }
          const lines = raw.split("\n").filter(Boolean);
          const snapshots = lines.slice(-2).map((l) => {
            try { return JSON.parse(l); } catch { return null; }
          }).filter(Boolean);

          if (snapshots.length < 2) {
            json(res, { snapshots, diff: null, noPrevious: true });
            return;
          }

          const before = snapshots[0];
          const after = snapshots[1];
          const beforeEntitySet = new Set<string>(before.entityIds ?? []);
          const afterEntitySet = new Set<string>(after.entityIds ?? []);
          const beforeFactSet = new Set<string>(before.factIds ?? []);
          const afterFactSet = new Set<string>(after.factIds ?? []);
          const afterActiveSet = new Set<string>(after.activeFactIds ?? []);

          const entitiesAdded = (after.entityIds ?? []).filter((id: string) => !beforeEntitySet.has(id));
          const entitiesRemoved = (before.entityIds ?? []).filter((id: string) => !afterEntitySet.has(id));
          const factsAdded = (after.factIds ?? []).filter((id: string) => !beforeFactSet.has(id));
          const factsRemoved = (before.factIds ?? []).filter((id: string) => !afterFactSet.has(id));
          const factsSuperseded = (before.activeFactIds ?? []).filter(
            (id: string) => afterFactSet.has(id) && !afterActiveSet.has(id),
          );
          const totalChanges = entitiesAdded.length + entitiesRemoved.length +
            factsAdded.length + factsRemoved.length + factsSuperseded.length;
          const totalItems = Math.max((before.entityCount ?? 0) + (before.factCount ?? 0), 1);
          const changeScore = Math.min(100, Math.round((totalChanges / totalItems) * 100));

          const diff = {
            from: before.ts,
            to: after.ts,
            entities: { added: entitiesAdded, removed: entitiesRemoved },
            facts: { added: factsAdded, removed: factsRemoved, superseded: factsSuperseded },
            summary: {
              entitiesAdded: entitiesAdded.length,
              entitiesRemoved: entitiesRemoved.length,
              factsAdded: factsAdded.length,
              factsSuperseded: factsSuperseded.length,
            },
            changeScore,
          };

          json(res, { snapshots, diff, noPrevious: false });
        } catch (e) {
          json(res, { error: String(e) }, 500);
        }
      });

      // ── Watch for live updates ─────────────────────────────────────
      const horaDir = join(projectDir, ".hora");
      const watcher = watch([MEMORY_DIR, horaDir], {
        ignoreInitial: true,
        ignored: [/\.DS_Store$/, /node_modules/],
        depth: 5,
      });

      watcher.on("all", debouncedPush);

      srv.httpServer?.on("close", () => {
        watcher.close();
        if (timer) clearTimeout(timer);
      });
    },
  };
}
