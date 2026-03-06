import { ChevronRight } from "lucide-react";
import { getRunnerColor } from "../../../components/RunsTable";
import { ScoreRing } from "../../../components/ScoreRing";
import { type LedgerRun } from "../../../lib/api";

interface EvalSidebarProps {
  runnerStats: {
    runner: string;
    avgScore: number;
    runs: number;
    passRate: number;
  }[];
  bestWorst: readonly [LedgerRun | null, LedgerRun | null];
  setSelectedRun: (run: LedgerRun) => void;
}

export function EvalSidebar({ runnerStats, bestWorst, setSelectedRun }: EvalSidebarProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5">
        <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted mb-6">
          Runner Breakdown
        </h3>
        <div className="space-y-4">
          {runnerStats.map((rs) => (
            <div
              key={rs.runner}
              className="relative flex flex-col justify-between rounded-xl bg-surface-2/40 p-4 border transition-all hover:bg-surface-2"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: getRunnerColor(rs.runner) }}
                  />
                  <span className="text-sm font-black text-txt-base uppercase">{rs.runner}</span>
                </div>
                <span className="text-sm font-black text-primary">
                  {(rs.avgScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: `${rs.avgScore * 100}%`,
                    backgroundColor: getRunnerColor(rs.runner),
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-3 text-[9px] font-bold text-txt-muted uppercase tracking-tighter">
                <span>{rs.runs} executions</span>
                <span className="text-ok">{Math.round(rs.passRate * 100)}% Pass Rate</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {bestWorst.map((run, i) => (
          <div
            key={i}
            className="rounded-2xl border bg-surface-1/40 p-5 backdrop-blur-sm card-hover shadow-lg"
          >
            <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-3">
              {i === 0 ? "Optimal Performance" : "Critical Failure"}
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <ScoreRing value={run?.score ?? 0} size={40} strokeWidth={4} />
                <div className="overflow-hidden">
                  <p className="text-[11px] font-black text-txt-base truncate uppercase">
                    {run?.agentRunner ?? "N/A"}
                  </p>
                  <p className="text-[9px] font-medium text-txt-muted truncate">
                    {run ? new Date(run.timestamp).toLocaleDateString() : "No data"}
                  </p>
                </div>
              </div>
              {run && (
                <button
                  onClick={() => setSelectedRun(run)}
                  className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-surface-3 text-txt-muted hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
