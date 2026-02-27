/**
 * HORA — Neural Memory Map
 *
 * Cartographie visuelle de la memoire en reseau de neurones.
 * Chaque noeud = une zone memoire. Les aretes = flux de donnees.
 * Les particules animent la communication inter-neuronale en temps reel.
 *
 * Inspire du cerveau humain:
 * - T1 (memoire de travail) = Working Memory (cyan, ephemere)
 * - T2 (memoire episodique) = Episodic Memory (bleu, consolidable)
 * - T3 (memoire semantique) = Semantic Memory (violet, permanent)
 *
 * Metaphores visuelles:
 * - Taille noeud = quantite d'items
 * - Glow = activite recente (freshness)
 * - Particules sur aretes = flux de donnees actifs
 * - Opacite = sante (decay si non-accede)
 */

import { useRef, useCallback, useMemo, useEffect, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { forceRadial, forceCenter } from "d3-force-3d";
import type { DashboardData, MemoryHealth } from "./types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface NeuronNode {
  id: string;
  label: string;
  tier: 1 | 2 | 3;
  items: number;
  sizeKb: number;
  color: string;
  glowColor: string;
  freshness: number; // 0-1, higher = more recently active
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface Synapse {
  source: string;
  target: string;
  strength: number; // 0-1, controls thickness
  particles: number; // number of animated particles
  color: string;
}

interface NeuralMemoryMapProps {
  data: DashboardData;
  health: MemoryHealth;
  width?: number;
  height?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_COLORS = {
  1: { node: "#06b6d4", glow: "#22d3ee", bg: "rgba(6, 182, 212, 0.15)" },  // Cyan
  2: { node: "#3b82f6", glow: "#60a5fa", bg: "rgba(59, 130, 246, 0.12)" },  // Blue
  3: { node: "#8b5cf6", glow: "#a78bfa", bg: "rgba(139, 92, 246, 0.12)" },  // Purple
};

const EDGE_COLOR = "rgba(255, 255, 255, 0.06)";
const PARTICLE_COLOR = "#22d3ee";

// ─── Graph Data Builder ─────────────────────────────────────────────────────

function buildGraphData(data: DashboardData, health: MemoryHealth): {
  nodes: NeuronNode[];
  links: Synapse[];
} {
  const now = Date.now();

  // Freshness helper: how recently was this data accessed/modified?
  const freshness = (lastTs: string | null | undefined, maxAgeHours: number = 24): number => {
    if (!lastTs) return 0.2;
    const age = (now - new Date(lastTs).getTime()) / (1000 * 60 * 60);
    return Math.max(0.15, Math.min(1, 1 - age / maxAgeHours));
  };

  // Latest timestamps from various sources
  const latestSentiment = data.sentimentHistory.length > 0
    ? data.sentimentHistory[data.sentimentHistory.length - 1].ts
    : null;
  const latestSession = data.sessions.length > 0 ? data.sessions[0].date : null;
  const latestThread = data.thread.length > 0 ? data.thread[data.thread.length - 1].ts : null;
  const latestFailure = data.failures.length > 0 ? data.failures[0].date : null;

  const nodes: NeuronNode[] = [
    // T1 — Working Memory (sensory + short-term)
    {
      id: "thread",
      label: "Thread",
      tier: 1,
      items: data.thread.length,
      sizeKb: 0,
      color: TIER_COLORS[1].node,
      glowColor: TIER_COLORS[1].glow,
      freshness: freshness(latestThread, 2),
    },
    {
      id: "state",
      label: "Etat",
      tier: 1,
      items: health.t1.items,
      sizeKb: health.t1.sizeKb,
      color: TIER_COLORS[1].node,
      glowColor: TIER_COLORS[1].glow,
      freshness: 0.8, // State is always "warm"
    },

    // T2 — Episodic Memory
    {
      id: "sessions",
      label: "Sessions",
      tier: 2,
      items: data.sessions.length,
      sizeKb: 0,
      color: TIER_COLORS[2].node,
      glowColor: TIER_COLORS[2].glow,
      freshness: freshness(latestSession, 48),
    },
    {
      id: "sentiment",
      label: "Sentiment",
      tier: 2,
      items: data.sentimentHistory.length,
      sizeKb: 0,
      color: TIER_COLORS[2].node,
      glowColor: TIER_COLORS[2].glow,
      freshness: freshness(latestSentiment, 24),
    },
    {
      id: "failures",
      label: "Erreurs",
      tier: 2,
      items: data.failures.length,
      sizeKb: 0,
      color: TIER_COLORS[2].node,
      glowColor: TIER_COLORS[2].glow,
      freshness: freshness(latestFailure, 72),
    },
    {
      id: "tools",
      label: "Outils",
      tier: 2,
      items: Object.keys(data.toolUsage).length,
      sizeKb: 0,
      color: TIER_COLORS[2].node,
      glowColor: TIER_COLORS[2].glow,
      freshness: freshness(data.generatedAt, 24),
    },

    // T3 — Semantic Memory (consolidated)
    {
      id: "profile",
      label: "Profil",
      tier: 3,
      items: health.t3.items > 0 ? Math.max(4, health.t3.items) : 4,
      sizeKb: health.t3.sizeKb,
      color: TIER_COLORS[3].node,
      glowColor: TIER_COLORS[3].glow,
      freshness: 0.6, // Profile is stable, moderate glow
    },
    {
      id: "insights",
      label: "Insights",
      tier: 3,
      items: Math.max(1, health.t3.items - 4), // Subtract profile files
      sizeKb: 0,
      color: TIER_COLORS[3].node,
      glowColor: TIER_COLORS[3].glow,
      freshness: health.lastGc ? freshness(health.lastGc, 48) : 0.3,
    },
  ];

  // Synapses — data flow connections
  // Strength based on actual data volume, particles for recent activity
  const hasRecentActivity = (ts: string | null | undefined) => {
    if (!ts) return false;
    return (now - new Date(ts).getTime()) < 24 * 60 * 60 * 1000;
  };

  const links: Synapse[] = [
    // T1 → T1 : working memory loop
    {
      source: "state",
      target: "thread",
      strength: 0.5,
      particles: hasRecentActivity(latestThread) ? 3 : 1,
      color: EDGE_COLOR,
    },

    // T1 → T2 : encoding (perception → episodic)
    {
      source: "thread",
      target: "sessions",
      strength: 0.6,
      particles: hasRecentActivity(latestSession) ? 3 : 1,
      color: EDGE_COLOR,
    },
    {
      source: "thread",
      target: "sentiment",
      strength: 0.3,
      particles: hasRecentActivity(latestSentiment) ? 2 : 0,
      color: EDGE_COLOR,
    },

    // T2 → T2 : emotional tagging (amygdala)
    {
      source: "sentiment",
      target: "sessions",
      strength: 0.4,
      particles: 1,
      color: EDGE_COLOR,
    },
    {
      source: "sentiment",
      target: "failures",
      strength: 0.3,
      particles: data.failures.length > 5 ? 2 : 0,
      color: EDGE_COLOR,
    },

    // T2 → T3 : consolidation (hippocampus → neocortex)
    {
      source: "sessions",
      target: "profile",
      strength: 0.7,
      particles: 2,
      color: EDGE_COLOR,
    },
    {
      source: "failures",
      target: "insights",
      strength: data.failures.length > 3 ? 0.8 : 0.3,
      particles: data.failures.length > 3 ? 3 : 1,
      color: EDGE_COLOR,
    },
    {
      source: "sentiment",
      target: "insights",
      strength: 0.4,
      particles: 1,
      color: EDGE_COLOR,
    },
    {
      source: "tools",
      target: "insights",
      strength: 0.3,
      particles: 1,
      color: EDGE_COLOR,
    },

    // T3 → T1 : retrieval (semantic → working memory)
    {
      source: "profile",
      target: "state",
      strength: 0.5,
      particles: 2,
      color: EDGE_COLOR,
    },
    {
      source: "insights",
      target: "state",
      strength: 0.4,
      particles: health.t3.items > 2 ? 2 : 0,
      color: EDGE_COLOR,
    },

    // T2 procedural: tool usage → state
    {
      source: "tools",
      target: "state",
      strength: 0.3,
      particles: 1,
      color: EDGE_COLOR,
    },
  ];

  return { nodes, links };
}

// ─── Canvas Renderers ───────────────────────────────────────────────────────

function drawNeuronNode(node: NeuronNode, ctx: CanvasRenderingContext2D, globalScale: number) {
  const x = node.x || 0;
  const y = node.y || 0;

  // Base radius: proportional to items, clamped
  const baseRadius = Math.max(6, Math.min(22, 4 + Math.sqrt(node.items) * 2));

  // Breathing animation: subtle size oscillation based on freshness
  const breathe = 1 + Math.sin(Date.now() / (2000 / Math.max(0.3, node.freshness))) * 0.04 * node.freshness;
  const radius = baseRadius * breathe;

  // Outer glow (freshness-dependent)
  const glowRadius = radius * (1.5 + node.freshness * 0.8);
  const gradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, glowRadius);
  gradient.addColorStop(0, hexToRgba(node.glowColor, 0.25 * node.freshness));
  gradient.addColorStop(0.5, hexToRgba(node.glowColor, 0.08 * node.freshness));
  gradient.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Core neuron body
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  const coreGrad = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.2, 0, x, y, radius);
  coreGrad.addColorStop(0, lighten(node.color, 0.3));
  coreGrad.addColorStop(1, node.color);
  ctx.fillStyle = coreGrad;
  ctx.globalAlpha = 0.5 + node.freshness * 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Bright nucleus
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.3, 0, 2 * Math.PI);
  ctx.fillStyle = hexToRgba(node.glowColor, 0.6);
  ctx.fill();

  // Label (only when zoomed enough)
  if (globalScale > 0.6) {
    const fontSize = Math.max(9, 11 / globalScale);
    ctx.font = `500 ${fontSize}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = hexToRgba("#e4e4e7", 0.7 + node.freshness * 0.3);
    ctx.fillText(node.label, x, y + radius + 4);

    // Item count
    if (node.items > 0) {
      const countFontSize = Math.max(7, 9 / globalScale);
      ctx.font = `400 ${countFontSize}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = hexToRgba("#a1a1aa", 0.5);
      ctx.fillText(`${node.items}`, x, y + radius + 4 + fontSize + 1);
    }
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function NeuralMemoryMap({ data, health, width, height }: NeuralMemoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ w: width || 800, h: height || 500 });

  // Responsive sizing
  useEffect(() => {
    if (width && height) {
      setDimensions({ w: width, h: height });
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          setDimensions({ w, h: Math.max(400, h) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  // Build graph data
  const graphData = useMemo(() => buildGraphData(data, health), [data, health]);

  // Custom node renderer
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawNeuronNode(node as NeuronNode, ctx, globalScale);
    },
    [],
  );

  // Node size for collision/pointer
  const nodeRelSize = useCallback((node: any) => {
    const n = node as NeuronNode;
    return Math.max(8, 4 + Math.sqrt(n.items) * 2) * 1.5;
  }, []);

  // Link width based on strength
  const linkWidth = useCallback((link: any) => {
    return 0.5 + (link as Synapse).strength * 2;
  }, []);

  // Link color with very subtle visibility
  const linkColor = useCallback((link: any) => {
    const s = link as Synapse;
    return hexToRgba("#ffffff", 0.03 + s.strength * 0.05);
  }, []);

  // Particle color per link — inherit from target node tier
  const particleColor = useCallback(() => PARTICLE_COLOR, []);

  // Cool down after initial layout settles
  useEffect(() => {
    const timer = setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.d3Force("charge")?.strength(-120);
        graphRef.current.d3Force("link")?.distance(80);
        // Pull isolated nodes (no links) closer to center with radial force
        const linkedIds = new Set<string>();
        graphData.links.forEach((l: any) => {
          linkedIds.add(typeof l.source === "object" ? l.source.id : l.source);
          linkedIds.add(typeof l.target === "object" ? l.target.id : l.target);
        });
        graphRef.current.d3Force(
          "radial",
          forceRadial(50, 0, 0).strength((node: any) =>
            linkedIds.has(node.id) ? 0 : 0.3
          ),
        );
        // Strengthen center force so nothing drifts too far
        graphRef.current.d3Force("center", forceCenter(0, 0).strength(0.05));
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [graphData]);

  // Tier legend
  const tiers = [
    { label: "T1 Court terme", color: TIER_COLORS[1].node, desc: "Thread, Etat" },
    { label: "T2 Moyen terme", color: TIER_COLORS[2].node, desc: "Sessions, Sentiment, Erreurs, Outils" },
    { label: "T3 Long terme", color: TIER_COLORS[3].node, desc: "Profil, Insights" },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: height || "500px",
        background: "#0A0A0B",
        borderRadius: "8px",
        border: "1px solid #27272a",
        overflow: "hidden",
      }}
    >
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.w}
        height={dimensions.h}
        backgroundColor="#0A0A0B"
        nodeCanvasObject={nodeCanvasObject}
        nodeVal={nodeRelSize}
        nodeLabel={(node: any) => {
          const n = node as NeuronNode;
          return `${n.label}: ${n.items} items (T${n.tier})`;
        }}
        linkWidth={linkWidth}
        linkColor={linkColor}
        linkDirectionalParticles={(link: any) => (link as Synapse).particles}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleColor={particleColor}
        linkCurvature={0.15}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
      />

      {/* Legend overlay */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          display: "flex",
          gap: "16px",
          padding: "8px 12px",
          background: "rgba(10, 10, 11, 0.85)",
          borderRadius: "6px",
          border: "1px solid #27272a",
        }}
      >
        {tiers.map((t) => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: t.color,
                boxShadow: `0 0 6px ${t.color}`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "10px", color: "#a1a1aa" }}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "16px",
          fontSize: "13px",
          fontWeight: 600,
          color: "#e4e4e7",
          letterSpacing: "-0.01em",
        }}
      >
        Neural Memory Map
      </div>

      {/* GC status */}
      {health.lastGc && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "16px",
            fontSize: "10px",
            color: "#52525b",
          }}
        >
          Consolidation: {health.lastGc.slice(0, 10)}
        </div>
      )}
    </div>
  );
}
