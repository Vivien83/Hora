/**
 * HORA — Knowledge Graph Full Page
 *
 * Visualisation pleine page du knowledge graph bi-temporel.
 * Utilise react-force-graph-2d pour le rendu interactif.
 * Les entites sont colorees par type, les faits par confiance.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import ForceGraph3D from "react-force-graph-3d";
import { forceCenter, forceRadial } from "d3-force-3d";
import SpriteText from "three-spritetext";
import type { GraphData, GraphNode, GraphEdge } from "./types";

// ─── Constants ──────────────────────────────────────────────────────────────

const C = {
  bg: "#F2F0E9",
  glass: {
    background: "rgba(255,255,255,0.45)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: "12px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
  },
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  gold: "#D4A853",
  accent: "#6366f1",
  border: "rgba(0,0,0,0.06)",
  serif: "'Playfair Display', Georgia, serif",
  sans: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
  canvasBg: "#EDE9E0",
  canvasText: "#0f172a",
  canvasMuted: "#64748b",
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
  z?: number;
  val: number;
  fx?: number | undefined;
  fy?: number | undefined;
  fz?: number | undefined;
  _createdTs?: number; // precomputed timestamp for temporal checks
  __threeObj?: any; // cached Three.js object
}

interface ForceLinkMetadata {
  context?: string;
  evidence?: string;
  alternatives?: string[];
  category?: string;
  source_session?: string;
}

interface ForceLink {
  source: string;
  target: string;
  color: string;
  confidence: number;
  isRecent: boolean;
  id: string;
  relation: string;
  description: string;
  valid_at: string;
  metadata?: ForceLinkMetadata;
}

// Relation category colors
const CATEGORY_COLORS: Record<string, string> = {
  structural: "#6366f1",
  technological: "#06b6d4",
  learning: "#f59e0b",
  experience: "#10b981",
  actor: "#ec4899",
  conceptual: "#8b5cf6",
};

function getRelationCategory(relation: string): string {
  const structural = ["has_component", "depends_on", "extends", "implements", "configures", "replaces", "hosts"];
  const technological = ["uses", "integrates", "built_with", "migrated_from"];
  const learning = ["decided_for", "decided_against", "learned_that", "caused_by", "solved_by", "blocked_by", "workaround_for"];
  const experience = ["works_well_for", "fails_for", "performs_better_than", "anti_pattern_in"];
  const actor = ["works_on", "prefers", "frustrated_with", "satisfied_with", "created", "maintains"];
  if (structural.includes(relation)) return "structural";
  if (technological.includes(relation)) return "technological";
  if (learning.includes(relation)) return "learning";
  if (experience.includes(relation)) return "experience";
  if (actor.includes(relation)) return "actor";
  return "conceptual";
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

  let entities = graphData.entities;
  // Temporal filter: only show entities that exist at this point in time
  entities = entities.filter((e) => {
    const created = new Date(e.created_at).getTime();
    return !isNaN(created) && created <= temporalCutoff;
  });
  if (filterRecent) {
    entities = entities.filter((e) => new Date(e.last_seen).getTime() > thirtyDaysAgo);
  }
  if (searchLower) {
    entities = entities.filter((e) => e.name.toLowerCase().includes(searchLower));
  }

  const entityIds = new Set(entities.map((e) => e.id));

  const facts = graphData.facts.filter((f) => {
    if (!entityIds.has(f.source) || !entityIds.has(f.target)) return false;
    if (f.expired_at && new Date(f.expired_at).getTime() < now) return false;
    if (new Date(f.valid_at).getTime() > temporalCutoff) return false;
    return true;
  });

  const degree: Record<string, number> = {};
  for (const f of facts) {
    degree[f.source] = (degree[f.source] || 0) + 1;
    degree[f.target] = (degree[f.target] || 0) + 1;
  }

  // Only show nodes that have at least one visible link (avoids isolated pile-up)
  const connectedIds = new Set(facts.flatMap((f) => [f.source, f.target]));
  const visibleEntities = entities.filter((e) => connectedIds.has(e.id));

  const nodes: ForceNode[] = visibleEntities.map((e) => ({
    ...e,
    val: Math.max(12, Math.min(50, (degree[e.id] || 0) * 5 + 12)),
  }));

  // Build entity date lookup for temporal direction
  const entityDate: Record<string, number> = {};
  for (const e of entities) entityDate[e.id] = new Date(e.created_at).getTime() || 0;

  const links: ForceLink[] = facts.map((f) => {
    const category = f.metadata?.category || getRelationCategory(f.relation);
    const catColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.conceptual;
    // Orient particles from older node to newer node (temporal flow)
    const srcTime = entityDate[f.source] || 0;
    const tgtTime = entityDate[f.target] || 0;
    const temporalSource = srcTime <= tgtTime ? f.source : f.target;
    const temporalTarget = srcTime <= tgtTime ? f.target : f.source;
    return {
      source: temporalSource,
      target: temporalTarget,
      color: hexToRgba(catColor, 0.15 + f.confidence * 0.35),
      confidence: f.confidence,
      isRecent: isRecent(f.valid_at, 24),
      id: f.id,
      relation: f.relation,
      description: f.description,
      valid_at: f.valid_at,
      metadata: f.metadata,
    };
  });

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
  const color = TYPE_COLORS[node.type] || C.textMuted;
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
        ...C.glass,
        borderRadius: 0,
        borderLeft: "1px solid rgba(255,255,255,0.7)",
        borderTop: "none",
        borderBottom: "none",
        borderRight: "none",
        display: "flex",
        flexDirection: "column",
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
              fontFamily: C.serif,
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
              color: "#fff",
              background: color,
              padding: "2px 8px",
              borderRadius: "4px",
              fontFamily: C.sans,
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
            color: C.textTertiary,
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
          <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontFamily: C.sans }}>
            Dates
          </div>
          <div style={{ fontSize: "12px", color: C.textSecondary, lineHeight: 1.8, fontFamily: C.sans }}>
            <span style={{ color: C.textMuted }}>Cree : </span>{formatDate(node.created_at)}
            <br />
            <span style={{ color: C.textMuted }}>Vu : </span>{formatDate(node.last_seen)}
          </div>
        </div>

        {/* Properties */}
        {Object.keys(node.properties).length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontFamily: C.sans }}>
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
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "6px",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <span style={{ color: C.textMuted, fontFamily: C.mono }}>{key}</span>
                  <span style={{ color: C.textSecondary, fontFamily: C.mono }}>{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected facts */}
        <div>
          <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontFamily: C.sans }}>
            Faits ({connectedFacts.length})
          </div>
          {connectedFacts.length === 0 ? (
            <div style={{ fontSize: "12px", color: C.textTertiary, fontFamily: C.sans }}>Aucun fait actif</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {connectedFacts.slice(0, 20).map((f) => {
                const cat = (f as any).metadata?.category || getRelationCategory(f.relation);
                const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.conceptual;
                return (
                  <div
                    key={f.id}
                    style={{
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.55)",
                      borderRadius: "8px",
                      borderLeft: `2px solid ${catColor}`,
                      border: `1px solid ${C.border}`,
                      borderLeftWidth: "2px",
                      borderLeftColor: catColor,
                    }}
                  >
                    <div style={{ fontSize: "11px", color: C.text, lineHeight: 1.4, fontFamily: C.sans }}>
                      {f.description || f.relation}
                    </div>
                    <div style={{ fontSize: "10px", color: C.textTertiary, marginTop: "4px", display: "flex", alignItems: "center", gap: "6px", fontFamily: C.mono }}>
                      <span style={{ color: catColor, fontWeight: 600 }}>{f.relation}</span>
                      <span>·</span>
                      <span>conf. {(f.confidence * 100).toFixed(0)}%</span>
                      <span>·</span>
                      <span>{formatDate(f.valid_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Link Detail Panel ──────────────────────────────────────────────────────

function LinkDetailPanel({
  link,
  entities,
  onClose,
}: {
  link: ForceLink;
  entities: GraphNode[];
  onClose: () => void;
}) {
  const sourceName = entities.find((e) => e.id === link.source)?.name || link.source;
  const targetName = entities.find((e) => e.id === link.target)?.name || link.target;
  const confPct = (link.confidence * 100).toFixed(0);

  return (
    <div
      style={{
        width: "300px",
        height: "100%",
        ...C.glass,
        borderRadius: 0,
        borderLeft: "1px solid rgba(255,255,255,0.7)",
        borderTop: "none",
        borderBottom: "none",
        borderRight: "none",
        display: "flex",
        flexDirection: "column",
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
              fontSize: "14px",
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              wordBreak: "break-word",
              fontFamily: C.serif,
            }}
          >
            {link.relation}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            {(() => {
              const cat = link.metadata?.category || getRelationCategory(link.relation);
              const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.conceptual;
              return (
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#fff",
                    background: catColor,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontFamily: C.sans,
                  }}
                >
                  {cat}
                </span>
              );
            })()}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: C.textTertiary,
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
        {/* Connection */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontFamily: C.sans }}>
            Connexion
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: C.text,
              padding: "8px 10px",
              background: "rgba(255,255,255,0.55)",
              borderRadius: "8px",
              border: `1px solid ${C.border}`,
              fontFamily: C.sans,
            }}
          >
            <span style={{ fontWeight: 600 }}>{sourceName}</span>
            <span style={{ color: C.textTertiary }}>→</span>
            <span style={{ fontWeight: 600 }}>{targetName}</span>
          </div>
        </div>

        {/* Description */}
        {link.description && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontFamily: C.sans }}>
              Description
            </div>
            <div style={{ fontSize: "12px", color: C.textSecondary, lineHeight: 1.5, fontFamily: C.sans }}>
              {link.description}
            </div>
          </div>
        )}

        {/* Context from metadata */}
        {link.metadata?.context && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontFamily: C.sans }}>
              Contexte
            </div>
            <div style={{ fontSize: "12px", color: C.textSecondary, lineHeight: 1.5, fontStyle: "italic", fontFamily: C.sans }}>
              {link.metadata.context}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px", fontFamily: C.sans }}>
            Metadata
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { label: "Confiance", value: `${confPct}%` },
              { label: "Valide depuis", value: formatDate(link.valid_at) },
              { label: "Relation", value: link.relation },
              ...(link.metadata?.source_session ? [{ label: "Source", value: link.metadata.source_session }] : []),
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  padding: "4px 8px",
                  background: "rgba(255,255,255,0.55)",
                  borderRadius: "6px",
                  border: `1px solid ${C.border}`,
                }}
              >
                <span style={{ color: C.textMuted, fontFamily: C.mono }}>{row.label}</span>
                <span style={{ color: C.textSecondary, fontFamily: C.mono }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Minimap ────────────────────────────────────────────────────────────────

function Minimap({
  graphRef,
  containerRef,
  nodes,
  viewMode,
}: {
  graphRef: React.RefObject<any>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodes: ForceNode[];
  viewMode: "2d" | "3d";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 160;
  const PADDING = 12;
  const dragging = useRef(false);

  // Helper: compute graph bounds and minimap transform
  const getTransform = useCallback(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    if (!isFinite(minX)) return null;
    const graphW = (maxX - minX) || 1;
    const graphH = (maxY - minY) || 1;
    const drawW = SIZE - PADDING * 2;
    const drawH = SIZE - PADDING * 2;
    const scale = Math.min(drawW / graphW, drawH / graphH);
    const offX = PADDING + (drawW - graphW * scale) / 2;
    const offY = PADDING + (drawH - graphH * scale) / 2;
    return { minX, minY, scale, offX, offY };
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fg = graphRef.current;
    if (!canvas || !fg) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      const t = getTransform();
      if (!t) { animId = requestAnimationFrame(draw); return; }

      // Draw nodes as dots
      for (const n of nodes) {
        if (n.x == null || n.y == null) continue;
        const sx = t.offX + (n.x - t.minX) * t.scale;
        const sy = t.offY + (n.y - t.minY) * t.scale;
        const color = TYPE_COLORS[n.type] || C.canvasMuted;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Viewport indicator — adapts to 2D (rectangle) or 3D (crosshair)
      try {
        if (viewMode === "2d" && fg.screen2GraphCoords) {
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const topLeft = fg.screen2GraphCoords(0, 0);
            const bottomRight = fg.screen2GraphCoords(rect.width, rect.height);
            const vx1 = t.offX + (topLeft.x - t.minX) * t.scale;
            const vy1 = t.offY + (topLeft.y - t.minY) * t.scale;
            const vx2 = t.offX + (bottomRight.x - t.minX) * t.scale;
            const vy2 = t.offY + (bottomRight.y - t.minY) * t.scale;
            ctx.strokeStyle = C.gold;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(
              Math.max(0, vx1), Math.max(0, vy1),
              Math.min(SIZE, vx2) - Math.max(0, vx1),
              Math.min(SIZE, vy2) - Math.max(0, vy1),
            );
          }
        } else if (viewMode === "3d" && fg.cameraPosition) {
          const cam = fg.cameraPosition();
          if (cam) {
            const cx = t.offX + (cam.x - t.minX) * t.scale;
            const cy = t.offY + (cam.y - t.minY) * t.scale;
            ctx.strokeStyle = C.gold;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 12, cy);
            ctx.lineTo(cx + 12, cy);
            ctx.moveTo(cx, cy - 12);
            ctx.lineTo(cx, cy + 12);
            ctx.stroke();
          }
        }
      } catch { /* not ready */ }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [graphRef, containerRef, nodes, getTransform, viewMode]);

  // Click/drag on minimap → navigate main graph
  const navigateTo = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const fg = graphRef.current;
    if (!fg) return;
    const miniRect = canvasRef.current?.getBoundingClientRect();
    if (!miniRect) return;
    const cx = e.clientX - miniRect.left;
    const cy = e.clientY - miniRect.top;
    const t = getTransform();
    if (!t) return;

    const gx = t.minX + (cx - t.offX) / t.scale;
    const gy = t.minY + (cy - t.offY) / t.scale;
    if (viewMode === "2d") {
      fg.centerAt(gx, gy, 300);
    } else {
      fg.cameraPosition(
        { x: gx, y: gy, z: 300 },
        { x: gx, y: gy, z: 0 },
        300,
      );
    }
  }, [graphRef, getTransform, viewMode]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    dragging.current = true;
    navigateTo(e);
  }, [navigateTo]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging.current) navigateTo(e);
  }, [navigateTo]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: "absolute",
        top: "60px",
        right: "16px",
        zIndex: 10,
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        background: "rgba(255,255,255,0.60)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.8)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        cursor: "crosshair",
      }}
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function NeuralPage({ graphData }: NeuralPageProps) {
  const graphRef = useRef<any>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Track container size for ForceGraph3D (it defaults to window size otherwise)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = graphContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setContainerSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 2D/3D toggle — persisted
  const [viewMode, setViewMode] = useState<"2d" | "3d">(() => {
    return (localStorage.getItem("hora-neural-viewMode") as "2d" | "3d") || "3d";
  });
  useEffect(() => { localStorage.setItem("hora-neural-viewMode", viewMode); }, [viewMode]);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<ForceLink | null>(null);
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1); // 0.5x, 1x, 2x
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevForceDataRef = useRef<{ nodes: ForceNode[]; links: ForceLink[] } | null>(null);

  // Pre-compute sorted timeline for incremental playback
  const timeline = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const searchLower = search.toLowerCase();

    let entities = graphData.entities.filter((e) => {
      const ts = new Date(e.created_at).getTime();
      if (isNaN(ts)) return false;
      if (filterRecent && new Date(e.last_seen).getTime() <= thirtyDaysAgo) return false;
      if (searchLower && !e.name.toLowerCase().includes(searchLower)) return false;
      return true;
    });

    const entityIdSet = new Set(entities.map((e) => e.id));

    const facts = graphData.facts.filter((f) => {
      if (!entityIdSet.has(f.source) || !entityIdSet.has(f.target)) return false;
      if (f.expired_at && new Date(f.expired_at).getTime() < now) return false;
      const ts = new Date(f.valid_at).getTime();
      return !isNaN(ts);
    });

    // Degree for node sizing
    const degree: Record<string, number> = {};
    for (const f of facts) {
      degree[f.source] = (degree[f.source] || 0) + 1;
      degree[f.target] = (degree[f.target] || 0) + 1;
    }

    // Only entities with at least one connection
    entities = entities.filter((e) => (degree[e.id] || 0) > 0);

    // Entity date lookup for temporal link direction
    const entityDate: Record<string, number> = {};
    for (const e of entities) entityDate[e.id] = new Date(e.created_at).getTime() || 0;

    // Adjacency map for neighbor placement
    const adjacency = new Map<string, Set<string>>();
    for (const f of facts) {
      if (!adjacency.has(f.source)) adjacency.set(f.source, new Set());
      if (!adjacency.has(f.target)) adjacency.set(f.target, new Set());
      adjacency.get(f.source)!.add(f.target);
      adjacency.get(f.target)!.add(f.source);
    }

    const sortedEntities = entities
      .map((e) => ({
        ...e,
        _ts: new Date(e.created_at).getTime(),
        val: Math.max(12, Math.min(50, (degree[e.id] || 0) * 5 + 12)),
      } as ForceNode & { _ts: number }))
      .sort((a, b) => a._ts - b._ts);

    const sortedFacts = facts
      .map((f) => {
        const category = f.metadata?.category || getRelationCategory(f.relation);
        const catColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.conceptual;
        const srcTime = entityDate[f.source] || 0;
        const tgtTime = entityDate[f.target] || 0;
        return {
          _ts: new Date(f.valid_at).getTime(),
          source: srcTime <= tgtTime ? f.source : f.target,
          target: srcTime <= tgtTime ? f.target : f.source,
          color: hexToRgba(catColor, 0.15 + f.confidence * 0.35),
          confidence: f.confidence,
          isRecent: isRecent(f.valid_at, 24),
          id: f.id,
          relation: f.relation,
          description: f.description,
          valid_at: f.valid_at,
          metadata: f.metadata,
        } as ForceLink & { _ts: number };
      })
      .sort((a, b) => a._ts - b._ts);

    return { sortedEntities, sortedFacts, adjacency };
  }, [graphData, search, filterRecent]);

  // Playback incremental state
  const playbackRef = useRef<{
    entityIdx: number;
    factIdx: number;
    visibleIds: Set<string>;
  } | null>(null);

  // Animation loop for temporal playback — incremental, bypasses React
  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current) { clearInterval(playRef.current); playRef.current = null; }
      playbackRef.current = null;
      return;
    }
    const range = allDates.max - allDates.min;
    if (range <= 0) { setIsPlaying(false); return; }
    const stepMs = (range / 1000) * playSpeed;
    const intervalMs = 50;

    // Initialize: walk timeline to current cutoff position
    if (!playbackRef.current) {
      const cur = temporalCutoff;
      let ei = 0, fi = 0;
      const visibleIds = new Set<string>();
      while (ei < timeline.sortedEntities.length && timeline.sortedEntities[ei]._ts <= cur) {
        visibleIds.add(timeline.sortedEntities[ei].id);
        ei++;
      }
      while (fi < timeline.sortedFacts.length && timeline.sortedFacts[fi]._ts <= cur) {
        fi++;
      }
      playbackRef.current = { entityIdx: ei, factIdx: fi, visibleIds };
    }

    playRef.current = setInterval(() => {
      setTemporalCutoff((prev) => {
        const next = prev + stepMs;
        if (next >= allDates.max) {
          setIsPlaying(false);
          return allDates.max;
        }

        // Incremental graph update — no React re-render of ForceGraph2D
        const fg = graphRef.current;
        const ps = playbackRef.current;
        if (fg && ps) {
          const currentData = fg.graphData();
          const currentNodes = currentData.nodes as ForceNode[];
          let added = false;

          // Build position lookup from live graph for neighbor placement
          const posMap = new Map<string, { x: number; y: number }>();
          for (const n of currentNodes) {
            if (n.x != null && n.y != null) posMap.set(n.id, { x: n.x, y: n.y });
          }

          // Add new entities
          while (ps.entityIdx < timeline.sortedEntities.length) {
            const e = timeline.sortedEntities[ps.entityIdx];
            if (e._ts > next) break;
            ps.entityIdx++;
            if (ps.visibleIds.has(e.id)) continue;
            ps.visibleIds.add(e.id);

            const node: ForceNode = { ...e };
            // Place near a connected neighbor
            const neighbors = timeline.adjacency.get(e.id);
            let placed = false;
            if (neighbors) {
              for (const nid of neighbors) {
                const npos = posMap.get(nid);
                if (npos) {
                  const angle = Math.random() * 2 * Math.PI;
                  const dist = 30 + Math.random() * 40;
                  node.x = npos.x + Math.cos(angle) * dist;
                  node.y = npos.y + Math.sin(angle) * dist;
                  placed = true;
                  break;
                }
              }
            }
            if (!placed) {
              const angle = Math.random() * 2 * Math.PI;
              const dist = 50 + Math.random() * 100;
              node.x = Math.cos(angle) * dist;
              node.y = Math.sin(angle) * dist;
            }

            currentData.nodes.push(node);
            posMap.set(node.id, { x: node.x || 0, y: node.y || 0 });
            added = true;
          }

          // Add new links
          while (ps.factIdx < timeline.sortedFacts.length) {
            const f = timeline.sortedFacts[ps.factIdx];
            if (f._ts > next) break;
            ps.factIdx++;
            const srcId = typeof f.source === "object" ? (f.source as any).id : f.source;
            const tgtId = typeof f.target === "object" ? (f.target as any).id : f.target;
            if (!ps.visibleIds.has(srcId) || !ps.visibleIds.has(tgtId)) continue;
            currentData.links.push({ ...f });
            added = true;
          }

          if (added) {
            fg.graphData(currentData);
          }
        }

        return next;
      });
    }, intervalMs);

    return () => { if (playRef.current) { clearInterval(playRef.current); playRef.current = null; } };
  }, [isPlaying, playSpeed, allDates.min, allDates.max, timeline]);

  // Persisted graph settings
  const [spacing, setSpacing] = useState(() => {
    const saved = localStorage.getItem("hora-neural-spacing");
    return saved ? Number(saved) : -400;
  });
  const [linkDist, setLinkDist] = useState(() => {
    const saved = localStorage.getItem("hora-neural-linkDist");
    return saved ? Number(saved) : 120;
  });

  // Save settings to localStorage on change
  useEffect(() => { localStorage.setItem("hora-neural-spacing", String(spacing)); }, [spacing]);
  useEffect(() => { localStorage.setItem("hora-neural-linkDist", String(linkDist)); }, [linkDist]);

  // Track what changed to decide reheat intensity
  const prevCutoffRef = useRef(temporalCutoff);
  const prevSearchRef = useRef(search);
  const prevFilterRef = useRef(filterRecent);

  const forceData = useMemo(() => {
    // During playback, skip — graph is updated imperatively
    if (isPlaying && prevForceDataRef.current) {
      return prevForceDataRef.current;
    }

    // Capture ALL live positions before rebuilding (not just dragged ones)
    const fg = graphRef.current;
    if (fg) {
      try {
        const liveData = fg.graphData();
        if (liveData?.nodes) {
          for (const n of liveData.nodes as ForceNode[]) {
            if (n.x != null && n.y != null) {
              positionsRef.current.set(n.id, { x: n.x, y: n.y });
            }
          }
        }
      } catch { /* graph not ready yet */ }
    }

    const data = buildForceData(graphData, search, filterRecent, temporalCutoff);

    // Build a lookup of connected nodes for placing new nodes nearby
    const connectedTo = new Map<string, string[]>();
    for (const link of data.links) {
      const src = typeof link.source === "object" ? (link.source as any).id : link.source;
      const tgt = typeof link.target === "object" ? (link.target as any).id : link.target;
      if (!connectedTo.has(src)) connectedTo.set(src, []);
      if (!connectedTo.has(tgt)) connectedTo.set(tgt, []);
      connectedTo.get(src)!.push(tgt);
      connectedTo.get(tgt)!.push(src);
    }

    for (const node of data.nodes) {
      const saved = positionsRef.current.get(node.id);
      if (saved) {
        node.x = saved.x;
        node.y = saved.y;
        // Keep z from previous if available, otherwise spread in 3D
        if (node.z == null) node.z = (Math.random() - 0.5) * 80;
      } else {
        const neighbors = connectedTo.get(node.id) || [];
        let placed = false;
        for (const nid of neighbors) {
          const npos = positionsRef.current.get(nid);
          if (npos) {
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            const dist = 30 + Math.random() * 40;
            node.x = npos.x + Math.sin(phi) * Math.cos(theta) * dist;
            node.y = npos.y + Math.sin(phi) * Math.sin(theta) * dist;
            node.z = (Math.random() - 0.5) * dist;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const theta = Math.random() * 2 * Math.PI;
          const phi = Math.acos(2 * Math.random() - 1);
          const dist = 50 + Math.random() * 100;
          node.x = Math.sin(phi) * Math.cos(theta) * dist;
          node.y = Math.sin(phi) * Math.sin(theta) * dist;
          node.z = Math.cos(phi) * dist;
        }
      }
    }
    prevForceDataRef.current = data;
    return data;
  }, [graphData, search, filterRecent, temporalCutoff, isPlaying]);

  // Apply forces + reheat with appropriate intensity
  // Use a small delay to ensure the force engine is initialized before tweaking
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    const timer = setTimeout(() => {
      try {
        fg.d3Force("charge")?.strength(spacing);
        fg.d3Force("link")?.distance(linkDist);
        if (viewMode === "2d") {
          fg.d3Force("center", forceCenter(0, 0).strength(0.08));
          fg.d3Force("radial", forceRadial(120, 0, 0).strength(0.02));
        } else {
          const existingCenter = fg.d3Force("center");
          if (existingCenter?.strength) existingCenter.strength(0.05);
          fg.d3Force("charge")?.theta(0.9);
        }
      } catch { /* force engine not ready yet */ }

      const cutoffChanged = prevCutoffRef.current !== temporalCutoff;
      const searchChanged = prevSearchRef.current !== search;
      const filterChanged = prevFilterRef.current !== filterRecent;
      prevCutoffRef.current = temporalCutoff;
      prevSearchRef.current = search;
      prevFilterRef.current = filterRecent;

      if (cutoffChanged && !searchChanged && !filterChanged) return;

      try { fg.d3ReheatSimulation(); } catch { /* not ready */ }
    }, 100);

    return () => clearTimeout(timer);
  }, [forceData, spacing, linkDist, temporalCutoff, search, filterRecent, viewMode]);

  // Focus set: when a node is selected, compute its neighborhood (via ref to avoid re-renders)
  const focusNodesRef = useRef<Set<string>>(new Set());
  const focusLinksRef = useRef<Set<string>>(new Set());
  // Smooth dimming: track per-node opacity that interpolates toward target
  const nodeOpacityRef = useRef<Map<string, number>>(new Map());

  useMemo(() => {
    const nodeIds = new Set<string>();
    const linkIds = new Set<string>();
    if (selectedNode) {
      nodeIds.add(selectedNode.id);
      for (const f of graphData.facts) {
        if (f.source === selectedNode.id) { nodeIds.add(f.target); linkIds.add(f.id); }
        if (f.target === selectedNode.id) { nodeIds.add(f.source); linkIds.add(f.id); }
      }
    }
    focusNodesRef.current = nodeIds;
    focusLinksRef.current = linkIds;
  }, [selectedNode, graphData.facts]);

  // Repaint loop for focus transitions (smooth lerp in 2D, re-render in 3D)
  useEffect(() => {
    if (viewMode === "2d") {
      let animId: number;
      let frames = 0;
      const tick = () => {
        const fg = graphRef.current;
        if (fg?.refresh) fg.refresh();
        if (++frames < 45) animId = requestAnimationFrame(tick);
      };
      animId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animId);
    }
  }, [selectedNode, viewMode]);

  // ─── 2D-only renderers ──────────────────────────────────────────────────

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as ForceNode;
      const x = n.x || 0;
      const y = n.y || 0;
      const color = TYPE_COLORS[n.type] || C.canvasMuted;
      const isHighlighted = highlightNodes.has(n.id);
      const fn = focusNodesRef.current;
      const isFocused = fn.size === 0 || fn.has(n.id);
      const deg = n.connections || 0;
      const radius = Math.max(6, Math.min(24, deg * 3 + 6));

      // Smooth dimming — interpolate opacity toward target
      const targetAlpha = isFocused ? 1 : 0.18;
      const currentAlpha = nodeOpacityRef.current.get(n.id) ?? 1;
      const newAlpha = currentAlpha + (targetAlpha - currentAlpha) * 0.12;
      nodeOpacityRef.current.set(n.id, newAlpha);

      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = newAlpha;

      let breathScale = 1;
      if (isRecent(n.last_seen, 48)) {
        breathScale = 1 + Math.sin(Date.now() / 1500) * 0.06;
      }
      const r = radius * breathScale;

      if (isHighlighted && isFocused) {
        const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.5);
        glow.addColorStop(0, hexToRgba(color, 0.3));
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, r * 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHighlighted ? color : hexToRgba(color, 0.75);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, 2 * Math.PI);
      ctx.fillStyle = hexToRgba("#ffffff", isHighlighted ? 0.4 : 0.25);
      ctx.fill();

      // Show all labels when zoomed in enough
      if (globalScale > 0.3) {
        const fontSize = Math.max(10, (deg >= 3 || isHighlighted ? 13 : 11) / globalScale);
        ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = truncate(n.name, 18);
        const labelY = y + r + 4;

        ctx.fillStyle = isHighlighted ? C.canvasText : C.canvasMuted;
        ctx.fillText(label, x, labelY);
      }

      ctx.globalAlpha = prevAlpha;
    },
    [highlightNodes],
  );

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

  // ─── 3D-only renderers ──────────────────────────────────────────────────

  // Node color — use built-in sphere rendering (much faster than custom Three objects)
  const nodeColor = useCallback(
    (node: any) => {
      const n = node as ForceNode;
      const color = TYPE_COLORS[n.type] || C.canvasMuted;
      const fn = focusNodesRef.current;
      const isFocused = fn.size === 0 || fn.has(n.id);
      if (!isFocused) return hexToRgba(color, 0.2);
      return highlightNodes.has(n.id) ? color : hexToRgba(color, 0.8);
    },
    [highlightNodes],
  );

  // Label: only show on hover via nodeLabel (native tooltip)
  const nodeLabel = useCallback(
    (node: any) => {
      const n = node as ForceNode;
      return `<div style="font-family:system-ui;font-size:12px;padding:4px 8px;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px">${n.name}<br/><span style="color:${TYPE_COLORS[n.type] || '#999'};font-size:10px">${n.type}</span></div>`;
    },
    [],
  );

  // SpriteText labels for high-degree nodes only (performance optimization)
  const nodeThreeObjectExtend = true;
  const nodeThreeObject = useCallback(
    (node: any) => {
      const n = node as ForceNode;
      const deg = n.connections || 0;
      // Only label nodes with 3+ connections to limit sprite count
      if (deg < 3) return false as any;
      const sprite = new SpriteText(truncate(n.name, 16));
      sprite.color = C.canvasMuted;
      sprite.textHeight = 4;
      sprite.backgroundColor = "rgba(255,255,255,0)";
      const radius = Math.max(5, Math.min(12, deg * 1.5 + 5));
      sprite.position.set(0, -(radius + 4), 0);
      return sprite;
    },
    [],
  );

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

  const lastClickRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  const handleNodeClick = useCallback(
    (node: any) => {
      const n = node as ForceNode;
      const now = Date.now();
      const last = lastClickRef.current;

      // Double-click detection (< 400ms on same node) → center view
      if (last.id === n.id && now - last.time < 400) {
        const fg = graphRef.current;
        if (fg && n.x != null && n.y != null) {
          if (viewMode === "3d") {
            const distance = 200;
            const distRatio = 1 + distance / Math.hypot(n.x, n.y, n.z || 0);
            fg.cameraPosition(
              { x: n.x * distRatio, y: n.y * distRatio, z: (n.z || 0) * distRatio },
              { x: n.x, y: n.y, z: n.z || 0 },
              600,
            );
          } else {
            fg.centerAt(n.x, n.y, 600);
            fg.zoom(3, 600);
          }
        }
        lastClickRef.current = { id: "", time: 0 };
        return;
      }

      lastClickRef.current = { id: n.id, time: now };
      const entity = graphData.entities.find((e) => e.id === n.id);
      setSelectedNode(entity || null);
      setSelectedLink(null);
    },
    [graphData.entities],
  );

  const handleNodeDrag = useCallback((node: any) => {
    const n = node as ForceNode;
    n.fx = n.x;
    n.fy = n.y;
    if (viewMode === "3d") n.fz = n.z;
  }, [viewMode]);

  const handleNodeDragEnd = useCallback((node: any) => {
    const n = node as ForceNode;
    if (n.x != null && n.y != null) {
      positionsRef.current.set(n.id, { x: n.x, y: n.y });
      n.fx = n.x;
      n.fy = n.y;
      if (viewMode === "3d") n.fz = n.z;
    }
  }, [viewMode]);

  const handleLinkClick = useCallback((link: any) => {
    const l = link as ForceLink;
    const sourceId = typeof l.source === "object" ? (l.source as any).id : l.source;
    const targetId = typeof l.target === "object" ? (l.target as any).id : l.target;
    setSelectedLink({ ...l, source: sourceId, target: targetId });
    setSelectedNode(null);
  }, []);

  const linkLabel = useCallback((link: any) => {
    const l = link as ForceLink;
    const parts = [l.relation];
    if (l.description) parts.push(l.description);
    parts.push(`conf. ${(l.confidence * 100).toFixed(0)}%`);
    parts.push(formatDate(l.valid_at));
    return parts.join(" · ");
  }, []);

  const linkWidth = useCallback(
    (link: any) => {
      const l = link as ForceLink;
      const fl = focusLinksRef.current;
      if (fl.size > 0 && !fl.has(l.id)) return 0.4;
      return highlightLinks.has(l.id) ? 2 : 1;
    },
    [highlightLinks],
  );

  const linkColor = useCallback(
    (link: any) => {
      const l = link as ForceLink;
      const fl = focusLinksRef.current;
      if (fl.size > 0 && !fl.has(l.id)) return hexToRgba("#000000", 0.06);
      if (highlightLinks.has(l.id)) {
        return hexToRgba("#000000", 0.15 + l.confidence * 0.2);
      }
      return l.color;
    },
    [highlightLinks],
  );

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
          color: C.textTertiary,
        }}
      >
        <div style={{ fontSize: "36px", opacity: 0.3, fontWeight: 200, color: C.gold }}>*</div>
        <div style={{ fontSize: "14px", maxWidth: "400px", textAlign: "center", lineHeight: 1.6, fontFamily: C.sans, color: C.textSecondary }}>
          Le knowledge graph est vide. Il sera enrichi automatiquement a chaque fin de session.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: C.bg }}>
      {/* Graph area */}
      <div ref={graphContainerRef} style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}>
        {/* Top bar — glass overlay */}
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
            background: `linear-gradient(to bottom, rgba(242,240,233,0.9) 0%, rgba(242,240,233,0) 100%)`,
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
                fontFamily: C.sans,
                background: "rgba(255,255,255,0.8)",
                border: `1px solid rgba(0,0,0,0.10)`,
                borderRadius: "8px",
                color: C.text,
                outline: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            />
            <div style={{ display: "flex", gap: "2px" }}>
              <button
                onClick={() => setFilterRecent(false)}
                style={{
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: !filterRecent ? C.text : C.textMuted,
                  background: !filterRecent ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${!filterRecent ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)"}`,
                  borderRadius: "6px 0 0 6px",
                  cursor: "pointer",
                  fontFamily: C.sans,
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
                  color: filterRecent ? C.text : C.textMuted,
                  background: filterRecent ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${filterRecent ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)"}`,
                  borderRadius: "0 6px 6px 0",
                  cursor: "pointer",
                  fontFamily: C.sans,
                }}
              >
                Recents (30j)
              </button>
            </div>
          </div>

          {/* Title + recenter */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", pointerEvents: "auto" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: C.text, letterSpacing: "-0.01em", fontFamily: C.serif }}>
              Knowledge Graph
            </div>
            <button
              onClick={() => {
                if (graphRef.current) {
                  graphRef.current.zoomToFit(400, 60);
                }
              }}
              style={{
                padding: "5px 10px",
                fontSize: "11px",
                fontWeight: 500,
                color: C.textMuted,
                background: "rgba(255,255,255,0.8)",
                border: `1px solid rgba(0,0,0,0.08)`,
                borderRadius: "6px",
                cursor: "pointer",
                fontFamily: C.sans,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              Recentrer
            </button>
            <div style={{ display: "flex", gap: "2px" }}>
              {(["2d", "3d"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: viewMode === m ? C.text : C.textMuted,
                    background: viewMode === m ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${viewMode === m ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)"}`,
                    borderRadius: m === "2d" ? "6px 0 0 6px" : "0 6px 6px 0",
                    cursor: "pointer",
                    fontFamily: C.mono,
                    letterSpacing: "0.02em",
                    boxShadow: viewMode === m ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                  }}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats overlay — glass cards */}
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
                background: "rgba(255,255,255,0.70)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: `1px solid rgba(255,255,255,0.8)`,
                borderRadius: "10px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                minWidth: "100px",
              }}
            >
              <div style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: C.sans }}>
                {s.label}
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: C.text, marginTop: "2px", fontFamily: C.mono }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Legend — glass */}
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
            background: "rgba(255,255,255,0.70)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "10px",
            border: `1px solid rgba(255,255,255,0.8)`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
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
              <span style={{ fontSize: "10px", color: C.textSecondary, fontFamily: C.sans }}>{type.replace("_", " ")}</span>
            </div>
          ))}
        </div>

        {/* Temporal slider — glass with play controls */}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "16px",
            right: "16px",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            background: "rgba(255,255,255,0.70)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "10px",
            border: `1px solid rgba(255,255,255,0.8)`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}
        >
          {/* Reset button */}
          <button
            onClick={() => { setIsPlaying(false); setTemporalCutoff(allDates.min); }}
            title="Rembobiner"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              color: C.textMuted,
              padding: "2px 4px",
              lineHeight: 1,
              flexShrink: 0,
              opacity: temporalCutoff <= allDates.min ? 0.3 : 1,
            }}
          >
            ⏮
          </button>
          {/* Play/Pause button */}
          <button
            onClick={() => {
              if (temporalCutoff >= allDates.max) {
                // If at the end, reset to start before playing
                setTemporalCutoff(allDates.min);
              }
              setIsPlaying((p) => !p);
            }}
            title={isPlaying ? "Pause" : "Lecture"}
            style={{
              background: isPlaying ? "rgba(212,168,83,0.15)" : "none",
              border: isPlaying ? `1px solid rgba(212,168,83,0.3)` : `1px solid rgba(0,0,0,0.08)`,
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              color: isPlaying ? C.gold : C.textSecondary,
              padding: "2px 8px",
              lineHeight: 1,
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          {/* Speed selector */}
          <button
            onClick={() => setPlaySpeed((s) => s === 0.5 ? 1 : s === 1 ? 2 : 0.5)}
            title="Vitesse de lecture"
            style={{
              background: "none",
              border: `1px solid rgba(0,0,0,0.06)`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "9px",
              fontWeight: 600,
              fontFamily: C.mono,
              color: C.textMuted,
              padding: "2px 6px",
              lineHeight: 1.2,
              flexShrink: 0,
              minWidth: "28px",
              textAlign: "center",
            }}
          >
            {playSpeed === 0.5 ? "½×" : playSpeed === 1 ? "1×" : "2×"}
          </button>
          {/* Date range + slider */}
          <span style={{ fontSize: "10px", color: C.textMuted, flexShrink: 0, fontFamily: C.mono }}>
            {new Date(allDates.min).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
          </span>
          <input
            type="range"
            min={allDates.min}
            max={allDates.max}
            value={temporalCutoff}
            onChange={(e) => { setIsPlaying(false); setTemporalCutoff(Number(e.target.value)); }}
            style={{
              flex: 1,
              accentColor: C.gold,
              height: "4px",
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: "10px", color: isPlaying ? C.gold : C.textSecondary, flexShrink: 0, fontFamily: C.mono, fontWeight: isPlaying ? 600 : 400, transition: "all 0.2s ease" }}>
            {new Date(temporalCutoff).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>

        {/* Minimap — top right */}
        <Minimap graphRef={graphRef} containerRef={graphContainerRef} nodes={forceData.nodes} viewMode={viewMode} />

        {/* Spacing controls — right side to avoid legend overlap */}
        <div
          style={{
            position: "absolute",
            bottom: "56px",
            right: "16px",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "6px 12px",
            background: "rgba(255,255,255,0.70)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "10px",
            border: `1px solid rgba(255,255,255,0.8)`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: C.textMuted, fontFamily: C.mono, whiteSpace: "nowrap" }}>Repulsion</span>
            <input
              type="range"
              min={-2000}
              max={-50}
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              style={{ width: "80px", accentColor: C.accent, height: "4px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "10px", color: C.textSecondary, fontFamily: C.mono, minWidth: "32px" }}>
              {Math.abs(spacing)}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "rgba(0,0,0,0.08)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: C.textMuted, fontFamily: C.mono, whiteSpace: "nowrap" }}>Liens</span>
            <input
              type="range"
              min={30}
              max={500}
              value={linkDist}
              onChange={(e) => setLinkDist(Number(e.target.value))}
              style={{ width: "80px", accentColor: C.gold, height: "4px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "10px", color: C.textSecondary, fontFamily: C.mono, minWidth: "32px" }}>
              {linkDist}
            </span>
          </div>
        </div>

        {/* Force graph — conditional 2D / 3D */}
        {forceData.nodes.length > 0 && viewMode === "3d" && (
          <ForceGraph3D
            ref={graphRef}
            width={containerSize.width}
            height={containerSize.height}
            graphData={forceData}
            backgroundColor={C.canvasBg}
            nodeColor={nodeColor}
            nodeVal="val"
            nodeLabel={nodeLabel}
            nodeThreeObject={nodeThreeObject}
            nodeThreeObjectExtend={nodeThreeObjectExtend}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => { setSelectedNode(null); setSelectedLink(null); }}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            linkWidth={linkWidth}
            linkColor={linkColor}
            linkLabel={linkLabel}
            onLinkClick={handleLinkClick}
            linkDirectionalParticles={(link: any) => {
              const fl = focusLinksRef.current;
              const l = link as ForceLink;
              if (fl.size > 0 && !fl.has(l.id)) return 0;
              if (highlightLinks.has(l.id)) return 4;
              return 2;
            }}
            linkDirectionalParticleSpeed={(link: any) => {
              const l = link as ForceLink;
              return 0.002 + l.confidence * 0.003;
            }}
            linkDirectionalParticleWidth={(link: any) => {
              const l = link as ForceLink;
              return highlightLinks.has(l.id) ? 3.5 : 2;
            }}
            linkDirectionalParticleColor={() => C.gold}
            linkOpacity={0.3}
            linkCurvature={0.15}
            d3AlphaDecay={0.06}
            d3VelocityDecay={0.35}
            warmupTicks={120}
            cooldownTicks={150}
            enableNodeDrag={true}
            enableNavigationControls={true}
            onEngineStop={() => {}}
          />
        )}
        {forceData.nodes.length > 0 && viewMode === "2d" && (
          <ForceGraph2D
            ref={graphRef}
            graphData={forceData}
            backgroundColor={C.canvasBg}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            nodeVal="val"
            nodeLabel=""
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => { setSelectedNode(null); setSelectedLink(null); }}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            linkWidth={linkWidth}
            linkColor={linkColor}
            linkLabel={linkLabel}
            onLinkClick={handleLinkClick}
            linkDirectionalParticles={(link: any) => {
              const fl = focusLinksRef.current;
              const l = link as ForceLink;
              if (fl.size > 0 && !fl.has(l.id)) return 0;
              return 2;
            }}
            linkDirectionalParticleSpeed={0.003}
            linkDirectionalParticleWidth={3}
            linkDirectionalParticleColor={() => C.gold}
            linkCurvature={0.1}
            d3AlphaDecay={0.03}
            d3VelocityDecay={0.25}
            warmupTicks={80}
            cooldownTicks={150}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            enableNodeDrag={true}
            onEngineStop={() => {}}
          />
        )}
      </div>

      {/* Detail panel — node or link */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          facts={graphData.facts}
          onClose={() => setSelectedNode(null)}
        />
      )}
      {selectedLink && !selectedNode && (
        <LinkDetailPanel
          link={selectedLink}
          entities={graphData.entities}
          onClose={() => setSelectedLink(null)}
        />
      )}
    </div>
  );
}
