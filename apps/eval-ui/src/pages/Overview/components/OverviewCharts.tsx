import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RunnerDot, getRunnerColor } from "../../../components/RunsTable";
import { formatTokens } from "../../../lib/format";
import type { RunnerStats } from "../../../lib/api";

interface OverviewChartsProps {
  activeRunners: string[];
  trendData: Record<string, string | number>[];
  tokenTrendData: Record<string, string | number>[];
  stats: RunnerStats[];
}

export function OverviewCharts({
  activeRunners,
  trendData,
  tokenTrendData,
  stats,
}: OverviewChartsProps) {
  return (
    <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
      {/* Score trend - Main Chart */}
      <div className="rounded-2xl glass-card p-6 flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
            Score Trend
          </h3>
          <div className="flex gap-4 flex-wrap justify-end">
            {activeRunners.map((runner) => (
              <div key={runner} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: getRunnerColor(runner) }}
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
                    <linearGradient key={runner} id={`grad-${runner}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={getRunnerColor(runner)} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={getRunnerColor(runner)} stopOpacity={0} />
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
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  domain={[0, 1]}
                  stroke="hsl(var(--color-txt-muted))"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--color-primary))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--color-surface-2))",
                    border: "1px solid hsl(var(--color-line) / 0.2)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "hsl(var(--color-txt-base))" }}
                  labelStyle={{
                    color: "hsl(var(--color-txt-base))",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                />
                {activeRunners.map((runner) => (
                  <Area
                    key={runner}
                    type="monotone"
                    dataKey={runner}
                    stroke={getRunnerColor(runner)}
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
      <div className="rounded-2xl glass-card p-6 flex flex-col">
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
                  style={{ backgroundColor: getRunnerColor(runner) }}
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
                      <stop offset="0%" stopColor={getRunnerColor(runner)} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={getRunnerColor(runner)} stopOpacity={0} />
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
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="hsl(var(--color-txt-muted))"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatTokens(v)}
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--color-primary))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--color-surface-2))",
                    border: "1px solid hsl(var(--color-line) / 0.2)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "hsl(var(--color-txt-base))" }}
                  labelStyle={{
                    color: "hsl(var(--color-txt-base))",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                />
                {activeRunners.map((runner) => (
                  <Area
                    key={runner}
                    type="monotone"
                    dataKey={runner}
                    stroke={getRunnerColor(runner)}
                    fill={`url(#token-grad-${runner})`}
                    strokeWidth={3}
                    dot={{
                      r: 3,
                      fill: getRunnerColor(runner),
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
      <div className="rounded-2xl glass-card p-6">
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
                  className="group flex items-center gap-4 rounded-xl p-3 border bg-surface-2/40 transition-colors hover:bg-surface-2"
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
  );
}
