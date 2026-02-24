import type { SessionEntry } from "./types";

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
    <div
      style={{
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px 80px 180px",
          padding: "10px 16px",
          borderBottom: "1px solid #27272a",
          fontSize: "11px",
          color: "#52525b",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        <span>Session</span>
        <span>Date</span>
        <span>Sentiment</span>
        <span>SID</span>
      </div>
      {recent.length === 0 ? (
        <div style={{ padding: "24px 16px", color: "#52525b", fontSize: "14px" }}>
          Aucune session trouvee. Lancez collect-data.ts.
        </div>
      ) : (
        recent.map((s) => (
          <div
            key={s.sid || s.filename}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 80px 180px",
              padding: "10px 16px",
              borderBottom: "1px solid #1f1f22",
              alignItems: "center",
              fontSize: "13px",
            }}
          >
            <span
              style={{
                color: "#e4e4e7",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name || s.filename}
            </span>
            <span style={{ color: "#71717a", fontSize: "12px" }}>
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
                color: "#3f3f46",
                fontSize: "11px",
                fontFamily: "monospace",
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
