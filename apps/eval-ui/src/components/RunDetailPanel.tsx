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
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Zap,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import type { LedgerRun, TokenUsage } from "../lib/api";
import { overrideScore, fetchRuns } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { DiffViewer } from "./DiffViewer";
import { OverrideScoreModal } from "./OverrideScoreModal";
import { Markdown } from "./Markdown";

type Tab = "summary" | "diff" | "tasks" | "metrics";

interface Props {
  run: LedgerRun;
  onClose: () => void;
  onOverride?: () => void;
}

export function RunDetailPanel({ run, onClose, onOverride }: Props) {
  const [tab, setTab] = useState<Tab>("summary");
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const taskCount = run.taskResults?.length ?? 0;
  const changedFilesCount = run.changedFiles?.length ?? 0;
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
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-4 top-4 bottom-4 z-50 flex h-[calc(100vh-32px)] w-[var(--panel-width)] max-w-[95vw] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-surface-1 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-slide-in">
        {/* Modern Header */}
        <div className="relative overflow-hidden border-b border-slate-800 bg-surface-2/50 px-8 py-8 backdrop-blur-xl">
          {/* Background Accent */}
          <div
            className={`absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-10 blur-3xl ${effectiveStatus === "PASS" ? "bg-ok" : effectiveStatus === "WARN" ? "bg-warn" : "bg-err"}`}
          />

          <div className="relative flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <ScoreRing value={effectiveScore} size={80} strokeWidth={6} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-txt-base tracking-tight truncate max-w-[400px]">
                    {run.testId}
                  </h2>
                  <StatusBadge status={effectiveStatus} adjusted={!!run.override} />
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-txt-muted">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-3">
                    <Bot size={12} className="text-primary" />
                    {run.agentRunner}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-3">
                    <Zap size={12} className="text-accent" />
                    {run.judgeModel}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-3">
                    <Clock size={12} className="text-warn" />
                    {(run.durationMs / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowOverrideModal(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-surface-2 text-txt-muted transition-all hover:bg-primary hover:text-white hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                title="Override score"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-surface-2 text-txt-muted transition-all hover:bg-surface-3 hover:text-txt-base"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Improved Tabs Navigation */}
        <div className="flex border-b border-slate-800 bg-surface-1/50 px-4">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`group relative flex flex-1 items-center justify-center gap-2.5 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                tab === key ? "text-primary" : "text-txt-muted hover:text-txt-secondary"
              }`}
            >
              <Icon
                size={14}
                className={`transition-transform ${tab === key ? "scale-110" : "group-hover:scale-110"}`}
              />
              {label}
              {key === "tasks" && taskCount > 0 && (
                <span
                  className={`ml-1 rounded-md px-1.5 py-0.5 text-[9px] font-black ${tab === key ? "bg-primary text-white" : "bg-surface-3 text-txt-muted"}`}
                >
                  {taskCount}
                </span>
              )}
              {key === "diff" && changedFilesCount > 0 && (
                <span
                  className={`ml-1 rounded-md px-1.5 py-0.5 text-[9px] font-black ${tab === key ? "bg-primary text-white" : "bg-surface-3 text-txt-muted"}`}
                >
                  {changedFilesCount}
                </span>
              )}
              {tab === key && (
                <div className="absolute bottom-0 left-6 right-6 h-1 rounded-full bg-primary shadow-[0_-2px_8px_rgba(99,102,241,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div
          className={`flex-1 overflow-auto bg-transparent custom-scrollbar ${tab !== "diff" ? "p-8" : ""}`}
        >
          <div className={`mx-auto animate-fade-in ${tab !== "diff" ? "max-w-4xl" : "h-full"}`}>
            {tab === "summary" && <SummaryView run={run} />}
            {tab === "diff" && <DiffViewer diff={run.diff} />}
            {tab === "tasks" && <TasksViewer run={run} />}
            {tab === "metrics" && <MetricsViewer run={run} />}
          </div>
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

/* ─── Sub-Views ─── */

function SummaryView({ run }: { run: LedgerRun }) {
  return (
    <div className="space-y-8 pb-8">
      {/* Judgment Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareText size={18} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-txt-base">
            Judgment Analysis
          </h3>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface-2/40 p-8 backdrop-blur-sm shadow-inner prose prose-invert max-w-none">
          <Markdown content={run.reason} />
        </div>
      </section>

      {/* Improvement Strategy */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-warn/10 text-warn">
            <Lightbulb size={18} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-txt-base">
            Strategic Feedback
          </h3>
        </div>
        <div
          className={`rounded-2xl border border-warn/20 bg-warn/5 p-8 backdrop-blur-sm shadow-inner ${!run.improvement && "opacity-50"}`}
        >
          {run.improvement ? (
            <Markdown content={run.improvement} />
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-xs font-bold text-txt-muted uppercase italic tracking-wider">
                {run.score === 1
                  ? "Optimal solution achieved. No enhancements required."
                  : "The judge did not issue specific improvement directives."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Instruction Card */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-3 text-txt-muted">
            <ClipboardCheck size={18} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-txt-base">
            System Instruction
          </h3>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-surface-1/50 p-6 font-mono text-[11px] leading-relaxed text-txt-secondary border-dashed">
          {run.instruction}
        </div>
      </section>
    </div>
  );
}

function TasksViewer({ run }: { run: LedgerRun }) {
  if (!run.taskResults || run.taskResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-2 shadow-inner">
          <ListChecks size={40} className="text-txt-muted opacity-20" />
        </div>
        <h4 className="text-sm font-black text-txt-base uppercase tracking-widest">
          No Verifications
        </h4>
        <p className="mt-2 max-w-md text-xs font-medium leading-relaxed text-txt-muted">
          Integrate <code className="text-primary font-bold">ctx.addTask()</code> in your evaluation
          suite to perform automated system checks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {run.taskResults.map((tr, i) => (
        <div
          key={i}
          className="group overflow-hidden rounded-2xl border border-slate-800 bg-surface-1 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 bg-surface-2/50 px-6 py-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-inner ${
                  tr.result.exitCode === 0
                    ? "bg-ok text-white shadow-ok/20"
                    : "bg-err text-white shadow-err/20"
                }`}
              >
                {tr.result.exitCode === 0 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              </div>
              <div>
                <span className="text-sm font-black text-txt-base uppercase tracking-tight">
                  {tr.task.name}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-txt-muted">
                    Verification Task
                  </span>
                  {tr.task.weight && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[8px] font-black text-primary uppercase">
                      Weight ×{tr.task.weight}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface-3 px-3 py-1.5">
              <Clock size={12} className="text-txt-muted" />
              <span className="text-[10px] font-black text-txt-secondary">
                {(tr.result.durationMs / 1000).toFixed(2)}s
              </span>
            </div>
          </div>
          <div className="px-6 py-4 bg-surface-1">
            <div className="flex items-start gap-3 mb-4">
              <ChevronRight size={14} className="mt-0.5 text-primary" />
              <p className="text-xs font-bold leading-relaxed text-txt-secondary">
                {tr.task.criteria}
              </p>
            </div>

            {(tr.result.stdout || tr.result.stderr) && (
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black/40">
                <div className="flex items-center justify-between bg-surface-3 px-4 py-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted">
                    Console Output
                  </span>
                </div>
                <pre className="max-h-64 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-400 custom-scrollbar">
                  {tr.result.stdout}
                  {tr.result.stderr && <span className="text-err">{tr.result.stderr}</span>}
                </pre>
              </div>
            )}
          </div>
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
    <div className="space-y-8 pb-8">
      {/* Resource Consumption Grid */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Coins size={18} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-txt-base">
              Resource Utilization
            </h3>
          </div>
          <div className="rounded-full bg-surface-2 border border-slate-800 px-4 py-1.5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-widest text-txt-muted">
              Accumulated:{" "}
            </span>
            <span className="text-[10px] font-black text-primary">
              {totalTokens.toLocaleString()} TOKENS
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Agent Token Card */}
          <TokenCard
            label="Agent Runner"
            icon={<Bot size={16} />}
            tokens={agentTokens}
            accent="primary"
            trend={
              percentChange !== null
                ? { value: Math.abs(Number(percentChange)), positive: diff < 0 }
                : undefined
            }
          />

          {/* Judge Token Card */}
          <TokenCard
            label="Judge Evaluation"
            icon={<ListChecks size={16} />}
            tokens={judgeTokens}
            accent="accent"
          />
        </div>

        {trendData.length > 1 && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-surface-1/50 p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
                  Token Consumption Velocity
                </span>
                <div className="group relative flex items-center justify-center">
                  <Info
                    size={12}
                    className="text-txt-muted cursor-help transition-colors hover:text-primary"
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 rounded-lg border border-slate-800 bg-surface-2 p-2 text-center text-[10px] font-medium leading-relaxed text-txt-secondary shadow-xl group-hover:block z-10">
                    Tracks the agent's total token consumption over recent executions of this
                    specific evaluation.
                  </div>
                </div>
              </div>
              <TrendingUp size={14} className="text-primary opacity-40" />
            </div>{" "}
            <div className="h-32 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="panelColorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    cursor={{ stroke: "#a855f7", strokeWidth: 1, strokeDasharray: "4 4" }}
                    contentStyle={{
                      backgroundColor: "#0e1120",
                      border: "1px solid hsl(var(--color-border) / 0.12)",
                      borderRadius: "8px",
                      fontSize: 11,
                    }}
                    itemStyle={{ color: "#a855f7", fontWeight: 700 }}
                    labelStyle={{ display: "none" }}
                    formatter={(value: number) => [`${value.toLocaleString()} tokens`, "Usage"]}
                  />
                  <YAxis hide domain={["dataMin - 100", "dataMax + 100"]} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#a855f7"
                    fillOpacity={1}
                    fill="url(#panelColorTokens)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#a855f7", strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Latency Analysis */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-warn/10 text-warn">
            <Clock size={18} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-txt-base">
            Latency Breakdown
          </h3>
        </div>
        <TimingAnalysis timing={timing} />
      </section>

      {/* File System Modifications */}
      {run.changedFiles && run.changedFiles.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText size={18} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-txt-base">
              Filesystem Impact
            </h3>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-surface-2/30 backdrop-blur-md">
            <div className="divide-y divide-slate-800/50">
              {run.changedFiles.map((f, i) => {
                const isExpected = run.expectedFiles?.includes(f);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-6 py-3.5 group hover:bg-surface-3 transition-colors"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg ${isExpected ? "bg-ok/10 text-ok" : "bg-surface-4 text-txt-muted"}`}
                      >
                        <FileText size={12} />
                      </div>
                      <span className="truncate font-mono text-xs font-bold text-txt-secondary group-hover:text-txt-base transition-colors">
                        {f}
                      </span>
                    </div>
                    {isExpected && (
                      <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-ok">
                        Expected
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function TokenCard({
  label,
  icon,
  tokens,
  accent,
  trend,
}: {
  label: string;
  icon: React.ReactNode;
  tokens?: TokenUsage;
  accent: "primary" | "accent";
  trend?: { value: number; positive: boolean };
}) {
  const colors =
    accent === "primary"
      ? {
          bg: "bg-primary/5",
          border: "border-primary/20",
          icon: "bg-primary/10 text-primary",
          main: "text-primary",
        }
      : {
          bg: "bg-accent/5",
          border: "border-accent/20",
          icon: "bg-accent/10 text-accent",
          main: "text-accent",
        };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${colors.border} ${colors.bg} p-6 transition-all hover:scale-[1.02] hover:shadow-xl`}
    >
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white opacity-5 blur-2xl" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${colors.icon} shadow-inner`}
          >
            {icon}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-txt-muted">
            {label}
          </span>
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black tracking-widest uppercase ${trend.positive ? "bg-ok/10 text-ok" : "bg-err/10 text-err"}`}
          >
            {trend.positive ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
            {trend.value}%
          </div>
        )}
      </div>

      {tokens ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-txt-muted opacity-60">
                Input
              </p>
              <p className="text-xl font-black text-txt-base tabular-nums tracking-tight">
                {tokens.inputTokens.toLocaleString()}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-txt-muted opacity-60">
                Output
              </p>
              <p className="text-xl font-black text-txt-base tabular-nums tracking-tight">
                {tokens.outputTokens.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Total Load
            </span>
            <span className={`text-2xl font-black tabular-nums ${colors.main} tracking-tighter`}>
              {tokens.totalTokens.toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-txt-muted italic opacity-40">
            No Telemetry Recorded
          </p>
        </div>
      )}
    </div>
  );
}

function TimingAnalysis({ timing }: { timing: LedgerRun["timing"] }) {
  const phases = [
    { key: "setup", label: "Initialization", color: "var(--color-primary)", value: timing.setupMs },
    { key: "agent", label: "Agent Reasoning", color: "#f59e0b", value: timing.agentMs },
    { key: "tasks", label: "Verification", color: "#10b981", value: timing.tasksMs },
    { key: "judge", label: "Judgment", color: "var(--color-accent)", value: timing.judgeMs },
  ].filter((p) => p.value && p.value > 0);

  const total = timing.totalMs || 1;

  return (
    <div className="rounded-2xl border border-slate-800 bg-surface-2/40 p-6 backdrop-blur-sm">
      <div className="mb-6 flex h-3 overflow-hidden rounded-full bg-surface-4 shadow-inner">
        {phases.map((p) => (
          <div
            key={p.key}
            style={{ width: `${((p.value! / total) * 100).toFixed(1)}%`, backgroundColor: p.color }}
            className="h-full transition-all duration-700 ease-out shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]"
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {phases.map((p) => (
          <div
            key={p.key}
            className="flex flex-col gap-1 rounded-xl bg-surface-3/50 p-3 border border-slate-800/50"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` }}
              />
              <span className="text-[9px] font-black uppercase tracking-widest text-txt-muted">
                {p.label}
              </span>
            </div>
            <span className="text-sm font-black text-txt-base tabular-nums">
              {(p.value! / 1000).toFixed(2)}s
            </span>
          </div>
        ))}
        <div className="col-span-2 mt-2 pt-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
            Cumulative Time
          </span>
          <span className="text-xl font-black text-txt-base tracking-tighter">
            {(total / 1000).toFixed(2)}s
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, adjusted }: { status: string; adjusted: boolean }) {
  const styles =
    status === "PASS"
      ? "bg-ok/10 text-ok border border-ok/20"
      : status === "WARN"
        ? "bg-warn/10 text-warn border border-warn/20"
        : "bg-err/10 text-err border border-err/20";

  const label =
    status === "PASS" ? "Above Threshold" : status === "WARN" ? "Needs Review" : "Below Threshold";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${styles}`}
      >
        {label}
      </span>
      {adjusted && (
        <span className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-500">
          Adjusted
        </span>
      )}
    </div>
  );
}

const TABS: { key: Tab; icon: React.ElementType; label: string }[] = [
  { key: "summary", icon: ClipboardCheck, label: "Analysis" },
  { key: "diff", icon: GitBranch, label: "Modifications" },
  { key: "tasks", icon: ListChecks, label: "Verifications" },
  { key: "metrics", icon: Coins, label: "Telemetry" },
];
