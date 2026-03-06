import { CheckCircle2, XCircle } from "lucide-react";

interface RunsHeaderProps {
  filteredCount: number;
  totalCount: number;
  statusFilter: string;
  updateParams: (updates: Record<string, string | null>) => void;
}

export function RunsHeader({
  filteredCount,
  totalCount,
  statusFilter,
  updateParams,
}: RunsHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black text-txt-base tracking-tight mb-1">Execution Ledger</h1>
        <p className="text-sm text-txt-muted font-bold uppercase tracking-wider">
          {filteredCount} of {totalCount} Runs filtered
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-surface-1 border p-1 shadow-sm">
          <button
            onClick={() => updateParams({ status: "all" })}
            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${statusFilter === "all" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-txt-muted hover:text-txt-secondary"}`}
          >
            All
          </button>
          <button
            onClick={() => updateParams({ status: "pass" })}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${statusFilter === "pass" ? "bg-ok text-white shadow-lg shadow-ok/20" : "text-txt-muted hover:text-txt-secondary"}`}
          >
            <CheckCircle2 size={10} /> Above
          </button>
          <button
            onClick={() => updateParams({ status: "fail" })}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${statusFilter === "fail" ? "bg-err text-white shadow-lg shadow-err/20" : "text-txt-muted hover:text-txt-secondary"}`}
          >
            <XCircle size={10} /> Below
          </button>
        </div>
      </div>
    </div>
  );
}
