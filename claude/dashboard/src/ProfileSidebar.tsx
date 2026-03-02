import { useState, useEffect } from "react";
import type { ProfileData } from "./types";

/* ── Color constants ── */
const C = {
  bg: "#0B0B0E",
  surface: "#111116",
  surfaceHover: "#16161C",
  surfaceActive: "#1A1A22",
  border: "rgba(255, 255, 255, 0.06)",
  borderSubtle: "rgba(255, 255, 255, 0.03)",
  gold: "#D4A853",
  goldDim: "rgba(212, 168, 83, 0.15)",
  goldGlow: "rgba(212, 168, 83, 0.08)",
  text: "#E8E8EC",
  textSecondary: "#9B9BA7",
  textTertiary: "#5C5C6B",
  live: "#34D399",
  liveGlow: "rgba(52, 211, 153, 0.4)",
};

const sans = "'DM Sans', sans-serif";
const mono = "'JetBrains Mono', monospace";

type NavSection = "overview" | "project" | "memory" | "neural" | "chat" | "security" | "tools" | "telemetry" | "replay" | "insights";

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

const NAV_ITEMS: Array<{ key: NavSection; label: string; icon: string }> = [
  { key: "overview", label: "Vue d'ensemble", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "project", label: "Projet", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { key: "memory", label: "Memoire", icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" },
  { key: "neural", label: "Neural", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { key: "chat", label: "Chat / Ask", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "security", label: "Securite", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { key: "tools", label: "Outils", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "telemetry", label: "Telemetrie", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "replay", label: "Replay", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "insights", label: "Insights", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
];

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "a l'instant";
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}min`;
  return `il y a ${Math.floor(minutes / 60)}h`;
}

function NavIcon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
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
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const [mounted, setMounted] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<NavSection | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <aside
      style={{
        width: "232px",
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "relative",
        fontFamily: sans,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateX(0)" : "translateX(-8px)",
        transition: "opacity 0.6s cubic-bezier(0.23, 1, 0.32, 1), transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
      }}
    >
      <style>{`
        .hora-nav-btn { transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1); position: relative; }
        .hora-nav-btn:hover { background: ${C.surfaceHover} !important; }
        .hora-nav-btn:active { transform: scale(0.98); }
        .hora-avatar:hover { border-color: ${C.gold} !important; box-shadow: 0 0 12px ${C.goldGlow} !important; }
        .hora-pulse { animation: hora-live-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes hora-live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px ${C.liveGlow}; }
          50% { opacity: 0.5; box-shadow: 0 0 10px ${C.liveGlow}; }
        }
        @keyframes hora-sidebar-stagger {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Subtle glass depth gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 40%, rgba(255,255,255,0.008) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Right border with subtle gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "1px",
          background: `linear-gradient(180deg, transparent 0%, ${C.border} 15%, ${C.border} 85%, transparent 100%)`,
        }}
      />

      {/* ── Brand header ── */}
      <div
        style={{
          padding: "24px 20px 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Live indicator */}
          <div
            className={isLive ? "hora-pulse" : undefined}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: isLive ? C.live : C.textTertiary,
              boxShadow: isLive ? `0 0 6px ${C.liveGlow}` : "none",
              flexShrink: 0,
              transition: "all 0.3s ease",
            }}
          />
          {/* Brand name in gold */}
          <span
            style={{
              fontWeight: 700,
              fontSize: "15px",
              color: C.gold,
              letterSpacing: "0.08em",
              fontFamily: sans,
            }}
          >
            HORA
          </span>
          <span
            style={{
              fontSize: "11px",
              color: C.textTertiary,
              fontWeight: 400,
              fontFamily: mono,
              letterSpacing: "0.02em",
            }}
          >
            dashboard
          </span>
        </div>

        {/* Status line */}
        {lastUpdate && (
          <div
            style={{
              fontSize: "10px",
              color: C.textTertiary,
              fontFamily: mono,
              marginTop: "8px",
              paddingLeft: "17px",
              letterSpacing: "0.02em",
            }}
          >
            <span style={{ color: isLive ? C.live : C.textTertiary }}>
              {isLive ? "live" : "poll"}
            </span>
            <span style={{ margin: "0 6px", opacity: 0.4 }}>|</span>
            {timeAgo(lastUpdate)}
          </div>
        )}
      </div>

      {/* Separator */}
      <div
        style={{
          height: "1px",
          margin: "0 16px",
          background: `linear-gradient(90deg, transparent 0%, ${C.border} 20%, ${C.border} 80%, transparent 100%)`,
        }}
      />

      {/* ── Navigation ── */}
      <nav
        style={{
          padding: "12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "1px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {NAV_ITEMS.map((item, i) => {
          const isActive = activeSection === item.key;
          const isHovered = hoveredItem === item.key;

          return (
            <button
              key={item.key}
              className="hora-nav-btn"
              onClick={() => onNavigate(item.key)}
              onMouseEnter={() => setHoveredItem(item.key)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: isActive ? 500 : 400,
                fontFamily: sans,
                color: isActive ? C.text : isHovered ? C.text : C.textSecondary,
                background: isActive ? C.surfaceActive : "transparent",
                gap: "10px",
                position: "relative",
                animation: mounted ? `hora-sidebar-stagger 0.4s cubic-bezier(0.23, 1, 0.32, 1) ${80 + i * 30}ms both` : "none",
              }}
            >
              {/* Gold left accent bar for active item */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    left: "0px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "2px",
                    height: "16px",
                    borderRadius: "0 2px 2px 0",
                    background: C.gold,
                    boxShadow: `0 0 8px ${C.goldGlow}`,
                  }}
                />
              )}

              <NavIcon d={item.icon} size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Separator */}
      <div
        style={{
          height: "1px",
          margin: "0 16px",
          background: `linear-gradient(90deg, transparent 0%, ${C.border} 20%, ${C.border} 80%, transparent 100%)`,
        }}
      />

      {/* ── Profile section ── */}
      <div
        style={{
          padding: "16px 16px 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {/* Avatar circle with initials */}
          <div
            className="hora-avatar"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.goldDim}, rgba(212, 168, 83, 0.06))`,
              border: `1px solid rgba(212, 168, 83, 0.25)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              cursor: "default",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: C.gold,
                letterSpacing: "0.04em",
                fontFamily: sans,
              }}
            >
              {initials}
            </span>
          </div>

          {/* Name and metadata */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: C.text,
                fontFamily: sans,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: C.textTertiary,
                fontFamily: mono,
                marginTop: "2px",
                letterSpacing: "0.02em",
              }}
            >
              {lang.toUpperCase()}
              <span style={{ margin: "0 5px", opacity: 0.3 }}>/</span>
              TypeScript
            </div>
          </div>
        </div>

        {/* Project name */}
        {projectName && (
          <div
            style={{
              marginTop: "10px",
              marginLeft: "46px",
              fontSize: "10px",
              fontFamily: mono,
              color: C.gold,
              letterSpacing: "0.02em",
              opacity: 0.8,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {projectName}
          </div>
        )}
      </div>
    </aside>
  );
}

export type { NavSection };
