import type { LedgerRun } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { Bot } from "lucide-react";

interface Props {
  runs: LedgerRun[];
  onSelect: (run: LedgerRun) => void;
  compact?: boolean;
}

export const RUNNER_COLORS: Record<string, string> = {
  copilot: "hsl(var(--color-primary))",
  cursor: "hsl(var(--color-primary))",
  "claude-code": "hsl(var(--color-ok))",
  aider: "hsl(var(--color-err))",
};

const EXTRA_COLORS = [
  "hsl(200, 80%, 60%)",
  "hsl(280, 80%, 60%)",
  "hsl(30, 90%, 60%)",
  "hsl(120, 60%, 50%)",
  "hsl(190, 70%, 50%)",
  "hsl(330, 80%, 60%)",
];

export function getRunnerColor(runner: string): string {
  if (RUNNER_COLORS[runner]) return RUNNER_COLORS[runner];
  let hash = 0;
  for (let i = 0; i < runner.length; i++) {
    hash = runner.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % EXTRA_COLORS.length;
  return EXTRA_COLORS[index];
}

export function RunsTable({ runs, onSelect, compact }: Props) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-surface-1/40 py-16 backdrop-blur-sm">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 shadow-inner">
          <Bot size={32} className="text-txt-muted opacity-20" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-txt-muted">
          No evaluation runs found
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-txt-muted/40 mt-1">
          agenteval run
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border/50 text-left">
            {!compact && (
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
                Evaluation
              </th>
            )}
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Agent
            </th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Score
            </th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Status
            </th>
            {!compact && (
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
                Metrics
              </th>
            )}
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted text-right">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/30">
          {runs.map((run) => (
            <tr
              key={run.id}
              onClick={() => onSelect(run)}
              className="group cursor-pointer transition-colors hover:bg-surface-2/40"
            >
              {!compact && (
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-txt-base group-hover:text-primary transition-colors">
                      {run.testId}
                    </span>
                    <span className="text-[9px] font-bold text-txt-muted uppercase tracking-tighter mt-0.5">
                      {run.agentRunner}
                    </span>
                  </div>
                </td>
              )}
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <RunnerDot runner={run.agentRunner} />
                  <span className="text-[11px] font-bold text-txt-secondary uppercase tracking-wider">
                    {run.agentRunner}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <ScoreRing value={run.override?.score ?? run.score} size={32} strokeWidth={3} />
                  {run.override && (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-amber-500 border-amber-500/20">
                      Adjusted
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge run={run} />
              </td>
              {!compact && (
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-txt-muted">
                      <Bot size={10} className="text-primary opacity-50" />
                      {formatTokens(run.agentTokenUsage?.totalTokens ?? 0)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-txt-muted">
                      <span className="w-2.5 text-center opacity-50">⏱</span>
                      {(run.durationMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                </td>
              )}
              <td className="px-6 py-4 text-right">
                <span className="text-[10px] font-black text-txt-muted uppercase tabular-nums">
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
  const color = getRunnerColor(runner);
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

function timeAgo(date: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const mins = Math.floor(seconds / 60);
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
