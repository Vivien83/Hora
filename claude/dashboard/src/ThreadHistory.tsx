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

const SENTIMENT_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#a1a1aa",
  4: "#22c55e",
  5: "#14b8a6",
};

const ENTRIES_PER_GROUP = 2;

interface ThreadHistoryProps {
  thread: ThreadEntry[];
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

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

interface SessionGroup {
  sid: string;
  sessionName?: string;
  sentiment?: number;
  date: string;
  entries: ThreadEntry[];
}

function groupBySession(entries: ThreadEntry[]): SessionGroup[] {
  const groups: SessionGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.sid === entry.sid) {
      last.entries.push(entry);
      if (entry.sessionName) last.sessionName = entry.sessionName;
      if (entry.sentiment !== undefined) last.sentiment = entry.sentiment;
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

function EntryRow({ entry }: { entry: ThreadEntry }) {
  const [expanded, setExpanded] = useState(false);
  const uLong = entry.u.length > 100;
  const aLong = entry.a.length > 100;
  const hasMore = uLong || aLong;

  return (
    <div style={{ padding: "6px 12px", fontSize: "12px", lineHeight: 1.5 }}>
      {/* User */}
      <div style={{ display: "flex", gap: "6px" }}>
        <span style={{ color: C.accent, fontWeight: 700, fontSize: "10px", flexShrink: 0, marginTop: "2px" }}>U</span>
        <span
          style={{
            color: C.text,
            whiteSpace: expanded ? "pre-wrap" : "nowrap",
            overflow: expanded ? "visible" : "hidden",
            textOverflow: "ellipsis",
            wordBreak: "break-word",
          }}
        >
          {entry.u}
        </span>
      </div>
      {/* Assistant */}
      <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
        <span style={{ color: C.dim, fontWeight: 700, fontSize: "10px", flexShrink: 0, marginTop: "2px" }}>A</span>
        <span
          style={{
            color: C.muted,
            whiteSpace: expanded ? "pre-wrap" : "nowrap",
            overflow: expanded ? "visible" : "hidden",
            textOverflow: "ellipsis",
            wordBreak: "break-word",
          }}
        >
          {entry.a}
        </span>
      </div>
      {/* Time + expand */}
      <div style={{ display: "flex", gap: "8px", marginTop: "2px", paddingLeft: "16px" }}>
        <span style={{ fontSize: "10px", color: C.dim }}>{formatTime(entry.ts)}</span>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", color: C.accent, fontSize: "10px", cursor: "pointer", padding: 0 }}
          >
            {expanded ? "reduire" : "voir plus"}
          </button>
        )}
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: SessionGroup }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? group.entries : group.entries.slice(0, ENTRIES_PER_GROUP);
  const hidden = group.entries.length - ENTRIES_PER_GROUP;

  return (
    <div
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
          padding: "6px 12px",
          borderBottom: `1px solid ${C.border}`,
          fontSize: "11px",
        }}
      >
        <span style={{ fontFamily: "monospace", color: C.accent, fontWeight: 600 }}>
          {group.sid.slice(0, 8)}
        </span>
        {group.sessionName && (
          <span style={{ color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
            {group.sessionName}
          </span>
        )}
        <span style={{ color: C.dim, marginLeft: "auto", flexShrink: 0 }}>{group.date}</span>
        {group.sentiment !== undefined && (
          <span style={{ color: SENTIMENT_COLORS[group.sentiment] ?? C.dim, fontWeight: 600, fontSize: "10px" }}>
            {group.sentiment}/5
          </span>
        )}
        <span style={{ color: C.dim, flexShrink: 0 }}>{group.entries.length}msg</span>
      </div>

      {/* Entries */}
      {visible.map((entry, i) => (
        <div
          key={`${entry.ts}-${i}`}
          style={{ borderBottom: i < visible.length - 1 ? "1px solid #1f1f22" : "none" }}
        >
          <EntryRow entry={entry} />
        </div>
      ))}

      {/* Show more entries in this group */}
      {hidden > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            borderTop: "1px solid #1f1f22",
            color: C.dim,
            fontSize: "11px",
            padding: "5px 12px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          + {hidden} echange{hidden > 1 ? "s" : ""} de plus
        </button>
      )}
    </div>
  );
}

export function ThreadHistory({ thread }: ThreadHistoryProps) {
  const [showOlder, setShowOlder] = useState(false);
  const reversed = thread.slice().reverse();
  const groups = groupBySession(reversed);
  const displayGroups = showOlder ? groups : groups.slice(0, 8);

  if (reversed.length === 0) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: C.dim, padding: "0 4px" }}>
        <span>{reversed.length} echanges</span>
        <span>{groups.length} sessions</span>
      </div>

      {displayGroups.map((group) => (
        <GroupCard key={`${group.sid}-${group.entries[0]?.ts}`} group={group} />
      ))}

      {groups.length > 8 && (
        <button
          onClick={() => setShowOlder(!showOlder)}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "6px 12px",
            color: C.accent,
            fontSize: "11px",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {showOlder ? "Reduire" : `+ ${groups.length - 8} sessions precedentes`}
        </button>
      )}
    </div>
  );
}
