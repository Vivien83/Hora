import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SentimentEntry } from "./types";

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

interface SentimentChartProps {
  data: SentimentEntry[];
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.slice(0, 10);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function scoreLabel(score: number): string {
  const labels: Record<number, string> = {
    1: "Positif",
    2: "Satisfait",
    3: "Neutre",
    4: "Frustre",
    5: "Tendu",
  };
  return labels[score] ?? String(score);
}

interface TooltipPayload {
  value: number;
  payload: SentimentEntry;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const color = score <= 2 ? "#22c55e" : score === 3 ? "#eab308" : "#ef4444";
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
      <div style={{ color: "#94a3b8", marginBottom: "2px", fontFamily: mono }}>{label}</div>
      <div style={{ color, fontWeight: 600 }}>
        {score} — {scoreLabel(score)}
      </div>
      {payload[0].payload.trigger && (
        <div style={{ color: "#64748b", marginTop: "2px", maxWidth: "200px" }}>
          {payload[0].payload.trigger}
        </div>
      )}
    </div>
  );
}

export function SentimentChart({ data }: SentimentChartProps) {
  if (data.length === 0) {
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
        Aucune donnee de sentiment. Lancez collect-data.ts apres quelques sessions.
      </div>
    );
  }

  const chartData = data.map((e) => ({
    ...e,
    label: formatTs(e.ts),
  }));

  return (
    <div style={{ ...glass, padding: "20px 24px" }}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: mono }}
            axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
            tickLine={false}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: mono }}
            axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: "#6366f1", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#6366f1" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8", fontFamily: mono }}>
        1 = tres positif  /  5 = tres tendu
      </div>
    </div>
  );
}
