import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ToolUsageDay } from "./types";

const C = {
  card: "#18181b",
  border: "#27272a",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
};

interface ToolTimelineProps {
  timeline: ToolUsageDay[];
  toolUsage: Record<string, number>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((acc, p) => acc + (p.value ?? 0), 0);
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div style={{ color: C.muted, marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "#e4e4e7", fontWeight: 600 }}>{total} appels</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function ToolTimeline({ timeline, toolUsage }: ToolTimelineProps) {
  if (timeline.length === 0) {
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
        Aucune donnee de timeline pour les 7 derniers jours.
      </div>
    );
  }

  const chartData = timeline.map((day) => ({
    date: formatDate(day.date),
    total: day.total,
  }));

  // Top 5 tools for display
  const topTools = Object.entries(toolUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Timeline chart */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: "11px", color: C.dim, marginBottom: "12px" }}>
          Appels d'outils par jour (7 derniers jours)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis
              dataKey="date"
              tick={{ fill: C.dim, fontSize: 11 }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: C.dim, fontSize: 11 }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: C.border }} />
            <Bar
              dataKey="total"
              fill={C.accent}
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top tools mini-list */}
      {topTools.length > 0 && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: "11px", color: C.dim, marginBottom: "8px" }}>
            Top 5 outils (tous temps)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {topTools.map(([name, count]) => {
              const maxCount = topTools[0][1];
              const ratio = count / maxCount;
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: C.muted, width: "100px", flexShrink: 0 }}>
                    {name}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "4px",
                      borderRadius: "2px",
                      background: C.border,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${ratio * 100}%`,
                        background: C.accent,
                        borderRadius: "2px",
                        opacity: 0.4 + ratio * 0.6,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: C.dim,
                      width: "50px",
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
