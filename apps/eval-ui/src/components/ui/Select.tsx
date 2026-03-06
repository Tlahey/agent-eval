import { ChevronDown } from "lucide-react";

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
  className?: string;
}

export function Select({ value, onChange, options, icon, className = "" }: SelectProps) {
  return (
    <div className={`relative group ${className}`}>
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
        <ChevronDown size={14} />
      </div>
    </div>
  );
}
