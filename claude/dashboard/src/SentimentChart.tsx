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
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div style={{ color: "#71717a", marginBottom: "2px" }}>{label}</div>
      <div style={{ color, fontWeight: 600 }}>
        {score} — {scoreLabel(score)}
      </div>
      {payload[0].payload.trigger && (
        <div style={{ color: "#52525b", marginTop: "2px", maxWidth: "200px" }}>
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
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "8px",
          padding: "24px",
          color: "#52525b",
          fontSize: "14px",
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
    <div
      style={{
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        padding: "20px 24px",
      }}
    >
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#52525b", fontSize: 11 }}
            axisLine={{ stroke: "#27272a" }}
            tickLine={false}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: "#52525b", fontSize: 11 }}
            axisLine={{ stroke: "#27272a" }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={{ fill: "#14b8a6", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#14b8a6" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: "8px", fontSize: "11px", color: "#52525b" }}>
        1 = tres positif  /  5 = tres tendu
      </div>
    </div>
  );
}
