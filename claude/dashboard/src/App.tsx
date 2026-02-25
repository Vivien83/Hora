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

const C = {
  bg: "#0A0A0B",
  border: "#27272a",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: C.muted,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
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
    if (scores.length === 0) return "—";
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
          background: "#18181b",
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px 24px",
          color: C.dim,
          fontSize: "14px",
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
            background: "#18181b",
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: C.dim,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.muted,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              maxHeight: "100px",
              overflow: "hidden",
            }}
          >
            {s.content.slice(0, 400)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const { data, error, isLive, lastUpdate } = useHoraData();
  const [section, setSection] = useState<NavSection>("overview");

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
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 600, color: "#ef4444" }}>
          Connexion echouee
        </div>
        <div style={{ fontSize: "14px", color: C.muted, textAlign: "center", maxWidth: "480px" }}>
          Lancez <code style={{ color: C.accent, fontFamily: "monospace" }}>npm run dev</code> dans
          le dossier dashboard.
        </div>
        <div style={{ fontSize: "12px", color: C.dim }}>Erreur : {error}</div>
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
          color: C.dim,
          fontSize: "14px",
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
        color: "#e4e4e7",
        display: "flex",
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
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          overflowY: "auto",
          maxHeight: "100vh",
        }}
      >
        {/* Stats row */}
        {(section === "overview" || section === "tools") && (
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

        {/* Overview section */}
        {section === "overview" && (
          <>
            <Section title="Sessions recentes">
              <SessionsTable sessions={data.sessions} />
            </Section>

            <Section title="Evolution du sentiment">
              <SentimentChart data={data.sentimentHistory} />
            </Section>

            <Section title="Thread recent">
              <ThreadHistory thread={data.thread} />
            </Section>
          </>
        )}

        {/* Project section */}
        {section === "project" && (
          <>
            <Section title="Checkpoint">
              {data.projectContext?.checkpoint ? (
                <div
                  style={{
                    background: "#18181b",
                    border: `1px solid ${C.border}`,
                    borderRadius: "8px",
                    padding: "16px 20px",
                    fontSize: "13px",
                    color: C.muted,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {data.projectContext.checkpoint}
                </div>
              ) : (
                <div
                  style={{
                    background: "#18181b",
                    border: `1px solid ${C.border}`,
                    borderRadius: "8px",
                    padding: "24px",
                    color: C.dim,
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
                    background: "#18181b",
                    border: `1px solid ${C.border}`,
                    borderRadius: "8px",
                    padding: "16px 20px",
                    fontSize: "13px",
                    color: C.muted,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    maxHeight: "500px",
                    overflow: "auto",
                  }}
                >
                  {data.projectContext.knowledge}
                </div>
              ) : (
                <div
                  style={{
                    background: "#18181b",
                    border: `1px solid ${C.border}`,
                    borderRadius: "8px",
                    padding: "24px",
                    color: C.dim,
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
                    background: "#18181b",
                    border: `1px solid ${C.border}`,
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  {data.failures.map((f, i) => (
                    <div
                      key={f.filename}
                      style={{
                        padding: "10px 16px",
                        borderBottom:
                          i < data.failures.length - 1 ? `1px solid ${C.border}` : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", color: "#e4e4e7" }}>{f.title}</div>
                        <div style={{ fontSize: "11px", color: C.dim, marginTop: "2px" }}>
                          {f.type.toUpperCase()} · session {f.session.slice(0, 8) || "—"}
                        </div>
                      </div>
                      <span style={{ fontSize: "11px", color: C.dim, flexShrink: 0 }}>
                        {f.date.slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: "#18181b",
                    border: `1px solid ${C.border}`,
                    borderRadius: "8px",
                    padding: "24px",
                    color: C.dim,
                    fontSize: "14px",
                  }}
                >
                  Aucune failure enregistree.
                </div>
              )}
            </Section>
          </>
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
      </main>

      {/* Right panel */}
      <ProjectPanel project={data.projectContext} failures={data.failures} />
    </div>
  );
}
