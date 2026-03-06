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
import { getRunnerColor } from "../../../components/RunsTable";

interface EvalChartsProps {
  runners: string[];
  trendData: Record<string, string | number>[];
  radarData: Record<string, string | number>[];
  distributionData: { range: string; midpoint: number; count: number }[];
}

export function EvalCharts({ runners, trendData, radarData, distributionData }: EvalChartsProps) {
  return (
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
                itemStyle={{ color: "hsl(var(--color-txt-base))" }}
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
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 0, right: 30, bottom: 0, left: 30 }}>
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
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "hsl(var(--color-txt-base))" }}
                  labelStyle={{
                    color: "hsl(var(--color-txt-base))",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: "20px",
                    fontSize: "9px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
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
              <BarChart data={distributionData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
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
                  itemStyle={{ color: "hsl(var(--color-txt-base))" }}
                  labelStyle={{
                    color: "hsl(var(--color-txt-base))",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                />
                <Bar dataKey="count" barSize={40}>
                  {distributionData.map((d, i) => (
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
  );
}
