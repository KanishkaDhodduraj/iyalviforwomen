export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <span>IYALVI</span>
      <small>Everyday, always elegant</small>
    </span>
  );
}
