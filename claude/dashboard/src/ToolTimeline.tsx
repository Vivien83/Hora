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
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
        padding: "12px 16px",
        fontSize: "12px",
        fontFamily: sans,
      }}
    >
      <div style={{ color: "#94a3b8", marginBottom: "4px", fontFamily: mono }}>{label}</div>
      <div style={{ color: "#0f172a", fontWeight: 600 }}>{total} appels</div>
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
          ...glass,
          padding: "24px",
          color: "#64748b",
          fontSize: "14px",
          fontFamily: sans,
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

  const topTools = Object.entries(toolUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Timeline chart */}
      <div style={{ ...glass, padding: "20px 24px" }}>
        <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "12px", fontFamily: mono, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Appels d'outils par jour (7 derniers jours)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: mono }}
              axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: mono }}
              axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
            <Bar
              dataKey="total"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top tools mini-list */}
      {topTools.length > 0 && (
        <div style={{ ...glass, padding: "16px 20px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "12px", fontFamily: mono, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Top 5 outils (tous temps)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {topTools.map(([name, count]) => {
              const maxCount = topTools[0][1];
              const ratio = count / maxCount;
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#334155", width: "100px", flexShrink: 0, fontFamily: mono }}>
                    {name}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "4px",
                      borderRadius: "2px",
                      background: "rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${ratio * 100}%`,
                        background: "#6366f1",
                        borderRadius: "2px",
                        opacity: 0.4 + ratio * 0.6,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      width: "50px",
                      textAlign: "right",
                      flexShrink: 0,
                      fontFamily: mono,
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
