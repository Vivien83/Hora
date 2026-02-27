import { useState, useEffect } from "react";

const C = {
  bg: "#0A0A0B",
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
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
      <div style={{ color: C.dim, fontSize: "14px", padding: "48px 24px", textAlign: "center" }}>
        Chargement des sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "48px 24px",
          textAlign: "center",
          color: C.dim,
          fontSize: "14px",
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
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${C.border}`,
            fontSize: "12px",
            fontWeight: 600,
            color: C.muted,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
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
                background: selectedId === s.id ? "#1e1e22" : "transparent",
                borderLeft: selectedId === s.id ? `2px solid ${C.accent}` : "2px solid transparent",
                transition: "all 100ms",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: selectedId === s.id ? C.accent : C.dim,
                  fontFamily: "monospace",
                  marginBottom: "4px",
                }}
              >
                {s.date}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: selectedId === s.id ? C.text : C.muted,
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.summary || "(sans titre)"}
              </div>
              <div style={{ fontSize: "10px", color: C.dim, marginTop: "2px" }}>
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
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {!selectedId && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.dim,
              fontSize: "14px",
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
              color: C.dim,
              fontSize: "14px",
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
                  fontFamily: "monospace",
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
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0A0A0B",
                    background: sentimentColor(detail.sentiment),
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
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#fca5a5",
                    background: "#451a1a",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 100ms",
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
                  background: "#1a1215",
                }}
              >
                {detail.failures.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "12px",
                      color: "#fca5a5",
                      lineHeight: 1.5,
                      padding: "2px 0",
                    }}
                  >
                    - {f.summary}
                  </div>
                ))}
              </div>
            )}

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
                  fontSize: "12px",
                  color: C.muted,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {detail.content}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
