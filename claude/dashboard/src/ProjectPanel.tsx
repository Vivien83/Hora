import type { ProjectContext, FailureEntry } from "./types";

const C = {
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
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
        color: C.dim,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        marginBottom: "8px",
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
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
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
          <div style={{ color: C.dim, fontSize: "13px" }}>
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
          <div style={{ fontSize: "11px", color: C.accent, fontWeight: 600, marginBottom: "6px" }}>
            CHECKPOINT
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.muted,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              maxHeight: "140px",
              overflow: "hidden",
            }}
          >
            {truncateMarkdown(project.checkpoint, 12)}
          </div>
        </Card>
      )}

      {/* Knowledge summary */}
      {project.knowledge && (
        <Card>
          <div style={{ fontSize: "11px", color: C.accent, fontWeight: 600, marginBottom: "6px" }}>
            KNOWLEDGE
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.muted,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              maxHeight: "120px",
              overflow: "hidden",
            }}
          >
            {truncateMarkdown(project.knowledge, 10)}
          </div>
        </Card>
      )}

      {/* Snapshots */}
      {project.snapshots.length > 0 && (
        <Card>
          <div style={{ fontSize: "11px", color: C.accent, fontWeight: 600, marginBottom: "6px" }}>
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
                    color: C.muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "180px",
                  }}
                >
                  {snap.path.split("/").pop()}
                </span>
                <span style={{ color: C.dim, flexShrink: 0 }}>{formatBytes(snap.size)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Backup state */}
      {project.backupState && (
        <Card>
          <div style={{ fontSize: "11px", color: C.accent, fontWeight: 600, marginBottom: "6px" }}>
            BACKUP
          </div>
          <div style={{ fontSize: "12px", color: C.muted }}>
            Strategie : {project.backupState.strategy}
          </div>
          {project.backupState.lastBackup && (
            <div style={{ fontSize: "11px", color: C.dim, marginTop: "2px" }}>
              Dernier : {formatTs(project.backupState.lastBackup)}
            </div>
          )}
          <div style={{ fontSize: "11px", color: C.dim, marginTop: "2px" }}>
            {project.backupState.commitCount} commits
          </div>
        </Card>
      )}

      {/* Recent failures */}
      {failures.length > 0 && (
        <Card>
          <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600, marginBottom: "6px" }}>
            FAILURES ({failures.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {failures.slice(0, 3).map((f, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: "12px",
                    color: C.muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: "10px", color: C.dim }}>
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
