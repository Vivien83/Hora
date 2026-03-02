import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardData } from "./types";

interface Props {
  data: DashboardData;
}

export function Overview({ data }: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const [expandedThread, setExpandedThread] = useState<number | null>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setIsLoaded(true), 150);
    const t2 = setTimeout(() => setEntranceDone(true), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const stats = useMemo(() => {
    const sessions = data.sessions;
    const totalMessages = sessions.reduce((a, s) => a + s.messageCount, 0);
    const avgMessages = sessions.length
      ? Math.round(totalMessages / sessions.length)
      : 0;

    const sentimentScores =
      data.sentimentHistory.length > 0
        ? data.sentimentHistory.map((e) => e.score)
        : sessions.map((s) => s.sentiment).filter((s) => s > 0);
    const avgSentiment = sentimentScores.length
      ? (
          sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        ).toFixed(1)
      : "\u2014";

    const secTotal =
      data.security.alerts + data.security.blocks + data.security.confirms;

    // Sentiment chart data — max 20 points for readability
    const sentimentChartData = data.sentimentHistory.length > 0
      ? data.sentimentHistory.slice(-20).map((e) => ({
          date: new Date(e.ts).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
          }),
          score: e.score,
          trigger: e.trigger,
        }))
      : sessions
          .filter((s) => s.sentiment > 0)
          .slice(-20)
          .map((s) => ({
            date: new Date(s.date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
            }),
            score: s.sentiment,
            trigger: s.name,
          }));

    // Recent sessions (last 12)
    const recentSessions = [...sessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);

    // Recent thread exchanges (last 5)
    const recentThread = data.thread.slice(-5).reverse();

    // Tool usage top 10
    const toolEntries = Object.entries(data.toolUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    const toolMax = toolEntries[0]?.[1] ?? 1;

    return {
      totalSessions: sessions.length,
      totalMessages,
      avgMessages,
      avgSentiment,
      secTotal,
      sentimentChartData,
      recentSessions,
      recentThread,
      toolEntries,
      toolMax,
    };
  }, [data]);

  const sentimentNum = Number(stats.avgSentiment) || 0;
  const sentimentPct = stats.avgSentiment !== "\u2014" ? sentimentNum / 5 : 0;
  const sentimentDashoffset = 351.8 * (1 - sentimentPct);
  const sentimentColor =
    sentimentNum <= 1.5
      ? "#10b981"
      : sentimentNum <= 3
        ? "#f59e0b"
        : "#ef4444";
  const sentimentLabel =
    sentimentNum <= 1.5
      ? "Positif"
      : sentimentNum <= 3
        ? "Neutre"
        : "Tendu";

  const e = (delayMs: number): React.CSSProperties =>
    entranceDone
      ? {}
      : {
          transition: `all 1s cubic-bezier(0.23, 1, 0.32, 1) ${delayMs}ms`,
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? undefined : "translateY(24px)",
        };

  const glass: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.45)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.7)",
    borderRadius: "32px",
  };

  const mono = "'JetBrains Mono', monospace";
  const serif = "'Playfair Display', Georgia, serif";
  const sans = "'DM Sans', sans-serif";
  const lbl: React.CSSProperties = {
    fontSize: "11px",
    fontFamily: mono,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#94a3b8",
  };

  function sentimentDot(score: number): {
    color: string;
    label: string;
  } {
    if (score <= 1.5) return { color: "#10b981", label: "Positif" };
    if (score <= 3) return { color: "#f59e0b", label: "Neutre" };
    return { color: "#ef4444", label: "Tendu" };
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  }

  return (
    <div
      style={{
        margin: "-24px -32px",
        padding: "48px 56px 80px",
        minHeight: "100vh",
        background: "#F2F0E9",
        position: "relative",
        overflowX: "hidden",
        color: "#0f172a",
        fontFamily: sans,
      }}
    >
      <style>{`
        .o-card { transition: all 0.7s cubic-bezier(0.23, 1, 0.32, 1); cursor: default; }
        .o-card:hover { transform: translateY(-8px) !important; box-shadow: 0 25px 50px rgba(0,0,0,0.08) !important; }
        .o-bar { transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); transform-origin: left; }
        .o-bar:hover { transform: scaleX(1.02); }
        .o-bar .o-tip { opacity: 0; transition: all 0.3s ease; pointer-events: none; }
        .o-bar:hover .o-tip { opacity: 1; }
        .o-prog { transition: width 1.2s cubic-bezier(0.23, 1, 0.32, 1); }
        .o-row { transition: background 0.2s ease; }
        .o-row:hover { background: rgba(0, 0, 0, 0.015) !important; }
        .o-thread { transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1); }
        .o-thread:hover { background: rgba(0, 0, 0, 0.02) !important; }
        ::selection { background: #E3FF73; color: #0f172a; }
        @keyframes o-spin { 100% { transform: rotate(360deg); } }
        .safari-clip-fix { -webkit-mask-image: -webkit-radial-gradient(white, black); mask-image: radial-gradient(white, black); transform: translateZ(0); backface-visibility: hidden; }
      `}</style>

      {/* Noise texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          pointerEvents: "none",
          opacity: 0.035,
          mixBlendMode: "multiply",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient blobs */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-8%",
          width: "45vw",
          height: "45vw",
          background: "#fdba74",
          borderRadius: "50%",
          mixBlendMode: "multiply",
          filter: "blur(100px)",
          opacity: 0.35,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "-8%",
          width: "50vw",
          height: "50vw",
          background: "#a5b4fc",
          borderRadius: "50%",
          mixBlendMode: "multiply",
          filter: "blur(120px)",
          opacity: 0.4,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}
      >
        {/* HEADER */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            paddingBottom: "24px",
            ...e(0),
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "44px",
                fontFamily: serif,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Vue d&apos;ensemble{" "}
              <span
                style={{
                  fontStyle: "italic",
                  color: "#94a3b8",
                  fontWeight: 300,
                }}
              >
                globale
              </span>
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginTop: "8px",
                fontWeight: 500,
              }}
            >
              {stats.totalSessions} sessions &middot;{" "}
              {stats.totalMessages.toLocaleString()} messages
            </p>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(12px)",
              borderRadius: "20px",
              border: "1px solid rgba(255,255,255,0.8)",
              fontSize: "13px",
              fontWeight: 600,
              color: "#64748b",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px #34d399",
              }}
            />
            {new Date(data.generatedAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </header>

        {/* KPI ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "24px",
          }}
        >
          {/* Sessions KPI */}
          <div
            className="o-card"
            style={{
              ...glass,
              padding: "32px 36px",
              position: "relative",
              ...e(100),
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                width: "120px",
                height: "120px",
                background: "rgba(251,146,60,0.12)",
                filter: "blur(40px)",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ ...lbl, marginBottom: "20px" }}>Sessions</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <span
                  style={{
                    fontSize: "56px",
                    fontFamily: serif,
                    fontWeight: 400,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                >
                  {stats.totalSessions}
                </span>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: mono,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                    }}
                  >
                    Msg / session
                  </div>
                  <div
                    style={{
                      fontSize: "28px",
                      fontFamily: serif,
                      color: "#334155",
                      letterSpacing: "-0.02em",
                      marginTop: "4px",
                    }}
                  >
                    {stats.avgMessages}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sentiment KPI -- spinning border + circular gauge */}
          <div
            className="safari-clip-fix"
            style={{
              position: "relative",
              borderRadius: "32px",
              padding: "1px",
              overflow: "hidden",
              ...e(200),
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "-100%",
                background: `conic-gradient(from 0deg, transparent 0 340deg, ${sentimentColor} 360deg)`,
                animation: "o-spin 4s linear infinite",
                opacity: 0.6,
              }}
            />
            <div
              className="o-card"
              style={{
                position: "relative",
                height: "100%",
                background: "rgba(255,255,255,0.6)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: "31px",
                padding: "32px 36px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div style={lbl}>Sentiment</div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: sentimentColor,
                    background: `${sentimentColor}15`,
                    padding: "4px 12px",
                    borderRadius: "20px",
                    border: `1px solid ${sentimentColor}30`,
                  }}
                >
                  {sentimentLabel}
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "128px",
                    height: "128px",
                  }}
                >
                  <svg
                    width="128"
                    height="128"
                    style={{ transform: "rotate(-90deg)" }}
                  >
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="rgba(0,0,0,0.04)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke={sentimentColor}
                      strokeWidth="10"
                      strokeDasharray="351.8"
                      strokeDashoffset={
                        isLoaded ? sentimentDashoffset : 351.8
                      }
                      strokeLinecap="round"
                      style={{
                        transition:
                          "stroke-dashoffset 2s cubic-bezier(0.23, 1, 0.32, 1)",
                        filter: `drop-shadow(0 0 8px ${sentimentColor}50)`,
                      }}
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "32px",
                        fontFamily: serif,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {stats.avgSentiment}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontFamily: mono,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        marginTop: "2px",
                      }}
                    >
                      sur 5
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security KPI */}
          <div
            className="o-card"
            style={{
              ...glass,
              padding: "32px 36px",
              position: "relative",
              ...e(300),
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                width: "120px",
                height: "120px",
                background: "rgba(16,185,129,0.1)",
                filter: "blur(40px)",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ ...lbl, marginBottom: "20px" }}>
                Securite
              </div>
              <span
                style={{
                  fontSize: "56px",
                  fontFamily: serif,
                  fontWeight: 400,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {stats.secTotal}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginTop: "20px",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { l: "Blocks", v: data.security.blocks, c: "#ef4444" },
                  { l: "Alertes", v: data.security.alerts, c: "#f59e0b" },
                  { l: "Confirms", v: data.security.confirms, c: "#10b981" },
                ].map((x) => (
                  <div
                    key={x.l}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: x.c,
                      }}
                    />
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      {x.v}{" "}
                      <span style={{ color: "#94a3b8" }}>{x.l}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SESSIONS TABLE */}
        <div
          className="o-card"
          style={{
            ...glass,
            padding: "36px 40px",
            position: "relative",
            ...e(400),
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-30px",
              left: "20%",
              width: "60%",
              height: "80px",
              background: "rgba(99,102,241,0.06)",
              filter: "blur(50px)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "28px",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                Sessions Recentes
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#94a3b8",
                  marginTop: "4px",
                }}
              >
                12 dernieres sessions enregistrees
              </p>
            </div>
            <div
              style={{
                fontSize: "28px",
                fontFamily: serif,
                color: "#0f172a",
                letterSpacing: "-0.03em",
              }}
            >
              {stats.recentSessions.length}
            </div>
          </div>

          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "3fr 1.5fr 1.2fr 0.8fr",
              gap: "16px",
              padding: "0 0 12px 0",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              position: "relative",
              zIndex: 1,
            }}
          >
            <span style={lbl}>Session</span>
            <span style={lbl}>Date</span>
            <span style={lbl}>Sentiment</span>
            <span style={{ ...lbl, textAlign: "right" }}>Messages</span>
          </div>

          {/* Table rows */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {stats.recentSessions.map((session, i) => {
              const dot = sentimentDot(session.sentiment);
              return (
                <div
                  key={session.sid || `${session.date}-${i}`}
                  className="o-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 1.5fr 1.2fr 0.8fr",
                    gap: "16px",
                    padding: "14px 0",
                    borderBottom:
                      i < stats.recentSessions.length - 1
                        ? "1px solid rgba(0,0,0,0.04)"
                        : "none",
                    alignItems: "center",
                    borderRadius: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#334155",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {session.name || session.filename}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      fontFamily: mono,
                    }}
                  >
                    {formatDate(session.date)}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: dot.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      {session.sentiment > 0
                        ? `${session.sentiment.toFixed(1)} ${dot.label}`
                        : "\u2014"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontFamily: mono,
                      color: "#64748b",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {session.messageCount}
                  </span>
                </div>
              );
            })}
            {stats.recentSessions.length === 0 && (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: "14px",
                }}
              >
                Aucune session enregistree
              </div>
            )}
          </div>
        </div>

        {/* TWO-COLUMN GRID: Sentiment Chart + Thread Preview */}
        {/* SENTIMENT CHART — full width */}
        <div
          className="o-card"
          style={{
            ...glass,
            padding: "36px 40px",
            position: "relative",
            ...e(600),
          }}
        >
            <div
              style={{
                position: "absolute",
                top: "-20px",
                left: "30%",
                width: "40%",
                height: "80px",
                background: "rgba(99,102,241,0.08)",
                filter: "blur(50px)",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "28px",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#0f172a",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Evolution du Sentiment
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    marginTop: "4px",
                  }}
                >
                  Score par session (1 = positif, 5 = tendu)
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "28px",
                    fontFamily: serif,
                    color: "#0f172a",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {stats.avgSentiment}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    fontFamily: mono,
                    textTransform: "uppercase",
                  }}
                >
                  moyenne
                </div>
              </div>
            </div>
            <div style={{ height: "280px", position: "relative", zIndex: 1 }}>
              {stats.sentimentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats.sentimentChartData}
                    margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 10,
                        fill: "#94a3b8",
                        fontFamily: mono,
                      }}
                      axisLine={{ stroke: "rgba(0,0,0,0.06)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tick={{
                        fontSize: 10,
                        fill: "#94a3b8",
                        fontFamily: mono,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.85)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.8)",
                        borderRadius: "16px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                        fontFamily: sans,
                        padding: "12px 16px",
                      }}
                      labelStyle={{
                        color: "#64748b",
                        fontSize: "11px",
                        fontFamily: mono,
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                      itemStyle={{ color: "#334155" }}
                      formatter={(value: number) => [
                        `${value.toFixed(1)} / 5`,
                        "Score",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{
                        fill: "#6366f1",
                        stroke: "#fff",
                        strokeWidth: 2,
                        r: 4,
                      }}
                      activeDot={{
                        fill: "#6366f1",
                        stroke: "#fff",
                        strokeWidth: 2,
                        r: 6,
                      }}
                      isAnimationActive={true}
                      animationDuration={2000}
                      animationEasing="ease-in-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  Pas encore de donnees de sentiment
                </div>
              )}
            </div>
          </div>

        {/* THREAD PREVIEW — full width */}
          <div
            className="o-card"
            style={{
              ...glass,
              padding: "28px 32px",
              position: "relative",
              ...e(700),
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-20px",
                right: "-10px",
                width: "100px",
                height: "100px",
                background: "rgba(251,146,60,0.1)",
                filter: "blur(40px)",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                ...lbl,
                marginBottom: "24px",
                position: "relative",
                zIndex: 1,
              }}
            >
              Thread Recent
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                zIndex: 1,
              }}
            >
              {stats.recentThread.map((entry, i) => {
                const isExpanded = expandedThread === i;
                return (
                  <div
                    key={`${entry.sid}-${entry.ts}-${i}`}
                    className="o-thread"
                    onClick={() =>
                      setExpandedThread(isExpanded ? null : i)
                    }
                    style={{
                      padding: "14px 0",
                      borderBottom:
                        i < stats.recentThread.length - 1
                          ? "1px solid rgba(0,0,0,0.04)"
                          : "none",
                      cursor: "pointer",
                    }}
                  >
                    {/* Header row: timestamp + session badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontFamily: mono,
                          color: "#94a3b8",
                        }}
                      >
                        {new Date(entry.ts).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          fontFamily: mono,
                          color: "#94a3b8",
                          background: "rgba(0,0,0,0.03)",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          border: "1px solid rgba(0,0,0,0.04)",
                        }}
                      >
                        {entry.sid.slice(0, 8)}
                      </span>
                    </div>
                    {/* User message */}
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#334155",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: isExpanded ? 999 : 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "#6366f1",
                          fontSize: "11px",
                          fontFamily: mono,
                          marginRight: "6px",
                        }}
                      >
                        U:
                      </span>
                      {entry.u}
                    </div>
                    {/* Assistant response */}
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#94a3b8",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: isExpanded ? 999 : 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "#a5b4fc",
                          fontSize: "11px",
                          fontFamily: mono,
                          marginRight: "6px",
                        }}
                      >
                        A:
                      </span>
                      {entry.a}
                    </div>
                  </div>
                );
              })}
              {stats.recentThread.length === 0 && (
                <div
                  style={{
                    padding: "32px 0",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  Aucun echange enregistre
                </div>
              )}
            </div>
          </div>

        {/* TOOL USAGE BAR CHART */}
        <div
          className="o-card"
          style={{
            ...glass,
            padding: "36px 40px",
            position: "relative",
            ...e(800),
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: "-30px",
              right: "15%",
              width: "50%",
              height: "100px",
              background: "rgba(165,180,252,0.1)",
              filter: "blur(50px)",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "32px",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                Top 10 Outils
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#94a3b8",
                  marginTop: "4px",
                }}
              >
                Utilisation cumulee par outil
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "32px",
                  fontFamily: serif,
                  color: "#0f172a",
                  letterSpacing: "-0.03em",
                }}
              >
                {Object.values(data.toolUsage)
                  .reduce((a, b) => a + b, 0)
                  .toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  fontFamily: mono,
                  textTransform: "uppercase",
                }}
              >
                appels total
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              position: "relative",
              zIndex: 1,
            }}
          >
            {stats.toolEntries.map(([tool, count], i) => (
              <div
                key={tool}
                className="o-bar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: "120px",
                    fontSize: "13px",
                    color: "#334155",
                    fontFamily: mono,
                    fontWeight: 500,
                  }}
                >
                  {tool}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "10px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,0.04)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    className="o-prog"
                    style={{
                      height: "100%",
                      borderRadius: "10px",
                      background:
                        i === 0
                          ? "linear-gradient(to right, #6366f1, #a5b4fc)"
                          : "linear-gradient(to right, #a5b4fc, #c7d2fe)",
                      width: isLoaded
                        ? `${(count / stats.toolMax) * 100}%`
                        : "0%",
                      boxShadow:
                        i === 0
                          ? "0 2px 8px rgba(99,102,241,0.2)"
                          : "none",
                    }}
                  />
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    width: "60px",
                    textAlign: "right",
                    fontSize: "12px",
                    color: "#94a3b8",
                    fontFamily: mono,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: i === 0 ? 700 : 400,
                  }}
                >
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
            {stats.toolEntries.length === 0 && (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: "14px",
                }}
              >
                Aucune donnee d'utilisation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
