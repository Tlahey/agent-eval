import { ChevronLeft, ChevronRight } from "lucide-react";
import { RunsTable } from "../../../components/RunsTable";
import type { LedgerRun } from "../../../lib/api";
import { ITEMS_PER_PAGE } from "../useRuns";

interface RunsTableSectionProps {
  runs: LedgerRun[];
  filteredCount: number;
  totalPages: number;
  currentPage: number;
  onSelectRun: (run: LedgerRun) => void;
  updateParams: (updates: Record<string, string | null>) => void;
}

export function RunsTableSection({
  runs,
  filteredCount,
  totalPages,
  currentPage,
  onSelectRun,
  updateParams,
}: RunsTableSectionProps) {
  return (
    <div className="rounded-2xl border bg-surface-1/40 backdrop-blur-sm shadow-2xl shadow-black/5 overflow-hidden">
      <RunsTable runs={runs} onSelect={onSelectRun} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-surface-2/30 border-t border">
          <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredCount)} of {filteredCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => updateParams({ page: (currentPage - 1).toString() })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border bg-surface-1 text-txt-muted transition-all hover:bg-primary hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                if (pageNum <= 0 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => updateParams({ page: pageNum.toString() })}
                    className={`h-8 min-w-[32px] px-2 rounded-lg border text-[10px] font-black transition-all ${
                      currentPage === pageNum
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                        : "bg-surface-1 text-txt-muted hover:bg-surface-3"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => updateParams({ page: (currentPage + 1).toString() })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border bg-surface-1 text-txt-muted transition-all hover:bg-primary hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
