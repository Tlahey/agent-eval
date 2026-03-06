import { useEffect, useState, useMemo } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { fetchRuns, fetchTestIds, type LedgerRun } from "../../lib/api";
import type { AppContext } from "../../App";

export type SortField = "timestamp" | "score" | "durationMs";
export type SortDir = "asc" | "desc";

export const ITEMS_PER_PAGE = 20;

export function useRuns() {
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
  const sortRaw = searchParams.get("sort") || "-timestamp";
  const sortField = (sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw) as SortField;
  const sortDir = (sortRaw.startsWith("-") ? "desc" : "asc") as SortDir;
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    Promise.all([fetchRuns(), fetchTestIds()])
      .then(([r, t]) => {
        setRuns(r);
        setTestIds(t);

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
      return sortDir === "asc" ? (va as number) - (vb as number) : (va as number) - (va as number);
    });

    return result;
  }, [runs, testFilter, runnerFilter, statusFilter, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all" || (key === "page" && value === "1")) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });

    if (newParams.has("dir")) newParams.delete("dir");

    const filterKeys = ["testId", "runner", "status", "q"];
    const isFilterChanging = Object.keys(updates).some((k) => filterKeys.includes(k));

    if (isFilterChanging && newParams.has("page") && !updates.page) {
      newParams.delete("page");
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleSelectRun = (run: LedgerRun) => {
    setSelectedRun(run);
    if (run.id) {
      updateParams({ id: run.id.toString() });
    }
  };

  const toggleSort = (field: SortField) => {
    const isCurrentDesc = sortRaw === `-${field}`;
    const newValue = isCurrentDesc ? field : `-${field}`;
    updateParams({ sort: newValue });
  };

  return {
    loading,
    runs,
    testIds,
    runners,
    filtered,
    paginatedRuns,
    totalPages,
    currentPage,
    testFilter,
    runnerFilter,
    statusFilter,
    search,
    sortField,
    sortDir,
    updateParams,
    handleSelectRun,
    toggleSort,
  };
}
