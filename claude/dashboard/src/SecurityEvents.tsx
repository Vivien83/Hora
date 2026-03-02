import type { SecuritySummary } from "./types";

const C = {
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  border: "rgba(0,0,0,0.06)",
};

const glass = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
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
        ...glass,
        padding: "16px 20px",
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: C.textTertiary,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: count > 0 ? color : C.textTertiary,
          lineHeight: 1.2,
          marginTop: "4px",
          fontFamily: "'Playfair Display', Georgia, serif",
          letterSpacing: "-0.01em",
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
            ...glass,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 140px",
              padding: "8px 16px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: "11px",
              color: C.textTertiary,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
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
                  ? `1px solid ${C.border}`
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
                    color: EVENT_COLORS[event.event_type] ?? C.textMuted,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: EVENT_COLORS[event.event_type] ?? C.textMuted,
                      flexShrink: 0,
                    }}
                  />
                  {event.event_type}
                </span>
              </span>
              <span
                style={{
                  color: C.textSecondary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {event.reason}
              </span>
              <span
                style={{
                  color: C.textMuted,
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {formatTs(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      {total === 0 && (
        <div
          style={{
            ...glass,
            padding: "24px",
            color: C.textMuted,
            fontSize: "14px",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Aucun evenement de securite enregistre.
        </div>
      )}
    </div>
  );
}
