import type { MemoryHealth as MemoryHealthData } from "./types";

const C = {
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  warn: "#f59e0b",
};

const glass = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
};

interface MemoryHealthProps {
  health: MemoryHealthData;
}

function TierBar({ label, tier, color, maxItems }: {
  label: string;
  tier: { items: number; sizeKb: number; oldestDays?: number };
  color: string;
  maxItems: number;
}) {
  const pct = maxItems > 0 ? Math.min(100, (tier.items / maxItems) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: C.textSecondary,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: C.textMuted,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {tier.items} items · {tier.sizeKb} KB
          {tier.oldestDays !== undefined && tier.oldestDays > 0 ? ` · ${tier.oldestDays}j` : ""}
        </span>
      </div>
      <div
        style={{
          height: "6px",
          borderRadius: "3px",
          background: "rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: "3px",
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}

export function MemoryHealth({ health }: MemoryHealthProps) {
  const maxItems = Math.max(health.t1.items, health.t2.items, health.t3.items, 1);

  const gcAgo = health.lastGc
    ? (() => {
        const ms = Date.now() - new Date(health.lastGc).getTime();
        const hours = Math.floor(ms / (60 * 60 * 1000));
        if (hours < 1) return "< 1h";
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}j`;
      })()
    : "jamais";

  return (
    <div
      style={{
        ...glass,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: C.text,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Memory Health
        </span>
        <span
          style={{
            fontSize: "11px",
            color: C.textMuted,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          GC: {gcAgo}
        </span>
      </div>

      <TierBar label="T1 Court terme" tier={health.t1} color="#6366f1" maxItems={maxItems} />
      <TierBar label="T2 Moyen terme" tier={health.t2} color="#3b82f6" maxItems={maxItems} />
      <TierBar label="T3 Long terme" tier={health.t3} color="#8b5cf6" maxItems={maxItems} />

      {health.alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
          {health.alerts.map((alert, i) => (
            <div
              key={i}
              style={{
                fontSize: "11px",
                color: C.warn,
                padding: "4px 8px",
                background: "rgba(245, 158, 11, 0.08)",
                borderRadius: "6px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {alert}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
