import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { fetchRuns, type LedgerRun } from "../../lib/api";
import { useRunSelection } from "../../lib/contexts/RunContext";

const ITEMS_PER_PAGE = 10;

type SortField = "timestamp" | "score" | "durationMs";
type SortDir = "asc" | "desc";

export interface VariantStats {
  variantName: string;
  runner: string;
  avgScore: number;
  avgDurationMs: number;
  avgTokens: number;
  runs: number;
  passRate: number;
  latestRun: LedgerRun;
}

export function useEvalDetail() {
  const { testId: rawTestId } = useParams<{ testId: string }>();
  const testId = decodeURIComponent(rawTestId ?? "");
  const { setSelectedRun } = useRunSelection();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allRuns, setAllRuns] = useState<LedgerRun[]>([]);
  const [loading, setLoading] = useState(true);

  const variantFilter = searchParams.get("variant") || "";
  const runnerFilter = searchParams.get("runner") || "";
  const statusFilter = (searchParams.get("status") as "all" | "pass" | "fail") || "all";
  const sortRaw = searchParams.get("sort") || "-timestamp";
  const sortField = (sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw) as SortField;
  const sortDir = (sortRaw.startsWith("-") ? "desc" : "asc") as SortDir;
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const compareA = searchParams.get("compareA") || "";
  const compareB = searchParams.get("compareB") || "";

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
  }, [testId, searchParams, setSelectedRun]);

  const variants = useMemo(
    () => [...new Set(allRuns.map((r) => r.variantName || "default"))],
    [allRuns],
  );
  const runners = useMemo(() => [...new Set(allRuns.map((r) => r.agentRunner))], [allRuns]);

  const filteredAndSortedRuns = useMemo(() => {
    let result = [...allRuns];
    if (variantFilter)
      result = result.filter((r) => (r.variantName || "default") === variantFilter);
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
  }, [allRuns, variantFilter, runnerFilter, statusFilter, sortField, sortDir]);

  const totalRunsCount = filteredAndSortedRuns.length;
  const totalPages = Math.ceil(totalRunsCount / ITEMS_PER_PAGE);
  const currentRuns = filteredAndSortedRuns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const variantStats = useMemo(() => buildVariantStats(allRuns), [allRuns]);

  const comparison = useMemo(() => {
    if (!compareA || !compareB) return null;
    const a = variantStats.find((v) => v.variantName === compareA);
    const b = variantStats.find((v) => v.variantName === compareB);
    if (!a || !b) return null;

    return {
      a,
      b,
      deltas: {
        score: b.avgScore - a.avgScore,
        duration: b.avgDurationMs - a.avgDurationMs,
        tokens: b.avgTokens - a.avgTokens,
      },
    };
  }, [variantStats, compareA, compareB]);

  // Data for EvalCharts
  const trendData = useMemo(() => buildTrendData(allRuns, runners), [allRuns, runners]);
  const radarData = useMemo(() => buildRadarData(allRuns, runners), [allRuns, runners]);
  const distributionData = useMemo(() => buildDistributionData(allRuns), [allRuns]);

  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all" || (key === "page" && value === "1")) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
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
    variants,
    runners,
    currentRuns,
    totalRunsCount,
    totalPages,
    currentPage,
    variantStats,
    comparison,
    compareA,
    compareB,
    trendData,
    radarData,
    distributionData,
    variantFilter,
    runnerFilter,
    statusFilter,
    sortField,
    sortDir,
    updateParams,
    toggleSort,
    setSelectedRun,
  };
}

function buildVariantStats(runs: LedgerRun[]): VariantStats[] {
  const groups = new Map<string, LedgerRun[]>();
  runs.forEach((r) => {
    const key = r.variantName || "default";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  return Array.from(groups.entries())
    .map(([name, vRuns]) => {
      const latest = [...vRuns].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];
      const totalScore = vRuns.reduce((s, r) => s + r.score, 0);
      const totalDuration = vRuns.reduce((s, r) => s + r.durationMs, 0);
      const totalTokens = vRuns.reduce((s, r) => s + (r.agentTokenUsage?.totalTokens || 0), 0);
      const passCount = vRuns.filter((r) => r.pass).length;

      return {
        variantName: name,
        runner: latest.agentRunner,
        avgScore: totalScore / vRuns.length,
        avgDurationMs: totalDuration / vRuns.length,
        avgTokens: totalTokens / vRuns.length,
        runs: vRuns.length,
        passRate: passCount / vRuns.length,
        latestRun: latest,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

function buildTrendData(runs: LedgerRun[], runners: string[]) {
  const byDate = new Map<string, Record<string, number[]>>();

  runs.forEach((r) => {
    const date = new Date(r.timestamp).toLocaleDateString();
    if (!byDate.has(date)) byDate.set(date, {});
    const day = byDate.get(date)!;
    if (!day[r.agentRunner]) day[r.agentRunner] = [];
    day[r.agentRunner].push(r.score);
  });

  return Array.from(byDate.entries())
    .map(([date, dayRunners]) => {
      const entry: any = { date };
      runners.forEach((runner) => {
        if (dayRunners[runner]) {
          entry[runner] = dayRunners[runner].reduce((a, b) => a + b, 0) / dayRunners[runner].length;
        }
      });
      return entry;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function buildRadarData(runs: LedgerRun[], runners: string[]) {
  const metrics = [
    { subject: "Score", key: "score", scale: 100 },
    { subject: "Success", key: "pass", scale: 100 },
    { subject: "Stability", key: "stability", scale: 100 },
    { subject: "Efficiency", key: "efficiency", scale: 100 },
    { subject: "Speed", key: "speed", scale: 100 },
  ];

  return metrics.map((m) => {
    const entry: any = { subject: m.subject };
    runners.forEach((runner) => {
      const rRuns = runs.filter((r) => r.agentRunner === runner);
      if (rRuns.length === 0) {
        entry[runner] = 0;
        return;
      }

      if (m.key === "score") {
        entry[runner] = (rRuns.reduce((s, r) => s + r.score, 0) / rRuns.length) * 100;
      } else if (m.key === "pass") {
        entry[runner] = (rRuns.filter((r) => r.pass).length / rRuns.length) * 100;
      } else if (m.key === "stability") {
        const scores = rRuns.map((r) => r.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((s, x) => s + Math.pow(x - avg, 2), 0) / scores.length;
        entry[runner] = Math.max(0, 1 - Math.sqrt(variance)) * 100;
      } else if (m.key === "efficiency") {
        const avgTokens =
          rRuns.reduce((s, r) => s + (r.agentTokenUsage?.totalTokens || 5000), 0) / rRuns.length;
        entry[runner] = Math.max(0, 1 - avgTokens / 10000) * 100;
      } else if (m.key === "speed") {
        const avgMs = rRuns.reduce((s, r) => s + r.durationMs, 0) / rRuns.length;
        entry[runner] = Math.max(0, 1 - avgMs / 60000) * 100;
      }
    });
    return entry;
  });
}

function buildDistributionData(runs: LedgerRun[]) {
  const buckets = [
    { range: "0-20%", min: 0, max: 0.2 },
    { range: "20-40%", min: 0.2, max: 0.4 },
    { range: "40-60%", min: 0.4, max: 0.6 },
    { range: "60-80%", min: 0.6, max: 0.8 },
    { range: "80-100%", min: 0.8, max: 1.0 },
  ];

  return buckets.map((b) => ({
    range: b.range,
    midpoint: (b.min + b.max) / 2,
    count: runs.filter((r) => r.score >= b.min && r.score < b.max + (b.max === 1 ? 0.01 : 0))
      .length,
  }));
}
