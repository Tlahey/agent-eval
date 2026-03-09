import { ArrowRight, TrendingUp, TrendingDown, Clock, Bot, Zap } from "lucide-react";
import type { VariantStats } from "../useEvalDetail";

interface Props {
  comparison: {
    a: VariantStats;
    b: VariantStats;
    deltas: {
      score: number;
      duration: number;
      tokens: number;
    };
  };
}

export function ComparisonPanel({ comparison }: Props) {
  const { a, b, deltas } = comparison;

  return (
    <div className="glass-card p-8 border-primary/30 bg-primary/5 animate-slide-up">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <Zap size={20} />
          </div>
          <h2 className="text-xl font-black text-txt-base tracking-tight uppercase">
            Head-to-Head Comparison
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-txt-base uppercase px-3 py-1 bg-surface-2 rounded-lg border tabular-nums">
            {a.variantName}
          </span>
          <ArrowRight size={16} className="text-txt-muted" />
          <span className="text-xs font-black text-primary uppercase px-3 py-1 bg-primary/10 rounded-lg border border-primary/30 tabular-nums">
            {b.variantName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <MetricDelta
          label="Quality Score"
          valA={a.avgScore}
          valB={b.avgScore}
          delta={deltas.score}
          format={(v) => `${(v * 100).toFixed(1)}%`}
          icon={<Zap size={16} />}
          isBetter={deltas.score > 0}
        />
        <MetricDelta
          label="Execution Speed"
          valA={a.avgDurationMs}
          valB={b.avgDurationMs}
          delta={deltas.duration}
          format={(v) => `${(v / 1000).toFixed(1)}s`}
          icon={<Clock size={16} />}
          isBetter={deltas.duration < 0} // Lower duration is better
          inverse
        />
        <MetricDelta
          label="Token Efficiency"
          valA={a.avgTokens}
          valB={b.avgTokens}
          delta={deltas.tokens}
          format={(v) => formatTokens(v)}
          icon={<Bot size={16} />}
          isBetter={deltas.tokens < 0} // Lower tokens is better
          inverse
        />
      </div>
    </div>
  );
}

function MetricDelta({
  label,
  valA,
  valB,
  delta,
  format,
  icon,
  isBetter,
  inverse,
}: {
  label: string;
  valA: number;
  valB: number;
  delta: number;
  format: (v: number) => string;
  icon: React.ReactNode;
  isBetter: boolean;
  inverse?: boolean;
}) {
  const absDelta = Math.abs(delta);
  const percentDelta = valA === 0 ? 0 : (absDelta / valA) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-txt-muted">
        <span className="opacity-50">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>

      <div className="flex items-end justify-between border-b border/30 pb-4">
        <div className="space-y-1">
          <p className="text-2xl font-black text-txt-base tabular-nums">{format(valB)}</p>
          <p className="text-[10px] font-bold text-txt-muted">from {format(valA)}</p>
        </div>

        <div
          className={`flex flex-col items-end gap-1 ${isBetter ? "text-ok" : delta === 0 ? "text-txt-muted" : "text-err"}`}
        >
          <div className="flex items-center gap-1 font-black text-sm tabular-nums uppercase">
            {delta !== 0 && (isBetter ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
            {delta > 0 ? "+" : ""}
            {format(delta)}
          </div>
          <span className="text-[9px] font-black bg-current/10 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
            {delta === 0 ? "No change" : isBetter ? "Better" : "Worse"} ({percentDelta.toFixed(0)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}
