import { useEffect, useState, useMemo } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { fetchRuns, fetchTestIds, type LedgerRun } from "../lib/api";
import { RunsTable } from "../components/RunsTable";
import type { AppContext } from "../App";

type SortField = "timestamp" | "score" | "durationMs";
type SortDir = "asc" | "desc";

const ITEMS_PER_PAGE = 20;

export function Runs() {
  const { setSelectedRun } = useOutletContext<AppContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<LedgerRun[]>([]);
  const [testIds, setTestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Read initial state from URL
  const testFilter = searchParams.get("testId") || "";
  const runnerFilter = searchParams.get("runner") || "";
  const statusFilter = (searchParams.get("status") as "all" | "pass" | "fail") || "all";
  const search = searchParams.get("q") || "";
  // Read sort from URL (e.g. sort=-score)
  const sortRaw = searchParams.get("sort") || "-timestamp";
  const sortField = (sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw) as SortField;
  const sortDir = (sortRaw.startsWith("-") ? "desc" : "asc") as SortDir;
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    Promise.all([fetchRuns(), fetchTestIds()])
      .then(([r, t]) => {
        setRuns(r);
        setTestIds(t);

        // Handle direct link to a run via URL ID
        const runId = searchParams.get("id");
        if (runId) {
          const run = r.find((x) => x.id?.toString() === runId);
          if (run) setSelectedRun(run);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runners = useMemo(() => [...new Set(runs.map((r) => r.agentRunner))], [runs]);

  const filtered = useMemo(() => {
    let result = [...runs];

    if (testFilter) result = result.filter((r) => r.testId === testFilter);
    if (runnerFilter) result = result.filter((r) => r.agentRunner === runnerFilter);
    if (statusFilter !== "all")
      result = result.filter((r) => (statusFilter === "pass" ? r.pass : !r.pass));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.testId.toLowerCase().includes(q) ||
          r.agentRunner.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return result;
  }, [runs, testFilter, runnerFilter, statusFilter, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Unified update function
  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all" || (key === "page" && value === "1")) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });

    // Cleanup old dir param if exists
    if (newParams.has("dir")) newParams.delete("dir");

    // Reset page only if filters change, but not for ID selection or sorting
    const filterKeys = ["testId", "runner", "status", "q"];
    const isFilterChanging = Object.keys(updates).some((k) => filterKeys.includes(keyMap[k] || k));

    if (isFilterChanging && newParams.has("page") && !updates.page) {
      newParams.delete("page");
    }
    setSearchParams(newParams, { replace: true });
  };

  const keyMap: Record<string, string> = {
    q: "q",
    testId: "testId",
    runner: "runner",
    status: "status",
  };

  const handleSelectRun = (run: LedgerRun) => {
    setSelectedRun(run);
    if (run.id) {
      updateParams({ id: run.id.toString() });
    }
  };

  const toggleSort = (field: SortField) => {
    // If current is desc of same field, go asc. Otherwise go desc.
    const isCurrentDesc = sortRaw === `-${field}`;
    const newValue = isCurrentDesc ? field : `-${field}`;
    updateParams({ sort: newValue });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg shadow-primary/20" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-txt-base tracking-tight mb-1">
            Execution Ledger
          </h1>
          <p className="text-sm text-txt-muted font-bold uppercase tracking-wider">
            {filtered.length} of {runs.length} Runs filtered
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

      {/* Toolbar / Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative group md:col-span-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted group-focus-within:text-primary transition-colors"
          />
          <input
            type="text"
            placeholder="Search test ID or agent..."
            value={search}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="w-full h-12 rounded-xl border bg-surface-2 pl-11 pr-4 text-sm font-bold text-txt-base placeholder:text-txt-muted/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
          />
        </div>

        <div className="md:col-span-1">
          <Select
            value={testFilter}
            onChange={(v) => updateParams({ testId: v })}
            options={[
              { value: "", label: "Filter by Evaluation" },
              ...testIds.map((id) => ({ value: id, label: id })),
            ]}
            icon={<Filter size={16} />}
          />
        </div>

        <div className="md:col-span-1">
          <Select
            value={runnerFilter}
            onChange={(v) => updateParams({ runner: v })}
            options={[
              { value: "", label: "Filter by Agent Runner" },
              ...runners.map((r) => ({ value: r, label: r })),
            ]}
            icon={<LayoutGrid size={16} />}
          />
        </div>

        <div className="md:col-span-1 flex items-center gap-2">
          <SortButton
            field="timestamp"
            label="Time"
            current={sortField}
            dir={sortDir}
            onClick={toggleSort}
          />
          <SortButton
            field="score"
            label="Score"
            current={sortField}
            dir={sortDir}
            onClick={toggleSort}
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border bg-surface-1/40 backdrop-blur-sm card-hover shadow-2xl shadow-black/5 overflow-hidden">
        <RunsTable runs={paginatedRuns} onSelect={handleSelectRun} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-surface-2/30 border-t border">
            <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
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
    </div>
  );
}

/* ─── Components ─── */

function Select({
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

function SortButton({
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
