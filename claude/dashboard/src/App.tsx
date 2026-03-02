import { useState } from "react";
import type { DashboardData } from "./types";
import { useHoraData } from "./hooks/useHoraData";
import { StatCard } from "./StatCard";
import { SessionsTable } from "./SessionsTable";
import { SentimentChart } from "./SentimentChart";
import { ToolTimeline } from "./ToolTimeline";
import { ProfileSidebar, type NavSection } from "./ProfileSidebar";
import { ProjectPanel } from "./ProjectPanel";
import { ThreadHistory } from "./ThreadHistory";
import { SecurityEvents } from "./SecurityEvents";
import { MemoryHealth } from "./MemoryHealth";
import { NeuralPage } from "./NeuralPage";
import { ChatView } from "./ChatView";
import { MemoryChat } from "./MemoryChat";
import { HookTelemetry } from "./HookTelemetry";
import { MemoryDiff } from "./MemoryDiff";
import { SessionReplay } from "./SessionReplay";
import { Insights } from "./Insights";
import { Overview } from "./Overview";

const C = {
  bg: "#F2F0E9",
  glass: "rgba(255, 255, 255, 0.45)",
  glassBorder: "rgba(255, 255, 255, 0.7)",
  border: "rgba(0, 0, 0, 0.06)",
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  gold: "#D4A853",
  accent: "#6366f1",
};

const sans = "'DM Sans', sans-serif";
const mono = "'JetBrains Mono', monospace";
const serif = "'Playfair Display', Georgia, serif";

const glass: React.CSSProperties = {
  background: C.glass,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${C.glassBorder}`,
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: C.textTertiary,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: mono,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function avgSentiment(data: DashboardData): string {
  if (data.sentimentHistory.length === 0) {
    const scores = data.sessions.map((s) => s.sentiment).filter((s) => s > 0);
    if (scores.length === 0) return "\u2014";
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }
  const scores = data.sentimentHistory.map((e) => e.score);
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function ProfileCard({ profile }: { profile: DashboardData["profile"] }) {
  const sections = [
    { label: "Identite", content: profile.identity },
    { label: "Projets", content: profile.projects },
    { label: "Preferences", content: profile.preferences },
    { label: "Vocabulaire", content: profile.vocabulary },
  ].filter((s) => s.content && s.content.trim() && !s.content.includes("<!-- vide"));

  if (sections.length === 0) {
    return (
      <div
        style={{
          ...glass,
          padding: "24px 28px",
          color: C.textTertiary,
          fontSize: "14px",
          fontFamily: sans,
        }}
      >
        Profil non encore initialise. Commencez quelques sessions HORA.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "12px",
      }}
    >
      {sections.map((s) => (
        <div
          key={s.label}
          style={{
            ...glass,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: C.textTertiary,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "8px",
              fontFamily: mono,
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: C.textSecondary,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              maxHeight: "120px",
              overflow: "hidden",
              position: "relative",
              fontFamily: sans,
            }}
          >
            {s.content.slice(0, 400)}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "32px",
                background: "linear-gradient(transparent, rgba(255,255,255,0.7))",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const { data, error, isLive, lastUpdate } = useHoraData();
  const [section, setSection] = useState<NavSection>("overview");
  const [chatTab, setChatTab] = useState<"transcripts" | "ask">("ask");

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "32px",
          fontFamily: sans,
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: 700, color: "#ef4444", fontFamily: serif }}>
          Connexion echouee
        </div>
        <div style={{ fontSize: "14px", color: C.textMuted, textAlign: "center", maxWidth: "480px" }}>
          Lancez <code style={{ color: C.accent, fontFamily: mono }}>npm run dev</code> dans
          le dossier dashboard.
        </div>
        <div style={{ fontSize: "12px", color: C.textTertiary }}>Erreur : {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.textTertiary,
          fontSize: "14px",
          fontFamily: sans,
        }}
      >
        Chargement...
      </div>
    );
  }

  const sentimentAvg = avgSentiment(data);
  const securityTotal = data.security.alerts + data.security.blocks + data.security.confirms;
  const toolTotal = Object.values(data.toolUsage).reduce((a, b) => a + b, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        display: "flex",
        fontFamily: sans,
      }}
    >
      {/* Sidebar */}
      <ProfileSidebar
        profile={data.profile}
        activeSection={section}
        onNavigate={setSection}
        isLive={isLive}
        lastUpdate={lastUpdate}
        projectName={data.projectContext?.projectId}
      />

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "28px 36px",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          overflowY: "auto",
          maxHeight: "100vh",
        }}
      >
        {/* Stats row — tools section only (overview has its own) */}
        {section === "tools" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            <StatCard label="Sessions" value={data.sessions.length} sub="archivees" />
            <StatCard
              label="Sentiment"
              value={sentimentAvg}
              sub="1=positif / 5=tendu"
              accent
            />
            <StatCard label="Snapshots" value={data.snapshotCount} sub="fichiers proteges" />
            <StatCard
              label="Securite"
              value={securityTotal}
              sub={`${data.security.blocks}B ${data.security.confirms}C ${data.security.alerts}A`}
            />
            <StatCard
              label="Outils"
              value={toolTotal.toLocaleString()}
              sub={`${Object.keys(data.toolUsage).length} distincts`}
            />
            <StatCard
              label="Thread"
              value={data.thread.length}
              sub="echanges recents"
            />
          </div>
        )}

        {/* Overview */}
        {section === "overview" && (
          <Overview data={data} />
        )}

        {/* Project section */}
        {section === "project" && (
          <>
            <Section title="Checkpoint">
              {data.projectContext?.checkpoint ? (
                <div
                  style={{
                    ...glass,
                    padding: "20px 24px",
                    fontSize: "13px",
                    color: C.textSecondary,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    fontFamily: sans,
                  }}
                >
                  {data.projectContext.checkpoint}
                </div>
              ) : (
                <div
                  style={{
                    ...glass,
                    padding: "28px",
                    color: C.textTertiary,
                    fontSize: "14px",
                  }}
                >
                  Pas de checkpoint. Lancez une session HORA dans ce projet.
                </div>
              )}
            </Section>

            <Section title="Knowledge">
              {data.projectContext?.knowledge ? (
                <div
                  style={{
                    ...glass,
                    padding: "20px 24px",
                    fontSize: "13px",
                    color: C.textSecondary,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    maxHeight: "500px",
                    overflowY: "auto",
                    fontFamily: sans,
                  }}
                >
                  {data.projectContext.knowledge}
                </div>
              ) : (
                <div
                  style={{
                    ...glass,
                    padding: "28px",
                    color: C.textTertiary,
                    fontSize: "14px",
                  }}
                >
                  Pas de project-knowledge.md. Un audit sera propose au prochain demarrage.
                </div>
              )}
            </Section>
          </>
        )}

        {/* Memory section */}
        {section === "memory" && (
          <>
            {data.memoryHealth && (
              <Section title="Sante memoire">
                <MemoryHealth health={data.memoryHealth} />
              </Section>
            )}

            <Section title="Diff inter-sessions">
              <MemoryDiff />
            </Section>

            <Section title="Profil utilisateur">
              <ProfileCard profile={data.profile} />
            </Section>

            <Section title="Thread history">
              <ThreadHistory thread={data.thread} />
            </Section>

            <Section title="Failures recentes">
              {data.failures.length > 0 ? (
                <div
                  style={{
                    ...glass,
                    padding: 0,
                  }}
                >
                  {data.failures.map((f, i) => (
                    <div
                      key={`${f.session}-${f.date}-${i}`}
                      style={{
                        padding: "12px 20px",
                        borderBottom:
                          i < data.failures.length - 1 ? `1px solid ${C.border}` : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", color: C.text, fontWeight: 500 }}>{f.title}</div>
                        <div style={{ fontSize: "11px", color: C.textTertiary, marginTop: "2px", fontFamily: mono }}>
                          {f.type.toUpperCase()} · session {f.session.slice(0, 8) || "\u2014"}
                        </div>
                      </div>
                      <span style={{ fontSize: "11px", color: C.textTertiary, flexShrink: 0, fontFamily: mono }}>
                        {f.date.slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    ...glass,
                    padding: "28px",
                    color: C.textTertiary,
                    fontSize: "14px",
                  }}
                >
                  Aucune failure enregistree.
                </div>
              )}
            </Section>
          </>
        )}

        {/* Chat section */}
        {section === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)" }}>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: "0",
                borderBottom: `1px solid ${C.border}`,
                marginBottom: "0",
              }}
            >
              {(["ask", "transcripts"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setChatTab(tab)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: chatTab === tab ? `2px solid ${C.gold}` : "2px solid transparent",
                    color: chatTab === tab ? C.text : C.textMuted,
                    fontSize: "13px",
                    fontWeight: chatTab === tab ? 600 : 400,
                    padding: "10px 16px",
                    cursor: "pointer",
                    transition: "all 100ms",
                    fontFamily: sans,
                  }}
                >
                  {tab === "ask" ? "Ask HORA" : "Transcripts"}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {chatTab === "ask" ? (
                <MemoryChat graphStats={data.graphData?.stats} />
              ) : (
                <ChatView messages={data.transcripts} />
              )}
            </div>
          </div>
        )}

        {/* Security section */}
        {section === "security" && (
          <Section title="Evenements de securite">
            <SecurityEvents security={data.security} />
          </Section>
        )}

        {/* Tools section */}
        {section === "tools" && (
          <Section title="Usage des outils">
            <ToolTimeline timeline={data.toolTimeline} toolUsage={data.toolUsage} />
          </Section>
        )}

        {/* Telemetry section */}
        {section === "telemetry" && (
          <Section title="Telemetrie des hooks">
            <HookTelemetry />
          </Section>
        )}

        {/* Neural section */}
        {section === "neural" && (
          data.graphData ? (
            <NeuralPage graphData={data.graphData} />
          ) : (
            <Section title="Knowledge Graph">
              <div
                style={{
                  ...glass,
                  padding: "48px 24px",
                  textAlign: "center",
                  color: C.textTertiary,
                  fontSize: "14px",
                }}
              >
                Le knowledge graph est vide. Il sera enrichi automatiquement a chaque fin de session.
              </div>
            </Section>
          )
        )}

        {/* Replay section */}
        {section === "replay" && (
          <SessionReplay />
        )}

        {/* Insights section */}
        {section === "insights" && (
          <Insights data={data} />
        )}

      </main>

      {/* Right panel */}
      <ProjectPanel project={data.projectContext} failures={data.failures} />
    </div>
  );
}
