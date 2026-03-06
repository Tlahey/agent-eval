import { SortAsc, SortDesc } from "lucide-react";

interface SortButtonProps<T extends string> {
  field: T;
  label: string;
  current: T;
  dir: "asc" | "desc";
  onClick: (f: T) => void;
  className?: string;
}

export function SortButton<T extends string>({
  field,
  label,
  current,
  dir,
  onClick,
  className = "",
}: SortButtonProps<T>) {
  const active = current === field;
  const Icon = active && dir === "asc" ? SortAsc : SortDesc;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex flex-1 items-center justify-center gap-2 h-12 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest ${
        active
          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
          : "bg-surface-2 text-txt-muted hover:bg-surface-3 hover:text-txt-base"
      } ${className}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
