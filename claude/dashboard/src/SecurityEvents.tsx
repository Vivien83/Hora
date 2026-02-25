import type { SecuritySummary } from "./types";

const C = {
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
};

interface SecurityEventsProps {
  security: SecuritySummary;
}

const EVENT_COLORS: Record<string, string> = {
  block: "#ef4444",
  confirm: "#eab308",
  alert: "#f97316",
};

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

function CountBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        padding: "16px 20px",
        flex: 1,
      }}
    >
      <div style={{ fontSize: "11px", color: C.dim, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: count > 0 ? color : C.dim,
          lineHeight: 1.2,
          marginTop: "4px",
        }}
      >
        {count}
      </div>
    </div>
  );
}

export function SecurityEvents({ security }: SecurityEventsProps) {
  const total = security.alerts + security.blocks + security.confirms;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Counters */}
      <div style={{ display: "flex", gap: "12px" }}>
        <CountBadge label="Blocks" count={security.blocks} color="#ef4444" />
        <CountBadge label="Confirms" count={security.confirms} color="#eab308" />
        <CountBadge label="Alerts" count={security.alerts} color="#f97316" />
      </div>

      {/* Recent events */}
      {total > 0 && security.recent.length > 0 && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 140px",
              padding: "8px 16px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: "11px",
              color: C.dim,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            <span>Type</span>
            <span>Raison</span>
            <span>Date</span>
          </div>
          {security.recent.slice(0, 8).map((event, i) => (
            <div
              key={`${event.timestamp}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr 140px",
                padding: "8px 16px",
                borderBottom: i < Math.min(security.recent.length, 8) - 1
                  ? `1px solid #1f1f22`
                  : "none",
                alignItems: "center",
                fontSize: "12px",
              }}
            >
              <span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    color: EVENT_COLORS[event.event_type] ?? C.muted,
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: EVENT_COLORS[event.event_type] ?? C.muted,
                      flexShrink: 0,
                    }}
                  />
                  {event.event_type}
                </span>
              </span>
              <span
                style={{
                  color: C.muted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {event.reason}
              </span>
              <span style={{ color: C.dim, fontSize: "11px" }}>
                {formatTs(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      {total === 0 && (
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
          Aucun evenement de securite enregistre.
        </div>
      )}
    </div>
  );
}
