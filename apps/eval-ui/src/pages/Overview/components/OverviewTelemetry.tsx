import { formatTokens } from "../../../lib/format";
import type { LedgerRun } from "../../../lib/api";

interface OverviewTelemetryProps {
  totalRunsCount: number;
  totalTokensCount: number;
  totalAgentTokens: number;
  totalJudgeTokens: number;
  distributionData: { name: string; value: number; color: string }[];
  intensiveTests: LedgerRun[];
}

export function OverviewTelemetry({
  totalRunsCount,
  totalTokensCount,
  totalAgentTokens,
  totalJudgeTokens,
  distributionData,
  intensiveTests,
}: OverviewTelemetryProps) {
  return (
    <div className="lg:col-span-1 flex flex-col gap-6 min-w-0">
      {/* Threshold Distribution Gauge */}
      <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm shadow-xl shadow-black/5 flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
            Distribution
          </h3>
          <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded border">
            {totalRunsCount} RUNS
          </span>
        </div>

        <div className="space-y-6">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-4 shadow-inner p-[1px]">
            {distributionData.map((item, i) => {
              const percentage = totalRunsCount > 0 ? (item.value / totalRunsCount) * 100 : 0;
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

          <div className="space-y-1">
            {distributionData.map((item) => (
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
                    {totalRunsCount > 0 ? Math.round((item.value / totalRunsCount) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resource Telemetry Dashboard */}
      <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm shadow-xl shadow-black/5 flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-txt-muted">
            Resource Telemetry
          </h3>
        </div>
        <div className="flex-1 space-y-6">
          {/* Main Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-surface-2/50 p-4 border">
              <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
                Total Volume
              </p>
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-lg sm:text-xl font-black text-txt-base">
                  {formatTokens(totalTokensCount)}
                </span>
                <span className="text-[10px] font-bold text-primary shrink-0">TOKENS</span>
              </div>
            </div>
            <div className="rounded-xl bg-surface-2/50 p-4 border">
              <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
                Avg per run
              </p>
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-lg sm:text-xl font-black text-txt-base">
                  {totalRunsCount > 0
                    ? formatTokens(Math.round(totalTokensCount / totalRunsCount))
                    : "0"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
              <span className="text-primary">Agent Usage</span>
              <span className="text-accent">Judge Usage</span>
            </div>
            <div className="h-2 w-full flex rounded-full overflow-hidden bg-surface-4 shadow-inner">
              <div
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${(totalAgentTokens / (totalTokensCount || 1)) * 100}%` }}
                title={`Agent: ${formatTokens(totalAgentTokens)}`}
              />
              <div
                className="h-full bg-accent transition-all duration-1000"
                style={{ width: `${(totalJudgeTokens / (totalTokensCount || 1)) * 100}%` }}
                title={`Judge: ${formatTokens(totalJudgeTokens)}`}
              />
            </div>
            <div className="flex justify-between text-[9px] font-bold text-txt-muted uppercase italic">
              <span>{formatTokens(totalAgentTokens)}</span>
              <span>{formatTokens(totalJudgeTokens)}</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-[10px] font-black text-txt-muted uppercase tracking-widest border-b pb-2">
              Most Intensive Tests
            </h4>
            <div className="space-y-2">
              {intensiveTests.map((run, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex flex-col min-w-0 max-w-[70%]">
                    <span className="text-[11px] font-bold text-txt-secondary truncate group-hover:text-primary transition-colors">
                      {run.testId}
                    </span>
                    <span className="text-[9px] font-medium text-txt-muted uppercase tracking-tighter">
                      {run.agentRunner}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-txt-base bg-surface-3 px-2 py-0.5 rounded tabular-nums border">
                    {formatTokens(run.agentTokenUsage?.totalTokens ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
