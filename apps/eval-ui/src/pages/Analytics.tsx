import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchRuns, fetchStats, type LedgerRun, type RunnerStats } from "../lib/api";

interface ChartDataPoint {
  timestamp: string;
  [runner: string]: string | number;
}

function buildChartData(runs: LedgerRun[]): ChartDataPoint[] {
  return runs
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((run) => ({
      timestamp: new Date(run.timestamp).toLocaleDateString(),
      [run.agentRunner]: run.score,
    }));
}

const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "#8b5cf6",
  "#ec4899",
];

export function Analytics() {
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

  if (loading) return <p className="text-text-muted">Loading…</p>;

  const runners = [...new Set(runs.map((r) => r.agentRunner))];
  const chartData = buildChartData(runs);

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.agentRunner} className="rounded-lg border border-border bg-surface-alt p-4">
            <h3 className="text-sm font-medium text-text-muted">{s.agentRunner}</h3>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-text-base">
                {(s.avgScore * 100).toFixed(0)}%
              </span>
              <span className="text-sm text-text-muted">avg score</span>
            </div>
            <div className="mt-1 flex gap-4 text-xs text-text-muted">
              <span>{s.totalRuns} runs</span>
              <span className={s.passRate >= 0.7 ? "text-success" : "text-danger"}>
                {(s.passRate * 100).toFixed(0)}% pass rate
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Score Over Time Chart */}
      <div className="rounded-lg border border-border bg-surface-alt p-6">
        <h3 className="mb-4 text-sm font-medium text-text-muted">Score Over Time</h3>
        {runs.length === 0 ? (
          <p className="text-center text-text-muted">No data to chart yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="timestamp" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis domain={[0, 1]} stroke="var(--color-text-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              {runners.map((runner, i) => (
                <Line
                  key={runner}
                  type="monotone"
                  dataKey={runner}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
