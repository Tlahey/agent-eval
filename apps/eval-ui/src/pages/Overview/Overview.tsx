import { useOverview } from "./useOverview";
import { OverviewHeader } from "./components/OverviewHeader";
import { OverviewKPIs } from "./components/OverviewKPIs";
import { OverviewCharts } from "./components/OverviewCharts";
import { OverviewTelemetry } from "./components/OverviewTelemetry";
import { OverviewActivity } from "./components/OverviewActivity";

export function Overview() {
  const {
    loading,
    allRuns,
    totalRunsCount,
    avgScore,
    passCount,
    avgDuration,
    totalTokensCount,
    totalAgentTokens,
    totalJudgeTokens,
    recentRuns,
    trendData,
    tokenTrendData,
    activeRunners,
    distributionData,
    stats,
    intensiveTests,
    timeRange,
    setTimeRange,
    setSelectedRun,
  } = useOverview();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg shadow-primary/20" />
      </div>
    );
  }

  if (allRuns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <p className="text-txt-muted font-bold">No evaluation runs found</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      <OverviewHeader timeRange={timeRange} setTimeRange={setTimeRange} />

      <OverviewKPIs
        totalRunsCount={totalRunsCount}
        avgScore={avgScore}
        passCount={passCount}
        avgDuration={avgDuration}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
        <OverviewCharts
          activeRunners={activeRunners}
          trendData={trendData}
          tokenTrendData={tokenTrendData}
          stats={stats}
        />

        <OverviewTelemetry
          totalRunsCount={totalRunsCount}
          totalTokensCount={totalTokensCount}
          totalAgentTokens={totalAgentTokens}
          totalJudgeTokens={totalJudgeTokens}
          distributionData={distributionData}
          intensiveTests={intensiveTests}
        />
      </div>

      <OverviewActivity recentRuns={recentRuns} setSelectedRun={setSelectedRun} />
    </div>
  );
}
