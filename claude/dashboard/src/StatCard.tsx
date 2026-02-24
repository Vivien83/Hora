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
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <span style={{ fontSize: "12px", color: "#71717a", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "30px",
          fontWeight: 700,
          lineHeight: 1.1,
          color: accent ? "#14b8a6" : "#e4e4e7",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: "12px", color: "#52525b", marginTop: "2px" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
