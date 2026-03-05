import { useEffect, useState, useMemo } from "react";
import { useParams, useOutletContext, useSearchParams, Link } from "react-router-dom";
import {
  TrendingUp,
  Clock,
  ChevronRight,
  LayoutGrid,
  SortAsc,
  SortDesc,
  ChevronLeft,
} from "lucide-react";
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
  Legend,
} from "recharts";
import { fetchRuns, type LedgerRun } from "../lib/api";
import { RunsTable, RunnerDot } from "../components/RunsTable";
import { ScoreRing } from "../components/ScoreRing";
import type { AppContext } from "../App";

const RUNNER_COLORS: Record<string, string> = {
  copilot: "hsl(265, 90%, 70%)",
  cursor: "hsl(190, 90%, 60%)",
  "claude-code": "hsl(160, 85%, 55%)",
  aider: "hsl(350, 90%, 65%)",
};

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

  // Read filters from URL
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
          // Handle direct link
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

  // Filtering & Sorting logic
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

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRuns.length / ITEMS_PER_PAGE);
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedRuns.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedRuns, currentPage]);

  const updateParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all" || (key === "page" && value === "1")) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    // Reset page if filters change
    const filterKeys = ["runner", "status"];
    if (Object.keys(updates).some((k) => filterKeys.includes(k)) && !updates.page) {
      newParams.delete("page");
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleSelectRun = (run: LedgerRun) => {
    setSelectedRun(run);
    if (run.id) updateParams({ id: run.id.toString() });
  };

  const toggleSort = (field: SortField) => {
    const newValue = sortRaw === `-${field}` ? field : `-${field}`;
    updateParams({ sort: newValue });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg shadow-primary/20" />
      </div>
    );
  }

  // Stats for the header/radar (based on ALL runs for this eval)
  const totalRunsCount = allRuns.length;
  const passCountTotal = allRuns.filter((r) => r.pass).length;
  const avgScoreTotal =
    totalRunsCount > 0 ? allRuns.reduce((s, r) => s + r.score, 0) / totalRunsCount : 0;
  const bestRun = allRuns.reduce(
    (best, r) => (r.score > (best?.score ?? 0) ? r : best),
    allRuns[0],
  );
  const worstRun = allRuns.reduce(
    (worst, r) => (r.score < (worst?.score ?? 1) ? r : worst),
    allRuns[0],
  );

  const runnerStats = runners
    .map((runner) => {
      const rRuns = allRuns.filter((r) => r.agentRunner === runner);
      return {
        runner,
        avgScore: rRuns.reduce((s, r) => s + r.score, 0) / rRuns.length,
        passRate: rRuns.filter((r) => r.pass).length / rRuns.length,
        avgDuration: rRuns.reduce((s, r) => s + r.durationMs, 0) / rRuns.length,
        count: rRuns.length,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  const sortedByTime = [...allRuns].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const trendData = buildTrendData(sortedByTime);

  const maxDuration = Math.max(...runnerStats.map((r) => r.avgDuration));
  const radarData = [
    {
      metric: "Avg Score",
      ...Object.fromEntries(runnerStats.map((r) => [r.runner, +(r.avgScore * 100).toFixed(1)])),
    },
    {
      metric: "Pass Rate",
      ...Object.fromEntries(runnerStats.map((r) => [r.runner, +(r.passRate * 100).toFixed(1)])),
    },
    {
      metric: "Speed",
      ...Object.fromEntries(
        runnerStats.map((r) => [
          r.runner,
          +((1 - r.avgDuration / (maxDuration || 1)) * 100).toFixed(1),
        ]),
      ),
    },
  ];

  const distribution = buildDistribution(allRuns);
  const suitePath = allRuns.length > 0 ? allRuns[0].suitePath : [];

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2.5 px-1">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 border border-slate-800 text-txt-muted hover:text-primary transition-all hover:border-primary/30 shadow-sm"
        >
          <LayoutGrid size={14} />
        </Link>
        <ChevronRight size={12} className="text-txt-muted/40" />
        <span className="text-[10px] font-black uppercase tracking-widest text-txt-muted">
          Evaluations
        </span>
        {suitePath.map((segment, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <ChevronRight size={12} className="text-txt-muted/40" />
            <span className="text-[10px] font-black uppercase tracking-widest text-txt-muted">
              {segment}
            </span>
          </div>
        ))}
        <ChevronRight size={12} className="text-txt-muted/40" />
        <span className="text-[11px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
          {testId}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <h1 className="text-4xl font-black text-txt-base tracking-tight mb-2">{testId}</h1>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {runners.slice(0, 4).map((runner) => (
                <div
                  key={runner}
                  className="h-6 w-6 rounded-full border-2 border-surface-0 overflow-hidden ring-1 ring-border shadow-sm"
                >
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: RUNNER_COLORS[runner] ?? "var(--color-primary)" }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-txt-muted uppercase tracking-wider">
              {totalRunsCount} Total executions <span className="mx-1 opacity-30">|</span>{" "}
              {runners.length} Runners
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 rounded-2xl border border-slate-800 bg-surface-1/40 p-4 backdrop-blur-md shadow-xl shadow-black/5">
          <div className="text-center px-4 border-r border-slate-800/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-txt-muted mb-1">
              Avg Score
            </p>
            <div className="flex items-center justify-center gap-2">
              <ScoreRing value={avgScoreTotal} size={48} strokeWidth={4} />
              <span className="text-xl font-black text-txt-base">
                {(avgScoreTotal * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="text-center px-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-txt-muted mb-1">
              Pass Rate
            </p>
            <div className="text-2xl font-black text-ok tracking-tight">
              {((passCountTotal / (totalRunsCount || 1)) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Score trend */}
        <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5">
          <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-txt-muted">
            Historical Performance
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    <stop
                      offset="0%"
                      stopColor={RUNNER_COLORS[runner] ?? "var(--color-primary)"}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor={RUNNER_COLORS[runner] ?? "var(--color-primary)"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                domain={[0, 1]}
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0e1120",
                  border: "1px solid hsl(var(--color-border) / 0.12)",
                  borderRadius: "12px",
                  fontSize: 12,
                }}
                itemStyle={{ padding: "2px 0", color: "#f8fafc" }}
                labelStyle={{ color: "#f8fafc", fontWeight: 700, marginBottom: 8 }}
              />
              {runners.map((runner) => (
                <Area
                  key={runner}
                  type="monotone"
                  dataKey={runner}
                  stroke={RUNNER_COLORS[runner] ?? "var(--color-primary)"}
                  fill={`url(#eval-grad-${runner})`}
                  strokeWidth={3}
                  dot={{
                    r: 3,
                    strokeWidth: 0,
                    fill: RUNNER_COLORS[runner] ?? "var(--color-primary)",
                  }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radar */}
        <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5">
          <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-txt-muted">
            Capabilities Matrix
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="metric" stroke="#64748b" fontSize={11} fontWeight={700} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {runners.map((runner) => (
                <Radar
                  key={runner}
                  name={runner}
                  dataKey={runner}
                  stroke={RUNNER_COLORS[runner] ?? "var(--color-primary)"}
                  fill={RUNNER_COLORS[runner] ?? "var(--color-primary)"}
                  fillOpacity={0.15}
                  strokeWidth={3}
                />
              ))}
              <Legend
                iconSize={10}
                wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 20 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution */}
        <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5">
          <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-txt-muted">
            Score Distribution
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="range"
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                contentStyle={{
                  backgroundColor: "#0e1120",
                  border: "1px solid hsl(var(--color-border) / 0.12)",
                  borderRadius: "12px",
                  fontSize: 12,
                }}
                itemStyle={{ padding: "2px 0", color: "#f8fafc" }}
                labelStyle={{ color: "#f8fafc", fontWeight: 700, marginBottom: 8 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {distribution.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.midpoint >= 0.8 ? "#10b981" : d.midpoint >= 0.6 ? "#f59e0b" : "#ef4444"}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Runner cards */}
        <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5 overflow-hidden">
          <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-txt-muted">
            Runner Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
            {runnerStats.map((rs) => (
              <div
                key={rs.runner}
                className="relative flex flex-col justify-between rounded-xl bg-surface-2/40 p-4 border border-slate-800/50 group transition-all hover:bg-surface-2"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RunnerDot runner={rs.runner} size={8} />
                    <span className="text-xs font-black text-txt-base">{rs.runner}</span>
                  </div>
                  <span className="text-sm font-black text-primary">
                    {(rs.avgScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${rs.avgScore * 100}%`,
                        backgroundColor: RUNNER_COLORS[rs.runner] ?? "var(--color-primary)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-txt-muted">
                    <span>{rs.count} Runs</span>
                    <span className="text-ok">{(rs.passRate * 100).toFixed(0)}% Pass</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best / Worst highlights */}
      {bestRun && worstRun && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <HighlightCard
            label="Optimal Performance"
            run={bestRun}
            accent="ok"
            onClick={() => handleSelectRun(bestRun)}
          />
          <HighlightCard
            label="Critical Failure"
            run={worstRun}
            accent="err"
            onClick={() => handleSelectRun(worstRun)}
          />
        </div>
      )}

      {/* Execution ledger with filters */}
      <div className="rounded-2xl border border-slate-800 bg-surface-1/40 backdrop-blur-sm card-hover shadow-xl shadow-black/5 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 p-6 gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
              Execution History
            </h3>
            <p className="text-[10px] font-bold text-txt-muted/60 uppercase">
              Detailed logs for this evaluation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 rounded-xl bg-surface-2 border border-slate-800 p-1 shadow-sm">
              {(["all", "pass", "fail"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateParams({ status: s })}
                  className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    statusFilter === s
                      ? "bg-primary text-white"
                      : "text-txt-muted hover:text-txt-secondary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Runner Filter */}
            <div className="w-40">
              <select
                value={runnerFilter}
                onChange={(e) => updateParams({ runner: e.target.value })}
                className="w-full h-8 rounded-lg border border-slate-800 bg-surface-2 px-3 text-[10px] font-black uppercase text-txt-base focus:border-primary/50 focus:outline-none"
              >
                <option value="">All Runners</option>
                {runners.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Buttons */}
            <div className="flex items-center gap-1">
              <SortSmallButton
                field="timestamp"
                label="Time"
                current={sortField}
                dir={sortDir}
                onClick={toggleSort}
              />
              <SortSmallButton
                field="score"
                label="Score"
                current={sortField}
                dir={sortDir}
                onClick={toggleSort}
              />
            </div>
          </div>
        </div>

        <div>
          <RunsTable runs={paginatedRuns} onSelect={handleSelectRun} compact />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-surface-2/30 border-t border-slate-800">
            <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedRuns.length)} of{" "}
              {filteredAndSortedRuns.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => updateParams({ page: (currentPage - 1).toString() })}
                className="h-7 w-7 flex items-center justify-center rounded bg-surface-2 border border-slate-800 text-txt-muted disabled:opacity-20"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-black text-txt-base">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => updateParams({ page: (currentPage + 1).toString() })}
                className="h-7 w-7 flex items-center justify-center rounded bg-surface-2 border border-slate-800 text-txt-muted disabled:opacity-20"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Components ─── */

function SortSmallButton({
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
      className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-800 transition-all font-black text-[9px] uppercase tracking-widest ${
        active ? "bg-primary text-white" : "bg-surface-2 text-txt-muted hover:bg-surface-3"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function HighlightCard({
  label,
  run,
  accent,
  onClick,
}: {
  label: string;
  run: LedgerRun;
  accent: "ok" | "err";
  onClick: () => void;
}) {
  const styles =
    accent === "ok"
      ? { border: "border-ok/30", bg: "bg-ok/5", text: "text-ok", iconBg: "bg-ok/10" }
      : { border: "border-err/30", bg: "bg-err/5", text: "text-err", iconBg: "bg-err/10" };

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-5 rounded-2xl border ${styles.border} ${styles.bg} p-6 text-left transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]`}
    >
      <div className="relative">
        <ScoreRing value={run.score} size={56} strokeWidth={5} />
        <div className={`absolute inset-0 animate-ping rounded-full opacity-10 ${styles.bg}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${styles.text} mb-1`}>
          {label}
        </p>
        <p className="truncate text-lg font-black text-txt-base tracking-tight">
          {run.agentRunner}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[10px] font-bold text-txt-muted/60 uppercase">
          <span className="flex items-center gap-1">
            <Clock size={10} /> {(run.durationMs / 1000).toFixed(1)}s
          </span>
          <span>{new Date(run.timestamp).toLocaleDateString()}</span>
        </div>
      </div>
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.iconBg} ${styles.text}`}
      >
        <TrendingUp size={20} />
      </div>
    </button>
  );
}

/* ─── Helpers ─── */

function buildTrendData(sorted: LedgerRun[]) {
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

function buildDistribution(runs: LedgerRun[]) {
  const buckets = [
    { range: "0-20%", min: 0, max: 0.2, midpoint: 0.1, count: 0 },
    { range: "20-40%", min: 0.2, max: 0.4, midpoint: 0.3, count: 0 },
    { range: "40-60%", min: 0.4, max: 0.6, midpoint: 0.5, count: 0 },
    { range: "60-80%", min: 0.6, max: 0.8, midpoint: 0.7, count: 0 },
    { range: "80-100%", min: 0.8, max: 1.01, midpoint: 0.9, count: 0 },
  ];
  for (const run of runs) {
    const bucket = buckets.find((b) => run.score >= b.min && run.score < b.max);
    if (bucket) bucket.count++;
  }
  return buckets;
}
