import type { SessionEntry } from "./types";

const sans = "'DM Sans', sans-serif";
const mono = "'JetBrains Mono', monospace";

const glass = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
};

function sentimentColor(score: number): string {
  if (score <= 2) return "#22c55e";
  if (score === 3) return "#eab308";
  return "#ef4444";
}

function sentimentLabel(score: number): string {
  if (score <= 2) return "Positif";
  if (score === 3) return "Neutre";
  return "Tendu";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

interface SessionsTableProps {
  sessions: SessionEntry[];
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const recent = sessions.slice(0, 15);

  return (
    <div style={{ ...glass, fontFamily: sans }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px 80px 180px",
          padding: "10px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          fontSize: "11px",
          color: "#94a3b8",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: mono,
        }}
      >
        <span>Session</span>
        <span>Date</span>
        <span>Sentiment</span>
        <span>SID</span>
      </div>
      {recent.length === 0 ? (
        <div style={{ padding: "24px 20px", color: "#64748b", fontSize: "14px" }}>
          Aucune session trouvee. Lancez collect-data.ts.
        </div>
      ) : (
        recent.map((s) => (
          <div
            key={s.sid || s.filename}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 80px 180px",
              padding: "10px 20px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              alignItems: "center",
              fontSize: "13px",
            }}
          >
            <span
              style={{
                color: "#0f172a",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name || s.filename}
            </span>
            <span style={{ color: "#64748b", fontSize: "12px" }}>
              {formatDate(s.date)}
            </span>
            <span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: sentimentColor(s.sentiment),
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: sentimentColor(s.sentiment),
                    flexShrink: 0,
                  }}
                />
                {sentimentLabel(s.sentiment)}
              </span>
            </span>
            <span
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontFamily: mono,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.sid || "—"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
