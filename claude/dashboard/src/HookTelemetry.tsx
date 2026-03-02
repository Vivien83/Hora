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
  bg: "#F2F0E9",
  glass: {
    background: "rgba(255,255,255,0.45)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: "20px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
  } as React.CSSProperties,
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  gold: "#D4A853",
  accent: "#6366f1",
  border: "rgba(0,0,0,0.06)",
  grid: "rgba(0,0,0,0.06)",
  serif: "'Playfair Display', Georgia, serif" as string,
  sans: "'DM Sans', sans-serif" as string,
  mono: "'JetBrains Mono', monospace" as string,
  tooltipStyle: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.8)",
    borderRadius: "16px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  } as React.CSSProperties,
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
    <div style={{ ...C.tooltipStyle, padding: "8px 12px", fontSize: "12px" }}>
      <div style={{ color: C.textMuted, marginBottom: "2px", fontFamily: C.sans }}>{label}</div>
      <div style={{ color: C.text, fontWeight: 600, fontFamily: C.mono }}>
        {payload[0].value} {suffix}
      </div>
    </div>
  );
}

function HourlyTooltip({ active, payload, label }: SimpleTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...C.tooltipStyle, padding: "8px 12px", fontSize: "12px" }}>
      <div style={{ color: C.textMuted, marginBottom: "2px", fontFamily: C.sans }}>{label}h</div>
      <div style={{ color: C.text, fontWeight: 600, fontFamily: C.mono }}>{payload[0].value} appels</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const fadeInStyle = `
@keyframes horaFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

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
          ...C.glass,
          padding: "48px 24px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: "14px",
          fontFamily: C.sans,
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
          ...C.glass,
          padding: "48px 24px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: "14px",
          fontFamily: C.sans,
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
      <style>{fadeInStyle}</style>

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
            ...C.glass,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            animation: "horaFadeUp 0.4s ease-out both",
            animationDelay: "0s",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: C.textMuted,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: C.mono,
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
              fontFamily: C.serif,
            }}
          >
            {data.sessionCount}
          </span>
          <span style={{ fontSize: "12px", color: C.textTertiary, marginTop: "2px", fontFamily: C.sans }}>
            sessions uniques
          </span>
        </div>

        {/* Total calls */}
        <div
          style={{
            ...C.glass,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            animation: "horaFadeUp 0.4s ease-out both",
            animationDelay: "0.05s",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: C.textMuted,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: C.mono,
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
              fontFamily: C.serif,
            }}
          >
            {data.totalCalls.toLocaleString()}
          </span>
          <span style={{ fontSize: "12px", color: C.textTertiary, marginTop: "2px", fontFamily: C.sans }}>
            appels d'outils
          </span>
        </div>

        {/* Distinct tools */}
        <div
          style={{
            ...C.glass,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            animation: "horaFadeUp 0.4s ease-out both",
            animationDelay: "0.1s",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: C.textMuted,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: C.mono,
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
              fontFamily: C.serif,
            }}
          >
            {Object.keys(data.toolCounts).length}
          </span>
          <span style={{ fontSize: "12px", color: C.textTertiary, marginTop: "2px", fontFamily: C.sans }}>
            outils utilises
          </span>
        </div>

        {/* Peak hour */}
        <div
          style={{
            ...C.glass,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            animation: "horaFadeUp 0.4s ease-out both",
            animationDelay: "0.15s",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: C.textMuted,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: C.mono,
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
              fontFamily: C.serif,
            }}
          >
            {data.hourlyActivity.reduce((max, h) => (h.count > max.count ? h : max), { hour: 0, count: 0 }).hour}h
          </span>
          <span style={{ fontSize: "12px", color: C.textTertiary, marginTop: "2px", fontFamily: C.sans }}>
            {maxHourlyCount} appels
          </span>
        </div>
      </div>

      {/* Top Tools horizontal bar chart */}
      <div
        style={{
          ...C.glass,
          padding: "20px 24px",
          animation: "horaFadeUp 0.5s ease-out both",
          animationDelay: "0.2s",
        }}
      >
        <div style={{ fontSize: "11px", color: C.textMuted, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: C.mono }}>
          Top 10 outils (7 derniers jours)
        </div>
        {top10.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 36)}>
            <BarChart
              data={top10}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: C.textTertiary, fontSize: 11, fontFamily: C.mono }}
                axisLine={{ stroke: C.grid }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="tool"
                width={120}
                tick={{ fill: C.textMuted, fontSize: 12, fontFamily: C.mono }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<SimpleTooltip />} cursor={{ fill: "rgba(99,102,241,0.04)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
                {top10.map((entry, index) => {
                  const ratio = entry.count / maxToolCount;
                  const opacity = 0.35 + ratio * 0.65;
                  return <Cell key={`cell-${index}`} fill={`rgba(99, 102, 241, ${opacity})`} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: C.textMuted, fontSize: "13px", padding: "16px 0", fontFamily: C.sans }}>
            Aucune donnee d'outils.
          </div>
        )}
      </div>

      {/* Hourly activity heatmap-style bar chart */}
      <div
        style={{
          ...C.glass,
          padding: "20px 24px",
          animation: "horaFadeUp 0.5s ease-out both",
          animationDelay: "0.35s",
        }}
      >
        <div style={{ fontSize: "11px", color: C.textMuted, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: C.mono }}>
          Activite par heure (7 jours cumules)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.hourlyActivity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis
              dataKey="hour"
              tick={{ fill: C.textTertiary, fontSize: 11, fontFamily: C.mono }}
              axisLine={{ stroke: C.grid }}
              tickLine={false}
              tickFormatter={(h: number) => `${h}h`}
            />
            <YAxis
              tick={{ fill: C.textTertiary, fontSize: 11, fontFamily: C.mono }}
              axisLine={{ stroke: C.grid }}
              tickLine={false}
            />
            <Tooltip content={<HourlyTooltip />} cursor={{ fill: "rgba(212,168,83,0.06)" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={1000} animationEasing="ease-out">
              {data.hourlyActivity.map((entry, index) => {
                const ratio = entry.count / maxHourlyCount;
                const opacity = entry.count === 0 ? 0.08 : 0.25 + ratio * 0.75;
                return <Cell key={`h-${index}`} fill={`rgba(212, 168, 83, ${opacity})`} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily activity sparkline */}
      <div
        style={{
          ...C.glass,
          padding: "20px 24px",
          animation: "horaFadeUp 0.5s ease-out both",
          animationDelay: "0.5s",
        }}
      >
        <div style={{ fontSize: "11px", color: C.textMuted, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: C.mono }}>
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
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: C.textTertiary, fontSize: 11, fontFamily: C.mono }}
                axisLine={{ stroke: C.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.textTertiary, fontSize: 11, fontFamily: C.mono }}
                axisLine={{ stroke: C.grid }}
                tickLine={false}
              />
              <Tooltip content={<SimpleTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={C.accent}
                strokeWidth={2}
                fill="url(#areaGrad)"
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: C.textMuted, fontSize: "13px", padding: "16px 0", fontFamily: C.sans }}>
            Aucune activite sur les 7 derniers jours.
          </div>
        )}
      </div>
    </div>
  );
}
