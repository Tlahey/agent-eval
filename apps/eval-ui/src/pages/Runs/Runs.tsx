import { useRuns } from "./useRuns";
import { RunsHeader } from "./components/RunsHeader";
import { RunsToolbar } from "./components/RunsToolbar";
import { RunsTableSection } from "./components/RunsTableSection";

export function Runs() {
  const {
    loading,
    runs,
    testIds,
    runners,
    filtered,
    paginatedRuns,
    totalPages,
    currentPage,
    testFilter,
    runnerFilter,
    statusFilter,
    search,
    sortField,
    sortDir,
    updateParams,
    handleSelectRun,
    toggleSort,
  } = useRuns();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg shadow-primary/20" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <p className="text-txt-muted font-bold">No evaluation runs found</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      <RunsHeader
        filteredCount={filtered.length}
        totalCount={runs.length}
        statusFilter={statusFilter}
        updateParams={updateParams}
      />

      <RunsToolbar
        search={search}
        testFilter={testFilter}
        runnerFilter={runnerFilter}
        sortField={sortField}
        sortDir={sortDir}
        testIds={testIds}
        runners={runners}
        updateParams={updateParams}
        toggleSort={toggleSort}
      />

      <RunsTableSection
        runs={paginatedRuns}
        filteredCount={filtered.length}
        totalPages={totalPages}
        currentPage={currentPage}
        onSelectRun={handleSelectRun}
        updateParams={updateParams}
      />
    </div>
  );
}
