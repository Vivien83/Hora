interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.7)",
        borderRadius: "20px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          color: "#94a3b8",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "30px",
          fontWeight: 700,
          lineHeight: 1.1,
          color: accent ? "#D4A853" : "#0f172a",
          letterSpacing: "-0.02em",
          fontFamily: "'Playfair Display', Georgia, serif",
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          style={{
            fontSize: "12px",
            color: "#64748b",
            marginTop: "2px",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
