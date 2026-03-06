import { ChevronLeft, ChevronRight, SortAsc, SortDesc } from "lucide-react";
import { RunsTable } from "../../../components/RunsTable";
import { type LedgerRun } from "../../../lib/api";

interface EvalHistoryProps {
  currentRuns: LedgerRun[];
  totalRunsCount: number;
  totalPages: number;
  currentPage: number;
  runners: string[];
  runnerFilter: string;
  statusFilter: string;
  sortField: string;
  sortDir: "asc" | "desc";
  updateParams: (updates: Record<string, string | null>) => void;
  toggleSort: (field: "timestamp" | "score" | "durationMs") => void;
  setSelectedRun: (run: LedgerRun) => void;
}

export function EvalHistory({
  currentRuns,
  totalPages,
  currentPage,
  runners,
  runnerFilter,
  statusFilter,
  sortField,
  sortDir,
  updateParams,
  toggleSort,
  setSelectedRun,
}: EvalHistoryProps) {
  return (
    <div className="rounded-2xl border bg-surface-1/40 backdrop-blur-sm card-hover shadow-xl shadow-black/5 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b p-6 gap-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
            Execution History
          </h3>
          <p className="text-[10px] font-bold text-txt-muted/60 uppercase">
            Chronological audit trail
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-surface-2 border p-1 shadow-sm">
            <button
              onClick={() => updateParams({ status: "all" })}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${statusFilter === "all" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-txt-muted hover:text-txt-secondary"}`}
            >
              All
            </button>
            <button
              onClick={() => updateParams({ status: "pass" })}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${statusFilter === "pass" ? "bg-ok text-white" : "text-txt-muted hover:text-txt-secondary"}`}
            >
              Pass
            </button>
            <button
              onClick={() => updateParams({ status: "fail" })}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${statusFilter === "fail" ? "bg-err text-white" : "text-txt-muted hover:text-txt-secondary"}`}
            >
              Fail
            </button>
          </div>

          <select
            value={runnerFilter}
            onChange={(e) => updateParams({ runner: e.target.value })}
            className="h-10 rounded-xl border bg-surface-2 px-4 text-[10px] font-black uppercase text-txt-base focus:border-primary/50 focus:outline-none shadow-sm"
          >
            <option value="">All Runners</option>
            {runners.map((r) => (
              <option key={r} value={r}>
                {r.toUpperCase()}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-xl bg-surface-2 border p-1 shadow-sm">
            <button
              onClick={() => toggleSort("timestamp")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${sortField === "timestamp" ? "bg-surface-3 text-primary" : "text-txt-muted"}`}
            >
              Time{" "}
              {sortField === "timestamp" &&
                (sortDir === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />)}
            </button>
            <button
              onClick={() => toggleSort("score")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${sortField === "score" ? "bg-surface-3 text-primary" : "text-txt-muted"}`}
            >
              Score{" "}
              {sortField === "score" &&
                (sortDir === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />)}
            </button>
          </div>
        </div>
      </div>

      <RunsTable runs={currentRuns} onSelect={setSelectedRun} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-surface-2/30 border-t">
          <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => updateParams({ page: (currentPage - 1).toString() })}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-2 border text-txt-muted disabled:opacity-20 transition-all hover:border-primary/30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => updateParams({ page: (currentPage + 1).toString() })}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-2 border text-txt-muted disabled:opacity-20 transition-all hover:border-primary/30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
