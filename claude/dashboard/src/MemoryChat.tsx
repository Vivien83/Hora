import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, ChatMessageEntity, ChatMessageFact } from "./types";

const C = {
  bg: "#F2F0E9",
  glass: {
    background: "rgba(255,255,255,0.45)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: "20px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
  },
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  gold: "#D4A853",
  goldDim: "#A08040",
  accent: "#6366f1",
  border: "rgba(0,0,0,0.06)",
  serif: "'Playfair Display', Georgia, serif",
  sans: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const TYPE_COLORS: Record<string, string> = {
  project: "#14b8a6",
  tool: "#3b82f6",
  error_pattern: "#ef4444",
  preference: "#a855f7",
  concept: "#f59e0b",
  person: "#22c55e",
  file: "#6b7280",
  library: "#06b6d4",
  pattern: "#ec4899",
  decision: "#f97316",
};

interface MemoryChatProps {
  graphStats?: { totalEntities: number; totalFacts: number } | null;
}

interface ConfigState {
  provider: string | null;
  model: string | null;
  keySet: boolean;
  keyPreview?: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

function SettingsPanel({
  config,
  onSaved,
  onClose,
}: {
  config: ConfigState;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState(config.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(config.model ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const defaults: Record<string, string> = {
    anthropic: "claude-haiku-4-5-20251001",
    openrouter: "anthropic/claude-3.5-haiku",
  };

  async function handleSave() {
    if (!apiKey && !config.keySet) {
      setError("API key requise");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const resp = await fetch("/api/hora-chat-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          model: model || defaults[provider],
        }),
      });
      if (!resp.ok) throw new Error("Erreur sauvegarde");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        ...C.glass,
        padding: "20px",
        margin: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: C.text, fontFamily: C.sans }}>
          Configuration LLM
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: C.textTertiary,
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "4px",
          }}
        >
          ×
        </button>
      </div>

      {/* Provider */}
      <div style={{ display: "flex", gap: "8px" }}>
        {(["anthropic", "openrouter"] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setProvider(p); setModel(defaults[p]); }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "10px",
              border: `1px solid ${provider === p ? C.gold : "rgba(0,0,0,0.08)"}`,
              background: provider === p ? `rgba(212,168,83,0.08)` : "rgba(255,255,255,0.5)",
              color: provider === p ? C.gold : C.textMuted,
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: C.sans,
              transition: "all 150ms",
            }}
          >
            {p === "anthropic" ? "Anthropic" : "OpenRouter"}
          </button>
        ))}
      </div>

      {/* API Key */}
      <div>
        <label style={{ fontSize: "11px", color: C.textMuted, display: "block", marginBottom: "4px", fontFamily: C.sans }}>
          API Key {config.keySet && <span style={{ color: C.accent }}>({config.keyPreview})</span>}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config.keySet ? "Laisser vide pour garder l'actuelle" : provider === "anthropic" ? "sk-ant-..." : "sk-or-..."}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "8px",
            padding: "8px 10px",
            color: C.text,
            fontSize: "12px",
            fontFamily: C.mono,
            outline: "none",
          }}
        />
      </div>

      {/* Model */}
      <div>
        <label style={{ fontSize: "11px", color: C.textMuted, display: "block", marginBottom: "4px", fontFamily: C.sans }}>
          Modele
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={defaults[provider]}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "8px",
            padding: "8px 10px",
            color: C.text,
            fontSize: "12px",
            fontFamily: C.mono,
            outline: "none",
          }}
        />
      </div>

      {error && <div style={{ fontSize: "11px", color: "#ef4444", fontFamily: C.sans }}>{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: C.gold,
          border: "none",
          borderRadius: "10px",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 600,
          padding: "10px",
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.5 : 1,
          fontFamily: C.sans,
          transition: "opacity 150ms",
        }}
      >
        {saving ? "Sauvegarde..." : "Sauvegarder"}
      </button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EntityBadge({ entity }: { entity: ChatMessageEntity }) {
  const color = TYPE_COLORS[entity.type] ?? C.textMuted;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "6px",
        background: `${color}12`,
        border: `1px solid ${color}25`,
        fontSize: "11px",
        color,
        fontWeight: 500,
        fontFamily: C.sans,
      }}
    >
      {entity.name}
      <span style={{ opacity: 0.5, fontSize: "10px", fontFamily: C.mono }}>{entity.type}</span>
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", color: C.textTertiary, fontFamily: C.mono }}>
      <span style={{ display: "inline-block", width: "32px", height: "3px", background: "rgba(0,0,0,0.08)", borderRadius: "2px" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: color, borderRadius: "2px" }} />
      </span>
      {pct}%
    </span>
  );
}

function CollapsibleSection({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: "6px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          color: C.textMuted,
          cursor: "pointer",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "2px 0",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontFamily: C.sans,
        }}
      >
        <span style={{ fontSize: "8px" }}>{open ? "▼" : "▶"}</span>
        {title} ({count})
      </button>
      {open && <div style={{ paddingLeft: "2px", paddingTop: "4px" }}>{children}</div>}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        background: "none",
        border: `1px solid rgba(0,0,0,0.10)`,
        borderRadius: "6px",
        color: copied ? C.accent : C.textMuted,
        fontSize: "10px",
        cursor: "pointer",
        padding: "2px 8px",
        transition: "all 100ms",
        fontFamily: C.sans,
      }}
    >
      {copied ? "Copie !" : label ?? "Copier"}
    </button>
  );
}

// ─── HORA Message ────────────────────────────────────────────────────────────

function HoraMessage({ msg }: { msg: ChatMessage & { answer?: string; llmUsed?: boolean } }) {
  const hasAnswer = !!msg.answer;
  const hasEntities = msg.entities && msg.entities.length > 0;
  const hasFacts = msg.facts && msg.facts.length > 0;

  const copyContext = [
    msg.answer ? `=== Reponse HORA ===\n${msg.answer}` : "",
    msg.entities?.length ? `\n=== Entites (${msg.entities.length}) ===\n${msg.entities.map((e) => `- ${e.name} [${e.type}]`).join("\n")}` : "",
    msg.facts?.length ? `\n=== Facts (${msg.facts.length}) ===\n${msg.facts.map((f) => `- ${f.source} —[${f.relation}]→ ${f.target}: ${f.description}`).join("\n")}` : "",
    msg.content && msg.content !== "Aucun resultat pertinent trouve." ? `\n=== Contexte memoire ===\n${msg.content}` : "",
  ].filter(Boolean).join("\n");

  return (
    <div style={{ padding: "8px 16px 12px" }}>
      {/* LLM Answer */}
      {hasAnswer && (
        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.7,
            color: C.text,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: C.sans,
          }}
        >
          {msg.answer}
        </div>
      )}

      {/* No LLM, no results */}
      {!hasAnswer && !hasEntities && !hasFacts && msg.content === "Aucun resultat pertinent trouve." && (
        <div style={{ color: C.textTertiary, fontSize: "13px", fontFamily: C.sans }}>
          Aucun resultat pertinent dans la memoire pour cette requete.
        </div>
      )}

      {/* No LLM but raw context */}
      {!hasAnswer && msg.content && msg.content !== "Aucun resultat pertinent trouve." && (
        <div
          style={{
            fontSize: "12px",
            lineHeight: 1.6,
            color: C.textSecondary,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: C.sans,
          }}
        >
          {msg.content}
        </div>
      )}

      {/* Entities */}
      {hasEntities && (
        <CollapsibleSection title="Entites" count={msg.entities!.length} defaultOpen={!hasAnswer}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {msg.entities!.map((e) => (
              <EntityBadge key={e.id} entity={e} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Facts */}
      {hasFacts && (
        <CollapsibleSection title="Facts" count={msg.facts!.length} defaultOpen={!hasAnswer}>
          <div style={{ fontSize: "11px" }}>
            {msg.facts!.slice(0, 10).map((f, i) => (
              <div
                key={`${f.source}-${f.relation}-${i}`}
                style={{ padding: "3px 0", borderBottom: `1px solid rgba(0,0,0,0.05)`, display: "flex", gap: "6px", alignItems: "baseline" }}
              >
                <span style={{ color: C.gold, fontWeight: 600, minWidth: "70px", flexShrink: 0, fontFamily: C.mono }}>{f.relation}</span>
                <span style={{ color: C.textMuted, flex: 1, fontFamily: C.sans }}>
                  <span style={{ color: C.textSecondary }}>{f.source}</span> → <span style={{ color: C.textSecondary }}>{f.target}</span>
                </span>
                <ConfidenceBar value={f.confidence} />
              </div>
            ))}
            {msg.facts!.length > 10 && (
              <div style={{ color: C.textTertiary, fontSize: "10px", paddingTop: "4px", fontFamily: C.sans }}>
                +{msg.facts!.length - 10} facts supplementaires
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Actions bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
        <CopyButton text={copyContext} label="Copier le contexte" />
        {msg.stats && (
          <span style={{ fontSize: "10px", color: C.textTertiary, fontFamily: C.mono }}>
            {msg.stats.durationMs}ms · {msg.stats.returned} resultats
            {msg.llmUsed && msg.stats.inputTokens ? ` · ${msg.stats.inputTokens}↑ ${msg.stats.outputTokens}↓` : ""}
          </span>
        )}
        {msg.llmUsed && msg.stats?.costUsd != null && msg.stats.costUsd > 0 && (
          <span style={{ fontSize: "10px", color: C.gold, fontWeight: 600, fontFamily: C.mono }}>
            ${msg.stats.costUsd.toFixed(4)}
          </span>
        )}
        {!msg.llmUsed && msg.stats && (
          <span style={{ fontSize: "10px", color: C.goldDim, fontFamily: C.sans }}>sans LLM</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MemoryChat({ graphStats }: MemoryChatProps) {
  const [messages, setMessages] = useState<Array<ChatMessage & { answer?: string; llmUsed?: boolean }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<ConfigState>({ provider: null, model: null, keySet: false });
  const [totalCost, setTotalCost] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load config + history on mount
  useEffect(() => {
    fetch("/api/hora-chat-config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
    fetch("/api/hora-chat-history")
      .then((r) => r.json())
      .then((data) => {
        setTotalCost(data.totalCostUsd ?? 0);
        const entries = data.entries ?? [];
        if (entries.length > 0) {
          const restored: Array<ChatMessage & { answer?: string; llmUsed?: boolean }> = [];
          for (const e of entries.slice(-40)) {
            restored.push({
              id: e.ts + Math.random().toString(36).slice(2, 5),
              role: e.role,
              content: e.role === "hora" ? (e.answer ?? e.content ?? "") : (e.content ?? ""),
              timestamp: e.ts,
              answer: e.answer,
              llmUsed: !!e.model,
              stats: e.role === "hora" ? {
                totalSearched: 0,
                returned: (e.entities ?? 0) + (e.facts ?? 0),
                durationMs: e.durationMs ?? 0,
                inputTokens: e.inputTokens,
                outputTokens: e.outputTokens,
                costUsd: e.costUsd,
              } : undefined,
            });
          }
          setMessages(restored);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.role === "hora" ? (m.answer ?? m.content) : m.content,
      }));

      const res = await fetch("/api/hora-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const horaMsg: ChatMessage & { answer?: string; llmUsed?: boolean } = {
        id: genId(),
        role: "hora",
        content: data.context ?? "",
        timestamp: new Date().toISOString(),
        entities: data.entities,
        facts: data.facts,
        stats: data.stats ?? undefined,
        answer: data.answer ?? undefined,
        llmUsed: data.stats?.llmUsed ?? false,
      };
      setMessages((prev) => [...prev, horaMsg]);
      if (data.stats?.totalCostUsd != null) setTotalCost(data.stats.totalCostUsd);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: genId(),
        role: "hora",
        content: `Erreur: ${e instanceof Error ? e.message : String(e)}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const entityCount = graphStats?.totalEntities ?? 0;
  const factCount = graphStats?.totalFacts ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: C.bg }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: C.gold, fontFamily: C.serif }}>
            Ask HORA
          </span>
          <span
            style={{
              fontSize: "11px",
              color: C.goldDim,
              padding: "2px 8px",
              background: `rgba(212,168,83,0.08)`,
              border: `1px solid rgba(212,168,83,0.2)`,
              borderRadius: "6px",
              fontFamily: C.mono,
            }}
          >
            {entityCount} entites | {factCount} facts
          </span>
          {config.keySet && (
            <span style={{ fontSize: "10px", color: C.accent, fontFamily: C.sans }}>
              {config.provider} · {config.model}
            </span>
          )}
          {!config.keySet && (
            <span style={{ fontSize: "10px", color: C.textTertiary, fontFamily: C.sans }}>
              retrieval only — configurer un LLM pour les reponses
            </span>
          )}
          {totalCost > 0 && (
            <span
              style={{
                fontSize: "10px",
                color: C.gold,
                padding: "2px 6px",
                background: `rgba(212,168,83,0.08)`,
                border: `1px solid rgba(212,168,83,0.2)`,
                borderRadius: "6px",
                fontWeight: 600,
                fontFamily: C.mono,
              }}
            >
              ${totalCost.toFixed(4)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: "rgba(255,255,255,0.6)",
              border: `1px solid rgba(0,0,0,0.08)`,
              borderRadius: "8px",
              color: C.textMuted,
              fontSize: "11px",
              cursor: "pointer",
              padding: "4px 10px",
              fontFamily: C.sans,
              transition: "all 150ms",
            }}
          >
            {showSettings ? "Fermer" : "Config"}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{
                background: "rgba(255,255,255,0.6)",
                border: `1px solid rgba(0,0,0,0.08)`,
                borderRadius: "8px",
                color: C.textMuted,
                fontSize: "11px",
                cursor: "pointer",
                padding: "4px 10px",
                fontFamily: C.sans,
                transition: "all 150ms",
              }}
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          config={config}
          onSaved={() => {
            setShowSettings(false);
            fetch("/api/hora-chat-config")
              .then((r) => r.json())
              .then(setConfig)
              .catch(() => {});
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Messages area */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {messages.length === 0 && !showSettings && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: "200px",
              gap: "12px",
              color: C.textTertiary,
              fontSize: "13px",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "28px", opacity: 0.25, color: C.gold }}>◆</span>
            <span style={{ fontFamily: C.sans, color: C.textSecondary }}>Interrogez la memoire HORA</span>
            <span style={{ fontSize: "11px", opacity: 0.7, fontFamily: C.sans }}>
              {config.keySet
                ? `Reponses via ${config.provider} · Recherche dans ${entityCount} entites et ${factCount} facts`
                : `Recherche semantique dans ${entityCount} entites et ${factCount} facts`}
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
              {[
                "Quel est le stack de hora ?",
                "Quelles erreurs recurrentes ?",
                "Mes preferences utilisateur",
                "Architecture du knowledge graph",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  style={{
                    background: "rgba(255,255,255,0.55)",
                    border: `1px solid rgba(0,0,0,0.08)`,
                    borderRadius: "10px",
                    color: C.textSecondary,
                    fontSize: "11px",
                    cursor: "pointer",
                    padding: "6px 12px",
                    textAlign: "left",
                    fontFamily: C.sans,
                    transition: "all 150ms",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "user" ? (
              /* User message — glass dorée légère */
              <div
                style={{
                  padding: "10px 16px",
                  background: `rgba(212,168,83,0.06)`,
                  borderBottom: `1px solid rgba(212,168,83,0.08)`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    background: `rgba(212,168,83,0.15)`,
                    border: `1px solid rgba(212,168,83,0.25)`,
                    color: C.gold,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: 700,
                    flexShrink: 0,
                    fontFamily: C.sans,
                  }}
                >
                  U
                </span>
                <span style={{ fontSize: "13px", color: C.text, lineHeight: 1.5, fontFamily: C.sans }}>
                  {msg.content}
                </span>
              </div>
            ) : (
              /* HORA message — glass blanc standard */
              <div
                style={{
                  background: "rgba(255,255,255,0.35)",
                  borderBottom: `1px solid rgba(0,0,0,0.04)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px 0" }}>
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      background: `rgba(212,168,83,0.15)`,
                      border: `1px solid rgba(212,168,83,0.25)`,
                      color: C.gold,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 700,
                      flexShrink: 0,
                      fontFamily: C.sans,
                    }}
                  >
                    H
                  </span>
                  <span style={{ fontSize: "11px", color: C.goldDim, fontWeight: 600, fontFamily: C.sans }}>
                    HORA
                  </span>
                </div>
                <HoraMessage msg={msg} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: "8px", color: C.goldDim, fontSize: "12px", fontFamily: C.sans }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                border: `2px solid rgba(212,168,83,0.25)`,
                borderTopColor: C.gold,
                borderRadius: "50%",
                animation: "hora-spin 0.8s linear infinite",
              }}
            />
            {config.keySet ? "Recherche + synthese en cours..." : "Recherche dans la memoire..."}
            <style>{`@keyframes hora-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — glass avec border gold on focus */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          gap: "8px",
          background: "rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <InputWithFocus
          inputRef={inputRef}
          value={input}
          onChange={setInput}
          onKeyDown={handleKeyDown}
          loading={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            background: C.gold,
            border: "none",
            borderRadius: "10px",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            padding: "10px 16px",
            cursor: loading || !input.trim() ? "default" : "pointer",
            opacity: loading || !input.trim() ? 0.3 : 1,
            transition: "opacity 100ms",
            fontFamily: C.sans,
            flexShrink: 0,
          }}
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}

// ─── Input with gold focus ring ───────────────────────────────────────────────

function InputWithFocus({
  inputRef,
  value,
  onChange,
  onKeyDown,
  loading,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  loading: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="Posez une question sur la memoire HORA..."
      disabled={loading}
      style={{
        flex: 1,
        background: "rgba(255,255,255,0.65)",
        border: `1px solid ${focused ? C.gold : "rgba(0,0,0,0.08)"}`,
        borderRadius: "10px",
        padding: "10px 14px",
        color: C.text,
        fontSize: "13px",
        outline: "none",
        fontFamily: C.sans,
        opacity: loading ? 0.5 : 1,
        transition: "border-color 150ms",
        boxShadow: focused ? `0 0 0 3px rgba(212,168,83,0.12)` : "none",
      }}
    />
  );
}
