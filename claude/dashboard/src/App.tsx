import { useState, useEffect } from "react";
import type { DashboardData } from "./types";
import { StatCard } from "./StatCard";
import { SessionsTable } from "./SessionsTable";
import { SentimentChart } from "./SentimentChart";
import { ToolUsageChart } from "./ToolUsageChart";

const COLORS = {
  bg: "#0A0A0B",
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
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
          color: COLORS.muted,
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

function ProfileCard({ profile }: { profile: DashboardData["profile"] }) {
  const sections = [
    { label: "Identite", content: profile.identity },
    { label: "Projets", content: profile.projects },
    { label: "Preferences", content: profile.preferences },
  ].filter((s) => s.content && s.content.trim() && !s.content.includes("<!-- vide"));

  if (sections.length === 0) {
    return (
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: "8px",
          padding: "20px 24px",
          color: COLORS.dim,
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
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "12px",
      }}
    >
      {sections.map((s) => (
        <div
          key={s.label}
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "8px",
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: COLORS.dim,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: COLORS.muted,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              maxHeight: "120px",
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

function avgSentiment(data: DashboardData): string {
  if (data.sentimentHistory.length === 0) {
    const scores = data.sessions.map((s) => s.sentiment).filter((s) => s > 0);
    if (scores.length === 0) return "—";
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }
  const scores = data.sentimentHistory.map((e) => e.score);
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: COLORS.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "32px",
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 600, color: "#ef4444" }}>
          data.json introuvable
        </div>
        <div style={{ fontSize: "14px", color: COLORS.muted, textAlign: "center", maxWidth: "480px" }}>
          Lancez d'abord le script de collecte :
        </div>
        <code
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: "6px",
            padding: "10px 16px",
            fontSize: "13px",
            color: COLORS.accent,
            fontFamily: "monospace",
          }}
        >
          npx tsx scripts/collect-data.ts
        </code>
        <div style={{ fontSize: "12px", color: COLORS.dim }}>Erreur : {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.dim,
          fontSize: "14px",
        }}
      >
        Chargement...
      </div>
    );
  }

  const sentimentAvg = avgSentiment(data);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}>
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "0 32px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: COLORS.bg,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: COLORS.accent,
            }}
          />
          <span style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "-0.01em" }}>
            HORA Dashboard
          </span>
        </div>
        <span style={{ fontSize: "12px", color: COLORS.dim }}>
          Donnees du {formatDate(data.generatedAt)}
        </span>
      </header>

      {/* Main content */}
      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}
      >
        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
          }}
        >
          <StatCard
            label="Sessions"
            value={data.sessions.length}
            sub="archivees"
          />
          <StatCard
            label="Sentiment moyen"
            value={sentimentAvg}
            sub="1 = positif  /  5 = tendu"
            accent
          />
          <StatCard
            label="Snapshots"
            value={data.snapshotCount}
            sub="fichiers proteges"
          />
          <StatCard
            label="Backup"
            value={data.backupState?.lastBackup ? "Actif" : "Aucun"}
            sub={
              data.backupState?.lastBackup
                ? `Strategie : ${data.backupState.strategy}`
                : "Configurer via /hora-backup"
            }
          />
        </div>

        {/* Profil */}
        <Section title="Profil utilisateur">
          <ProfileCard profile={data.profile} />
        </Section>

        {/* Sessions recentes */}
        <Section title="Sessions recentes">
          <SessionsTable sessions={data.sessions} />
        </Section>

        {/* Sentiment */}
        <Section title="Evolution du sentiment">
          <SentimentChart data={data.sentimentHistory} />
        </Section>

        {/* Tool usage */}
        {Object.keys(data.toolUsage).length > 0 && (
          <Section title="Usage des outils (top 10)">
            <ToolUsageChart data={data.toolUsage} />
          </Section>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          padding: "16px 32px",
          textAlign: "center",
          fontSize: "12px",
          color: COLORS.dim,
        }}
      >
        Donnees collectees le {formatDate(data.generatedAt)}.
        Relancez{" "}
        <code style={{ color: COLORS.accent, fontFamily: "monospace" }}>
          npx tsx scripts/collect-data.ts
        </code>{" "}
        pour rafraichir.
      </footer>
    </div>
  );
}
