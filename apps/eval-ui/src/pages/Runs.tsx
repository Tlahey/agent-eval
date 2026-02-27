import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Filter, SortAsc, SortDesc } from "lucide-react";
import { fetchRuns, fetchTestIds, type LedgerRun } from "../lib/api";
import { RunsTable } from "../components/RunsTable";
import type { AppContext } from "../App";

type SortField = "timestamp" | "score" | "durationMs";
type SortDir = "asc" | "desc";

export function Runs() {
  const { setSelectedRun } = useOutletContext<AppContext>();
  const [runs, setRuns] = useState<LedgerRun[]>([]);
  const [testIds, setTestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [testFilter, setTestFilter] = useState("");
  const [runnerFilter, setRunnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    Promise.all([fetchRuns(), fetchTestIds()])
      .then(([r, t]) => {
        setRuns(r);
        setTestIds(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-txt-base">All Runs</h1>
        <p className="text-sm text-txt-muted">
          {filtered.length} of {runs.length} evaluation runs
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-xs text-txt-base placeholder:text-txt-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Test filter */}
        <Select
          value={testFilter}
          onChange={setTestFilter}
          options={[
            { value: "", label: "All evals" },
            ...testIds.map((id) => ({ value: id, label: id })),
          ]}
          icon={<Filter size={12} />}
        />

        {/* Runner filter */}
        <Select
          value={runnerFilter}
          onChange={setRunnerFilter}
          options={[
            { value: "", label: "All runners" },
            ...runners.map((r) => ({ value: r, label: r })),
          ]}
        />

        {/* Status filter */}
        <div className="flex rounded-lg border border-border bg-surface-2">
          {(["all", "pass", "fail"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                statusFilter === status
                  ? "bg-primary text-txt-inverse"
                  : "text-txt-muted hover:text-txt-secondary"
              }`}
            >
              {status === "all" ? "All" : status === "pass" ? "✓ Pass" : "✗ Fail"}
            </button>
          ))}
        </div>

        {/* Sort buttons */}
        <div className="ml-auto flex items-center gap-1">
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
          <SortButton
            field="durationMs"
            label="Duration"
            current={sortField}
            dir={sortDir}
            onClick={toggleSort}
          />
        </div>
      </div>

      {/* Table */}
      <RunsTable runs={filtered} onSelect={setSelectedRun} />
    </div>
  );
}

/* ─── Small components ─── */

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
    <div className="relative flex items-center">
      {icon && <span className="absolute left-2.5 text-txt-muted">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 appearance-none rounded-lg border border-border bg-surface-2 pr-6 text-xs text-txt-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 ${
          icon ? "pl-7" : "pl-3"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-txt-muted hover:bg-surface-3 hover:text-txt-secondary"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
