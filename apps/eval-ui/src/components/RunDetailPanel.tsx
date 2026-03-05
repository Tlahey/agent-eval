import { useState, useEffect } from "react";
import {
  X,
  MessageSquareText,
  ClipboardCheck,
  Lightbulb,
  GitBranch,
  Bot,
  Pencil,
  Coins,
  Clock,
  FileText,
  ListChecks,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import type { LedgerRun } from "../lib/api";
import { overrideScore, fetchRuns } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { DiffViewer } from "./DiffViewer";
import { OverrideScoreModal } from "./OverrideScoreModal";
import { Markdown } from "./Markdown";

type Tab = "summary" | "diff" | "tasks" | "metrics" | "history";

interface Props {
  run: LedgerRun;
  onClose: () => void;
  onOverride?: () => void;
}

function TasksViewer({ run }: { run: LedgerRun }) {
  if (!run.taskResults || run.taskResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-txt-muted">
        <ListChecks size={32} className="mb-2 opacity-40" />
        <p className="text-sm font-medium">No verification tasks recorded</p>
        <p className="mt-1 max-w-[200px] text-[11px] leading-relaxed opacity-60">
          Use <code className="text-primary">ctx.addTask()</code> to register automated checks (like
          tests or builds) that the judge will evaluate.
        </p>
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
  const [history, setHistory] = useState<LedgerRun[]>([]);
  const agentTokens = run.agentTokenUsage;
  const judgeTokens = run.judgeTokenUsage;
  const totalTokens = (agentTokens?.totalTokens ?? 0) + (judgeTokens?.totalTokens ?? 0);
  const timing = run.timing;

  useEffect(() => {
    fetchRuns(run.testId)
      .then((runs) => {
        const filtered = runs
          .filter((r) => r.agentRunner === run.agentRunner)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        setHistory(filtered);
      })
      .catch(() => {});
  }, [run.testId, run.agentRunner]);

  const trendData = history.map((r) => ({
    value: r.agentTokenUsage?.totalTokens ?? 0,
  }));

  const lastTokens =
    history.length > 1 ? (history[history.length - 2].agentTokenUsage?.totalTokens ?? 0) : 0;
  const currentTokens = agentTokens?.totalTokens ?? 0;
  const diff = currentTokens - lastTokens;
  const percentChange = lastTokens > 0 ? ((diff / lastTokens) * 100).toFixed(0) : null;

  return (
    <div className="space-y-6">
      {/* Token Usage Section */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-txt-base">
            <Coins size={14} className="text-primary" /> Token Usage
          </h4>
          {totalTokens > 0 && (
            <span className="text-[10px] font-medium text-txt-muted">
              Total: <span className="text-txt-base">{totalTokens.toLocaleString()}</span>
            </span>
          )}
        </div>

        {totalTokens > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Agent Card */}
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
                <div className="absolute -right-2 -top-2 opacity-10">
                  <Bot size={48} className="text-primary" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Bot size={12} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Agent
                    </span>
                  </div>
                  {percentChange !== null && history.length > 1 && (
                    <div
                      className={`flex items-center gap-0.5 text-[10px] font-bold ${diff > 0 ? "text-err" : "text-ok"}`}
                    >
                      {diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {Math.abs(Number(percentChange))}%
                    </div>
                  )}
                </div>
                {agentTokens ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-txt-muted flex items-center gap-1">
                          <ArrowUp size={10} className="text-primary/60" /> In
                        </span>
                        <p className="text-xl font-black tabular-nums text-txt-base leading-none">
                          {agentTokens.inputTokens.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end text-right gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-txt-muted flex items-center gap-1">
                          Out <ArrowDown size={10} className="text-primary" />
                        </span>
                        <p className="text-xl font-black tabular-nums text-txt-base leading-none">
                          {agentTokens.outputTokens.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-3 border-t border-primary/10 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">
                        Total
                      </span>
                      <p className="text-xl font-black tabular-nums text-primary leading-none">
                        {agentTokens.totalTokens.toLocaleString()}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs italic text-txt-muted py-2">No agent data</p>
                )}
              </div>

              {/* Judge Card */}
              <div className="relative overflow-hidden rounded-xl border border-accent/20 bg-accent/5 p-4 transition-colors hover:bg-accent/10">
                <div className="absolute -right-2 -top-2 opacity-10">
                  <ListChecks size={48} className="text-accent" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <ListChecks size={12} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    Judge
                  </span>
                </div>
                {judgeTokens ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-txt-muted flex items-center gap-1">
                          <ArrowUp size={10} className="text-accent/60" /> In
                        </span>
                        <p className="text-xl font-black tabular-nums text-txt-base leading-none">
                          {judgeTokens.inputTokens.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end text-right gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-txt-muted flex items-center gap-1">
                          Out <ArrowDown size={10} className="text-accent" />
                        </span>
                        <p className="text-xl font-black tabular-nums text-txt-base leading-none">
                          {judgeTokens.outputTokens.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-3 border-t border-accent/10 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-accent/60">
                        Total
                      </span>
                      <p className="text-xl font-black tabular-nums text-accent leading-none">
                        {judgeTokens.totalTokens.toLocaleString()}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs italic text-txt-muted py-2">No judge data</p>
                )}
              </div>
            </div>

            {/* Agent Token Trend Sparkline */}
            {trendData.length > 1 && (
              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-txt-muted">
                  Agent Token Trend
                </p>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={["dataMin - 100", "dataMax + 100"]} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-primary)"
                        fillOpacity={1}
                        fill="url(#colorTokens)"
                        strokeWidth={2}
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-txt-muted">
            <Coins size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs italic">No token consumption recorded</p>
          </div>
        )}
      </section>

      {/* Timing Breakdown Section */}
      <section>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-txt-base">
          <Clock size={14} className="text-warn" /> Execution Time
        </h4>
        <TimingBar timing={timing} />
      </section>

      {/* Changed Files Section */}
      {run.changedFiles && run.changedFiles.length > 0 && (
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-txt-base">
            <FileText size={14} className="text-primary" /> Repository Impact
          </h4>
          <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
            <div className="grid grid-cols-1 divide-y divide-border">
              {run.changedFiles.map((f, i) => {
                const isExpected = run.expectedFiles?.includes(f);
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText
                        size={12}
                        className={isExpected ? "text-primary" : "text-txt-muted"}
                      />
                      <span className="truncate font-mono text-txt-secondary">{f}</span>
                    </div>
                    {isExpected && (
                      <span className="flex-shrink-0 rounded bg-ok/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-ok">
                        In Scope
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {run.expectedFiles &&
              run.expectedFiles.some((ef) => !run.changedFiles.includes(ef)) && (
                <div className="bg-err/5 px-4 py-2 border-t border-err/10">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-err opacity-70">
                    Missing from scope
                  </p>
                  {run.expectedFiles
                    .filter((ef) => !run.changedFiles.includes(ef))
                    .map((f, i) => (
                      <div key={i} className="flex items-center gap-3 py-1 opacity-60">
                        <FileText size={12} className="text-err" />
                        <span className="font-mono text-[11px] text-err line-through decoration-err/30">
                          {f}
                        </span>
                      </div>
                    ))}
                </div>
              )}
          </div>
        </section>
      )}

      {/* Criteria Section */}
      {run.criteria && (
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-txt-base">
            Original Criteria
          </h4>
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-txt-secondary">
              {run.criteria}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function TimingBar({ timing }: { timing: LedgerRun["timing"] }) {
  const phases = [
    { key: "setupMs", label: "Setup", color: "rgb(99, 102, 241)", value: timing.setupMs },
    { key: "agentMs", label: "Agent", color: "rgb(245, 158, 11)", value: timing.agentMs },
    { key: "tasksMs", label: "Tasks", color: "rgb(52, 211, 153)", value: timing.tasksMs },
    { key: "judgeMs", label: "Judge", color: "rgb(167, 139, 250)", value: timing.judgeMs },
  ].filter((p) => p.value && p.value > 0);

  if (phases.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-txt-muted">Total duration</span>
          <span className="text-sm font-bold text-txt-base">
            {(timing.totalMs / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    );
  }

  const total = timing.totalMs || 1;

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      {/* Stacked bar */}
      <div className="mb-4 flex h-4 overflow-hidden rounded-lg bg-surface-4 shadow-inner">
        {phases.map((p) => (
          <div
            key={p.key}
            style={{ width: `${((p.value! / total) * 100).toFixed(1)}%`, backgroundColor: p.color }}
            className="h-full transition-all duration-500 ease-out"
            title={`${p.label}: ${(p.value! / 1000).toFixed(1)}s`}
          />
        ))}
      </div>
      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {phases.map((p) => (
          <div key={p.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-[11px] font-medium text-txt-muted">{p.label}</span>
            </div>
            <span className="text-[11px] font-bold text-txt-secondary tabular-nums">
              {(p.value! / 1000).toFixed(1)}s
            </span>
          </div>
        ))}
        <div className="col-span-2 mt-1 border-t border-border pt-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-txt-muted">
            Total
          </span>
          <span className="text-sm font-black text-txt-base">{(total / 1000).toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}

const TABS: { key: Tab; icon: any; label: string }[] = [
  { key: "summary", icon: ClipboardCheck, label: "Summary" },
  { key: "diff", icon: GitBranch, label: "Diff" },
  { key: "tasks", icon: ListChecks, label: "Tasks" },
  { key: "metrics", icon: Coins, label: "Metrics" },
];

export function RunDetailPanel({ run, onClose, onOverride }: Props) {
  const [tab, setTab] = useState<Tab>("summary");
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const taskCount = run.taskResults?.length ?? 0;
  const effectiveScore = run.override?.score ?? run.score;
  const effectiveStatus = run.override?.status ?? run.status ?? (run.pass ? "PASS" : "FAIL");

  const handleOverrideSubmit = async (score: number, reason: string) => {
    if (run.id == null) return;
    await overrideScore(run.id, score, reason);
    setShowOverrideModal(false);
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
          {tab === "summary" && (
            <div className="space-y-4">
              {/* Score Reason Section */}
              <section className="rounded-xl border border-border bg-surface-2 overflow-hidden">
                <div className="flex items-center gap-2 bg-surface-3 px-4 py-2 border-b border-border">
                  <MessageSquareText size={14} className="text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-txt-base">
                    Score Reason
                  </h3>
                </div>
                <div className="p-4">
                  <Markdown content={run.reason} />
                </div>
              </section>

              {/* How to Improve Section */}
              <section
                className={`rounded-xl border border-warn/20 bg-warn/5 overflow-hidden ${!run.improvement && "opacity-50"}`}
              >
                <div className="flex items-center gap-2 bg-warn/10 px-4 py-2 border-b border-warn/10">
                  <Lightbulb size={14} className="text-warn" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-warn">
                    How to Improve
                  </h3>
                </div>
                <div className="p-4">
                  {run.improvement ? (
                    <Markdown content={run.improvement} />
                  ) : (
                    <p className="text-sm italic text-txt-muted">
                      {run.score === 1
                        ? "Perfect score! No improvements needed."
                        : "The judge did not provide specific improvement suggestions."}
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === "diff" && <DiffViewer diff={run.diff} />}

          {tab === "tasks" && <TasksViewer run={run} />}

          {tab === "metrics" && <MetricsViewer run={run} />}
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
