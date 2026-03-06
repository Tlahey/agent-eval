import { SortAsc, SortDesc } from "lucide-react";
import type { SortField, SortDir } from "../useRuns";

export function Select({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative group">
      {icon && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none group-focus-within:text-primary transition-colors">
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-12 appearance-none rounded-xl border bg-surface-2 pr-10 text-sm font-bold text-txt-base focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner ${
          icon ? "pl-11" : "pl-4"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-txt-muted/50">
        <SortDesc size={14} />
      </div>
    </div>
  );
}

export function SortButton({
  field,
  label,
  current,
  dir,
  onClick,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const active = current === field;
  const Icon = active && dir === "asc" ? SortAsc : SortDesc;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex flex-1 items-center justify-center gap-2 h-12 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest ${
        active
          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
          : "bg-surface-2 text-txt-muted hover:bg-surface-3 hover:text-txt-base"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
