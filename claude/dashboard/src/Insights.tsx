import { useState, useEffect, useMemo } from "react";
import type { DashboardData } from "./types";

interface Props {
  data: DashboardData;
}

export function Insights({ data }: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setIsLoaded(true), 150);
    const t2 = setTimeout(() => setEntranceDone(true), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const stats = useMemo(() => {
    const sessions = data.sessions;
    const totalMessages = sessions.reduce((a, s) => a + s.messageCount, 0);
    const avgMessages = sessions.length ? Math.round(totalMessages / sessions.length) : 0;
    const sentimentScores = data.sentimentHistory.length > 0
      ? data.sentimentHistory.map((e) => e.score)
      : sessions.map((s) => s.sentiment).filter((s) => s > 0);
    const avgSentiment = sentimentScores.length
      ? (sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length).toFixed(1)
      : "—";
    const toolEntries = Object.entries(data.toolUsage).sort(([, a], [, b]) => b - a).slice(0, 8);
    const toolMax = toolEntries[0]?.[1] ?? 1;
    const sentimentBuckets = [0, 0, 0, 0, 0];
    for (const s of sentimentScores) {
      const idx = Math.min(Math.max(Math.round(s) - 1, 0), 4);
      sentimentBuckets[idx]++;
    }
    const bucketMax = Math.max(...sentimentBuckets, 1);
    const projects = new Map<string, number>();
    for (const s of sessions) {
      const p = s.project || "sans-projet";
      projects.set(p, (projects.get(p) ?? 0) + 1);
    }
    const topProjects = [...projects.entries()].sort(([, a], [, b]) => b - a).slice(0, 5);
    const recentDays = data.toolTimeline.slice(-14);
    const dayMax = Math.max(...recentDays.map((d) => d.total), 1);
    const secTotal = data.security.alerts + data.security.blocks + data.security.confirms;
    return { totalSessions: sessions.length, totalMessages, avgMessages, avgSentiment, toolEntries, toolMax, sentimentBuckets, bucketMax, topProjects, recentDays, dayMax, secTotal };
  }, [data]);

  const sentimentNum = Number(stats.avgSentiment) || 0;
  const sentimentPct = stats.avgSentiment !== "—" ? sentimentNum / 5 : 0;
  const sentimentDashoffset = 351.8 * (1 - sentimentPct);
  const sentimentColor = sentimentNum <= 1.5 ? "#10b981" : sentimentNum <= 3 ? "#f59e0b" : "#ef4444";
  const sentimentLabel = sentimentNum <= 1.5 ? "Positif" : sentimentNum <= 3 ? "Neutre" : "Tendu";

  const e = (delayMs: number): React.CSSProperties =>
    entranceDone ? {} : {
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
  const lbl: React.CSSProperties = { fontSize: "11px", fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" };
  const barColors = ["#10b981", "#84cc16", "#eab308", "#f97316", "#ef4444"];

  return (
    <div style={{ margin: "-24px -32px", padding: "48px 56px 80px", minHeight: "100vh", background: "#F2F0E9", position: "relative", overflowX: "hidden", color: "#0f172a", fontFamily: sans }}>
      <style>{`
        .i-card { transition: all 0.7s cubic-bezier(0.23, 1, 0.32, 1); cursor: default; }
        .i-card:hover { transform: translateY(-8px) !important; box-shadow: 0 25px 50px rgba(0,0,0,0.08) !important; }
        .i-bar { transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); transform-origin: bottom; }
        .i-bar:hover { transform: scaleY(1.08); }
        .i-bar .i-tip { opacity: 0; transition: all 0.3s ease; pointer-events: none; }
        .i-bar:hover .i-tip { opacity: 1; transform: translateY(-4px); }
        .i-prog { transition: width 1.2s cubic-bezier(0.23, 1, 0.32, 1); }
        ::selection { background: #E3FF73; color: #0f172a; }
        @keyframes i-spin { 100% { transform: rotate(360deg); } }
        .safari-clip-fix { -webkit-mask-image: -webkit-radial-gradient(white, black); mask-image: radial-gradient(white, black); transform: translateZ(0); backface-visibility: hidden; }
      `}</style>

      {/* Noise texture */}
      <div style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none", opacity: 0.035, mixBlendMode: "multiply", backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* Ambient blobs */}
      <div style={{ position: "absolute", top: "-10%", left: "-8%", width: "45vw", height: "45vw", background: "#fdba74", borderRadius: "50%", mixBlendMode: "multiply", filter: "blur(100px)", opacity: 0.35, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-8%", width: "50vw", height: "50vw", background: "#a5b4fc", borderRadius: "50%", mixBlendMode: "multiply", filter: "blur(120px)", opacity: 0.4, pointerEvents: "none" }} />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", gap: "40px" }}>

        {/* ── HEADER ── */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: "24px", ...e(0) }}>
          <div>
            <h1 style={{ fontSize: "44px", fontFamily: serif, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Insights <span style={{ fontStyle: "italic", color: "#94a3b8", fontWeight: 300 }}>récentes</span>
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", marginTop: "8px", fontWeight: 500 }}>
              {stats.totalSessions} sessions · {stats.totalMessages.toLocaleString()} messages
            </p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.8)", fontSize: "13px", fontWeight: 600, color: "#64748b" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #34d399" }} />
            {new Date(data.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </header>

        {/* ── KPI ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>

          {/* Sessions */}
          <div className="i-card" style={{ ...glass, padding: "32px 36px", position: "relative", ...e(100) }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "120px", height: "120px", background: "rgba(251,146,60,0.12)", filter: "blur(40px)", borderRadius: "50%", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ ...lbl, marginBottom: "20px" }}>Sessions</div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px" }}>
                <span style={{ fontSize: "56px", fontFamily: serif, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.totalSessions}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", fontFamily: mono, color: "#94a3b8", textTransform: "uppercase" }}>Msg / session</div>
                  <div style={{ fontSize: "28px", fontFamily: serif, color: "#334155", letterSpacing: "-0.02em", marginTop: "4px" }}>{stats.avgMessages}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sentiment — spinning border + circular gauge */}
          <div className="safari-clip-fix" style={{ position: "relative", borderRadius: "32px", padding: "1px", overflow: "hidden", ...e(200) }}>
            <div style={{ position: "absolute", inset: "-100%", background: `conic-gradient(from 0deg, transparent 0 340deg, ${sentimentColor} 360deg)`, animation: "i-spin 4s linear infinite", opacity: 0.6 }} />
            <div className="i-card" style={{ position: "relative", height: "100%", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: "31px", padding: "32px 36px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={lbl}>Sentiment</div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: sentimentColor, background: `${sentimentColor}15`, padding: "4px 12px", borderRadius: "20px", border: `1px solid ${sentimentColor}30` }}>{sentimentLabel}</span>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "relative", width: "128px", height: "128px" }}>
                  <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="10" />
                    <circle cx="64" cy="64" r="56" fill="none" stroke={sentimentColor} strokeWidth="10" strokeDasharray="351.8" strokeDashoffset={isLoaded ? sentimentDashoffset : 351.8} strokeLinecap="round" style={{ transition: "stroke-dashoffset 2s cubic-bezier(0.23, 1, 0.32, 1)", filter: `drop-shadow(0 0 8px ${sentimentColor}50)` }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "32px", fontFamily: serif, letterSpacing: "-0.03em" }}>{stats.avgSentiment}</span>
                    <span style={{ fontSize: "10px", fontFamily: mono, color: "#94a3b8", textTransform: "uppercase", marginTop: "2px" }}>sur 5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="i-card" style={{ ...glass, padding: "32px 36px", position: "relative", ...e(300) }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "120px", height: "120px", background: "rgba(16,185,129,0.1)", filter: "blur(40px)", borderRadius: "50%", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ ...lbl, marginBottom: "20px" }}>Sécurité</div>
              <span style={{ fontSize: "56px", fontFamily: serif, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.secTotal}</span>
              <div style={{ display: "flex", gap: "16px", marginTop: "20px", flexWrap: "wrap" }}>
                {[
                  { l: "Blocks", v: data.security.blocks, c: "#ef4444" },
                  { l: "Alertes", v: data.security.alerts, c: "#f59e0b" },
                  { l: "Confirms", v: data.security.confirms, c: "#10b981" },
                ].map((x) => (
                  <div key={x.l} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: x.c }} />
                    <span style={{ fontSize: "12px", color: "#64748b" }}>{x.v} <span style={{ color: "#94a3b8" }}>{x.l}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ACTIVITY CHART (light glass) ── */}
        <div className="i-card" style={{ ...glass, padding: "36px 40px", position: "relative", ...e(500) }}>
          <div style={{ position: "absolute", top: "-30px", left: "30%", width: "40%", height: "100px", background: "rgba(99,102,241,0.08)", filter: "blur(50px)", borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", position: "relative", zIndex: 1 }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>Activité — 14 Derniers Jours</h3>
              <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>Appels d'outils par jour</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "32px", fontFamily: serif, color: "#0f172a", letterSpacing: "-0.03em" }}>{stats.recentDays.reduce((a, d) => a + d.total, 0).toLocaleString()}</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: mono, textTransform: "uppercase" }}>total 14j</div>
            </div>
          </div>
          <div style={{ height: "160px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8px", position: "relative", zIndex: 1 }}>
            {stats.recentDays.map((day, i) => {
              const h = Math.max((day.total / stats.dayMax) * 100, 4);
              const isMax = day.total === stats.dayMax && day.total > 0;
              return (
                <div key={day.date} className="i-bar" style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative" }}>
                  <div style={{
                    width: "100%", maxWidth: "32px", height: `${h}%`,
                    borderRadius: "8px 8px 3px 3px",
                    background: isMax ? "linear-gradient(to top, #6366f1, #a5b4fc)" : "rgba(0,0,0,0.06)",
                    boxShadow: isMax ? "0 4px 16px rgba(99,102,241,0.25)" : "none",
                    transition: `height 0.8s cubic-bezier(0.23, 1, 0.32, 1) ${i * 50}ms`,
                  }} />
                  <div className="i-tip" style={{ position: "absolute", top: "-36px", left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "white", fontSize: "11px", fontWeight: 700, padding: "5px 10px", borderRadius: "10px", whiteSpace: "nowrap" }}>
                    {day.total}
                  </div>
                </div>
              );
            })}
            {stats.recentDays.length === 0 && <div style={{ margin: "auto", color: "#94a3b8", fontSize: "14px" }}>Aucune donnée</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", padding: "0 4px" }}>
            {stats.recentDays.map((d) => (
              <span key={d.date} style={{ fontSize: "10px", fontFamily: mono, color: "#94a3b8", flex: 1, textAlign: "center" }}>{d.date.slice(8)}</span>
            ))}
          </div>
        </div>

        {/* ── BENTO GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "24px" }}>

          {/* Top Tools */}
          <div className="i-card" style={{ ...glass, gridColumn: "span 5", padding: "28px 32px", ...e(600) }}>
            <div style={{ ...lbl, marginBottom: "24px" }}>Top Outils</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {stats.toolEntries.map(([tool, count]) => (
                <div key={tool} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <span style={{ flexShrink: 0, width: "110px", fontSize: "13px", color: "#334155", fontFamily: mono }}>{tool}</span>
                  <div style={{ flex: 1, height: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.04)", overflow: "hidden" }}>
                    <div className="i-prog" style={{ height: "100%", borderRadius: "8px", background: "linear-gradient(to right, #a5b4fc, #c7d2fe)", width: isLoaded ? `${(count / stats.toolMax) * 100}%` : "0%" }} />
                  </div>
                  <span style={{ flexShrink: 0, width: "50px", textAlign: "right", fontSize: "12px", color: "#94a3b8", fontFamily: mono, fontVariantNumeric: "tabular-nums" }}>{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Distribution */}
          <div className="i-card" style={{ ...glass, gridColumn: "span 3", padding: "28px 32px", ...e(700) }}>
            <div style={{ ...lbl, marginBottom: "24px" }}>Distribution</div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "120px", gap: "10px" }}>
              {stats.sentimentBuckets.map((count, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                    <div style={{
                      width: "100%", borderRadius: "8px", background: barColors[i],
                      height: `${Math.max((count / stats.bucketMax) * 100, 8)}%`,
                      opacity: count > 0 ? 0.75 : 0.12,
                      transition: `height 0.8s cubic-bezier(0.23, 1, 0.32, 1) ${i * 100}ms`,
                    }} />
                  </div>
                  <span style={{ fontSize: "11px", fontFamily: mono, color: "#94a3b8" }}>{i + 1}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "#94a3b8" }}>
              {stats.sentimentBuckets.reduce((a, b) => a + b, 0)} mesures
            </div>
          </div>

          {/* Projects */}
          <div className="i-card" style={{ ...glass, gridColumn: "span 4", padding: "28px 32px", ...e(800) }}>
            <div style={{ ...lbl, marginBottom: "24px" }}>Projets</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {stats.topProjects.map(([name, count], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", gap: "16px", borderBottom: i < stats.topProjects.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                  <span style={{ fontSize: "14px", color: "#334155", minWidth: 0, wordBreak: "break-word" }}>{name}</span>
                  <span style={{ flexShrink: 0, fontSize: "12px", color: "#94a3b8", fontFamily: mono, fontVariantNumeric: "tabular-nums" }}>{count}</span>
                </div>
              ))}
              {stats.topProjects.length === 0 && <div style={{ padding: "14px 0", fontSize: "14px", color: "#94a3b8" }}>Aucun projet</div>}
            </div>
          </div>
        </div>

        {/* ── BOTTOM GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "24px" }}>

          {data.memoryHealth && (
            <div className="i-card" style={{ ...glass, gridColumn: data.graphData ? "span 6" : "span 12", padding: "28px 32px", ...e(900) }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <div style={lbl}>Mémoire</div>
                {data.memoryHealth.alerts.length > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "20px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", fontSize: "11px", fontWeight: 600, color: "#d97706" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />
                    {data.memoryHealth.alerts.length} alerte{data.memoryHealth.alerts.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                {(["t1", "t2", "t3"] as const).map((tier) => {
                  const t = data.memoryHealth![tier];
                  const labels = { t1: "Court terme", t2: "Moyen terme", t3: "Long terme" };
                  const colors = { t1: "#10b981", t2: "#6366f1", t3: "#f59e0b" };
                  return (
                    <div key={tier} style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.6)", borderRadius: "20px", padding: "20px 22px" }}>
                      <div style={{ fontSize: "10px", fontFamily: mono, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: "12px" }}>{labels[tier]}</div>
                      <div style={{ fontSize: "32px", fontFamily: serif, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1 }}>{t.items.toLocaleString()}</div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", fontFamily: mono, marginTop: "10px" }}>{t.sizeKb.toLocaleString()} KB</div>
                      <div style={{ height: "3px", borderRadius: "3px", background: "rgba(0,0,0,0.04)", marginTop: "12px", overflow: "hidden" }}>
                        <div className="i-prog" style={{ height: "100%", borderRadius: "3px", background: colors[tier], width: isLoaded ? `${Math.min((t.items / 200) * 100, 100)}%` : "0%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.graphData && (
            <div className="i-card" style={{ ...glass, gridColumn: data.memoryHealth ? "span 6" : "span 12", padding: "28px 32px", ...e(1000) }}>
              <div style={{ ...lbl, marginBottom: "24px" }}>Knowledge Graph</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 32px" }}>
                {[
                  ["Entités", data.graphData.stats.totalEntities],
                  ["Faits", data.graphData.stats.totalFacts],
                  ["Faits actifs", data.graphData.stats.activeFacts],
                  ["Contradictions", data.graphData.stats.contradictions],
                  ["Embedded", `${Math.round(data.graphData.stats.embeddedRatio * 100)}%`],
                  ["Hub principal", data.graphData.stats.topHub ?? "—"],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: "13px", fontFamily: mono, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
