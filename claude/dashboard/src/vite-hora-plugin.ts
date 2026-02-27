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
import { appendFileSync, readFileSync, existsSync } from "fs";
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
