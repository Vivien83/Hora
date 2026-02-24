import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ToolUsageChartProps {
  data: Record<string, number>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
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
      <div style={{ color: "#a1a1aa", marginBottom: "2px" }}>{label}</div>
      <div style={{ color: "#e4e4e7", fontWeight: 600 }}>{payload[0].value} appels</div>
    </div>
  );
}

export function ToolUsageChart({ data }: ToolUsageChartProps) {
  const entries = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  if (entries.length === 0) {
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
        Aucune donnee d'usage. Assurez-vous que .tool-usage.jsonl est genere.
      </div>
    );
  }

  const maxCount = entries[0]?.count ?? 1;

  return (
    <div
      style={{
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        padding: "20px 24px",
      }}
    >
      <ResponsiveContainer width="100%" height={Math.max(200, entries.length * 36)}>
        <BarChart
          data={entries}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#52525b", fontSize: 11 }}
            axisLine={{ stroke: "#27272a" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#27272a" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {entries.map((entry, index) => {
              const ratio = entry.count / maxCount;
              const opacity = 0.4 + ratio * 0.6;
              return <Cell key={`cell-${index}`} fill={`rgba(20, 184, 166, ${opacity})`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
