import { useEffect, useState, useMemo } from "react";
import { useParams, useOutletContext, useSearchParams } from "react-router-dom";
import { fetchRuns, type LedgerRun } from "../../lib/api";
import type { AppContext } from "../../App";

const ITEMS_PER_PAGE = 10;

type SortField = "timestamp" | "score" | "durationMs";
type SortDir = "asc" | "desc";

export function useEvalDetail() {
  const { testId: rawTestId } = useParams<{ testId: string }>();
  const testId = decodeURIComponent(rawTestId ?? "");
  const { setSelectedRun } = useOutletContext<AppContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allRuns, setAllRuns] = useState<LedgerRun[]>([]);
  const [loading, setLoading] = useState(true);

  const runnerFilter = searchParams.get("runner") || "";
  const statusFilter = (searchParams.get("status") as "all" | "pass" | "fail") || "all";
  const sortRaw = searchParams.get("sort") || "-timestamp";
  const sortField = (sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw) as SortField;
  const sortDir = (sortRaw.startsWith("-") ? "desc" : "asc") as SortDir;
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    let cancelled = false;
    fetchRuns(testId)
      .then((data) => {
        if (!cancelled) {
          setAllRuns(data);
          const runId = searchParams.get("id");
          if (runId) {
            const run = data.find((x) => x.id?.toString() === runId);
            if (run) setSelectedRun(run);
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const runners = useMemo(() => [...new Set(allRuns.map((r) => r.agentRunner))], [allRuns]);

  const filteredAndSortedRuns = useMemo(() => {
    let result = [...allRuns];
    if (runnerFilter) result = result.filter((r) => r.agentRunner === runnerFilter);
    if (statusFilter !== "all")
      result = result.filter((r) => (statusFilter === "pass" ? r.pass : !r.pass));

    result.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return result;
  }, [allRuns, runnerFilter, statusFilter, sortField, sortDir]);

  const totalRunsCount = filteredAndSortedRuns.length;
  const totalPages = Math.ceil(totalRunsCount / ITEMS_PER_PAGE);
  const currentRuns = filteredAndSortedRuns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const avgScoreTotal =
    totalRunsCount > 0
      ? filteredAndSortedRuns.reduce((s, r) => s + r.score, 0) / totalRunsCount
      : 0;
  const passCountTotal = filteredAndSortedRuns.filter((r) => r.pass).length;

  const trendData = useMemo(() => buildTrendData(allRuns), [allRuns]);
  const radarData = useMemo(() => buildRadarData(allRuns), [allRuns]);
  const distributionData = useMemo(() => buildDistributionData(allRuns), [allRuns]);
  const runnerStats = useMemo(() => buildRunnerStats(allRuns), [allRuns]);
  const bestWorst = useMemo(() => buildBestWorst(allRuns), [allRuns]);

  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all" || (key === "page" && value === "1")) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    const filterKeys = ["runner", "status"];
    if (Object.keys(updates).some((k) => filterKeys.includes(k)) && !updates.page) {
      newParams.delete("page");
    }
    setSearchParams(newParams, { replace: true });
  };

  const toggleSort = (field: SortField) => {
    const newDir = sortField === field && sortDir === "desc" ? "" : "-";
    updateParams({ sort: `${newDir}${field}` });
  };

  return {
    testId,
    loading,
    allRuns,
    runners,
    currentRuns,
    totalRunsCount,
    totalPages,
    currentPage,
    avgScoreTotal,
    passCountTotal,
    trendData,
    radarData,
    distributionData,
    runnerStats,
    bestWorst,
    runnerFilter,
    statusFilter,
    sortField,
    sortDir,
    updateParams,
    toggleSort,
    setSelectedRun,
  };
}

function buildTrendData(runs: LedgerRun[]) {
  const sorted = [...runs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const grouped = new Map<string, Map<string, number[]>>();
  for (const run of sorted) {
    const date = new Date(run.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!grouped.has(date)) grouped.set(date, new Map());
    const runners = grouped.get(date)!;
    if (!runners.has(run.agentRunner)) runners.set(run.agentRunner, []);
    runners.get(run.agentRunner)!.push(run.score);
  }
  return Array.from(grouped.entries()).map(([date, runners]) => {
    const point: Record<string, string | number> = { date };
    for (const [runner, scores] of runners) {
      point[runner] = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
    }
    return point;
  });
}

function buildRadarData(runs: LedgerRun[]) {
  const runners = [...new Set(runs.map((r) => r.agentRunner))];
  const metrics = [
    { key: "score", label: "Success" },
    { key: "durationMs", label: "Speed", inverse: true, max: 60000 },
    { key: "totalTokens", label: "Efficiency", inverse: true, max: 10000 },
  ];

  return metrics.map((m) => {
    const row: Record<string, string | number> = { subject: m.label };
    runners.forEach((r) => {
      const rRuns = runs.filter((x) => x.agentRunner === r);
      let val = 0;
      if (m.key === "score") {
        val = (rRuns.reduce((s, x) => s + x.score, 0) / rRuns.length) * 100;
      } else if (m.key === "durationMs") {
        const avg = rRuns.reduce((s, x) => s + x.durationMs, 0) / rRuns.length;
        val = Math.max(0, 100 - (avg / (m.max || 1)) * 100);
      } else if (m.key === "totalTokens") {
        const avg =
          rRuns.reduce((s, x) => s + (x.agentTokenUsage?.totalTokens || 0), 0) / rRuns.length;
        val = Math.max(0, 100 - (avg / (m.max || 1)) * 100);
      }
      row[r] = Math.round(val);
    });
    return row;
  });
}

function buildDistributionData(runs: LedgerRun[]) {
  const buckets = [
    { range: "0-20%", midpoint: 0.1, count: 0 },
    { range: "20-40%", midpoint: 0.3, count: 0 },
    { range: "40-60%", midpoint: 0.5, count: 0 },
    { range: "60-80%", midpoint: 0.7, count: 0 },
    { range: "80-100%", midpoint: 0.9, count: 0 },
  ];
  runs.forEach((r) => {
    const idx = Math.min(Math.floor(r.score * 5), 4);
    buckets[idx].count++;
  });
  return buckets;
}

function buildRunnerStats(runs: LedgerRun[]) {
  const stats = new Map<string, { totalScore: number; count: number; passCount: number }>();
  runs.forEach((r) => {
    if (!stats.has(r.agentRunner))
      stats.set(r.agentRunner, { totalScore: 0, count: 0, passCount: 0 });
    const s = stats.get(r.agentRunner)!;
    s.totalScore += r.score;
    s.count++;
    if (r.pass) s.passCount++;
  });
  return Array.from(stats.entries())
    .map(([runner, s]) => ({
      runner,
      avgScore: s.totalScore / s.count,
      runs: s.count,
      passRate: s.passCount / s.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function buildBestWorst(runs: LedgerRun[]) {
  if (runs.length === 0) return [null, null] as const;
  const sorted = [...runs].sort((a, b) => b.score - a.score);
  return [sorted[0], sorted[sorted.length - 1]] as const;
}
