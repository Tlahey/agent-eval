import { useEffect, useState, useMemo } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { TrendingUp, BarChart3, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
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
import { Link } from "react-router-dom";

const RUNNER_COLORS: Record<string, string> = {
  copilot: "#6366f1",
  cursor: "#f59e0b",
  "claude-code": "#34d399",
  aider: "#f87171",
};

export function EvalDetail() {
  const { testId: rawTestId } = useParams<{ testId: string }>();
  const testId = decodeURIComponent(rawTestId ?? "");
  const { setSelectedRun } = useOutletContext<AppContext>();
  const [runs, setRuns] = useState<LedgerRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchRuns(testId)
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const runners = useMemo(() => [...new Set(runs.map((r) => r.agentRunner))], [runs]);
  const sorted = useMemo(
    () =>
      [...runs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [runs],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Aggregates
  const totalRuns = runs.length;
  const passCount = runs.filter((r) => r.pass).length;
  const failCount = totalRuns - passCount;
  const avgScore = totalRuns > 0 ? runs.reduce((s, r) => s + r.score, 0) / totalRuns : 0;
  const avgDuration = totalRuns > 0 ? runs.reduce((s, r) => s + r.durationMs, 0) / totalRuns : 0;
  const bestRun = runs.reduce((best, r) => (r.score > (best?.score ?? 0) ? r : best), runs[0]);
  const worstRun = runs.reduce((worst, r) => (r.score < (worst?.score ?? 1) ? r : worst), runs[0]);

  // Per runner stats for this eval
  const runnerStats = runners
    .map((runner) => {
      const rRuns = runs.filter((r) => r.agentRunner === runner);
      return {
        runner,
        avgScore: rRuns.reduce((s, r) => s + r.score, 0) / rRuns.length,
        passRate: rRuns.filter((r) => r.pass).length / rRuns.length,
        avgDuration: rRuns.reduce((s, r) => s + r.durationMs, 0) / rRuns.length,
        count: rRuns.length,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  // Trend data per runner
  const trendData = buildTrendData(sorted);

  // Radar chart: per-runner score, pass rate, speed (inverted duration)
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
        runnerStats.map((r) => [r.runner, +((1 - r.avgDuration / maxDuration) * 100).toFixed(1)]),
      ),
    },
  ];

  // Score distribution histogram
  const distribution = buildDistribution(runs);

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/" className="text-txt-muted hover:text-txt-secondary transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="text-xs text-txt-muted">/</span>
        <span className="text-xs text-txt-muted">Evaluations</span>
        <span className="text-xs text-txt-muted">/</span>
        <span className="text-sm font-semibold text-txt-base">{testId}</span>
      </div>

      {/* Title + quick stats */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-txt-base">{testId}</h1>
          <p className="mt-1 text-sm text-txt-muted">
            {totalRuns} runs across {runners.length} runners
          </p>
        </div>
        <ScoreRing value={avgScore} size={72} strokeWidth={5} label="avg" />
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKPI icon={<BarChart3 size={14} />} label="Runs" value={totalRuns.toString()} />
        <MiniKPI
          icon={<CheckCircle2 size={14} />}
          label="Pass Rate"
          value={`${((passCount / totalRuns) * 100).toFixed(0)}%`}
          color="ok"
        />
        <MiniKPI
          icon={<XCircle size={14} />}
          label="Failures"
          value={failCount.toString()}
          color={failCount > 0 ? "err" : "ok"}
        />
        <MiniKPI
          icon={<Clock size={14} />}
          label="Avg Duration"
          value={`${(avgDuration / 1000).toFixed(1)}s`}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Score trend per runner */}
        <div className="rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-txt-base">Score Trend per Runner</h3>
          <ResponsiveContainer width="100%" height={240}>
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
                    <stop
                      offset="0%"
                      stopColor={RUNNER_COLORS[runner] ?? "#94a3b8"}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={RUNNER_COLORS[runner] ?? "#94a3b8"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                stroke="var(--color-text-muted)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                stroke="var(--color-text-muted)"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              {runners.map((runner) => (
                <Area
                  key={runner}
                  type="monotone"
                  dataKey={runner}
                  stroke={RUNNER_COLORS[runner] ?? "#94a3b8"}
                  fill={`url(#eval-grad-${runner})`}
                  strokeWidth={2}
                  dot={{ r: 3, fill: RUNNER_COLORS[runner] ?? "#94a3b8" }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radar comparison */}
        <div className="rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-txt-base">Runner Comparison</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="metric" stroke="var(--color-text-muted)" fontSize={11} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {runners.map((runner) => (
                <Radar
                  key={runner}
                  name={runner}
                  dataKey={runner}
                  stroke={RUNNER_COLORS[runner] ?? "#94a3b8"}
                  fill={RUNNER_COLORS[runner] ?? "#94a3b8"}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution */}
        <div className="rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-txt-base">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="range" stroke="var(--color-text-muted)" fontSize={11} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {distribution.map((d) => (
                  <Cell
                    key={d.range}
                    fill={
                      d.midpoint >= 0.8
                        ? "var(--color-success)"
                        : d.midpoint >= 0.6
                          ? "var(--color-warning)"
                          : "var(--color-danger)"
                    }
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Runner cards */}
        <div className="rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-txt-base">Per-Runner Breakdown</h3>
          <div className="space-y-3">
            {runnerStats.map((rs) => (
              <div key={rs.runner} className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
                <RunnerDot runner={rs.runner} size={10} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-txt-base">{rs.runner}</span>
                    <ScoreRing value={rs.avgScore} size={30} strokeWidth={2.5} />
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-surface-4">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${rs.avgScore * 100}%`,
                          backgroundColor: RUNNER_COLORS[rs.runner] ?? "#94a3b8",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-txt-muted w-10 text-right">
                      {rs.count} runs
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-txt-muted">
                    <span className="text-ok">{(rs.passRate * 100).toFixed(0)}% pass</span>
                    <span>{(rs.avgDuration / 1000).toFixed(1)}s avg</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best / Worst */}
      {bestRun && worstRun && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HighlightCard
            label="Best Run"
            run={bestRun}
            color="ok"
            onClick={() => setSelectedRun(bestRun)}
          />
          <HighlightCard
            label="Worst Run"
            run={worstRun}
            color="err"
            onClick={() => setSelectedRun(worstRun)}
          />
        </div>
      )}

      {/* All runs for this eval */}
      <div className="rounded-xl border border-border bg-surface-1 p-5">
        <h3 className="mb-4 text-sm font-semibold text-txt-base">All Runs</h3>
        <RunsTable runs={sorted.reverse()} onSelect={setSelectedRun} compact />
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function MiniKPI({
  icon,
  label,
  value,
  color = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: "primary" | "ok" | "err";
}) {
  const colors = {
    primary: "text-primary",
    ok: "text-ok",
    err: "text-err",
  };
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-2 text-txt-muted">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-1 text-lg font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}

function HighlightCard({
  label,
  run,
  color,
  onClick,
}: {
  label: string;
  run: LedgerRun;
  color: "ok" | "err";
  onClick: () => void;
}) {
  const border = color === "ok" ? "border-ok/30" : "border-err/30";
  const bg = color === "ok" ? "bg-ok/5" : "bg-err/5";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-xl border ${border} ${bg} p-4 text-left transition-colors hover:border-border-hover`}
    >
      <ScoreRing value={run.score} size={44} strokeWidth={3} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-txt-muted">{label}</p>
        <p className="truncate text-sm font-medium text-txt-base">{run.agentRunner}</p>
        <p className="text-[10px] text-txt-muted">{new Date(run.timestamp).toLocaleString()}</p>
      </div>
      <TrendingUp size={16} className={`text-${color}`} />
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
    { range: "0-20", min: 0, max: 0.2, midpoint: 0.1, count: 0 },
    { range: "20-40", min: 0.2, max: 0.4, midpoint: 0.3, count: 0 },
    { range: "40-60", min: 0.4, max: 0.6, midpoint: 0.5, count: 0 },
    { range: "60-80", min: 0.6, max: 0.8, midpoint: 0.7, count: 0 },
    { range: "80-100", min: 0.8, max: 1.01, midpoint: 0.9, count: 0 },
  ];
  for (const run of runs) {
    const bucket = buckets.find((b) => run.score >= b.min && run.score < b.max);
    if (bucket) bucket.count++;
  }
  return buckets;
}
