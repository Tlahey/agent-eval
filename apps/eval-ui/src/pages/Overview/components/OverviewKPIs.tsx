import { BarChart3, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { KPICard } from "./KPICard";

interface OverviewKPIsProps {
  totalRunsCount: number;
  avgScore: number;
  passCount: number;
  avgDuration: number;
}

export function OverviewKPIs({
  totalRunsCount,
  avgScore,
  passCount,
  avgDuration,
}: OverviewKPIsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        icon={<BarChart3 size={20} />}
        label="Total Runs"
        value={totalRunsCount.toString()}
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
        value={totalRunsCount > 0 ? `${((passCount / totalRunsCount) * 100).toFixed(0)}%` : "—"}
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
  );
}
