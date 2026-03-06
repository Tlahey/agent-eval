import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface EvalHeaderProps {
  testId: string;
  totalRunsCount: number;
  runnersCount: number;
  avgScoreTotal: number;
  passCountTotal: number;
}

export function EvalHeader({
  testId,
  totalRunsCount,
  runnersCount,
  avgScoreTotal,
  passCountTotal,
}: EvalHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 border text-txt-muted hover:text-primary transition-all hover:border-primary/30 shadow-sm"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-txt-base tracking-tight mb-1">{testId}</h1>
          <p className="text-xs font-bold text-txt-muted uppercase tracking-wider">
            {totalRunsCount} Total executions <span className="mx-1 opacity-30">|</span>{" "}
            {runnersCount} Runners
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 rounded-2xl border bg-surface-1/40 p-4 backdrop-blur-md shadow-xl shadow-black/5">
        <div className="text-center px-4 border-r border/50">
          <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
            Avg Score
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-txt-base">
              {(avgScoreTotal * 100).toFixed(0)}%
            </span>
            <div
              className={`h-1.5 w-1.5 rounded-full ${avgScoreTotal >= 0.7 ? "bg-ok" : "bg-warn"}`}
            />
          </div>
        </div>
        <div className="text-center px-4">
          <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
            Pass Rate
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-txt-base">
              {((passCountTotal / (totalRunsCount || 1)) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
