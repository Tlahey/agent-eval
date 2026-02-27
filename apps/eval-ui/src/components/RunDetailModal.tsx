import { useState } from "react";
import type { LedgerRun } from "../lib/api";

type Tab = "reason" | "improvement" | "diff" | "commands";

interface Props {
  run: LedgerRun;
  onClose: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 0.7 ? "text-success" : score >= 0.4 ? "text-warning" : "text-danger";
  return <span className={`font-mono text-3xl font-bold ${color}`}>{score.toFixed(2)}</span>;
}

function StatusBadge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
        pass ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {pass ? "✓ PASS" : "✗ FAIL"}
    </span>
  );
}

function DiffViewer({ diff }: { diff: string | null }) {
  if (!diff) return <p className="text-text-muted italic">No diff captured.</p>;

  return (
    <pre className="overflow-auto rounded-lg bg-[#0d1117] p-4 text-xs leading-relaxed">
      {diff.split("\n").map((line, i) => {
        let cls = "text-gray-400";
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-green-400";
        else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-red-400";
        else if (line.startsWith("@@")) cls = "text-blue-400";
        else if (line.startsWith("diff --git")) cls = "text-yellow-300 font-bold";
        return (
          <div key={i} className={cls}>
            {line}
          </div>
        );
      })}
    </pre>
  );
}

function CommandsViewer({ commands }: { commands: LedgerRun["context"]["commands"] }) {
  if (!commands || commands.length === 0) {
    return <p className="text-text-muted italic">No commands recorded.</p>;
  }

  return (
    <div className="space-y-4">
      {commands.map((cmd, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between bg-surface-alt px-4 py-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  cmd.exitCode === 0 ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                }`}
              >
                {cmd.exitCode === 0 ? "✓" : "✗"}
              </span>
              <span className="font-medium text-text-base">{cmd.name}</span>
              <code className="text-xs text-text-muted">{cmd.command}</code>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>exit {cmd.exitCode}</span>
              <span>{(cmd.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>
          {(cmd.stdout || cmd.stderr) && (
            <pre className="overflow-auto bg-[#0d1117] p-3 text-xs leading-relaxed text-gray-300">
              {cmd.stdout}
              {cmd.stderr && <span className="text-red-400">{cmd.stderr}</span>}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export function RunDetailModal({ run, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("reason");

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "reason", label: "📝 Reason" },
    { key: "improvement", label: "💡 Improvement" },
    { key: "diff", label: "📄 Diff" },
    { key: "commands", label: "⚙️ Commands", count: run.context.commands?.length ?? 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-text-base">{run.testId}</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-text-muted">
              <span>🤖 {run.agentRunner}</span>
              <span>⚖️ {run.judgeModel}</span>
              <span>⏱ {(run.durationMs / 1000).toFixed(1)}s</span>
              <span>{new Date(run.timestamp).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ScoreBadge score={run.score} />
            <StatusBadge pass={run.pass} />
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-base"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key ? "text-primary" : "text-text-muted hover:text-text-base"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 rounded-full bg-surface-alt px-1.5 py-0.5 text-xs">
                  {t.count}
                </span>
              )}
              {tab === t.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {tab === "reason" && (
            <div className="prose prose-sm max-w-none text-text-base">
              <pre className="whitespace-pre-wrap rounded-lg bg-surface-alt p-4 text-sm leading-relaxed">
                {run.reason}
              </pre>
            </div>
          )}

          {tab === "improvement" && (
            <div className="prose prose-sm max-w-none text-text-base">
              {run.improvement ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-surface-alt p-4 text-sm leading-relaxed">
                  {run.improvement}
                </pre>
              ) : (
                <p className="text-text-muted italic">No improvement suggestions.</p>
              )}
            </div>
          )}

          {tab === "diff" && <DiffViewer diff={run.context.diff} />}

          {tab === "commands" && <CommandsViewer commands={run.context.commands} />}
        </div>
      </div>
    </div>
  );
}
