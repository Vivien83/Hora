import { useState, useMemo, useRef, useEffect } from "react";
import type { TranscriptMessage } from "./types";

const C = {
  bg: "#F2F0E9",
  glass: {
    background: "rgba(255,255,255,0.45)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: "20px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
  } as React.CSSProperties,
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textTertiary: "#94a3b8",
  gold: "#D4A853",
  accent: "#6366f1",
  border: "rgba(0,0,0,0.06)",
  userBg: "rgba(212,168,83,0.06)",
  serif: "'Playfair Display', Georgia, serif" as string,
  sans: "'DM Sans', sans-serif" as string,
  mono: "'JetBrains Mono', monospace" as string,
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
          fontFamily: C.mono,
          fontSize: "11px",
          color: C.gold,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {sessionId.slice(0, 8)}
      </span>
      {date && (
        <span style={{ fontSize: "11px", color: C.textTertiary, flexShrink: 0, fontFamily: C.sans }}>{date}</span>
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
        background: isUser ? C.userBg : "rgba(255,255,255,0.3)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* Role badge */}
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          flexShrink: 0,
          marginTop: "2px",
          background: isUser ? "rgba(212,168,83,0.15)" : "rgba(99,102,241,0.1)",
          color: isUser ? C.gold : C.accent,
          fontFamily: C.mono,
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
            color: isUser ? C.text : C.textSecondary,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: !expanded && isOverflow ? `${MSG_COLLAPSE_HEIGHT}px` : "none",
            overflow: "hidden",
            position: "relative",
            fontFamily: C.sans,
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
                background: isUser
                  ? "linear-gradient(transparent, rgba(252,248,240,0.95))"
                  : "linear-gradient(transparent, rgba(255,255,255,0.85))",
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
              borderRadius: "6px",
              color: C.accent,
              fontSize: "11px",
              cursor: "pointer",
              padding: "2px 8px",
              marginTop: "4px",
              fontFamily: C.sans,
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
          color: C.textTertiary,
          flexShrink: 0,
          marginTop: "4px",
          fontFamily: C.mono,
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

interface SessionInfo {
  id: string;
  date: string;
  messageCount: number;
}

export function ChatView({ messages }: ChatViewProps) {
  const [search, setSearch] = useState("");
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScrolled, setAutoScrolled] = useState(false);

  // Build session list (ordered by most recent first)
  const sessions = useMemo<SessionInfo[]>(() => {
    const map = new Map<string, { date: string; count: number }>();
    for (const m of messages) {
      const existing = map.get(m.sessionId);
      if (existing) {
        existing.count++;
      } else {
        map.set(m.sessionId, { date: m.timestamp, count: 1 });
      }
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, date: v.date, messageCount: v.count }))
      .reverse();
  }, [messages]);

  const filtered = useMemo(() => {
    let msgs = messages;
    if (activeSession) {
      msgs = msgs.filter((m) => m.sessionId === activeSession);
    }
    if (search.trim()) {
      msgs = msgs.filter((m) => matchesSearch(m, search.trim()));
    }
    return msgs;
  }, [messages, search, activeSession]);

  const sessionCount = sessions.length;

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
          ...C.glass,
          padding: "48px 24px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: "14px",
          fontFamily: C.sans,
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
      {/* Search + session tabs */}
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
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.8)",
            borderRadius: "12px",
            padding: "10px 14px",
            color: C.text,
            fontSize: "13px",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
            fontFamily: C.mono,
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          }}
        />

        {/* Session tabs */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            padding: "2px 0",
          }}
        >
          <button
            onClick={() => setActiveSession(null)}
            style={{
              flexShrink: 0,
              padding: "4px 10px",
              borderRadius: "8px",
              border: activeSession === null ? `1px solid ${C.gold}` : `1px solid ${C.border}`,
              background: activeSession === null ? "rgba(212,168,83,0.1)" : "rgba(255,255,255,0.4)",
              color: activeSession === null ? C.gold : C.textMuted,
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: C.mono,
              transition: "all 100ms",
            }}
          >
            Toutes ({sessionCount})
          </button>
          {sessions.map((s) => {
            const d = new Date(s.date);
            const label = isNaN(d.getTime()) ? s.id.slice(0, 8) : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + s.id.slice(0, 8);
            const isActive = activeSession === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSession(isActive ? null : s.id)}
                style={{
                  flexShrink: 0,
                  padding: "4px 10px",
                  borderRadius: "8px",
                  border: isActive ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  background: isActive ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.4)",
                  color: isActive ? C.accent : C.textTertiary,
                  fontSize: "11px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: C.mono,
                  transition: "all 100ms",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
                <span style={{ marginLeft: "4px", opacity: 0.6 }}>{s.messageCount}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "11px",
            color: C.textTertiary,
            padding: "0 4px",
            fontFamily: C.mono,
          }}
        >
          <span>{filtered.length} messages</span>
          {activeSession && (
            <span style={{ color: C.accent }}>session {activeSession.slice(0, 8)}</span>
          )}
          {search.trim() && (
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
          ...C.glass,
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
              color: C.textMuted,
              fontSize: "13px",
              fontFamily: C.sans,
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
