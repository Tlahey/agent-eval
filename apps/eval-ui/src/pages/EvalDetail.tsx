import { useEffect, useState, useMemo } from "react";
import { useParams, useOutletContext, useSearchParams, Link } from "react-router-dom";
import { ChevronRight, SortAsc, SortDesc, ChevronLeft } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { fetchRuns, type LedgerRun } from "../lib/api";
import { RunsTable, getRunnerColor } from "../components/RunsTable";
import { ScoreRing } from "../components/ScoreRing";
import type { AppContext } from "../App";

const ITEMS_PER_PAGE = 10;

type SortField = "timestamp" | "score" | "durationMs";
type SortDir = "asc" | "desc";

export function EvalDetail() {
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

  const trendData = buildTrendData(allRuns);
  const radarData = buildRadarData(allRuns);
  const distribution = buildDistributionData(allRuns);
  const runnerStats = buildRunnerStats(allRuns);

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 border text-txt-muted hover:text-primary transition-all hover:border-primary/30 shadow-sm"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-txt-base tracking-tight mb-1">{testId}</h1>
            <p className="text-xs font-bold text-txt-muted uppercase tracking-wider">
              {totalRunsCount} Total executions <span className="mx-1 opacity-30">|</span>{" "}
              {runners.length} Runners
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 rounded-2xl border bg-surface-1/40 p-4 backdrop-blur-md shadow-xl shadow-black/5">
          <div className="text-center px-4 border-r border/50">
            <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
              Avg Score
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-txt-base">
                {(avgScoreTotal * 100).toFixed(0)}%
              </span>
              <div
                className={`h-1.5 w-1.5 rounded-full ${avgScoreTotal >= 0.7 ? "bg-ok" : "bg-warn"}`}
              />
            </div>
          </div>
          <div className="text-center px-4">
            <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
              Pass Rate
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-txt-base">
                {((passCountTotal / (totalRunsCount || 1)) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
                Historical Performance
              </h3>
              <div className="flex gap-3">
                {runners.map((r) => (
                  <div key={r} className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: getRunnerColor(r) }}
                    />
                    <span className="text-[9px] font-bold text-txt-muted uppercase">{r}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    {runners.map((runner) => (
                      <linearGradient
                        key={runner}
                        id={`eval-grad-${runner}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor={getRunnerColor(runner)} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={getRunnerColor(runner)} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--color-line) / 0.1)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--color-txt-muted))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    domain={[0, 1]}
                    stroke="hsl(var(--color-txt-muted))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--color-surface-2))",
                      border: "1px solid hsl(var(--color-line) / 0.2)",
                      borderRadius: "12px",
                      fontSize: 12,
                    }}
                    labelStyle={{
                      color: "hsl(var(--color-txt-base))",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  />
                  {runners.map((runner) => (
                    <Area
                      key={runner}
                      type="monotone"
                      dataKey={runner}
                      stroke={getRunnerColor(runner)}
                      fill={`url(#eval-grad-${runner})`}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5">
              <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted mb-6">
                Capabilities Matrix
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--color-line) / 0.2)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      stroke="hsl(var(--color-txt-muted))"
                      fontSize={10}
                      fontWeight="bold"
                    />
                    <PolarRadiusAxis domain={[0, 100]} axisLine={false} tick={false} />
                    {runners.map((runner) => (
                      <Radar
                        key={runner}
                        name={runner}
                        dataKey={runner}
                        stroke={getRunnerColor(runner)}
                        fill={getRunnerColor(runner)}
                        fillOpacity={0.2}
                      />
                    ))}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--color-surface-2))",
                        border: "1px solid hsl(var(--color-line) / 0.2)",
                        borderRadius: "12px",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5 overflow-hidden">
              <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted mb-6">
                Score Distribution
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--color-line) / 0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="range"
                      stroke="hsl(var(--color-txt-muted))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--color-txt-muted))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--color-surface-3) / 0.3)" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--color-surface-2))",
                        border: "1px solid hsl(var(--color-line) / 0.2)",
                        borderRadius: "12px",
                      }}
                    />
                    <Bar dataKey="count" barSize={40}>
                      {distribution.map((d, i) => (
                        <Cell
                          key={i}
                          fill={
                            d.midpoint >= 0.8
                              ? "hsl(var(--color-ok))"
                              : d.midpoint >= 0.6
                                ? "hsl(var(--color-warn))"
                                : "hsl(var(--color-err))"
                          }
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

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
                      <span className="text-sm font-black text-txt-base uppercase">
                        {rs.runner}
                      </span>
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
            {buildBestWorst(allRuns).map((run, i) => (
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
      </div>

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
    </div>
  );

  function toggleSort(field: SortField) {
    const newDir = sortField === field && sortDir === "desc" ? "" : "-";
    updateParams({ sort: `${newDir}${field}` });
  }
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
    const point: any = { date };
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
    const row: any = { subject: m.label };
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
  if (runs.length === 0) return [null, null];
  const sorted = [...runs].sort((a, b) => b.score - a.score);
  return [sorted[0], sorted[sorted.length - 1]];
}
