interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "primary" | "ok" | "err" | "warn";
  sub?: string;
  trend?: string;
}

export function KPICard({ icon, label, value, accent, sub, trend }: KPICardProps) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    ok: { bg: "bg-ok/10", text: "text-ok", border: "border-ok/20" },
    err: { bg: "bg-err/10", text: "text-err", border: "border-err/20" },
    warn: { bg: "bg-warn/10", text: "text-warn", border: "border-warn/20" },
  };
  const c = colorMap[accent];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${c.border} bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-lg shadow-black/5`}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${c.bg} ${c.text} shadow-inner`}>{icon}</div>
        {trend && (
          <span className="text-[10px] font-black text-ok uppercase tracking-tighter">{trend}</span>
        )}
      </div>
      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-txt-muted mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-2xl sm:text-3xl font-black text-txt-base tracking-tight">{value}</p>
        </div>
        {sub && <p className="mt-1 text-xs font-bold text-txt-muted/70">{sub}</p>}
      </div>
    </div>
  );
}
