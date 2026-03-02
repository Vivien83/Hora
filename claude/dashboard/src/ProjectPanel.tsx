import type { ProjectContext, FailureEntry } from "./types";

const C = {
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  gold: "#D4A853",
  border: "rgba(0,0,0,0.06)",
};

const glass = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
};

interface ProjectPanelProps {
  project: ProjectContext | null;
  failures: FailureEntry[];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: C.textTertiary,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        marginBottom: "8px",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...glass,
        padding: "14px 16px",
      }}
    >
      {children}
    </div>
  );
}

function truncateMarkdown(md: string, maxLines: number): string {
  if (!md.trim()) return "";
  const lines = md.split("\n").slice(0, maxLines);
  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.slice(0, 16);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectPanel({ project, failures }: ProjectPanelProps) {
  if (!project) {
    return (
      <aside
        style={{
          width: "320px",
          flexShrink: 0,
          borderLeft: `1px solid ${C.border}`,
          padding: "20px 16px",
        }}
      >
        <SectionTitle>Projet en cours</SectionTitle>
        <Card>
          <div style={{ color: C.textMuted, fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>
            Aucun contexte projet detecte. Verifiez que .hora/ existe a la racine.
          </div>
        </Card>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: "320px",
        flexShrink: 0,
        borderLeft: `1px solid ${C.border}`,
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        overflowY: "auto",
        maxHeight: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <SectionTitle>Projet en cours</SectionTitle>

      {/* Checkpoint */}
      {project.checkpoint && (
        <Card>
          <div
            style={{
              fontSize: "11px",
              color: C.gold,
              fontWeight: 600,
              marginBottom: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            CHECKPOINT
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.textMuted,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              maxHeight: "140px",
              overflow: "hidden",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {truncateMarkdown(project.checkpoint, 12)}
          </div>
        </Card>
      )}

      {/* Knowledge summary */}
      {project.knowledge && (
        <Card>
          <div
            style={{
              fontSize: "11px",
              color: C.gold,
              fontWeight: 600,
              marginBottom: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            KNOWLEDGE
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.textMuted,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              maxHeight: "120px",
              overflow: "hidden",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {truncateMarkdown(project.knowledge, 10)}
          </div>
        </Card>
      )}

      {/* Snapshots */}
      {project.snapshots.length > 0 && (
        <Card>
          <div
            style={{
              fontSize: "11px",
              color: C.gold,
              fontWeight: 600,
              marginBottom: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            SNAPSHOTS ({project.snapshots.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {project.snapshots.slice(0, 5).map((snap, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                }}
              >
                <span
                  style={{
                    color: C.textSecondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "180px",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {snap.path.split("/").pop()}
                </span>
                <span style={{ color: C.textMuted, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatBytes(snap.size)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Backup state */}
      {project.backupState && (
        <Card>
          <div
            style={{
              fontSize: "11px",
              color: C.gold,
              fontWeight: 600,
              marginBottom: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            BACKUP
          </div>
          <div style={{ fontSize: "12px", color: C.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
            Strategie : {project.backupState.strategy}
          </div>
          {project.backupState.lastBackup && (
            <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "2px", fontFamily: "'DM Sans', sans-serif" }}>
              Dernier : {formatTs(project.backupState.lastBackup)}
            </div>
          )}
          <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "2px", fontFamily: "'DM Sans', sans-serif" }}>
            {project.backupState.commitCount} commits
          </div>
        </Card>
      )}

      {/* Recent failures */}
      {failures.length > 0 && (
        <Card>
          <div
            style={{
              fontSize: "11px",
              color: "#ef4444",
              fontWeight: 600,
              marginBottom: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            FAILURES ({failures.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {failures.slice(0, 3).map((f, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: "12px",
                    color: C.textSecondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: C.textMuted,
                    fontFamily: "'JetBrains Mono', monospace",
                    marginTop: "2px",
                  }}
                >
                  {f.type.toUpperCase()} · {f.session.slice(0, 8) || "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </aside>
  );
}
