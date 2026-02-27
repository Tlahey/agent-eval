import type { LedgerRun } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { Clock, Bot } from "lucide-react";

interface Props {
  runs: LedgerRun[];
  onSelect: (run: LedgerRun) => void;
  compact?: boolean;
}

export function RunsTable({ runs, onSelect, compact }: Props) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2 py-12">
        <Bot size={36} className="mb-3 text-txt-muted opacity-40" />
        <p className="text-sm text-txt-muted">No evaluation runs yet</p>
        <p className="mt-1 text-xs text-txt-muted">
          Run <code className="rounded bg-surface-3 px-1.5 py-0.5">agenteval run</code> to get
          started
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            {!compact && (
              <th className="px-4 py-2.5 text-left text-xs font-medium text-txt-muted">Eval</th>
            )}
            <th className="px-4 py-2.5 text-left text-xs font-medium text-txt-muted">Agent</th>
            <th className="w-16 px-4 py-2.5 text-center text-xs font-medium text-txt-muted">
              Score
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-txt-muted">Status</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-txt-muted">Duration</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-txt-muted">When</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => (
            <tr
              key={run.id ?? i}
              onClick={() => onSelect(run)}
              className="group cursor-pointer border-b border-border/50 transition-colors hover:bg-surface-2/70"
            >
              {!compact && (
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-txt-base group-hover:text-primary transition-colors">
                    {run.testId}
                  </span>
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <RunnerDot runner={run.agentRunner} />
                  <span className="text-sm text-txt-secondary">{run.agentRunner}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreRing value={run.score} size={32} strokeWidth={3} />
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    run.pass ? "bg-ok/10 text-ok" : "bg-err/10 text-err"
                  }`}
                >
                  <span className={`h-1 w-1 rounded-full ${run.pass ? "bg-ok" : "bg-err"}`} />
                  {run.pass ? "Pass" : "Fail"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex items-center gap-1 text-xs text-txt-muted">
                  <Clock size={11} />
                  {(run.durationMs / 1000).toFixed(1)}s
                </span>
              </td>
              <td className="px-4 py-3 text-right text-xs text-txt-muted">
                {timeAgo(run.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RUNNER_COLORS: Record<string, string> = {
  copilot: "#6366f1",
  cursor: "#f59e0b",
  "claude-code": "#34d399",
  aider: "#f87171",
};

export function RunnerDot({ runner, size = 8 }: { runner: string; size?: number }) {
  const color = RUNNER_COLORS[runner] ?? "#94a3b8";
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
