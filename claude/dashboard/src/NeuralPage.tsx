/**
 * HORA — Knowledge Graph Full Page
 *
 * Visualisation pleine page du knowledge graph bi-temporel.
 * Utilise react-force-graph-2d pour le rendu interactif.
 * Les entites sont colorees par type, les faits par confiance.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData, GraphNode, GraphEdge } from "./types";

// ─── Constants ──────────────────────────────────────────────────────────────

const C = {
  bg: "#0A0A0B",
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
};

const TYPE_COLORS: Record<string, string> = {
  project: "#14b8a6",
  tool: "#3b82f6",
  error_pattern: "#ef4444",
  preference: "#22c55e",
  concept: "#8b5cf6",
  person: "#f59e0b",
  file: "#71717a",
  library: "#f97316",
};

interface NeuralPageProps {
  graphData: GraphData;
}

interface ForceNode extends GraphNode {
  x?: number;
  y?: number;
  val: number;
}

interface ForceLink {
  source: string;
  target: string;
  color: string;
  confidence: number;
  isRecent: boolean;
  id: string;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function isRecent(dateStr: string, hoursAgo: number): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < hoursAgo * 60 * 60 * 1000;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Graph Data Transform ───────────────────────────────────────────────────

function buildForceData(
  graphData: GraphData,
  search: string,
  filterRecent: boolean,
  temporalCutoff: number,
): { nodes: ForceNode[]; links: ForceLink[] } {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const searchLower = search.toLowerCase();

  // Filter entities
  let entities = graphData.entities;
  if (filterRecent) {
    entities = entities.filter((e) => new Date(e.last_seen).getTime() > thirtyDaysAgo);
  }
  if (searchLower) {
    entities = entities.filter((e) => e.name.toLowerCase().includes(searchLower));
  }

  const entityIds = new Set(entities.map((e) => e.id));

  // Filter facts by temporal cutoff and validity
  const facts = graphData.facts.filter((f) => {
    if (!entityIds.has(f.source) || !entityIds.has(f.target)) return false;
    if (f.expired_at && new Date(f.expired_at).getTime() < now) return false;
    if (new Date(f.valid_at).getTime() > temporalCutoff) return false;
    return true;
  });

  // Compute degree for sizing
  const degree: Record<string, number> = {};
  for (const f of facts) {
    degree[f.source] = (degree[f.source] || 0) + 1;
    degree[f.target] = (degree[f.target] || 0) + 1;
  }

  const nodes: ForceNode[] = entities.map((e) => ({
    ...e,
    val: Math.max(5, Math.min(20, (degree[e.id] || 0) * 2 + 5)),
  }));

  const links: ForceLink[] = facts.map((f) => ({
    source: f.source,
    target: f.target,
    color: hexToRgba("#ffffff", 0.05 + f.confidence * 0.2),
    confidence: f.confidence,
    isRecent: isRecent(f.valid_at, 24),
    id: f.id,
  }));

  return { nodes, links };
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function DetailPanel({
  node,
  facts,
  onClose,
}: {
  node: GraphNode;
  facts: GraphEdge[];
  onClose: () => void;
}) {
  const color = TYPE_COLORS[node.type] || C.muted;
  const connectedFacts = facts.filter(
    (f) =>
      (f.source === node.id || f.target === node.id) &&
      (!f.expired_at || new Date(f.expired_at).getTime() > Date.now()),
  );

  return (
    <div
      style={{
        width: "300px",
        height: "100%",
        background: C.card,
        borderLeft: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              wordBreak: "break-word",
            }}
          >
            {node.name}
          </div>
          <span
            style={{
              display: "inline-block",
              marginTop: "6px",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: C.bg,
              background: color,
              padding: "2px 8px",
              borderRadius: "4px",
            }}
          >
            {node.type.replace("_", " ")}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: C.dim,
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            padding: "4px",
            flexShrink: 0,
          }}
          aria-label="Fermer"
        >
          X
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Dates */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "10px", color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
            Dates
          </div>
          <div style={{ fontSize: "12px", color: C.muted, lineHeight: 1.8 }}>
            <span style={{ color: C.dim }}>Cree : </span>{formatDate(node.created_at)}
            <br />
            <span style={{ color: C.dim }}>Vu : </span>{formatDate(node.last_seen)}
          </div>
        </div>

        {/* Properties */}
        {Object.keys(node.properties).length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Proprietes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {Object.entries(node.properties).map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    padding: "4px 8px",
                    background: C.bg,
                    borderRadius: "4px",
                  }}
                >
                  <span style={{ color: C.dim, fontFamily: "monospace" }}>{key}</span>
                  <span style={{ color: C.muted, fontFamily: "monospace" }}>{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected facts */}
        <div>
          <div style={{ fontSize: "10px", color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
            Faits ({connectedFacts.length})
          </div>
          {connectedFacts.length === 0 ? (
            <div style={{ fontSize: "12px", color: C.dim }}>Aucun fait actif</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {connectedFacts.slice(0, 20).map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: "8px 10px",
                    background: C.bg,
                    borderRadius: "4px",
                    borderLeft: `2px solid ${hexToRgba("#ffffff", 0.1 + f.confidence * 0.4)}`,
                  }}
                >
                  <div style={{ fontSize: "11px", color: C.text, lineHeight: 1.4 }}>
                    {f.description || f.relation}
                  </div>
                  <div style={{ fontSize: "10px", color: C.dim, marginTop: "4px" }}>
                    {f.relation} · conf. {(f.confidence * 100).toFixed(0)}% · {formatDate(f.valid_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function NeuralPage({ graphData }: NeuralPageProps) {
  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterRecent, setFilterRecent] = useState(false);

  // Temporal slider range
  const allDates = useMemo(() => {
    const dates = [
      ...graphData.entities.map((e) => new Date(e.created_at).getTime()),
      ...graphData.facts.map((f) => new Date(f.valid_at).getTime()),
    ].filter((d) => !isNaN(d) && d > 0);
    if (dates.length === 0) return { min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() };
    return { min: Math.min(...dates), max: Date.now() };
  }, [graphData]);

  const [temporalCutoff, setTemporalCutoff] = useState(allDates.max);

  // Build graph data
  const forceData = useMemo(
    () => buildForceData(graphData, search, filterRecent, temporalCutoff),
    [graphData, search, filterRecent, temporalCutoff],
  );

  // Configure link distance force + initial zoom-to-fit
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-400);
    fg.d3Force("link")?.distance(120);
    // Initial zoom-to-fit after a short delay for layout stabilization
    const timer = setTimeout(() => {
      fg.zoomToFit(600, 80);
    }, 800);
    return () => clearTimeout(timer);
  }, [forceData]);

  // Node canvas renderer
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as ForceNode;
      const x = n.x || 0;
      const y = n.y || 0;
      const color = TYPE_COLORS[n.type] || C.muted;
      const isHighlighted = highlightNodes.has(n.id);
      const deg = n.connections || 0;
      const radius = Math.max(6, Math.min(24, deg * 3 + 6));

      // Breathing for recently seen entities
      let breathScale = 1;
      if (isRecent(n.last_seen, 48)) {
        breathScale = 1 + Math.sin(Date.now() / 1500) * 0.06;
      }
      const r = radius * breathScale;

      // Glow for highlighted nodes
      if (isHighlighted) {
        const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.5);
        glow.addColorStop(0, hexToRgba(color, 0.3));
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, r * 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHighlighted ? color : hexToRgba(color, 0.75);
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, 2 * Math.PI);
      ctx.fillStyle = hexToRgba("#ffffff", isHighlighted ? 0.25 : 0.12);
      ctx.fill();

      // Label — only for nodes with 3+ connections or highlighted
      const showLabel = deg >= 3 || isHighlighted;
      if (showLabel && globalScale > 0.3) {
        const fontSize = Math.max(11, 13 / globalScale);
        ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = truncate(n.name, 18);
        const textWidth = ctx.measureText(label).width;
        const labelY = y + r + 4;

        // Dark background behind label for contrast
        const padX = 4;
        const padY = 2;
        ctx.fillStyle = hexToRgba(C.bg, 0.85);
        ctx.beginPath();
        ctx.roundRect(
          x - textWidth / 2 - padX,
          labelY - padY,
          textWidth + padX * 2,
          fontSize + padY * 2,
          3,
        );
        ctx.fill();

        ctx.fillStyle = isHighlighted ? C.text : C.muted;
        ctx.fillText(label, x, labelY);
      }
    },
    [highlightNodes],
  );

  // Node pointer area size
  const nodePointerAreaPaint = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as ForceNode;
      const r = Math.max(6, Math.min(24, (n.connections || 0) * 3 + 6)) + 6;
      ctx.beginPath();
      ctx.arc(n.x || 0, n.y || 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  // Hover handler
  const handleNodeHover = useCallback(
    (node: any) => {
      if (!node) {
        setHighlightNodes(new Set());
        setHighlightLinks(new Set());
        return;
      }
      const n = node as ForceNode;
      const connectedNodeIds = new Set<string>([n.id]);
      const connectedLinkIds = new Set<string>();
      for (const f of graphData.facts) {
        if (f.source === n.id || f.target === n.id) {
          connectedNodeIds.add(f.source);
          connectedNodeIds.add(f.target);
          connectedLinkIds.add(f.id);
        }
      }
      setHighlightNodes(connectedNodeIds);
      setHighlightLinks(connectedLinkIds);
    },
    [graphData.facts],
  );

  // Click handler
  const handleNodeClick = useCallback(
    (node: any) => {
      const n = node as ForceNode;
      const entity = graphData.entities.find((e) => e.id === n.id);
      setSelectedNode(entity || null);
    },
    [graphData.entities],
  );

  // Link width
  const linkWidth = useCallback(
    (link: any) => {
      const l = link as ForceLink;
      return highlightLinks.has(l.id) ? 2 : 1;
    },
    [highlightLinks],
  );

  // Link color (highlight aware)
  const linkColor = useCallback(
    (link: any) => {
      const l = link as ForceLink;
      if (highlightLinks.has(l.id)) {
        return hexToRgba("#ffffff", 0.2 + l.confidence * 0.3);
      }
      return l.color;
    },
    [highlightLinks],
  );

  // Stats
  const activeFacts = graphData.facts.filter(
    (f) => !f.expired_at || new Date(f.expired_at).getTime() > Date.now(),
  ).length;

  // Empty state
  if (graphData.entities.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          color: C.dim,
        }}
      >
        <div style={{ fontSize: "36px", opacity: 0.3, fontWeight: 200 }}>*</div>
        <div style={{ fontSize: "14px", maxWidth: "400px", textAlign: "center", lineHeight: 1.6 }}>
          Le knowledge graph est vide. Il sera enrichi automatiquement a chaque fin de session.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: C.bg }}>
      {/* Graph area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: `linear-gradient(to bottom, ${C.bg}, transparent)`,
            pointerEvents: "none",
          }}
        >
          {/* Search + filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", pointerEvents: "auto" }}>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "200px",
                padding: "6px 12px",
                fontSize: "12px",
                fontFamily: "system-ui, sans-serif",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: "6px",
                color: C.text,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "2px" }}>
              <button
                onClick={() => setFilterRecent(false)}
                style={{
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: !filterRecent ? C.text : C.dim,
                  background: !filterRecent ? C.card : "transparent",
                  border: `1px solid ${!filterRecent ? C.border : "transparent"}`,
                  borderRadius: "4px 0 0 4px",
                  cursor: "pointer",
                }}
              >
                Tout
              </button>
              <button
                onClick={() => setFilterRecent(true)}
                style={{
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: filterRecent ? C.text : C.dim,
                  background: filterRecent ? C.card : "transparent",
                  border: `1px solid ${filterRecent ? C.border : "transparent"}`,
                  borderRadius: "0 4px 4px 0",
                  cursor: "pointer",
                }}
              >
                Recents (30j)
              </button>
            </div>
          </div>

          {/* Title */}
          <div style={{ fontSize: "14px", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
            Knowledge Graph
          </div>
        </div>

        {/* Stats overlay (top-left, below search bar) */}
        <div
          style={{
            position: "absolute",
            top: "56px",
            left: "16px",
            zIndex: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            pointerEvents: "none",
          }}
        >
          {[
            { label: "Entites", value: graphData.stats.totalEntities },
            { label: "Faits actifs", value: activeFacts },
            { label: "Episodes", value: graphData.episodes },
            { label: "Hub", value: graphData.stats.topHub || "—" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "8px 12px",
                background: hexToRgba(C.card, 0.85),
                border: `1px solid ${C.border}`,
                borderRadius: "6px",
                minWidth: "100px",
              }}
            >
              <div style={{ fontSize: "10px", color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: C.text, marginTop: "2px", fontFamily: "monospace" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Legend (bottom-left) */}
        <div
          style={{
            position: "absolute",
            bottom: "56px",
            left: "16px",
            zIndex: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            padding: "8px 12px",
            background: hexToRgba(C.bg, 0.85),
            borderRadius: "6px",
            border: `1px solid ${C.border}`,
            pointerEvents: "none",
          }}
        >
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "10px", color: C.muted }}>{type.replace("_", " ")}</span>
            </div>
          ))}
        </div>

        {/* Temporal slider (bottom) */}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "16px",
            right: "16px",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "6px 12px",
            background: hexToRgba(C.bg, 0.85),
            borderRadius: "6px",
            border: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontSize: "10px", color: C.dim, flexShrink: 0 }}>
            {new Date(allDates.min).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
          </span>
          <input
            type="range"
            min={allDates.min}
            max={allDates.max}
            value={temporalCutoff}
            onChange={(e) => setTemporalCutoff(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: C.accent,
              height: "4px",
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: "10px", color: C.muted, flexShrink: 0, fontFamily: "monospace" }}>
            {new Date(temporalCutoff).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>

        {/* Force graph */}
        <ForceGraph2D
          ref={graphRef}
          graphData={forceData}
          backgroundColor={C.bg}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          nodeVal="val"
          nodeLabel=""
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          linkWidth={linkWidth}
          linkColor={linkColor}
          linkDirectionalParticles={(link: any) => {
            const l = link as ForceLink;
            return l.isRecent ? 3 : 0;
          }}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => C.accent}
          linkCurvature={0.1}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.25}
          warmupTicks={80}
          cooldownTicks={150}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enableNodeDrag={true}
          onEngineStop={() => {
            if (graphRef.current) {
              graphRef.current.zoomToFit(400, 60);
            }
          }}
        />
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          facts={graphData.facts}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
