import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { RunsTable } from "../../../components/RunsTable";
import type { LedgerRun } from "../../../lib/api";

interface OverviewActivityProps {
  recentRuns: LedgerRun[];
  setSelectedRun: (run: LedgerRun) => void;
}

export function OverviewActivity({ recentRuns, setSelectedRun }: OverviewActivityProps) {
  return (
    <div className="rounded-2xl border bg-surface-1/40 backdrop-blur-sm shadow-xl shadow-black/5 overflow-hidden">
      <div className="flex items-center justify-between border-b p-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
            Recent Activity
          </h3>
          <p className="text-[10px] font-bold text-txt-muted/60 uppercase">
            Latest evaluation executions
          </p>
        </div>
        <Link
          to="/runs"
          className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-xs font-bold text-txt-base transition-colors hover:bg-primary hover:text-white border"
        >
          View Full Ledger <ArrowRight size={14} />
        </Link>
      </div>
      <div>
        <RunsTable runs={recentRuns} onSelect={setSelectedRun} />
      </div>
    </div>
  );
}
