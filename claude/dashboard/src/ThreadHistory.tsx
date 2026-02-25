import type { ThreadEntry } from "./types";

const C = {
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
};

interface ThreadHistoryProps {
  thread: ThreadEntry[];
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.slice(0, 16);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ThreadHistory({ thread }: ThreadHistoryProps) {
  const recent = thread.slice(-8).reverse();

  if (recent.length === 0) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "24px",
          color: C.dim,
          fontSize: "14px",
        }}
      >
        Aucun echange enregistre.
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {recent.map((entry, i) => (
        <div
          key={`${entry.sid}-${entry.ts}`}
          style={{
            padding: "12px 16px",
            borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : "none",
          }}
        >
          {/* User message */}
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: C.accent,
                flexShrink: 0,
                marginTop: "2px",
                width: "16px",
              }}
            >
              U
            </span>
            <div
              style={{
                fontSize: "13px",
                color: C.text,
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {entry.u}
            </div>
          </div>

          {/* Assistant response */}
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: C.dim,
                flexShrink: 0,
                marginTop: "2px",
                width: "16px",
              }}
            >
              A
            </span>
            <div
              style={{
                fontSize: "12px",
                color: C.muted,
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {entry.a}
            </div>
          </div>

          {/* Meta */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "6px",
              paddingLeft: "24px",
              fontSize: "10px",
              color: C.dim,
            }}
          >
            <span>{formatTs(entry.ts)}</span>
            <span style={{ fontFamily: "monospace" }}>{entry.sid.slice(0, 8)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
