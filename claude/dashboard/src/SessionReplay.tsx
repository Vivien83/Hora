import { useState, useEffect } from "react";

const C = {
  bg: "#F2F0E9",
  glass: {
    background: "rgba(255,255,255,0.45)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: "20px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
  } as React.CSSProperties,
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  gold: "#D4A853",
  accent: "#6366f1",
  border: "rgba(0,0,0,0.06)",
  glassBorder: "rgba(255,255,255,0.7)",
  serif: "'Playfair Display', Georgia, serif" as string,
  sans: "'DM Sans', sans-serif" as string,
  mono: "'JetBrains Mono', monospace" as string,
};

interface SessionListItem {
  id: string;
  date: string;
  summary: string;
  sizeKb: number;
}

interface SessionDetail {
  content: string;
  sentiment: number | null;
  failures: Array<{ type: string; summary: string }>;
  date: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function parseMessages(raw: string): { header: string; messages: ChatMessage[] } {
  const lines = raw.split("\n");
  const headerLines: string[] = [];
  const messages: ChatMessage[] = [];
  let inHeader = true;
  let currentRole: ChatMessage["role"] | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    // Detect message start: [user]: or [assistant]: or [queue-operation]:
    const match = line.match(/^\[(user|assistant|utilisateur|queue-operation)\]\s*:\s*(.*)/i);
    if (match) {
      inHeader = false;
      // Flush previous message
      if (currentRole !== null) {
        messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
      }
      const tag = match[1].toLowerCase();
      currentRole = tag === "user" || tag === "utilisateur" ? "user"
        : tag === "assistant" ? "assistant" : "system";
      currentLines = match[2] ? [match[2]] : [];
    } else if (inHeader) {
      headerLines.push(line);
    } else if (currentRole !== null) {
      currentLines.push(line);
    }
  }
  // Flush last message
  if (currentRole !== null) {
    messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
  }
  return { header: headerLines.join("\n").trim(), messages };
}

function sentimentColor(score: number): string {
  if (score <= 1) return "#22c55e";
  if (score <= 2) return "#84cc16";
  if (score <= 3) return "#eab308";
  if (score <= 4) return "#f97316";
  return "#ef4444";
}

function sentimentLabel(score: number): string {
  if (score <= 1) return "Excellent";
  if (score <= 2) return "Bon";
  if (score <= 3) return "Neutre";
  if (score <= 4) return "Tendu";
  return "Difficile";
}

export function SessionReplay() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [failuresExpanded, setFailuresExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/hora/sessions-list")
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function loadSession(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setFailuresExpanded(false);
    fetch(`/api/hora/session/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setDetail(null);
        } else {
          setDetail(d);
        }
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  }

  if (loading) {
    return (
      <div style={{ color: C.textMuted, fontSize: "14px", padding: "48px 24px", textAlign: "center", fontFamily: C.sans }}>
        Chargement des sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        style={{
          ...C.glass,
          padding: "48px 24px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: "14px",
          fontFamily: C.sans,
        }}
      >
        Aucune session archivee. Les sessions sont enregistrees automatiquement par HORA.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "16px", height: "calc(100vh - 80px)" }}>
      {/* Left panel — Session list */}
      <div
        style={{
          width: "320px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          ...C.glass,
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${C.border}`,
            fontSize: "12px",
            fontWeight: 600,
            color: C.textMuted,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontFamily: C.mono,
          }}
        >
          Sessions ({sessions.length})
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 16px",
                border: "none",
                borderBottom: `1px solid ${C.border}`,
                cursor: "pointer",
                background: selectedId === s.id ? "rgba(99,102,241,0.06)" : "transparent",
                borderLeft: selectedId === s.id ? `2px solid ${C.gold}` : "2px solid transparent",
                transition: "all 100ms",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: selectedId === s.id ? C.gold : C.textTertiary,
                  fontFamily: C.mono,
                  marginBottom: "4px",
                }}
              >
                {s.date}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: selectedId === s.id ? C.text : C.textMuted,
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: C.sans,
                }}
              >
                {s.summary || "(sans titre)"}
              </div>
              <div style={{ fontSize: "10px", color: C.textTertiary, marginTop: "2px", fontFamily: C.mono }}>
                {s.sizeKb} Ko
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — Session content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          ...C.glass,
        }}
      >
        {!selectedId && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.textMuted,
              fontSize: "14px",
              fontFamily: C.sans,
            }}
          >
            Selectionnez une session pour la visualiser.
          </div>
        )}

        {selectedId && detailLoading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.textMuted,
              fontSize: "14px",
              fontFamily: C.sans,
            }}
          >
            Chargement...
          </div>
        )}

        {selectedId && !detailLoading && !detail && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ef4444",
              fontSize: "14px",
              fontFamily: C.sans,
            }}
          >
            Session introuvable.
          </div>
        )}

        {detail && (
          <>
            {/* Header with metadata */}
            <div
              style={{
                padding: "12px 20px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: C.text,
                  fontFamily: C.mono,
                }}
              >
                {selectedId}
              </span>

              {detail.sentiment !== null && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#fff",
                    background: sentimentColor(detail.sentiment),
                    fontFamily: C.sans,
                  }}
                >
                  {detail.sentiment}/5 {sentimentLabel(detail.sentiment)}
                </span>
              )}

              {detail.failures.length > 0 && (
                <button
                  onClick={() => setFailuresExpanded(!failuresExpanded)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 8px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#ef4444",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    cursor: "pointer",
                    transition: "all 100ms",
                    fontFamily: C.sans,
                  }}
                >
                  {detail.failures.length} failure{detail.failures.length > 1 ? "s" : ""}
                  <span style={{ fontSize: "9px" }}>{failuresExpanded ? "▲" : "▼"}</span>
                </button>
              )}
            </div>

            {/* Failures expandable */}
            {failuresExpanded && detail.failures.length > 0 && (
              <div
                style={{
                  padding: "8px 20px",
                  borderBottom: `1px solid ${C.border}`,
                  background: "rgba(239,68,68,0.04)",
                }}
              >
                {detail.failures.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "12px",
                      color: "#ef4444",
                      lineHeight: 1.5,
                      padding: "2px 0",
                      fontFamily: C.sans,
                    }}
                  >
                    - {f.summary}
                  </div>
                ))}
              </div>
            )}

            {/* Content — parsed chat messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {(() => {
                const { header, messages } = parseMessages(detail.content);
                return (
                  <>
                    {header && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: C.textTertiary,
                          fontFamily: C.mono,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          padding: "8px 12px",
                          background: "rgba(0,0,0,0.02)",
                          borderRadius: "8px",
                          borderLeft: `2px solid ${C.gold}`,
                        }}
                      >
                        {header}
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            color: msg.role === "user" ? C.gold
                              : msg.role === "assistant" ? C.accent
                              : C.textTertiary,
                            fontFamily: C.mono,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: "4px",
                          }}
                        >
                          {msg.role === "user" ? "Utilisateur" : msg.role === "assistant" ? "HORA" : "Systeme"}
                        </div>
                        <div
                          style={{
                            maxWidth: msg.role === "user" ? "75%" : "90%",
                            padding: "10px 14px",
                            borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                            background: msg.role === "user"
                              ? "rgba(212, 168, 83, 0.08)"
                              : msg.role === "assistant"
                              ? "rgba(255, 255, 255, 0.6)"
                              : "rgba(0, 0, 0, 0.03)",
                            border: msg.role === "user"
                              ? "1px solid rgba(212, 168, 83, 0.15)"
                              : msg.role === "assistant"
                              ? `1px solid ${C.glassBorder}`
                              : `1px solid ${C.border}`,
                            fontSize: "12px",
                            color: C.textSecondary,
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontFamily: msg.role === "user" ? C.sans : C.mono,
                          }}
                        >
                          {msg.content || "(vide)"}
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <pre
                        style={{
                          margin: 0,
                          fontFamily: C.mono,
                          fontSize: "12px",
                          color: C.textSecondary,
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {detail.content}
                      </pre>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
