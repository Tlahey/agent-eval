import type { VariantStats } from "../useEvalDetail";
import { ScoreRing } from "../../../components/ScoreRing";
import { Bot, Clock, Zap, Plus, Minus } from "lucide-react";

interface Props {
  stats: VariantStats[];
  compareA: string;
  compareB: string;
  onCompare: (variant: string) => void;
}

export function VariantGrid({ stats, compareA, compareB, onCompare }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((v) => {
        const isSelected = v.variantName === compareA || v.variantName === compareB;
        const isA = v.variantName === compareA;
        const isB = v.variantName === compareB;

        return (
          <div
            key={v.variantName}
            className={`glass-card p-5 transition-all duration-300 relative overflow-hidden group ${
              isSelected
                ? "ring-2 ring-primary border-primary/50 bg-primary/5 scale-[1.02]"
                : "hover:border-primary/20 hover:scale-[1.01]"
            }`}
          >
            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-txt-onprimary text-[10px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg">
                Variant {isA ? "A" : "B"}
              </div>
            )}

            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-txt-base tracking-tight truncate max-w-[180px]">
                  {v.variantName}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider">
                    Model:
                  </span>
                  <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                    {v.runner}
                  </span>
                </div>
              </div>
              <ScoreRing value={v.avgScore} size={48} strokeWidth={4} />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-txt-muted uppercase tracking-widest">
                  Speed
                </p>
                <div className="flex items-center gap-1 text-xs font-bold text-txt-base tabular-nums">
                  <Clock size={10} className="text-primary opacity-50" />
                  {(v.avgDurationMs / 1000).toFixed(1)}s
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[8px] font-black text-txt-muted uppercase tracking-widest">
                  Usage
                </p>
                <div className="flex items-center justify-center gap-1 text-xs font-bold text-txt-base tabular-nums">
                  <Bot size={10} className="text-primary opacity-50" />
                  {formatTokens(v.avgTokens)}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[8px] font-black text-txt-muted uppercase tracking-widest">
                  Success
                </p>
                <div className="flex items-center justify-end gap-1 text-xs font-bold text-txt-base tabular-nums">
                  <Zap size={10} className="text-ok opacity-50" />
                  {(v.passRate * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <button
              onClick={() => onCompare(v.variantName)}
              className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                isSelected
                  ? "bg-err text-white hover:bg-err/80 shadow-lg shadow-err/20"
                  : "bg-surface-2 text-txt-muted hover:bg-primary hover:text-white border shadow-sm"
              }`}
            >
              {isSelected ? (
                <>
                  <Minus size={12} />
                  Deselect
                </>
              ) : (
                <>
                  <Plus size={12} />
                  Select for comparison
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}
