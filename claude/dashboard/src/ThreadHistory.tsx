import { useState, useMemo } from "react";
import type { ThreadEntry } from "./types";

const sans = "'DM Sans', sans-serif";
const mono = "'JetBrains Mono', monospace";

const glass = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
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
    <div style={{ padding: "8px 16px", fontSize: "12px", lineHeight: 1.5, fontFamily: sans }}>
      {/* User */}
      <div style={{ display: "flex", gap: "6px" }}>
        <span style={{ color: "#D4A853", fontWeight: 700, fontSize: "10px", flexShrink: 0, marginTop: "2px", fontFamily: mono }}>U</span>
        <span
          style={{
            color: "#0f172a",
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
        <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: "10px", flexShrink: 0, marginTop: "2px", fontFamily: mono }}>A</span>
        <span
          style={{
            color: "#64748b",
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
        <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: mono }}>{formatTime(entry.ts)}</span>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", color: "#D4A853", fontSize: "10px", cursor: "pointer", padding: 0, fontFamily: sans }}
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
    <div style={{ ...glass }}>
      {/* Session header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          fontSize: "11px",
          fontFamily: sans,
        }}
      >
        <span style={{ fontFamily: mono, color: "#D4A853", fontWeight: 600 }}>
          {group.sid.slice(0, 8)}
        </span>
        {group.sessionName && (
          <span style={{ color: "#0f172a", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
            {group.sessionName}
          </span>
        )}
        <span style={{ color: "#94a3b8", marginLeft: "auto", flexShrink: 0 }}>{group.date}</span>
        {group.sentiment !== undefined && (
          <span style={{ color: SENTIMENT_COLORS[group.sentiment] ?? "#94a3b8", fontWeight: 600, fontSize: "10px", fontFamily: mono }}>
            {group.sentiment}/5
          </span>
        )}
        <span style={{ color: "#94a3b8", flexShrink: 0 }}>{group.entries.length}msg</span>
      </div>

      {/* All entries — no limit */}
      {group.entries.map((entry, i) => (
        <div
          key={`${entry.ts}-${i}`}
          style={{ borderBottom: i < group.entries.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}
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
          ...glass,
          padding: "24px",
          color: "#64748b",
          fontSize: "14px",
          fontFamily: sans,
        }}
      >
        Aucun echange enregistre.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Search bar */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher (message, session, date...)"
        style={{
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: "12px",
          padding: "10px 14px",
          color: "#0f172a",
          fontSize: "13px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          fontFamily: sans,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}
      />

      {/* Stats */}
      <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: "#94a3b8", padding: "0 4px", flexWrap: "wrap", fontFamily: mono }}>
        <span>{reversed.length} echanges</span>
        <span>{groupBySession(reversed).length} sessions</span>
        {dateRange && <span>{dateRange}</span>}
        {search.trim() && filtered.length !== reversed.length && (
          <span style={{ color: "#D4A853" }}>{filtered.length} resultat{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* All groups — no limit */}
      {groups.map((group) => (
        <GroupCard key={`${group.sid}-${group.entries[0]?.ts}`} group={group} />
      ))}

      {search.trim() && groups.length === 0 && (
        <div
          style={{
            ...glass,
            padding: "16px",
            color: "#64748b",
            fontSize: "12px",
            textAlign: "center",
            fontFamily: sans,
          }}
        >
          Aucun resultat pour "{search}"
        </div>
      )}
    </div>
  );
}
