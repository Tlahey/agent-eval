import { useEffect, useState, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Clock,
  Calendar,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchRuns, type LedgerRun, type RunnerStats } from "../lib/api";
import { RunsTable, RunnerDot } from "../components/RunsTable";
import type { AppContext } from "../App";

const RUNNER_COLORS: Record<string, string> = {
  copilot: "#a855f7",
  cursor: "#3b82f6",
  "claude-code": "#10b981",
  aider: "#ef4444",
};

type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "All Time", value: "all" },
];

export function Overview() {
  const { setSelectedRun } = useOutletContext<AppContext>();
  const [allRuns, setAllRuns] = useState<LedgerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  useEffect(() => {
    fetchRuns()
      .then(setAllRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredRuns = useMemo(() => {
    if (timeRange === "all") return allRuns;
    const now = new Date();
    const threshold = new Date();
    if (timeRange === "24h") threshold.setHours(now.getHours() - 24);
    else if (timeRange === "7d") threshold.setDate(now.getDate() - 7);
    else if (timeRange === "30d") threshold.setDate(now.getDate() - 30);
    else if (timeRange === "90d") threshold.setDate(now.getDate() - 90);
    return allRuns.filter((r) => new Date(r.timestamp) >= threshold);
  }, [allRuns, timeRange]);

  const stats = useMemo(() => {
    const runnerStatsMap = new Map<
      string,
      { totalScore: number; count: number; passCount: number }
    >();
    for (const run of filteredRuns) {
      if (!runnerStatsMap.has(run.agentRunner)) {
        runnerStatsMap.set(run.agentRunner, { totalScore: 0, count: 0, passCount: 0 });
      }
      const s = runnerStatsMap.get(run.agentRunner)!;
      s.totalScore += run.score;
      s.count += 1;
      if (run.status === "PASS" || (!run.status && run.pass)) s.passCount += 1;
    }
    return Array.from(runnerStatsMap.entries()).map(([agentRunner, s]) => ({
      agentRunner,
      totalRuns: s.count,
      avgScore: s.totalScore / s.count,
      passRate: s.passCount / s.count,
    })) as RunnerStats[];
  }, [filteredRuns]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg shadow-primary/20" />
      </div>
    );
  }

  const totalRuns = filteredRuns.length;
  const passCount = filteredRuns.filter((r) => r.status === "PASS" || (!r.status && r.pass)).length;
  const warnCount = filteredRuns.filter((r) => r.status === "WARN").length;
  const lowScoreCount = filteredRuns.filter(
    (r) => r.status === "FAIL" || (!r.status && !r.pass),
  ).length;
  const avgScore = totalRuns > 0 ? filteredRuns.reduce((s, r) => s + r.score, 0) / totalRuns : 0;
  const recentRuns = [...filteredRuns].slice(0, 8);

  const totalAgentTokens = filteredRuns.reduce(
    (s, r) => s + (r.agentTokenUsage?.totalTokens ?? 0),
    0,
  );
  const totalJudgeTokens = filteredRuns.reduce(
    (s, r) => s + (r.judgeTokenUsage?.totalTokens ?? 0),
    0,
  );
  const totalTokens = totalAgentTokens + totalJudgeTokens;
  const avgDuration =
    totalRuns > 0 ? filteredRuns.reduce((s, r) => s + r.durationMs, 0) / totalRuns : 0;

  const trendData = buildTrendData(filteredRuns);
  const tokenTrendData = buildTokenTrendData(filteredRuns);
  const activeRunners = Array.from(new Set(filteredRuns.map((r) => r.agentRunner)));

  const pieData = [
    { name: "Above Threshold", value: passCount, color: "#10b981" },
    { name: "Needs Review", value: warnCount, color: "#f59e0b" },
    { name: "Below Threshold", value: lowScoreCount, color: "#ef4444" },
  ];

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-txt-base tracking-tight mb-1">Dashboard</h1>
          <p className="text-sm text-txt-muted font-medium">
            Evaluation performance & insights overview
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={<BarChart3 size={20} />}
          label="Total Runs"
          value={totalRuns.toString()}
          accent="primary"
          trend="+12% vs prev"
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          label="Average Score"
          value={`${(avgScore * 100).toFixed(1)}%`}
          accent={avgScore >= 0.7 ? "ok" : avgScore >= 0.5 ? "warn" : "err"}
          sub="Global average"
        />
        <KPICard
          icon={<CheckCircle2 size={20} />}
          label="Pass Rate"
          value={totalRuns > 0 ? `${((passCount / totalRuns) * 100).toFixed(0)}%` : "—"}
          accent="ok"
          sub={`${passCount} tests passed`}
        />
        <KPICard
          icon={<Clock size={20} />}
          label="Avg Duration"
          value={avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : "—"}
          accent="primary"
          sub="Execution time"
        />
      </div>

      {/* Masonry Layout: 2 Columns for 0 gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
        {/* Left Column (Main Charts & Rankings) - Takes 2/3 width */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {/* Score trend - Main Chart */}
          <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
                Score Trend
              </h3>
              <div className="flex gap-4 flex-wrap justify-end">
                {activeRunners.map((runner) => (
                  <div key={runner} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: RUNNER_COLORS[runner] ?? "#a855f7" }}
                    />
                    <span className="text-[10px] font-bold text-txt-muted uppercase">{runner}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full h-[220px]">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      {activeRunners.map((runner) => (
                        <linearGradient
                          key={runner}
                          id={`grad-${runner}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={RUNNER_COLORS[runner] ?? "#a855f7"}
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="100%"
                            stopColor={RUNNER_COLORS[runner] ?? "#a855f7"}
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
                      cursor={{ stroke: "#a855f7", strokeWidth: 1, strokeDasharray: "4 4" }}
                      contentStyle={{
                        backgroundColor: "#0e1120",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                        fontSize: 12,
                      }}
                      itemStyle={{ padding: "2px 0" }}
                      labelStyle={{ color: "#f8fafc", fontWeight: 700, marginBottom: 8 }}
                    />
                    {activeRunners.map((runner) => (
                      <Area
                        key={runner}
                        type="monotone"
                        dataKey={runner}
                        stroke={RUNNER_COLORS[runner] ?? "#a855f7"}
                        fill={`url(#grad-${runner})`}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        connectNulls
                        animationDuration={1500}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm font-medium text-txt-muted italic">
                    Not enough data for this period
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Token Usage Chart per Runner */}
          <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
                  Token Consumption
                </h3>
                <p className="text-[10px] font-bold text-txt-muted/60 uppercase">
                  Average tokens per execution
                </p>
              </div>
              <div className="flex gap-3">
                {activeRunners.map((runner) => (
                  <div key={runner} className="flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: RUNNER_COLORS[runner] ?? "#a855f7" }}
                    />
                    <span className="text-[9px] font-black text-txt-muted uppercase">{runner}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full h-[220px]">
              {tokenTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={tokenTrendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      {activeRunners.map((runner) => (
                        <linearGradient
                          key={runner}
                          id={`token-grad-${runner}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={RUNNER_COLORS[runner] ?? "#a855f7"}
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="100%"
                            stopColor={RUNNER_COLORS[runner] ?? "#a855f7"}
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
                      stroke="#64748b"
                      fontSize={11}
                      fontWeight={600}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatTokens(v)}
                    />
                    <Tooltip
                      cursor={{ stroke: "#a855f7", strokeWidth: 1 }}
                      contentStyle={{
                        backgroundColor: "#0e1120",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#f8fafc", fontWeight: 700, marginBottom: 8 }}
                    />
                    {activeRunners.map((runner) => (
                      <Area
                        key={runner}
                        type="monotone"
                        dataKey={runner}
                        stroke={RUNNER_COLORS[runner] ?? "#a855f7"}
                        fill={`url(#token-grad-${runner})`}
                        strokeWidth={3}
                        dot={{
                          r: 3,
                          fill: RUNNER_COLORS[runner] ?? "#a855f7",
                          strokeWidth: 0,
                        }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls
                        animationDuration={2000}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm font-medium text-txt-muted italic">Not enough token data</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Ranking */}
          <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-widest text-txt-muted">
              Performance Ranking
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.length > 0 ? (
                stats
                  .sort((a, b) => b.avgScore - a.avgScore)
                  .map((s, i) => (
                    <div
                      key={s.agentRunner}
                      className="group flex items-center gap-4 rounded-xl p-3 border border-slate-800/50 bg-surface-2/40 transition-colors hover:bg-surface-2"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs font-bold text-txt-muted group-hover:bg-primary group-hover:text-white transition-colors">
                        {i + 1}
                      </span>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <RunnerDot runner={s.agentRunner} />
                            <span className="truncate text-sm font-bold text-txt-base">
                              {s.agentRunner}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {(s.avgScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
                            style={{ width: `${s.avgScore * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="py-4 text-center text-xs font-medium text-txt-muted italic col-span-full">
                  No runner data
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Metrics & Distribution) - Takes 1/3 width */}
        <div className="lg:col-span-1 flex flex-col gap-6 min-w-0">
          {/* Threshold Distribution Gauge */}
          <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
                Distribution
              </h3>
              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-slate-800">
                {totalRuns} RUNS
              </span>
            </div>

            <div className="space-y-6">
              {/* The Gauge Bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-4 shadow-inner p-[1px]">
                {pieData.map((item, i) => {
                  const percentage = totalRuns > 0 ? (item.value / totalRuns) * 100 : 0;
                  if (percentage === 0) return null;
                  return (
                    <div
                      key={i}
                      style={{ width: `${percentage}%`, backgroundColor: item.color }}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-1000 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                      title={`${item.name}: ${item.value} (${percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>

              {/* Detailed Legend */}
              <div className="space-y-1">
                {pieData.map((item) => (
                  <div
                    key={item.name}
                    className="group flex items-center justify-between gap-4 p-2 rounded-xl transition-all hover:bg-surface-3/50"
                    title={`${item.name}: ${item.value} executions`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span
                        className="h-2 w-2 rounded-full shrink-0 shadow-sm"
                        style={{
                          backgroundColor: item.color,
                          boxShadow: `0 0 10px ${item.color}44`,
                        }}
                      />
                      <span className="text-[10px] font-black text-txt-secondary uppercase tracking-wider truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-txt-base">{item.value}</span>
                      <span className="text-[9px] font-bold text-txt-muted w-8 text-right">
                        {totalRuns > 0 ? Math.round((item.value / totalRuns) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resource Telemetry Dashboard */}
          <div className="rounded-2xl border border-slate-800 bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-xl shadow-black/5 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
                Resource Telemetry
              </h3>
            </div>

            <div className="flex-1 space-y-6">
              {/* Main Stats Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-surface-2/50 p-4 border border-slate-800/50">
                  <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
                    Total Volume
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-txt-base">
                      {formatTokens(totalTokens)}
                    </span>
                    <span className="text-[10px] font-bold text-primary">TOKENS</span>
                  </div>
                </div>
                <div className="rounded-xl bg-surface-2/50 p-4 border border-slate-800/50">
                  <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
                    Avg per run
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-txt-base">
                      {totalRuns > 0 ? formatTokens(Math.round(totalTokens / totalRuns)) : "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Agent vs Judge Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-primary">Agent Usage</span>
                  <span className="text-accent">Judge Usage</span>
                </div>
                <div className="h-2 w-full flex rounded-full overflow-hidden bg-surface-4 shadow-inner">
                  <div
                    className="h-full bg-primary transition-all duration-1000"
                    style={{ width: `${(totalAgentTokens / (totalTokens || 1)) * 100}%` }}
                    title={`Agent: ${formatTokens(totalAgentTokens)}`}
                  />
                  <div
                    className="h-full bg-accent transition-all duration-1000"
                    style={{ width: `${(totalJudgeTokens / (totalTokens || 1)) * 100}%` }}
                    title={`Judge: ${formatTokens(totalJudgeTokens)}`}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-txt-muted uppercase italic">
                  <span>{formatTokens(totalAgentTokens)}</span>
                  <span>{formatTokens(totalJudgeTokens)}</span>
                </div>
              </div>

              {/* Top Consuming Tests */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black text-txt-muted uppercase tracking-widest border-b border-slate-800/50 pb-2">
                  Most Intensive Tests
                </h4>
                <div className="space-y-2">
                  {filteredRuns
                    .sort(
                      (a, b) =>
                        (b.agentTokenUsage?.totalTokens ?? 0) -
                        (a.agentTokenUsage?.totalTokens ?? 0),
                    )
                    .slice(0, 3)
                    .map((run, i) => (
                      <div key={i} className="flex items-center justify-between group">
                        <div className="flex flex-col min-w-0 max-w-[70%]">
                          <span className="text-[11px] font-bold text-txt-secondary truncate group-hover:text-primary transition-colors">
                            {run.testId}
                          </span>
                          <span className="text-[9px] font-medium text-txt-muted uppercase tracking-tighter">
                            {run.agentRunner}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-txt-base bg-surface-3 px-2 py-0.5 rounded tabular-nums border border-slate-800/50">
                          {formatTokens(run.agentTokenUsage?.totalTokens ?? 0)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity */}
      <div className="rounded-2xl border border-slate-800 bg-surface-1/40 backdrop-blur-sm card-hover shadow-xl shadow-black/5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
              Recent Activity
            </h3>
            <p className="text-[10px] font-bold text-txt-muted/60 uppercase">
              Latest evaluation executions
            </p>
          </div>
          <Link
            to="/runs"
            className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-xs font-bold text-txt-base transition-colors hover:bg-primary hover:text-white border border-slate-800"
          >
            View Full Ledger <ArrowRight size={14} />
          </Link>
        </div>
        <div>
          <RunsTable runs={recentRuns} onSelect={setSelectedRun} />
        </div>
      </div>
    </div>
  );
}

/* ─── Components ─── */

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = TIME_RANGES.find((r) => r.value === value)?.label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 rounded-xl border border-slate-800 bg-surface-2 px-4 py-2.5 text-sm font-bold text-txt-base transition-all hover:border-primary/50 hover:shadow-lg shadow-inner"
      >
        <Calendar size={16} className="text-primary" />
        {activeLabel}
        <ChevronDown
          size={14}
          className={`text-txt-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-56 origin-top-right rounded-xl border border-slate-800 bg-surface-2 p-1.5 shadow-2xl animate-scale-in">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  onChange(r.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                  value === r.value
                    ? "bg-primary text-white"
                    : "text-txt-secondary hover:bg-surface-3 hover:text-txt-base"
                }`}
              >
                {r.label}
                {value === r.value && <CheckCircle2 size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  accent,
  sub,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "primary" | "ok" | "err" | "warn";
  sub?: string;
  trend?: string;
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    ok: { bg: "bg-ok/10", text: "text-ok", border: "border-ok/20" },
    err: { bg: "bg-err/10", text: "text-err", border: "border-err/20" },
    warn: { bg: "bg-warn/10", text: "text-warn", border: "border-warn/20" },
  };
  const c = colorMap[accent];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${c.border} bg-surface-1/40 p-6 backdrop-blur-sm card-hover shadow-lg shadow-black/5`}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${c.bg} ${c.text} shadow-inner`}>{icon}</div>
        {trend && (
          <span className="text-[10px] font-black text-ok uppercase tracking-tighter">{trend}</span>
        )}
      </div>
      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-txt-muted mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-txt-base tracking-tight">{value}</p>
        </div>
        {sub && <p className="mt-1 text-xs font-bold text-txt-muted/70">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
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

function buildTokenTrendData(runs: LedgerRun[]) {
  const sorted = [...runs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const grouped = new Map<string, Map<string, number[]>>();
  for (const run of sorted) {
    if (!run.agentTokenUsage) continue;
    const date = new Date(run.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!grouped.has(date)) grouped.set(date, new Map());
    const runners = grouped.get(date)!;
    if (!runners.has(run.agentRunner)) runners.set(run.agentRunner, []);
    runners.get(run.agentRunner)!.push(run.agentTokenUsage.totalTokens);
  }
  return Array.from(grouped.entries()).map(([date, runners]) => {
    const point: Record<string, string | number> = { date };
    for (const [runner, tokens] of runners) {
      point[runner] = Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length);
    }
    return point;
  });
}
