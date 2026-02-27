import { useState, useEffect } from "react";

const C = {
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  gold: "#D4A853",
};

interface DiffSummary {
  entitiesAdded: number;
  entitiesRemoved: number;
  factsAdded: number;
  factsSuperseded: number;
}

interface GraphDiffData {
  from: string;
  to: string;
  entities: { added: string[]; removed: string[] };
  facts: { added: string[]; removed: string[]; superseded: string[] };
  summary: DiffSummary;
  changeScore: number;
}

interface SnapshotData {
  ts: string;
  entityCount: number;
  factCount: number;
  activeFactCount: number;
  episodeCount: number;
}

interface MemoryDiffResponse {
  snapshots: SnapshotData[];
  diff: GraphDiffData | null;
  noPrevious: boolean;
  error?: string;
}

function scoreColor(score: number): string {
  if (score === 0) return C.dim;
  if (score <= 10) return C.accent;
  if (score <= 30) return C.green;
  if (score <= 60) return C.amber;
  return C.red;
}

function scoreLabel(score: number): string {
  if (score === 0) return "Aucun changement";
  if (score <= 10) return "Mineur";
  if (score <= 30) return "Modere";
  if (score <= 60) return "Significatif";
  return "Majeur";
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts.slice(0, 16);
  }
}

function DeltaStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        padding: "12px 16px",
        background: "#0f0f10",
        borderRadius: "6px",
        minWidth: "80px",
      }}
    >
      <span style={{ fontSize: "24px", fontWeight: 700, color, lineHeight: 1.1 }}>
        {value > 0 ? `+${value}` : value}
      </span>
      <span style={{ fontSize: "11px", color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
    </div>
  );
}

function IdList({ ids, color, label }: { ids: string[]; color: string; label: string }) {
  if (ids.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label} ({ids.length})
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {ids.slice(0, 12).map((id) => (
          <span
            key={id}
            style={{
              fontSize: "11px",
              fontFamily: "monospace",
              color,
              background: `${color}12`,
              padding: "2px 6px",
              borderRadius: "3px",
              border: `1px solid ${color}22`,
            }}
          >
            {id}
          </span>
        ))}
        {ids.length > 12 && (
          <span style={{ fontSize: "11px", color: C.dim }}>+{ids.length - 12} autres</span>
        )}
      </div>
    </div>
  );
}

export function MemoryDiff() {
  const [data, setData] = useState<MemoryDiffResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hora/memory-diff")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "24px",
          color: C.dim,
          fontSize: "13px",
        }}
      >
        Chargement du diff memoire...
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "24px",
          color: C.dim,
          fontSize: "13px",
        }}
      >
        {data?.error ?? "Impossible de charger le diff memoire."}
      </div>
    );
  }

  if (data.noPrevious || !data.diff) {
    const snap = data.snapshots[0];
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>Memory Diff</span>
          <span style={{ fontSize: "11px", color: C.dim }}>1 snapshot</span>
        </div>
        {snap ? (
          <div style={{ fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>
            Snapshot du {formatTs(snap.ts)} : {snap.entityCount} entites, {snap.factCount} faits
            ({snap.activeFactCount} actifs), {snap.episodeCount} episodes.
            <br />
            <span style={{ color: C.dim }}>Un second snapshot sera cree a la prochaine session.</span>
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: C.dim }}>
            Aucun snapshot disponible. Le premier sera cree a la fin de la prochaine session.
          </div>
        )}
      </div>
    );
  }

  const { diff, snapshots } = data;
  const sc = diff.changeScore;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>Memory Diff</span>
        <span style={{ fontSize: "11px", color: C.dim }}>
          {formatTs(diff.from)} → {formatTs(diff.to)}
        </span>
      </div>

      {/* Change Score */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 14px",
          background: "#0f0f10",
          borderRadius: "6px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: `3px solid ${scoreColor(sc)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "18px", fontWeight: 700, color: scoreColor(sc) }}>{sc}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: C.text }}>
            Change Score : {scoreLabel(sc)}
          </span>
          <span style={{ fontSize: "11px", color: C.dim }}>
            {snapshots[0]?.entityCount ?? "?"} → {snapshots[1]?.entityCount ?? "?"} entites |{" "}
            {snapshots[0]?.activeFactCount ?? "?"} → {snapshots[1]?.activeFactCount ?? "?"} faits actifs
          </span>
        </div>
      </div>

      {/* Delta Stats */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <DeltaStat label="Entites" value={diff.summary.entitiesAdded} color={C.green} />
        {diff.summary.entitiesRemoved > 0 && (
          <DeltaStat label="Retirees" value={-diff.summary.entitiesRemoved} color={C.red} />
        )}
        <DeltaStat label="Faits" value={diff.summary.factsAdded} color={C.accent} />
        {diff.summary.factsSuperseded > 0 && (
          <DeltaStat label="Remplaces" value={diff.summary.factsSuperseded} color={C.amber} />
        )}
      </div>

      {/* ID Lists */}
      {(diff.entities.added.length > 0 || diff.entities.removed.length > 0 ||
        diff.facts.added.length > 0 || diff.facts.superseded.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <IdList ids={diff.entities.added} color={C.green} label="Entites ajoutees" />
          <IdList ids={diff.entities.removed} color={C.red} label="Entites retirees" />
          <IdList ids={diff.facts.added} color={C.accent} label="Faits ajoutes" />
          <IdList ids={diff.facts.superseded} color={C.amber} label="Faits remplaces" />
        </div>
      )}
    </div>
  );
}
