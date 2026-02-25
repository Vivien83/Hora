import { useState, useMemo, useRef, useEffect } from "react";
import type { TranscriptMessage } from "./types";

const C = {
  bg: "#0A0A0B",
  card: "#18181b",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#14b8a6",
  userBg: "#14b8a610",
};

const MSG_COLLAPSE_HEIGHT = 500;

interface ChatViewProps {
  messages: TranscriptMessage[];
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatSessionDate(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SessionSeparator({ sessionId, date }: { sessionId: string; date: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px 0 8px",
      }}
    >
      <div style={{ flex: 1, height: "1px", background: C.border }} />
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "11px",
          color: C.accent,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {sessionId.slice(0, 8)}
      </span>
      {date && (
        <span style={{ fontSize: "11px", color: C.dim, flexShrink: 0 }}>{date}</span>
      )}
      <div style={{ flex: 1, height: "1px", background: C.border }} />
    </div>
  );
}

function MessageBubble({ msg }: { msg: TranscriptMessage }) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflow(contentRef.current.scrollHeight > MSG_COLLAPSE_HEIGHT);
    }
  }, [msg.content]);

  const isUser = msg.role === "user";

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        padding: "8px 16px",
        background: isUser ? C.userBg : "transparent",
        borderBottom: `1px solid ${C.border}20`,
      }}
    >
      {/* Role badge */}
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          flexShrink: 0,
          marginTop: "2px",
          background: isUser ? `${C.accent}20` : `${C.dim}20`,
          color: isUser ? C.accent : C.dim,
        }}
      >
        {isUser ? "U" : "A"}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          ref={contentRef}
          style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: isUser ? C.text : C.muted,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: !expanded && isOverflow ? `${MSG_COLLAPSE_HEIGHT}px` : "none",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {msg.content}
          {!expanded && isOverflow && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "60px",
                background: `linear-gradient(transparent, ${isUser ? "#0d1a17" : C.bg})`,
              }}
            />
          )}
        </div>
        {isOverflow && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: `1px solid ${C.border}`,
              borderRadius: "4px",
              color: C.accent,
              fontSize: "11px",
              cursor: "pointer",
              padding: "2px 8px",
              marginTop: "4px",
            }}
          >
            {expanded ? "Reduire" : "Voir tout"}
          </button>
        )}
      </div>

      {/* Timestamp */}
      <span
        style={{
          fontSize: "10px",
          color: C.dim,
          flexShrink: 0,
          marginTop: "4px",
          fontFamily: "monospace",
        }}
      >
        {formatTime(msg.timestamp)}
      </span>
    </div>
  );
}

function matchesSearch(msg: TranscriptMessage, query: string): boolean {
  const q = query.toLowerCase();
  return (
    msg.content.toLowerCase().includes(q) ||
    msg.sessionId.toLowerCase().includes(q) ||
    msg.role.includes(q)
  );
}

export function ChatView({ messages }: ChatViewProps) {
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScrolled, setAutoScrolled] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    return messages.filter((m) => matchesSearch(m, search.trim()));
  }, [messages, search]);

  // Count sessions
  const sessionCount = useMemo(() => {
    const sids = new Set(filtered.map((m) => m.sessionId));
    return sids.size;
  }, [filtered]);

  // Auto-scroll to bottom on first load
  useEffect(() => {
    if (!autoScrolled && filtered.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView();
      setAutoScrolled(true);
    }
  }, [filtered.length, autoScrolled]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "48px 24px",
          textAlign: "center",
          color: C.dim,
          fontSize: "14px",
        }}
      >
        Aucun transcript trouve. Les fichiers JSONL de sessions Claude Code seront lus
        depuis ~/.claude/projects/.
      </div>
    );
  }

  // Build list with session separators
  let lastSessionId = "";
  const items: Array<
    | { kind: "separator"; sessionId: string; date: string; key: string }
    | { kind: "message"; msg: TranscriptMessage; key: string }
  > = [];

  for (let i = 0; i < filtered.length; i++) {
    const msg = filtered[i];
    if (msg.sessionId !== lastSessionId) {
      items.push({
        kind: "separator",
        sessionId: msg.sessionId,
        date: formatSessionDate(msg.timestamp),
        key: `sep-${msg.sessionId}-${i}`,
      });
      lastSessionId = msg.sessionId;
    }
    items.push({
      kind: "message",
      msg,
      key: `msg-${msg.timestamp}-${i}`,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0px", height: "100%" }}>
      {/* Search + stats bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: C.bg,
          paddingBottom: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans les transcripts..."
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: "6px",
            padding: "10px 14px",
            color: C.text,
            fontSize: "13px",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "monospace",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "11px",
            color: C.dim,
            padding: "0 4px",
          }}
        >
          <span>{filtered.length} messages</span>
          <span>{sessionCount} sessions</span>
          {search.trim() && filtered.length !== messages.length && (
            <span style={{ color: C.accent }}>
              {filtered.length} resultat{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          overflow: "auto",
          flex: 1,
        }}
      >
        {items.map((item) =>
          item.kind === "separator" ? (
            <SessionSeparator
              key={item.key}
              sessionId={item.sessionId}
              date={item.date}
            />
          ) : (
            <MessageBubble key={item.key} msg={item.msg} />
          ),
        )}

        {search.trim() && filtered.length === 0 && (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: C.dim,
              fontSize: "13px",
            }}
          >
            Aucun resultat pour "{search}"
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
