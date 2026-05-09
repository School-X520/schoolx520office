export function EmojiBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <span
      className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-gold-soft text-xl shadow-sm"
      role="img"
      aria-label={label}
    >
      {icon}
    </span>
  );
}
