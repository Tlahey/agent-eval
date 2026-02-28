import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { fetchRuns, fetchStats, type LedgerRun, type RunnerStats } from "../lib/api";
import { RunsTable, RunnerDot } from "../components/RunsTable";
import { ScoreRing } from "../components/ScoreRing";
import type { AppContext } from "../App";

const RUNNER_COLORS: Record<string, string> = {
  copilot: "#6366f1",
  cursor: "#f59e0b",
  "claude-code": "#34d399",
  aider: "#f87171",
};

function getColor(runner: string): string {
  return RUNNER_COLORS[runner] ?? "#94a3b8";
}

export function Overview() {
  const { setSelectedRun } = useOutletContext<AppContext>();
  const [runs, setRuns] = useState<LedgerRun[]>([]);
  const [stats, setStats] = useState<RunnerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchRuns(), fetchStats()])
      .then(([r, s]) => {
        setRuns(r);
        setStats(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalRuns = runs.length;
  const passCount = runs.filter((r) => r.status === "PASS" || (!r.status && r.pass)).length;
  const warnCount = runs.filter((r) => r.status === "WARN").length;
  const failCount = runs.filter((r) => r.status === "FAIL" || (!r.status && !r.pass)).length;
  const avgScore = totalRuns > 0 ? runs.reduce((s, r) => s + r.score, 0) / totalRuns : 0;
  const recentRuns = [...runs].slice(0, 8);

  // Score trend data
  const trendData = buildTrendData(runs);

  // Pass/warn/fail donut
  const pieData = [
    { name: "Pass", value: passCount, color: "var(--color-success)" },
    { name: "Warn", value: warnCount, color: "var(--color-warning)" },
    { name: "Fail", value: failCount, color: "var(--color-danger)" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-txt-base">Dashboard</h1>
        <p className="text-sm text-txt-muted">Overview of all evaluation results</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard
          icon={<BarChart3 size={18} />}
          label="Total Runs"
          value={totalRuns.toString()}
          accent="primary"
        />
        <KPICard
          icon={<TrendingUp size={18} />}
          label="Avg Score"
          value={`${(avgScore * 100).toFixed(1)}%`}
          accent={avgScore >= 0.7 ? "ok" : avgScore >= 0.5 ? "warn" : "err"}
        />
        <KPICard
          icon={<CheckCircle2 size={18} />}
          label="Pass Rate"
          value={totalRuns > 0 ? `${((passCount / totalRuns) * 100).toFixed(0)}%` : "—"}
          accent="ok"
          sub={`${passCount} passed`}
        />
        <KPICard
          icon={<AlertTriangle size={18} />}
          label="Warnings"
          value={warnCount.toString()}
          accent={warnCount > 0 ? "warn" : "ok"}
          sub={
            warnCount > 0
              ? `${((warnCount / totalRuns) * 100).toFixed(0)}% warn rate`
              : "No warnings"
          }
        />
        <KPICard
          icon={<XCircle size={18} />}
          label="Failures"
          value={failCount.toString()}
          accent={failCount > 0 ? "err" : "ok"}
          sub={
            failCount > 0
              ? `${((failCount / totalRuns) * 100).toFixed(0)}% fail rate`
              : "Clean slate!"
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Score trend */}
        <div className="col-span-2 rounded-xl border border-border bg-surface-1 p-5">
          <h3 className="mb-4 text-sm font-semibold text-txt-base">Score Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  {Object.entries(RUNNER_COLORS).map(([runner, color]) => (
                    <linearGradient key={runner} id={`grad-${runner}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
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
                  labelStyle={{ color: "var(--color-text-base)" }}
                />
                {Object.entries(RUNNER_COLORS).map(([runner, color]) => (
                  <Area
                    key={runner}
                    type="monotone"
                    dataKey={runner}
                    stroke={color}
                    fill={`url(#grad-${runner})`}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-txt-muted">Not enough data</p>
          )}
        </div>

        {/* Pass / Fail + Runner ranking */}
        <div className="flex flex-col gap-4">
          {/* Pass/Fail donut */}
          <div className="rounded-xl border border-border bg-surface-1 p-5">
            <h3 className="mb-2 text-sm font-semibold text-txt-base">Pass / Warn / Fail</h3>
            <div className="flex items-center justify-center">
              <PieChart width={120} height={120}>
                <Pie
                  data={pieData}
                  cx={60}
                  cy={60}
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="ml-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-ok" />
                  <span className="text-txt-secondary">{passCount} Pass</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-warn" />
                  <span className="text-txt-secondary">{warnCount} Warn</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full bg-err" />
                  <span className="text-txt-secondary">{failCount} Fail</span>
                </div>
              </div>
            </div>
          </div>

          {/* Runner ranking */}
          <div className="flex-1 rounded-xl border border-border bg-surface-1 p-5">
            <h3 className="mb-3 text-sm font-semibold text-txt-base">Runner Ranking</h3>
            <div className="space-y-3">
              {stats
                .sort((a, b) => b.avgScore - a.avgScore)
                .map((s, i) => (
                  <div key={s.agentRunner} className="flex items-center gap-3">
                    <span className="w-4 text-center text-xs font-bold text-txt-muted">
                      {i + 1}
                    </span>
                    <RunnerDot runner={s.agentRunner} />
                    <span className="flex-1 text-sm text-txt-secondary">{s.agentRunner}</span>
                    <ScoreRing value={s.avgScore} size={28} strokeWidth={2.5} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-runner bar chart */}
      <div className="rounded-xl border border-border bg-surface-1 p-5">
        <h3 className="mb-4 text-sm font-semibold text-txt-base">Average Score by Runner</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats.sort((a, b) => b.avgScore - a.avgScore)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 1]} stroke="var(--color-text-muted)" fontSize={11} />
            <YAxis
              type="category"
              dataKey="agentRunner"
              stroke="var(--color-text-muted)"
              fontSize={12}
              width={100}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Avg Score"]}
            />
            <Bar dataKey="avgScore" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {stats.map((s) => (
                <Cell key={s.agentRunner} fill={getColor(s.agentRunner)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent runs */}
      <div className="rounded-xl border border-border bg-surface-1 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-txt-base">Recent Runs</h3>
          <Link
            to="/runs"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <RunsTable runs={recentRuns} onSelect={setSelectedRun} />
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function KPICard({
  icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "primary" | "ok" | "err" | "warn";
  sub?: string;
}) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    ok: { bg: "bg-ok/10", text: "text-ok" },
    err: { bg: "bg-err/10", text: "text-err" },
    warn: { bg: "bg-warn/10", text: "text-warn" },
  };
  const c = colorMap[accent];

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:border-border-hover">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${c.bg} ${c.text}`}>{icon}</div>
        <div>
          <p className="text-xs text-txt-muted">{label}</p>
          <p className={`text-xl font-bold ${c.text}`}>{value}</p>
          {sub && <p className="text-[10px] text-txt-muted">{sub}</p>}
        </div>
      </div>
    </div>
  );
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
