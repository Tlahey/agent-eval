import { useState } from "react";
import { Calendar, ChevronDown, CheckCircle2 } from "lucide-react";
import { TIME_RANGES, type TimeRange } from "../useOverview";

interface OverviewHeaderProps {
  timeRange: TimeRange;
  setTimeRange: (v: TimeRange) => void;
}

export function OverviewHeader({ timeRange, setTimeRange }: OverviewHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-txt-base tracking-tight mb-1">Dashboard</h1>
        <p className="text-sm text-txt-muted font-medium">
          Evaluation performance & insights overview
        </p>
      </div>
      <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
    </div>
  );
}

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = TIME_RANGES.find((r) => r.value === value)?.label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 rounded-xl border bg-surface-2 px-4 py-2.5 text-sm font-bold text-txt-base transition-all hover:border-primary/50 hover:shadow-lg shadow-inner"
      >
        <Calendar size={16} className="text-primary" />
        {activeLabel}
        <ChevronDown
          size={14}
          className={`text-txt-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-56 origin-top-right rounded-xl border bg-surface-2 p-1.5 shadow-2xl animate-scale-in">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  onChange(r.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                  value === r.value
                    ? "bg-primary text-white"
                    : "text-txt-secondary hover:bg-surface-3 hover:text-txt-base"
                }`}
              >
                {r.label}
                {value === r.value && <CheckCircle2 size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
