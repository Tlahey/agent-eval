import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  CheckCircle2,
  XCircle,
  BarChart3,
  Zap,
  FlaskConical,
} from "lucide-react";
import type { LedgerRun } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { Markdown } from "./Markdown";
import { DiffViewer } from "./DiffViewer";
import { OverrideScoreModal } from "./OverrideScoreModal";
import { overrideScore } from "../lib/api";
import { computeStatus } from "../lib/api";

interface Props {
  run: LedgerRun;
  onClose: () => void;
}

type TabKey = "summary" | "diff" | "tasks" | "metrics";

export function RunDetailPanel({ run, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>("summary");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const navigate = useNavigate();

  const effectiveScore = run.override?.score ?? run.score;
  const effectiveStatus = computeStatus(effectiveScore, run.thresholds);

  const taskCount = run.taskResults?.length ?? 0;
  const changedFilesCount = run.changedFiles?.length ?? 0;

  const handleOverrideSubmit = async (score: number, reason: string) => {
    try {
      await overrideScore(run.id!, score, reason);
      window.location.reload();
    } catch (err) {
      alert("Failed to override score");
    }
  };

  const handleViewAnalytics = () => {
    navigate(`/evals/${encodeURIComponent(run.testId)}?id=${run.id}`);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-4 top-4 bottom-4 z-50 flex h-[calc(100vh-32px)] w-[var(--panel-width)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-3xl border bg-surface-1 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-slide-in">
        {/* Header */}
        <div className="relative overflow-hidden border-b border bg-surface-2/50 px-8 py-8 backdrop-blur-xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-10 blur-3xl bg-ok" />

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
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-txt-muted">
                  {run.variantName && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      <FlaskConical size={12} />
                      {run.variantName}
                    </div>
                  )}
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
                onClick={handleViewAnalytics}
                className="flex h-10 gap-2 items-center px-4 rounded-xl border bg-surface-2 text-txt-muted transition-all hover:bg-primary hover:text-white hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                title="View detailed analytics"
              >
                <BarChart3 size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Analytics</span>
              </button>
              <button
                onClick={() => setShowOverrideModal(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border bg-surface-2 text-txt-muted transition-all hover:bg-primary hover:text-white hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                title="Override score"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border bg-surface-2 text-txt-muted transition-all hover:bg-surface-3 hover:text-txt-base"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Improved Tabs Navigation */}
        <div className="flex border-b border bg-surface-1/50 px-4">
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
          <div
            className={`mx-auto animate-fade-in ${tab !== "diff" ? "max-w-4xl" : "max-w-none h-full"}`}
          >
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
        <div className="rounded-2xl border bg-surface-2/40 p-8 backdrop-blur-sm shadow-inner prose prose-invert max-w-none">
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
          className={`rounded-2xl border-warn/20 bg-warn/5 p-8 backdrop-blur-sm shadow-inner ${!run.improvement && "opacity-50"}`}
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
        <div className="rounded-2xl border bg-surface-1/50 p-6 font-mono text-[11px] leading-relaxed text-txt-secondary border-dashed">
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
          className="group overflow-hidden rounded-2xl border bg-surface-1 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
        >
          <div className="flex items-center justify-between border-b bg-surface-2/50 px-6 py-4">
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
                  <span className="text-[10px] font-bold text-txt-muted italic uppercase">
                    {tr.task.criteria}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest">
                Duration
              </p>
              <p className="text-xs font-bold text-txt-base">
                {(tr.result.durationMs / 1000).toFixed(2)}s
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="relative rounded-xl bg-surface-0 p-4 border border-line/10 group-hover:border-primary/10 transition-colors">
              <div className="absolute top-3 right-4 flex items-center gap-2 text-[9px] font-black text-txt-muted uppercase tracking-widest opacity-40">
                <FileText size={12} />
                Execution Log
              </div>
              <pre className="font-mono text-[11px] leading-relaxed text-txt-secondary overflow-x-auto">
                <code>{tr.result.stdout || tr.result.stderr || "(No output captured)"}</code>
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricsViewer({ run }: { run: LedgerRun }) {
  const agentTokens = run.agentTokenUsage;
  const judgeTokens = run.judgeTokenUsage;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
      {/* Time Metrics */}
      <MetricCard title="Time Profile" icon={Clock} color="text-warn">
        <div className="space-y-4">
          <MetricRow label="Total Session" value={`${(run.durationMs / 1000).toFixed(1)}s`} />
          <MetricRow
            label="Agent Synthesis"
            value={`${(run.timing.agentMs! / 1000).toFixed(1)}s`}
            percent={(run.timing.agentMs! / run.durationMs) * 100}
          />
          <MetricRow
            label="Evaluation Audit"
            value={`${(run.timing.judgeMs! / 1000).toFixed(1)}s`}
            percent={(run.timing.judgeMs! / run.durationMs) * 100}
          />
        </div>
      </MetricCard>

      {/* Token Metrics */}
      <MetricCard title="Intelligence Cost" icon={Coins} color="text-accent">
        <div className="space-y-4">
          <div className="pb-2 border-b border/30">
            <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest mb-3">
              Agent Consumption
            </p>
            <MetricRow
              label="Input Context"
              value={agentTokens?.inputTokens.toLocaleString() ?? "0"}
            />
            <MetricRow
              label="Output Generation"
              value={agentTokens?.outputTokens.toLocaleString() ?? "0"}
            />
          </div>
          <div>
            <p className="text-[10px] font-black text-txt-muted uppercase tracking-widest mb-3">
              Judge Consumption
            </p>
            <MetricRow
              label="Input Context"
              value={judgeTokens?.inputTokens.toLocaleString() ?? "0"}
            />
            <MetricRow
              label="Output Generation"
              value={judgeTokens?.outputTokens.toLocaleString() ?? "0"}
            />
          </div>
        </div>
      </MetricCard>
    </div>
  );
}

function MetricCard({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: any;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-surface-1 p-6 shadow-sm overflow-hidden relative">
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 ${color}`}
        >
          <Icon size={18} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-txt-base">{title}</h3>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, percent }: { label: string; value: string; percent?: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold text-txt-muted">{label}</span>
        <span className="text-xs font-black text-txt-base tabular-nums tracking-tight">
          {value}
        </span>
      </div>
      {percent !== undefined && (
        <div className="h-1 w-full bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, adjusted }: { status: string; adjusted?: boolean }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    PASS: { bg: "bg-ok/10 border-ok/20", text: "text-ok", label: "Success" },
    WARN: { bg: "bg-warn/10 border-warn/20", text: "text-warn", label: "Caution" },
    FAIL: { bg: "bg-err/10 border-err/20", text: "text-err", label: "Failed" },
  };

  const style = styles[status] || styles.FAIL;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${style.bg} ${style.text}`}
      >
        {style.label}
      </span>
      {adjusted && (
        <span className="rounded-lg border border-accent/20 bg-accent/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-accent shadow-sm">
          Adjusted
        </span>
      )}
    </div>
  );
}

const TABS: { key: TabKey; icon: any; label: string }[] = [
  { key: "summary", icon: ClipboardCheck, label: "Analysis" },
  { key: "diff", icon: GitBranch, label: "Modifications" },
  { key: "tasks", icon: ListChecks, label: "Verifications" },
  { key: "metrics", icon: Coins, label: "Telemetry" },
];
