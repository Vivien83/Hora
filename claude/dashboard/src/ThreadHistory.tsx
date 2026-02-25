import { useState } from "react";
import type { ThreadEntry } from "./types";

const C = {
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
  userBg: "#14b8a610",
  assistBg: "#27272a80",
};

const SENTIMENT_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "1", color: "#ef4444" },
  2: { label: "2", color: "#f97316" },
  3: { label: "3", color: "#a1a1aa" },
  4: { label: "4", color: "#22c55e" },
  5: { label: "5", color: "#14b8a6" },
};

interface ThreadHistoryProps {
  thread: ThreadEntry[];
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

function formatDate(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Group consecutive entries by session ID */
function groupBySession(entries: ThreadEntry[]): { sid: string; sessionName?: string; sentiment?: number; date: string; entries: ThreadEntry[] }[] {
  const groups: { sid: string; sessionName?: string; sentiment?: number; date: string; entries: ThreadEntry[] }[] = [];

  for (const entry of entries) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.sid === entry.sid) {
      lastGroup.entries.push(entry);
      // Update sentiment/name if available on later entries
      if (entry.sessionName) lastGroup.sessionName = entry.sessionName;
      if (entry.sentiment !== undefined) lastGroup.sentiment = entry.sentiment;
    } else {
      groups.push({
        sid: entry.sid,
        sessionName: entry.sessionName,
        sentiment: entry.sentiment,
        date: formatDate(entry.ts),
        entries: [entry],
      });
    }
  }

  return groups;
}

function ExpandableText({ text, maxLines, color, fontSize }: { text: string; maxLines: number; color: string; fontSize: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 120;

  return (
    <div>
      <div
        style={{
          fontSize,
          color,
          lineHeight: 1.5,
          overflow: expanded ? "visible" : "hidden",
          textOverflow: expanded ? "unset" : "ellipsis",
          display: expanded ? "block" : "-webkit-box",
          WebkitLineClamp: expanded ? undefined : maxLines,
          WebkitBoxOrient: expanded ? undefined : ("vertical" as const),
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "none",
            color: C.accent,
            fontSize: "11px",
            cursor: "pointer",
            padding: "2px 0",
            marginTop: "2px",
          }}
        >
          {expanded ? "Reduire" : "Voir plus"}
        </button>
      )}
    </div>
  );
}

export function ThreadHistory({ thread }: ThreadHistoryProps) {
  const [showAll, setShowAll] = useState(false);
  const recent = thread.slice().reverse();
  const groups = groupBySession(recent);
  const displayGroups = showAll ? groups : groups.slice(0, 8);

  if (recent.length === 0) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "24px",
          color: C.dim,
          fontSize: "14px",
        }}
      >
        Aucun echange enregistre.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          fontSize: "11px",
          color: C.dim,
          padding: "0 4px",
        }}
      >
        <span>{recent.length} echanges</span>
        <span>{groups.length} sessions</span>
      </div>

      {displayGroups.map((group) => (
        <div
          key={`${group.sid}-${group.entries[0]?.ts}`}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Session header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: "11px",
            }}
          >
            <span style={{ fontFamily: "monospace", color: C.accent, fontWeight: 600 }}>
              {group.sid.slice(0, 8)}
            </span>
            {group.sessionName && (
              <span style={{ color: C.text, fontWeight: 500 }}>
                {group.sessionName}
              </span>
            )}
            <span style={{ color: C.dim, marginLeft: "auto" }}>
              {group.date}
            </span>
            {group.sentiment !== undefined && SENTIMENT_LABELS[group.sentiment] && (
              <span
                style={{
                  color: SENTIMENT_LABELS[group.sentiment].color,
                  fontWeight: 600,
                  fontSize: "10px",
                }}
              >
                {SENTIMENT_LABELS[group.sentiment].label}/5
              </span>
            )}
            <span style={{ color: C.dim }}>
              {group.entries.length} msg
            </span>
          </div>

          {/* Entries */}
          {group.entries.map((entry, i) => (
            <div
              key={`${entry.ts}-${i}`}
              style={{
                padding: "8px 12px",
                borderBottom: i < group.entries.length - 1 ? `1px solid #1f1f22` : "none",
              }}
            >
              {/* User message */}
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: C.accent,
                    background: C.userBg,
                    borderRadius: "3px",
                    padding: "1px 4px",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  U
                </span>
                <ExpandableText text={entry.u} maxLines={3} color={C.text} fontSize="13px" />
              </div>

              {/* Assistant response */}
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "4px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: C.dim,
                    background: C.assistBg,
                    borderRadius: "3px",
                    padding: "1px 4px",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  A
                </span>
                <ExpandableText text={entry.a} maxLines={3} color={C.muted} fontSize="12px" />
              </div>

              {/* Timestamp */}
              <div style={{ paddingLeft: "28px", marginTop: "4px", fontSize: "10px", color: C.dim }}>
                {formatTs(entry.ts)}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Show more / less */}
      {groups.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "8px 16px",
            color: C.accent,
            fontSize: "12px",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {showAll ? "Afficher moins" : `Voir les ${groups.length - 8} sessions precedentes`}
        </button>
      )}
    </div>
  );
}
