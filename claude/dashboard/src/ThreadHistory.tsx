import { useState, useMemo } from "react";
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

function matchesSearch(entry: ThreadEntry, query: string): boolean {
  const q = query.toLowerCase();
  if (entry.u.toLowerCase().includes(q)) return true;
  if (entry.a.toLowerCase().includes(q)) return true;
  if (entry.sessionName?.toLowerCase().includes(q)) return true;
  if (entry.ts.toLowerCase().includes(q)) return true;
  if (entry.sid.toLowerCase().includes(q)) return true;
  return false;
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

      {/* All entries — no limit */}
      {group.entries.map((entry, i) => (
        <div
          key={`${entry.ts}-${i}`}
          style={{ borderBottom: i < group.entries.length - 1 ? "1px solid #1f1f22" : "none" }}
        >
          <EntryRow entry={entry} />
        </div>
      ))}
    </div>
  );
}

function computeDateRange(entries: ThreadEntry[]): string {
  if (entries.length === 0) return "";
  const dates = entries
    .map((e) => new Date(e.ts))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const first = fmt(dates[0]);
  const last = fmt(dates[dates.length - 1]);
  if (first === last) return first;
  return `${first} — ${last}`;
}

export function ThreadHistory({ thread }: ThreadHistoryProps) {
  const [search, setSearch] = useState("");
  const reversed = thread.slice().reverse();

  const filtered = useMemo(() => {
    if (!search.trim()) return reversed;
    return reversed.filter((entry) => matchesSearch(entry, search.trim()));
  }, [reversed, search]);

  const groups = useMemo(() => groupBySession(filtered), [filtered]);
  const dateRange = useMemo(() => computeDateRange(reversed), [reversed]);

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
      {/* Search bar */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher (message, session, date...)"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "6px",
          padding: "8px 12px",
          color: C.text,
          fontSize: "12px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />

      {/* Stats */}
      <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: C.dim, padding: "0 4px", flexWrap: "wrap" }}>
        <span>{reversed.length} echanges</span>
        <span>{groupBySession(reversed).length} sessions</span>
        {dateRange && <span>{dateRange}</span>}
        {search.trim() && filtered.length !== reversed.length && (
          <span style={{ color: C.accent }}>{filtered.length} resultat{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* All groups — no limit */}
      {groups.map((group) => (
        <GroupCard key={`${group.sid}-${group.entries[0]?.ts}`} group={group} />
      ))}

      {search.trim() && groups.length === 0 && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            padding: "16px",
            color: C.dim,
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          Aucun resultat pour "{search}"
        </div>
      )}
    </div>
  );
}
