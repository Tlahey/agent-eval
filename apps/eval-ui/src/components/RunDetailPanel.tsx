import { useState, useEffect, useCallback } from "react";
import {
  X,
  MessageSquareText,
  Lightbulb,
  GitBranch,
  Terminal,
  Pencil,
  History,
} from "lucide-react";
import type { LedgerRun, ScoreOverride } from "../lib/api";
import { overrideScore, fetchOverrides } from "../lib/api";
import { ScoreRing } from "./ScoreRing";
import { DiffViewer } from "./DiffViewer";
import { OverrideScoreModal } from "./OverrideScoreModal";

type Tab = "reason" | "improvement" | "diff" | "commands" | "history";

interface Props {
  run: LedgerRun;
  onClose: () => void;
  onOverride?: () => void;
}

function CommandsViewer({ commands }: { commands: LedgerRun["context"]["commands"] }) {
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

const TABS: { key: Tab; icon: typeof MessageSquareText; label: string }[] = [
  { key: "reason", icon: MessageSquareText, label: "Reason" },
  { key: "improvement", icon: Lightbulb, label: "Improve" },
  { key: "diff", icon: GitBranch, label: "Diff" },
  { key: "commands", icon: Terminal, label: "Commands" },
  { key: "history", icon: History, label: "History" },
];

export function RunDetailPanel({ run, onClose, onOverride }: Props) {
  const [tab, setTab] = useState<Tab>("diff");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrides, setOverrides] = useState<ScoreOverride[]>([]);

  const cmdCount = run.context.commands?.length ?? 0;
  const effectiveScore = run.override?.score ?? run.score;
  const effectivePass = run.override?.pass ?? run.pass;

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
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  effectivePass ? "bg-ok/10 text-ok" : "bg-err/10 text-err"
                }`}
              >
                {effectivePass ? "PASS" : "FAIL"}
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

          {tab === "diff" && <DiffViewer diff={run.context.diff} />}

          {tab === "commands" && <CommandsViewer commands={run.context.commands} />}

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
