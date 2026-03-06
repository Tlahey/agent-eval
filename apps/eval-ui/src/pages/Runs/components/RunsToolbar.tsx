import { Search, Filter, LayoutGrid } from "lucide-react";
import { Select, SortButton } from "./RunsUI";
import type { SortField, SortDir } from "../useRuns";

interface RunsToolbarProps {
  search: string;
  testFilter: string;
  runnerFilter: string;
  sortField: SortField;
  sortDir: SortDir;
  testIds: string[];
  runners: string[];
  updateParams: (updates: Record<string, string | null>) => void;
  toggleSort: (field: SortField) => void;
}

export function RunsToolbar({
  search,
  testFilter,
  runnerFilter,
  sortField,
  sortDir,
  testIds,
  runners,
  updateParams,
  toggleSort,
}: RunsToolbarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="relative group md:col-span-1">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted group-focus-within:text-primary transition-colors"
        />
        <input
          type="text"
          placeholder="Search test ID or agent..."
          value={search}
          onChange={(e) => updateParams({ q: e.target.value })}
          className="w-full h-12 rounded-xl border bg-surface-2 pl-11 pr-4 text-sm font-bold text-txt-base placeholder:text-txt-muted/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all shadow-inner"
        />
      </div>

      <div className="md:col-span-1">
        <Select
          value={testFilter}
          onChange={(v) => updateParams({ testId: v })}
          options={[
            { value: "", label: "Filter by Evaluation" },
            ...testIds.map((id) => ({ value: id, label: id })),
          ]}
          icon={<Filter size={16} />}
        />
      </div>

      <div className="md:col-span-1">
        <Select
          value={runnerFilter}
          onChange={(v) => updateParams({ runner: v })}
          options={[
            { value: "", label: "Filter by Agent Runner" },
            ...runners.map((r) => ({ value: r, label: r })),
          ]}
          icon={<LayoutGrid size={16} />}
        />
      </div>

      <div className="md:col-span-1 flex items-center gap-2">
        <SortButton
          field="timestamp"
          label="Time"
          current={sortField}
          dir={sortDir}
          onClick={toggleSort}
        />
        <SortButton
          field="score"
          label="Score"
          current={sortField}
          dir={sortDir}
          onClick={toggleSort}
        />
      </div>
    </div>
  );
}
