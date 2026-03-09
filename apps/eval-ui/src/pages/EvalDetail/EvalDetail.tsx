import { useEvalDetail } from "./useEvalDetail";
import { EvalHeader } from "./components/EvalHeader";
import { EvalHistory } from "./components/EvalHistory";
import { VariantGrid } from "./components/VariantGrid";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { EvalCharts } from "./components/EvalCharts";
import { FlaskConical } from "lucide-react";

export function EvalDetail() {
  const {
    testId,
    loading,
    allRuns,
    variants,
    runners,
    currentRuns,
    totalRunsCount,
    totalPages,
    currentPage,
    variantStats,
    comparison,
    compareA,
    compareB,
    trendData,
    radarData,
    distributionData,
    variantFilter,
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
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg shadow-primary/20" />
      </div>
    );
  }

  if (allRuns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 animate-fade-in">
        <div className="h-16 w-16 rounded-2xl bg-surface-2 flex items-center justify-center border border-line/20">
          <FlaskConical size={32} className="text-txt-muted opacity-20" />
        </div>
        <p className="text-txt-muted font-black uppercase tracking-widest text-sm">
          No evaluation runs found
        </p>
      </div>
    );
  }

  const handleCompare = (variant: string) => {
    if (compareA === variant) {
      updateParams({ compareA: null });
    } else if (compareB === variant) {
      updateParams({ compareB: null });
    } else if (!compareA) {
      updateParams({ compareA: variant });
    } else if (!compareB) {
      updateParams({ compareB: variant });
    } else {
      updateParams({ compareB: variant });
    }
  };

  return (
    <div className="p-8 space-y-10 max-w-[1600px] mx-auto animate-fade-in">
      <EvalHeader
        testId={testId}
        totalRunsCount={allRuns.length}
        variantsCount={variants.length}
        avgScoreTotal={allRuns.reduce((s, r) => s + r.score, 0) / allRuns.length}
        passCountTotal={allRuns.filter((r) => r.pass).length}
      />

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-black text-txt-muted uppercase tracking-[0.2em]">
            Experiment Variations
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-line/30 to-transparent" />
        </div>

        <VariantGrid
          stats={variantStats}
          compareA={compareA}
          compareB={compareB}
          onCompare={handleCompare}
        />
      </section>

      {comparison && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-black text-txt-muted uppercase tracking-[0.2em]">
              Variant Delta Analysis
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-line/30 to-transparent" />
          </div>
          <ComparisonPanel comparison={comparison} />
        </section>
      )}

      {/* Re-integrated Analytics Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-black text-txt-muted uppercase tracking-[0.2em]">
            Deep Analytics
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-line/30 to-transparent" />
        </div>

        <EvalCharts
          runners={runners}
          trendData={trendData}
          radarData={radarData}
          distributionData={distributionData}
        />
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-black text-txt-muted uppercase tracking-[0.2em]">
            Run History
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-line/30 to-transparent" />
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
      </section>
    </div>
  );
}
