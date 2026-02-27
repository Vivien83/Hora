import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";

const C = {
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
  gold: "#D4A853",
};

interface TelemetryData {
  toolCounts: Record<string, number>;
  hourlyActivity: Array<{ hour: number; count: number }>;
  dailyActivity: Array<{ date: string; count: number }>;
  topTools: Array<{ tool: string; count: number; pct: number }>;
  sessionCount: number;
  monthlyHistory: unknown[];
  totalCalls: number;
}

interface SimpleTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  suffix?: string;
}

function SimpleTooltip({ active, payload, label, suffix = "appels" }: SimpleTooltipProps) {
  if (!active || !payload?.length) return null;
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
      <div style={{ color: C.muted, marginBottom: "2px" }}>{label}</div>
      <div style={{ color: C.text, fontWeight: 600 }}>
        {payload[0].value} {suffix}
      </div>
    </div>
  );
}

function HourlyTooltip({ active, payload, label }: SimpleTooltipProps) {
  if (!active || !payload?.length) return null;
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
      <div style={{ color: C.muted, marginBottom: "2px" }}>{label}h</div>
      <div style={{ color: C.text, fontWeight: 600 }}>{payload[0].value} appels</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function HookTelemetry() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hora/telemetry")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TelemetryData>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "48px 24px",
          textAlign: "center",
          color: C.dim,
          fontSize: "14px",
        }}
      >
        Chargement de la telemetrie...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "48px 24px",
          textAlign: "center",
          color: C.dim,
          fontSize: "14px",
        }}
      >
        {error ? `Erreur : ${error}` : "Aucune donnee de telemetrie disponible."}
      </div>
    );
  }

  const top10 = data.topTools.slice(0, 10);
  const maxToolCount = top10[0]?.count ?? 1;
  const maxHourlyCount = Math.max(...data.hourlyActivity.map((h) => h.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {/* Session count */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "#71717a",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Sessions (7j)
          </span>
          <span
            style={{
              fontSize: "30px",
              fontWeight: 700,
              lineHeight: 1.1,
              color: C.accent,
              letterSpacing: "-0.02em",
            }}
          >
            {data.sessionCount}
          </span>
          <span style={{ fontSize: "12px", color: C.dim, marginTop: "2px" }}>
            sessions uniques
          </span>
        </div>

        {/* Total calls */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "#71717a",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Appels (7j)
          </span>
          <span
            style={{
              fontSize: "30px",
              fontWeight: 700,
              lineHeight: 1.1,
              color: C.text,
              letterSpacing: "-0.02em",
            }}
          >
            {data.totalCalls.toLocaleString()}
          </span>
          <span style={{ fontSize: "12px", color: C.dim, marginTop: "2px" }}>
            appels d'outils
          </span>
        </div>

        {/* Distinct tools */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "#71717a",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Outils distincts
          </span>
          <span
            style={{
              fontSize: "30px",
              fontWeight: 700,
              lineHeight: 1.1,
              color: C.text,
              letterSpacing: "-0.02em",
            }}
          >
            {Object.keys(data.toolCounts).length}
          </span>
          <span style={{ fontSize: "12px", color: C.dim, marginTop: "2px" }}>
            outils utilises
          </span>
        </div>

        {/* Peak hour */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "#71717a",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Heure de pointe
          </span>
          <span
            style={{
              fontSize: "30px",
              fontWeight: 700,
              lineHeight: 1.1,
              color: C.gold,
              letterSpacing: "-0.02em",
            }}
          >
            {data.hourlyActivity.reduce((max, h) => (h.count > max.count ? h : max), { hour: 0, count: 0 }).hour}h
          </span>
          <span style={{ fontSize: "12px", color: C.dim, marginTop: "2px" }}>
            {maxHourlyCount} appels
          </span>
        </div>
      </div>

      {/* Top Tools horizontal bar chart */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: "11px", color: C.dim, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Top 10 outils (7 derniers jours)
        </div>
        {top10.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 36)}>
            <BarChart
              data={top10}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: C.dim, fontSize: 11 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="tool"
                width={120}
                tick={{ fill: C.muted, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<SimpleTooltip />} cursor={{ fill: C.border }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {top10.map((entry, index) => {
                  const ratio = entry.count / maxToolCount;
                  const opacity = 0.4 + ratio * 0.6;
                  return <Cell key={`cell-${index}`} fill={`rgba(20, 184, 166, ${opacity})`} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: C.dim, fontSize: "13px", padding: "16px 0" }}>
            Aucune donnee d'outils.
          </div>
        )}
      </div>

      {/* Hourly activity heatmap-style bar chart */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: "11px", color: C.dim, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Activite par heure (7 jours cumules)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.hourlyActivity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis
              dataKey="hour"
              tick={{ fill: C.dim, fontSize: 11 }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
              tickFormatter={(h: number) => `${h}h`}
            />
            <YAxis
              tick={{ fill: C.dim, fontSize: 11 }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
            />
            <Tooltip content={<HourlyTooltip />} cursor={{ fill: C.border }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.hourlyActivity.map((entry, index) => {
                const ratio = entry.count / maxHourlyCount;
                const opacity = entry.count === 0 ? 0.1 : 0.3 + ratio * 0.7;
                return <Cell key={`h-${index}`} fill={`rgba(212, 168, 83, ${opacity})`} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily activity sparkline */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: "11px", color: C.dim, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Activite quotidienne (7 derniers jours)
        </div>
        {data.dailyActivity.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart
              data={data.dailyActivity.map((d) => ({ ...d, dateLabel: formatDate(d.date) }))}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: C.dim, fontSize: 11 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.dim, fontSize: 11 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
              />
              <Tooltip content={<SimpleTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={C.accent}
                strokeWidth={2}
                fill="url(#areaGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: C.dim, fontSize: "13px", padding: "16px 0" }}>
            Aucune activite sur les 7 derniers jours.
          </div>
        )}
      </div>
    </div>
  );
}
