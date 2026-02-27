import type { ProfileData } from "./types";

const C = {
  bg: "#0A0A0B",
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
};

type NavSection = "overview" | "project" | "memory" | "neural" | "chat" | "security" | "tools" | "telemetry" | "replay";

interface ProfileSidebarProps {
  profile: ProfileData;
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  isLive: boolean;
  lastUpdate: Date | null;
  projectName?: string;
}

function extractName(identity: string): string {
  const match = identity.match(/(?:nom|name)[:\s]+(.+)/i);
  if (match) return match[1].trim().slice(0, 30);
  const lines = identity.split("\n").filter((l) => l.trim());
  return lines[0]?.replace(/^#+\s*/, "").slice(0, 30) ?? "Utilisateur";
}

function extractLang(preferences: string): string {
  const match = preferences.match(/(?:langue|language|lang)[:\s]+(\w+)/i);
  return match?.[1] ?? "fr";
}

const NAV_ITEMS: Array<{ key: NavSection; label: string }> = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "project", label: "Projet" },
  { key: "memory", label: "Memoire" },
  { key: "neural", label: "Neural" },
  { key: "chat", label: "Chat / Ask" },
  { key: "security", label: "Securite" },
  { key: "tools", label: "Outils" },
  { key: "telemetry", label: "Telemetrie" },
  { key: "replay", label: "Replay" },
];

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "a l'instant";
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}min`;
  return `il y a ${Math.floor(minutes / 60)}h`;
}

export function ProfileSidebar({
  profile,
  activeSection,
  onNavigate,
  isLive,
  lastUpdate,
  projectName,
}: ProfileSidebarProps) {
  const name = extractName(profile.identity);
  const lang = extractLang(profile.preferences);

  return (
    <aside
      style={{
        width: "220px",
        minHeight: "100vh",
        borderRight: `1px solid ${C.border}`,
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        padding: "20px 0",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "0 20px 20px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: isLive ? "#22c55e" : C.accent,
              boxShadow: isLive ? "0 0 6px #22c55e" : "none",
              transition: "all 150ms",
            }}
          />
          <span style={{ fontWeight: 700, fontSize: "15px", color: C.text, letterSpacing: "-0.01em" }}>
            HORA
          </span>
          <span style={{ fontSize: "11px", color: C.dim, fontWeight: 400 }}>Dashboard</span>
        </div>
        {lastUpdate && (
          <div style={{ fontSize: "11px", color: C.dim, marginTop: "6px", paddingLeft: "16px" }}>
            {isLive ? "Live" : "Poll"} · {timeAgo(lastUpdate)}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: activeSection === item.key ? 500 : 400,
              color: activeSection === item.key ? C.text : C.muted,
              background: activeSection === item.key ? C.card : "transparent",
              transition: "all 100ms",
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Profile */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{name}</div>
        <div style={{ fontSize: "11px", color: C.dim, marginTop: "2px" }}>
          {lang} / TypeScript
        </div>
        {projectName && (
          <div style={{ fontSize: "11px", color: C.accent, marginTop: "4px" }}>
            {projectName}
          </div>
        )}
      </div>
    </aside>
  );
}

export type { NavSection };
