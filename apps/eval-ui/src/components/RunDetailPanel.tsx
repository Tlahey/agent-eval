import { useState, useEffect, useCallback } from "react";
import {
  X,
  MessageSquareText,
  Lightbulb,
  GitBranch,
  Terminal,
  Pencil,
  History,
  Coins,
  Clock,
  FileText,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import type { LedgerRun, ScoreOverride } from "../lib/api";
import { overrideScore, fetchOverrides } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { DiffViewer } from "./DiffViewer";
import { OverrideScoreModal } from "./OverrideScoreModal";

type Tab = "reason" | "improvement" | "diff" | "commands" | "tasks" | "metrics" | "history";

interface Props {
  run: LedgerRun;
  onClose: () => void;
  onOverride?: () => void;
}

function CommandsViewer({ commands }: { commands: LedgerRun["commands"] }) {
  if (!commands || commands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-txt-muted">
        <Terminal size={32} className="mb-2 opacity-40" />
        <p className="text-sm">No commands recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {commands.map((cmd, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border bg-surface-1">
          <div className="flex items-center justify-between bg-surface-2 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  cmd.exitCode === 0 ? "bg-ok/20 text-ok" : "bg-err/20 text-err"
                }`}
              >
                {cmd.exitCode === 0 ? "✓" : "✗"}
              </span>
              <span className="text-sm font-medium text-txt-base">{cmd.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-txt-muted">
              <code className="rounded bg-surface-3 px-1.5 py-0.5">{cmd.command}</code>
              <span>{(cmd.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
          {(cmd.stdout || cmd.stderr) && (
            <pre className="max-h-48 overflow-auto bg-surface-0 p-3 font-mono text-xs leading-relaxed text-txt-secondary">
              {cmd.stdout}
              {cmd.stderr && <span className="text-err">{cmd.stderr}</span>}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function TasksViewer({ run }: { run: LedgerRun }) {
  if (!run.taskResults || run.taskResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-txt-muted">
        <ListChecks size={32} className="mb-2 opacity-40" />
        <p className="text-sm">No tasks recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {run.taskResults.map((tr, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border bg-surface-1">
          <div className="flex items-center justify-between bg-surface-2 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  tr.result.exitCode === 0 ? "bg-ok/20 text-ok" : "bg-err/20 text-err"
                }`}
              >
                {tr.result.exitCode === 0 ? "✓" : "✗"}
              </span>
              <span className="text-sm font-medium text-txt-base">{tr.task.name}</span>
              {tr.task.weight && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  ×{tr.task.weight}
                </span>
              )}
            </div>
            <span className="text-xs text-txt-muted">
              {(tr.result.durationMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="px-4 py-2 text-xs text-txt-muted italic">{tr.task.criteria}</div>
          {(tr.result.stdout || tr.result.stderr) && (
            <pre className="max-h-32 overflow-auto border-t border-border bg-surface-0 p-3 font-mono text-xs leading-relaxed text-txt-secondary">
              {tr.result.stdout}
              {tr.result.stderr && <span className="text-err">{tr.result.stderr}</span>}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function MetricsViewer({ run }: { run: LedgerRun }) {
  const agentTokens = run.agentTokenUsage;
  const judgeTokens = run.judgeTokenUsage;
  const totalTokens = (agentTokens?.totalTokens ?? 0) + (judgeTokens?.totalTokens ?? 0);
  const timing = run.timing;

  return (
    <div className="space-y-4">
      {/* Token Usage */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-txt-base">
          <Coins size={13} /> Token Usage
        </h4>
        {totalTokens > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {agentTokens && (
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-[10px] uppercase tracking-wider text-txt-muted">Agent</p>
                <p className="mt-1 text-lg font-bold text-primary">
                  {agentTokens.totalTokens.toLocaleString()}
                </p>
                <div className="mt-1 flex gap-3 text-[10px] text-txt-muted">
                  <span>↑ {agentTokens.inputTokens.toLocaleString()}</span>
                  <span>↓ {agentTokens.outputTokens.toLocaleString()}</span>
                </div>
              </div>
            )}
            {judgeTokens && (
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-[10px] uppercase tracking-wider text-txt-muted">Judge</p>
                <p className="mt-1 text-lg font-bold text-accent">
                  {judgeTokens.totalTokens.toLocaleString()}
                </p>
                <div className="mt-1 flex gap-3 text-[10px] text-txt-muted">
                  <span>↑ {judgeTokens.inputTokens.toLocaleString()}</span>
                  <span>↓ {judgeTokens.outputTokens.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-txt-muted">No token data available</p>
        )}
      </div>

      {/* Timing Breakdown */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-txt-base">
          <Clock size={13} /> Timing Breakdown
        </h4>
        <TimingBar timing={timing} />
      </div>

      {/* Changed Files */}
      {run.changedFiles && run.changedFiles.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-txt-base">
            <FileText size={13} /> Changed Files ({run.changedFiles.length})
          </h4>
          <div className="rounded-lg bg-surface-2 p-3">
            {run.changedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <FileText size={11} className="text-primary" />
                <span className="font-mono text-xs text-txt-secondary">{f}</span>
              </div>
            ))}
          </div>
          {run.expectedFiles && run.expectedFiles.length > 0 && (
            <div className="mt-2 rounded-lg bg-surface-2 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-txt-muted">
                Expected scope
              </p>
              {run.expectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <CheckCircle2
                    size={11}
                    className={run.changedFiles.includes(f) ? "text-ok" : "text-err"}
                  />
                  <span className="font-mono text-xs text-txt-secondary">{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Criteria */}
      {run.criteria && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-txt-base">Judge Criteria</h4>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-txt-secondary">
              {run.criteria}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimingBar({ timing }: { timing: LedgerRun["timing"] }) {
  const phases = [
    { key: "setupMs", label: "Setup", color: "#6366f1", value: timing.setupMs },
    { key: "agentMs", label: "Agent", color: "#f59e0b", value: timing.agentMs },
    { key: "tasksMs", label: "Tasks", color: "#34d399", value: timing.tasksMs },
    { key: "judgeMs", label: "Judge", color: "#a78bfa", value: timing.judgeMs },
  ].filter((p) => p.value && p.value > 0);

  if (phases.length === 0) {
    return (
      <div className="rounded-lg bg-surface-2 p-3">
        <p className="text-xs text-txt-muted">Total: {(timing.totalMs / 1000).toFixed(1)}s</p>
      </div>
    );
  }

  const total = timing.totalMs || 1;

  return (
    <div className="rounded-lg bg-surface-2 p-3">
      {/* Stacked bar */}
      <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-surface-4">
        {phases.map((p) => (
          <div
            key={p.key}
            style={{ width: `${((p.value! / total) * 100).toFixed(1)}%`, backgroundColor: p.color }}
            className="h-full"
            title={`${p.label}: ${(p.value! / 1000).toFixed(1)}s`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-txt-muted">
        {phases.map((p) => (
          <span key={p.key} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.label}: {(p.value! / 1000).toFixed(1)}s
          </span>
        ))}
        <span className="ml-auto font-medium text-txt-secondary">
          Total: {(total / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

const TABS: { key: Tab; icon: typeof MessageSquareText; label: string }[] = [
  { key: "reason", icon: MessageSquareText, label: "Reason" },
  { key: "improvement", icon: Lightbulb, label: "Improve" },
  { key: "diff", icon: GitBranch, label: "Diff" },
  { key: "commands", icon: Terminal, label: "Cmds" },
  { key: "tasks", icon: ListChecks, label: "Tasks" },
  { key: "metrics", icon: Coins, label: "Metrics" },
  { key: "history", icon: History, label: "History" },
];

export function RunDetailPanel({ run, onClose, onOverride }: Props) {
  const [tab, setTab] = useState<Tab>("diff");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrides, setOverrides] = useState<ScoreOverride[]>([]);

  const cmdCount = run.commands?.length ?? 0;
  const taskCount = run.taskResults?.length ?? 0;
  const effectiveScore = run.override?.score ?? run.score;
  const effectiveStatus = run.override?.status ?? run.status ?? (run.pass ? "PASS" : "FAIL");

  const loadOverrides = useCallback(() => {
    if (run.id != null) {
      fetchOverrides(run.id)
        .then(setOverrides)
        .catch(() => {});
    }
  }, [run.id]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  const handleOverrideSubmit = async (score: number, reason: string) => {
    if (run.id == null) return;
    await overrideScore(run.id, score, reason);
    setShowOverrideModal(false);
    loadOverrides();
    onOverride?.();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[var(--panel-width)] max-w-[90vw] flex-col border-l border-border bg-surface-1 shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border px-5 py-4">
          <ScoreRing value={effectiveScore} size={52} strokeWidth={4} />
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-sm font-bold text-txt-base">{run.testId}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {run.agentRunner}
              </span>
              <span>{run.judgeModel}</span>
              <span>{(run.durationMs / 1000).toFixed(1)}s</span>
              {(run.agentTokenUsage || run.judgeTokenUsage) && (
                <span className="inline-flex items-center gap-1">
                  <Coins size={10} />
                  {(
                    (run.agentTokenUsage?.totalTokens ?? 0) +
                    (run.judgeTokenUsage?.totalTokens ?? 0)
                  ).toLocaleString()}{" "}
                  tok
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  effectiveStatus === "PASS"
                    ? "bg-ok/10 text-ok"
                    : effectiveStatus === "WARN"
                      ? "bg-warn/10 text-warn"
                      : "bg-err/10 text-err"
                }`}
              >
                {effectiveStatus}
              </span>
              {run.override && (
                <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[10px] font-semibold text-warn">
                  Adjusted
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-txt-muted">
              {new Date(run.timestamp).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => setShowOverrideModal(true)}
            className="rounded-lg p-1.5 text-txt-muted transition-colors hover:bg-surface-3 hover:text-primary"
            title="Override score"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-txt-muted transition-colors hover:bg-surface-3 hover:text-txt-base"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                tab === key ? "text-primary" : "text-txt-muted hover:text-txt-secondary"
              }`}
            >
              <Icon size={13} />
              {label}
              {key === "commands" && cmdCount > 0 && (
                <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px]">
                  {cmdCount}
                </span>
              )}
              {key === "tasks" && taskCount > 0 && (
                <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px]">
                  {taskCount}
                </span>
              )}
              {tab === key && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {tab === "reason" && (
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-txt-secondary">
                {run.reason}
              </p>
            </div>
          )}

          {tab === "improvement" && (
            <div className="rounded-lg border border-warn/20 bg-warn/5 p-4">
              {run.improvement ? (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb size={14} className="text-warn" />
                    <span className="text-xs font-semibold text-warn">Suggestions</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-txt-secondary">
                    {run.improvement}
                  </p>
                </>
              ) : (
                <p className="text-sm text-txt-muted italic">No improvement suggestions.</p>
              )}
            </div>
          )}

          {tab === "diff" && <DiffViewer diff={run.diff} />}

          {tab === "commands" && <CommandsViewer commands={run.commands} />}

          {tab === "tasks" && <TasksViewer run={run} />}

          {tab === "metrics" && <MetricsViewer run={run} />}

          {tab === "history" && (
            <div className="space-y-3">
              {overrides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-txt-muted">
                  <History size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">No score overrides</p>
                </div>
              ) : (
                overrides.map((o, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface-2 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ScoreRing value={o.score} size={28} strokeWidth={3} />
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            o.pass ? "bg-ok/10 text-ok" : "bg-err/10 text-err"
                          }`}
                        >
                          {o.pass ? "PASS" : "FAIL"}
                        </span>
                      </div>
                      <span className="text-[10px] text-txt-muted">
                        {new Date(o.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-txt-secondary">{o.reason}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {showOverrideModal && (
          <OverrideScoreModal
            currentScore={effectiveScore}
            onSubmit={handleOverrideSubmit}
            onClose={() => setShowOverrideModal(false)}
          />
        )}
      </div>
    </>
  );
}
