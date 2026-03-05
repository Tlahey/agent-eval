import type { LedgerRun } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { Bot } from "lucide-react";

interface Props {
  runs: LedgerRun[];
  onSelect: (run: LedgerRun) => void;
  compact?: boolean;
}

const RUNNER_COLORS: Record<string, string> = {
  copilot: "hsl(265, 90%, 70%)",
  cursor: "hsl(190, 90%, 60%)",
  "claude-code": "hsl(160, 85%, 55%)",
  aider: "hsl(350, 90%, 65%)",
};

export function RunsTable({ runs, onSelect, compact }: Props) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-surface-1/40 py-16 backdrop-blur-sm">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 shadow-inner">
          <Bot size={32} className="text-txt-muted opacity-20" />
        </div>
        <p className="text-sm font-bold text-txt-base">No evaluation runs found</p>
        <p className="mt-1 text-xs font-medium text-txt-muted">
          Execute{" "}
          <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-primary">
            agenteval run
          </code>{" "}
          to begin
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse table-fixed min-w-[800px]">
        <thead>
          <tr className="bg-surface-2/50 backdrop-blur-md">
            {!compact && (
              <th className="w-[35%] px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
                Evaluation
              </th>
            )}
            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Agent
            </th>
            <th className="w-28 px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Score
            </th>
            <th className="w-32 px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Status
            </th>
            <th className="w-32 px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Metrics
            </th>
            <th className="w-28 px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {runs.map((run, i) => (
            <tr
              key={run.id ?? i}
              onClick={() => onSelect(run)}
              className="group cursor-pointer transition-all duration-200 hover:bg-primary/5 active:scale-[0.995]"
            >
              {!compact && (
                <td className="px-6 pt-8 pb-6 align-top">
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-bold text-txt-base group-hover:text-primary transition-colors truncate">
                      {run.testId}
                    </span>
                    <span className="text-[10px] font-medium text-txt-muted truncate">
                      {run.suitePath.join(" / ")}
                    </span>
                  </div>
                </td>
              )}
              <td className="px-6 pt-8 pb-6 align-top">
                <span className="text-sm font-bold text-txt-secondary group-hover:text-txt-base transition-colors truncate block">
                  {run.agentRunner}
                </span>
              </td>
              <td className="px-6 align-middle">
                <div className="flex flex-col items-center">
                  <ScoreRing value={run.override?.score ?? run.score} size={36} strokeWidth={4} />
                  {run.override && (
                    <span className="mt-2 inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-500 border border-amber-500/20 shadow-sm leading-none whitespace-nowrap">
                      Adjusted
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 pt-8 pb-6 align-top">
                <StatusBadge run={run} />
              </td>
              <td className="px-6 pt-8 pb-6 text-right align-top">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-bold text-txt-base leading-none">
                    {(run.durationMs / 1000).toFixed(1)}s
                  </span>
                  <span className="text-[10px] font-medium text-txt-muted leading-none">
                    {run.agentTokenUsage
                      ? `${formatTokens(run.agentTokenUsage.totalTokens)} tokens`
                      : "N/A"}
                  </span>
                </div>
              </td>
              <td className="px-6 pt-8 pb-6 text-right align-top">
                <span className="text-[11px] font-bold text-txt-muted group-hover:text-txt-secondary transition-colors">
                  {timeAgo(run.timestamp)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

const STATUS_STYLES = {
  PASS: { bg: "bg-ok/10", text: "text-ok", dot: "bg-ok", label: "Above" },
  WARN: { bg: "bg-warn/10", text: "text-warn", dot: "bg-warn", label: "Warn" },
  FAIL: { bg: "bg-err/10", text: "text-err", dot: "bg-err", label: "Below" },
} as const;

export function StatusBadge({ run }: { run: LedgerRun }) {
  const effectiveStatus = run.override?.status ?? run.status ?? (run.pass ? "PASS" : "FAIL");
  const style = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.FAIL;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
