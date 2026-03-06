import { useEvalDetail } from "./useEvalDetail";
import { EvalHeader } from "./components/EvalHeader";
import { EvalCharts } from "./components/EvalCharts";
import { EvalSidebar } from "./components/EvalSidebar";
import { EvalHistory } from "./components/EvalHistory";

export function EvalDetail() {
  const {
    testId,
    loading,
    allRuns,
    runners,
    currentRuns,
    totalRunsCount,
    totalPages,
    currentPage,
    avgScoreTotal,
    passCountTotal,
    trendData,
    radarData,
    distributionData,
    runnerStats,
    bestWorst,
    runnerFilter,
    statusFilter,
    sortField,
    sortDir,
    updateParams,
    toggleSort,
    setSelectedRun,
  } = useEvalDetail();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
      <EvalHeader
        testId={testId}
        totalRunsCount={totalRunsCount}
        runnersCount={runners.length}
        avgScoreTotal={avgScoreTotal}
        passCountTotal={passCountTotal}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <EvalCharts
          runners={runners}
          trendData={trendData}
          radarData={radarData}
          distributionData={distributionData}
        />

        <EvalSidebar
          runnerStats={runnerStats}
          bestWorst={bestWorst}
          setSelectedRun={setSelectedRun}
        />
      </div>

      <EvalHistory
        currentRuns={currentRuns}
        totalRunsCount={totalRunsCount}
        totalPages={totalPages}
        currentPage={currentPage}
        runners={runners}
        runnerFilter={runnerFilter}
        statusFilter={statusFilter}
        sortField={sortField}
        sortDir={sortDir}
        updateParams={updateParams}
        toggleSort={toggleSort}
        setSelectedRun={setSelectedRun}
      />
    </div>
  );
}
