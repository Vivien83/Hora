import type { MemoryHealth as MemoryHealthData } from "./types";

const C = {
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
  warn: "#f59e0b",
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
        <span style={{ fontSize: "12px", fontWeight: 500, color: C.text }}>{label}</span>
        <span style={{ fontSize: "11px", color: C.dim }}>
          {tier.items} items · {tier.sizeKb} KB
          {tier.oldestDays !== undefined && tier.oldestDays > 0 ? ` · ${tier.oldestDays}j` : ""}
        </span>
      </div>
      <div
        style={{
          height: "6px",
          borderRadius: "3px",
          background: "#27272a",
          overflow: "hidden",
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
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>Memory Health</span>
        <span style={{ fontSize: "11px", color: C.dim }}>GC: {gcAgo}</span>
      </div>

      <TierBar label="T1 Court terme" tier={health.t1} color={C.accent} maxItems={maxItems} />
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
                borderRadius: "4px",
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
